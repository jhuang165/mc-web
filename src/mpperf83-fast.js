// Batch 83 mpperf83: fewer allocations (and BigInt work) in the server tick, from tools/bench-alloc81.mjs heap sampling of the travel, pen and terrain scenes.
// Results are unchanged; only how they are computed. MC_MPPERF83=on (default) | off (reference paths) | verify (both, throws on the first difference);
// tests set `fast83.mode`. This module imports nothing, so java-random.js, entities.js, push-grid.js, item-entities.js, projectiles.js and simulation.js can use it.
//   1. lcgNext: java.util.Random.next(bits) on two 24-bit halves of the 48-bit seed held in plain numbers (JavaRandom.hi / .lo; `seed` stays readable and writable as a
//      BigInt through an accessor). The BigInt step allocated four BigInts per draw and cost about 35 ns; the number step allocates nothing and costs about 5 ns.
//   2. typeSize: EntityMobs.tickMobs' `t` ({ ...ENTITY_TYPES[type], width: width * scale, height: height * scale }), one frozen object per (type entry, scale). A
//      caller that wrote into it would throw (modules are strict); verify builds the spread every call and compares it field by field with the cached one.
//   3. pushNearBox: EntityMobs.push's grown box `near` (pushBox(e, w, h) +- 0.2 sideways) written into one reused array, plus the push grid's verify-only `meets`
//      closure made only when the grid verifies.
//   4. fineSorted: push-grid.js FineGrid.query's candidate index list sorted in place (insertion sort for short lists; the same ascending order as the typed array
//      sort, the indices are distinct), with no subarray view or `add` closure.
//   5. pickupHits: item-entities.js pickupCandidates' box test with the bounds computed in place; a candidate entry (and its box array) is made only for a hit.
//   6. mobTargetList: projectiles.js mobTargets' list built by a loop instead of flatMap (no one-element array per mob).
//   7. vectorOf: simulation.js `vector` for an {x, y, z} (or {x, y, z, copy}) record as one literal with a shared `copy` method. The spread gave the 16 player
//      positions five hidden classes (probed with %HaveSameMap), so every p.x load in the nearest-player scans boxed a HeapNumber; the literal gives them one.

export const fast83 = { mode: (typeof process !== "undefined" && process.env?.MC_MPPERF83) || "on" };
const fail = (what) => { throw new Error(`mpperf83 ${what} mismatch`); };
export { fail as fail83 };

// ---- 1. java.util.Random.next on numbers ----
// seed = hi * 2^24 + lo, both in [0, 2^24). (seed * 0x5DEECE66D + 0xB) mod 2^48 with the multiplier split as 0x5DE * 2^24 + 0xECE66D:
//   p = lo * 0xECE66D + 0xB < 2^48 (exact in a double), carry = floor(p / 2^24), lo' = p - carry * 2^24,
//   hi' = (hi * 0xECE66D + lo * 0x5DE + carry) mod 2^24 (only the low 24 bits matter, so Math.imul's low 32 bits suffice).
// next(bits) = (int)(seed' >>> (48 - bits)): seed' * 2^(bits - 48) floored is exact (a power of two), and `| 0` is the int cast for bits <= 48.
const INV = []; for (let b = 0; b <= 48; b++) INV[b] = 2 ** (b - 48);
const MASK48 = (1n << 48n) - 1n;
export function lcgNumber(r, bits) {
  const lo = r.lo, p = lo * 0xece66d + 0xb, c = Math.floor(p * 5.9604644775390625e-8), nl = p - c * 16777216;
  const nh = (Math.imul(r.hi, 0xece66d) + Math.imul(lo, 0x5de) + c) & 0xffffff;
  r.hi = nh; r.lo = nl;
  return Math.floor((nh * 16777216 + nl) * INV[bits]) | 0;
}
// The java-random.js reference step on the BigInt seed (read and written through the accessor).
export function lcgBig(r, bits) {
  r.seed = (r.seed * 0x5deece66dn + 0xbn) & MASK48;
  return Number(BigInt.asIntN(32, r.seed >> BigInt(48 - bits)));
}
export function lcgNext(r, bits) {
  const mode = fast83.mode;
  if (mode === "on" && INV[bits] !== undefined) return lcgNumber(r, bits);
  if (mode === "off" || INV[bits] === undefined) return lcgBig(r, bits);
  const hi = r.hi, lo = r.lo, want = lcgBig(r, bits), wh = r.hi, wl = r.lo;
  r.hi = hi; r.lo = lo;
  const got = lcgNumber(r, bits);
  if (got !== want || r.hi !== wh || r.lo !== wl) fail("lcgNext");
  return got;
}
export const seedHalves = (r, v) => { const m = BigInt.asUintN(48, v); r.hi = Number(m >> 24n); r.lo = Number(m & 0xffffffn); };
export const seedOf = (r) => (BigInt(r.hi) << 24n) | BigInt(r.lo);

