// The saved order of the loaded entities (batch 52, b52so). AnvilChunkLoader.writeChunkToNBT walks Chunk.entityLists (16 vertical sections, each in its list
// order) and readChunkFromNBT files the entities back, so after Chunk.onChunkLoad (World.addLoadedEntities per section 0..15) the loadedEntityList of a chunk is
// grouped by section (posY / 16, clamped to 0..15), not in the order the entities joined. Executed: SavedOrderProbe (saved-order-reference.json, 7 scenarios).
// The port keeps each kind in its own list, so a save stamps every record with `ord`, its place in that native walk, and a load gives the restored entities
// the stamps back (EntityWorld.orderSeqs), so the one list walk (EntityWorld.withBalls) puts mixed kinds where a native load would.
// Batch 53 (b53so, saved-order2-reference.json): an entity that changes chunk or section during its update moves to the end of the new list (trackSections; the check
// compares the unclamped posY / 16 with the clamped filed section, as World.updateEntityWithOptionalForce does, so one above 256 or below 0 is refiled every tick), and a
// mount saved with its rider is one record natively (the rider with the mount nested under `Riding`, the mount skipped; the loader adds the rider, then its mount to the
// chunk it is reading): the stamps are the places of that load. Fireballs and wither skulls are stamped too (their records are dimension-split).
// Batch 54 (b54so, saved-order3-reference.json): the section check runs right after each entity's own update (EntityWorld.tickMobs), as World.updateEntities does, and a mount
// that carries the player is not in a chunk at all natively (the player's NBT nests it under `Riding`, and the mount is skipped by the chunk writer because it is ridden): the
// player's login reads it back, spawns it with forceSpawn after the chunks are loaded and mounts the player, so it is the last of the loaded list (carriesPlayer, last in saveWalk).
// The browser keeps the mount's record in its own list (cart `rider: true`, mob `playerRides`) so older saves load unchanged; only the stamp follows the native shape.
// Batch 56 (b56so, saved-order4-reference.json): the chunk order of a native reload is the login order (executed ChunkProviderServer, PlayerManager and a real World.spawnEntityInWorld): the
// world's spawn grid (MinecraftServer.initialWorldChunkLoad, 25 x 25 chunks, x outer, z inner), then the player's own chunk (World.spawnEntityInWorld loads it first), then the view
// square (PlayerManager.addPlayer, x outer, z inner; PlayerInstance loads each chunk), then the player's mount. `loadFrame` gives the frame (spawn, player, view distance); chunks outside it,
// and every save without a frame, keep the approximation: the order of their first joined entity. A mount that carries the player takes its own Riding chain no further: the login reads the
// first Riding compound only (sg.a does not read a nested Riding), so a mount of that mount is in no chunk and in no file: its record is dropped from the save (`lostMounts`).
import { JavaHashSetOrder } from "./java-hashset-order.js";
const SECTIONS = 16;
const sectionOf = (e) => Math.min(SECTIONS - 1, Math.max(0, Math.floor((e.posY ?? e.y ?? 0) / 16)));
const finite = (v) => Number.isFinite(v);

