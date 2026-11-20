// b85 spcopy85: the checks of NetHandlerPlayServer.processPlayer's walking branch (nh.a(jd), bytecode-read, 1.7.10 jar). Natively, after `mw.i()` (EntityPlayerMP.onUpdateEntity)
// from the last accepted position (nh.o / p / q, taken from the entity's own position when the packet arrives; offsets 360-426), the entity is put back there (mw.a at 662-678), then:
//   725-804  d13/d15/d17 = packet - position; d19/21/23 = min(|d|, |motion|); d25 = their squared sum.
//   804-966  `d25 > 100` and NOT (server.N() && server.M().equals(name)) -> "moved too quickly!" and setPlayerLocation(o, p, q) (S08), return. N() is `serverOwner != null`, M() the owner name: the
//            integrated server sets it to the session's user name in its constructor (bsx.<init> j(...)), so for the owner in single player the check never fires; a dedicated server
//            never sets it, so there it fires for everyone.
//   967-1006 d28 = the collision list of the copy's box shrunk by 0.0625 (azt.e) at the accepted position is empty.
//   1008-1060 the jump rule (entities.js), `mw.d(d13, d15, d17)` (moveEntity by the delta: a clipped axis zeroes that motion), `mw.D = packet onGround`, `mw.k` (charged elsewhere).
//   1076-1226 d13/d15/d17 = packet - position now (d15 zeroed when -0.5 < d15 < 0.5); `d25 > 0.0625 && !sleeping && !creative` -> "moved wrongly!" (flag d31); this runs in single player too.
//   1227-1326 position := the packet's; d32 = the collision list at the packet position is empty; `d28 && (d31 || !d32) && !sleeping` -> setPlayerLocation(o, p, q) (S08), return.
//   1359-1464 the floating check: `!server.ac() && !creative && !blockBelow && dy >= -0.03125` counts `f` and kicks at 80. ac() is allowFlight: the integrated server turns it on (bsx.e: h(true)),
//             so it never counts in single player; the dedicated server's is server-properties (multiplayer/simulation.js flightCheck).
// b86 spcopy86 (bytecode-read, same method and class):
//   0-30     the packet is ignored once the player has left the world (mw.i).
//   31-87    `if (!r)`: r (hasMoved) turns true only for a packet whose x == o and z == q exactly and (y - p)^2 < 0.01 (y is jd.d(), the box minY). setPlayerLocation (nh.a(DDDFF):
//            r = false, o / p / q := the spot, the entity there, S08 with y + 1.62 and onGround false) is what clears it; the client's S08 handler (bjb.a(fu)) sets its position, zeroes
//            its motion and sends a C06 of exactly that spot from inside the handler (onGround = the S08's, false), which is the answer that sets r again.
//   87       `if (r)` wraps the riding (94-300), sleeping (301-359) and walking branches; with r false the method jumps to 1512.
//   1512-1549 `if (e % 20 == 0) setPlayerLocation(o, p, q, yaw, pitch)`: the S08 is sent again every 20th network tick until the answer comes. `e` is nh.a()'s counter (++e every
//            network tick, after the tick's packets); no mw.i() runs for an ignored packet, so the copy's onUpdateEntity waits too.
//   setPlayerLocation callers (javap over the jar): bv.b (CommandTeleport), mw.a(ZZZ) wakeUpPlayer, mw.a(DDD) setPositionAndUpdate (the ender pearl, a dismount), mw.a(sa)
//   mountEntity, mw.b(I) travelToDimension, mw.a(III) sleepInBedAt, oi.a(mw, int, boolean) respawnPlayer, oi.a(ej, mw) initializeConnectionToPlayer, oi.a(mw, int)
//   transferPlayerToDimension, and nh.a(jd) itself.
// b87 spcopy87 (bytecode-read, 1.7.10 jar):
//   94-300   the riding branch (mw.m != null): f3 / f4 := the entity's yaw / pitch, mw.m.ac() (updateRiderPosition), d5 / d7 / d9 := the seated position, jd.k() ? the packet's angles,
//            mw.D := jd.i(), mw.i(), mw.V := 0, mw.a(d5, d7, d9, f3, f4) (back on the seat), mw.m.ac() again, oi.d(mw), `if (r)` o / p / q := the position, mt.g(mw) (World.updateEntity:
//            the rider's updateRidden: EntityPlayer.updateRidden -> Entity.updateRidden zeroes the motion and seats it, EntityLivingBase.updateRidden (sv.ab) zeroes fallDistance), return.
//            The packet's position is never read: a riding client sends C05 (look) packets.
//   301-359  the sleeping branch (mw.bm()): mw.i(), mw.a(o, p, q, yaw, pitch) (the spot sleepInBedAt's setPlayerLocation set), mt.g(mw), return. The packet is not read at all.
//   1464-1506 the walking branch's tail: mw.D := jd.i(), oi.d(mw), then mw.b(mw.t - d3, jd.i()) with d3 the posY when the packet arrived (offset 360): handleFalling.
//   mw.a(DZ) (updateFallState) is a no-op, so no move of the copy (mw.i(), mw.d, a piston push) counts fall distance; mw.b(DZ) is invokespecial yz.a(DZ), which resolves to
//   EntityLivingBase.updateFallState (sv.a(DZ)): `if (!M()) N()` (handleWaterMovement at the new position when not already in water: R := 0), then on the ground with R > 0 the
//   2006 landing dust (server side) and Block.onFallenUpon (only BlockFarmland aky overrides it: a javap scan of every class), then Entity.updateFallState (sa.a(DZ)): on the ground
//   R > 0 -> fall(R) (yz.b(F): nothing with allowFlying, the stat at >= 2, sv.b(F): ceil(R - 3 - (Jump Boost amplifier + 1)) > 0 -> attackEntityFrom(fall)) and R := 0, else
//   dy < 0 -> R := (float) (R - dy). The other writers of R (putfield sa.R): sa.C onEntityUpdate's lava (R *= 0.5), sa.N handleWaterMovement (0), sa.as setInWeb (0),
//   sv.e(FF) moveEntityWithHeading's ladder branch (0, outside a liquid), sv.ab updateRidden (0), sa.f(dh) readFromNBT.
//   World.getCollidingBoundingBoxes (ahb.a(sa, azt)) adds, for every other entity in the box grown by 0.25, other.J() (getBoundingBox) and mover.h(other) (getCollisionBox) when
//   they meet the box. A javap scan of every class: only EntityBoat (xi.J) returns a box; EntityMinecart's J is null (xl.J), its h(other) matters only to a cart that moves,
//   and the player's h is Entity's null. So the copy stands on boats and walks through minecarts, like the client (entities.js collisionBoxes, entity-collision.js).
//   There is no slime block in 1.7.10 (none in Block's registry), and BlockHay keeps Block's empty onFallenUpon: a hay bale takes no damage off a fall.
import { landingEffects, JUMP_BOOST } from "./damage-fx.js";
import { entityWaterBox, waterAcceleration } from "./fluids.js";
import { isOnLadder } from "./ladders.js";
import { sampleFallSite } from "./combat-tracker.js";
const f = Math.fround;
export const SHRINK = f(0.0625);
export const TOO_QUICKLY = 100.0, WRONGLY = 0.0625;

