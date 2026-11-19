// Entity.moveEntity (sa.d, bytecode-read, b71 steps71): the block a step is judged on. The cell is
// floor(posX), floor(posY - 0.2 - yOffset), floor(posZ); when the block one cell lower has render type 11 (fence),
// 32 (wall) or 21 (fence gate) that lower block replaces it, whatever the upper cell holds (the replacement is not
// limited to air). The cell coordinates stay the upper ones. A ladder test (vertical motion counts) and the air test
// (no step) use the replaced block; Block.onEntityWalking is the replaced block's, so a fence swallows an ore's touch.
import { toOriginal } from "./block-registry.js";
import { fast84, fail84 } from "./mpperf84-fast.js"; // b84 mpperf84
import { originalIdOf } from "./mpperf80-fast.js"; // b80 mpperf80: toOriginal(id, 0)[0] through a per-id table

const FENCE_LIKE = new Set([85, 113, 139, 107]); // BlockFence (render type 11), BlockWall (32), BlockFenceGate (21)
const LADDER_ORIGINAL = 65; // Blocks.ladder; vines do not count (ajn.ap is the ladder only)

export const isFenceLike = (id) => !!id && FENCE_LIKE.has(originalIdOf(id, toOriginal));

// {x, y, z, id, below, replaced, ladder}: `y` is posY - yOffset (the feet less ySize for the player, the feet for a mob).
export function stepBlock(world, px, y, pz) {
  const x = Math.floor(px), cy = Math.floor(y - 0.2), z = Math.floor(pz);
  let id = world.get(x, cy, z) || 0;
  const lower = world.get(x, cy - 1, z) || 0;
  const replaced = isFenceLike(lower);
  if (replaced) id = lower;
  return { x, y: cy, z, id, replaced, ladder: !replaced && originalIdOf(id, toOriginal) === LADDER_ORIGINAL };
}
// b84 mpperf84: stepBlock written into `out` (a caller scratch read at once); MC_MPPERF84=off allocates as before.
export function stepBlockInto(world, px, y, pz, out) {
  const mode = fast84.mode;
  if (mode === "off") return stepBlock(world, px, y, pz);
  const x = Math.floor(px), cy = Math.floor(y - 0.2), z = Math.floor(pz);
  let id = world.get(x, cy, z) || 0;
  const lower = world.get(x, cy - 1, z) || 0;
  const replaced = isFenceLike(lower);
  if (replaced) id = lower;
  out.x = x; out.y = cy; out.z = z; out.id = id; out.replaced = replaced; out.ladder = !replaced && originalIdOf(id, toOriginal) === LADDER_ORIGINAL;
  if (mode === "verify") {
    const ref = stepBlock(world, px, y, pz);
    if (ref.x !== out.x || ref.y !== out.y || ref.z !== out.z || ref.id !== out.id || ref.replaced !== out.replaced || ref.ladder !== out.ladder) fail84("stepBlockInto");
  }
  return out;
}
