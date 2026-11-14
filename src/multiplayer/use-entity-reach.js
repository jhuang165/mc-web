// b70 mpclicks: NetHandlerPlayServer.processUseEntity (nh.a(ja), bytecode-read): the squared distance is Entity.getDistanceSqToEntity (mw.f: posX, posY, posZ of both, no eye offset),
// refused at 36.0 or more, and at 9.0 or more when EntityLivingBase.canEntityBeSeen (sv.p) fails: World.rayTraceBlocks (ahb.a(Vec, Vec), liquids ignored) from (posX, posY + getEyeHeight, posZ) of
// the player to the same point of the target. A sleeper's posY is minY + 0.2 and its eye height is still 1.62 (sleeper-eye.js). The target's eye height is its own (Entity.getEyeHeight is 0 by default).
import { rayTraceBlocks } from '../buckets.js';
import { serverPosY } from '../sleeper-eye.js';

const EYE = Math.fround(1.62);
/**
 * `p` is the server player (position = box minY, `sleeping`); `target` is { x, y, z, eye } with y = the target's posY and eye = its getEyeHeight (0 when it has none).
 * True when the click is within native reach.
 */
export function useEntityInReach(world, p, target) {
  const py = serverPosY(p.position.y, !!p.sleeping), dx = target.x - p.position.x, dy = target.y - py, dz = target.z - p.position.z;
  const d = dx * dx + dy * dy + dz * dz;
  if (d >= 36) return false;
  if (d < 9) return true;
  const seen = !rayTraceBlocks(world, [p.position.x, py + EYE, p.position.z], [target.x, target.y + (target.eye ?? 0), target.z], false, false);
  return seen;
}
