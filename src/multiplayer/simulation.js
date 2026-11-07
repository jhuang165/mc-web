import { World, PHYSICS, WATER, LAVA, raycast, collides } from '../world.js';
import { Survival, ITEMS } from '../survival.js';
import { PlayerMotion } from '../player-movement.js';
import { movePlayer } from '../player-physics.js';
import { Farming } from '../farming.js';
import { Fluids } from '../fluids.js';
import { Fire } from '../fire.js';
import { Weather, canLightningStrikeAt } from '../weather.js';
import { Trees } from '../trees.js';
import { Plants } from '../plants.js';
import { FallingBlocks } from '../falling.js';
import { Rails } from '../rails.js';
import { Torches } from '../torches.js';
import { Doors } from '../doors-panes.js';
import { Beds } from '../bed.js';
import { LiveRedstone } from '../redstone-live.js';
import { LightVolume, lightEmission, celestialAngle, skylightSubtracted } from '../lighting.js';
import { tickWorldSystems } from '../world-tick.js';
import { placeHeldBlock } from '../block-placement-simulation.js';
import { breakPlayerBlock } from '../block-break-simulation.js';
import { makeStack } from '../inventory.js';
import { IDLE_INPUT, cleanInput, cleanLook, validName, encodeColumn } from './protocol.js';

const noop = () => {};
const vector = p => ({ ...p, copy(v) { Object.assign(this, { x: v.x, y: v.y, z: v.z }); return this; } });
export function cleanHotbar(slots) {
  if (!Array.isArray(slots) || slots.length !== 9) return null;
  const out = [];
  for (const s of slots) {
    if (s === null) { out.push(null); continue; }
    if (!s || !Number.isInteger(s.id) || !ITEMS[s.id] || !Number.isInteger(s.damage ?? 0) || (s.damage ?? 0) < 0 || (s.damage ?? 0) > 32767) return null;
    out.push(makeStack(s.id, 64, s.damage ?? 0));
  }
  return out;
}

