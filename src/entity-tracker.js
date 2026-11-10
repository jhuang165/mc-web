// EntityTrackerEntry, EntityTracker.updateTrackedEntities and the client's view of a tracked entity, for the one integrated-server
// player (natural-spawning.md "Batch 40", tools/probes/TrackerProbe.java, public/research/tracker-reference.json).
// Executed (the unchanged EntityTrackerEntry `my` and Entity$EnumEntitySize `se`, replayed by entity-tracker.test.js):
//  - sendLocationToAllClients: positions go out as int(x * 32) (x and z rounded by the entity's size class, y floored), every
//    updateFrequency ticks (3 for mobs) or at once for an airborne flag or a changed data watcher, as a relative move when the
//    change is 4/32 block or more (or every 60th tick), a look packet for 4/256 turn steps, a teleport when a delta leaves
//    -128..127 or 400 ticks passed since the last teleport;
//  - the tracking list is re-evaluated only when the entity itself moved more than 4 blocks from where it was last evaluated, or when
//    the player's own entry did (the player moved more than 4 blocks); the test is the entry's last sent position divided by 32 with
//    Java integer division (truncation toward zero), a square of the entry's range, and entering needs the player to be watching the
//    entity's chunk; leaving needs only the range.
// Bytecode-read (not executed): EntityTracker clamps every range to 144 (IntegratedPlayerList sets the view distance 10 before the
// worlds exist; EntityTracker keeps (10 * 16 - 16)), PlayerManager's watched chunk square and managed position, and the client:
// S0F places the entity at pos / 32; S14 moves serverPos by the delta and sets a target pos / 32 reached in 3 steps (pos += (target -
// pos) / n); S18 sets serverPos and the target y + 1/64; S13 destroy is queued by EntityPlayerMP.func_152339_d and flushed in the
// player's next onUpdate, so the client entity lives one client tick longer than the tracking list says.
// Not modelled: velocity packets (the client keeps moving a mob by its motion between position packets), the chunk send queue
// (chunks are watched at once), mounted entities (the client position is the live one), every entity that is not a mob.
import { trackingRange } from "./ring-events.js";

export const TRACKER_LIMIT = 144; // EntityTracker.e with the integrated view distance 10
export const MOB_UPDATE_FREQUENCY = 3; // EntityTracker.trackEntity: IAnimals, EntityBat, EntityWither, EntityDragon, EntitySquid
export const CLIENT_INTERPOLATION = 3; // setPositionAndRotation2(..., 3)

const floor = Math.floor;
const f = Math.fround;
const ceilInt = (d) => { const i = Math.trunc(d); return d > i ? i + 1 : i; }; // MathHelper.ceiling_double_int
const floorFloat = (v) => { const i = Math.trunc(v); return v < i ? i - 1 : i; }; // MathHelper.floor_float
const idiv = (a, b) => Math.trunc(a / b); // Java int division

// Entity$EnumEntitySize.getXPosition (se.a(double)): the fraction of x within its block picks floor or ceil of x * 32 for each size class.
export function sizeClass(width) {
  const r = f(width) % 2; // Entity.setSize: width % 2 against 0.375, 0.75, 1, 1.375, 1.75
  return r < 0.375 ? 1 : r < 0.75 ? 2 : r < 1 ? 3 : r < 1.375 ? 4 : r < 1.75 ? 5 : 6;
}
export function encodeAxis(size, v) {
  const d = v - (floor(v) + 0.5), s = v * 32;
  if (size === 3) return d > 0 ? floor(s) : ceilInt(s);
  if (size === 6) return d > 0 ? ceilInt(s) : floor(s);
  const edge = size <= 2 ? 0.3125 : 0.1875;
  const low = d < 0 ? d < -edge : d < edge; // sizes 1 and 4 round up there, sizes 2 and 5 round down
  return (size === 1 || size === 4) === low ? ceilInt(s) : floor(s);
}
export const encodeY = (v) => floor(v * 32);
const angle = (deg) => floorFloat(f(f(f(deg) * 256) / 360));

