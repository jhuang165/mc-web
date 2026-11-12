// The saved order of the loaded entities (batch 52, b52so). AnvilChunkLoader.writeChunkToNBT walks Chunk.entityLists (16 vertical sections, each in its list
// order) and readChunkFromNBT files the entities back, so after Chunk.onChunkLoad (World.addLoadedEntities per section 0..15) the loadedEntityList of a chunk is
// grouped by section (posY / 16, clamped to 0..15), not in the order the entities joined. Executed: SavedOrderProbe (saved-order-reference.json, 7 scenarios).
// The port keeps each kind in its own list, so a save stamps every record with `ord`, its place in that native walk, and a load gives the restored entities
// the stamps back (EntityWorld.orderSeqs), so the one list walk (EntityWorld.withBalls) puts mixed kinds where a native load would.
// Batch 53 (b53so, saved-order2-reference.json): an entity that changes chunk or section during its update moves to the end of the new list (trackSections; the check
// compares the unclamped posY / 16 with the clamped filed section, as World.updateEntityWithOptionalForce does, so one above 256 or below 0 is refiled every tick), and a
// mount saved with its rider is one record natively (the rider with the mount nested under `Riding`, the mount skipped; the loader adds the rider, then its mount to the
// chunk it is reading): the stamps are the places of that load. Fireballs and wither skulls are stamped too (their records are dimension-split).
// Approximations: the chunks are taken in the order of their first joined entity (a native load follows the chunk provider's order), and the section check runs at the end of
// the pass (natively right after each entity's own update).
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

// The native save walk of the groups' live entities: chunks (by their first entity in the loaded list), then section, then list order. Returns the entities in it.
function saveWalk(mobs, groups) {
  mobs.withBalls?.(mobs.entities.slice()); // gives every walked entity its place in the loaded list (orderSeqs)
  const seqs = mobs.orderSeqs, rows = [];
  for (const { live, records } of groups) live.forEach((e, i) => rows.push({ e, record: records[i], seq: seqs?.get(e) ?? Infinity, sec: sectionOf(e), cx: Math.floor((e.x ?? 0) / 16), cz: Math.floor((e.z ?? 0) / 16) }));
  const first = new Map(), moved = mobs.sectionSeqs, born = mobs.chunkBirth; // born: the place of the first entity a chunk had in the passes seen (a mover joining it later does not lower it)
  for (const r of rows) { const k = `${r.cx},${r.cz}`; first.set(k, Math.min(first.get(k) ?? Infinity, born?.get(k) ?? r.seq)); r.chunk = k; r.list = moved?.get(r.e) ?? r.seq; }
  rows.sort((a, b) => first.get(a.chunk) - first.get(b.chunk) || (a.chunk < b.chunk ? -1 : a.chunk > b.chunk ? 1 : 0) || a.sec - b.sec || a.list - b.list);
  return loadOrder(rows);
}

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

/** The chunk/section check of World.updateEntityWithOptionalForce, run for the entities of a pass (`order`) at its end (`start`: at its beginning, only to note where an entity
 *  joined). An entity whose posX / 16, posY / 16 or posZ / 16 (floor, y unclamped) differs from the cell it is filed in leaves that list and joins the end of the new one: it gets
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
export function stampSavedOrder(mobs, groups, base = 0) {
  if (!mobs?.walks?.size || !groups.length) return;
  saveWalk(mobs, groups).forEach((r, i) => { r.record.ord = base + i; });
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