// ---- 2. tickMobs' type-and-size object ----
const typeSizes = new Map(); // ENTITY_TYPES entry -> Map(scale -> frozen t)
const spreadType = (base, scale) => ({ ...base, width: base.width * scale, height: base.height * scale });
export function typeSize(base, scale) {
  const mode = fast83.mode;
  if (mode === "off" || typeof scale !== "number" || Object.is(scale, -0)) return spreadType(base, scale);
  let m = typeSizes.get(base);
  if (!m) typeSizes.set(base, (m = new Map()));
  let t = m.get(scale);
  if (t === undefined) {
    if (m.size >= 256) m.clear(); // a growing foal walks through many scales
    t = Object.freeze(spreadType(base, scale));
    m.set(scale, t);
  }
  if (mode === "verify") {
    const ref = spreadType(base, scale), ka = Object.keys(ref), kb = Object.keys(t);
    if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i] || !Object.is(ref[k], t[k]))) fail("typeSize");
  }
  return t;
}
export const resetTypeSizes = () => typeSizes.clear();

// ---- 3. push's grown box ----
const NEAR = [0, 0, 0, 0, 0, 0];
let nearBusy = false;
// `pushBox` is entities.js pushBox ((o, width, height) => [minX, minY, minZ, maxX, maxY, maxZ] with float half width and height). Returns the box grown by 0.2
// sideways; release it with pushNearDone(near) when the push is over (a push inside a push, or one after an exception left the buffer taken, gets a fresh array).
export function pushNearBox(e, width, height, pushBox) {
  const mode = fast83.mode;
  if (mode === "off" || nearBusy) { const box = pushBox(e, width, height); return [box[0] - 0.2, box[1], box[2] - 0.2, box[3] + 0.2, box[4], box[5] + 0.2]; }
  const box = mode === "verify" ? pushBox(e, width, height) : null;
  const f = Math.fround, w = f(f(width) / 2), h = f(height), x = e.x, y = e.y, z = e.z;
  NEAR[0] = x - w - 0.2; NEAR[1] = y; NEAR[2] = z - w - 0.2; NEAR[3] = x + w + 0.2; NEAR[4] = y + h; NEAR[5] = z + w + 0.2;
  if (box && !(Object.is(NEAR[0], box[0] - 0.2) && Object.is(NEAR[1], box[1]) && Object.is(NEAR[2], box[2] - 0.2) && Object.is(NEAR[3], box[3] + 0.2) && Object.is(NEAR[4], box[4]) && Object.is(NEAR[5], box[5] + 0.2))) fail("pushNearBox");
  nearBusy = true;
  return NEAR;
}
export const pushNearDone = (near) => { if (near === NEAR) nearBusy = false; };
// The grid's `meets` argument: push-grid.js pushNear calls it only in its verify mode (MC_MPPERF78=verify), so the closure is made only then.
export const meetsArg = (gridMode, make) => (fast83.mode === "off" || gridMode === "verify" ? make() : null);

