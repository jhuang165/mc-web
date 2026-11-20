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
