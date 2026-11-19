// Batch 81 blast81: the multiplayer client's own copy of a fireball, small fireball or wither skull, and the server half that feeds it the tracker's packets.
//
// Bytecode-read (javap -c -p, 1.7.10 jar):
//   * EntityTracker.addEntityToTracker (mn.a(sa)): EntityFireball (ze) is tracked with range 64, update frequency 10 and sendVelocityUpdates false.
//   * EntityTrackerEntry.func_151260_c (my.c): the spawn packet is S0EPacketSpawnObject type 63 (large), 64 (small) or 66 (wither skull) with data = the shooter's id (or 0),
//     and its three speed fields are (int)(accelerationX/Y/Z * 8000). The position is floor(pos * 32), as every S0E.
//   * NetHandlerPlayClient.handleSpawnObject (bjb.a(fw)): types 63, 64 and 66 build `new zg/zi/zp(world, x, y, z, speedX / 8000, speedY / 8000, speedZ / 8000)` and then set the
//     packet's data to 0 (fw.g(0)), so the closing `if (data > 0) setVelocity(...)` does not run: the copy starts with motion 0. EntityFireball(world, x, y, z, ax, ay, az)
//     (ze.<init>) normalises the acceleration: a / (double) MathHelper.sqrt_double(|a|^2) * 0.1.
//   * EntityFireball.onUpdate (ze.h) has no isRemote guard but the opening setDead test: the copy runs super.onUpdate (the water test), the ray and entity sweep (onImpact is
//     remote-guarded in zg, zi and zp: nothing happens), pos += motion, four `bubble` in water and factor 0.8 (else getMotionFactor: 0.95, a blue skull's 0.73), motion =
//     (motion + acceleration) * factor, then the `smoke` at (x, y + 0.5, z). So the copy flies by itself between position packets.
//   * Entity.onEntityUpdate (sa.C) sets the burning flag (setFlag(0, fire > 0)) on the server only, and ze.h calls setFire(1) after super.onUpdate, so the watcher changes in
//     the ball's second update: the entry's location block runs at its ticks == 1 as well (DataWatcher.hasObjectChanged), besides every 10th tick.
//   * EntityFireball.attackEntityFrom (ze.a(ro, F)) calls setBeenAttacked (sa.Q: velocityChanged = true) before taking the look vector, so a punched ball sends S12 with its new
//     motion; the client copy keeps its old acceleration (nothing carries it) until the next position packets correct the place.
//   * Position packets go through Entity.setPositionAndRotation2 (the box lifted onto the block boxes it overlaps, shrunk 1/32 at the sides); a teleport adds 1/64 to y.
// Port-read: the dead ball leaves the server's entity list in the tick it died (World.onEntityRemoved -> the tracker entry queues its id in each viewer's
// destroyedItemsNetCache), and the S13 goes out at the viewer's next EntityPlayerMP.onUpdate, in the next tick when the player is earlier in the entity list (the usual case).
// The client copy runs its update before the packets of a tick, so it takes two more updates (two smokes) after the last packets of the ball: the message where the row is
// gone (still drawn) and the next one (the S13 after the update, so not drawn). RemoteDispense keeps the row (`lingered`) for that.
// Batch 82 mpball82 (executed: tools/probes/BallFlagProbe.java, public/research/ballflag82-reference.json; bytecode-read where noted):
//   * The angles. ze.h turns every ball toward its motion after the move (fireball-turn.js), on the server and on the copy alike, and the entry sends S16 / S17 / S18 with
//     the angle bytes (TrackerEntry's look rule). The S0E carries floor_float(angle * 256 / 360) bytes; a new copy has rotation = byte * 360 / 256 and prev 0 (bjb.a(fw)),
//     an S15 keeps the current angles, S16 / S17 / S18 go through setPositionAndRotation2 (setRotation: yaw % 360, pitch % 360). RenderFireball (bnr) draws a billboard
//     (playerViewY / X only), so a fireball's angles are not drawn; RenderWitherSkull draws the skull's.
//   * The burning flag. Entity.onEntityUpdate (sa.C) zeroes the fire counter in water (handleWaterMovement) and on a remote world, counts it down otherwise, and on the
//     server sets the watched flag 0 to fire > 0; ze.h then calls setFire(1) (fire = max(fire, 20)). So the server's flag is false after the first update and in water,
//     true otherwise: the watcher changes at the entry's ticks 1 and on each entry into or exit from water, which forces the location block off the beat and sends S1C.
//     A large ball's onFire hurt (fire % 20 == 0 every update out of water) reaches ze.a(ro, F), which calls setBeenAttacked first: velocityChanged every tick, so S12
//     every tick (the tracker tail sends it whatever sendVelocityUpdates says). zi.a and zp.a return false at once (no S12).
//   * The copy: its own counter is 20 after each update (sa.C's remote zeroing, then setFire(1)), so Entity.isBurning (fire > 0 || remote && flag 0) is true from its first
//     update whatever the flag says; before that it is the S1C flag that followed the S0E. zg and zi are not fire immune and RenderFireball keeps Render's
//     doRenderShadowAndFire, so the copy of a ghast's or blaze's ball draws the flames; zp.al (isBurning) returns false (no flames on a skull).
//   * The client's own sweep. ze.h's opening setDead test is `!isRemote && (dead shooter || !blockExists)`, and zg.a(azu), zi.a(azu) and zp.a(azu) are wholly inside
//     `if (!isRemote)` (setDead too). The copy's ray and entity sweep therefore change nothing: executed, the remote copy flies on through the stone wall the server ball
//     died at. stepBallCopy runs no sweep for that reason (the copy ends with the S13).
//   * Water: the copy's isInWater (handleWaterMovement at the start of its update) gives four bubbles and factor 0.8, and the flow pushes its motion 0.014 (`water`).
// Rows from a batch 81 server have a six-field `s` and no angle packets: the copy keeps the batch 81 behaviour (no angles, no flames).
import { TrackerEntry, sizeClass } from '../entity-tracker.js';
import { FIREBALL, fireballAcceleration } from '../blaze-ghast.js';
import { SKULL } from '../wither-boss.js';
import { ItemEntities } from '../item-entities.js';
import { fireballTurn } from '../fireball-turn.js';
import { angleInt, angleOfByte } from './skull-look.js';
import { ballSplash } from '../fireball-splash.js';
import { JavaRandom } from '../java-random.js';

