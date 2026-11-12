// The saved order of the loaded entities (batch 52, b52so). AnvilChunkLoader.writeChunkToNBT walks Chunk.entityLists (16 vertical sections, each in its list
// order) and readChunkFromNBT files the entities back, so after Chunk.onChunkLoad (World.addLoadedEntities per section 0..15) the loadedEntityList of a chunk is
// grouped by section (posY / 16, clamped to 0..15), not in the order the entities joined. Executed: SavedOrderProbe (saved-order-reference.json, 7 scenarios).
// The port keeps each kind in its own list, so a save stamps every record with `ord`, its place in that native walk, and a load gives the restored entities
// the stamps back (EntityWorld.orderSeqs), so the one list walk (EntityWorld.withBalls) puts mixed kinds where a native load would.
// Approximations: the chunks are taken in the order of their first joined entity (a native load follows the chunk provider's order), an entity that changed
// section keeps its join place inside the new one (natively it moves to the end of that section's list), and a mount saved with its rider is two records here.
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
  ];
}

// The native save walk of the groups' live entities: chunks (by their first entity in the loaded list), then section, then list order. Returns the entities in it.
function saveWalk(mobs, groups) {
  mobs.withBalls?.(mobs.entities.slice()); // gives every walked entity its place in the loaded list (orderSeqs)
  const seqs = mobs.orderSeqs, rows = [];
  for (const { live, records } of groups) live.forEach((e, i) => rows.push({ e, record: records[i], seq: seqs?.get(e) ?? Infinity, sec: sectionOf(e), cx: Math.floor((e.x ?? 0) / 16), cz: Math.floor((e.z ?? 0) / 16) }));
  const first = new Map();
  for (const r of rows) { const k = `${r.cx},${r.cz}`; first.set(k, Math.min(first.get(k) ?? Infinity, r.seq)); r.chunk = k; }
  rows.sort((a, b) => first.get(a.chunk) - first.get(b.chunk) || (a.chunk < b.chunk ? -1 : a.chunk > b.chunk ? 1 : 0) || a.sec - b.sec || a.seq - b.seq);
  return rows;
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
  const rest = [...mobs.entities, ...[...mobs.walks.values()].flatMap((w) => w.list())].filter((e) => !done.has(e));
  rest.map((e, i) => [seqs.get(e) ?? Infinity, i, e]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).forEach(([, , e]) => seqs.set(e, ++top));
  mobs.entities.sort((a, b) => seqs.get(a) - seqs.get(b)); // the mobs list is the walk's order of the mobs (withBalls merges the other kinds into it)
  mobs.orderCount = top;
}

/** The highest `ord` among saved records (the away run puts what it ran above the records it left alone). */
export const topSavedOrder = (...lists) => lists.flat().reduce((m, r) => (finite(r?.ord) ? Math.max(m, r.ord) : m), -1);
