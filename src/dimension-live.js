// Travel between the Overworld, the Nether and the End: how one saved world holds the three dimensions, the portal checks the
// player runs every tick, the arrival (Teleporter + transferEntityToWorld, dimensions.js) and the overlay/sounds.
//
// Save model. The Overworld is the world record itself (old saves load unchanged, byte for byte). In a dimension, `active` is a
// *view* record: id `${root}~${dimension}` (the key its block edits are stored under, as any streamed world), the player/global
// fields of the root, and the coordinate-keyed runtime fields (DIM_KEYS) and tile entities (TILE_KEYS) of that dimension only.
// save() stores `stored(view, root)` on the shelf instead: the root with the view's global fields, `dimension` (where the player
// is) and `dimensions[d] = { state, tiles }`. The Overworld's own fields stay at the top level of the root untouched.
import { DimensionWorld, TerrainPeek } from "./dimension-world.js";
import { World } from "./world.js";
import { javaSeed } from "./java-world.js";
import { JavaRandom } from "./java-random.js";
import { materialSolid } from "./plants.js";
import { BED, BED_DIR, isBedHead } from "./bed.js";
import { readChunkEdits, listBaseColumns, readBaseColumns, readChunkColumns, writeChunkColumns } from "./world-storage.js";
import { stateColumns, awayPlan, MAX_AWAY_TICKS } from "./away-plan.js";
import { buildStoredIndex } from "./stored-peek.js";
import { restoreImportedFortress } from "./fortress-restore.js";
import { drain, runSteps } from "./steps.js";
import { OVERWORLD, NETHER, END, PortalState, Teleporter, transferTarget, GAME_IDS, providerOf, actualHeight, portalCooldown, readPlayerPortalState } from "./dimensions.js";
import { EntityPortals, placeAfterTravel, POS_Y, mobYawToMc, mcToMobYaw } from "./entity-portal.js";
import { ringEntityActive } from "./streaming-ticks.js";
import { LEAD_ITEM } from "./horse-gear.js";

// Per-dimension runtime state: everything main.js's save() writes that is keyed by block coordinates or holds entities.
export const DIM_KEYS = ["drops", "projectiles", "eyes", "rockets", "fishing", "thrownPotions", "fireballs", "arrows", "tnt", "fluidTicks", "fireTicks", "redstone", "pistons", "commandBlocks", "musicTiles", "entities", "villages", "farms", "pots", "xpOrbs", "falling", "fallingTicks", "foreignTicks", "spawners", "minecarts", "boats", "hanging", "signs", "skulls", "beacons", "populatedColumns", "containerScope", "editSequence", "dragonSpawned", "simulation"];
// Tile entities that survival.serialize() keeps in the player record, by block coordinate.
export const TILE_KEYS = ["furnaces", "chests", "dispensers", "brewing", "hoppers"];
const VIEW_ONLY = new Set(["id", "rootId", "chunked", "biome", "edits", "runtimeChunked", "dimensions", "dimension", "transit", "portalArrivals", "pendingArrivals"]);
const pick = (o, keys) => { const r = {}; for (const k of keys) if (o && o[k] !== undefined) r[k] = o[k]; return r; };

export const dimensionOf = (record) => record?.dimension ?? OVERWORLD;
export const rootIdOf = (record) => record?.rootId ?? record?.id;
export const viewId = (rootId, d) => `${rootId}~${d}`;

