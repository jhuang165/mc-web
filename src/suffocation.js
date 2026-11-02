// Suffocation of 1.7.10 (public/research/combat.md): Entity.isEntityInsideOpaqueBlock [sa.aa()]
// and the hit EntityLivingBase.onEntityUpdate [sv.C] makes of it, attackEntityFrom(DamageSource.inWall, 1).
// suffocation-reference.json holds the original's results.
import { HEIGHT, normalCube } from "./world.js";
const f = Math.fround;
// EntityPlayerMP.getEyeHeight [mw.g()F] is 1.62F and its posY is the feet: singleplayer damage happens on
// the server's player, so the sneaking eye drop (a client-side ySize) does not move the samples.
export const PLAYER_EYE = f(1.62);
// EntityLivingBase.getEyeHeight [sv.g()F]: height * 0.85F (a float).
export const mobEyeHeight = (height) => f(f(height) * f(0.85));
// Entity.isEntityInsideOpaqueBlock: the eight corners of a box width * 0.8 wide and 0.1 tall around
// (x, y + eyeHeight, z), each sampled as Block.isNormalCube of its cell (world.js normalCube: leaves,
// glass, water, partial blocks, plants, TNT and so on do not count). Every offset is a float
// product, added to the double position. `world.get` is the block id of a cell; above or below the
// column nothing is solid.
export function insideOpaqueBlock(world, x, y, z, width, eyeHeight) {
  const w = f(width), height = world.height ?? HEIGHT;
  for (let i = 0; i < 8; i++) {
    const dx = f(f(f((i >> 0) % 2 - 0.5) * w) * f(0.8)),
      dy = f(f((i >> 1) % 2 - 0.5) * f(0.1)),
      dz = f(f(f((i >> 2) % 2 - 0.5) * w) * f(0.8));
    const cy = Math.floor(y + eyeHeight + dy);
    if (cy < 0 || cy >= height) continue;
    if (normalCube(world.get(Math.floor(x + dx), cy, Math.floor(z + dz)))) return true;
  }
  return false;
}
