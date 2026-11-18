// Batch 80 mpperf80: exact speed-ups in the path search and the mob move, found by profiling tools/bench-path80.mjs (mobs pathing towards players, also players on pillars
// that no mob can reach, where every search floods its follow-range sphere) and the b77 player bench. The old code stays beside each new path.
// MC_MPPERF80=on (default) | off (reference paths) | verify (both on every call, throws on the first difference); tests set `fast80.mode`.
//   1. pathCell: PathFinder's cell test (pathfinding.js getVerticalOffset, ayg.a static) through a per-id kind table and a direct column read (resident columns kept for one search), for the default classifier only.
//      Ids whose answer depends on metadata (doors, trapdoors, fence gates) or on anything the table does not hold send the whole cell to the reference function.
//   2. safeTries: entity.maxSafePointTries() asked once per search instead of once per fall step (it reads the attack target, health and difficulty, which a search never changes;
//      it has no side effects, so fewer calls change nothing else).
//   3. edgeClamp: EntityWorld.moveWith's world-edge clamp without the per-call closures and the "max"/"min" + axis.toUpperCase() field names.
//   4. originalIdOf: step-block.js's toOriginal(id, 0)[0] tests (fence-like, ladder) through a per-id table (the registry is a constant map).
import { World } from "./world.js";

export const fast80 = { mode: (typeof process !== "undefined" && process.env?.MC_MPPERF80) || "on" };
const fail = (what) => { throw new Error(`mpperf80 ${what} mismatch`); };
let WORLD_GET = null; // World.prototype.get, read on first use (no import-order dependence)

// ---- 1. path cell test ----
// Kinds (what the reference loop does with a cell of that id under the default classifier): 1 continue (air, or passable and not water), 2 water, 3 lava, 4 return -3 (fence, wall),
// 5 return 0 (solid), 6 not in the table (the whole cell goes to the reference). 0 = not filled yet.
export const KIND_CONTINUE = 1, KIND_WATER = 2, KIND_LAVA = 3, KIND_FENCE = 4, KIND_SOLID = 5, KIND_OTHER = 6;
const kinds = new Int8Array(4096);
// kindOf(id) -> one of the kinds above, from pathfinding.js (it owns the classifier); filled once per id.
let kindOf = null;
export const setPathKinds = (fn) => { kindOf = fn; kinds.fill(0); };
// World.get for a plain World (not an override): the column's array read directly, anything it cannot answer (outside, non-resident column, undefined cell) through world.get.
// During one search (beginPathSearch .. endPathSearch, pathfinding.js beginMemo / endMemo) the resident columns it found are kept in a small direct-mapped table: nothing loads,
// unloads or replaces a column while a search runs (it only reads), so a kept column is the one chunkAt would return. Columns that are not resident are never kept.
const COLS = 64, colKeyX = new Int32Array(COLS), colKeyZ = new Int32Array(COLS), colBlocks = new Array(COLS).fill(null);
let colWorld = null, inSearch = false;
export function beginPathSearch(world) {
  inSearch = true;
  colWorld = world;
  colBlocks.fill(null);
}
export function endPathSearch() { inSearch = false; colBlocks.fill(null); colWorld = null; }
function cellId(world, x, y, z) {
  if (WORLD_GET === null) WORLD_GET = World.prototype.get;
  if (world.get !== WORLD_GET) return world.get(x, y, z);
  if (!world.inside(x, y, z)) return 0;
  const cx = x >> 4, cz = z >> 4;
  let blocks = null;
  if (inSearch && world === colWorld) {
    const slot = ((cx & 7) << 3) | (cz & 7);
    blocks = colBlocks[slot];
    if (blocks === null || colKeyX[slot] !== cx || colKeyZ[slot] !== cz) {
      const c = world.chunkAt(cx, cz);
      blocks = c ? c.blocks : null;
      if (blocks !== null) { colBlocks[slot] = blocks; colKeyX[slot] = cx; colKeyZ[slot] = cz; }
    }
  } else {
    const c = world.chunkAt(cx, cz);
    blocks = c ? c.blocks : null;
  }
  if (blocks !== null) {
    const v = blocks[((x & 15) * 16 + (z & 15)) * world.height + y];
    if (v !== undefined) return v;
  }
  return world.get(x, y, z);
}
// The reference loop (pathfinding.js getVerticalOffset) for the default classifier, by kind. `ref` is that function, called with the same arguments when a cell is not in the table.
export function pathCellFast(entity, x, y, z, size, avoidWater, breakDoors, openDoors, world, classify, ref) {
  let flag = false;
  const sx = x + size.x, sy = y + size.y, sz = z + size.z;
  for (let i = x; i < sx; i++)
    for (let j = y; j < sy; j++)
      for (let k = z; k < sz; k++) {
        const id = cellId(world, i, j, k);
        let kind = id >= 0 && id < 4096 ? kinds[id] : KIND_OTHER;
        if (kind === 0) kind = kinds[id] = kindOf(id);
        if (kind === KIND_CONTINUE) continue;
        if (kind === KIND_WATER) {
          if (avoidWater) return -1;
          flag = true;
          continue;
        }
        if (kind === KIND_SOLID) return 0;
        if (kind === KIND_FENCE) return -3;
        if (kind === KIND_LAVA) {
          if (entity.inLava) continue;
          return -2;
        }
        return ref(entity, x, y, z, size, avoidWater, breakDoors, openDoors, world, classify);
      }
  return flag ? 2 : 1;
}
export function pathCell(entity, x, y, z, size, avoidWater, breakDoors, openDoors, world, classify, defaultClassify, ref) {
  const mode = fast80.mode;
  if (mode === "off" || classify !== defaultClassify || kindOf === null) return ref(entity, x, y, z, size, avoidWater, breakDoors, openDoors, world, classify);
  const v = pathCellFast(entity, x, y, z, size, avoidWater, breakDoors, openDoors, world, classify, ref);
  if (mode === "verify" && v !== ref(entity, x, y, z, size, avoidWater, breakDoors, openDoors, world, classify)) fail("pathCell");
  return v;
}