// [live list, saved records] of every kind that is in the walk; a pair is used only when the loader and the writer kept one entity per record.
// `sys`: the live systems of the world (main.js, or the away run's); `rec`: the save record (main.js: entities, drops, minecarts.carts, thrownPotions ...) or the
// away plan's lists (mobs, drops, minecarts.carts, potions ...).
export function orderGroups(sys, rec) {
  rec = { ...rec, mobs: rec.mobs ?? rec.entities, potions: rec.potions ?? rec.thrownPotions, carts: rec.minecarts?.carts, rockets: rec.rockets?.rockets ?? rec.rockets };
  const g = (list, records, kind) => (Array.isArray(list) && Array.isArray(records) && list.length === records.length && records.length ? [{ kind, live: list, records }] : []);
  return [
    ...g(sys.mobs?.entities?.filter((e) => e.health > 0 || (e.type === "ender_dragon" && !e.dragonGone)), rec.mobs, "mob"), // EntityWorld.serialize's filter
    ...g(sys.items?.items, rec.drops, "item"), ...g(sys.xpOrbs?.orbs, rec.xpOrbs, "orb"), ...g(sys.primed, rec.tnt, "tnt"),
    ...g(sys.arrows?.list, rec.arrows, "arrow"), ...g(sys.projectiles?.balls, rec.projectiles, "thrown"), ...g(sys.falling?.entities, rec.falling, "falling"),
    ...g(sys.minecarts?.carts, rec.carts, "cart"), ...g(sys.boats?.carts, rec.boats, "boat"), ...g(sys.hanging?.entities, rec.hanging, "hanging"),
    ...g(sys.rockets?.rockets, rec.rockets, "rocket"), ...g(sys.mobs?.potions?.balls, rec.potions, "potion"),
    ...ballGroup(sys.mobs, rec.fireballs),
  ];
}

// The fireballs, then the skulls, of the records of this world's dimension (serialize writes the fireballs first, then the skulls; the records of other dimensions stay as they are).
function ballGroup(mobs, records) {
  if (!Array.isArray(records)) return [];
  const dim = mobs?.world?.dimension ?? 0, mine = records.filter((r) => (r?.dimension ?? 0) === dim);
  const live = [...(mobs?._fireballs?.list ?? []), ...(mobs?._skulls?.list ?? [])].filter((b) => !b.dead);
  return live.length && live.length === mine.length ? [{ kind: "ball", live, records: mine }] : [];
}

// The place of each chunk in a native reload (above): the spawn grid, the player's chunk, the view square. `frame`: { spawn: [x, y, z] | null, player: { x, z } | null, view: chunks }.
export function loadRanks(frame) {
  const ranks = new Map(), add = (cx, cz) => { const k = `${cx},${cz}`; if (!ranks.has(k)) ranks.set(k, ranks.size); };
  const spawn = frame?.spawn;
  if (Array.isArray(spawn) && finite(spawn[0]) && finite(spawn[2])) for (let k = -192; k <= 192; k += 16) for (let l = -192; l <= 192; l += 16) add(Math.floor(Math.trunc(spawn[0] + k) / 16), Math.floor(Math.trunc(spawn[2] + l) / 16)); // MinecraftServer: (spawn + k) >> 4
  const p = frame?.player;
  if (p && finite(p.x) && finite(p.z)) {
    const cx = Math.trunc(p.x) >> 4, cz = Math.trunc(p.z) >> 4, r = Number.isInteger(frame.view) && frame.view > 0 ? frame.view : 0;
    add(cx, cz);
    for (let x = cx - r; x <= cx + r; x++) for (let z = cz - r; z <= cz + r; z++) add(x, z);
  }
  return ranks;
}

