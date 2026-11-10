// The gun server's Nether and End (MinecraftServer.worldServers[1] and [2]): one child GunSimulation per dimension over a
// DimensionWorld (dimension-world.js), made the first time someone travels there and saved with the Overworld's state. Every world
// keeps the Overworld's clock, rules, accounts and chat. A trip (ServerConfigurationManager.transferPlayerToDimension) takes the
// player out of its world, waits for the arrival window's columns from that world's generator worker, runs the Teleporter
// (dimensions.js: the 1:8 scale, the portal search, a new portal or the End platform), then puts the player in the new world; the tab
// gets a 'travel' message when it leaves (GuiDownloadTerrain) and a 'dimension' message with the new world when it arrives.
import { DimensionWorld } from '../dimension-world.js';
import { OVERWORLD, NETHER, END, GAME_IDS, Teleporter, transferTarget, portalCooldown } from '../dimensions.js';
import { gameYaw, mcYaw } from '../dimension-live.js';
import { materialSolid } from '../plants.js';
import { JavaRandom } from '../java-random.js';
import { javaSeed } from '../java-world.js';
import { runSteps } from '../steps.js';
import { spawnDragonIfAbsent } from '../dragon-mobs.js';
import { dismount } from './server-riding.js';
import { dropHook } from './server-fishing.js';
import { wake, bedRespawn } from './server-beds.js';
import { trigger } from './server-stats.js';

const SPAN = 128; // a player's window: 8 x 8 columns
const yieldNow = () => new Promise(resolve => setImmediate(resolve));

// The Teleporter's view of a server world: the resident columns, else the remembered writes (a portal block is never generated
// terrain, so a far portal is always one of them). Its own writes stay here until the trip applies them.
export class ServerPeek {
  constructor(sim) {
    const w = sim.world;
    this.sim = sim; this.world = w; this.over = new Map(); this.writes = [];
    this.dimension = w.dimension ?? OVERWORLD; this.actualHeight = w.actualHeight ?? 256;
    this.seed = javaSeed(w.seed);
  }
  get time() { return this.sim.time; }
  get(x, y, z) {
    if (y < 0 || y >= 256) return 0;
    const k = `${x},${y},${z}`, o = this.over.get(k);
    if (o !== undefined) return o & 255;
    if (this.world.isLoaded(x, z)) return this.world.get(x, y, z);
    const e = this.world.edits.get(k);
    return e === undefined ? 0 : e & 255;
  }
  set(x, y, z, id, meta = 0, flags = 3) {
    if (y < 0 || y >= 256) return;
    this.over.set(`${x},${y},${z}`, id | meta << 8);
    this.writes.push([x, y, z, id, meta, flags]);
  }
  notify() {}
  portalColumns(id, x0, x1, z0, z1) {
    const seen = new Set(), out = [];
    const add = (key, value) => {
      if ((value & 255) !== id) return;
      const [x, , z] = key.split(',').map(Number), k = `${x},${z}`;
      if (x < x0 || x > x1 || z < z0 || z > z1 || seen.has(k)) return;
      seen.add(k); out.push([x, z]);
    };
    for (const [key, value] of this.world.edits) add(key, value);
    for (const [key, value] of this.over) add(key, value);
    return out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }
  // The Teleporter's writes go into the world: resident cells as block changes the tabs see, the rest remembered for when the column
  // is built. The portal checks stay quiet (a half-built frame is not a broken one).
  apply() {
    const sim = this.sim, w = this.world;
    sim.netherLive.silent++;
    try {
      for (const [x, y, z, id, meta] of this.writes) {
        if (w.isLoaded(x, z)) w.set(x, y, z, id, true, meta);
        else w.rememberEdit(x, y, z, id | meta << 8);
      }
    } finally { sim.netherLive.silent--; }
    const n = this.writes.length;
    this.writes = []; this.over.clear();
    return n;
  }
}

