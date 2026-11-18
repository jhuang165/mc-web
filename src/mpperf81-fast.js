// Batch 81 mpperf81: fewer allocations in the server tick's move (entities.js moveEntity and its World.getCollidingBoundingBoxes block scan), found with heap sampling
// profiles of the dense pen, the 16-player spread field ("travel") and the pillar scenes (tools/bench-alloc81.mjs). Results are unchanged; only how they are computed.
// MC_MPPERF81=on (default) | off (reference paths) | verify (both on every call, throws on the first difference); tests set `fast81.mode`.
//   1. cellBoxesOf: the block-local collision boxes of a cell whose id alone decides them (world.js collisionBoxes for a full cube, a slab of fixed height, the hopper...)
//      from a per-id table, so the dispatch chain (blockBounds and its ~40 tests, a fresh [box] wrapper) runs once per id. Which ids qualify is found by running the real
//      cell function on a probe world that flags every read other than get() of the probed cell (any getMeta, neighbour read or other field means "not constant").
//   2. blockBoxes81: the cell scan (mpperf79-fast.js blockBoxes) writing into pooled 6-number arrays for moveEntity, which reads its box lists only during the call.
//   3. MoveScratch: moveEntity's working boxes (its own box, the start and flat copies, the swept query box) and the box list, one set per non-nested call.
//   4. noWaterIn: a pre-test for World.handleMaterialAcceleration (fluids.js waterAcceleration) on an entity box: when no cell of the scanned range is water the
//      reference returns { wet: false, push: [0, 0, 0] } without reading anything else, so the caller can skip building the boxes and the result.
//   5. lavaIn / burningIn: Entity.handleLavaMovement (fluids.js inLava) and World.isBoundingBoxBurning on the contracted box (block-collisions.js) on six numbers
//      instead of the entity box, the shrunk box and a cell-reader closure.
//   6. mob move hooks: EntityWorld.moveHooks / moveSteps / moveWith's start position, one record per (EntityWorld, entity) refreshed on every call instead of a
//      new object with four closures and an accessor (about 0.7 KB per mob move).
import { World, WATER, LAVA, FIRE } from "./world.js";
import { blockBoxes as blockBoxes79 } from "./mpperf79-fast.js";
import { waterAcceleration, entityWaterBox, inLava } from "./fluids.js";
import { boundingBoxBurning, contract } from "./fire.js";

export const fast81 = { mode: (typeof process !== "undefined" && process.env?.MC_MPPERF81) || "on" };
const fail = (what) => { throw new Error(`mpperf81 ${what} mismatch`); };
let WORLD_SOLID = null; // World.prototype.solid, read on first use (no import-order dependence)
const worldSolid = () => WORLD_SOLID ??= World.prototype.solid;

// ---- 1. per-id constant cell boxes ----
// consts[id]: undefined = not probed, null = depends on more than the id (or has a side effect), else an array of block-local boxes (never handed out).
const consts = new Array(4096);
// Side effects the probe cannot see: the brewing stand's collision pass flag (world.js collisionBoxes -> brewing.js noteBrewingCollisionPass).
const SIDE_EFFECT_IDS = new Set([134]);
function probeOnce(id, cellFn, px, py, pz) {
  let bad = false;
  const target = {
    get: (x, y, z) => { if (x !== px || y !== py || z !== pz) bad = true; return id; },
    solid(x, y, z) { return worldSolid().call(this, x, y, z); },
  };
  const probe = new Proxy(target, {
    get(t, k, r) { if (!Object.hasOwn(t, k)) { bad = true; return undefined; } return Reflect.get(t, k, r); },
    has(t, k) { bad = true; return k in t; },
    set() { bad = true; return true; },
  });
  let out;
  try { out = cellFn(probe, px, py, pz); } catch { return null; }
  if (bad || !Array.isArray(out)) return null;
  for (const b of out) if (!Array.isArray(b) || b.length !== 6 || !b.every((v) => typeof v === "number")) return null;
  return out.map((b) => b.slice());
}
const sameBoxes = (a, b) => a.length === b.length && a.every((r, k) => r.every((v, j) => Object.is(v, b[k][j])));
// The constant boxes of `id` (block-local), or null. Two probe cells: the answer must not depend on the coordinates either.
export function cellBoxesOf(id, cellFn) {
  let c = consts[id];
  if (c !== undefined) return c;
  c = null;
  if (Number.isInteger(id) && id > 0 && id < 4096 && !SIDE_EFFECT_IDS.has(id)) {
    const a = probeOnce(id, cellFn, 0, 64, 0), b = a && probeOnce(id, cellFn, 37, 5, -21);
    if (a && b && sameBoxes(a, b)) c = a;
  }
  return consts[id] = c;
}
export const resetCellBoxes = () => consts.fill(undefined);

