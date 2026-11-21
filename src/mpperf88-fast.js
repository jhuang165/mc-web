// Batch 88 mpperf88: fewer allocations in the server tick (results unchanged). MC_MPPERF88=on (default) | off (reference paths) | verify (both, throws on the
// first difference); tests set `fast88.mode`. This module imports nothing.
//   1. entities.js create: the mobs' number fields get V8's "any value" field representation (mobShape88), so a megamorphic read of e.x no longer boxes a fresh number.
//   2. Index and Map.forEach loops for the for-of loops that showed as the `next` builtin: bow.js step's target filter (arrowNear88), server-mobs.js track (the packet-list
//      reset and the state rows), server-chunk-view.js tick, server-hanging.js track, server-chunks.js ServerChunkSets.chunks, server-dispense.js flush's player filter, and
//      snapshot's early answer when nothing flies.
//   3. server-mob-entries.js removeWatcher: the stale EntryStamps slots and destination snapshots naming the departed watcher are cleared (releaseWatcher88).
//   4. projectiles.js mobTargets: the numbers each target record was made from live in a Float64Array (mobTargetAt88), not in a cell object per mob.
export const fast88 = { mode: (typeof process !== "undefined" && process.env?.MC_MPPERF88) || "on" };
export const fail88 = (what) => { throw new Error(`mpperf88 ${what} mismatch`); };

// ---- 1. mob number fields ----
// entities.js create: every mob is made by one literal, then type-specific spreads, physics() and syncInterpolation, so the travel scene's 255 mobs have 27 hidden classes
// (9 types; executed with %HaveSameMap) and every site that reads a mob's numbers from more than one type (push, tickMobs' helpers, the trackers, the AI) is megamorphic.
// V8 keeps a double field as a mutable box and a megamorphic load copies it into a fresh heap number on each read. One shape for every type would mean the same keys in
// the same order on every mob, which changes Object.keys, saves and `in` tests (game state). Instead the number fields below are given the "any value" representation once per
// hidden class: a store of a non-number and then of the value back. A load then hands out the stored number itself (no copy); a store of a fresh double allocates once, but
// these fields are read far more often than written. The keys, their order and every value (-0 and NaN too) are what they were. verify compares both after each call.
const TAG = Object.freeze({});
export const MOB_NUMBER_FIELDS = Object.freeze(["x", "y", "z", "vx", "vy", "vz", "px", "py", "pz", "yaw", "rotationYaw", "prevRotationYaw", "renderYawOffset", "prevRenderYawOffset",
  "rotationYawHead", "prevRotationYawHead", "rotationPitch", "prevRotationPitch", "limbSwing", "limbSwingAmount", "prevLimbSwingAmount", "bodyHeadYaw", "fallDistance", "moveForward",
  "aiMoveSpeed", "knockbackResistance", "health"]);
export function mobShape88(e) {
  const mode = fast88.mode;
  if (mode === "off") return e;
  const keys = mode === "verify" ? Object.keys(e) : null, vals = keys === null ? null : keys.map((k) => e[k]);
  const f = MOB_NUMBER_FIELDS;
  for (let k = 0; k < f.length; k++) { const n = f[k]; if (Object.prototype.hasOwnProperty.call(e, n)) { const v = e[n]; e[n] = TAG; e[n] = v; } }
  if (keys !== null) { const now = Object.keys(e); if (now.length !== keys.length || now.some((k, i) => k !== keys[i] || !Object.is(e[k], vals[i]))) fail88("mob shape"); }
  return e;
}

// ---- 2. index loops for the hot for-of loops ----
// bow.js step: the targets whose box meets the arrow's swept area (a dragon part also asks its `reach`), in list order, as the for-of loop collects them.
export function arrowNear88(list, area, overlap, out) {
  for (let k = 0; k < list.length; k++) {
    const t = list[k];
    if (!overlap(t.box, area)) continue;
    if (t.reach && !t.reach(area)) continue;
    out.push(t);
  }
  return out;
}