/** d25 of the "moved too quickly" test: the squared sum of min(|delta|, |motion|) per axis. */
export function quickMove(delta, motion) {
  const a = Math.min(Math.abs(delta.x), Math.abs(motion.x)), b = Math.min(Math.abs(delta.y), Math.abs(motion.y)), c = Math.min(Math.abs(delta.z), Math.abs(motion.z));
  return a * a + b * b + c * c;
}
/** "moved too quickly!": over 100, and not the single-player owner (`owner` = server.N() && server.M() equals the player's name). */
export function movedTooQuickly(delta, motion, { owner = false } = {}) {
  return quickMove(delta, motion) > TOO_QUICKLY && !owner;
}
/** The copy's squared distance from the packet's position after the move; dy within (-0.5, 0.5) counts as 0. */
export function wrongMove(packet, at) {
  const dx = packet.x - at.x; let dy = packet.y - at.y; const dz = packet.z - at.z;
  if (dy > -0.5 && dy < 0.5) dy = 0;
  return dx * dx + dy * dy + dz * dz;
}
/** "moved wrongly!" (d31): over 0.0625 and not sleeping and not creative (mx.d). */
export function movedWrongly(packet, at, { sleeping = false, creative = false } = {}) {
  return wrongMove(packet, at) > WRONGLY && !sleeping && !creative;
}
/** Whether setPlayerLocation(o, p, q) answers (S08): the copy's box was free at the accepted position and (wrongly, or blocked at the packet's position), not sleeping. */
export function needsCorrection({ clearBefore, wrongly, clearAfter, sleeping = false }) {
  return !!clearBefore && (!!wrongly || !clearAfter) && !sleeping;
}
/** The box of a copy at `at` shrunk by 0.0625 (azt.b().e(d, d, d)): the collision test's box. */
export function shrunkBox(at, w, h) {
  const hw = f(w) / 2;
  return [at.x - hw + SHRINK, at.y + SHRINK, at.z - hw + SHRINK, at.x + hw - SHRINK, at.y + f(h) - SHRINK, at.z + hw - SHRINK];
}
/** processPlayer offsets 31-87: the packet that answers a setPlayerLocation (r := true): x and z equal to o and q, y within 0.1 of p. A C03 without a position never does. */
export function awaitedAnswer(pkt, at) {
  if (!pkt) return false;
  const dy = pkt.y - at.y;
  return pkt.x === at.x && dy * dy < 0.01 && pkt.z === at.z;
}

