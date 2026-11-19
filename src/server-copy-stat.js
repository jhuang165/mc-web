// b82 mpplace82: the second movement stat of the server's player entity. NetHandlerPlayServer.processPlayer (nh.a(jd), bytecode-read) calls
// EntityPlayerMP.onUpdateEntity (mw.i) before it applies the client's position packet: at offset 647 for a walking player (191 riding, 315 sleeping).
// mw.i starts with `invokespecial yz.h()` = EntityPlayer.onUpdate -> EntityLivingBase.onLivingUpdate -> EntityPlayer.moveEntityWithHeading(0, 0)
// (yz.e(FF)), which moves the copy on its OWN motion and ends in addMovementStat (yz.k) for that move. processPlayer then puts the position back
// (mw.a(o, p, q, f, f)), moves the copy by the packet's delta (mw.d) and calls addMovementStat again (mw.k(d13, d15, d17)) for the client's move.
// So the server charges twice a tick whenever the copy's own motion moves it: sinking or pushed by a flow under water (dive / swim, 0.015F a cm),
// knockback and explosion pushes (in the air: fly over 25 cm, no exhaustion; then the residue on the ground: walk, 0.01F or 0.099999994F a cm),
// the motion processPlayer's jump rule (EntityLivingBase.jump, mw.bj) gives the copy. A copy at rest moves nothing (its motionY only meets the floor).
// The stat is read on the copy after its move: the eye (posY + 1.62, mw.g) in water, isInWater from handleWaterMovement before the move, the
// ladder at floor(minY), onGround from the move, the copy's sprint flag (C0B).
import { movementStat } from './movement-stat.js';
import { addMovementStat } from './stats-live.js';
import { eyeInWater } from './fluids.js';
import { isOnLadder } from './ladders.js';
import { PHYSICS } from './world.js';

/** The movement stat of the copy's own move from `from` ({ x, y, z }) to the moved scratch entity `e` (entities.js serverCopyMove). */
export function serverCopyStat(world, from, e, sprinting = false) {
  return {
    dx: e.x - from.x, dy: e.y - from.y, dz: e.z - from.z, sprinting: !!sprinting,
    dive: eyeInWater(world, e.x, e.y + PHYSICS.eye, e.z), swim: !!e.inWater, ladder: isOnLadder(world, e.x, e.y, e.z), ground: !!e.onGround,
  };
}

/** Charges the copy's move: the stat on `stats` (when given) and the exhaustion on `survival` (Survival.exhaust skips Creative). Returns movementStat's answer. */
export function chargeServerCopy(world, from, e, { stats = null, survival = null, sprinting = false } = {}) {
  const move = serverCopyStat(world, from, e, sprinting);
  const out = movementStat(move);
  if (stats) addMovementStat(stats, move);
  if (out.exhaustion > 0) survival?.exhaust?.(out.exhaustion);
  return out;
}
