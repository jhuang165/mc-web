// Batch 61 mpnether: dimension travel on the dedicated multiplayer server (the Nether; the End is not connected).
//
// What this module does, and the evidence behind it:
//   * A second finite world for the Nether, built the first time somebody needs it. Its 8 x 8 columns come from the single-player generator
//     (DimensionWorld.generateTerrainChunk for dimension -1, the same seed rules), about one second of work once. Edits to it are kept like the
//     Overworld's (`world.edits`) and saved with the world; its item entities are not saved (a gap, see the track note).
//   * Every server player has a `dimension` (0 or -1) and a `world`. movePlayer already reads the player's own world.
//   * Standing in a lit portal runs PortalState (Entity.onEntityUpdate, 80 ticks in Survival, 1 in Creative: dimensions.js). The trip is
//     transferEntityToWorld: coordinates scaled by 8 (transferTarget), then the Teleporter (placeInExistingPortal, radius 128, makePortal).
//     The finite worlds are 128 wide, so coordinates are scaled about the middle (64, 64) and the target is kept 24 blocks inside the edge.
//   * `dimRespawn` (S07 Respawn plus the new world) tells the client to swap its world; the server sends it before that player's next tick message.
//     Each player gets the tick message of their own dimension (`alt`), with only that dimension's players, items and cell changes.
//   * Flint and steel lights fire on the server; BlockFire.onBlockAdded then tries the portal (NetherLive, the same rules as single player).
//   * The `portal` achievement (pc.y, bytecode-read in EntityPlayerMP.travelToDimension) goes to a player on every trip that is not to or from the End.
// Batch 62 (mpnether2): the Nether's fluids, fire, random ticks, falling blocks, redstone, containers, mobs and saved state live in server-nether.js; the End is not connected.
import { DimensionWorld } from '../dimension-world.js';
import { javaSeed } from '../java-world.js';
import { JavaRandom } from '../java-random.js';
import { materialSolid } from '../plants.js';
import { ItemEntities } from '../item-entities.js';
import { Signs } from '../signs.js';
import { Skulls } from '../skull.js';
import { Beacons } from '../pyramid.js';
import { MobSpawners } from '../mob-spawner.js';
import { Weather } from '../weather.js';
import { Torches } from '../torches.js';
import { Doors } from '../doors-panes.js';
import { Beds } from '../bed.js';
import { Rails } from '../rails.js';
import { Plants } from '../plants.js';
import { ITEMS } from '../survival.js';
import { NetherLive } from '../nether-portal-live.js';
import { PORTAL, FIRE } from '../nether-portal.js';
import { describeTiles, describeCell } from '../tile-sync.js';
import { PortalState, Teleporter, transferTarget, GAME_IDS, portalCooldown } from '../dimensions.js';
import { encodeColumn, splitChanges } from './protocol.js';
import { FiniteDimensionWorld, NETHER } from './client-dimensions.js';
import { ServerEnd } from './server-end.js'; // b63 mpend: the End
import { NETHER_CONTEXT, buildNetherSystems, buildNetherInside, saveNether, tickNether, applyPopulation } from './server-nether.js';

const OVERWORLD = 0, END = 1, MIDDLE = 64, MARGIN = 24, SIZE = 128;
const noop = () => {};
// Entity yaw: the game's radians (0 looks toward -z) <-> Minecraft degrees (0 looks toward +z); the same two lines as dimension-live.js.
export const gameYaw = degrees => Math.PI - degrees * Math.PI / 180;
export const mcYaw = yaw => (Math.PI - yaw) * 180 / Math.PI;
const solidId = id => id !== 0 && materialSolid(id);
const clamp = v => Math.max(MARGIN, Math.min(SIZE - MARGIN, v));
// Anything that asks a stand-in "does this system know the cell" gets a no-op answer (the Nether has no windows, redstone or crops).
const inert = () => new Proxy({}, { get: (_, key) => key === 'litFurnaces' || key === 'lit' ? new Set() : key === 'observe' ? noop : () => false });
const TILE_KEYS = ['chests', 'furnaces', 'dispensers', 'hoppers', 'brewing', 'enderTiles'];
// Simulation methods a player's own message reaches (by player id); each runs inside that player's dimension.
const ENTRY_POINTS = ['pickup', 'invClick', 'invAck', 'invClose', 'closeWindow', 'clickWindow', 'windowInventory', 'confirmTransaction', 'station', 'dropHeld', 'updateSign', 'chooseBeacon', 'setBeaconPayment'];

