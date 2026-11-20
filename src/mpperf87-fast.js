// Batch 87 mpperf87: fewer allocations in the server tick (results unchanged). MC_MPPERF87=on (default) | off (reference paths) | verify (both, throws on the
// first difference); tests set `fast87.mode`. This module imports nothing.
//   1. entities.js tickMobs / push: the mob loop's closures moved to module functions (no per-mob block context; the AI step is a sentinel walk() knows, the
//      potion hooks are made only for a mob with effects), attackEquipment kept when the slots still hold the same ids (attackEquipment87), and push's
//      candidate loop indexed over the grid's list (frozen entities skipped in the loop, no liveOrder copy), with the grid's verify-only `meets` closure made
//      only when asked and the player's box tested in place.
//   2. item-entities.js: the merge scan's boxes tested in place (no two six-number arrays per candidate), e.bxz kept when the moved box gives the same four
//      numbers (sameBxz: a resting item), and pushOut's box in a scratch array; entities.js entityPushOut asks "any collision box?" with pooled scratch boxes.
//   3. entity-tracker.js / server-mob-entries.js: a SharedEntry keeps its packets' sequence numbers and destinations in two arrays beside `packets`
//      (EntryStamps) instead of two WeakMap writes per packet; server-mobs.js track reads them through the entry. A packet other than a spawn is copied once
//      and that copy goes to every watcher (nothing after track writes into a packet; verify freezes the shared copy).
//   4. The largest allocators the profile named after 1-3: entities.js inWater's dry test reads the entity's numbers itself (dryEntity, dryBounds for
//      moveEntityBody's box) and skips addVelocity's zero stores (addZero); projectiles.js mobTargets (the arrow pass's target list every tick) works the
//      sizes out in place and keeps each record with its unmoved box (mobTargetAt).
export const fast87 = { mode: (typeof process !== "undefined" && process.env?.MC_MPPERF87) || "on" };
export const fail87 = (what) => { throw new Error(`mpperf87 ${what} mismatch`); };

// Object.is for two numbers without the call: TurboFan does not always lower Object.is on doubles read from fields, and then both sides are boxed into fresh
// heap numbers per call. Same answers: +0 and -0 differ, NaN equals NaN.
export const sameNum = (a, b) => (a === b ? a !== 0 || 1 / a === 1 / b : a !== a && b !== b);

// ---- 1. attackEquipment ----
// tickMobs' `e.attackEquipment = e.equipment.map((s) => (s ? { id: s.id } : null))`. The arrays this makes are never written (combat.js and entities.js only read
// `.id`), so the one from the last update is handed back when every slot still has the same id (or is still empty). Only arrays made here are reused.
const MADE = new WeakSet();
const idCopy = (s) => (s ? { id: s.id } : null);
export function attackEquipment87(prev, eq) {
  const mode = fast87.mode;
  if (mode === "off" || !Array.isArray(eq)) return eq.map(idCopy);
  let keep = prev !== undefined && prev !== null && MADE.has(prev) && prev.length === eq.length;
  for (let k = 0; keep && k < eq.length; k++) {
    if (!(k in eq)) { keep = false; break; } // a hole: map keeps it, leave that to map
    const s = eq[k], p = prev[k];
    keep = s ? p !== null && Object.is(p.id, s.id) : p === null;
  }
  const out = keep ? prev : eq.map(idCopy);
  if (!keep) MADE.add(out);
  if (mode === "verify") {
    const ref = eq.map(idCopy);
    if (ref.length !== out.length || ref.some((r, k) => (r === null ? out[k] !== null : out[k] === null || !Object.is(out[k].id, r.id) || Object.keys(out[k]).length !== 1))) fail87("attackEquipment");
  }
  return out;
}

// ---- 2. item helpers ----
// The four numbers move() stores in e.bxz ([minX, maxX, minZ, maxZ]): true when the stored array already holds them (Object.is), so it is kept.
export const sameBxz = (b, a, d, c, h) => b !== undefined && b !== null && b.length === 4 && sameNum(b[0], a) && sameNum(b[1], d) && sameNum(b[2], c) && sameNum(b[3], h);

// ---- 2b. mob target records ----
// projectiles.js mobTargets' record `{ ref: e, box }` for the mob at index i, with mpperf84's box store `st` (cells { e, x, y, z, hw, h, box }) read in place:
// the sizes are worked out here from the type record `t` and the calf flag, so no double crosses a call boundary (mobBoxAt's hw and h were boxed per mob, and its
// Object.is calls boxed both sides). The box is kept while the mob has not moved (as mobBoxAt), and the record with it while nobody marked it: `thrower` is the
// only key callers add (server-dispense.js targets, witch-potions.js, mooshroom-golem-live.js), each right after the list is made and before the next list is
// asked for, and a marked record is replaced.
export function mobTargetAt(st, i, e, t, young) {
  const f = Math.fround, s = young ? 0.5 : 1, w = f(t.width * s), h = f(t.height * s), hw = f(w / 2), x = e.x, y = e.y, z = e.z;
  let c = st[i];
  if (c === undefined || c.e !== e || !(sameNum(c.x, x) && sameNum(c.y, y) && sameNum(c.z, z) && sameNum(c.hw, hw) && sameNum(c.h, h))) {
    if (c === undefined) st[i] = (c = { e, x, y, z, hw, h, box: null });
    c.e = e; c.x = x; c.y = y; c.z = z; c.hw = hw; c.h = h; c.box = [x - hw, y, z - hw, x + hw, y + h, z + hw];
  }
  const box = c.box;
  let r = c.rec87;
  if (r === undefined || r.ref !== e || r.box !== box || r.thrower !== undefined) c.rec87 = r = { ref: e, box };
  if (fast87.mode === "verify") {
    const ref = [x - hw, y, z - hw, x + hw, y + h, z + hw];
    if (Object.keys(r).length !== 2 || box.length !== 6 || ref.some((v, k) => !Object.is(v, box[k]))) fail87("mob target");
  }
  return r;
}