// The native save walk of the groups' live entities: chunks (by their first entity in the loaded list), then section, then list order. Returns the entities in it.
function saveWalk(mobs, groups, frame = null) {
  mobs.withBalls?.(mobs.entities.slice()); // gives every walked entity its place in the loaded list (orderSeqs)
  const seqs = mobs.orderSeqs, rows = [];
  for (const { live, records } of groups) live.forEach((e, i) => rows.push({ e, record: records[i], seq: seqs?.get(e) ?? Infinity, sec: sectionOf(e), cx: Math.floor((e.x ?? 0) / 16), cz: Math.floor((e.z ?? 0) / 16) }));
  const first = new Map(), moved = mobs.sectionSeqs, born = mobs.chunkBirth; // born: the place of the first entity a chunk had in the passes seen (a mover joining it later does not lower it)
  for (const r of rows) { const k = `${r.cx},${r.cz}`; first.set(k, Math.min(first.get(k) ?? Infinity, born?.get(k) ?? r.seq)); r.chunk = k; r.list = moved?.get(r.e) ?? r.seq; }
  const carried = rows.filter((r) => carriesPlayer(r.e)), ranks = frame ? loadRanks(frame) : null;
  for (const r of carried) if (ranks && !ranks.has(r.chunk)) ranks.set(r.chunk, ranks.size); // b57so: the login spawns the mount into its chunk, which loads (and its other entities with it) after the view square
  const loads = mobs.chunkLoads?.map;
  const place = (k) => (ranks?.has(k) && !mobs.chunkLoads?.again?.has(k) ? ranks.get(k) - 1e9 : loads?.has(k) ? loads.get(k) - 5e8 : first.get(k)); // a chunk of the login frame goes before every other; then the chunks loaded since, in load order (b58so)
  rows.sort((a, b) => place(a.chunk) - place(b.chunk) || (a.chunk < b.chunk ? -1 : a.chunk > b.chunk ? 1 : 0) || a.sec - b.sec || a.list - b.list);
  // b54so: the mount carrying the player is read from the player's file (Riding) and spawned after the chunks: last, in list order among such mounts
  const lost = lostMounts(carried, rows), gone = new Set(lost.map((r) => r.e));
  const rest = carried.length ? rows.filter((r) => !carriesPlayer(r.e) && !gone.has(r.e)) : rows;
  return { order: [...loadOrder(rest), ...carried], lost, carried };
}

// b56so: a mount that carries the player is the first Riding compound of the player's file; its own mount (a cart under the cow the player sits on, and so on up the chain) is nested one level
// deeper and nothing reads it at login (executed: the player stand-in on a cow on a cart, the cart is in no loaded list). Natively that mount vanishes with the save: rows of the chain.
function lostMounts(carried, rows) {
  const byEnt = new Map(rows.map((r) => [r.e, r])), out = new Set();
  for (const c of carried) for (let m = c.e.ridingEntity, seen = new Set([c.e]); m && !seen.has(m); m = m.ridingEntity) { seen.add(m); if (byEnt.has(m) && !carriesPlayer(m)) out.add(byEnt.get(m)); }
  return [...out];
}

/** b58so: the chunks the player's movement loads after the login, in load order (executed SavedOrderLoginProbe `b58so-move-*`: PlayerManager.updateMountedMovingPlayer creates a PlayerInstance for each
 *  chunk of the new view square that was not watched, x outer, z inner, and each loads its chunk, so World.addLoadedEntities appends the chunk's entities to loadedEntityList in that order).
 *  Called every tick with the player's position: the first call records the login square (x outer, z inner, as PlayerManager.addPlayer).
 *  b60so: a chunk the square leaves is QUEUED (ChunkProviderServer.unloadChunksIfNotNearSpawn, ms.b: a HashSet<Long> of chunksToUnload, `queue`), in the order the move's removal loop meets it (the old
 *  square, x outer, z inner, minus the new one). `unloadQueued` (WorldServer.tick: ms.d, up to 100 per call, in HashSet order) then unloads it: the chunk is marked `out` and its entities are
 *  frozen (below). A chunk that comes back while still queued is taken off the queue by loadChunk (ms.c) and keeps its place; one already unloaded loads again, at the end, and its entities thaw.
 *  `flush` (default): run `unloadQueued` at once, as the pre-b60 callers expect; EntityWorld.tickMobs passes false and calls it after the spawner pass, where WorldServer.tick does. */
export function trackChunkLoads(mobs, player, view = mobs?.viewChunks, keeps = null, flush = true) {
  if (!mobs || !player || !finite(player.x) || !finite(player.z) || !Number.isInteger(view) || view < 1) return;
  trackSquare(mobs, player, view, keeps);
  if (flush) unloadQueued(mobs);
}