// ---- 3. a departed watcher's stamp slots ----
// server-mob-entries.js removeWatcher: mpperf87's EntryStamps keep their slots for reuse, so a slot past the live ones (or one whose packet the entry no longer holds) can still
// hold a destination array naming the watcher that left, and the packet, until a later stamp overwrites it. This clears the stale slots of every entry: a slot is live while its
// packet is still in `entry.packets` (track() empties the list after each pass, and the stamps restart then). An entry's shared destination snapshot (`snap`) that names the
// watcher is dropped too; destinations() makes a fresh one with the same members when it is next asked. Nothing that is read later changes: verify compares every live packet's
// stamp and destinations before and after.
export function releaseWatcher88(entries, w) {
  const mode = fast88.mode;
  if (mode === "off") return;
  entries.forEach((en) => {
    const entry = en.entry, s = entry.stamps;
    if (entry.snap !== undefined && entry.snap.includes(w)) entry.snap = undefined;
    if (s === null || s === undefined) return;
    const packets = entry.packets, before = mode === "verify" ? packets.map((p) => [s.seqOf(p), s.destOf(p)]) : null;
    if (packets.length === 0) s.n = 0;
    else s.compact(packets);
    const pk = s.pk, seq = s.seq, dest = s.dest;
    for (let k = s.n; k < pk.length; k++) { pk[k] = undefined; seq[k] = 0; dest[k] = undefined; }
    if (before !== null && packets.some((p, k) => s.seqOf(p) !== before[k][0] || s.destOf(p) !== before[k][1])) fail88("released stamps");
  });
}

// ---- 4. mob target records ----
// projectiles.js mobTargets' record `{ ref: e, box }` for the mob at index i (mpperf87 mobTargetAt), with the remembered numbers in a Float64Array instead of one cell object
// per mob: writing a fresh double into an object field can box it, an array of doubles takes it as it is. The box array is kept while the mob has not moved (Object.is on every
// number, as before), and the record with it while nobody marked it (`thrower`, see mpperf87). `st` is mpperf84's box store for the list; the side store hangs off it.
const STORES88 = new WeakMap();
export function targetStore88(st) {
  let s = STORES88.get(st);
  if (s === undefined) STORES88.set(st, (s = { e: [], box: [], rec: [], num: new Float64Array(5 * 64) }));
  return s;
}
export function mobTargetAt88(s, i, e, t, young) {
  const f = Math.fround, k = young ? 0.5 : 1, w = f(t.width * k), h = f(t.height * k), hw = f(w / 2), x = e.x, y = e.y, z = e.z, o = i * 5;
  let n = s.num;
  if (o + 5 > n.length) { const m = new Float64Array(Math.max(n.length * 2, o + 5)); m.set(n); s.num = n = m; }
  let box = s.box[i];
  if (box === undefined || s.e[i] !== e || !(sameNum88(n[o], x) && sameNum88(n[o + 1], y) && sameNum88(n[o + 2], z) && sameNum88(n[o + 3], hw) && sameNum88(n[o + 4], h))) {
    s.e[i] = e; n[o] = x; n[o + 1] = y; n[o + 2] = z; n[o + 3] = hw; n[o + 4] = h;
    s.box[i] = box = [x - hw, y, z - hw, x + hw, y + h, z + hw];
  }
  let r = s.rec[i];
  if (r === undefined || r.ref !== e || r.box !== box || r.thrower !== undefined) s.rec[i] = r = { ref: e, box };
  if (fast88.mode === "verify") {
    const ref = [x - hw, y, z - hw, x + hw, y + h, z + hw];
    if (Object.keys(r).length !== 2 || r.ref !== e || box.length !== 6 || ref.some((v, j) => !Object.is(v, box[j]))) fail88("mob target");
  }
  return r;
}
// Object.is on two numbers (mpperf87 sameNum). A Float64Array keeps -0 and NaN, so the stored numbers compare as the cell fields did. A position that is not a number (never
// in the game) is stored as NaN and so never matches: that mob gets a fresh box (with the same numbers) and record each call.
const sameNum88 = (a, b) => (a === b ? a !== 0 || 1 / a === 1 / b : a !== a && b !== b);
