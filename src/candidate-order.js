// The order World.getEntitiesWithinAABBExcludingEntity lists entities in (Batch 72 projectiles6). Natively (ahb.a(sa, azt, sj), apx.a(sa, azt, List, sj), both
// bytecode-read and executed in tools/probes/ChunkOrderProbe.java, public/research/chunk-order-reference.json) the query walks the loaded chunks x outer, z inner,
// and inside a chunk the vertical slices from floor((minY - 2) / 16) up, each slice list in insertion order. A new entity is appended to the list of the chunk and
// slice at its position; after each update World.updateEntityWithOptionalForce compares floor(pos / 16) (the slice unclamped) with the stored cell (the slice
// clamped to 0-15) and, when they differ, removes the entity and appends it to the list of the new cell. So an entity above y 256 or below y 0 moves to the end
// of its list on every update. Projectile loops keep the first of several equal distances (`d < d0 || d0 === 0`), so this order decides which entity is hit.
const SLICES = 16;
const stamps = new WeakMap(), named = new Map();
let counter = 0, early = -1e9;
const floor16 = (v) => Math.floor(v / 16);
const cellStore = (ref) => (ref !== null && typeof ref === "object" ? stamps : named);

// Re-slice test of updateEntityWithOptionalForce for one entity at posX, posY, posZ. `first` stamps a player (who joined the world before anything else) ahead of every
// later entity. Returns the entry.
// `lookup` is a query's catch-up for an entity nobody has stamped lately: it compares the clamped slice, so the native above-256 re-add (which belongs to the update) is not
// repeated for every query.
export function stampEntity(ref, x, y, z, first = false, lookup = false) {
  const store = cellStore(ref), cx = floor16(x), cz = floor16(z), raw = floor16(y), cy = lookup ? Math.min(SLICES - 1, Math.max(0, raw)) : raw;
  let e = store.get(ref);
  if (!e) store.set(ref, (e = { cx: NaN, sl: NaN, cz: NaN, seq: 0 }));
  if (e.cx !== cx || e.sl !== cy || e.cz !== cz) {
    e.cx = cx; e.cz = cz; e.sl = Math.min(SLICES - 1, Math.max(0, raw)); // apx.a(sa): the slice is clamped, the compare above is not
    e.seq = first && !e.seq ? early++ : ++counter;
  }
  return e;
}
export const forgetEntity = (ref) => cellStore(ref).delete(ref);

// The position natively stored for a target: the entity's own x and z when they agree with the box centre (a centre recomputed from the box can land on the other
// side of a chunk border by one ulp), else the centre; the feet for y (`posY` overrides it for an entity whose yOffset is not 0).
const posOf = (t) => {
  const cx = (t.box[0] + t.box[3]) / 2, cz = (t.box[2] + t.box[5]) / 2, k = t.key ?? t.ref ?? t.target;
  const own = k !== null && typeof k === "object" && Number.isFinite(k.x) && Number.isFinite(k.z) && Math.abs(k.x - cx) < 1e-6 && Math.abs(k.z - cz) < 1e-6;
  return [own ? k.x : cx, t.posY ?? t.box[1], own ? k.z : cz];
};
const keyOf = (t) => t.key ?? t.ref ?? t.target ?? t;

// `candidateOrder.flat` lists in the given order instead (a replay of a probe whose world double had one flat entity list, such as FireballPickProbe).
export const candidateOrder = { flat: false };

// Sorts candidates (targets with a `box`) into the native list order. `all` is the full target list (or a function returning it): entities seen for the first time are stamped from it in list
// order (the join order), so a candidate first met now still sorts after an older one. `firstOf(t)` names the players.
export function orderTargets(cands, all = cands, firstOf = (t) => t.thrower || t.ref === "player" || t.player) {
  if (cands.length < 2 || candidateOrder.flat) return cands;
  if (cands.some((t) => !cellStore(keyOf(t)).has(keyOf(t)))) for (const t of typeof all === "function" ? all() : all) { const k = keyOf(t); if (!cellStore(k).has(k)) stampEntity(k, ...posOf(t), firstOf(t)); }
  const rows = cands.map((t) => { const k = keyOf(t), e = stampEntity(k, ...posOf(t), firstOf(t), true); return { t, e }; });
  rows.sort((a, b) => a.e.cx - b.e.cx || a.e.cz - b.e.cz || a.e.sl - b.e.sl || a.e.seq - b.e.seq);
  return rows.map((r) => r.t);
}