// The record `launch` runs while the player is in dimension d (a copy; the root is not modified).
export function viewRecord(root, d) {
  const blob = root.dimensions?.[d] ?? {}, v = { ...root };
  for (const k of DIM_KEYS) delete v[k];
  for (const k of VIEW_ONLY) delete v[k];
  Object.assign(v, structuredClone(blob.state ?? {}));
  v.player = { ...(root.player ?? {}) };
  for (const k of TILE_KEYS) v.player[k] = structuredClone(blob.tiles?.[k] ?? {});
  if (root.transit) v.transit = root.transit; // an arrival in flight (consumed by DimensionLive.arrive)
  if (root.portalArrivals?.[d]) v.pendingArrivals = root.portalArrivals[d]; // entities that travelled here while it was unloaded (applyWrites)
  return Object.assign(v, { id: viewId(root.id, d), rootId: root.id, chunked: true, biome: "javaStreamed", edits: [], dimension: d });
}
// The root record that goes on the shelf for a running view (see the header).
export function storedRecord(view, root) {
  const out = { ...root }, d = view.dimension;
  for (const k of Object.keys(view)) if (!VIEW_ONLY.has(k) && !DIM_KEYS.includes(k)) out[k] = view[k];
  out.player = { ...(view.player ?? {}) };
  for (const k of TILE_KEYS) { if (root.player?.[k] !== undefined) out.player[k] = root.player[k]; else delete out.player[k]; }
  if (root.portalArrivals?.[d]) { const rest = { ...root.portalArrivals }; delete rest[d]; if (Object.keys(rest).length) out.portalArrivals = rest; else delete out.portalArrivals; } // delivered by applyWrites
  out.dimension = d;
  out.dimensions = { ...(root.dimensions ?? {}), [d]: { state: structuredClone(pick(view, DIM_KEYS)), tiles: structuredClone(pick(view.player, TILE_KEYS)) } };
  return out;
}

// Dimension rules the rest of the game asks for (WorldProvider / ItemBucket / BlockBed / ItemCompass / ItemClock).
export function rulesOf(world) {
  const d = world?.dimension ?? OVERWORLD, p = providerOf(d);
  return {
    dimension: d,
    waterEvaporates: p.isHellWorld, // ItemBucket.a(ahb,III)Z bytecode: ahb.t.f (isHellWorld, Nether only) with water -> random.fizz + smoke, no block
    bedExplodes: !p.canRespawnHere, // BlockBed.onBlockActivated: !provider.canRespawnHere() || biome == hell
    compassSpins: d !== OVERWORLD, // ItemCompass/TextureCompass: !worldProvider.isSurfaceWorld
    clockSpins: d !== OVERWORLD, // ItemClock/TextureClock: !worldProvider.isSurfaceWorld
  };
}

const solidId = (id) => id !== 0 && materialSolid(id);
// World.get for an ordinary (finite or resident) World, with writes recorded for the later real apply.
class LivePeek {
  constructor(world) { this.world = world; this.writes = []; this.dimension = 0; this.time = 0; this.actualHeight = 256; }
  get(x, y, z) { return this.world.get(x, y, z); }
  set(x, y, z, id, meta = 0, flags = 3) { this.writes.push([x, y, z, id, meta, flags]); }
  notify() {}
}
// LivePeek whose own writes are readable (a later traveller's Teleporter sees the portal an earlier one built).
class FinitePeek extends LivePeek {
  constructor(world) { super(world); this.over = new Map(); }
  get(x, y, z) { const v = this.over.get(`${x},${y},${z}`); return v !== undefined ? v & 255 : super.get(x, y, z); }
  set(x, y, z, id, meta = 0, flags = 3) { this.over.set(`${x},${y},${z}`, id | (meta << 8)); super.set(x, y, z, id, meta, flags); }
  preset(x, y, z, id, meta = 0) { this.over.set(`${x},${y},${z}`, id | (meta << 8)); }
}
// Entity yaw in the game (radians, three.js, 0 looks toward -z) <-> Minecraft degrees (0 looks toward +z).
export const gameYaw = (mcDegrees) => Math.PI - (mcDegrees * Math.PI) / 180;
export const mcYaw = (yaw) => ((Math.PI - yaw) * 180) / Math.PI;