// The tracker entry for one mob and one player. `view` is { player, watches(cx, cz) }.
export class TrackerEntry {
  constructor(e, { range, frequency = MOB_UPDATE_FREQUENCY, velocity = true, size = 2, arrow = false }, view) {
    this.e = e;
    this.range = Math.min(range, TRACKER_LIMIT);
    this.frequency = frequency;
    this.velocity = velocity;
    this.size = size;
    this.arrow = arrow;
    this.view = view;
    this.lastX = floor(e.x * 32); this.lastY = floor(e.y * 32); this.lastZ = floor(e.z * 32);
    this.lastYaw = angle(e.rotationYaw ?? 0); this.lastPitch = angle(e.rotationPitch ?? 0); this.lastHead = angle(e.rotationYawHead ?? 0);
    this.refX = this.refY = this.refZ = 0;
    this.initialised = false;
    this.ticks = 0;
    this.sinceTeleport = 0;
    this.ridden = false;
    this.tracked = false; // trackingPlayers contains the player
    this.packets = []; // what the client will process, oldest first
  }
  emit(packet) { this.packets.push(packet); this.view.log?.(packet); } // to the client's queue (and a test log)
  send(packet) { if (this.tracked) this.emit(packet); }
  // EntityTrackerEntry.sendLocationToAllClients
  sendLocation(airBorne = false, dataChanged = false) {
    const e = this.e;
    this.updated = false;
    const dx0 = e.x - this.refX, dy0 = e.y - this.refY, dz0 = e.z - this.refZ;
    if (!this.initialised || dx0 * dx0 + dy0 * dy0 + dz0 * dz0 > 16) {
      this.refX = e.x; this.refY = e.y; this.refZ = e.z;
      this.initialised = true;
      this.updated = true;
      this.updatePlayerList();
    }
    if (this.ticks % this.frequency === 0 || airBorne || dataChanged) {
      const yaw = angle(e.rotationYaw ?? 0), pitch = angle(e.rotationPitch ?? 0);
      if (!e.ridingEntity) {
        this.sinceTeleport++;
        const i = encodeAxis(this.size, e.x), j = encodeY(e.y), k = encodeAxis(this.size, e.z);
        const dx = i - this.lastX, dy = j - this.lastY, dz = k - this.lastZ;
        const move = Math.abs(dx) >= 4 || Math.abs(dy) >= 4 || Math.abs(dz) >= 4 || this.ticks % 60 === 0;
        const look = Math.abs(yaw - this.lastYaw) >= 4 || Math.abs(pitch - this.lastPitch) >= 4;
        if (this.ticks > 0 || this.arrow) {
          const small = dx >= -128 && dx < 128 && dy >= -128 && dy < 128 && dz >= -128 && dz < 128;
          if (small && this.sinceTeleport <= 400 && !this.ridden) {
            if (move && look) this.send({ type: "moveLook", dx, dy, dz, yaw, pitch });
            else if (move) this.send({ type: "move", dx, dy, dz });
            else if (look) this.send({ type: "look", yaw, pitch });
          } else {
            this.sinceTeleport = 0;
            this.send({ type: "teleport", x: i, y: j, z: k, yaw, pitch });
          }
        }
        if (move) { this.lastX = i; this.lastY = j; this.lastZ = k; }
        if (look) { this.lastYaw = yaw; this.lastPitch = pitch; }
        this.ridden = false;
      } else {
        // a rider only turns; the entry keeps its encoded position (the client moves the rider with its mount)
        if (Math.abs(yaw - this.lastYaw) >= 4 || Math.abs(pitch - this.lastPitch) >= 4) { this.send({ type: "look", yaw, pitch }); this.lastYaw = yaw; this.lastPitch = pitch; }
        this.lastX = encodeAxis(this.size, e.x); this.lastY = encodeY(e.y); this.lastZ = encodeAxis(this.size, e.z);
        this.ridden = true;
      }
      const head = angle(e.rotationYawHead ?? 0);
      if (Math.abs(head - this.lastHead) >= 4) { this.send({ type: "head", head }); this.lastHead = head; }
    }
    this.ticks++;
  }
  updatePlayerList() { this.tryStart(); }
  // EntityTrackerEntry.tryStartWachingThis: the square test on lastScaledPosition / 32 with integer division
  tryStart() {
    const p = this.view.player, e = this.e;
    if (!p) return;
    const dx = p.x - idiv(this.lastX, 32), dz = p.z - idiv(this.lastZ, 32);
    if (dx >= -this.range && dx <= this.range && dz >= -this.range && dz <= this.range) {
      if (!this.tracked && this.view.watches(floor(e.x / 16), floor(e.z / 16))) {
        this.tracked = true;
        this.emit({ type: "spawn", x: encodeAxis(this.size, e.x), y: encodeY(e.y), z: encodeAxis(this.size, e.z) });
      }
    } else if (this.tracked) {
      this.tracked = false;
      this.emit({ type: "destroy" });
    }
  }
  // EntityTrackerEntry.removePlayerFromTracker, when the entity leaves the world
  remove() { if (this.tracked) { this.tracked = false; this.emit({ type: "destroy" }); } }
}