function trackSquare(mobs, player, view, keeps) {
  const cx = Math.trunc(player.x) >> 4, cz = Math.trunc(player.z) >> 4, st = (mobs.chunkLoads ??= { map: new Map(), out: new Set(), queue: new JavaHashSetOrder(), cx: null, cz: null, view: 0, n: 0 });
  if (st.cx === cx && st.cz === cz && st.view === view) return;
  const square = new Set(), reloaded = [];
  for (let x = cx - view; x <= cx + view; x++) for (let z = cz - view; z <= cz + view; z++) {
    const k = `${x},${z}`;
    square.add(k);
    if (st.queue.remove(k)) continue; // still queued: loadChunk (ms.c) takes it off chunksToUnload, nothing reloads
    if (!st.map.has(k) || st.out.has(k)) { if (st.out.has(k)) { (st.again ??= new Set()).add(k); reloaded.push(k); } st.map.set(k, ++st.n); st.out.delete(k); } // `again`: loaded a second time, after its first load was unloaded
  }
  // b59so / b60so: a chunk of the old square the new one lacks is queued by ms.b unless `keeps` says it is near the spawn of a respawn-capable world (executed `b59so-away-back-*`).
  if (st.cx !== null) for (let x = st.cx - st.view; x <= st.cx + st.view; x++) for (let z = st.cz - st.view; z <= st.cz + st.view; z++) {
    const k = `${x},${z}`;
    if (!square.has(k) && !keeps?.(x, z) && !st.out.has(k)) st.queue.add(k, x ^ z); // Long.hashCode of (x, z) packed low / high is x ^ z
  }
  st.cx = cx; st.cz = cz; st.view = view;
  if (reloaded.length) thaw(mobs, reloaded);
}

/** b60so: ChunkProviderServer.unloadQueuedChunks (ms.d, bytecode-read): up to 100 queued chunks per call, taken from the front of the HashSet, unless level saving is disabled (not modelled).
 *  WorldServer.tick calls it after the spawner pass; the entities of each unloaded chunk leave loadedEntityList at the start of the same server tick's updateEntities (executed b59so). */
export function unloadQueued(mobs, limit = 100) {
  const st = mobs?.chunkLoads;
  if (!st?.queue?.size) return;
  const keys = st.queue.keys().slice(0, limit);
  for (const k of keys) { st.queue.remove(k); st.out.add(k); }
  freeze(mobs, new Set(keys));
}

const loadedEntities = (m) => [...(m.entities ?? []), ...(m._fireballs?.list ?? []), ...[...(m.walks?.values() ?? [])].flatMap((w) => w.list())].filter((e) => e && !e.dead);
const chunkKey = (e) => `${Math.floor((e.x ?? 0) / 16)},${Math.floor((e.z ?? 0) / 16)}`;

/** b60so: Chunk.onChunkUnload -> World.unloadEntities: the chunk is saved with its entities (the port keeps their state in its own lists, which is the save) and they leave loadedEntityList:
 *  they stop updating, count for nothing, and take no place in the walk. A mount and its rider freeze together or not at all; what carries the player never does. */
function freeze(mobs, keys) {
  const fz = (mobs.frozen ??= { set: new Set(), byChunk: new Map() });
  for (const e of loadedEntities(mobs)) {
    const k = chunkKey(e);
    if (!keys.has(k) || fz.set.has(e) || carriesPlayer(e)) continue;
    const mates = [e.ridingEntity, e.passenger].filter(Boolean);
    if (mates.some((m) => !keys.has(chunkKey(m)) || carriesPlayer(m))) continue;
    fz.set.add(e); FROZEN.add(e);
    (fz.byChunk.get(k) ?? fz.byChunk.set(k, []).get(k)).push(e);
  }
}

/** b60so: Chunk.onChunkLoad on a return: the chunk's saved entities are read back (AnvilChunkLoader: section 0..15, each in its list order, a rider with its mount) and appended to loadedEntityList in
 *  the order the chunks load (`keys`). They take new places at the end and are filed fresh (no move since). */
