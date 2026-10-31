// BlockLadder (als, original id 65) and EntityLivingBase.isOnLadder /
// moveEntityWithHeading's ladder branch (sv.h_ / sv.e(FF)), Minecraft Java 1.7.10.
// Checked against the unchanged classes by tools/verify-ladders.mjs.
import { LADDER, normalCube } from "./world.js";

const f = Math.fround;
// BlockLadder.func_149797_b: a 0.125 plate against the wall the metadata names
// (2: on the block at z+1, 3: z-1, 4: x+1, 5: x-1). The collision and selection
// boxes are the same; metadata 0 and 1 never come out of placement.
const T = 0.125;
export const LADDER_BOUNDS = {
  2: [0, 0, 1 - T, 1, 1, 1],
  3: [0, 0, 0, 1, 1, T],
  4: [1 - T, 0, 0, 1, 1, 1],
  5: [0, 0, 0, T, 1, 1],
};
export const ladderBounds = (meta) => LADDER_BOUNDS[meta] || [0, 0, 0, 1, 1, 1];
// The wall behind each metadata.
const WALL = { 2: [0, 0, 1], 3: [0, 0, -1], 4: [1, 0, 0], 5: [-1, 0, 0] };
const cube = (world, x, y, z, [dx, dy, dz]) => normalCube(world.get(x + dx, y + dy, z + dz));

// canPlaceBlockAt: a normal cube on any horizontal side.
export function canPlaceLadder(world, x, y, z) {
  return [5, 4, 3, 2].some((m) => cube(world, x, y, z, WALL[m]));
}
// onBlockPlaced(side = the clicked face, 0 down .. 5 east): each test runs while the metadata
// is still 0 or matches the clicked side, so the last matching wall in 2, 3, 4, 5 order wins.
export function placedLadderMeta(world, x, y, z, side) {
  let meta = 0;
  for (const m of [2, 3, 4, 5]) if ((meta === 0 || side === m) && cube(world, x, y, z, WALL[m])) meta = m;
  return meta;
}
// onNeighborBlockChange: a ladder whose wall is no longer a normal cube drops itself.
export function ladderSupported(world, x, y, z, meta = world.getMeta(x, y, z)) {
  return !!WALL[meta] && cube(world, x, y, z, WALL[meta]);
}
// The clicked face from the placement cell's offset to the clicked block.
export function clickedSide(block, adjacent) {
  const d = [0, 1, 2].map((i) => adjacent[i] - block[i]);
  return d[1] < 0 ? 0 : d[1] > 0 ? 1 : d[2] < 0 ? 2 : d[2] > 0 ? 3 : d[0] < 0 ? 4 : 5;
}
// EntityLivingBase.isOnLadder: the block at floor(posX), floor(boundingBox.minY), floor(posZ)
// is a ladder (or vines, not in this build). EntitySpider overrides it with its wall flag.
export const isOnLadder = (world, x, minY, z) => world.get(Math.floor(x), Math.floor(minY), Math.floor(z)) === LADDER;
// Before the move: horizontal motion clamped to 0.15F, falls to -0.15 (0 for a sneaking
// EntityPlayer), fallDistance reset. `m` holds the motion under keys x/y/z.
export function ladderClamp(m, sneakingPlayer, keys = ["x", "y", "z"]) {
  const lim = f(0.15), [kx, ky, kz] = keys;
  m[kx] = Math.max(-lim, Math.min(lim, m[kx]));
  m[kz] = Math.max(-lim, Math.min(lim, m[kz]));
  if (m[ky] < -0.15) m[ky] = -0.15;
  if (sneakingPlayer && m[ky] < 0) m[ky] = 0;
}
// After the move: pushing into something while on a ladder climbs at 0.2.
export const LADDER_CLIMB = 0.2;
// Entity.moveEntity: the vertical part of a move counts towards the step distance only
// when the block 0.2 below the feet is a ladder.
export const countsVertical = (world, x, y, z) => world.get(Math.floor(x), Math.floor(y - 0.2), Math.floor(z)) === LADDER;