// One dedicated world, independent of all connected tabs. Finite terrain is an
// explicit first-milestone residency policy, not a host player's moving window.
export class DedicatedSimulation {
  constructor(saved = {}, { world = null } = {}) {
    if (saved.version !== undefined && saved.version !== 1) throw new Error('Unsupported dedicated save version');
    this.world = world ?? new World(saved.seed ?? 'ledoge0', saved.biome ?? 'java', saved.generationVersion ?? 9);
    if (this.world.streaming) throw new Error('Dedicated v1 requires a finite world');
    // World.restore deliberately limits browser import batches to 100k cells.
    // A long-lived dedicated world can legitimately edit more cells than that.
    const edits = saved.edits ?? [];
    if (!Array.isArray(edits)) throw new Error('Invalid dedicated edits');
    for (let i = 0; i < edits.length; i += 100000) this.world.restore(edits.slice(i, i + 100000));
    this.time = saved.time ?? 6000;
    this.ticks = saved.ticks ?? 0;
    this.players = new Map();
    this.savedPlayers = new Map(saved.players ?? []);
    this.changes = new Map();
    this.actions = [];
    this.tiles = new Survival(saved.tiles ?? {}, 'creative');
    this.weather = new Weather().restore(saved.weather).restoreSimulation(saved.worldRandom);
    this.farming = new Farming(this.world, saved.farms);
    this.fluids = new Fluids(this.world, { random: this.weather.random });
    this.fluids.load(saved.fluidTicks);
    this.fire = new Fire(this.world, { weather: () => this.weather,
      stillLava: (x, y, z) => !this.fluids.pending.has(this.fluids.key(x, y, z, LAVA)) });
    this.fire.watch();
    this.fire.sharedRandomTicks = true;
    this.fire.load(saved.fireTicks);
    this.trees = new Trees(this.world, { random: this.weather.random, apply: noop, drop: noop,
      light: (x, y, z) => this.light.level(x, y, z, this.darkness) }).watch();
    this.plants = new Plants(this.world, { drop: noop, broken: noop, apply: noop }).watch();
    this.falling = new FallingBlocks(this.world, { drop: noop, apply: noop }, saved.falling).watch();
    this.falling.load(saved.fallingTicks);
    for (const System of [Rails, Torches, Doors, Beds]) new System(this.world, { drop: noop, apply: noop }).watch();
    this.redstone = new LiveRedstone(this.world, {
      entitiesIn: box => [...this.players.values()].filter(p => p.position.x + .3 > box[0] && p.position.x - .3 < box[3] && p.position.y + 1.8 > box[1] && p.position.y < box[4] && p.position.z + .3 > box[2] && p.position.z - .3 < box[5]).map(p => ({ ...p.position, player: true, living: true })),
      environment: () => ({ sky: 15, skylightSubtracted: this.darkness, celestialAngle: celestialAngle(this.time, 1) * Math.PI * 2, noSky: false }),
      skyLight: (x, y, z) => this.light.skyAt(x, y, z),
    });
    this.redstone.restore(saved.redstone);
    this.light = new LightVolume(this.world, (x, y, z, b) => lightEmission(b, this.redstone.lit.has(`${x},${y},${z}`)));
    this.world.blockLight = (x, y, z) => this.light.blockAt(x, y, z);
    this.world.fullLight = (x, y, z) => this.light.level(x, y, z, 0);
    this.farming.lightLevel = (x, y, z) => this.light.level(x, y, z, this.darkness);
    this.farming.rained = (x, y, z) => canLightningStrikeAt(this.weather, this.world, x, y + 1, z);
    this.weather.fire = this.fire.strikes;
    this.weather.blockTick = (x, y, z, b) => this.fire.randomTick(x, y, z, b) || this.trees.randomTick(x, y, z, b) || this.plants.randomTick(x, y, z, b);
    // Instance hook sees *every* write, including untracked and fluid/redstone
    // writes. Store only the final cell value per tick; never wrap World globally.
    const put = this.world.put.bind(this.world);
    this.world.put = (x, y, z, b, m = 0, track = true) => {
      const old = this.world.get(x, y, z), meta = this.world.getMeta(x, y, z);
      const result = put(x, y, z, b, m, track);
      if (result && (old !== b || meta !== m)) this.changes.set(`${x},${y},${z}`, [x, y, z, b, m]);
      return result;
    };
  }
  get darkness() { return skylightSubtracted(celestialAngle(this.time, 1), this.weather.rainStrength(), this.weather.weightedThunder()); }
  addPlayer(id, name, resumeKey) {
    if (!validName(name) || [...this.players.values()].some(p => p.name.toLowerCase() === name.toLowerCase())) throw new Error('Choose an unused name (1–16 letters, numbers or underscores).');
    if ([...this.players.values()].some(p => p.resumeKey === resumeKey)) throw new Error('That player is already connected.');
    const saved = this.savedPlayers.get(resumeKey), start = saved?.position ?? this.world.spawn();
    const position = vector(start), survival = new Survival(saved?.player ?? {}, 'creative');
    for (const key of ['chests', 'furnaces', 'dispensers', 'hoppers', 'brewing', 'enderTiles']) survival[key] = this.tiles[key];
    const player = { id, name, resumeKey, world: this.world, position, previous: vector(position), velocity: vector({ x: 0, y: 0, z: 0 }), motion: new PlayerMotion(), survival,
      yaw: saved?.yaw ?? 0, pitch: saved?.pitch ?? 0, grounded: false, collidedH: false, flying: false, fallDistance: 0, landedFall: 0, eating: null,
      input: { ...IDLE_INPUT }, lastInput: this.ticks, swing: 0 };
    this.players.set(id, player);
    return player;
  }
  removePlayer(id) {
    const p = this.players.get(id);
    if (p) this.savedPlayers.set(p.resumeKey, this.savePlayer(p));
    this.players.delete(id);
  }
  savePlayer(p) { return { position: { x: p.position.x, y: p.position.y, z: p.position.z }, yaw: p.yaw, pitch: p.pitch,
    player: { slots: p.survival.inventory.serialize(), current: p.survival.inventory.current } }; }
  input(id, message) {
    const p = this.players.get(id), input = cleanInput(message.controls), look = cleanLook(message.yaw, message.pitch), slots = cleanHotbar(message.hotbar);
    if (!p || !input || !look || !slots || !Number.isInteger(message.current) || message.current < 0 || message.current > 8) return false;
    Object.assign(p, look, { input, lastInput: this.ticks });
    for (let i = 0; i < 9; i++) p.survival.inventory.main[i] = slots[i];
    p.survival.inventory.current = message.current;
    return true;
  }
  queueEdit(id, message) {
    if (!this.players.has(id) || this.actions.filter(a => a.id === id).length >= 4 || typeof message.place !== 'boolean') return false;
    this.actions.push({ id, place: message.place }); return true;
  }
  edit(p, place) {
    // Compute the ray on the server from authoritative position/look. No client
    // block coordinate, reach, held item or collision claim is trusted.
    const eye = { x: p.position.x, y: p.position.y + PHYSICS.eye, z: p.position.z };
    const dir = { x: -Math.sin(p.yaw) * Math.cos(p.pitch), y: Math.sin(p.pitch), z: -Math.cos(p.yaw) * Math.cos(p.pitch) };
    const target = raycast(this.world, eye, dir, 5);
    if (!target) return false;
    p.swing = 6;
    const state = { ...p, world: this.world, farming: this.farming, trees: this.trees, items: { spill: noop }, heldTool: p.survival.held?.id ?? 0 };
    if (!place) return breakPlayerBlock(state, target.block, { creative: true });
    // Block activations that don't open a GUI remain shared.
    const [x, y, z] = target.block, b = this.world.get(x, y, z);
    if ([108, 111, 112, 124, 126, 127].includes(b) && !p.input.sneak) { this.redstone.use(x, y, z); return true; }
    const id = state.heldTool;
    if (id === WATER || id === LAVA) return false;
    return placeHeldBlock(state, { id, item: ITEMS[id], target }, {
      collides: w => [...this.players.values()].some(other => {
        // The normal placement path tests this callback after its speculative
        // write, so the same collision test must cover every connected player.
        return collides(w, other.position.x, other.position.y, other.position.z);
      }),
    }).placed;
  }
  tick() {
    const beforeLit = new Set(this.redstone.lit);
    this.ticks++; this.time++;
    for (const p of this.players.values()) {
      const controls = this.ticks - p.lastInput > 10 ? IDLE_INPUT : p.input;
      movePlayer(p, controls);
      if (p.position.y < -64) { p.position.copy(this.world.spawn()); p.previous.copy(p.position); Object.assign(p.velocity, { x: 0, y: 0, z: 0 }); }
      p.survival.time = this.time;
      if (p.swing) p.swing--;
    }
    for (const { id, place } of this.actions.splice(0)) { const p = this.players.get(id); if (p) this.edit(p, place); }
    this.weather.tick(this.world);
    this.weather.drain();
    this.falling.tick();
    tickWorldSystems({ farming: this.farming, fluids: this.fluids, fire: this.fire, redstone: this.redstone },
      { time: this.time, daylight: 1 - this.darkness / 15, x: 64, z: 64 }, { farming: noop, fluids: noop, fire: noop });
    for (const key of new Set([...beforeLit, ...this.redstone.lit])) if (beforeLit.has(key) !== this.redstone.lit.has(key)) {
      const [x, y, z] = key.split(',').map(Number);
      this.changes.set(key, [x, y, z, this.world.get(x, y, z), this.world.getMeta(x, y, z)]);
    }
    for (const [x, y, z] of this.changes.values()) this.light.update(x, y, z);
    const changes = [...this.changes.values()].map(([x, y, z]) => [x, y, z, this.world.get(x, y, z), this.world.getMeta(x, y, z)]);
    this.changes.clear();
    return { type: 'tick', tick: this.ticks, time: this.time, changes, players: this.presence(), weather: this.weather.save(), redstone: { lit: [...this.redstone.lit] } };
  }
  presence() { return [...this.players.values()].map(p => ({ id: p.id, name: p.name, x: p.position.x, y: p.position.y, z: p.position.z,
    yaw: p.yaw, pitch: p.pitch, flying: p.flying, grounded: p.grounded, sneak: p.input.sneak, sprinting: p.motion.sprinting, swing: p.swing,
    held: p.survival.held, ySize: p.motion.ySize })); }
  snapshot() { const w = this.world; return { seed: w.seed, biome: w.biome, generationVersion: w.generationVersion,
    time: this.time, ticks: this.ticks, columns: [...w.chunks.values()].map(encodeColumn), players: this.presence(), weather: this.weather.save(), redstone: { lit: [...this.redstone.lit] } }; }
  save() {
    for (const p of this.players.values()) this.savedPlayers.set(p.resumeKey, this.savePlayer(p));
    return { version: 1, seed: this.world.seed, biome: this.world.biome, generationVersion: this.world.generationVersion,
      edits: [...this.world.edits], time: this.time, ticks: this.ticks, weather: this.weather.save(), worldRandom: this.weather.saveSimulation(),
      farms: this.farming.serialize(), fluidTicks: this.fluids.save(), fireTicks: this.fire.save(), falling: this.falling.serialize(), fallingTicks: this.falling.save(),
      redstone: this.redstone.save(), tiles: this.tiles.serialize(), players: [...this.savedPlayers] };
  }
}