// The client's entity (NetHandlerPlayClient S0F/S14/S18/S13 handlers, EntityLivingBase.onLivingUpdate's interpolation).
export class ClientEntity {
  constructor() { this.present = false; this.x = this.y = this.z = 0; this.tx = this.ty = this.tz = 0; this.increments = 0; this.sx = this.sy = this.sz = 0; this.pendingDestroy = 0; }
  apply(p) {
    if (p.type === "spawn") {
      this.present = true; this.sx = p.x; this.sy = p.y; this.sz = p.z;
      this.x = this.tx = p.x / 32; this.y = this.ty = p.y / 32; this.z = this.tz = p.z / 32; this.increments = 0;
    } else if (!this.present) return;
    else if (p.type === "move" || p.type === "moveLook") {
      this.sx += p.dx; this.sy += p.dy; this.sz += p.dz;
      this.tx = this.sx / 32; this.ty = this.sy / 32; this.tz = this.sz / 32; this.increments = CLIENT_INTERPOLATION;
    } else if (p.type === "teleport") {
      this.sx = p.x; this.sy = p.y; this.sz = p.z;
      this.tx = this.sx / 32; this.ty = this.sy / 32 + 0.015625; this.tz = this.sz / 32; this.increments = CLIENT_INTERPOLATION;
    } else if (p.type === "destroy") this.present = false;
  }
  // EntityLivingBase.onLivingUpdate
  step() {
    if (!this.present || this.increments <= 0) return;
    this.x += (this.tx - this.x) / this.increments;
    this.y += (this.ty - this.y) / this.increments;
    this.z += (this.tz - this.z) / this.increments;
    this.increments--;
  }
}

// PlayerManager's watched chunk square for the player: centred on the chunk of the managed position ((int) x >> 4), which moves
// when the player is 8 blocks from it and in another chunk (updateMountedMovingPlayer, mq.d).
export class PlayerWatch {
  constructor(radius = 10) { this.radius = radius; this.managed = null; this.cx = 0; this.cz = 0; }
  update(p) {
    if (!this.managed) { this.managed = { x: p.x, z: p.z }; this.cx = Math.trunc(p.x) >> 4; this.cz = Math.trunc(p.z) >> 4; return; }
    const dx = this.managed.x - p.x, dz = this.managed.z - p.z;
    if (dx * dx + dz * dz < 64) return;
    const i = Math.trunc(p.x) >> 4, j = Math.trunc(p.z) >> 4;
    if (i - (Math.trunc(this.managed.x) >> 4) === 0 && j - (Math.trunc(this.managed.z) >> 4) === 0) return;
    this.managed = { x: p.x, z: p.z }; this.cx = i; this.cz = j;
  }
  watches(cx, cz) { return Math.abs(cx - this.cx) <= this.radius && Math.abs(cz - this.cz) <= this.radius; }
}