// ---- 3. tracker stamps ----
// The sequence numbers and destinations of an entry's packets, in two arrays beside it. `pk[k]` is the k-th stamped packet, so a lookup is by identity (the newest
// match wins, as the WeakMap's last set did). The slots restart when the entry's packet list was emptied (every reader clears it after a pass) and are compacted
// if they ever grow well past it.
export class EntryStamps {
  // `n` live slots; the arrays keep their length (emptying them with `length = 0` gave their backing stores back, and every tick grew them again).
  constructor() { this.pk = []; this.seq = []; this.dest = []; this.n = 0; }
  put(packets, p, seq, dest) {
    if (packets.length === 1) this.n = 0; // the list was emptied since the last stamp (or this is the first)
    else if (this.n > 4 * packets.length + 32) this.compact(packets);
    const n = this.n;
    this.pk[n] = p; this.seq[n] = seq; this.dest[n] = dest; this.n = n + 1;
  }
  compact(packets) {
    const pk = this.pk, seq = this.seq, dest = this.dest;
    let n = 0;
    for (let k = 0; k < this.n; k++) if (packets.includes(pk[k])) { pk[n] = pk[k]; seq[n] = seq[k]; dest[n] = dest[k]; n++; }
    this.n = n;
  }
  at(p) { const pk = this.pk; for (let k = this.n - 1; k >= 0; k--) if (pk[k] === p) return k; return -1; }
  seqOf(p) { const k = this.at(p); return k < 0 ? 0 : this.seq[k]; }
  destOf(p) { const k = this.at(p); return k < 0 ? undefined : this.dest[k]; }
}

// ---- 3b. shared packet copies ----
// verify: the shared copy is frozen, so a sink that writes into a packet throws in the tests (module code is strict).
export const shareDone = (c) => (fast87.mode === "verify" ? Object.freeze(c) : c);

// ---- 4. dry box ----
// mpperf81-fast.js noWaterIn for the box [x - w/2, y, z - w/2, x + w/2, y + h, z + w/2] (the same arithmetic as inWater's arguments to dryBox): true when no cell
// in handleWaterMovement's range holds `water`.
export function dryEntity(world, e, w, h, water) {
  const r = w / 2, x = e.x, y = e.y, z = e.z;
  const x0 = x - r + 0.001, y0 = y + 0.4000000059604645 + 0.001, z0 = z - r + 0.001, x1 = x + r - 0.001, y1 = y + h - 0.4000000059604645 - 0.001, z1 = z + r - 0.001;
  const ax = Math.floor(x0), bx = Math.floor(x1 + 1), ay = Math.floor(y0), by = Math.floor(y1 + 1), az = Math.floor(z0), bz = Math.floor(z1 + 1);
  for (let i = ax; i < bx; i++) for (let j = ay; j < by; j++) for (let k = az; k < bz; k++) if (world.get(i, j, k) === water) return false;
  return true;
}
// The same for a box array [minX, minY, minZ, maxX, maxY, maxZ].
export function dryBounds(world, b, water) {
  const x0 = b[0] + 0.001, y0 = b[1] + 0.4000000059604645 + 0.001, z0 = b[2] + 0.001, x1 = b[3] - 0.001, y1 = b[4] - 0.4000000059604645 - 0.001, z1 = b[5] - 0.001;
  const ax = Math.floor(x0), bx = Math.floor(x1 + 1), ay = Math.floor(y0), by = Math.floor(y1 + 1), az = Math.floor(z0), bz = Math.floor(z1 + 1);
  for (let i = ax; i < bx; i++) for (let j = ay; j < by; j++) for (let k = az; k < bz; k++) if (world.get(i, j, k) === water) return false;
  return true;
}
// addVelocity(e, 0, 0, 0) (`e.vx += 0` and so on) without the store when it changes nothing: x + 0 is x for every number but -0 (which becomes +0); anything
// else (undefined, a string) is added as before. Skipping the store avoids a fresh boxed number per field.
export function addZero(e) {
  const vx = e.vx; if (typeof vx !== "number" || vx === 0) e.vx = vx + 0;
  const vy = e.vy; if (typeof vy !== "number" || vy === 0) e.vy = vy + 0;
  const vz = e.vz; if (typeof vz !== "number" || vz === 0) e.vz = vz + 0;
}
