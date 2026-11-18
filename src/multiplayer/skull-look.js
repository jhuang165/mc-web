// Batch 81 mpcopies81: the rotation of a wither skull's client copy, as the 1.7.10 tracker and client give it.
// Bytecode-read (javap -c -p, unchanged 1.7.10 jar):
//  - EntityTracker.trackEntity (mn.a(sa)): every EntityFireball (ze, so EntityWitherSkull zp too) is added with range 64, frequency 10 and
//    sendVelocityUpdates false. The entry's constructor (my.<init>) takes lastYaw / lastPitch = floor_float(angle * 256 / 360) at the spawn,
//    before the skull's first update.
//  - The spawn packet (my.c -> S0E fw(sa, 66, shooter id)): pitch byte h = floor_float(pitch * 256 / 360), yaw byte i likewise, written as
//    bytes. The client's handleSpawnObject (bjb.a(fw)) builds zp(world, x, y, z, ax, ay, az) (setLocationAndAngles with the fields' 0 angles,
//    so prevRotationYaw / prevRotationPitch stay 0), sets the data to 0 (no setVelocity: the copy's motion starts at 0), then
//    rotationPitch = j * 360 / 256 and rotationYaw = k * 360 / 256 from the signed bytes.
//  - sendLocationToAllClients (my.a(List)): the block runs when ticks % 10 == 0 (isAirBorne and a dirty data watcher never fall off that beat
//    for a skull: its watcher 10 is set only in the constructor). No packet at ticks 0. A teleport (S18, always with the angles) when a
//    position delta leaves -128..127 or more than 400 updates passed; otherwise S17 for move and look, S15 for a move only (no angles), S16
//    for a look only. Look is |yaw - lastYaw| >= 4 or |pitch - lastPitch| >= 4; lastYaw / lastPitch move only on a look, also for S18.
//  - The client: S14 (bjb.a(hf)) and S18 (bjb.a(ik)) call setPositionAndRotation2 (sa.a(DDDFFI), not overridden by ze or zp) with the
//    packet angles (S15 keeps rotationYaw / rotationPitch), and its setRotation (sa.b(FF)) is yaw % 360, pitch % 360.
//  - Minecraft.runTick (bao) updates the client world's entities ("level", bjf.h) before it processes the packets ("pendingConnection",
//    ej.a), so the copy turns by its own EntityFireball.onUpdate first (prev = current, then ze.h's turn toward its motion) and a look packet
//    then overwrites the turned angles; the frame between draws prev -> packet.
const f = Math.fround;
import { encodeAxis, encodeY, sizeClass } from '../entity-tracker.js';
import { fireballTurn } from '../fireball-turn.js';
import { fireballAcceleration } from '../blaze-ghast.js';
import { SKULL } from '../wither-boss.js';

export const SKULL_FREQUENCY = 10;
const SIZE = sizeClass(SKULL.size); // zp's setSize(0.3125F, 0.3125F) after ze's (Entity.myEntitySize)
const floorFloat = v => { const i = Math.trunc(v); return v < i ? i - 1 : i; }; // MathHelper.floor_float
export const angleInt = deg => floorFloat(f(f(f(deg) * 256) / 360));
const byte = v => (v << 24) >> 24;
export const angleOfByte = b => f(f(byte(b) * 360) / 256); // (float)(byte * 360) / 256.0F

// The skull's EntityTrackerEntry, made when the skull joins the world (before its first update).
// `spawn` keeps the S0E the first watchers got from trackEntity (EntityTracker.trackEntity runs updatePlayerEntities at once, so the
// players already near see the spawn angles, before the skull's own first update turned it).
export function skullEntry(b) {
  const yaw = angleInt(b.yaw ?? 0), pitch = angleInt(b.pitch ?? 0);
  return { ticks: 0, since: 0, x: Math.floor(b.x * 32), y: Math.floor(b.y * 32), z: Math.floor(b.z * 32), yaw, pitch, spawn: { yb: byte(yaw), pb: byte(pitch) } };
}