export class ServerDimensions {
  constructor(sim, saved = {}) {
    this.sim = sim; this.saved = saved ?? {}; this.nether = null; this.depth = 0; this.alt = {}; this.clearWeather = new Weather().save();
    this.teleporters = new Map(); this.overworld = sim.world; this.end = new ServerEnd(this); // b63 mpend: the End (server-end.js)
    // sim.world is swapped while a Nether player's action runs
    // Overworld: a fire block lights a complete frame and a portal block without its frame goes (nether-portal-live.js, chained after Fire).
    new NetherLive(sim.world, { random: sim.weather.random, apply: noop }).watch();
    for (const name of ENTRY_POINTS) {
      if (typeof sim[name] !== 'function') continue;
      const original = sim[name].bind(sim);
      sim[name] = (id, ...rest) => this.within(sim.players.get(id), () => original(id, ...rest));
    }
    // A Nether player who respawns starts at the Overworld spawn (their bed or the world spawn), so the world swap follows ServerSurvival.respawn.
    const respawn = sim.serverSurvival.respawn.bind(sim.serverSurvival);
    sim.serverSurvival.respawn = p => { const was = p?.dimension; const done = respawn(p); if (done && was) this.arrive(p, OVERWORLD, { at: p.position }); return done; };
    // Each tick the simulation finishes, the portals are checked and the Nether (items, cell changes) is ticked and described: `alt` is its message.
    const tick = sim.tick.bind(sim);
    sim.tick = () => { const message = tick(); this.afterTick(message); return message; };
  }
  get active() { return !!this.nether; }
  // The Nether, built on first use.
  ensureNether() {
    if (this.nether) return this.nether;
    const sim = this.sim, seed = sim.world.seed, world = new FiniteDimensionWorld(seed, NETHER), source = new DimensionWorld(seed, NETHER);
    for (let cx = 0; cx < SIZE / 16; cx++) for (let cz = 0; cz < SIZE / 16; cz++) {
      const column = world.chunks.get(`${cx},${cz}`), made = source.generateTerrainChunk(cx, cz);
      column.blocks.set(made.blocks); column.meta.set(made.metadata);
    }
    const saved = this.saved.nether ?? {}, edits = Array.isArray(saved.edits) ? saved.edits : [];
    for (let i = 0; i < edits.length; i += 100000) world.restore(edits.slice(i, i + 100000));
    const n = { world, changes: new Map(), items: new ItemEntities(), itemsSent: 0, dirtyTiles: new Set(), xp: inert(), overMobs: sim.mobs };
    n.items.joined = e => { e.eid = ++sim.nextItemId; };
    buildNetherSystems(sim, n, source, saved); // b62: tiles, tile entities, redstone, containers, light, fluids, fire, trees, plants, falling, farming, weather
    if (!saved.tiles) applyPopulation(n, source); // a Nether nobody has saved yet: the fortress chests' loot and the blaze spawners
    const put = world.put.bind(world);
    world.put = (x, y, z, b, m = 0, track = true) => {
      const old = world.get(x, y, z), meta = world.getMeta(x, y, z), result = put(x, y, z, b, m, track);
      if (result && (old !== b || meta !== m)) n.changes.set(`${x},${y},${z}`, [x, y, z, b, m]);
      return result;
    };
    // The block rules that need no clock: neighbours dropping torches, doors, beds, rails and plants, and the portal itself.
    const drop = (...a) => sim.serverItems.stacksDrop(...a);
    for (const System of [Rails, Torches, Doors, Beds]) new System(world, { drop, apply: noop }).watch();
    new NetherLive(world, { random: sim.weather.random, apply: noop }).watch();
    this.nether = n; // set before the inside build: ServerContainers.adopt and the mobs may call back
    this.swap(n, () => buildNetherInside(sim, n, saved)); // systems that register on `sim.*` while they are built (dispensers, hoppers, the mobs)
    sim.dispense?.adopt?.(n.dispense); // b62 lead: saved Nether arrows, balls and potions (the Overworld's stand-in lane) move to the Nether's own instance
    return n;
  }
  // The stand-ins `sim` reads while a Nether player's action runs (sim.world is the Overworld otherwise).
  context(n) { return Object.fromEntries(NETHER_CONTEXT.map(key => [key, n[key]])); } // b62: + tiles, fluids, fire, falling, light, dispense, mobs
  swap(n, fn) {
    const sim = this.sim, context = this.context(n), keep = {}, xp = sim.serverItems.xp;
    for (const key of Object.keys(context)) { keep[key] = sim[key]; sim[key] = context[key]; }
    sim.serverItems.xp = n.xp; this.depth++;
    try { return fn(); } finally { this.depth--; sim.serverItems.xp = xp; for (const key of Object.keys(keep)) sim[key] = keep[key]; }
  }
  // b63: the state object of a dimension (-1 the Nether, 1 the End), built on first use; the world and the Overworld mob view by dimension.
  state(d) { return d === END ? this.end.ensure() : this.ensureNether(); }
  worldOf(d) { return d ? this.state(d).world : this.overworld; }
  mobsOf(d) { return d === END ? this.end.n.mobs : d ? this.nether.mobs : (this.nether?.overMobs ?? this.end.n?.overMobs ?? this.sim.mobs); }
  // Runs `fn` as the player's dimension: a Nether player's block edits, digs, drops and windows touch the Nether's world, items and tile entities.
  within(p, fn) {
    if (!p?.dimension || this.depth) return fn();
    const n = this.state(p.dimension), tiles = {};
    for (const key of TILE_KEYS) { tiles[key] = p.survival[key]; p.survival[key] = n.tiles[key]; } // chests, furnaces ... are keyed by cell only
    try { return this.swap(n, fn); } finally { for (const key of TILE_KEYS) p.survival[key] = tiles[key]; }
  }
  // ItemFlintAndSteel.onItemUse: the cell on the clicked face, if it is air and inside the build limits, takes a fire block; the tool wears (Survival).
  // The sound is the server's. Returns true when the held item was flint and steel (the click is used up either way).
  useItem(p, target, id) {
    if (this.end.useItem(p, target, id)) return true; // b63 mpend: an eye of ender on an end portal frame
    if (ITEMS[id]?.kind !== 'flint_and_steel') return false;
    const sim = this.sim, w = this.worldOf(p.dimension), q = target.adjacent;
    if (!q || q[1] === 0 || q[1] >= 256 || !w.inside(...q)) return true;
    if (w.get(...q) === 0) {
      sim.soundsOut.push({ name: 'fire.ignite', x: q[0] + 0.5, y: q[1] + 0.5, z: q[2] + 0.5, volume: 1, pitch: Math.fround(Math.fround(sim.soundRand.nextFloat() * Math.fround(0.4)) + Math.fround(0.8)), except: null, dim: p.dimension | 0 });
      if (p.dimension) w.set(q[0], q[1], q[2], FIRE, true, 0); else sim.fire.ignite(...q);
    }
    if (!p.survival.creative) p.survival.wear(id);
    return true;
  }
  // ---- joining, saving and describing ----
  // A player saved in the Nether comes back to it.
  adopt(p, saved) {
    if (saved?.dimension === END) { this.end.adopt(p); p.portal = new PortalState(); p.portal.timeUntilPortal = portalCooldown(true); return; } // b63 mpend
    if (saved?.dimension !== NETHER) return;
    p.world = this.ensureNether().world; p.dimension = NETHER; p.portal = new PortalState(); p.portal.timeUntilPortal = portalCooldown(true);
    const n = this.nether;
    n.overMobs.removePlayer(p.id); n.mobs.addPlayer(p); // the Overworld's mobs must not target a player who is not there; the Nether's do
  }
  // A player who disconnects leaves the Nether's mob view as well (simulation.removePlayer hook).
  removePlayer(id) { this.nether?.mobs.removePlayer(id); this.end.n?.mobs.removePlayer(id); }
  savedFields(p) { return p.dimension ? { dimension: p.dimension } : {}; }
  saveField() {
    const n = this.nether, out = {};
    if (n) out.nether = { edits: [...n.world.edits], ...saveNether(n) }; else if (this.saved.nether) out.nether = this.saved.nether;
    const end = this.end.saveField(); if (end) out.end = end; // b63 mpend
    return Object.keys(out).length ? { dimensions: out } : {};
  }
  list(items) { return items.items.filter(e => !e.dead).map(e => ({ i: e.eid, stack: e.stack, x: e.x, y: e.y, z: e.z, age: e.age, hover: e.hover, delay: e.delay })); }
  // The world snapshot a player in another dimension joins or arrives with (null for an Overworld player).
  snapshotFor(playerId) {
    const p = this.sim.players.get(playerId);
    if (!p?.dimension) return null;
    const n = this.state(p.dimension), sim = this.sim;
    return { gameMode: sim.gameMode, items: this.list(n.items), seed: n.world.seed, biome: n.world.biome, generationVersion: n.world.generationVersion, dimension: p.dimension,
      time: sim.time, ticks: sim.ticks, columns: [...n.world.chunks.values()].map(encodeColumn), players: sim.presence(p.dimension), weather: this.clearWeather, redstone: { lit: [...n.redstone.lit] }, contTiles: this.swap(n, () => n.containers.describeAll()) };
  }
  // ---- per tick ----
  afterTick(base) {
    const sim = this.sim;
    for (const p of [...sim.players.values()]) if (!p.dead) this.checkPortal(p);
    for (const t of this.teleporters.values()) if (sim.ticks % 100 === 0) t.removeStale(sim.ticks);
    this.alt = {};
    if (this.nether) this.alt[NETHER] = this.netherMessage(base);
    if (this.end.n) this.alt[END] = this.netherMessage(base, this.end.n, END); // b63 mpend
  }
  // BlockPortal.onEntityCollidedWithBlock (the box overlaps a portal block) and Entity.onEntityUpdate's timer; `p.previous` is the last tick's position.
  checkPortal(p) {
    if (this.end.checkPortal(p)) return; // b63 mpend: BlockEndPortal
    const w = p.world, at = p.position, hw = 0.3 - 0.001;
    p.portal ??= new PortalState();
    let inside = false;
    for (let x = Math.floor(at.x - hw); x <= Math.floor(at.x + hw) && !inside; x++) for (let z = Math.floor(at.z - hw); z <= Math.floor(at.z + hw) && !inside; z++) for (let y = Math.floor(at.y + 0.001); y <= Math.floor(at.y + 1.8 - 0.001); y++) {
      if (w.get(x, y, z) === PORTAL) { inside = true; break; }
    }
    if (inside) p.portal.setInPortal(p.previous.x, p.previous.z, at.x, at.z);
    const go = p.portal.tick(p.dimension | 0, { isPlayer: true, creative: p.survival.creative, riding: false });
    if (go !== null) this.arrive(p, go);
  }
  teleporterFor(dimension) {
    let t = this.teleporters.get(dimension);
    if (t) return t;
    const sim = this.sim, w = this.worldOf(dimension), seed = javaSeed(w.seed);
    const adapter = { get: (x, y, z) => w.get(x, y, z), notify: noop, get time() { return sim.ticks; }, actualHeight: dimension ? 128 : 256, dimension, seed,
      set: (x, y, z, id, meta = 0, flags = 3) => { if (flags === 2) w.put(x, y, z, id, meta, true); else w.set(x, y, z, id, true, meta); } };
    this.teleporters.set(dimension, t = new Teleporter(adapter, { isSolid: solidId, random: new JavaRandom(seed) }));
    return t;
  }
  // The trip: the destination is built, the Teleporter places the player, and a `dimRespawn` is queued for the connection. `at` skips the search (a respawn).
  arrive(p, to, { at = null, exit = false } = {}) {
    const sim = this.sim, from = p.dimension | 0;
    if (to === from) return false;
    const dest = this.worldOf(to);
    const e = { x: p.position.x, y: p.position.y, z: p.position.z, vx: 0, vy: 0, vz: 0, yaw: mcYaw(p.yaw), pitch: 0, teleportDirection: p.portal?.teleportDirection ?? 0 };
    if (at) Object.assign(e, { x: at.x, y: at.y, z: at.z });
    else if (to === END) this.end.place(e, from, e.yaw); // b63 mpend: the platform at the End's entrance
    else {
      const tt = transferTarget(from, to, p.position.x - MIDDLE, p.position.y, p.position.z - MIDDLE, e.yaw);
      Object.assign(e, { x: clamp(tt.x + MIDDLE), y: tt.y, z: clamp(tt.z + MIDDLE), yaw: tt.yaw });
      // the Teleporter's writes run neighbour rules (a torch beside the frame drops): in the destination's context
      const place = () => this.teleporterFor(to).placeInPortal(e, e.x, e.y, e.z, e.yaw);
      if (to) this.swap(dest === this.overworld ? this.ensureNether() : this.ensureNether(), place); else place();
    }
    // The player leaves the old dimension: the mob view goes (or comes back), and everything aimed at the old world is dropped.
    sim.vehicles?.dismount(p); // b61 lead: a rider leaves the vehicle (Entity.travelToDimension mounts nothing across)
    this.mobsOf(from).removePlayer(p.id); this.mobsOf(to).addPlayer(p); // b62: each dimension's mobs see only its own players
    p.world = dest; p.dimension = to;
    p.position.copy({ x: e.x, y: e.y, z: e.z }); p.previous.copy(p.position);
    Object.assign(p.velocity, { x: 0, y: 0, z: 0 }); Object.assign(p, { fallDistance: 0, landedFall: 0, grounded: false });
    if (!at) p.yaw = gameYaw(e.yaw);
    p.pitch = 0; p.itemInUse = null; p.dig.abort(); if (p.window) sim.closeWindow(p.id);
    p.blocks = p.resendCells = p.mobPackets = p.cracksOut = p.openSign = p.openBeacon = null;
    p.portal ??= new PortalState(); p.portal.timeUntilPortal = portalCooldown(true); p.portal.inPortal = false;
    if (!this.end.award(p, from, to, exit) && !at) sim.achievements.award(p, 'portal'); // b63: theEnd / theEnd2 for the End's trips // pc.y: every trip that is not to or from the End (bytecode-read)
    sim.serverSurvival?.resendEffects(p); // b61 lead: ServerConfigurationManager.transferPlayerToDimension sends every active effect as S1D (mphealth2's burst)
    (p.dimOut ??= []).push({ type: 'dimRespawn', dimension: to, world: sim.snapshot(p.id), self: sim.savePlayer(p) });
    return true;
  }
  // Sent by the connection before the player's next tick message.
  flush(deliver) { for (const p of this.sim.players.values()) if (p.dimOut) { for (const m of p.dimOut) deliver(p.id, m); p.dimOut = null; } }
  // The Nether's items tick and its cell changes become a tick message (the same fields the Overworld's carries, without weather, redstone or XP).
  netherMessage(base, n = this.nether, dim = NETHER) {
    const sim = this.sim, w = n.world, here = [...sim.players.values()].filter(p => p.dimension === dim);
    if (here.length) this.swap(n, () => tickNether(sim, n, here)); // b62: the world systems of the Nether (nobody there: nothing is loaded, so nothing runs)
    else { n.changes.clear(); n.dirtyTiles.clear(); }
    const final = [...n.changes.values()].map(([x, y, z]) => [x, y, z, w.get(x, y, z), w.getMeta(x, y, z)]);
    n.changes.clear();
    let out;
    this.swap(n, () => {
      for (const [x, y, z, b] of final) sim.dropTiles(x, y, z, b);
      const { changes, chunks } = splitChanges(final, (cx, cz) => w.chunks.get(`${cx},${cz}`), (cx, cz, mask) => describeTiles(n.tileEntities, cx, cz, mask));
      const tiles = [], seen = new Set(), covered = (x, y, z) => chunks.some(c => c.x === x >> 4 && c.z === z >> 4 && (c.mask >> (y >> 4) & 1));
      for (const [x, y, z] of [...changes, ...[...n.dirtyTiles].map(k => k.split(',').map(Number))]) {
        const key = `${x},${y},${z}`;
        if (seen.has(key) || covered(x, y, z)) continue;
        seen.add(key);
        const t = describeCell(n.tileEntities, x, y, z);
        if (t) tiles.push(t);
      }
      n.dirtyTiles.clear();
      const list = this.list(n.items), items = !list.length && !n.itemsSent ? {} : { items: list };
      n.itemsSent = list.length;
      out = { type: 'tick', tick: base.tick, time: base.time, changes, ...(chunks.length ? { chunks } : {}), ...(tiles.length ? { tiles } : {}), players: sim.presence(dim), weather: this.clearWeather, redstone: { lit: [...n.redstone.lit] }, ...items, ...n.containers.actionsField() };
    });
    return out;
  }
}