const f = Math.fround;
export const BALL_TRACK = Object.freeze({ range: 64, frequency: 10, velocity: false });
export const BALL_KINDS = Object.freeze({
  fireball: { type: 63, width: FIREBALL.largeSize },
  smallFireball: { type: 64, width: FIREBALL.smallSize },
  witherSkull: { type: 66, width: SKULL.size },
});
const accelInt = (a) => Math.trunc(a * 8000) + 0; // (int)(acceleration * 8000)

// One EntityTrackerEntry per ball, shared by every viewer (natively one entry per entity): the packets of this tick go into the ball's row for each player that sees it.
class BallEntry extends TrackerEntry {
  constructor(o, size) { super(o, { ...BALL_TRACK, size }, { log: null }); this.tracked = true; this.initialised = true; }
  updatePlayerList() {}
}
const byte = (v) => (v << 24) >> 24;
const angleByte = (deg) => byte(angleInt(deg ?? 0));
// A tracker packet as the row carries it. S17 stays type 'move' (a batch 81 client moves by it and ignores the angle bytes), S16 is 'look', S1C 'meta' with `f` the flag.
function wirePacket({ type, dx, dy, dz, x, y, z, vx, vy, vz, yaw, pitch }) {
  if (type === 'moveLook') return { type: 'move', dx, dy, dz, yb: yaw, pb: pitch };
  if (type === 'move') return { type, dx, dy, dz };
  if (type === 'look') return { type, yb: yaw, pb: pitch };
  if (type === 'teleport') return { type, x, y, z, yb: yaw, pb: pitch };
  if (type === 'velocity') return { type, vx, vy, vz };
  return { type };
}
export class BallTracks {
  constructor() { this.map = new Map(); }
  // After the tick's entity updates, once per tick: each live ball's entry runs sendLocationToAllClients. A ball that keeps `burnFlag` (fireballBurn) drives the
  // watcher test; one without it (a bare test ball) keeps the batch 81 stand-in, a change at the entry's ticks 1 only.
  update(balls) {
    const live = new Set();
    for (const b of balls) {
      if (!b || b.dead || !BALL_KINDS[b.kind]) continue;
      live.add(b);
      let t = this.map.get(b);
      if (!t) {
        const o = { type: 'fireball', x: b.x, y: b.y, z: b.z, vx: 0, vy: 0, vz: 0, rotationYaw: b.yaw ?? 0, rotationPitch: b.pitch ?? 0 };
        t = { o, en: new BallEntry(o, sizeClass(BALL_KINDS[b.kind].width)), packets: [], flag: false };
        this.map.set(b, t);
      }
      const vc = !!b.velocityChanged;
      Object.assign(t.o, { x: b.x, y: b.y, z: b.z, vx: b.vx ?? 0, vy: b.vy ?? 0, vz: b.vz ?? 0, rotationYaw: b.yaw ?? 0, rotationPitch: b.pitch ?? 0, velocityChanged: vc });
      b.velocityChanged = false;
      const kept = b.burnFlag !== undefined, changed = kept ? !!b.burnFlag !== t.flag : t.en.ticks === 1;
      t.en.sendLocation(false, changed);
      const out = t.en.packets.splice(0).map(wirePacket);
      // my.a(List): the S1C (func_111190_b) inside the location block, before the tail's velocityChanged S12
      if (kept && changed) { t.flag = !!b.burnFlag; out.splice(vc ? out.length - 1 : out.length, 0, { type: 'meta', f: t.flag ? 1 : 0 }); }
      t.packets = out;
      if (b.track) b.track.ticks = t.en.ticks; // skull-look.js skullWire: the first tracked tick carries the spawn bytes
      b.lookSent = out.some((p) => p.yb !== undefined);
    }
    for (const b of [...this.map.keys()]) if (!live.has(b)) this.map.delete(b);
  }
  // The row field `t`: `s` the S0E a new viewer would get now (floor(pos * 32), the acceleration ints, then b82: the yaw and pitch bytes and the S1C flag that
  // follows the S0E), `p` this tick's packets when there are any. In the ball's first tracked tick the bytes and the flag are those of its join (EntityTracker.trackEntity
  // sends the S0E to the players near before the first update: skull-look.js skullEntry keeps them).
  row(b) {
    const t = this.map.get(b);
    if (!t) return undefined;
    const first = t.en.ticks === 1 && b.track?.spawn;
    const yb = first ? b.track.spawn.yb : angleByte(b.yaw), pb = first ? b.track.spawn.pb : angleByte(b.pitch), flag = first ? 0 : (t.flag ? 1 : 0);
    const out = { s: [Math.floor(b.x * 32), Math.floor(b.y * 32), Math.floor(b.z * 32), accelInt(b.ax ?? 0), accelInt(b.ay ?? 0), accelInt(b.az ?? 0), yb, pb, flag] };
    if (t.packets.length) out.p = t.packets;
    return out;
  }
}