// ---- 4. FineGrid candidate order ----
// buf[0..n) holds distinct list indices; returns a sorted view-free answer: an Int32Array-like (buf itself, sorted in place over [0, n)) for short lists, else
// the sorted subarray. Both are read as idx[0..n).
export function fineSorted(buf, n) {
  if (fast83.mode === "off" || n > 48) return buf.subarray(0, n).sort();
  for (let i = 1; i < n; i++) {
    const v = buf[i];
    let j = i - 1;
    while (j >= 0 && buf[j] > v) { buf[j + 1] = buf[j]; j--; }
    buf[j + 1] = v;
  }
  if (fast83.mode === "verify") { const ref = Int32Array.from(buf.subarray(0, n)).sort(); for (let i = 0; i < n; i++) if (ref[i] !== buf[i]) fail("fineSorted"); }
  return buf;
}

// ---- 5. item pickup candidates ----
// The ItemEntities.pickupCandidates loop (box = [x - W, y, z - W, x + W, y + H, z + W]) for `items`; `skip(e)` is its dead / delay / frozen test.
export function pickupHits(items, feet, width, height, W, H, skip, posY) {
  const f = Math.fround, r = f(width) / 2 + 1, out = [];
  const x0 = feet.x - r, x1 = feet.x + r, y0 = feet.y - 0.5, y1 = feet.y + f(height) + 0.5, z0 = feet.z - r, z1 = feet.z + r;
  for (const e of items) {
    if (skip(e)) continue;
    const ex = e.x, ey = e.y, ez = e.z, a = ex - W, b = ey, c = ez - W, d = ex + W, g = ey + H, h = ez + W;
    if (!(d > x0 && a < x1 && g > y0 && b < y1 && h > z0 && c < z1)) continue;
    out.push({ key: e, ref: e, box: [a, b, c, d, g, h], posY: ey + posY });
  }
  return out;
}
const sameTarget = (a, b) => a.key === b.key && a.ref === b.ref && a.posY === b.posY && a.box.length === b.box.length && a.box.every((v, k) => Object.is(v, b.box[k]));
export const sameTargets = (a, b) => a.length === b.length && a.every((x, i) => sameTarget(x, b[i]));

// ---- 6. mob target list ----
// `one(e)` is mobTargets' flatMap callback (an array of targets for the entity).
export function mobTargetList(entities, one) {
  if (fast83.mode === "off") return entities.flatMap(one);
  const out = [];
  for (let i = 0; i < entities.length; i++) {
    if (!(i in entities)) continue; // flatMap skips holes
    const got = one(entities[i], i, entities);
    if (Array.isArray(got)) for (let k = 0; k < got.length; k++) out.push(got[k]);
    else out.push(got);
  }
  if (fast83.mode === "verify") {
    const ref = entities.flatMap(one);
    if (ref.length !== out.length || ref.some((t, k) => t.ref !== out[k].ref || t.part !== out[k].part || typeof t.reach !== typeof out[k].reach || /* b84: a dragon part's reach is a fresh closure per call */ t.box.some((v, j) => !Object.is(v, out[k].box[j])))) fail("mobTargetList");
  }
  return out;
}

// ---- 7. player vectors ----
function copyVec(v) { Object.assign(this, { x: v.x, y: v.y, z: v.z }); return this; }
const plainVector = (p) => {
  if (p === null || typeof p !== "object" || Object.getPrototypeOf(p) !== Object.prototype) return false;
  const k = Object.keys(p);
  if (!(k[0] === "x" && k[1] === "y" && k[2] === "z" && (k.length === 3 || (k.length === 4 && k[3] === "copy")))) return false;
  // own enumerable data properties only (a getter would be read by the spread too, but keep the literal to plain records); no symbols
  return Object.getOwnPropertySymbols(p).length === 0 && k.every((n) => "value" in Object.getOwnPropertyDescriptor(p, n));
};
// `reference(p)` is simulation.js's `{ ...p, copy(v) { ... } }`.
export function vectorOf(p, reference) {
  const mode = fast83.mode;
  if (mode === "off" || !plainVector(p)) return reference(p);
  const v = { x: p.x, y: p.y, z: p.z, copy: copyVec };
  if (mode === "verify") {
    const ref = reference(p), ka = Object.keys(ref), kb = Object.keys(v);
    if (ka.join() !== kb.join() || !["x", "y", "z"].every((n) => Object.is(ref[n], v[n])) || typeof ref.copy !== "function") fail("vectorOf");
  }
  return v;
}