/** The copy's box at (x, minY, z) in water, as Entity.handleWaterMovement tests it (the box shrunk 0.4 vertically and 0.001 around). */
export function copyInWater(world, at, w, h) {
  const hw = f(w) / 2;
  return waterAcceleration(world, entityWaterBox([at.x - hw, at.y, at.z - hw, at.x + hw, at.y + f(h), at.z + hw]), false).wet;
}
/** EntityPlayerMP.onUpdateEntity's (mw.i) changes to the copy's fallDistance, on the copy `p` at the spot the update ran from and `moved`, the update's scratch (inWater and inLava
 *  at the start, inWeb after the move): water zeroes it, lava halves it (Entity.onEntityUpdate), the ladder branch of moveEntityWithHeading zeroes it outside a liquid (a flying
 *  player takes that branch in a liquid too), and setInWeb zeroes it. The move itself adds nothing (mw.a(DZ) is empty). Also keeps isInWater for handleFalling. */
export function updateFallResets(world, p, moved) {
  let r = p.fallDistance ?? 0;
  p.inWater = !!moved.inWater;
  if (moved.inWater) r = 0;
  else if (moved.inLava) r = f(r * f(0.5));
  if (!((moved.inWater || moved.inLava) && !p.flying) && isOnLadder(world, p.x, p.y, p.z)) r = 0;
  if (moved.inWeb) r = 0;
  p.fallDistance = r;
}
/** EntityPlayer.fall (yz.b(F)) on the copy: nothing in Creative (allowFlying), else EntityLivingBase.fall's damage ceil(distance - 3 - Jump Boost level) to the player's Survival,
 *  with the CombatTracker's fall site and distance. The sounds are the client's own (EntityPlayer.playSound skips the player it is about). Returns the points dealt. */
export function copyFall(world, p, distance) {
  const s = p.survival;
  if (!s || p.creative || s.creative || !(s.health > 0) || !(distance > 0)) return 0;
  const jump = s.effects?.get?.(JUMP_BOOST), by = Math.floor(p.y - 0.20000000298023224);
  const out = landingEffects(distance, { kind: "player", amplifier: jump ? jump.amplifier : -1, blockUnder: world.get(Math.floor(p.x), by, Math.floor(p.z)) });
  if (!(out.points > 0)) return 0;
  s.combatSite = sampleFallSite(world, p.x, p.y, p.z, !!p.inWater);
  s.combatFall = distance;
  s.damage?.(out.points, "a fall");
  return out.points;
}
/** NetHandlerPlayServer.processPlayer's handleFalling (mw.b(DZ) -> EntityLivingBase.updateFallState), on the copy at the accepted packet position: `dy` is the packet's y minus
 *  the copy's posY when the packet arrived, `ground` the packet's onGround. */
export function handleFalling(world, p, dy, ground) {
  if (!p.inWater && copyInWater(world, p, p.width, p.height)) { p.inWater = true; p.fallDistance = 0; }
  const r = p.fallDistance ?? 0;
  if (ground) {
    if (r > 0) copyFall(world, p, r);
    p.fallDistance = 0;
  } else if (dy < 0) p.fallDistance = f(r - dy);
}