function thaw(mobs, keys) {
  const fz = mobs.frozen;
  if (!fz?.byChunk.size) return;
  mobs.orderStamp?.();
  mobs.withBalls?.(mobs.entities.slice());
  const seqs = mobs.orderSeqs, moved = mobs.sectionSeqs, rows = [];
  for (const k of keys) {
    const here = fz.byChunk.get(k);
    if (!here) continue;
    fz.byChunk.delete(k);
    const part = here.filter((e) => { fz.set.delete(e); FROZEN.delete(e); return !e.dead; }).map((e) => ({ e, chunk: k, sec: sectionOf(e), list: moved?.get(e) ?? seqs?.get(e) ?? 0 }));
    part.sort((a, b) => a.sec - b.sec || a.list - b.list);
    rows.push(...part);
    mobs.chunkBirth?.delete(k);
  }
  if (!rows.length || !seqs) return;
  const byChunk = new Map();
  for (const r of rows) (byChunk.get(r.chunk) ?? byChunk.set(r.chunk, []).get(r.chunk)).push(r);
  for (const part of byChunk.values()) {
    for (const r of loadOrder(part)) { seqs.set(r.e, mobs.orderCount = (mobs.orderCount ?? 0) + 1); moved?.delete(r.e); mobs.sectionCells?.delete(r.e); }
    for (const r of createOrder(part)) renumber(mobs, r.e); // b62: the ids follow the reader's creation order, not the loaded list's
  }
  mobs.entities.sort((a, b) => (seqs.get(a) ?? Infinity) - (seqs.get(b) ?? Infinity));
}

/** b62: every frozen entity of any kind (mobs, items, orbs, arrows, carts ...). The chunk-list queries (getEntitiesWithinAABB: arrows, explosions, pickups, merges, pushes, village counts) skip these. */
const FROZEN = new WeakSet();
export const isFrozen = (e) => FROZEN.has(e);

/** b60so: the walk's list without the frozen entities (the entities of unloaded chunks are not in loadedEntityList). */
export const liveOrder = (mobs, order) => (mobs?.frozen?.set.size ? order.filter((e) => !mobs.frozen.set.has(e)) : order);
/** b61 trackerorder: the same for a `{ kind: [entities] }` map (the trackers' lists). An unloaded chunk's entities are in no tracker: World.unloadEntities -> onEntityRemoved -> EntityTracker.untrackEntity sends the destroy. */
export const liveLists = (mobs, lists) => { if (!mobs?.frozen?.set.size) return lists; const out = {}; for (const k in lists) out[k] = liveOrder(mobs, lists[k]); return out; };

/** b61 trackerorder (executed SavedOrderLoginProbe `ids`): a reloaded entity is a new Entity read from NBT (`nextEntityID++`), so it takes a new id, in the order the chunk read creates them. Mobs name theirs
 *  "mob-N", the other kinds carry `entityId` or a numeric `id`; the entity's tracker entry went with the unload, so the new id is what the next entry (and its HashSet slot) sees. */
function renumber(mobs, e) {
  const ids = mobs.ids;
  if (!ids || !e) return;
  if (typeof e.id === "string" && /^mob-\d+$/.test(e.id)) e.id = "mob-" + ids.take();
  else if (Number.isInteger(e.entityId)) e.entityId = ids.take();
  else if (Number.isInteger(e.id)) e.id = ids.take();
}

/** b59so: ms.b's keep-loaded rule: a chunk whose centre is within 128 blocks of the spawn on both axes is not queued for unloading (Overworld-like providers only: pass null for the Nether and End). */
export const nearSpawn = (spawn) => (finite(spawn?.x) && finite(spawn?.z) ? (cx, cz) => { const dx = cx * 16 + 8 - Math.floor(spawn.x), dz = cz * 16 + 8 - Math.floor(spawn.z); return dx >= -128 && dx <= 128 && dz >= -128 && dz <= 128; } : null);

// A cart, boat or mob the local player rides (minecarts.js / boats.js `rider`, entities.js serializeOne's playerRides rule).
const carriesPlayer = (e) => { const r = e?.rider; return !!r && !r.dead && (r.player === true || r.vehicle?.entity === e); };

