import { World, PHYSICS, WATER, LAVA, raycast, collides } from '../world.js';
import { Survival, ITEMS, burnTime } from '../survival.js';
import { Hoppers, hopperBehaviour } from '../hopper.js';
import { containerSlotsOf } from '../redstone-runtime.js';
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
import { installDispensers } from '../dispense.js';
import { dispenseFirework } from '../fireworks-live.js';
import { LightVolume, lightEmission, celestialAngle, skylightSubtracted } from '../lighting.js';
import { tickWorldSystems } from '../world-tick.js';
import { placeHeldBlock } from '../block-placement-simulation.js';
import { breakPlayerBlock } from '../block-break-simulation.js';
import { makeStack } from '../inventory.js';
import { IDLE_INPUT, cleanInput, cleanLook, validName, encodeColumn } from './protocol.js';
import { ServerColumns, ServerLight } from './server-world.js';

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

// One dedicated world, independent of all connected tabs: the finite 128 x 128 Java landscape, or a streamed (infinite) world
// whose resident columns follow the connected players (server-world.js ServerColumns). Streamed worlds need the population block
// mapper first (server-world.js serverWorldReady). `port`: the generator worker for a streamed world (nodeWorkerPort), or null.
export class DedicatedSimulation {
  constructor(saved = {}, { world = null, port = null } = {}) {
    if (saved.version !== undefined && saved.version !== 1) throw new Error('Unsupported dedicated save version');
    this.world = world ?? new World(saved.seed ?? 'ledoge0', saved.biome ?? 'java', saved.generationVersion ?? 9);
    this.columns = this.world.streaming ? new ServerColumns(this.world, { port }) : null;
    // World.restore deliberately limits browser import batches to 100k cells.
    // A long-lived dedicated world can legitimately edit more cells than that.
    const edits = saved.edits ?? [];
    if (!Array.isArray(edits)) throw new Error('Invalid dedicated edits');
    for (let i = 0; i < edits.length; i += 100000) this.world.restore(edits.slice(i, i + 100000));
    if (this.columns) this.world.restoreClaimedColumns(saved.claimed); // population records already handed over stay handed over
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
      // Comparators read the shared tile inventories (redstone-runtime.js containerSlotsOf), as in the browser.
      containerSlots: containerSlotsOf(this.world, { chests: () => this.tiles.chests, furnaces: () => this.tiles.furnaces, dispensers: () => this.tiles.dispensers,
        hoppers: () => this.tiles.hoppers, brewing: () => this.tiles.brewing, maxStack: s => this.tiles.inventory.maxStack(s) }),
    });
    this.redstone.registerBehaviour(154, hopperBehaviour); // BlockHopper: power disables it (metadata bit 8)
    this.installDispensers();
    this.redstone.restore(saved.redstone);
    // TileEntityHopper.updateEntity for every hopper in a ticking column (hopper.js), over the shared tile maps; a move tells the
    // comparators (RedstoneWorld.containerChanged). The gun server's dropped items are the ones a hopper sucks up (hopperItems); its
    // chest and hopper minecarts are inventories a hopper fills and empties.
    const tiles = this.tiles;
    this.hoppers = new Hoppers({
      world: this.world, chests: () => tiles.chests, furnaces: () => tiles.furnaces, dispensers: () => tiles.dispensers,
      hoppers: () => tiles.hoppers, brewing: () => tiles.brewing, maxStack: s => tiles.inventory.maxStack(s), burnTime,
      items: () => this.hopperItems(), active: (x, z) => !this.columns || this.world.isTicking(x, z),
      carts: () => this.mobs?.minecarts?.carts ?? [], random: this.weather.random, // chest and hopper minecarts (inventory-transfer.js containerAt)
      changed: keys => { for (const key of keys ?? []) this.redstone.containerChanged(...String(key).split(',').map(Number)); },
    });
    const emission = (x, y, z, b) => lightEmission(b, this.redstone.lit.has(`${x},${y},${z}`));
    this.light = this.columns ? new ServerLight(this.world, emission) : new LightVolume(this.world, emission);
    if (this.columns) this.light.columns({ added: [...this.world.chunks.values()] });
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
      // A streamed column is rebuilt from the seed and its remembered writes when it comes back (ServerColumns.build), so
      // the untracked writes (flowing water, redstone, falling sand) are remembered too.
      if (result && !track && this.columns) this.world.rememberEdit(x, y, z, b | (m << 8));
      return result;
    };
    if (this.columns) {
      // WorldServer's chunk loop over every ticking column of every player, not one 10-chunk square (Weather.activeChunks).
      const tickChunks = this.weather.tickChunks.bind(this.weather);
      this.weather.tickChunks = world => tickChunks(world, [...this.columns.ticking].map(k => k.split(',').map(Number)));
    }
    this.mobs = this.createMobs(saved); // before the first columns' population is handed over
    if (this.columns) {
      this.mobs?.columns({ added: [...this.world.chunks.values()], removed: [] });
      this.materialize();
    }
  }
  // Streamed worlds: the population records (dungeon and temple loot, flower pots, liquid ticks) of columns resident for the first time.
  materialize() { return this.columns?.materialize({ tiles: this.tiles, fluids: this.fluids, ...(this.mobs ? { mobs: this.mobs.ew, spawners: this.mobs.spawners, minecarts: this.mobs.minecarts } : {}) }) ?? null; }
  // The gun server's mobs (server-mobs.js); this base simulation has none.
  createMobs() { return null; }
  // Streamed worlds: makes the columns of these windows resident (and the spawn window); new columns are lit and handed over.
  reside(windows) {
    const change = this.columns.reside(windows);
    if (change.added.length || change.removed.length) { this.light.columns(change); this.mobs?.columns(change); this.materialize(); }
    return change;
  }
  // What a tab needs of the weather each tick: WorldInfo's fields and the live rain and thunder strengths (World.rainingStrength,
  // thunderingStrength, sent to clients as Packet43 game events in Java), so a tab fades them as the server does.
  weatherState() {
    const w = this.weather;
    return { ...w.save(), rain: w.rain, thunder: w.thunder, lightning: w.lastLightning, bolts: w.bolts.filter(b => !b.dead).map(b => [b.x, b.y, b.z, String(b.vertex)]) };
  }
  // The weather tick's thunder sounds and the bolts that flashed (the gun server forwards and strikes them; this base drops them).
  weatherEvents() {}
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
    this.watch(player);
    return player;
  }
  // Streamed worlds: player `p` sees the window around where it stands now (a join, or a teleport the caller already waited for).
  watch(p) {
    if (!this.columns) return;
    p.view = this.columns.windowAt(p.position.x, p.position.z); p.sendColumns = null;
    this.reside([...this.players.values()].map(o => o.view).filter(Boolean));
  }
  // Each tick, before anyone moves: a player's window follows it once the window's cells are built (until then it keeps the old one
  // and, past the ticking columns, waits); the resident columns become the union of the windows; the worker builds what comes next.
  updateViews() {
    if (!this.columns) return;
    const players = [...this.players.values()];
    for (const p of players) {
      const want = this.columns.windowAt(p.position.x, p.position.z);
      if (ServerColumns.same(want, p.view) || !this.columns.ready(want)) continue;
      const had = new Set(p.view && !p.sendColumns ? [...this.columns.keys(p.view)].map(k => k.join(',')) : []);
      p.view = want; p.sendColumns = [...this.columns.keys(want)].filter(k => !had.has(k.join(',')));
    }
    this.reside(players.map(p => p.view).filter(Boolean));
    this.columns.prefetchAround(players.map(p => p.position));
  }
  // The columns player `p` lacks for its new window, as they stand after this tick (sent after the tick message), or null.
  drainColumns(p) {
    if (!p.sendColumns) return null;
    const list = p.sendColumns; p.sendColumns = null;
    return { type: 'columns', window: p.view, columns: list.map(([cx, cz]) => encodeColumn(this.world.chunkAt(cx, cz))) };
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
    this.updateViews();
    this.tickPlayers();
    for (const { id, place } of this.actions.splice(0)) { const p = this.players.get(id); if (p) this.edit(p, place); }
    return this.tickWorld(beforeLit);
  }
  // Movement of every connected player; the gun server's subclass adds combat and Survival (gun-simulation.js).
  tickPlayers() {
    for (const p of this.players.values()) {
      p.survival.time = this.time;
      if (this.frozen(p)) continue;
      const controls = this.ticks - p.lastInput > 10 ? IDLE_INPUT : p.input;
      movePlayer(p, controls);
      if (p.position.y < -64) { p.position.copy(this.world.spawn()); p.previous.copy(p.position); Object.assign(p.velocity, { x: 0, y: 0, z: 0 }); }
      p.survival.time = this.time;
      if (p.swing) p.swing--;
    }
  }
  hopperItems() { return []; } // dropped items a hopper can pick up (the gun server's ItemEntities)
  // BlockDispenser (23) and BlockDropper (158) on the server's redstone (dispense.js), over the shared dispenser tiles. The entities
  // they shoot are the server's own (server-mobs.js: arrows, thrown things, fireballs, minecarts, rockets; server-play.js dropped
  // items); a dropper pushes into the container in front through the hoppers' transfer host. The aux sounds 1000 / 1001 (click)
  // and 1002 (bow) go to the players in earshot; the smoke particles (2000) are not sent. The server has no primed TNT entity, so a
  // dispensed TNT is used up without one (LiveRedstone.primeTnt has no hook here).
  installDispensers() {
    const AUX_SOUNDS = { 1000: ['random.click', 1], 1001: ['random.click', 1.2], 1002: ['random.bow', 1.2] };
    const tiles = this.tiles, mobs = () => this.mobs;
    this.dispensing = installDispensers(this.redstone, {
      tile: (x, y, z) => ((tiles.dispensers ??= {})[`${x},${y},${z}`] ??= { items: Array(9).fill(null) }),
      aux: (id, x, y, z) => { const s = AUX_SOUNDS[id]; if (s) mobs()?.sound({ sound: s[0], position: { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, volume: 1, pitch: s[1] }); },
      rng: () => mobs()?.arrows.rng(),
      spawnItem: (stack, x, y, z, mx, my, mz) => { this.play?.items.spawn(stack, x, y, z, { motion: [mx, my, mz] }); },
      arrow: e => { const a = mobs()?.arrows; a?.list.push(a.make(e, e.rand, { shooter: null, pickup: 1 })); },
      thrown: (kind, e) => {
        const m = mobs();
        if (!m) return;
        const ball = { x: e.x, y: e.y, z: e.z, mx: e.mx, my: e.my, mz: e.mz, yaw: e.yaw, pitch: e.pitch, kind, px: e.x, py: e.y, pz: e.z, prevYaw: e.yaw, prevPitch: e.pitch, ticks: 0, rand: e.rand, random: e.rand, dead: false };
        if (kind === 'potion') m.ew.potions.balls.push({ ...ball, damage: e.damage, owner: null });
        else m.projectiles.balls.push(ball);
      },
      fireball: ({ x, y, z, ax, ay, az }) => { mobs()?.ew.fireballs.launch({ large: false, owner: null, x, y, z, exact: [ax, ay, az] }); }, // FIRE_CHARGE
      cart: (type, x, y, z) => { const c = mobs()?.minecarts; if (type === 0) c?.spawnEmpty({ x, y, z }); else c?.spawnCart(type, { x, y, z, items: [] }); },
      firework: (stack, x, y, z, fx, fz) => { const r = mobs()?.rockets; if (r) dispenseFirework(r, x, y, z, fx, fz, stack); },
      // World.setBlock with notify (World.set), so the fluids schedule the poured liquid (Fluids world.onChange) and the redstone sees it.
      setLiquid: (x, y, z, id) => { this.world.set(x, y, z, id === 10 ? LAVA : WATER, true, 0); },
      setAir: (x, y, z) => { this.world.set(x, y, z, 0, true, 0); },
      setFire: (x, y, z) => { this.fire.ignite(x, y, z); },
      boneMeal: (x, y, z, original) => original === 6 && this.trees.boneMeal(x, y, z) !== null,
      transfer: () => this.hoppers?.host ?? null,
      maxStack: s => tiles.inventory.maxStack(s),
    });
  }
  // A streamed world's player whose column is not ticking (its window is still being generated) waits, like an unloaded chunk.
  frozen(p) { return !!this.columns && !this.world.isTicking(p.position.x, p.position.z); }
  tickWorld(beforeLit) {
    this.weather.tick(this.world);
    this.weatherEvents(this.weather.drain(), this.weather.struck);
    this.falling.tick();
    tickWorldSystems({ farming: this.farming, fluids: this.fluids, fire: this.fire, hoppers: this.hoppers, redstone: this.redstone },
      { time: this.time, daylight: 1 - this.darkness / 15, x: 64, z: 64 }, { farming: noop, fluids: noop, fire: noop });
    for (const key of new Set([...beforeLit, ...this.redstone.lit])) if (beforeLit.has(key) !== this.redstone.lit.has(key)) {
      const [x, y, z] = key.split(',').map(Number);
      this.changes.set(key, [x, y, z, this.world.get(x, y, z), this.world.getMeta(x, y, z)]);
    }
    for (const [x, y, z] of this.changes.values()) this.light.update(x, y, z);
    const changes = [...this.changes.values()].map(([x, y, z]) => [x, y, z, this.world.get(x, y, z), this.world.getMeta(x, y, z)]);
    this.changes.clear();
    return { type: 'tick', tick: this.ticks, time: this.time, changes, players: this.presence(), weather: this.weatherState(), redstone: { lit: [...this.redstone.lit] } };
  }
  presence() { return [...this.players.values()].map(p => ({ id: p.id, name: p.name, x: p.position.x, y: p.position.y, z: p.position.z,
    yaw: p.yaw, pitch: p.pitch, flying: p.flying, grounded: p.grounded, sneak: p.input.sneak, sprinting: p.motion.sprinting, swing: p.swing,
    held: p.survival.held, ySize: p.motion.ySize, skin: p.skin })); }
  // `view`: a streamed world's window ({ minX, minZ }) whose columns this tab gets; a finite world sends all of them.
  snapshot(view = null) {
    const w = this.world, columns = view ? [...this.columns.keys(view)].map(([cx, cz]) => w.chunkAt(cx, cz)) : [...w.chunks.values()];
    return { seed: w.seed, biome: w.biome, generationVersion: w.generationVersion, ...(view ? { window: view, originX: w.originX, originZ: w.originZ, nativeSpawn: w.nativeSpawn ?? null } : {}),
      time: this.time, ticks: this.ticks, columns: columns.map(encodeColumn), players: this.presence(), weather: this.weatherState(), redstone: { lit: [...this.redstone.lit] } };
  }
  save() {
    for (const p of this.players.values()) this.savedPlayers.set(p.resumeKey, this.savePlayer(p));
    return { version: 1, seed: this.world.seed, biome: this.world.biome, generationVersion: this.world.generationVersion,
      edits: [...this.world.edits], time: this.time, ticks: this.ticks, weather: this.weather.save(), worldRandom: this.weather.saveSimulation(),
      farms: this.farming.serialize(), fluidTicks: this.fluids.save(), fireTicks: this.fire.save(), falling: this.falling.serialize(), fallingTicks: this.falling.save(),
      redstone: this.redstone.save(), tiles: this.tiles.serialize(), players: [...this.savedPlayers], ...(this.columns ? { claimed: this.world.saveClaimedColumns() } : {}) };
  }
}
