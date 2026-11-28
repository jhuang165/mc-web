// b102 horse102: S08PacketPlayerPosLook. Natively every nh.a(x, y, z, yaw, pitch) (bytecode-read, nh.a(DDDFF)) sets hasMoved false, remembers the target, sends S08 with the player's own
// yaw/pitch and relative flags none, and the C03 handler ignores the client's movement packets until the C06 echoing the target arrives. Callers (bytecode-read): /tp and ender pearls
// (mw.a(DDD)), sleepInBedAt (mw.a(III)), wakeUpPlayer (mw.a(ZZZ)), mountEntity (mw.a(sa), twice), join (oi.a(ej, mw)), respawn (oi.a(mw, int, boolean)), portal travel (oi.a(mw, int)).
// The port's position is the server's own (the client sends controls and look only), so the S08 here carries yaw/pitch to the client, which answers with one `posLookAck` (C06) each.
export const ACK_WAIT_TICKS = 40; // the port's fallback: a client that never answers is not ignored for good
export function expectPosLook(sim, p, count = 1) { if (p) p.s08 = { n: (p.s08?.n | 0) + count, tick: sim.ticks | 0 }; }
export function sendPosLook(sim, p, extra = null) {
  if (!p) return;
  (p.dimOut ??= []).push({ type: 'posLook', x: p.position.x, y: p.position.y, z: p.position.z, yaw: p.yaw, pitch: p.pitch, ...extra });
  expectPosLook(sim, p);
}
export function ackPosLook(p) { if (p?.s08 && p.s08.n > 0) p.s08.n--; }
// nh.a(jd): while the last S08 is unanswered the movement packet is ignored.
export function awaitingPosLook(sim, p) { return !!p?.s08 && p.s08.n > 0 && (sim.ticks | 0) - p.s08.tick < ACK_WAIT_TICKS; }
