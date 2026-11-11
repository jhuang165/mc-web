import { World, PHYSICS, WATER, LAVA, MOB_SPAWNER, raycast, collides } from '../world.js';
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
import { serverClick } from '../server-handlers.js';
import { Signs, ITEM_SIGN, SIGN_LINES, isSign, placeSign } from '../signs.js';
import { Skulls, SKULL, ITEM_SKULL, placeSkull } from '../skull.js';
import { Beacons, BEACON, pyramidLevel, applyBeaconPick, isPaymentItem } from '../pyramid.js';
import { MobSpawners } from '../mob-spawner.js';
import { describeTiles, describeCell } from '../tile-sync.js';
import { IDLE_INPUT, cleanInput, cleanLook, validName, encodeColumn, splitChanges } from './protocol.js';

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
    // The tile entities the clients are told about (tile-sync.js); flower pots live on the world. Signs and skulls are placed by `edit`, a sign's
    // text comes in by `updateSign` (C12), a beacon's effects by `chooseBeacon` (MC|Beacon) and a spawner's mob by `setSpawnerEntity`; each
    // marks its cell (`tileChanged`) and the next tick sends the description packet (S33 / S35) with the cell changes.
    this.dirtyTiles = new Set();
    const te = saved.tileEntities ?? {};
    this.tileEntities = { world: this.world, signs: Signs.fromJSON(te.signs), skulls: Skulls.fromJSON(te.skulls), beacons: new Beacons().fromJSON(te.beacons), spawners: MobSpawners.fromJSON(te.spawners) };
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
  addPlayer(id, name, resumeKey, { skin = null } = {}) {
    if (!validName(name) || [...this.players.values()].some(p => p.name.toLowerCase() === name.toLowerCase())) throw new Error('Choose an unused name (1–16 letters, numbers or underscores).');
    if ([...this.players.values()].some(p => p.resumeKey === resumeKey)) throw new Error('That player is already connected.');
    const saved = this.savedPlayers.get(resumeKey), start = saved?.position ?? this.world.spawn();
    const position = vector(start), survival = new Survival(saved?.player ?? {}, 'creative');
    for (const key of ['chests', 'furnaces', 'dispensers', 'hoppers', 'brewing', 'enderTiles']) survival[key] = this.tiles[key];
    const player = { id, name, resumeKey, world: this.world, position, previous: vector(position), velocity: vector({ x: 0, y: 0, z: 0 }), motion: new PlayerMotion(), survival,
      yaw: saved?.yaw ?? 0, pitch: saved?.pitch ?? 0, grounded: false, collidedH: false, flying: false, fallDistance: 0, landedFall: 0, eating: null,
      input: { ...IDLE_INPUT }, lastInput: this.ticks, swing: 0, skin };
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
    Object.assign(p, look, { input, lastInput: this.ticks, moved: true });
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
    // NetHandlerPlayServer C07 / C08 (server-handlers.js): block centre within 8 of the feet for a place (and the player has sent a position),
    // 6 from the eye offset for a dig, nothing at or above the 256 build limit. The ray's 5 blocks sit inside both distances, so only the height
    // and the has-moved rule can refuse here; the refusal text is kept on the player for the connection to deliver.
    const feet = [p.position.x, p.position.y, p.position.z];
    const gate = serverClick({ kind: place ? 'place' : 'dig', player: feet, pos: target.block, adjacent: target.adjacent, hasMoved: !!p.moved });
    // nh.a(jo) always ends a block placement packet (any face but 255) with an S23 for the clicked cell and for the cell on the clicked face, to
    // that player only, accepted or not; a refused dig (status 0, 1, 2 over 6 blocks or at the height limit) returns silently and resends nothing.
    if (place) p.resendCells = [target.block, target.adjacent];
    if (!gate.accept) { p.refusal = gate.message ?? null; return false; }
    p.swing = 6;
    const state = { ...p, world: this.world, farming: this.farming, trees: this.trees, items: { spill: noop }, heldTool: p.survival.held?.id ?? 0 };
    if (!place) return breakPlayerBlock(state, target.block, { creative: true });
    // Block activations that don't open a GUI remain shared.
    const [x, y, z] = target.block, b = this.world.get(x, y, z);
    if ([108, 111, 112, 124, 126, 127].includes(b) && !p.input.sneak) { this.redstone.use(x, y, z); return true; }
    const id = state.heldTool;
    if (id === WATER || id === LAVA) return false;
    // ItemSign.onItemUse / ItemSkull.onItemUse on the server ray (signs.js, skull.js): the placer becomes the sign's editor and gets the S36
    // open-editor message; a head keeps its type and (on top of a block) its rotation. No wither is built here (no soul sand id is passed).
    if (id === ITEM_SIGN) {
      return placeSign({ world: this.world, survival: p.survival, yaw: p.yaw }, { id, target }, { signs: this.tileEntities.signs,
        openEditor: tile => { tile.editor = p.id; p.openSign = [tile.x, tile.y, tile.z]; } }).placed;
    }
    if (id === ITEM_SKULL) {
      return placeSkull({ world: this.world, survival: p.survival, yaw: p.yaw }, { id, damage: p.survival.held?.damage ?? 0, target }, { skulls: this.tileEntities.skulls, difficulty: 0 }).placed;
    }
    return placeHeldBlock(state, { id, item: ITEMS[id], target }, {
      collides: w => [...this.players.values()].some(other => {
        // The normal placement path tests this callback after its speculative
        // write, so the same collision test must cover every connected player.
        return collides(w, other.position.x, other.position.y, other.position.z);
      }),
    }).placed;
  }
  // Marks the tile entity at a cell for a description packet on the next tick (World.markBlockForUpdate on a tile edit).
  tileChanged(x, y, z) { this.dirtyTiles.add(`${x},${y},${z}`); }
  // NetHandlerPlayServer.processUpdateSign (C12): only the sign's editable tile, edited by the player it names as editor, takes the lines;
  // each line over 15 characters or with a disallowed one becomes "!?". Anything else is dropped silently (the original logs a warning).
  updateSign(id, m) {
    const p = this.players.get(id);
    if (!p || ![m?.x, m?.y, m?.z].every(Number.isInteger) || !Array.isArray(m.text) || m.text.length !== SIGN_LINES || !m.text.every(t => typeof t === 'string')) return false;
    const tile = this.tileEntities.signs.tile(m.x, m.y, m.z);
    if (!tile || !tile.editable || tile.editor !== id || !isSign(this.world.get(m.x, m.y, m.z))) return false;
    if (!this.tileEntities.signs.update(m.x, m.y, m.z, m.text)) return false;
    this.tileChanged(m.x, m.y, m.z);
    return true;
  }
  // The MC|Beacon custom payload: the tile takes the picks only while a payment sits in its slot (`tile.payment`; one item is consumed), each pick
  // checked against the pyramid level (applyBeaconPick). The level is refreshed here from the pyramid; the original recounts it every 80 ticks.
  chooseBeacon(id, m) {
    if (!this.players.has(id) || ![m?.x, m?.y, m?.z, m?.primary, m?.secondary].every(Number.isInteger) || this.world.get(m.x, m.y, m.z) !== BEACON) return false;
    const tile = this.tileEntities.beacons.ensure(m.x, m.y, m.z), w = this.world;
    tile.levels = pyramidLevel((x, y, z) => w.get(x, y, z), (x, y, z) => { for (let yy = y; yy < w.height; yy++) if (w.solid(x, yy, z)) return false; return true; }, m.x, m.y, m.z);
    // The dedicated server has no container windows: the held payment item stands in for the beacon slot (players are creative, so nothing is spent).
    const held = this.players.get(id).survival.held;
    if (!tile.payment && held && isPaymentItem(held.id)) tile.payment = { id: held.id, count: 1, damage: held.damage ?? 0 };
    if (!applyBeaconPick(tile, m.primary, m.secondary)) return false;
    this.tileChanged(m.x, m.y, m.z);
    return true;
  }
  // MobSpawnerBaseLogic.setEntityName followed by markBlockForUpdate. 1.7.10's spawn egg has no spawner branch (spawn-egg-use.js), so no client
  // message reaches this; it is the server-side hook for a command or an operator tool.
  setSpawnerEntity(x, y, z, entityId) {
    const spawner = this.world.get(x, y, z) === MOB_SPAWNER ? this.tileEntities.spawners.get(x, y, z) : null;
    if (!spawner || typeof entityId !== 'string' || !entityId || entityId.length > 64) return false;
    spawner.entityId = entityId;
    this.tileChanged(x, y, z);
    return true;
  }
  // A tile entity goes with its block (BlockContainer.breakBlock / World.removeTileEntity).
  dropTiles(x, y, z, block) {
    const t = this.tileEntities;
    if (!isSign(block)) t.signs.remove(x, y, z);
    if (block !== SKULL) t.skulls.remove(x, y, z);
    if (block === BEACON) t.beacons.ensure(x, y, z); else t.beacons.remove(x, y, z); // BlockContainer.onBlockAdded makes the tile, a default one
    if (block === MOB_SPAWNER) { if (!t.spawners.get(x, y, z)) t.spawners.add({ x, y, z }); } else t.spawners.remove(x, y, z);
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
    for (const p of this.players.values()) if (p.resendCells) {
      p.blocks = p.resendCells.map(([x, y, z]) => [x, y, z, this.world.get(x, y, z), this.world.getMeta(x, y, z)]); p.resendCells = null;
    }
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
    const final = [...this.changes.values()].map(([x, y, z]) => [x, y, z, this.world.get(x, y, z), this.world.getMeta(x, y, z)]);
    this.changes.clear();
    for (const [x, y, z, b] of final) this.dropTiles(x, y, z, b);
    // PlayerInstance.sendChunkUpdate: under 64 changed cells in a chunk go as cells, 64 resend the chunk (protocol.js splitChanges).
    const { changes, chunks } = splitChanges(final, (cx, cz) => this.world.chunks.get(`${cx},${cz}`), (cx, cz, mask) => describeTiles(this.tileEntities, cx, cz, mask));
    // sendChunkUpdate's other branches: each changed cell that is not inside a resent chunk sends its tile entity's description, and so does an
    // edited tile (dirtyTiles). They ride in `tiles`; expandChunks adds the descriptions of the resent chunks.
    const tiles = [], seen = new Set(), covered = (x, y, z) => chunks.some(c => c.x === x >> 4 && c.z === z >> 4 && (c.mask >> (y >> 4) & 1));
    for (const [x, y, z] of [...changes, ...[...this.dirtyTiles].map(k => k.split(',').map(Number))]) {
      const key = `${x},${y},${z}`;
      if (seen.has(key) || covered(x, y, z)) continue;
      seen.add(key);
      const t = describeCell(this.tileEntities, x, y, z);
      if (t) tiles.push(t);
    }
    this.dirtyTiles.clear();
    return { type: 'tick', tick: this.ticks, time: this.time, changes, ...(chunks.length ? { chunks } : {}), ...(tiles.length ? { tiles } : {}), players: this.presence(), weather: this.weather.save(), redstone: { lit: [...this.redstone.lit] } };
  }
  presence() { return [...this.players.values()].map(p => ({ id: p.id, name: p.name, x: p.position.x, y: p.position.y, z: p.position.z,
    yaw: p.yaw, pitch: p.pitch, flying: p.flying, grounded: p.grounded, sneak: p.input.sneak, sprinting: p.motion.sprinting, swing: p.swing,
    held: p.survival.held, ySize: p.motion.ySize, skin: p.skin })); }
  snapshot() { const w = this.world; return { seed: w.seed, biome: w.biome, generationVersion: w.generationVersion,
    time: this.time, ticks: this.ticks, columns: [...w.chunks.values()].map(encodeColumn), players: this.presence(), weather: this.weather.save(), redstone: { lit: [...this.redstone.lit] } }; }
  save() {
    for (const p of this.players.values()) this.savedPlayers.set(p.resumeKey, this.savePlayer(p));
    return { version: 1, seed: this.world.seed, biome: this.world.biome, generationVersion: this.world.generationVersion,
      edits: [...this.world.edits], time: this.time, ticks: this.ticks, weather: this.weather.save(), worldRandom: this.weather.saveSimulation(),
      farms: this.farming.serialize(), fluidTicks: this.fluids.save(), fireTicks: this.fire.save(), falling: this.falling.serialize(), fallingTicks: this.falling.save(),
      redstone: this.redstone.save(), tiles: this.tiles.serialize(),
      tileEntities: { signs: this.tileEntities.signs.toJSON(), skulls: this.tileEntities.skulls.toJSON(), beacons: this.tileEntities.beacons.toJSON(), spawners: this.tileEntities.spawners.toJSON() }, players: [...this.savedPlayers] };
  }
}
