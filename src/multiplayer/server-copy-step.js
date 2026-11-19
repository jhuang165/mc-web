// b82 mpplace82: the dedicated server's own copy of each player (EntityPlayerMP's motion and onGround, apart from the client's). The port's server
// moves the player from the client's input (movePlayer), which stands for the client's move and the C03's addMovementStat; this is the move
// EntityPlayerMP.onUpdateEntity (mw.i) makes before processPlayer applies the packet (server-copy-stat.js has the bytecode trail), with its charge.
//   before(p, controls, world)  before movePlayer: the copy steps from the accepted position on its own motion (entities.js serverCopyMove: the flow
//                               push, the 0.005 snap, moveEntityWithHeading with no input and stepHeight 0, a flier's motionY * 0.6) and charges it.
//   after(p, from)              after movePlayer: processPlayer's jump rule (`if (mw.D && !jd.i() && d15 > 0) mw.bj()`, the copy's onGround from its
//                               own step, the packet's onGround, the packet's dy) gives the copy EntityLivingBase.jump's motion (0.42F, Jump Boost,
//                               the sprint push; EntityPlayer.jump's stat and exhaustion are movePlayer's, charged once), then `mw.D = jd.i()`.
// Knockback reaches the copy through `survival.serverPlayer` (player-knockback.js queueKnockBack / queueVelocity, at the hit, as on the integrated
// server). Dead players take no copy step here.
// b83 attack83: processPlayer's other two branches (nh.a(jd), bytecode-read). Riding (offsets 94-300): updateRiderPosition, `mw.D = jd.i()` (offset 184) BEFORE mw.i()
// (191), then the position is put back on the seat and the mount's updateRiderPosition / updateMountedMovingPlayer follow; EntityPlayer.addMovementStat (yz.k) returns
// at once for a rider, so the copy's own move charges nothing (the mounted stat stays the mount's). Sleeping (301-359): isPlayerSleeping -> mw.i() (315) on the 0.2 x 0.2
// box of sleepInBedAt (EntityPlayer.isMovementBlocked only zeroes the input), then the copy goes back to the last accepted position; onGround is the copy's own.
// Both keep the motion the move left, as the walking branch does.
import { serverCopyMove } from '../entities.js';
import { chargeServerCopy } from '../server-copy-stat.js';
import { JUMP_MOTION, sprintJumpPush } from '../player-movement.js';

const f = Math.fround;
const W = f(0.6), H = f(1.8), SLEEP = f(0.2);

/** The server copy of player `p`, made on first use; also `p.survival.serverPlayer`, so the hits' knockback adds to its motion at once. */
export function serverCopyOf(p) {
  let c = p.serverCopy;
  if (!c) {
    c = p.serverCopy = { motion: { x: 0, y: 0, z: 0 }, onGround: !!p.grounded, inWeb: false, sneaking: false, flying: false, riding: false, x: 0, y: 0, z: 0 };
  }
  const at = p.position;
  if (at) { c.x = at.x; c.y = at.y; c.z = at.z; } // knockBack reads the copy's position
  if (p.survival && p.survival.serverPlayer !== c) p.survival.serverPlayer = c;
  return c;
}

export function serverCopyBefore(p, controls, world) {
  const c = serverCopyOf(p);
  if (p.dead || !(p.survival?.health > 0)) { c.motion.x = c.motion.y = c.motion.z = 0; c.dead = true; return null; } // a respawned player is a new EntityPlayerMP
  c.dead = false;
  const riding = !!p.mount, sleeping = !riding && !!p.sleeping;
  c.sneaking = !!controls?.sneak; c.flying = !!p.flying; c.riding = riding;
  if (riding) c.onGround = !!p.grounded; // the riding branch's `mw.D = jd.i()` comes before the update
  const size = sleeping ? SLEEP : W, from = { x: c.x, y: c.y, z: c.z }, e = serverCopyMove(world, c, size, sleeping ? SLEEP : H);
  c.motion.x = e.vx; c.motion.y = e.vy; c.motion.z = e.vz;
  c.onGround = !!e.onGround; c.inWeb = !!e.inWeb;
  if (riding) return null; // yz.k: no addMovementStat while riding
  return chargeServerCopy(world, from, e, { stats: p.stats, survival: p.survival, sprinting: !!p.motion?.sprinting });
}

export function serverCopyAfter(p, from) {
  const c = p.serverCopy;
  if (c && !c.dead && (p.mount || p.sleeping)) return; // b83 attack83: both branches return before the jump rule and keep the onGround of the copy's own move
  if (!c || c.dead) { if (c) c.onGround = !!p.grounded; return; }
  if (c.onGround && !p.grounded && from && p.position.y - from.y > 0) {
    c.motion.y = JUMP_MOTION + (p.survival?.effects?.jumpBoost?.() ?? 0);
    if (p.motion?.sprinting) { const push = sprintJumpPush(p.yaw ?? 0); c.motion.x += push.x; c.motion.z += push.z; }
  }
  c.onGround = !!p.grounded;
  c.x = p.position.x; c.y = p.position.y; c.z = p.position.z;
}
