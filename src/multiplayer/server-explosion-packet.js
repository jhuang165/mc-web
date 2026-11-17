// b78 mpexplosion78: S27PacketExplosion (class gu), the per-player part of an explosion's effect.
// Bytecode-read (javap -c -p, 1.7.10 jar): `WorldServer.newExplosion` (mt.a(sa,DDDFZZ)) runs doExplosionA/B(false), clears the affected list when !smoking, then sends
// `new gu(x, y, z, size, affectedBlocks, explosion.b().get(player))` to every player with `getDistanceSq(x, y, z) < 4096.0` (feet to centre, three axes, not a square).
// `agw.a()` stores in that map the push `d5*d10, d6*d10, d7*d10` with d10 = (1 - dist/size) * exposure, BEFORE `agi.a` (Blast Protection) reduces the server's own motion: the packet carries the unreduced push.
// `gu` writes x,y,z,size and the block offsets as floats/bytes and motion x,y,z as floats; `NetHandlerPlayClient.handleExplosion` (bjb.a(gu)) builds an Explosion, plays doExplosionB(true),
// then `player.motionX += (double)packet.motionX` (and Y, Z).
// Deviation: the port's client has no physics of its own, so the added motion only feeds its `velocity` (bob, cape), and the next tick's position delta or S12 replaces it.
// b79 explfx79: the block offsets are on the wire now. Bytecode-read: `gu.b` writes x,y,z,size as floats, the count as an int, then for each affected position (position - (int)x) as three signed BYTES
// (d2i truncates toward zero, the byte write wraps mod 256), then the motion floats; `gu.a` reads them back as float-widened doubles and adds the bytes to (int) of THAT double, so a centre that rounds up
// to an integer as a float (5.9999999 -> 6.0f) shifts every cell by one; `agw.b` is true in the client's Explosion, so doExplosionB(true) always draws the huge particle for size >= 2, whatever the server's smoking flag.
// Here the offsets ride the dispFx event as `bl`, a base64 string of those bytes (the count is its length / 3).
export const S27_RANGE_SQ = 4096;
export const s27Reaches = (e, pos) => ((e.x - pos.x) ** 2 + (e.y - pos.y) ** 2 + (e.z - pos.z) ** 2) < S27_RANGE_SQ;
// The dispFx event one player receives: the burst plus that player's motion (floats on the wire), when the blast pushed him.
export function s27Of(e, player) {
  const { knock, blocks, wire, ...out } = e, k = knock?.get?.(player);
  if (blocks) out.bl = (e.wire ??= s27Encode(e.x, e.y, e.z, blocks)); // one encoding for every player of the blast
  if (k) { out.mx = Math.fround(k[0]); out.my = Math.fround(k[1]); out.mz = Math.fround(k[2]); }
  return out;
}

const i8 = (n) => (n << 24) >> 24;
// The S27 offset bytes of `list` ([[x, y, z]...]) around the server's double centre, base64 (btoa/atob exist in browsers and node).
export function s27Encode(x, y, z, list) {
  const ix = Math.trunc(x), iy = Math.trunc(y), iz = Math.trunc(z), bytes = new Uint8Array(list.length * 3);
  list.forEach((p, i) => { bytes[i * 3] = (p[0] - ix) & 255; bytes[i * 3 + 1] = (p[1] - iy) & 255; bytes[i * 3 + 2] = (p[2] - iz) & 255; });
  let bin = '';
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(bin);
}
// gu.a: the positions the client's Explosion holds, from the float centre it read and the offset bytes.
export function s27Decode(x, y, z, bl) {
  if (typeof bl !== 'string' || !bl) return [];
  const fx = Math.fround(x), fy = Math.fround(y), fz = Math.fround(z), ix = Math.trunc(fx), iy = Math.trunc(fy), iz = Math.trunc(fz), bin = atob(bl), out = [];
  for (let i = 0; i + 2 < bin.length; i += 3) out.push([ix + i8(bin.charCodeAt(i)), iy + i8(bin.charCodeAt(i + 1)), iz + i8(bin.charCodeAt(i + 2))]);
  return out;
}
// What the integrated client's handleExplosion sees for a blast the integrated server just made: the same encode and decode, without the socket.
export function s27Loopback(x, y, z, size, list) {
  return { x: Math.fround(x), y: Math.fround(y), z: Math.fround(z), size: Math.fround(size), list: s27Decode(x, y, z, s27Encode(x, y, z, list)) };
}
