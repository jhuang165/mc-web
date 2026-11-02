// BlockTorch (aoc, original id 50 "torch"), Minecraft Java 1.7.10: placement metadata, support
// and the selection box per metadata. Checked against the unchanged class by
// tools/verify-fence-rail.mjs (public/research/fence-rail-reference.json, "torch" records).
// Metadata: 1 on the block at x-1 (pointing east), 2 at x+1, 3 at z-1, 4 at z+1, 5 standing.
// The port stores a standing torch as 0 (older saves only had standing torches); 0 and 5 read the
// same everywhere, and block-registry.js writes both as original metadata 5.
import { TORCH, FENCE, normalCube } from "./world.js";
import { solidTop } from "./rails.js";

const f = Math.fround;
// BlockTorch.collisionRayTrace's setBlockBounds per metadata (f = 0.15F wall, 0.1F standing).
export const TORCH_BOUNDS = {
  1: [0, f(0.2), f(0.35), f(0.3), f(0.8), f(0.65)],
  2: [f(0.7), f(0.2), f(0.35), 1, f(0.8), f(0.65)],
  3: [f(0.35), f(0.2), 0, f(0.65), f(0.8), f(0.3)],
  4: [f(0.35), f(0.2), f(0.7), f(0.65), f(0.8), 1],
  5: [f(0.4), 0, f(0.4), f(0.6), f(0.6), f(0.6)],
};
export const torchBounds = (meta) => [...(TORCH_BOUNDS[meta] || TORCH_BOUNDS[5])];
export const isWallTorch = (meta) => meta >= 1 && meta <= 4;
// The supporting cell's offset per metadata (5 and the port's 0: below).
const WALL = { 1: [-1, 0, 0], 2: [1, 0, 0], 3: [0, 0, -1], 4: [0, 0, 1] };
export const torchSupportOffset = (meta) => WALL[meta] || [0, -1, 0];

const GLASS = 9;
// BlockTorch.func_150107_m: a solid top surface, or a fence, nether fence, glass or cobblestone
// wall (only the fence and glass exist here).
export function torchCanStandOn(world, x, y, z) {
  if (solidTop(world, x, y, z)) return true;
  const b = world.get(x, y, z);
  return b === FENCE || b === GLASS;
}
const cube = (world, x, y, z) => normalCube(world.get(x, y, z));
// BlockTorch.canPlaceBlockAt: a normal cube on any horizontal side, or something to stand on.
export function torchCanPlace(world, x, y, z) {
  return cube(world, x - 1, y, z) || cube(world, x + 1, y, z) || cube(world, x, y, z - 1) || cube(world, x, y, z + 1) || torchCanStandOn(world, x, y - 1, z);
}
// BlockTorch.onBlockPlaced (side: 0 bottom, 1 top, 2 north, 3 south, 4 west, 5 east).
export function torchPlacedMeta(world, x, y, z, side) {
  if (side === 1 && torchCanStandOn(world, x, y - 1, z)) return 5;
  if (side === 2 && cube(world, x, y, z + 1)) return 4;
  if (side === 3 && cube(world, x, y, z - 1)) return 3;
  if (side === 4 && cube(world, x + 1, y, z)) return 2;
  if (side === 5 && cube(world, x - 1, y, z)) return 1;
  return 0;
}
// BlockTorch.onBlockAdded: metadata 0 takes the first supporting side; then func_150109_e drops a
// torch that cannot be placed. Returns the original metadata 1-5, or -1 when it drops.
export function torchAddedMeta(world, x, y, z, meta) {
  if (meta === 0) {
    if (cube(world, x - 1, y, z)) meta = 1;
    else if (cube(world, x + 1, y, z)) meta = 2;
    else if (cube(world, x, y, z - 1)) meta = 3;
    else if (cube(world, x, y, z + 1)) meta = 4;
    else if (torchCanStandOn(world, x, y - 1, z)) meta = 5;
  }
  return torchCanPlace(world, x, y, z) ? meta : -1;
}
// ItemBlock placement of a torch on `side`: the metadata the port stores (standing as 0), or -1
// when BlockTorch.canPlaceBlockAt fails (the item is kept).
export function placedTorchMeta(world, x, y, z, side) {
  if (!torchCanPlace(world, x, y, z)) return -1;
  const meta = torchAddedMeta(world, x, y, z, torchPlacedMeta(world, x, y, z, side));
  return meta === 5 ? 0 : meta;
}
// BlockTorch.func_150108_b (onNeighborBlockChange): kept while it can be placed at all and the
// block its metadata names still holds it.
export function torchSupported(world, x, y, z, meta = world.getMeta(x, y, z)) {
  if (!torchCanPlace(world, x, y, z)) return false;
  if (meta === 1) return cube(world, x - 1, y, z);
  if (meta === 2) return cube(world, x + 1, y, z);
  if (meta === 3) return cube(world, x, y, z - 1);
  if (meta === 4) return cube(world, x, y, z + 1);
  if (meta === 5 || meta === 0) return torchCanStandOn(world, x, y - 1, z);
  return true;
}

// Torches in a running world: a neighbour change drops an unsupported torch (dropBlockAsItem then
// setBlockToAir, no particles). `drop(stacks, x, y, z)` spawns items; `apply(changes)` receives
// [x, y, z, old, new] entries to render.
export class Torches {
  constructor(world, { drop = () => {}, apply = () => {} } = {}) {
    this.world = world;
    this.drop = drop;
    this.apply = apply;
  }
  watch() {
    const next = this.world.onChange;
    this.world.onChange = (x, y, z, old, now) => {
      next?.(x, y, z, old, now);
      for (const [dx, dy, dz] of [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]]) this.neighbourChanged(x + dx, y + dy, z + dz);
    };
    return this;
  }
  neighbourChanged(x, y, z) {
    const w = this.world;
    if (w.get(x, y, z) !== TORCH || torchSupported(w, x, y, z)) return;
    this.drop([{ id: TORCH, count: 1, damage: 0 }], x, y, z);
    w.set(x, y, z, 0);
    this.apply([[x, y, z, TORCH, 0]]);
  }
}
