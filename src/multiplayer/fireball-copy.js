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
// Not modelled: the copy's rotation (the server's entry sends no look packets here: the stand-in never turns; RenderWitherSkull keeps turning to the row's motion), the
// extinguish flicker of a ball in water (one more watcher send), the client sweep (it never ends the copy).
import { TrackerEntry, sizeClass } from '../entity-tracker.js';
import { FIREBALL, fireballAcceleration } from '../blaze-ghast.js';
import { SKULL } from '../wither-boss.js';
import { ItemEntities } from '../item-entities.js';

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
export class BallTracks {
  constructor() { this.map = new Map(); }
  // After the tick's entity updates, once per tick: each live ball's entry runs sendLocationToAllClients.
  update(balls) {
    const live = new Set();
    for (const b of balls) {
      if (!b || b.dead || !BALL_KINDS[b.kind]) continue;
      live.add(b);
      let t = this.map.get(b);
      if (!t) {
        const o = { type: 'fireball', x: b.x, y: b.y, z: b.z, vx: 0, vy: 0, vz: 0, rotationYaw: 0, rotationPitch: 0 };
        t = { o, en: new BallEntry(o, sizeClass(BALL_KINDS[b.kind].width)), packets: [] };
        this.map.set(b, t);
      }
      Object.assign(t.o, { x: b.x, y: b.y, z: b.z, vx: b.vx ?? 0, vy: b.vy ?? 0, vz: b.vz ?? 0, velocityChanged: !!b.velocityChanged });
      b.velocityChanged = false;
      t.en.sendLocation(false, t.en.ticks === 1);
      t.packets = t.en.packets.splice(0).map(({ type, dx, dy, dz, x, y, z, vx, vy, vz }) => (type === 'move' ? { type, dx, dy, dz } : type === 'teleport' ? { type, x, y, z } : type === 'velocity' ? { type, vx, vy, vz } : { type }));
    }
    for (const b of [...this.map.keys()]) if (!live.has(b)) this.map.delete(b);
  }
  // The row field `t`: `s` the S0E a new viewer would get now (floor(pos * 32) and the acceleration ints), `p` this tick's packets when there are any.
  row(b) {
    const t = this.map.get(b);
    if (!t) return undefined;
    const out = { s: [Math.floor(b.x * 32), Math.floor(b.y * 32), Math.floor(b.z * 32), accelInt(b.ax ?? 0), accelInt(b.ay ?? 0), accelInt(b.az ?? 0)] };
    if (t.packets.length) out.p = t.packets;
    return out;
  }
}

// --- the client copy ---
// bjb.a(fw) for 63 / 64 / 66: the position from the packet, motion 0, the acceleration normalised to 0.1 (ze.<init>).
export function spawnBallCopy(kind, s) {
  const [sx, sy, sz, ax, ay, az] = s;
  const [cax, cay, caz] = fireballAcceleration(ax / 8000, ay / 8000, az / 8000);
  return { kind, sx, sy, sz, x: sx / 32, y: sy / 32, z: sz / 32, vx: 0, vy: 0, vz: 0, ax: cax, ay: cay, az: caz };
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
// One packet of the row, as NetHandlerPlayClient applies it: S15 (serverPos += delta), S18 (serverPos = packet, y + 1/64), S12 (Entity.setVelocity).
export function applyBallPacket(c, p, world = null) {
  if (p.type === 'move') { c.sx += p.dx; c.sy += p.dy; c.sz += p.dz; place(c, c.sx / 32, c.sy / 32, c.sz / 32, world); }
  else if (p.type === 'teleport') { c.sx = p.x; c.sy = p.y; c.sz = p.z; place(c, c.sx / 32, c.sy / 32 + 0.015625, c.sz / 32, world); }
  else if (p.type === 'velocity') { c.vx = p.vx / 8000; c.vy = p.vy / 8000; c.vz = p.vz / 8000; }
}
// ze.h on the copy. `wet(c)`: Entity.isInWater at the start of the update; `spawn(name, x, y, z, vx, vy, vz)` draws a particle; `blue`: the skull's watcher flag.
export function stepBallCopy(c, { wet = () => false, spawn = () => {}, blue = false } = {}) {
  const inWater = !!wet(c);
  c.x += c.vx; c.y += c.vy; c.z += c.vz;
  if (inWater) for (let i = 0; i < 4; i++) spawn('bubble', c.x - c.vx * 0.25, c.y - c.vy * 0.25, c.z - c.vz * 0.25, c.vx, c.vy, c.vz);
  const k = inWater ? FIREBALL.waterFriction : c.kind === 'witherSkull' && blue ? SKULL.factorBlue : FIREBALL.friction;
  c.vx = (c.vx + c.ax) * k; c.vy = (c.vy + c.ay) * k; c.vz = (c.vz + c.az) * k;
  spawn('smoke', c.x, c.y + 0.5, c.z, 0, 0, 0);
}
// A dispEnts row with the tracker field `track` (`t` on the wire), in the native client tick order (bytecode-read, Minecraft.runTick (bao): the "level" section's
// WorldClient.updateEntities (bjf.h at offset 1811) runs before the "pendingConnection" section's NetworkManager.processReceivedPackets (ej.a at 2042)): a copy that exists
// runs its update first and then takes this message's packets; a new copy (the S0E) is only placed, its first update is in the next message. The row takes the copy's place
// (px/py/pz the place before the update, lastTickPos, for the renderer's interpolation). `opts`: { world, wet(row-like), spawn }.
export function flyBallRow(row, { world = null, wet = () => false, spawn = () => {} } = {}) {
  const t = row.track;
  if (!row.copy) {
    if (!t?.s) return false;
    const c = row.copy = spawnBallCopy(row.kind, t.s);
    row.px = row.x = c.x; row.py = row.y = c.y; row.pz = row.z = c.z; // ze.<init> setLocationAndAngles: lastTickPos = pos
    return true;
  }
  const c = row.copy;
  row.px = c.x; row.py = c.y; row.pz = c.z;
  stepBallCopy(c, { wet: (cc) => wet({ kind: row.kind, px: cc.x, py: cc.y, pz: cc.z }), spawn, blue: !!row.blue });
  for (const p of t?.p ?? []) applyBallPacket(c, p, world);
  row.x = c.x; row.y = c.y; row.z = c.z;
  return true;
}
