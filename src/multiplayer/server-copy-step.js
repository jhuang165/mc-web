// b82 mpplace82: the dedicated server's own copy of each player (EntityPlayerMP's motion and onGround, apart from the client's). The port's server
// moves the player from the client's input (movePlayer), which stands for the client's move and the C03's addMovementStat; this is the move
// EntityPlayerMP.onUpdateEntity (mw.i) makes before processPlayer applies the packet (server-copy-stat.js has the bytecode trail), with its charge.
//   before(p, controls, world)  before movePlayer: the copy steps from the accepted position on its own motion (entities.js serverCopyMove: the flow
//                               push, the 0.005 snap, moveEntityWithHeading with no input and stepHeight 0, a flier's motionY * 0.6) and charges it.
//   after(p, from)              after movePlayer: processPlayer's jump rule (`if (mw.D && !jd.i() && d15 > 0) mw.bj()`, the copy's onGround from its
//                               own step, the packet's onGround, the packet's dy) gives the copy EntityLivingBase.jump's motion (0.42F, Jump Boost,
//                               the sprint push; EntityPlayer.jump's stat and exhaustion are movePlayer's, charged once), then `mw.D = jd.i()`.
// Knockback reaches the copy through `survival.serverPlayer` (player-knockback.js queueKnockBack / queueVelocity, at the hit, as on the integrated
// server). Riding (the mount's update moves the rider: the mounted stat), sleeping and dead players take no copy step here.
import { serverCopyMove } from '../entities.js';
import { chargeServerCopy } from '../server-copy-stat.js';
import { JUMP_MOTION, sprintJumpPush } from '../player-movement.js';

const f = Math.fround;
const W = f(0.6), H = f(1.8);

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
  if (p.mount || p.sleeping) return null;
  c.sneaking = !!controls?.sneak; c.flying = !!p.flying; c.riding = false;
  const from = { x: c.x, y: c.y, z: c.z }, e = serverCopyMove(world, c, W, H);
  c.motion.x = e.vx; c.motion.y = e.vy; c.motion.z = e.vz;
  c.onGround = !!e.onGround; c.inWeb = !!e.inWeb;
  return chargeServerCopy(world, from, e, { stats: p.stats, survival: p.survival, sprinting: !!p.motion?.sprinting });
}

export function serverCopyAfter(p, from) {
  const c = p.serverCopy;
  if (!c || c.dead || p.mount || p.sleeping) { if (c) c.onGround = !!p.grounded; return; }
  if (c.onGround && !p.grounded && from && p.position.y - from.y > 0) {
    c.motion.y = JUMP_MOTION + (p.survival?.effects?.jumpBoost?.() ?? 0);
    if (p.motion?.sprinting) { const push = sprintJumpPush(p.yaw ?? 0); c.motion.x += push.x; c.motion.z += push.z; }
  }
  c.onGround = !!p.grounded;
  c.x = p.position.x; c.y = p.position.y; c.z = p.position.z;
}