// ---- 2. the block scan with constant cells and pooled boxes ----
export class BoxPool {
  constructor() { this.boxes = []; this.n = 0; }
  reset() { this.n = 0; }
  box(x0, y0, z0, x1, y1, z1) {
    let b = this.boxes[this.n];
    if (b === undefined) b = this.boxes[this.n] = [0, 0, 0, 0, 0, 0];
    this.n++;
    b[0] = x0; b[1] = y0; b[2] = z0; b[3] = x1; b[4] = y1; b[5] = z1;
    return b;
  }
}
function blockBoxesFast(world, b, out, cellFn, pool) {
  const x1 = Math.floor(b[3] + 1), y1 = Math.floor(b[4] + 1), z1 = Math.floor(b[5] + 1);
  const b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3], b4 = b[4], b5 = b[5];
  for (let bx = Math.floor(b0); bx < x1; bx++)
    for (let by = Math.floor(b1) - 1; by < y1; by++)
      for (let bz = Math.floor(b2); bz < z1; bz++) {
        const id = world.get(bx, by, bz);
        if (id === 0) continue;
        const local = cellBoxesOf(id, cellFn) ?? cellFn(world, bx, by, bz);
        for (let k = 0; k < local.length; k++) {
          const l = local[k], a = l[0], c = l[1], d = l[2], g = l[3], h = l[4], i = l[5];
          if (bx + g > b0 && bx + a < b3 && by + h > b1 && by + c < b4 && bz + i > b2 && bz + d < b5)
            out.push(pool ? pool.box(bx + a, by + c, bz + d, bx + g, by + h, bz + i) : [bx + a, by + c, bz + d, bx + g, by + h, bz + i]);
        }
      }
  return out;
}
// Appends the cell boxes overlapping `b` to `out`, as mpperf79-fast.js blockBoxes does; with `pool` the boxes are the pool's arrays (valid until its next reset).
export function blockBoxes81(world, b, out, cellFn, pool = null) {
  const mode = fast81.mode;
  if (mode === "off" || typeof world.get !== "function" || world.solid !== worldSolid()) return blockBoxes79(world, b, out, cellFn);
  const start = out.length;
  blockBoxesFast(world, b, out, cellFn, pool);
  if (mode === "verify") {
    const ref = blockBoxes79(world, b, [], cellFn);
    if (ref.length !== out.length - start) fail("blockBoxes");
    for (let k = 0; k < ref.length; k++) for (let j = 0; j < 6; j++) if (!Object.is(ref[k][j], out[start + k][j])) fail("blockBoxes");
  }
  return out;
}

// ---- 3. moveEntity's scratch ----
// One set for the outermost moveEntity call; a nested call (a hook that moves another entity) finds it taken and allocates as before.
export class MoveScratch {
  constructor() { this.pool = new BoxPool(); this.list = []; this.bb = [0, 0, 0, 0, 0, 0]; this.start = [0, 0, 0, 0, 0, 0]; this.flat = [0, 0, 0, 0, 0, 0]; this.query = [0, 0, 0, 0, 0, 0]; this.busy = false; }
  // The box list for one collisionBoxes call: the pool and the list are reused (the previous list is dead by then).
  freshList() { this.pool.reset(); this.list.length = 0; return this.list; }
}
const SCRATCH = new MoveScratch();
export function takeMoveScratch() {
  if (fast81.mode === "off" || SCRATCH.busy) return null;
  SCRATCH.busy = true;
  return SCRATCH;
}
export function releaseMoveScratch(s) { s.busy = false; s.list.length = 0; }
export const copyBox = (to, from) => { to[0] = from[0]; to[1] = from[1]; to[2] = from[2]; to[3] = from[3]; to[4] = from[4]; to[5] = from[5]; return to; };
// moveEntity's `grow` (AxisAlignedBB.addCoord) into `out`.
export function growInto(out, box, gx, gy, gz) {
  out[0] = gx < 0 ? box[0] + gx : box[0]; out[1] = gy < 0 ? box[1] + gy : box[1]; out[2] = gz < 0 ? box[2] + gz : box[2];
  out[3] = gx > 0 ? box[3] + gx : box[3]; out[4] = gy > 0 ? box[4] + gy : box[4]; out[5] = gz > 0 ? box[5] + gz : box[5];
  return out;
}
// verify helper: two boxes (or null) hold the same numbers.
export function checkSameBox(a, b, what) {
  if (fast81.mode !== "verify") return;
  if ((a === null) !== (b === null)) fail(what);
  if (a !== null) for (let j = 0; j < 6; j++) if (!Object.is(a[j], b[j])) fail(what);
}

