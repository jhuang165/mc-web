// BlockFence (akz, original id 85 "fence"), Minecraft Java 1.7.10: connections, collision,
// selection and the RenderBlocks.renderBlockFence boxes. Checked against the unchanged classes by
// tools/verify-fence-rail.mjs (public/research/fence-rail-reference.json).
import { FENCE, normalCube } from "./world.js";
import { NETHER_FENCE } from "./nether-blocks.js";

// Both fence blocks (the oak fence and the nether brick fence, internal 154) share every shape rule.
export const isFence = (b) => b === FENCE || b === NETHER_FENCE;

// BlockFence.canConnectFenceTo (akz.e): another fence or a fence gate, else a block whose material
// is opaque, that renders as a normal block, and is not Material.gourd. There is no fence gate
// here. Gourds (pumpkin/melon) are explicitly excluded; fence.test.js replays the predicate.
// `self` is the fence asking: BlockFence.canConnectFenceTo accepts only its own block (and gates), so the nether brick fence and the oak fence do not join.
export const fenceConnectsTo = (b, self = FENCE) => b === self || (b!==67&&b!==81&&(normalCube(b)||b===104||b===123)); // 123: the block of redstone renders as a normal block (Material.iron is opaque) but is not a normalCube (it powers); 104: the end portal frame is opaque material that renders as a normal block (fence-rail-reference.json)

// Neighbour mask: bit 0 z-1 (north), bit 1 z+1 (south), bit 2 x-1 (west), bit 3 x+1 (east).
export function fenceMask(world, x, y, z) {
  const self = world.get(x, y, z) === NETHER_FENCE ? NETHER_FENCE : FENCE;
  const c = (dx, dz) => fenceConnectsTo(world.get(x + dx, y, z + dz), self);
  return (c(0, -1) ? 1 : 0) | (c(0, 1) ? 2 : 0) | (c(-1, 0) ? 4 : 0) | (c(1, 0) ? 8 : 0);
}

const LO = 0.375, HI = 0.625;
// BlockFence.addCollisionBoxesToList: the z arm (when north or south connects) first, then the
// x arm (when west or east connects, or neither z side does), each 1.5 high.
export function fenceCollisionBoxes(mask) {
  const n = mask & 1, s = mask & 2, w = mask & 4, e = mask & 8, out = [];
  if (n || s) out.push([LO, 0, n ? 0 : LO, HI, 1.5, s ? 1 : HI]);
  if (w || e || !(n || s)) out.push([w ? 0 : LO, 0, LO, e ? 1 : HI, 1.5, HI]);
  return out;
}
// setBlockBoundsBasedOnState: the union of the arms, 1 high (selection box and Block bounds).
export function fenceBounds(mask) {
  const n = mask & 1, s = mask & 2, w = mask & 4, e = mask & 8;
  return [w ? 0 : LO, 0, n ? 0 : LO, e ? 1 : HI, 1, s ? 1 : HI];
}
// One-box callers (entity movement takes the union of a cell's boxes): the union, 1.5 high.
export function fenceCollisionUnion(mask) {
  const b = fenceBounds(mask);
  b[4] = 1.5;
  return b;
}

// RenderBlocks.renderBlockFence (blm.a(akz, III)): the post, then the upper (0.75-0.9375) and lower
// (0.375-0.5625) bars along x when west or east connects and along z when north or south does.
// Each bar starts at the post's middle (7/16 - 9/16) and reaches the connected side.
export function fenceRenderBoxes(mask) {
  const n = mask & 1, s = mask & 2, w = mask & 4, e = mask & 8;
  const out = [[LO, 0, LO, HI, 1, HI]], a = 0.4375, b = 0.5625;
  for (const [y0, y1] of [[0.75, 0.9375], [0.375, 0.5625]]) {
    if (w || e) out.push([w ? 0 : a, y0, a, e ? 1 : b, y1, b]);
    if (n || s) out.push([a, y0, n ? 0 : a, b, y1, s ? 1 : b]);
  }
  return out;
}
// RenderBlocks.renderBlockAsItem for render type 11: two posts and two bars along z.
export const FENCE_ITEM_BOXES = [
  [0.375, 0, 0, 0.625, 1, 0.25],
  [0.375, 0, 0.75, 0.625, 1, 1],
  [0.4375, 0.8125, -0.125, 0.5625, 0.9375, 1.125],
  [0.4375, 0.3125, -0.125, 0.5625, 0.4375, 1.125],
];