// One sendLocationToAllClients of the shared entry. Returns true when this tick's position packet carries the angles (S16, S17 or S18).
export function skullEntryTick(t, b) {
  let angles = false;
  if (t.ticks % SKULL_FREQUENCY === 0) {
    t.since++;
    const i = encodeAxis(SIZE, b.x), j = encodeY(b.y), k = encodeAxis(SIZE, b.z), yaw = angleInt(b.yaw ?? 0), pitch = angleInt(b.pitch ?? 0);
    const dx = i - t.x, dy = j - t.y, dz = k - t.z;
    const move = Math.abs(dx) >= 4 || Math.abs(dy) >= 4 || Math.abs(dz) >= 4 || t.ticks % 60 === 0;
    const look = Math.abs(yaw - t.yaw) >= 4 || Math.abs(pitch - t.pitch) >= 4;
    if (t.ticks > 0) {
      const small = dx >= -128 && dx < 128 && dy >= -128 && dy < 128 && dz >= -128 && dz < 128;
      if (small && t.since <= 400) angles = look;
      else { t.since = 0; angles = true; }
    }
    if (move) { t.x = i; t.y = j; t.z = k; }
    if (look) { t.yaw = yaw; t.pitch = pitch; }
  }
  t.ticks++;
  return angles;
}

// The wire fields of a skull row: the S0E bytes for a new watcher (the spawn angles in the skull's first tracked tick, its current ones
// after: a later watcher's S0E is built in that tick's updatePlayerEntity), the S0E speed fields (int)(acceleration * 8000), and `look`
// when this tick's S16 / S17 / S18 carries the current angles (the same bytes once the first tick is past).
export function skullWire(b) {
  const t = b.track, first = t?.ticks === 1 && t.spawn;
  const out = first ? { yb: t.spawn.yb, pb: t.spawn.pb } : { yb: byte(angleInt(b.yaw ?? 0)), pb: byte(angleInt(b.pitch ?? 0)) };
  out.a8 = [b.ax, b.ay, b.az].map(a => Math.trunc((a ?? 0) * 8000) + 0);
  if (b.lookSent) { out.look = 1; out.lyb = byte(angleInt(b.yaw ?? 0)); out.lpb = byte(angleInt(b.pitch ?? 0)); }
  return out;
}

// The client copy (client-dispense.js row): `fresh` on the row's first snapshot (the S0E), else one client tick of the copy's own
// EntityFireball.onUpdate, then this tick's packets. The copy's turn reads its OWN motion (bytecode-read bjb.a(fw): the data is set to 0,
// so setVelocity never runs): 0 at the spawn, then (motion + acceleration) * 0.95 (0.73 charged) a tick, where the acceleration is the
// 7-argument constructor's normalised speed fields * 0.1. Kept in `row.look` and used for the angles only (the drawn position stays the
// server's). Water's 0.8 on the copy is not modelled.
export function skullCopyLook(row, d, fresh) {
  if (!Number.isFinite(d.yb) || !Number.isFinite(d.pb)) return row;
  if (fresh || !row.look) {
    const [ax, ay, az] = Array.isArray(d.a8) ? d.a8 : [0, 0, 0];
    row.look = { m: [0, 0, 0], a: fireballAcceleration(ax / 8000, ay / 8000, az / 8000) };
    row.prevYaw = 0; row.prevPitch = 0; // the constructor's setLocationAndAngles(.., 0, 0); handleSpawnObject sets only the current pair
    row.yaw = angleOfByte(d.yb); row.pitch = angleOfByte(d.pb);
    return row;
  }
  const L = row.look, m = L.m, k = row.blue ? SKULL.factorBlue : SKULL.factor;
  row.prevYaw = row.yaw; row.prevPitch = row.pitch; // Entity.onEntityUpdate
  fireballTurn(row, m[0], m[1], m[2]); // ze.h: after posX += motionX, before the acceleration
  for (let i = 0; i < 3; i++) m[i] = (m[i] + L.a[i]) * k;
  if (d.look) { row.yaw = f(angleOfByte(d.lyb) % 360); row.pitch = f(angleOfByte(d.lpb) % 360); } // setPositionAndRotation2 -> setRotation
  return row;
}
