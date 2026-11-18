// Batch 81 mpcopies81: which dragons' parts EntityRenderer.getMouseOver can see. Bytecode-read (javap -c -p, unchanged 1.7.10 jar):
//  - getMouseOver (blt.a(F)): the reach is 6 with extendedReach (creative), else min(getBlockReachDistance, 3) = 3; the entity list is
//    World.getEntitiesWithinAABBExcludingEntity(viewer, viewer.boundingBox.addCoord(look * reach).expand(1, 1, 1)). Only entities whose
//    canBeCollidedWith is true are ray-tested: the dragon body (xa.R()) is false, its parts (wy.R()) true.
//  - The world query (ahb.a(sa, azt, sj)) walks the chunk columns floor((minX - 2) / 16)..floor((maxX + 2) / 16) (and z alike), and each
//    chunk (apx.a(sa, azt, List, sj)) the sections floor((minY - 2) / 16)..floor((maxY + 2) / 16), clamped to 0..15. An entity there is
//    listed when its own boundingBox intersects the query box (strict intersectsWith), and its getParts() are listed ONLY in that case.
//    The parts (wy) are never added to a chunk themselves.
// So a part is aimed at only while the body's box meets the query box and the body stands in a listed chunk column and section. During
// the death the body rises 0.1 a tick (moveEntity 0, 0.1, 0 for 200 ticks) while the parts stay frozen (xa.e returns before updating
// them), so once the body leaves the query the frozen parts can no longer be picked.
const PLAYER_HALF = 0.3, PLAYER_HEIGHT = 1.8, EYE = 1.62; // EntityPlayer setSize(0.6F, 1.8F); the box's minY is the eye minus yOffset 1.62

// The query box of getMouseOver for a viewer whose eye is at `origin`, looking along unit `dir`, with the full reach (3 or 6).
export function mouseOverBox(origin, dir, reach) {
  const b = [origin.x - PLAYER_HALF, origin.y - EYE, origin.z - PLAYER_HALF, origin.x + PLAYER_HALF, origin.y - EYE + PLAYER_HEIGHT, origin.z + PLAYER_HALF];
  const d = [dir.x * reach, dir.y * reach, dir.z * reach];
  for (let i = 0; i < 3; i++) { if (d[i] < 0) b[i] += d[i]; else b[i + 3] += d[i]; } // AxisAlignedBB.addCoord
  for (let i = 0; i < 3; i++) { b[i] -= 1; b[i + 3] += 1; } // expand(1, 1, 1)
  return b;
}

const clampSection = s => Math.max(0, Math.min(15, s));
// True when the dragon `e` (its body box `e.dragon.bb`) is listed by the query box `q`, so its parts may be ray-tested.
// A dragon without a body box (a bare stand-in) is not gated.
export function dragonListed(e, q) {
  const bb = e?.dragon?.bb;
  if (!bb || !q) return true;
  const x = (bb[0] + bb[3]) / 2, y = bb[1], z = (bb[2] + bb[5]) / 2; // the position read back from the box (moveEntity), yOffset 0
  const cx = Math.floor(x / 16), cz = Math.floor(z / 16), cy = clampSection(Math.floor(y / 16)); // Chunk.addEntity's section, clamped
  if (cx < Math.floor((q[0] - 2) / 16) || cx > Math.floor((q[3] + 2) / 16) || cz < Math.floor((q[2] - 2) / 16) || cz > Math.floor((q[5] + 2) / 16)) return false;
  if (cy < clampSection(Math.floor((q[1] - 2) / 16)) || cy > clampSection(Math.floor((q[4] + 2) / 16))) return false;
  return bb[3] > q[0] && bb[0] < q[3] && bb[4] > q[1] && bb[1] < q[4] && bb[5] > q[2] && bb[2] < q[5]; // AxisAlignedBB.intersectsWith
}