export class ServerDimensions {
  // `saved`: the root save's `dimensions` ({ '-1': child save, '1': ... }); `makePort()`: a new generator worker for a child world.
  constructor(root, saved = {}, { makePort = null } = {}) {
    this.root = root; this.saved = saved && typeof saved === 'object' ? saved : {}; this.makePort = makePort;
    this.sims = new Map(); // dimension -> child simulation
    this.portals = new Map(); // simulation -> { peek, teleporter } (the Teleporter's destinationCoordinateCache lasts)
    this.transit = new Map(); // player id -> { p, to, events } while a trip is under way
    this.arrivals = []; // [player, simulation] that arrived since the server last looked
    this.departures = []; // [player id, dimension] that left a world since then (the tab shows GuiDownloadTerrain)
    this.queue = Promise.resolve();
  }
  get(d) {
    if (d === OVERWORLD) return this.root;
    if (d !== NETHER && d !== END) throw new Error(`No dimension ${d}`);
    let sim = this.sims.get(d);
    if (sim) return sim;
    const root = this.root, saved = this.saved[d] ?? {};
    const world = new DimensionWorld(root.world.seed, d);
    sim = new root.constructor({ ...saved, accounts: [], rules: {} }, { world, port: this.makePort?.() ?? null, config: root.config, random: root.random,
      isOp: p => root.isOp(p), root });
    sim.dimension = d;
    sim.dragonSpawned = !!saved.dragonSpawned;
    this.sims.set(d, sim);
    return sim;
  }
  all() { return [this.root, ...this.sims.values()]; }
  simOf(id) {
    if (this.root.players.has(id)) return this.root;
    for (const sim of this.sims.values()) if (sim.players.has(id)) return sim;
    return null;
  }
  playerOf(id) { return this.simOf(id)?.players.get(id) ?? this.transit.get(id)?.p ?? null; }
  // WorldServer.tick for the other worlds, after the Overworld's: each runs on the Overworld's clock. A world nobody is in (and no
  // trip is waiting on) stands still, as an unloaded world would. Returns dimension -> the world's tick message.
  tick() {
    const out = new Map(), root = this.root;
    for (const [d, sim] of this.sims) {
      if (!sim.players.size && !sim.pendingViews.size) { sim.ticks = root.ticks; sim.time = root.time; continue; }
      sim.ticks = root.ticks - 1; sim.time = root.time - 1;
      out.set(d, sim.tick());
    }
    return out;
  }
  // Entity.travelToDimension for player p from `from` (its world's dimension) to `to`: it leaves now and arrives once the new
  // world is ready. `at`: where it lands without a Teleporter (a respawn or the End's exit: the bed or the world spawn).
  travel(p, to, { respawn = false } = {}) {
    const fromSim = this.simOf(p.id);
    if (!fromSim || this.transit.has(p.id)) return false;
    const from = fromSim.dimension ?? OVERWORLD;
    // EntityPlayerMP.travelToDimension: the End's exit and the achievements.
    if (!respawn) {
      if (from === END && to === END) { trigger(p, 'theEnd2'); to = OVERWORLD; }
      else if (from === OVERWORLD && to === END) trigger(p, 'theEnd');
      else trigger(p, 'portal');
    }
    wake(fromSim, p, true, false); dismount(fromSim, p); dropHook(p);
    fromSim.play.close(p, 0); fromSim.play.closeWindow(p);
    p.mining = null; p.mineHeld = false; p.eating = null;
    const events = fromSim.drainEvents(p);
    fromSim.players.delete(p.id);
    const exit = respawn || from === END;
    const trip = { p, from, to, events, exit, position: { x: p.position.x, y: p.position.y, z: p.position.z }, yaw: p.yaw };
    this.transit.set(p.id, trip);
    this.departures.push([p.id, to]);
    this.queue = this.queue.then(() => this.arrive(trip)).catch(error => {
      console.error(`Portal trip failed: ${error.stack}`);
      this.land(trip, this.root, this.root.spawnPoint()); // never leave a player nowhere
    });
    return true;
  }
  async arrive(trip) {
    const { p, from, to } = trip;
    const sim = this.get(to);
    if (trip.exit) { // ServerConfigurationManager.respawnPlayer: the bed (server-beds.js) or the world spawn
      const at = bedRespawn(sim, p) ?? sim.spawnPoint();
      await this.waitFor(sim, at.x, at.z, trip);
      return this.land(trip, sim, at);
    }
    const { x, y, z } = trip.position;
    const tt = transferTarget(from, to, x, y, z, mcYaw(trip.yaw));
    await this.waitFor(sim, tt.x, tt.z, trip);
    const e = { x: tt.x, y: tt.y, z: tt.z, vx: 0, vy: 0, vz: 0, yaw: tt.yaw, pitch: 0, teleportDirection: p.portal?.teleportDirection ?? 0 };
    const { peek, teleporter } = this.portal(sim);
    if (tt.teleporter) await runSteps(teleporter.placeInPortalSteps(e, tt.x, tt.y, tt.z, tt.yaw), yieldNow);
    if (sim.columns.windowAt(e.x, e.z).minX !== sim.columns.windowAt(tt.x, tt.z).minX || sim.columns.windowAt(e.x, e.z).minZ !== sim.columns.windowAt(tt.x, tt.z).minZ)
      await this.waitFor(sim, e.x, e.z, trip); // an existing portal outside the first window
    peek.apply();
    if (to === END) await this.firstEntry(sim);
    return this.land(trip, sim, { x: e.x, y: e.y, z: e.z }, gameYaw(e.yaw));
  }
  // The window at (x, z) built (from the world's worker) and resident before anyone stands in it.
  async waitFor(sim, x, z, trip) {
    const window = sim.columns.windowAt(x, z);
    sim.pendingViews.set(trip.p.id, window);
    await sim.columns.whenReady(window);
    sim.reside([...[...sim.players.values()].map(o => o.view).filter(Boolean), ...sim.pendingViews.values()]);
  }
  portal(sim) {
    let t = this.portals.get(sim);
    if (!t) {
      const peek = new ServerPeek(sim);
      t = { peek, teleporter: new Teleporter(peek, { ids: GAME_IDS, isSolid: id => id !== 0 && materialSolid(id), random: new JavaRandom(peek.seed) }) };
      this.portals.set(sim, t);
    }
    return t;
  }
  // ChunkProviderEnd.populate's spikes and their crystals, and the dragon at chunk (0, 0), the first time anyone enters the End.
  async firstEntry(sim) {
    if (sim.dragonSpawned || !sim.mobs) return;
    sim.dragonSpawned = true;
    const mobs = sim.mobs, ew = mobs.ew, made = [];
    for (const c of await runSteps(sim.world.endCrystalSteps(), yieldNow) ?? []) { const e = ew.create('ender_crystal', c.x, c.y, c.z); e.yaw = -c.yaw * Math.PI / 180; made.push(e); }
    const before = ew.entities.length, dragon = spawnDragonIfAbsent(sim.world, ew, sim.random);
    if (dragon) { ew.entities.splice(before, 1); made.push(dragon); }
    for (const e of made) {
      if (sim.world.isLoaded(e.x, e.z)) { ew.entities.push(e); continue; }
      const key = `${Math.floor(e.x / 16)},${Math.floor(e.z / 16)}`, list = mobs.stored.get(key) ?? [];
      list.push(ew.serializeOne(e));
      mobs.stored.set(key, list);
    }
  }
  land(trip, sim, at, yaw = trip.p.yaw) {
    const p = trip.p, current = this.transit.get(p.id) === trip;
    if (current || !this.transit.has(p.id)) for (const s of this.all()) s.pendingViews?.delete(p.id);
    if (!current) return null; // it left the server on the way (drop)
    this.transit.delete(p.id);
    p.world = sim.world;
    for (const key of ['chests', 'furnaces', 'dispensers', 'hoppers', 'brewing']) p.survival[key] = sim.tiles[key];
    p.position.copy(at); p.previous.copy(at);
    Object.assign(p.velocity, { x: 0, y: 0, z: 0 });
    p.yaw = yaw; p.fallDistance = 0; p.landedFall = 0; p.flying = p.flying && p.survival.creative;
    p.idleSince = sim.ticks; p.lastInput = sim.ticks; p.teleported = (p.teleported ?? 0) + 1;
    if (p.portal) { p.portal.timeUntilPortal = portalCooldown(true); p.portal.inPortal = false; }
    sim.players.set(p.id, p);
    sim.play.reset(p);
    p.sentInv = null; p.sentOpen = null; p.sentEffects = null; p.sentXp = null; p.sentAchievements = null;
    sim.watch(p);
    for (const e of trip.events) sim.send(p, e);
    this.arrivals.push([p, sim]);
    return p;
  }
  // A player that left while travelling: saved where it was going to leave from (its old world's position), in that world.
  drop(id) {
    const trip = this.transit.get(id);
    if (!trip) return null;
    this.transit.delete(id);
    for (const s of this.all()) s.pendingViews?.delete(id);
    const p = trip.p, saved = this.root.savePlayer(p);
    saved.dimension = trip.from;
    this.root.accounts.set(p.account, saved);
    return p;
  }
  // Which world an account's player joins: the one it was saved in.
  joinSim(account) {
    const d = this.root.accounts.get(account)?.dimension;
    return d === NETHER || d === END ? this.get(d) : this.root;
  }
  save() {
    const out = { ...this.saved };
    for (const [d, sim] of this.sims) {
      const s = sim.save();
      delete s.accounts; delete s.rules;
      out[d] = { ...s, dragonSpawned: !!sim.dragonSpawned };
    }
    return out;
  }
  dispose() { for (const sim of this.sims.values()) sim.columns?.dispose(); }
}
export { SPAN };