// The order a load gives the file the walk writes (AnvilChunkLoader): a mount with a rider is not written (Entity.writeToNBTOptional); its rider carries it nested under `Riding`,
// and the reader adds the rider to the chunk it is reading, then each mount of the chain (Chunk.addEntity, filed by the mount's own posY / 16). Chunk.onChunkLoad then
// appends each section's list in turn. Without riders this is the walk itself.
function loadOrder(rows) {
  const byEnt = new Map(rows.map((r) => [r.e, r])), mounted = new Set();
  for (const r of rows) { const m = r.e.ridingEntity; if (m && m !== r.e && byEnt.has(m)) mounted.add(m); }
  if (!mounted.size) return rows;
  const chunks = new Map();
  const file = (r, row) => { const secs = chunks.get(r.chunk) ?? chunks.set(r.chunk, Array.from({ length: SECTIONS }, () => [])).get(r.chunk); secs[row.sec].push(row); };
  for (const r of rows) {
    if (mounted.has(r.e)) continue;
    file(r, r);
    const seen = new Set([r.e]);
    for (let m = r.e.ridingEntity; m && byEnt.has(m) && !seen.has(m); m = m.ridingEntity) { seen.add(m); file(r, byEnt.get(m)); }
  }
  const out = [];
  for (const secs of chunks.values()) for (const list of secs) out.push(...list);
  return out.length === rows.length ? out : rows; // a mount whose rider is not in the walk (a ring) would be lost: keep the plain walk
}

/** b62 singleleft (executed SavedOrderLoginProbe `saved-order9`): AnvilChunkLoader creates the entities in the file's order (sections 0..15, each in list order); a rider is created first and then each mount
 *  of its Riding chain (n, n + 1, ...), though the mount is filed in its own section: the cart of a cow in section 8 is in the loaded list before the orb of section 1 but has a higher id. */
function createOrder(rows) {
  const byEnt = new Map(rows.map((r) => [r.e, r])), mounted = new Set();
  for (const r of rows) { const m = r.e.ridingEntity; if (m && m !== r.e && byEnt.has(m)) mounted.add(m); }
  if (!mounted.size) return rows;
  const out = [];
  for (const r of rows) {
    if (mounted.has(r.e)) continue;
    out.push(r);
    const seen = new Set([r.e]);
    for (let m = r.e.ridingEntity; m && byEnt.has(m) && !seen.has(m); m = m.ridingEntity) { seen.add(m); out.push(byEnt.get(m)); }
  }
  return out.length === rows.length ? out : rows;
}

/** The chunk/section check of World.updateEntityWithOptionalForce, run for the entities in `order`: tickMobs calls it with one entity right after that entity's own update (b54so) (`start`: for the
 *  whole pass at its beginning, only to note where an entity joined). An entity whose posX / 16, posY / 16 or posZ / 16 (floor, y unclamped) differs from the cell it is filed in leaves that list and joins the end of the new one: it gets
 *  a stamp above everything so far in `sectionSeqs`, which the save walk reads for the order inside a section. The filed section is clamped (Chunk.addEntity), so an entity
 *  at y >= 256 or y < 0 is refiled every pass. */