// ---- 4. water pre-test ----
// fluids.js waterAcceleration scans floor(x0)..floor(x1 + 1) (exclusive), likewise y and z, of the box; its first read of each cell is get() === WATER and nothing
// else is read for other cells. With no water cell the answer is { wet: false, push: [0, 0, 0] }. `box` is the entityWaterBox of [minX..maxZ] (the same arithmetic).
export function noWaterIn(world, minX, minY, minZ, maxX, maxY, maxZ) {
  const x0 = minX + 0.001, y0 = minY + 0.4000000059604645 + 0.001, z0 = minZ + 0.001, x1 = maxX - 0.001, y1 = maxY - 0.4000000059604645 - 0.001, z1 = maxZ - 0.001;
  const ax = Math.floor(x0), bx = Math.floor(x1 + 1), ay = Math.floor(y0), by = Math.floor(y1 + 1), az = Math.floor(z0), bz = Math.floor(z1 + 1);
  for (let x = ax; x < bx; x++) for (let y = ay; y < by; y++) for (let z = az; z < bz; z++) if (world.get(x, y, z) === WATER) return false;
  return true;
}
// True when the entity box [minX..maxZ] has no water cell in handleWaterMovement's range (the caller skips waterAcceleration: not wet, no push); false means "ask the reference".
export function dryBox(world, minX, minY, minZ, maxX, maxY, maxZ) {
  const mode = fast81.mode;
  if (mode === "off" || !noWaterIn(world, minX, minY, minZ, maxX, maxY, maxZ)) return false;
  if (mode === "verify") {
    const r = waterAcceleration(world, entityWaterBox([minX, minY, minZ, maxX, maxY, maxZ]));
    if (r.wet !== false || !Object.is(r.push[0], 0) || !Object.is(r.push[1], 0) || !Object.is(r.push[2], 0)) fail("dryBox");
  }
  return true;
}

// ---- 5. lava and burning box tests ----
// fluids.js inLava(world, [minX..maxZ]): liquidInBox(entityLavaBox(box), LAVA), the same arithmetic on locals.
export function lavaIn(world, minX, minY, minZ, maxX, maxY, maxZ) {
  const mode = fast81.mode;
  if (mode === "off") return inLava(world, [minX, minY, minZ, maxX, maxY, maxZ]);
  const x0 = minX + 0.10000000149011612, y0 = minY + 0.4000000059604645, z0 = minZ + 0.10000000149011612, x1 = maxX - 0.10000000149011612, y1 = maxY - 0.4000000059604645, z1 = maxZ - 0.10000000149011612;
  const ax = Math.floor(x0), bx = Math.floor(x1 + 1), ay = Math.floor(y0), by = Math.floor(y1 + 1), az = Math.floor(z0), bz = Math.floor(z1 + 1);
  let v = false;
  scan: for (let x = ax; x < bx; x++) for (let y = ay; y < by; y++) for (let z = az; z < bz; z++) if (world.get(x, y, z) === LAVA) { v = true; break scan; }
  if (mode === "verify" && v !== inLava(world, [minX, minY, minZ, maxX, maxY, maxZ])) fail("lavaIn");
  return v;
}
// block-collisions.js: boundingBoxBurning((x, y, z) => world.get(x, y, z), contract(box)).
export function burningIn(world, box) {
  const mode = fast81.mode;
  if (mode === "off") return boundingBoxBurning((x, y, z) => world.get(x, y, z), contract(box));
  const e = 0.001, x1 = Math.floor(box[3] - e + 1), y1 = Math.floor(box[4] - e + 1), z1 = Math.floor(box[5] - e + 1);
  let v = false;
  scan: for (let x = Math.floor(box[0] + e); x < x1; x++)
    for (let y = Math.floor(box[1] + e); y < y1; y++)
      for (let z = Math.floor(box[2] + e); z < z1; z++) {
        const b = world.get(x, y, z);
        if (b === FIRE || b === LAVA) { v = true; break scan; }
      }
  if (mode === "verify" && v !== boundingBoxBurning((x, y, z) => world.get(x, y, z), contract(box))) fail("burningIn");
  return v;
}

// ---- 6. per-entity move records ----
// records: entity -> { owner, rec } where rec is what `make(owner, e)` built (entities.js); a record made by another EntityWorld is rebuilt.
const records = new WeakMap();
export function moveRecord(owner, e, make) {
  const r = records.get(e);
  if (r !== undefined && r.owner === owner) return r;
  const n = make(owner, e);
  n.owner = owner;
  records.set(e, n);
  return n;
}