// --- the client copy ---
// bjb.a(fw) for 63 / 64 / 66: the position from the packet, motion 0, the acceleration normalised to 0.1 (ze.<init>). b82: an `s` with the angle bytes (index 6, 7)
// gives the copy rotation = byte * 360 / 256 (prev 0, the constructor's setLocationAndAngles) and the watched flag (index 8, the S1C after the spawn); `angles` marks it.
export function spawnBallCopy(kind, s) {
  const [sx, sy, sz, ax, ay, az] = s;
  const [cax, cay, caz] = fireballAcceleration(ax / 8000, ay / 8000, az / 8000);
  const c = { kind, sx, sy, sz, x: sx / 32, y: sy / 32, z: sz / 32, vx: 0, vy: 0, vz: 0, ax: cax, ay: cay, az: caz };
  if (s.length >= 8 && Number.isFinite(s[6]) && Number.isFinite(s[7])) Object.assign(c, { angles: true, yaw: angleOfByte(s[6]), pitch: angleOfByte(s[7]), prevYaw: 0, prevPitch: 0, flag: s[8] === 1, fire: 0 });
  return c;
}
// Entity.setPositionAndRotation2 for the copy: the position, then the box (width = height, yOffset 0) lifted onto the highest block box it overlaps.
function place(c, x, y, z, world) {
  c.x = x; c.y = y; c.z = z;
  if (!world?.solid) return;
  const w = f(BALL_KINDS[c.kind]?.width ?? 1), r = w / 2, grow = 0.03125;
  const list = ItemEntities.prototype.boxes.call(null, world, x - r + grow, y, z - r + grow, x + r - grow, y + w, z + r - grow);
  if (!list.length) return;
  let top = 0;
  for (const b of list) if (b[4] > top) top = b[4];
  c.y += top - y;
}
// setRotation (sa.b(FF)) from a packet's angle bytes: (float)(byte * 360) / 256, then % 360.
function turnTo(c, p) {
  if (!c.angles || !Number.isFinite(p.yb) || !Number.isFinite(p.pb)) return;
  c.yaw = f(angleOfByte(p.yb) % 360); c.pitch = f(angleOfByte(p.pb) % 360);
}
// One packet of the row, as NetHandlerPlayClient applies it: S15 / S17 (serverPos += delta; S15 keeps the current angles, which setRotation still takes % 360), S16 (the
// angles; bjb.a(hf) re-places at serverPos too), S18 (serverPos = packet, y + 1/64), S12 (Entity.setVelocity), S1C (the watched flag 0).
export function applyBallPacket(c, p, world = null) {
  if (p.type === 'move' || p.type === 'look') {
    if (p.type === 'move') { c.sx += p.dx; c.sy += p.dy; c.sz += p.dz; }
    place(c, c.sx / 32, c.sy / 32, c.sz / 32, world);
    if (c.angles) { if (p.yb !== undefined) turnTo(c, p); else { c.yaw = f(c.yaw % 360); c.pitch = f(c.pitch % 360); } }
  }
  else if (p.type === 'teleport') { c.sx = p.x; c.sy = p.y; c.sz = p.z; place(c, c.sx / 32, c.sy / 32 + 0.015625, c.sz / 32, world); turnTo(c, p); }
  else if (p.type === 'velocity') { c.vx = p.vx / 8000; c.vy = p.vy / 8000; c.vz = p.vz / 8000; }
  else if (p.type === 'meta' && c.angles && p.f !== undefined) c.flag = p.f === 1;
}
// Entity.isBurning of the copy: !isImmuneToFire && (fire > 0 || remote && flag 0); EntityWitherSkull.isBurning returns false.
export const ballCopyBurning = (c) => !!c?.angles && c.kind !== 'witherSkull' && (c.fire > 0 || !!c.flag);
// ze.h on the copy. `wet(c)`: Entity.isInWater at the start of the update, or `water(c)` { wet, push } (handleWaterMovement with the flow's 0.014 push); `spawn(name, x,
// y, z, vx, vy, vz)` draws a particle; `blue`: the skull's watcher flag. b82: an angle-bearing copy keeps prev = current (onEntityUpdate), its counter (0 on a remote
// world, then setFire(1): 20) and turns toward its own motion after the move. No sweep: onImpact and the setDead test are server-only (see the head of this file).
export function stepBallCopy(c, { wet = () => false, water = null, spawn = () => {}, blue = false } = {}) {
  if (c.angles) { c.prevYaw = c.yaw; c.prevPitch = c.pitch; }
  const w = water ? water(c) : null, inWater = w ? !!w.wet : !!wet(c);
  if (w?.push && c.angles) { c.vx += w.push[0]; c.vy += w.push[1]; c.vz += w.push[2]; } // a batch 81 row's copy keeps its batch 81 flight
  // b83 tracker83: handleWaterMovement's splash on the copy's own Entity.rand (fireball-splash.js): entering water after its first update, 1 + width * 20 bubble and splash
  // particles at floor(minY) + 1 with the pushed motion; the sound's two floats are drawn but RenderGlobal.playSound is empty (the server's S29 is the one heard).
  if (w && c.angles) ballSplash(c, w.wet, c.y, BALL_KINDS[c.kind]?.width ?? 1, { fx: { spawn }, rand: (c.rand ??= new JavaRandom(Math.floor(Math.random() * 2 ** 48))) });
  if (c.angles) c.fire = 20;
  c.x += c.vx; c.y += c.vy; c.z += c.vz;
  if (c.angles) fireballTurn(c, c.vx, c.vy, c.vz);
  if (inWater) for (let i = 0; i < 4; i++) spawn('bubble', c.x - c.vx * 0.25, c.y - c.vy * 0.25, c.z - c.vz * 0.25, c.vx, c.vy, c.vz);
  const k = inWater ? FIREBALL.waterFriction : c.kind === 'witherSkull' && blue ? SKULL.factorBlue : FIREBALL.friction;
  c.vx = (c.vx + c.ax) * k; c.vy = (c.vy + c.ay) * k; c.vz = (c.vz + c.az) * k;
  spawn('smoke', c.x, c.y + 0.5, c.z, 0, 0, 0);
}
// A dispEnts row with the tracker field `track` (`t` on the wire), in the native client tick order (bytecode-read, Minecraft.runTick (bao): the "level" section's
// WorldClient.updateEntities (bjf.h at offset 1811) runs before the "pendingConnection" section's NetworkManager.processReceivedPackets (ej.a at 2042)): a copy that exists
// runs its update first and then takes this message's packets; a new copy (the S0E) is only placed, its first update is in the next message. The row takes the copy's place
// (px/py/pz the place before the update, lastTickPos, for the renderer's interpolation) and, b82, its angles and burning state when the copy holds them.
// `opts`: { world, wet(row-like), water(row-like), spawn }.
export function flyBallRow(row, { world = null, wet = () => false, water = null, spawn = () => {} } = {}) {
  const t = row.track;
  if (!row.copy) {
    if (!t?.s) return false;
    const c = row.copy = spawnBallCopy(row.kind, t.s);
    row.px = row.x = c.x; row.py = row.y = c.y; row.pz = row.z = c.z; // ze.<init> setLocationAndAngles: lastTickPos = pos
    takeAngles(row, c);
    return true;
  }
  const c = row.copy, at = (cc) => ({ kind: row.kind, px: cc.x, py: cc.y, pz: cc.z });
  row.px = c.x; row.py = c.y; row.pz = c.z;
  stepBallCopy(c, { wet: (cc) => wet(at(cc)), water: water ? (cc) => water(at(cc)) : null, spawn, blue: !!row.blue });
  for (const p of t?.p ?? []) applyBallPacket(c, p, world);
  row.x = c.x; row.y = c.y; row.z = c.z;
  takeAngles(row, c);
  return true;
}
function takeAngles(row, c) {
  if (!c.angles) return;
  row.yaw = c.yaw; row.pitch = c.pitch; row.prevYaw = c.prevYaw; row.prevPitch = c.prevPitch;
  row.burning = ballCopyBurning(c);
}
