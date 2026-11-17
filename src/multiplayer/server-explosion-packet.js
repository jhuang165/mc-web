// b78 mpexplosion78: S27PacketExplosion (class gu), the per-player part of an explosion's effect.
// Bytecode-read (javap -c -p, 1.7.10 jar): `WorldServer.newExplosion` (mt.a(sa,DDDFZZ)) runs doExplosionA/B(false), clears the affected list when !smoking, then sends
// `new gu(x, y, z, size, affectedBlocks, explosion.b().get(player))` to every player with `getDistanceSq(x, y, z) < 4096.0` (feet to centre, three axes, not a square).
// `agw.a()` stores in that map the push `d5*d10, d6*d10, d7*d10` with d10 = (1 - dist/size) * exposure, BEFORE `agi.a` (Blast Protection) reduces the server's own motion: the packet carries the unreduced push.
// `gu` writes x,y,z,size and the block offsets as floats/bytes and motion x,y,z as floats; `NetHandlerPlayClient.handleExplosion` (bjb.a(gu)) builds an Explosion, plays doExplosionB(true),
// then `player.motionX += (double)packet.motionX` (and Y, Z).
// Deviation: the port's client has no physics of its own, so the added motion only feeds its `velocity` (bob, cape), and the next tick's position delta or S12 replaces it; the block offsets are not sent (block changes travel as cells).
export const S27_RANGE_SQ = 4096;
export const s27Reaches = (e, pos) => ((e.x - pos.x) ** 2 + (e.y - pos.y) ** 2 + (e.z - pos.z) ** 2) < S27_RANGE_SQ;
// The dispFx event one player receives: the burst plus that player's motion (floats on the wire), when the blast pushed him.
export function s27Of(e, player) {
  const { knock, ...out } = e, k = knock?.get?.(player);
  if (k) { out.mx = Math.fround(k[0]); out.my = Math.fround(k[1]); out.mz = Math.fround(k[2]); }
  return out;
}