export class DimensionLive {
  // host: { active(), world(), worlds(), save(), openWorld(record), sound(name, opts) }
  constructor(host) {
    this.host = host; this.state = new PortalState(); this.busy = false; this.overlayAmount = 0; this.writes = [];
    this.portals = new EntityPortals(); this.peeks = new Map(); this.queue = Promise.resolve(); this.flights = 0;
    this.readEdits = readChunkEdits; this.readColumns = readChunkColumns; this.writeColumns = writeChunkColumns; this.away = null; this.awayLog = null; this.makeAwayWorker = () => new Worker(new URL("./away-worker.js", import.meta.url), { type: "module" }); this.listBases = listBaseColumns; this.readBases = readBaseColumns; this.storedIndexes = new Map(); this.onDragonSpawn = () => {}; this.quiet = false; this.overlay = null; this.trigger = false;
  }
  // main.js openWorld hooks ------------------------------------------------------------
  // A record saved while the player was in a dimension opens as that dimension's view.
  openRecord(record, joined) { return record.dimension && !record.rootId ? viewRecord(joined, record.dimension) : record; }
  createWorld(record) { return record.rootId ? new DimensionWorld(record.seed, record.dimension) : new World(record.seed, record.biome, record.generationVersion ?? 1, record.worldType, record.generatorOptions); }
  // Called after the world exists and before the saved position is read. Sets record.position for a travel arrival.
  // `pause` (an async frame wait) spreads the Teleporter's scans over frames and `warm` ({ window, columns } of travel-loading.js
  // arrivalWarmer) builds the terrain they read ahead of them; without them (every caller but a loading-screen trip) it runs at once.
  async arrive(prepared, record, { pause = null, warm = null } = {}) {
    await restoreImportedFortress(prepared, record); // imported data/Fortress.dat starts (Nether views only)
    const t = record.transit; delete record.transit; this.writes = []; this.exit = false; this.peeks.clear();
    if (!t) return;
    const to = dimensionOf(record), from = t.from;
    if (t.death || from === END) delete record.portalState; // A new player is created on respawn.
    else if ((from === NETHER || to === NETHER) && !record.portalState?.t) {
      // Scripted travel has no preceding portal tick. Guard its arrival too.
      record.portalState = { c: 0, t: portalCooldown(true) };
    }
    if (t.death) { record.position = null; return; } // the respawn handler picks the bed / world spawn
    if (from === END) { // leaving the End: the bed or world spawn (EntityPlayerMP.travelToDimension(1) -> respawnPlayer)
      const bed = record.bed?.spawn;
      record.position = bed ? { x: bed[0] + 0.5, y: bed[1], z: bed[2] + 0.5, yaw: record.position?.yaw ?? 0, pitch: 0 } : null;
      this.exit = !!bed;
      return;
    }
    const tt = transferTarget(from, to, t.x, t.y, t.z, mcYaw(t.yaw ?? 0));
    const edits = to === OVERWORLD && !record.chunked ? null : new Map(await this.readEdits(record.id));
    const inbox = record.rootId ? record.pendingArrivals : record.portalArrivals?.[0];
    if (edits) for (const [x, y, z, id, meta] of inbox?.writes ?? []) edits.set(`${x},${y},${z}`, id | (meta << 8)); // portals built for travelling mobs
    const world = prepared.streaming ? new TerrainPeek(prepared, edits ?? new Map()) : new LivePeek(prepared);
    world.dimension = to; world.actualHeight = actualHeight(to);
    world.seed = javaSeed(record.seed);
    if (prepared.streaming && (record.wholeSave || record.rootId)) world.stored = await this.warmStored(record.rootId ? this.host.worlds?.().find((w) => w.id === record.rootId) ?? record : record, to);
    const e = { x: tt.x, y: tt.y, z: tt.z, vx: 0, vy: 0, vz: 0, yaw: tt.yaw, pitch: 0, teleportDirection: t.dir ?? 0 };
    const teleporter = new Teleporter(world, { isSolid: solidId, random: new JavaRandom(world.seed) });
    if (warm && !prepared.noPrefetch) { // (Nether/End peeks read cheap terrain, and their window is built after the arrival) the columns the search and the portal-site scan will read: the window round the target and every saved portal in reach
      const found = world.portalColumns?.(GAME_IDS.portal, Math.floor(tt.x) - 128, Math.floor(tt.x) + 128, Math.floor(tt.z) - 128, Math.floor(tt.z) + 128);
      if (found?.length) {
        // The search ends at the saved portal nearest the target (Teleporter.placeInExistingPortal) and the arrival window (main.js openWorld:
        // World.streamAround at the exit) is built round it, up to 100 blocks from the target: fetch that window, not the target's, so the exit
        // needs no second fetch (a whole window's cells, about 1.4-1.9 s, when the portal was in another population cell).
        let near = found[0], best = Infinity;
        for (const [x, z] of found) { const d = (x + 0.5 - tt.x) ** 2 + (z + 0.5 - tt.z) ** 2; if (d < best) { best = d; near = [x, z]; } }
        await warm.window(near[0] + 0.5, near[1] + 0.5);
        await warm.columns(found);
      } else await warm.window(tt.x, tt.z, 18); // a portal is built within 16 blocks of the target: the window round it (and, in spare lanes, the windows round the spots it may be built at, so the exit's window is held too)
    }
    const steps = teleporter.placeInPortalSteps(e, tt.x, tt.y, tt.z, tt.yaw);
    if (pause) await runSteps(steps, pause); else drain(steps);
    this.writes = world.writes;
    record.position = { x: e.x, y: e.y, z: e.z, yaw: gameYaw(e.yaw), pitch: 0 };
  }
  restorePlayer(record) {
    this.state.restore(readPlayerPortalState(record.portalState));
    this.setOverlay(0);
  }
  // After the resident columns (and their saved edits) are loaded: the portal frames/platform the Teleporter placed.
  applyWrites(prepared, record, { verifyBed } = {}) {
    this.deliverArrivals(prepared, record);
    for (const [x, y, z, id, meta] of this.writes) prepared.set(x, y, z, id, true, meta);
    this.writes = [];
    if (this.exit) { // bed spawn of the Overworld: still a bed with a free cell beside it, else the world spawn
      this.exit = false;
      const cell = verifyBed?.(prepared, record.bed.spawn);
      record.position = cell ? { ...cell, yaw: record.position.yaw, pitch: 0 } : null;
    }
    if (record.dimension === END && !record.dragonSpawned) { record.dragonSpawned = true; this.onDragonSpawn({ x: 0, y: 128, z: 0 }); } // first entry: the dragon spawn hook
  }
  // Entities that travelled here while this dimension was unloaded join its saved lists (Entity.travelToDimension spawned them in it).
  deliverArrivals(prepared, record) {
    const inbox = record.rootId ? record.pendingArrivals : record.portalArrivals?.[0];
    delete record.pendingArrivals;
    if (!record.rootId && record.portalArrivals) { const rest = { ...record.portalArrivals }; delete rest[0]; if (Object.keys(rest).length) record.portalArrivals = rest; else delete record.portalArrivals; }
    if (!inbox) return;
    for (const k of ["entities", "drops", "xpOrbs"]) if (inbox[k]?.length) record[k] = [...(record[k] ?? []), ...inbox[k]];
    for (const [x, y, z, id, meta] of inbox.writes ?? []) prepared.set(x, y, z, id, true, meta);
  }
  // Entity portals --------------------------------------------------------------------
  rootRecord() { const a = this.host.active(); return a?.rootId ? this.host.worlds().find((w) => w.id === a.rootId) : a; }
  // Resolves when the entities in flight have reached their dimension's inbox (before save() writes the shelf).
  settle() { return this.queue; }
  // Per physics tick, after the mobs/items/orbs moved (Entity.onEntityUpdate + doBlockCollisions of each). Travellers leave the
  // live lists at once; their arrival (Teleporter in the target dimension) resolves asynchronously into the target's inbox.
  tickEntities(world, { mobs, items, xpOrbs } = {}) {
    if (this.busy || !world || this.host.active()?.transit) return;
    const dim = world.dimension ?? OVERWORLD, getId = (x, y, z) => world.get(x, y, z), at = { dim, getId };
    const root = this.rootRecord();
    if (!root) return;
    const lists = [["mob", mobs?.entities], ["item", items?.items], ["orb", xpOrbs?.orbs]];
    for (const [kind, list] of lists) {
      if (!list?.length) continue;
      let gone = null;
      for (const e of list) {
        // BlockPortal and BlockEndPortal collide only with an entity that has no rider and no vehicle (mob jockeys too).
        if (kind === "mob" && (e.rider || e.vehicle || e.ridingEntity || e.riddenBy)) { this.portals.step(e, kind, { ...at, riding: true }); continue; }
        if (!ringEntityActive(world, e)) continue; // Entity.onEntityUpdate's portal step runs for every updated entity, ring ones too
        const r = this.portals.step(e, kind, at);
        if (!r) continue;
        (gone ??= new Set()).add(e);
        this.depart(root, dim, kind, e, r, kind === "mob" ? mobs : kind === "item" ? items : xpOrbs);
      }
      if (gone) { const keep = list.filter((e) => !gone.has(e)); list.length = 0; list.push(...keep); }
    }
  }
  depart(root, from, kind, e, r, owner) {
    const cooldown = this.portals.cooldownAfter(e, r);
    const rec = structuredClone(owner.serializeOne(e));
    rec.portalCooldown = cooldown || undefined;
    const mc = kind === "mob"
      ? { x: e.x, y: e.y, z: e.z, vx: e.vx ?? 0, vy: e.vy ?? 0, vz: e.vz ?? 0, yaw: mobYawToMc(e.yaw ?? 0), pitch: 0 }
      : { x: e.x, y: e.y + POS_Y[kind], z: e.z, vx: e.vx ?? e.mx ?? 0, vy: e.vy ?? e.my ?? 0, vz: e.vz ?? e.mz ?? 0, yaw: 0, pitch: 0 };
    mc.teleportDirection = r.direction;
    const leashed = kind === "mob" && e.leash?.holder === "player";
    const rootId = root.id;
    this.flights++;
    this.queue = this.queue.then(() => this.deliver(rootId, from, kind, rec, mc, r.arg, leashed)).catch(() => {}).then(() => { this.flights--; });
  }
  // The stored-column index (stored-peek.js) of an imported whole save's dimension d, built once per world: null for a world that
  // holds no stored columns. Concurrent callers share the one build.
  storedIndex(root, d) {
    if (!root?.wholeSave) return Promise.resolve(null);
    const key = `${root.id}:${d}`;
    let p = this.storedIndexes.get(key);
    if (!p) {
      const world = d === OVERWORLD ? root.id : viewId(root.id, d);
      p = buildStoredIndex({ list: () => this.listBases(world), read: (cols) => this.readBases(world, cols), marker: GAME_IDS.portal })
        .then((index) => (index.tops.size ? index : null)).catch(() => null);
      this.storedIndexes.set(key, p);
    }
    return p;
  }
  // /spreadplayers' top block + 1 of a stored column that is not resident: synchronous, so it reads the finished index only
  // (undefined while it builds or for a column the save does not store).
  storedTop(root, d, x, z) { return this.storedDone?.get(`${root?.id}:${d}`)?.topY(x, z); }
  async warmStored(root, d) {
    const index = await this.storedIndex(root, d);
    if (index) (this.storedDone ??= new Map()).set(`${root.id}:${d}`, index);
    return index;
  }
  // Teleporter state per target dimension, kept while the player stays in the loaded one.
  async peekFor(root, to) {
    const key = `${root.id}:${to}`;
    let peek = this.peeks.get(key);
    if (peek) return peek;
    const writes = root.portalArrivals?.[to]?.writes ?? [];
    if (to !== OVERWORLD) {
      const edits = new Map(await this.readEdits(viewId(root.id, to)));
      for (const [x, y, z, id, meta] of writes) edits.set(`${x},${y},${z}`, id | (meta << 8));
      peek = new TerrainPeek(new DimensionWorld(root.seed, to), edits);
    } else {
      const w = new World(root.seed, root.biome, root.generationVersion ?? 1, root.worldType, root.generatorOptions);
      if (w.streaming) {
        const edits = new Map(root.chunked ? await this.readEdits(root.id) : []);
        for (const [x, y, z, id, meta] of writes) edits.set(`${x},${y},${z}`, id | (meta << 8));
        peek = new TerrainPeek(w, edits);
      } else {
        w.restore(root.edits ?? []);
        peek = new FinitePeek(w);
        for (const [x, y, z, id, meta] of writes) peek.preset(x, y, z, id, meta);
      }
    }
    peek.dimension = to; peek.actualHeight = actualHeight(to); peek.seed = javaSeed(root.seed);
    if (peek.portalColumns) peek.stored = await this.warmStored(root, to);
    peek.teleporter = new Teleporter(peek, { isSolid: solidId, random: new JavaRandom(peek.seed) });
    this.peeks.set(key, peek);
    return peek;
  }
  async deliver(rootId, from, kind, rec, mc, arg, leashed) {
    const root = this.rootRecord();
    if (!root || root.id !== rootId) return;
    const to = from === END && arg === END ? OVERWORLD : arg, peek = await this.peekFor(root, to), before = peek.writes.length;
    const spawn = root.worldSpawn ? { x: root.worldSpawn[0], z: root.worldSpawn[2] } : { x: 0, z: 0 };
    const heightAt = (x, z) => { for (let y = peek.actualHeight - 1; y > 0; y--) if (solidId(peek.get(x, y, z))) return y + 1; return 0; };
    const { e } = placeAfterTravel({ from, arg, entity: mc, teleporter: peek.teleporter, spawn, heightAt });
    const inbox = ((root.portalArrivals ??= {})[to] ??= { entities: [], drops: [], xpOrbs: [], writes: [] });
    for (const w of peek.writes.slice(before)) inbox.writes.push(w);
    const y = e.y - POS_Y[kind];
    if (kind === "mob") {
      delete rec.id;
      Object.assign(rec, { x: e.x, y, z: e.z, yaw: mcToMobYaw(e.yaw), portalMotion: { vx: e.vx, vy: e.vy, vz: e.vz } });
      if (leashed) { delete rec.leash; inbox.drops.push({ stack: { id: LEAD_ITEM, count: 1, damage: 0 }, x: e.x, y, z: e.z, mx: Math.random() * 0.2 - 0.1, my: 0.2, mz: Math.random() * 0.2 - 0.1, age: 0, delay: 10, hover: 0 }); } // the holder is not in the new world; EntityItem's constructor motion
      inbox.entities.push(rec);
    } else if (kind === "item") {
      Object.assign(rec, { x: e.x, y, z: e.z, mx: e.vx, my: e.vy, mz: e.vz });
      inbox.drops.push(rec);
    } else {
      Object.assign(rec, { x: e.x, y, z: e.z, vx: e.vx, vy: e.vy, vz: e.vz, onGround: false });
      inbox.xpOrbs.push(rec);
    }
    this.host.dirty?.();
  }
  // Away ticks (away-world.js, dimensions.md "Batch 30"): leaving the Overworld copies its spawn-area work and starts a worker; the run
  // happens on return, for the ticks the player was gone (host.ticks()) plus the loading screens' (milliseconds / 50).
  async beginAway(root) {
    this.endAway();
    const h = this.host;
    if (!h.chunks || !h.ticks || root.biome !== "javaStreamed") return;
    try {
      const cols = stateColumns(root);
      if (!cols.length) return;
      const chunks = h.chunks(cols), have = new Set(chunks.map((c) => `${c.x},${c.z}`)), list = cols.filter(([x, z]) => have.has(`${x},${z}`));
      if (!chunks.length) return;
      const records = await this.readColumns(root.id, list);
      const worker = this.makeAwayWorker(), ready = new Promise((resolve) => { worker.onmessage = ({ data }) => { if (data.type === "ready") resolve(true); }; worker.onerror = () => resolve(false); });
      this.away = { rootId: root.id, ticks0: h.ticks(), tripMs: 0, chunks, records, columns: list, worker, ready };
    } catch (error) { console.warn("away run not prepared:", error); this.away = null; }
  }
  endAway() { try { this.away?.worker?.terminate(); } catch { /* already gone */ } this.away = null; }
  // The run for `ticks`; patches the root record (runtime and tile maps in place, drops appended) and stores the edited columns.
  async finishAway(root) {
    const a = this.away;
    this.away = null;
    if (!a || a.rootId !== root.id) { a?.worker?.terminate(); return null; }
    const ticks = Math.min(MAX_AWAY_TICKS, (this.host.ticks() - a.ticks0) + Math.round(a.tripMs / 50));
    try {
      if (ticks <= 0 || !(await Promise.race([a.ready, new Promise((r) => setTimeout(() => r(false), 4000))]))) return null;
      const plan = { ...awayPlan(root, a.columns, ticks, this.host.difficulty?.()), chunks: a.chunks, records: a.records };
      const msg = await new Promise((resolve) => {
        const t = setTimeout(() => resolve({ type: "error", message: "timeout" }), 12000);
        a.worker.onmessage = ({ data }) => { clearTimeout(t); resolve(data); };
        a.worker.onerror = (e) => { clearTimeout(t); resolve({ type: "error", message: String(e?.message ?? e) }); };
        a.worker.postMessage(plan, a.chunks.flatMap((c) => [c.blocks.buffer, c.meta.buffer]));
      });
      if (msg.type !== "result" || !msg.result) { if (msg.type === "error") console.warn("away run failed:", msg.message); return null; }
      const r = msg.result;
      root.fluidTicks = r.fluidTicks; root.fireTicks = r.fireTicks; root.fallingTicks = r.fallingTicks; root.falling = r.falling;
      root.redstone = r.redstone; root.pistons = r.pistons;
      root.player = { ...(root.player ?? {}), ...r.tiles };
      if (r.entities) { // away-entities.js: the saved entity lists, whole
        root.drops = r.entities.drops; root.xpOrbs = r.entities.xpOrbs; root.tnt = r.entities.tnt;
        root.minecarts = r.entities.minecarts; if (r.entities.boats.length) root.boats = r.entities.boats; else delete root.boats;
        // Batch 32: mobs, arrows, thrown projectiles, rockets, potions, fireballs and hanging entities (the run returns whole lists).
        root.entities = r.entities.mobs; root.arrows = r.entities.arrows; root.projectiles = r.entities.projectiles; root.thrownPotions = r.entities.potions;
        root.rockets = r.entities.rockets; root.fireballs = r.entities.fireballs; root.hanging = r.entities.hanging;
      }
      if (r.drops.length) root.drops = [...(root.drops ?? []), ...r.drops];
      if (r.columns.length) await this.writeColumns(root.id, r.columns);
      root.editSequence = Math.max(root.editSequence | 0, r.editSequence | 0);
      this.awayLog = { ...r.stats, ticks };
      this.host.dirty?.();
      return this.awayLog;
    } catch (error) { console.warn("away run failed:", error); return null; } finally { a.worker.terminate(); }
  }
  // Travel ---------------------------------------------------------------------------
  async travel(target, { exit = false, death = false } = {}) {
    if (this.busy) return false;
    this.busy = true;
    try {
      const h = this.host, rec = h.active(), p = h.player();
      await this.settle();
      this.peeks.clear();
      await h.save();
      const root = h.worlds().find((w) => w.id === rootIdOf(rec));
      if (!root) return false;
      if (exit) await h.showCredits?.();
      if (!target && dimensionOf(rec) !== OVERWORLD && this.away) { if (await this.finishAway(root)) await h.save(); }
      else if (target && dimensionOf(rec) === OVERWORLD) await this.beginAway(root);
      const next = { ...root, transit: { from: dimensionOf(rec), x: p.x, y: p.y, z: p.z, yaw: p.yaw, dir: this.state.teleportDirection, exit, death } };
      if (target) next.dimension = target; else delete next.dimension;
      this.quiet = true;
      h.sound("portal.travel", { volume: 0.25, pitch: 0.8 + Math.random() * 0.4 });
      const t0 = performance.now();
      await h.openWorld(next);
      const ms = performance.now() - t0;
      if (this.away) this.away.tripMs += ms;
      this.tripLog = { ms: Math.round(ms), to: target };
      h.advanceTicks?.(Math.round(ms / 50)); // the loading screen's ticks the Overworld clock and weather timers did not run (every trip, not only the return)
      return true;
    } finally { this.busy = false; this.quiet = false; this.setOverlay(0); }
  }
  // Per physics tick (EntityPlayerSP.onLivingUpdate / Entity.onEntityUpdate / BlockPortal / BlockEndPortal). `prev`/`pos`: feet
  // positions of the previous and current tick. Returns whether the player is standing in a nether portal (overlay input).
  tick(world, prev, pos, { creative = false, riding = false, alive = true } = {}) {
    if (this.busy || !alive || !world) return false;
    const d = world.dimension ?? OVERWORLD, hw = 0.3 - 0.001;
    let inPortal = false, endPortal = false;
    for (let x = Math.floor(pos.x - hw); x <= Math.floor(pos.x + hw); x++) for (let z = Math.floor(pos.z - hw); z <= Math.floor(pos.z + hw); z++) for (let y = Math.floor(pos.y + 0.001); y <= Math.floor(pos.y + 1.8 - 0.001); y++) {
      const b = world.get(x, y, z);
      if (b === GAME_IDS.portal) inPortal = true; else if (b === GAME_IDS.endPortal) endPortal = true;
    }
    if (endPortal && !riding) { this.travel(d === END ? OVERWORLD : END, { exit: d === END }); return false; }
    if (inPortal && !riding) this.state.setInPortal(prev.x, prev.z, pos.x, pos.z);
    const shown = this.state.inPortal;
    const go = this.state.tick(d, { creative, riding });
    if (go !== null) this.travel(go);
    return shown;
  }
  // EntityPlayerSP.onLivingUpdate: the first tick in a portal plays portal.trigger (volume 0.25, pitch 0.8-1.2); the overlay follows timeInPortal.
  portalFrame(timer, inPortal) {
    if (inPortal && timer.prev === 0 && timer.cur > 0) this.host.sound("portal.trigger", { volume: 0.25, pitch: 0.8 + Math.random() * 0.4 });
    this.setOverlay(timer.cur);
  }
  // Death inside a dimension: the respawn happens in the Overworld (WorldProvider.canRespawnHere is false in both others).
  async leaveByDeath() {
    if (!(await this.travel(OVERWORLD, { death: true }))) return false;
    return true;
  }
  // GuiIngame.renderPortalOverlay's alpha from EntityPlayerSP.timeInPortal (PortalTimer.cur): squared twice, then 0.8x + 0.2.
  setOverlay(timeInPortal) {
    if (typeof document === "undefined") return;
    if (!this.overlay) {
      const el = document.createElement("div");
      el.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:4;display:none;background:url(/media/1.7.10/blocks/portal.png) 0 0/100% 3200% no-repeat;image-rendering:pixelated";
      document.body.appendChild(el); this.overlay = el;
    }
    let f = timeInPortal;
    if (f > 0) { if (f < 1) { f *= f; f *= f; f = f * 0.8 + 0.2; } }
    this.overlay.style.display = f > 0 ? "block" : "none";
    this.overlay.style.opacity = String(Math.min(1, f));
  }
}

// BlockBed.onBlockActivated where !provider.canRespawnHere() (Nether, End): the head cell and the foot beside it become air and the
// bed explodes at the head cell centre with power 5, flaming and smoking. NOT probed (recalled from the 1.7.10 class; see dimensions.md).
// Returns the explosion centre and the cleared cells, or null when the bed works normally.
export function bedExplosion(world, x, y, z) {
  if (!rulesOf(world).bedExplodes || world.get(x, y, z) !== BED) return null;
  let meta = world.getMeta(x, y, z);
  if (!isBedHead(meta)) {
    const [dx, dz] = BED_DIR[meta & 3];
    x += dx; z += dz;
    if (world.get(x, y, z) !== BED) return { cells: [], handled: true };
    meta = world.getMeta(x, y, z);
  }
  const cells = [[x, y, z]];
  world.put(x, y, z, 0, 0);
  const [dx, dz] = BED_DIR[meta & 3];
  if (world.get(x - dx, y, z - dz) === BED) { world.put(x - dx, y, z - dz, 0, 0); cells.push([x - dx, y, z - dz]); }
  return { cells, x: x + 0.5, y: y + 0.5, z: z + 0.5, size: 5, handled: true };
}
