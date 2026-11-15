// b75 mpplayerfx75: EntityPlayerMP.onDeath on the dedicated server throws the body (death-throw.js: motionY 0.1, motionX/Z -cos/-sin of attackedAtYaw + rotationYaw, times 0.1).
// Natively the client player keeps its own motion and gets the throw by S12 (setBeenAttacked sets velocityChanged inside attackEntityFrom; EntityTrackerEntry.func_151261_b /
// `my.a(List)` ends with `if (entity.velocityChanged) { sendPacketToAllAssociatedPlayers(S12), velocityChanged = false }`, and `my.b(ft)` also sends to the player himself;
// bytecode-read, 1.7.10 jar). Here the server moves a dead player with idle input and the position stream is what every client (owner and viewers) follows, so putting the
// motion on the server's player is the S12 for everybody: the owner's camera and the other viewers' copies both see the body fly. Drowning is the one source that does not call
// setBeenAttacked (`if (source != DamageSource.drown) setBeenAttacked()`), so no S12 follows it: the body keeps the motion it had.
import { deathThrow } from '../death-throw.js';

export const NO_THROW = new Set(['drowning']);

// `p`: the server player ({ survival, position, yaw, velocity }); returns the motion applied, or null. Also empties the knock queue (onDeath overwrites the motion).
export function applyDeathThrow(p, random = Math.random) {
  const s = p.survival;
  if (s.knockQueue) s.knockQueue.length = 0;
  if (NO_THROW.has(s.lastDamage)) return null;
  const t = deathThrow(s.attackedAt, p.position, 180 - (p.yaw * 180) / Math.PI, random); // the port's yaw is PI - Java yaw in radians
  Object.assign(p.velocity, t);
  return t;
}
