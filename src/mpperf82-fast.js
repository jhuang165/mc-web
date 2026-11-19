// Batch 82 mpperf82: fewer allocations in the server tick, the batch 81 leftovers of tools/bench-alloc81.mjs heap sampling (travel, pen, terrain scenes).
// Results are unchanged; only how they are computed. MC_MPPERF82=on (default) | off (reference paths) | verify (both, throws on the first difference);
// tests set `fast82.mode`. This module imports nothing, so world.js, entities.js, mob-steps.js and piston-live.js can all use it.
//   1. chunkKeyOf: World.chunkAt's `${cx},${cz}` map key from a direct-mapped cache of the strings (the key is a pure function of the two integers, so a
//      cached string is always the right one; the chunk itself is still looked up in the live map every time).
//   2. mobSizeObject: the AI's mobSize(e) answer ({ width, height }, ai.js size -> Brain.width / height, entities.js spawn site test) in one reused object.
//      Every caller reads the fields at once (audited: ai.js get width / get height / updateAITasks, entities.js the spawn-site `meets` test).
//      verify returns a fresh object each call and poisons the previous one with NaN, so a caller that kept an answer across a later call reads NaN
//      and the seeded hashes stop matching.
//   3. motionBuffer: the [vx, vy, vz] that moveEntityWithHeading stores in e.moveMotion for the move's swim/splash volume, from a per-nesting-depth buffer
//      while EntityWorld.moveWith runs (moveWith clears e.moveMotion before it returns, so no buffer outlives its call).
//   4. NO_STEPS: mob-steps.js mobStepEvents' "no event" answer, one frozen empty array (callers only read it).
//   5. piston-live.js collisionBoxes walks RedstoneWorld.loadedTiles directly instead of the pistonTiles() filter copy (same tiles, same order).
// Unflagged hoists: world.js isPlant's id list as comparisons (no array per call); mpperf79-fast.js nearestView reads the mob's x, y, z once per call
// (megamorphic loads of double fields box a HeapNumber each: 48 boxes per call with 16 players was the "nearestView / target" 8 % of sampled bytes).

export const fast82 = { mode: (typeof process !== "undefined" && process.env?.MC_MPPERF82) || "on" };
const fail = (what) => { throw new Error(`mpperf82 ${what} mismatch`); };

// ---- 1. chunk key strings ----
const SLOTS = 4096;
const keyX = new Int32Array(SLOTS), keyZ = new Int32Array(SLOTS), keyS = new Array(SLOTS).fill(null);
// `columnKey` is the caller's own key function (world.js `${cx},${cz}`): the reference for off and verify.
export function chunkKeyOf(cx, cz, columnKey) {
  const mode = fast82.mode;
  if (mode === "off") return columnKey(cx, cz);
  // Only int32 pairs are cached (a fraction, NaN or a value outside int32 is built fresh and never stored: Int32Array would truncate it and a later
  // integer lookup would match the wrong string). -0 passes and is stored as 0; both print "0".
  if ((cx | 0) !== cx || (cz | 0) !== cz) return columnKey(cx, cz);
  const i = (Math.imul(cx, 0x9e3779b1) ^ Math.imul(cz, 0x85ebca77)) >>> 20;
  let s = keyS[i];
  if (s === null || keyX[i] !== cx || keyZ[i] !== cz) { s = columnKey(cx, cz); keyX[i] = cx; keyZ[i] = cz; keyS[i] = s; }
  if (mode === "verify" && s !== columnKey(cx, cz)) fail("chunkKeyOf");
  return s;
}
export const resetChunkKeys = () => keyS.fill(null);

// ---- 2. the AI's mob size ----
const SIZE = { width: 0, height: 0 };
let lastSize = null; // verify: the previous answer, poisoned on the next call
export function mobSizeObject(width, height) {
  const mode = fast82.mode;
  if (mode === "on") { SIZE.width = width; SIZE.height = height; return SIZE; }
  if (mode === "verify" && lastSize) { lastSize.width = NaN; lastSize.height = NaN; }
  const out = { width, height };
  if (mode === "verify") lastSize = out;
  return out;
}

// ---- 3. moveMotion buffers ----
const motionBufs = [];
let motionDepth = 0;
// The buffer for the moveWith call being entered (null when off); release with motionRelease() in a finally.
export function motionEnter() {
  if (fast82.mode === "off") return null;
  return motionBufs[motionDepth++] ??= [0, 0, 0];
}
export const motionRelease = (buf) => { if (buf) motionDepth--; };
// What moveEntityWithHeading stores in e.moveMotion: the buffer filled, or (no buffer: off, or a caller other than moveWith) a fresh array.
export function motionOf(buf, vx, vy, vz) {
  if (!buf) return [vx, vy, vz];
  buf[0] = vx; buf[1] = vy; buf[2] = vz;
  return buf;
}

// ---- 4. no step events ----
export const NO_STEPS = Object.freeze([]);
export const noSteps = () => (fast82.mode === "off" ? [] : NO_STEPS);

// ---- 5. moving piston tiles ----
// True when piston-live.js collisionBoxes may walk `loadedTiles` itself (skipping the other kinds, as the filter did): `pistonTiles` is the
// RedstoneWorld method (`plain`, RedstoneWorld.prototype.pistonTiles), else the redstone's own pistonTiles() list is walked.
export const walkLoadedTiles = (redstone, plain) => fast82.mode !== "off" && redstone.pistonTiles === plain && Array.isArray(redstone.loadedTiles);
export const sameBoxLists = (a, b) => a.length === b.length && a.every((x, k) => x.length === b[k].length && x.every((v, j) => Object.is(v, b[k][j])));
export const verifying82 = () => fast82.mode === "verify";
export { fail as fail82 };