// The tracker of an EntityWorld: one entry and one client entity per mob. update() is EntityTracker.updateTrackedEntities followed by
// the client tick (packets in order, then the interpolation step); a mob's client position before the tick's packets are applied is
// what its status sounds use (clientPosition).
export class MobTracker {
  constructor(viewChunks = 10) {
    this.watch = new PlayerWatch(viewChunks);
    this.view = { player: null, watches: (cx, cz) => this.watch.watches(cx, cz), log: null };
    this.entries = new Map();
    this.player = { initialised: false, x: 0, y: 0, z: 0 };
    this.tick = 0;
  }
  // a player the tracker has not seen tick yet (a client sound drained before the first update)
  attach(player) { if (!this.view.player) { this.view.player = player; this.watch.update(player); } }
  set viewChunks(n) { this.watch.radius = n; }
  entryOf(e, size) {
    let en = this.entries.get(e);
    if (!en) {
      en = { entry: new TrackerEntry(e, { range: trackingRange(e.type), size: sizeClass(size), velocity: e.type !== "bat" && e.type !== "wither" }, this.view), client: new ClientEntity(), health: e.health, wasGround: !!e.onGround };
      this.entries.set(e, en);
      if (this.view.player) { en.entry.updatePlayerList(); this.flush(en); } // EntityTracker.addEntityToTracker -> updatePlayerList at once
    }
    return en;
  }
  // The client takes the queue in order; a destroy (EntityPlayerMP.func_152339_d) is flushed by the player's next update, one tick later.
  flush(en) {
    const keep = [];
    let blocked = false;
    for (const p of en.entry.packets) {
      if (!blocked && p.type === "destroy") { p.after ??= this.tick + 1; if (p.after > this.tick) blocked = true; }
      if (blocked) keep.push(p); else en.client.apply(p);
    }
    en.entry.packets = keep;
  }
  // mobs: the live list; size(e) -> [width, height]; player { x, y, z }
  update(mobs, player, size) {
    this.serverTick(mobs, player, size);
    this.clientTick();
  }
  serverTick(mobs, player, size) {
    this.tick++;
    this.view.player = player;
    this.watch.update(player);
    const alive = new Set(mobs);
    for (const [e, en] of this.entries) if (!alive.has(e)) { en.entry.remove(); this.entries.delete(e); en.client.present = false; }
    // 1. every entry sends its location
    for (const e of mobs) {
      const en = this.entryOf(e, size(e)[0]);
      const jumped = en.wasGround && !e.onGround && (e.vy ?? e.motionY ?? 0) > 0;
      const airBorne = e.airBorne === true || jumped;
      en.entry.sendLocation(airBorne, e.health !== en.health);
      en.health = e.health; en.wasGround = !!e.onGround; if (e.airBorne) e.airBorne = false;
    }
    // 2. the player's own entry (range 512, every 2 ticks) flags itself when it moved more than 4 blocks
    const p = this.player;
    let flagged = false;
    const dx = player.x - p.x, dy = (player.y ?? 0) - p.y, dz = player.z - p.z;
    if (!p.initialised || dx * dx + dy * dy + dz * dz > 16) { p.x = player.x; p.y = player.y ?? 0; p.z = player.z; p.initialised = true; flagged = true; }
    // 3. a flagged player re-evaluates every entry; an entry that moved did so in sendLocation (updatePlayerList)
    this.lastFlagged = flagged;
    if (flagged) for (const en of this.entries.values()) en.entry.tryStart();
  }
  // the client tick: packets in order, then the interpolation step
  clientTick() { for (const en of this.entries.values()) { this.flush(en); en.client.step(); } }
  // the client's entity for a mob, if the player has one
  clientOf(e, size) { const en = this.entryOf(e, size); return en.client.present ? en.client : null; }
  tracking(e, size) { return this.entryOf(e, size).entry.tracked; }
}