export function trackSections(mobs, order, start = false) {
  if (!mobs?.walks?.size || !order?.length) return;
  const cells = (mobs.sectionCells ??= new WeakMap()), born = (mobs.chunkBirth ??= new Map());
  let stamped = false;
  for (const e of order) {
    const py = e?.posY ?? e?.y; // an orb's y is its box bottom, posY the entity's
    if (!e || e.dead || e.removedNow || !finite(e.x) || !finite(py) || !finite(e.z)) continue;
    const cx = Math.floor(e.x / 16), cy = Math.floor(py / 16), cz = Math.floor(e.z / 16), c = cells.get(e);
    if (!born.has(`${cx},${cz}`)) born.set(`${cx},${cz}`, mobs.orderSeqs?.get(e) ?? mobs.orderCount ?? 0);
    if (!c) { cells.set(e, [cx, Math.min(SECTIONS - 1, Math.max(0, cy)), cz]); continue; }
    if (start || (c[0] === cx && c[1] === cy && c[2] === cz)) continue;
    if (!stamped) { mobs.orderStamp?.(); stamped = true; } // every entity known so far has its place before the moved ones take theirs
    (mobs.sectionSeqs ??= new WeakMap()).set(e, mobs.orderCount = (mobs.orderCount ?? 0) + 1);
    c[0] = cx; c[1] = Math.min(SECTIONS - 1, Math.max(0, cy)); c[2] = cz;
  }
}

/** Stamps `ord` on the saved records of the groups (their place in the native save walk); `base` shifts it above records stamped earlier. */
export function stampSavedOrder(mobs, groups, base = 0, frame = mobs?.loadFrame ?? null) {
  if (!mobs?.walks?.size || !groups.length) return;
  const { order, lost, carried } = saveWalk(mobs, groups, frame);
  order.forEach((r, i) => { r.record.ord = base + i; });
  // b56so: the chain below a mount that carries the player is not saved (the records only; the live entities stay until the page is reloaded), and the carrier no longer rides it.
  for (const r of carried) if (lost.length) delete r.record.riding;
  for (const r of lost) for (const g of groups) { const i = g.records.indexOf(r.record); if (i >= 0) g.records.splice(i, 1); }
}

/** After a load: gives the groups' entities the stamps of their records, so the walk runs them in the saved order. Records without a number are left to the usual place. */
export function restoreSavedOrder(mobs, groups) {
  if (!mobs?.walks?.size) return;
  mobs.orderSeqs ??= new WeakMap();
  mobs.sectionSeqs = new WeakMap(); mobs.sectionCells = new WeakMap(); mobs.chunkBirth = new Map(); // a loaded list is in its saved order: no entity has moved since
  const seqs = mobs.orderSeqs, done = new Set();
  let top = mobs.orderCount ?? 0;
  for (const { live, records } of groups) {
    live.forEach((e, i) => {
      delete e.ord; // a mob keeps its whole record: the stamp is not state
      if (!finite(records[i]?.ord)) return;
      const s = records[i].ord + 1;
      seqs.set(e, s); done.add(e); top = Math.max(top, s);
    });
  }
  // The entities of a group that was not restored (an old save, a record a loader skipped) go after the restored ones, in the order they joined while loading.
  const rest = [...mobs.entities, ...(mobs._fireballs?.list ?? []), ...[...mobs.walks.values()].flatMap((w) => w.list())].filter((e) => !done.has(e));
  rest.map((e, i) => [seqs.get(e) ?? Infinity, i, e]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).forEach(([, , e]) => seqs.set(e, ++top));
  mobs.entities.sort((a, b) => seqs.get(a) - seqs.get(b)); // the mobs list is the walk's order of the mobs (withBalls merges the other kinds into it)
  mobs.orderCount = top;
}

/** The highest `ord` among saved records (the away run puts what it ran above the records it left alone). */
export const topSavedOrder = (...lists) => lists.flat().reduce((m, r) => (finite(r?.ord) ? Math.max(m, r.ord) : m), -1);

/** b58so: gives entities of a kind that joined the run after the load (the away run's falling blocks) the stamps of their records (one entity per record, in the loaded order). */
export function restoreExtraOrder(mobs, live, records) {
  if (!mobs?.walks?.size || !live?.length || live.length !== records?.length) return;
  mobs.orderSeqs ??= new WeakMap();
  let top = mobs.orderCount ?? 0;
  live.forEach((e, i) => { if (!finite(records[i]?.ord)) return; const s = records[i].ord + 1; mobs.orderSeqs.set(e, s); top = Math.max(top, s); });
  mobs.orderCount = top;
}