// ---- 2. safe-point tries, once per search ----
// finder.tries is reset to undefined when a search opens its memo (pathfinding.js beginMemo); outside a search (memo null: direct calls from tests) the entity is asked every time.
export function safeTries(finder, entity) {
  const mode = fast80.mode;
  if (mode === "off" || !finder.memo) return entity.maxSafePointTries();
  let t = finder.tries;
  if (t === undefined) t = finder.tries = entity.maxSafePointTries();
  if (mode === "verify" && t !== entity.maxSafePointTries()) fail("safeTries");
  return t;
}

// ---- 3. world-edge clamp of EntityWorld.moveWith ----
// The reference (entities.js moveWith before b80), with its closures; `size` is entities.js SIZE.
export function edgeClampReference(w, e, size) {
  const lim = (axis, hi) => w.streaming ? (hi ? 30000000 : -30000000) - (axis === "x" ? w.originX || 0 : w.originZ || 0) : w[(hi ? "max" : "min") + axis.toUpperCase()];
  const edge = (axis, v) => {
    const c = Math.max((lim(axis, false) ?? 0)+0.6, Math.min((lim(axis, true) ?? size)-0.6, e[axis]));
    if (c !== e[axis]) (e[axis] = c), (e[v] = 0);
  };
  edge("x", "vx");
  edge("z", "vz");
}
// The same arithmetic on locals: lo = (lower limit ?? 0) + 0.6, hi = (upper limit ?? size) - 0.6, c = max(lo, min(hi, v)), written back with the motion zeroed only when it differs.
function edgeClampFast(w, e, size) {
  let loX, hiX, loZ, hiZ;
  if (w.streaming) {
    const ox = w.originX || 0, oz = w.originZ || 0;
    loX = -30000000 - ox; hiX = 30000000 - ox; loZ = -30000000 - oz; hiZ = 30000000 - oz;
  } else {
    loX = w.minX; hiX = w.maxX; loZ = w.minZ; hiZ = w.maxZ;
  }
  const x = e.x, cx = Math.max((loX ?? 0)+0.6, Math.min((hiX ?? size)-0.6, x));
  if (cx !== x) (e.x = cx), (e.vx = 0);
  const z = e.z, cz = Math.max((loZ ?? 0)+0.6, Math.min((hiZ ?? size)-0.6, z));
  if (cz !== z) (e.z = cz), (e.vz = 0);
}
export function edgeClamp(w, e, size) {
  const mode = fast80.mode;
  if (mode === "off") return edgeClampReference(w, e, size);
  if (mode === "verify") {
    const c = { x: e.x, z: e.z, vx: e.vx, vz: e.vz };
    edgeClampReference(w, c, size);
    edgeClampFast(w, e, size);
    if (!Object.is(c.x, e.x) || !Object.is(c.z, e.z) || !Object.is(c.vx, e.vx) || !Object.is(c.vz, e.vz)) fail("edgeClamp");
    return;
  }
  edgeClampFast(w, e, size);
}

// ---- 4. step-block id tests ----
// origOf(id) -> toOriginal(id, 0)?.[0] (block-registry.js; MAP is a constant table, and for state {} the original id depends on the id alone). -1 for null.
const ORIG_UNSET = -2, origIds = new Int16Array(4096).fill(ORIG_UNSET);
export function originalIdOf(id, toOriginal) {
  const mode = fast80.mode;
  if (mode === "off" || !(id >= 0 && id < 4096 && Number.isInteger(id))) return toOriginal(id, 0)?.[0];
  let v = origIds[id];
  if (v === ORIG_UNSET) { const r = toOriginal(id, 0)?.[0]; v = origIds[id] = r === undefined || r === null ? -1 : r; }
  const out = v === -1 ? undefined : v;
  if (mode === "verify" && out !== toOriginal(id, 0)?.[0]) fail("originalIdOf"); // b81 mpperf81: no per-call `ref` closure
  return out;
}

