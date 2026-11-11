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
// Batch 41 (tracker-reference.json clientWalk, clientKnock, clientFall, clientTeleport, clientSpawn, clientUnloaded; the client entity is an
// executed EntityChicken on a remote world double, the packet handlers are replicated in TrackerProbe.handle): S12 velocity packets
// (my: motion change over 0.02 squared, or a motion of exactly zero after a change, sent before the position packet; Entity.velocityChanged
// at the end; the spawn packet carries the motion), the client's motion (setVelocity = packet / 8000, spawn (float) / 8000f), and
// EntityLivingBase.onLivingUpdate on the client: interpolation, else 0.98 drag, the 0.005 cut, then moveEntityWithHeading(0, 0).
// Batch 43 (tracker-mounts-reference.json; tools/probes/TrackerMountsProbe.java executes the real client classes): S1B attach (EntityTrackerEntry sends
// attach(0) when ridingEntity differs from the last one sent (null at the start) or every 60th tick while riding, in tryStartWachingThis for a rider, and
// attach(1) for a leashed EntityLiving at the start and whenever the leash changes), the client's mountEntity / updateRidden / updateRiderPosition (the mount
// updates first, then its rider, then the seat snaps the rider's position), the client's rotation (S0F/S14/S16/S17/S18 angles, the interpolation, the head packet)
// and the body yaw of an AI mob (EntityBodyHelper) that the chicken's seat reads, and the client's own water flags.
// Not modelled: the chunk send queue (chunks are watched at once), a mount the player rides (it keeps its live position for the camera), every entity
// that is not a mob, client movement of flying and swimming mobs (CLIENT_PHYSICS_OFF: they are interpolated only).
import { trackingRange } from "./ring-events.js";
import { mountEntity, seatPosition } from "./mob-riding.js";
import { wrapFloat, wrapDouble, wingFlapPitch, moveNoClip, setPosition as setDragonPosition, updateParts, PART_SIZES, partBox } from "./dragon.js";
import { squidState } from "./squid-bat.js";
import { JavaRandom } from "./java-random.js";

export const TRACKER_LIMIT = 144; // EntityTracker.e with the integrated view distance 10
export const MOB_UPDATE_FREQUENCY = 3; // EntityTracker.trackEntity: IAnimals, EntityBat, EntityWither, EntityDragon, EntitySquid
export const CLIENT_INTERPOLATION = 3; // setPositionAndRotation2(..., 3)
// Mobs whose client class is not run at all: the dragon moves by its ring buffer of positions (dragon.js) and keeps its live position. The
// ghast (EntityFlying), squid, bat, wither and blaze run their own client onUpdate (entities.js moveClient, clientEnvironment and
// clientAfterMove), as the executed flyGhast / flySquid / flyBat / flyWither / flyBlaze records show.
export const NOT_CREATURES = new Set(["ghast", "slime", "magma_cube", "ender_dragon", "bat"]);
// The dragon's client onLivingUpdate is its own (ClientEntity.dragonUpdate); it has no moveEntityWithHeading call, so only the body turn runs after it.
const CLIENT_PHYSICS_OFF = new Set(["ender_dragon"]);
// hy / fz: motion clamped to 3.9, (int)(m * 8000)
const velocityInt = (v) => Math.trunc(Math.max(-3.9, Math.min(3.9, v)) * 8000) + 0; // + 0: Java ints have no negative zero

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
const byte = (v) => (v << 24) >> 24; // the position packets' rotation fields are bytes (the entry compares the ints)
const angle = (deg) => floorFloat(f(f(f(deg) * 256) / 360));
// S0FPacketSpawnMob's constructor casts (byte)(int)(angle * 256 / 360): truncation, unlike the tracker entry's floor_float for its look packets
const spawnAngle = (deg) => Math.trunc(f(f(f(deg) * 256) / 360));
const unangle = (b) => f(f(byte(b) * 360) / 256); // (float)(packet byte * 360) / 256.0F
const wrap180 = (d) => { d %= 360; return d >= 180 ? d - 360 : d < -180 ? d + 360 : d; }; // MathHelper.wrapAngleTo180_double
// The leash holder of a live mob as the S1B(1) packet names it, or null: the player, another mob (by uuid) or a knot's block.
const holderOf = (l) => l?.holder === "player" ? { kind: "player" } : l?.holder === "mob" && l.holderUuid ? { kind: "mob", uuid: l.holderUuid } : l?.knot ? { kind: "knot", x: l.knot.x, y: l.knot.y, z: l.knot.z } : null;
const leashKey = (e) => { const h = holderOf(e.leash); return h ? `${h.kind}:${h.uuid ?? ""}${h.x ?? ""},${h.y ?? ""},${h.z ?? ""}` : ""; };

// The tracker entry for one mob and one player. `view` is { player, watches(cx, cz) }.
export class TrackerEntry {
  constructor(e, { range, frequency = MOB_UPDATE_FREQUENCY, velocity = true, size = 2, arrow = false, object = null }, view) {
    this.e = e;
    this.object = object; // not a mob: { kind, data } of the S0E spawn packet, or { orb: true } for S11 (object-tracker.js)
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
    this.lastVX = this.lastVY = this.lastVZ = 0; // j, k, l: the motion last sent
    this.packets = []; // what the client will process, oldest first
    this.lastRiding = null; // EntityTrackerEntry.w: the vehicle last sent in S1B(0)
    this.lastHang = !!e.batHanging; // the bat's hanging flag in the data watcher the client last got
    this.lastHealth = e.health; // the dragon's health (data watcher index 6) the client last got
    this.lastAir = e.air ?? 300; // the squid's air (data watcher index 1) the client last got
    this.lastLeash = ""; // the leash holder last sent in S1B(1) (a key of leashKey)
  }
  emit(packet) { this.packets.push(packet); this.view.log?.(packet); } // to the client's queue (and a test log)
  send(packet) { if (this.tracked) this.emit(packet); }
  // EntityTrackerEntry.sendLocationToAllClients
  sendLocation(airBorne = false, dataChanged = false) {
    const e = this.e;
    this.updated = false;
    // S1B(1): EntityLiving.setLeashedToEntity / clearLeashed tell everyone tracking at once (bytecode-read), so before this tick's packets
    const key = leashKey(e);
    if (key !== this.lastLeash) { this.lastLeash = key; this.send({ type: "attach", mode: 1, entity: e, holder: holderOf(e.leash) }); }
    const dx0 = e.x - this.refX, dy0 = e.y - this.refY, dz0 = e.z - this.refZ;
    if (!this.initialised || dx0 * dx0 + dy0 * dy0 + dz0 * dz0 > 16) {
      this.refX = e.x; this.refY = e.y; this.refZ = e.z;
      this.initialised = true;
      this.updated = true;
      this.updatePlayerList();
    }
    // S1B(0): the vehicle changed, or every 60th tick while riding (my.a(List), before the position packets)
    if (this.lastRiding !== (e.ridingEntity ?? null) || (e.ridingEntity && this.ticks % 60 === 0)) {
      this.lastRiding = e.ridingEntity ?? null;
      this.send({ type: "attach", mode: 0, entity: e, vehicle: this.lastRiding });
    }
    if (this.ticks % this.frequency === 0 || airBorne || dataChanged) {
      const yaw = angle(e.rotationYaw ?? 0), pitch = angle(e.rotationPitch ?? 0);
      if (!e.ridingEntity) {
        this.sinceTeleport++;
        const i = encodeAxis(this.size, e.x), j = encodeY(e.y), k = encodeAxis(this.size, e.z);
        const dx = i - this.lastX, dy = j - this.lastY, dz = k - this.lastZ;
        const move = Math.abs(dx) >= 4 || Math.abs(dy) >= 4 || Math.abs(dz) >= 4 || this.ticks % 60 === 0;
        const look = Math.abs(yaw - this.lastYaw) >= 4 || Math.abs(pitch - this.lastPitch) >= 4;
        let pos = null; // the position packet, sent after the velocity one
        if (this.ticks > 0 || this.arrow) {
          const small = dx >= -128 && dx < 128 && dy >= -128 && dy < 128 && dz >= -128 && dz < 128;
          if (small && this.sinceTeleport <= 400 && !this.ridden) {
            if (move && look) pos = { type: "moveLook", dx, dy, dz, yaw: byte(yaw), pitch: byte(pitch) };
            else if (move) pos = { type: "move", dx, dy, dz };
            else if (look) pos = { type: "look", yaw: byte(yaw), pitch: byte(pitch) };
          } else {
            this.sinceTeleport = 0;
            pos = { type: "teleport", x: i, y: j, z: k, yaw: byte(yaw), pitch: byte(pitch) };
          }
        }
        // sendVelocityUpdates: the motion moved by more than 0.02 (squared sum), or any at all while the entity stands at zero motion
        if (this.velocity) {
          const vx = e.vx ?? 0, vy = e.vy ?? 0, vz = e.vz ?? 0;
          const dvx = vx - this.lastVX, dvy = vy - this.lastVY, dvz = vz - this.lastVZ, d3 = dvx * dvx + dvy * dvy + dvz * dvz;
          if (d3 > 0.02 * 0.02 || (d3 > 0 && vx === 0 && vy === 0 && vz === 0)) {
            this.lastVX = vx; this.lastVY = vy; this.lastVZ = vz;
            this.send({ type: "velocity", vx: velocityInt(vx), vy: velocityInt(vy), vz: velocityInt(vz) });
          }
        }
        if (pos) this.send(pos);
        if (move) { this.lastX = i; this.lastY = j; this.lastZ = k; }
        if (look) { this.lastYaw = yaw; this.lastPitch = pitch; }
        this.ridden = false;
      } else {
        // a rider only turns; the entry keeps its encoded position (the client moves the rider with its mount)
        if (Math.abs(yaw - this.lastYaw) >= 4 || Math.abs(pitch - this.lastPitch) >= 4) { this.send({ type: "look", yaw: byte(yaw), pitch: byte(pitch) }); this.lastYaw = yaw; this.lastPitch = pitch; }
        this.lastX = encodeAxis(this.size, e.x); this.lastY = encodeY(e.y); this.lastZ = encodeAxis(this.size, e.z);
        this.ridden = true;
      }
      const head = angle(e.rotationYawHead ?? 0);
      if (Math.abs(head - this.lastHead) >= 4) { this.send({ type: "head", head: byte(head) }); this.lastHead = head; }
    }
    // sendMetadataToAllAssociatedPlayers: the bat's hanging flag (data watcher index 16) is the one watched object that moves a client entity
    if (e.type === "bat" && !!e.batHanging !== this.lastHang) { this.lastHang = !!e.batHanging; this.send({ type: "meta", batHanging: this.lastHang }); }
    // The same S1C also carries the dragon's health (the boss bar and the client's death branch read it) and the squid's air (EntityWaterMob.onEntityUpdate
    // changes it every tick out of the water, so the watched object is dirty and the entry sends its location every tick: observe)
    if ((e.type === "ender_dragon" && e.health !== this.lastHealth) || (e.type === "squid" && (e.air ?? 300) !== this.lastAir)) {
      const meta = { type: "meta" };
      if (e.type === "ender_dragon") meta.health = this.lastHealth = e.health; else meta.air = this.lastAir = e.air ?? 300;
      this.send(meta);
    }
    // Entity.velocityChanged (knockback): the motion goes out at once, to everyone tracking
    if (e.velocityChanged) { this.send({ type: "velocity", vx: velocityInt(e.vx ?? 0), vy: velocityInt(e.vy ?? 0), vz: velocityInt(e.vz ?? 0) }); e.velocityChanged = false; }
    this.ticks++;
  }
  // The data watcher values the S0F spawn packet carries for the mobs whose client copy reads one (S0F's metadata list, applied after the constructor)
  watched() {
    const e = this.e;
    if (e.type === "ender_dragon") return { health: this.lastHealth = e.health };
    if (e.type === "squid") return { air: this.lastAir = e.air ?? 300 };
    return {};
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
        this.lastVX = e.vx ?? 0; this.lastVY = e.vy ?? 0; this.lastVZ = e.vz ?? 0;
        if (this.object) {
          // EntityTrackerEntry.func_151260_c: S0E / S11 at floor(pos * 32) (not the size class rounding), the motion in S0E only when its data
          // is above 0, and a following S12 for every entry that sends velocity (a non-S0F spawn is followed by sendVelocityUpdates' packet).
          const vx = velocityInt(this.lastVX), vy = velocityInt(this.lastVY), vz = velocityInt(this.lastVZ), carried = this.object.data > 0;
          this.emit({ type: "spawn", ...this.object, id: e.id, x: floor(e.x * 32), y: floor(e.y * 32), z: floor(e.z * 32), yaw: angle(e.rotationYaw ?? 0), pitch: angle(e.rotationPitch ?? 0), vx: carried ? vx : 0, vy: carried ? vy : 0, vz: carried ? vz : 0 });
          if (this.velocity) this.emit({ type: "velocity", vx, vy, vz });
        } else this.emit({ type: "spawn", x: encodeAxis(this.size, e.x), y: encodeY(e.y), z: encodeAxis(this.size, e.z), yaw: byte(spawnAngle(e.rotationYaw ?? 0)), pitch: byte(spawnAngle(e.rotationPitch ?? 0)), head: byte(spawnAngle(e.rotationYawHead ?? 0)), vx: velocityInt(this.lastVX), vy: velocityInt(this.lastVY), vz: velocityInt(this.lastVZ), ...this.watched() });
        if (e.type === "bat") { this.lastHang = !!e.batHanging; this.emit({ type: "meta", batHanging: this.lastHang }); } // the spawn's S1C
        // after the spawn: S1B(0) for a rider and S1B(1) for a leashed mob (the periodic one in sendLocation still goes out at the entry's first tick)
        if (e.ridingEntity) this.emit({ type: "attach", mode: 0, entity: e, vehicle: e.ridingEntity });
        const held = holderOf(e.leash);
        if (held) { this.lastLeash = leashKey(e); this.emit({ type: "attach", mode: 1, entity: e, holder: held }); }
      }
    } else if (this.tracked) {
      this.tracked = false;
      this.emit({ type: "destroy" });
    }
  }
  // EntityTrackerEntry.removePlayerFromTracker, when the entity leaves the world
  remove() { if (this.tracked) { this.tracked = false; this.emit({ type: "destroy" }); } }
}

// The client's entity (NetHandlerPlayClient S0F/S14/S18/S12/S13/S1B handlers, EntityLivingBase.onLivingUpdate). It is also the `e` that
// moveEntityWithHeading moves (x y z vx vy vz onGround ...), and carries the previous tick's position for RenderManager's partial tick.
// `ctx` (the MobTracker) resolves what an attach packet names: ctx.clientOf(liveMob) and ctx.holderOf(descriptor).
export class ClientEntity {
  constructor(type = "") {
    this.type = type; this.present = false;
    this.x = this.y = this.z = 0; this.px = this.py = this.pz = 0; this.tx = this.ty = this.tz = 0;
    this.vx = this.vy = this.vz = 0; this.onGround = false; this.increments = 0; this.sx = this.sy = this.sz = 0; this.pendingDestroy = 0;
    this.rotationYaw = this.prevRotationYaw = this.rotationPitch = this.prevRotationPitch = this.tyaw = this.tpitch = 0;
    this.rotationYawHead = this.prevRotationYawHead = this.renderYawOffset = this.prevRenderYawOffset = 0;
    this.bodyTicks = 0; this.bodyHeadYaw = 0; // EntityBodyHelper's counters
    this.batHanging = false; // EntityBat's data watcher flag, from S1C
    this.height = 0; // the client class's own size, kept by the tracker
    // Entity.rand of the client copy (unseeded in Java; the replay seeds it): the squid's rotation speed re-roll reads it
    this.rand = type === "squid" || type === "ender_dragon" ? ClientEntity.makeRandom() : null;
    this.squid = null; // EntitySquid's client fields (squidPitch ... tentacleAngle), set at spawn
    this.dragon = null; // EntityDragon's client fields: ringBuffer, ringBufferIndex, prevAnimTime, animTime, deathTicks, the box and the seven parts
    // The data watcher values the client holds for the mobs that read one: the dragon's health (index 6, from the spawn packet and S1C; null = the
    // live health stands in) and the squid's air (index 1, from the same packets, then the client's own EntityWaterMob.onEntityUpdate).
    this.health = null; this.air = 300;
    this.fx = []; // what the client copy does that the live entity cannot: { sound | particle, ... }, taken by MobTracker.takeFx
    this.leash = null; // EntityLiving.leashedToEntity: { player: true }, a ClientEntity, or { knot: true, x, y, z }
  }
  static makeRandom() { return new JavaRandom(BigInt(Math.floor(Math.random() * 2 ** 48))); }
  apply(p, ctx = null) {
    if (p.type === "spawn") {
      if (this.type === "squid") this.squid = squidState(this.rand); // the constructor rolls rotationVelocity from Entity.rand
      if (this.type === "ender_dragon") {
        // EntityDragon's constructor on the client: setHealth(max) (200), the seven parts, then the spawn packet's data watcher list sets the health
        this.dragon = { ring: new Float64Array(64 * 3), ri: -1, prevAnim: 0, anim: 0, deathTicks: 0, ryv: 0, talk: 0, bb: null,
          parts: PART_SIZES.map(([w, h]) => ({ width: w, height: h, box: partBox(0, 0, 0, w, h) })) };
        this.health = 200;
      }
      if (p.health !== undefined) this.health = p.health;
      if (p.air !== undefined) this.air = p.air;
      this.present = true; this.sx = p.x; this.sy = p.y; this.sz = p.z;
      this.x = this.tx = this.px = p.x / 32; this.y = this.ty = this.py = p.y / 32; this.z = this.tz = this.pz = p.z / 32; this.increments = 0;
      this.onGround = false;
      if (this.dragon) setDragonPosition(this, this.x, this.y, this.z); // setLocationAndAngles -> setPosition: the dragon's 16 x 8 box
      // setLocationAndAngles (a new client entity has no previous angle), then the head from the packet; renderYawOffset starts at 0
      this.rotationYaw = this.prevRotationYaw = this.tyaw = unangle(p.yaw ?? 0);
      this.rotationPitch = this.prevRotationPitch = this.tpitch = unangle(p.pitch ?? 0);
      this.rotationYawHead = this.prevRotationYawHead = unangle(p.head ?? 0);
      this.renderYawOffset = this.prevRenderYawOffset = 0; this.bodyTicks = 0; this.bodyHeadYaw = 0;
      const f = Math.fround; // (float) packet / 8000.0F
      this.vx = f(f(p.vx ?? 0) / 8000); this.vy = f(f(p.vy ?? 0) / 8000); this.vz = f(f(p.vz ?? 0) / 8000);
    } else if (!this.present) return;
    else if (p.type === "move" || p.type === "moveLook" || p.type === "look") {
      // S14: serverPos moves by the delta; a look-only packet also re-aims at serverPos / 32; without a look the current angles are kept
      this.sx += p.dx ?? 0; this.sy += p.dy ?? 0; this.sz += p.dz ?? 0;
      this.tx = this.sx / 32; this.ty = this.sy / 32; this.tz = this.sz / 32; this.increments = CLIENT_INTERPOLATION;
      if (p.type !== "move") { this.tyaw = unangle(p.yaw); this.tpitch = unangle(p.pitch); } else { this.tyaw = this.rotationYaw; this.tpitch = this.rotationPitch; }
    } else if (p.type === "teleport") {
      this.sx = p.x; this.sy = p.y; this.sz = p.z;
      this.tx = this.sx / 32; this.ty = this.sy / 32 + 0.015625; this.tz = this.sz / 32; this.increments = CLIENT_INTERPOLATION;
      this.tyaw = unangle(p.yaw); this.tpitch = unangle(p.pitch);
    } else if (p.type === "head") this.rotationYawHead = unangle(p.head);
    else if (p.type === "meta") { // S1C: the watched objects that changed
      if (p.batHanging !== undefined) this.batHanging = !!p.batHanging;
      if (p.health !== undefined) this.health = p.health;
      if (p.air !== undefined) this.air = p.air;
    }
    else if (p.type === "velocity") { this.vx = p.vx / 8000; this.vy = p.vy / 8000; this.vz = p.vz / 8000; }
    else if (p.type === "attach") {
      // NetHandlerPlayClient.handleEntityAttach (bytecode-read): the vehicle or holder is looked up now, and a missing one clears the link
      if (p.mode === 0) mountEntity(this, p.vehicle ? ctx?.clientOf(p.vehicle) ?? null : null, (c) => c.height);
      else this.leash = (p.holder && ctx?.holderOf(p.holder)) || null;
    } else if (p.type === "destroy") this.present = false;
  }
  // Entity.onUpdate (previous position and angles), then EntityLivingBase.onLivingUpdate. `move(client)` is moveEntityWithHeading(0, 0) on the
  // client's world (null for mobs whose client class moves by its own code, which are interpolated only); `turn(client)` is the body turn
  // that EntityLivingBase.onUpdate runs after it; `pre(client)` is Entity.onEntityUpdate's water and lava check, before the motion.
  step(move = null, turn = null, pre = null) {
    if (!this.present) return;
    this.px = this.x; this.py = this.y; this.pz = this.z;
    this.prevRotationYaw = this.rotationYaw; this.prevRotationPitch = this.rotationPitch;
    this.prevRenderYawOffset = this.renderYawOffset; this.prevRotationYawHead = this.rotationYawHead;
    if (this.type === "ender_dragon" && this.dragon) { this.dragonUpdate(); turn?.(this); return; }
    if (move && pre) pre(this);
    if (this.increments > 0) {
      const n = this.increments, f = Math.fround;
      this.x += (this.tx - this.x) / n;
      this.y += (this.ty - this.y) / n;
      this.z += (this.tz - this.z) / n;
      // setRotation: yaw + wrapAngleTo180(target - yaw) / n and pitch + (target - pitch) / n as floats, then % 360
      this.rotationYaw = f(f(this.rotationYaw + wrap180(this.tyaw - this.rotationYaw) / n) % 360);
      this.rotationPitch = f(f(this.rotationPitch + (this.tpitch - this.rotationPitch) / n) % 360);
      this.increments--;
    } else if (move) { this.vx *= 0.98; this.vy *= 0.98; this.vz *= 0.98; } // !isClientWorld(): the remote entity's drag
    if (!move) return;
    if (Math.abs(this.vx) < 0.005) this.vx = 0;
    if (Math.abs(this.vy) < 0.005) this.vy = 0;
    if (Math.abs(this.vz) < 0.005) this.vz = 0;
    move(this);
    if (this.type === "chicken" && !this.onGround && this.vy < 0) this.vy *= 0.6; // EntityChicken.onLivingUpdate's slow fall runs on both sides
    turn?.(this);
  }
  // The client copy's onUpdate for the dragon (xa, executed: tools/probes/TrackerMountsProbe.java flyDragon and dragonDeath). Order: EntityLivingBase.
  // onEntityUpdate's onDeathUpdate (health <= 0), EntityLiving.onEntityUpdate's living sound roll (alive), then EntityDragon.onLivingUpdate's client
  // branch: the wing flap sound, prevAnimTime, the death puff (health <= 0: three draws, then it returns), the crystal search roll, the wing clock, the
  // ring buffer of the previous 64 yaw / y samples (written before the move), the interpolation toward the packet's position and angles with the dragon's
  // own arithmetic (the yaw and pitch steps are doubles cast to float, no % 360 on the way, setPosition for the box), the body yaw, and the seven
  // parts (sizes, then placement; the wing sweep, the head attack and the block breaking are the server's). There is no moveEntity at all.
  // The health is the client's data watcher value (spawn packet and S1C). Not modelled: the crystal search (client copies of crystals are not
  // tracked here: only its rand.nextInt(10) draw), the client playing the living sound (its roll and pitch draws are made).
  dragonUpdate() {
    const d = this.dragon, fr = Math.fround, rand = this.rand;
    if (this.health <= 0) this.dragonDeathUpdate();
    else {
      const time = d.talk; d.talk = time + 1;
      if (rand.nextInt(1000) < time) { // playLivingSound: getSoundPitch is (rand - rand) * 0.2 + 1 (not a child)
        d.talk = -80;
        this.fx.push({ sound: "mob.enderdragon.growl", volume: 5, pitch: fr(fr(fr(rand.nextFloat() - rand.nextFloat()) * 0.2) + 1), silent: true, x: this.x, y: this.y, z: this.z });
      }
    }
    const flap = wingFlapPitch(d.prevAnim, d.anim, rand);
    if (flap !== null) this.fx.push({ sound: "mob.enderdragon.wings", volume: 5, pitch: flap, x: this.x, y: this.y, z: this.z });
    d.prevAnim = d.anim;
    if (this.health <= 0) {
      const a = fr(fr(rand.nextFloat() - 0.5) * 8), b = fr(fr(rand.nextFloat() - 0.5) * 4), c = fr(fr(rand.nextFloat() - 0.5) * 8);
      this.fx.push({ particle: "largeexplode", x: this.x + a, y: this.y + 2 + b, z: this.z + c });
      return;
    }
    rand.nextInt(10); // updateDragonEnderCrystal: the roll that searches for a crystal within 32 blocks
    const g = fr(fr(0.2) / fr(fr(fr(Math.sqrt(this.vx * this.vx + this.vz * this.vz)) * 10) + 1));
    d.anim = fr(d.anim + fr(g * fr(Math.pow(2, this.vy))));
    this.rotationYaw = wrapFloat(this.rotationYaw);
    if (d.ri < 0) for (let i = 0; i < 64; i++) { d.ring[i * 3] = this.rotationYaw; d.ring[i * 3 + 1] = this.y; }
    if (++d.ri === 64) d.ri = 0;
    d.ring[d.ri * 3] = this.rotationYaw; d.ring[d.ri * 3 + 1] = this.y; d.ring[d.ri * 3 + 2] = 0;
    if (this.increments > 0) {
      const n = this.increments;
      const x = this.x + (this.tx - this.x) / n, y = this.y + (this.ty - this.y) / n, z = this.z + (this.tz - this.z) / n;
      const yaw = fr(this.rotationYaw + wrapDouble(this.tyaw - this.rotationYaw) / n), pitch = fr(this.rotationPitch + (this.tpitch - this.rotationPitch) / n);
      this.increments--;
      setDragonPosition(this, x, y, z);
      this.rotationYaw = fr(yaw % 360); this.rotationPitch = fr(pitch % 360); // setRotation
    }
    this.renderYawOffset = this.rotationYaw;
    updateParts(this, null);
  }
  // EntityDragon.onDeathUpdate (xa.aF) on the client: the counter, the hugeexplosion puff at 180..200 (three draws), moveEntity(0, 0.1, 0) with no
  // clip, and the spin of 20 degrees a tick (renderYawOffset follows). The xp orbs, the end sound and setDead are the server's (!isRemote).
  dragonDeathUpdate() {
    const d = this.dragon, fr = Math.fround, rand = this.rand;
    d.deathTicks++;
    if (d.deathTicks >= 180 && d.deathTicks <= 200) {
      const a = fr(fr(rand.nextFloat() - 0.5) * 8), b = fr(fr(rand.nextFloat() - 0.5) * 4), c = fr(fr(rand.nextFloat() - 0.5) * 8);
      this.fx.push({ particle: "hugeexplosion", x: this.x + a, y: this.y + 2 + b, z: this.z + c });
    }
    moveNoClip(this, 0, 0.10000000149011612, 0);
    this.rotationYaw = fr(this.rotationYaw + 20);
    this.renderYawOffset = this.rotationYaw;
  }
  // EntityWaterMob.onEntityUpdate on the client squid (wu.C, bytecode-read; executed in flySquid / swimSquid): the air read before the base update drops
  // by one out of the water and is set to 0 at -20 (the drowning attackEntityFrom returns false on a client world); in the water, or dead, it is 300.
  // The S1C the server sends every tick out of the water sets it again before this runs.
  clientAir(wet) {
    if (!this.dead && !wet) { this.air--; if (this.air === -20) this.air = 0; } else this.air = 300;
  }
  // A horse the local player rides: EntityHorse.moveEntityWithHeading (wi.e(FF), bytecode-read) is not guarded by isRemote around its steering, so the
  // client copy takes the rider's yaw and half its pitch and jumps on its own. That is NOT ported: this copy just follows the live horse. A ridden pig
  // is different: no EntityPig / EntityAnimal / EntityCreature / EntityLiving / EntityLivingBase client code reads riddenByEntity (the field is read
  // only by the server paths: interact, fall, canBeSteered), and EntityLivingBase.isClientWorld is true only for EntityPlayerSP (blk.br), so the client
  // pig is moved by the packets alone, as the executed ridePig record shows; the rider's seat follows that copy. The camera still uses the live seat.
  followLive(e) {
    this.x = e.x; this.y = e.y; this.z = e.z; this.vx = e.vx ?? 0; this.vy = e.vy ?? 0; this.vz = e.vz ?? 0; this.onGround = !!e.onGround;
    this.tx = this.x; this.ty = this.y; this.tz = this.z; this.increments = 0;
    this.rotationYaw = this.tyaw = e.rotationYaw ?? this.rotationYaw; this.rotationPitch = this.tpitch = e.rotationPitch ?? this.rotationPitch;
    this.renderYawOffset = e.renderYawOffset ?? this.renderYawOffset; this.rotationYawHead = e.rotationYawHead ?? this.rotationYawHead;
  }
  // Entity.updateRidden (sa.ab) for the rider, called after its mount's update: the mount's own death frees it, the motion is zeroed, the
  // rider updates, then the mount's updateRiderPosition seats it. The executed record shows no turn of the rider with its mount's yaw (the
  // server-side copy in mob-riding.js endRidden does turn), so there is none here.
  stepRider(move, turn, pre) {
    const mount = this.ridingEntity;
    if (!mount?.present) { if (mount) mount.riddenBy = null; this.ridingEntity = null; return; }
    this.vx = this.vy = this.vz = 0;
    this.step(move, turn, pre);
    if (this.ridingEntity !== mount) return;
    const seat = seatPosition(mount, this, mount.height);
    this.x = seat.x; this.y = seat.y; this.z = seat.z;
    if (seat.renderYaw !== undefined) this.renderYawOffset = seat.renderYaw; // EntityChicken.updateRiderPosition
    // EntitySkeleton.updateRidden (yl.ab, executed): after the seat, a skeleton on an EntityCreature takes its renderYawOffset
    if ((this.type === "skeleton" || this.type === "wither_skeleton") && !NOT_CREATURES.has(mount.type)) this.renderYawOffset = mount.renderYawOffset;
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
    this.ctx = { clientOf: (live) => this.clientIfTracked(live), holderOf: (d) => this.holderClient(d) };
    this.entries = new Map();
    this.player = { initialised: false, x: 0, y: 0, z: 0 };
    this.tick = 0;
  }
  // a player the tracker has not seen tick yet (a client sound drained before the first update)
  attach(player) { if (!this.view.player) { this.view.player = player; this.watch.update(player); } }
  set viewChunks(n) { this.watch.radius = n; }
  // What an S1B(1) holder descriptor is on the client: the player, a tracked mob's client entity, or a knot's block (null when unknown)
  holderClient(d) {
    if (d.kind === "player") return { player: true };
    if (d.kind === "knot") return { knot: true, x: d.x, y: d.y, z: d.z };
    for (const [e, en] of this.entries) if (e.uuid === d.uuid) return en.client.present ? en.client : null;
    return null;
  }
  entryOf(e, size, height) {
    let en = this.entries.get(e);
    if (!en) {
      en = this.create(e, size);
      if (height !== undefined) en.client.height = height;
      this.entries.set(e, en);
      if (this.view.player) { en.entry.updatePlayerList(); this.flush(en); } // EntityTracker.addEntityToTracker -> updatePlayerList at once
    }
    return en;
  }
  // The entry and the client entity of a new tracked entity (object-tracker.js overrides this for items, orbs and projectiles)
  create(e, size) {
    return { entry: new TrackerEntry(e, { range: trackingRange(e.type), size: sizeClass(size), velocity: e.type !== "bat" && e.type !== "wither" }, this.view), client: new ClientEntity(e.type), health: e.health, air: e.air ?? 300, hang: !!e.batHanging, wasGround: !!e.onGround };
  }
  // What sendLocation is told about the entity this tick (isAirBorne, the data watcher), and the bookkeeping after it
  observe(e, en) {
    const jumped = en.wasGround && !e.onGround && (e.vy ?? e.motionY ?? 0) > 0;
    return { airBorne: e.airBorne === true || jumped, changed: e.health !== en.health || (e.type === "bat" && !!e.batHanging !== en.hang) || (e.type === "squid" && (e.air ?? 300) !== en.air) };
  }
  settle(e, en) { en.health = e.health; en.air = e.air ?? 300; en.hang = !!e.batHanging; en.wasGround = !!e.onGround; if (e.airBorne) e.airBorne = false; }
  // The client takes the queue in order; a destroy (EntityPlayerMP.func_152339_d) is flushed by the player's next update, one tick later.
  flush(en) {
    const keep = [];
    let blocked = false;
    for (const p of en.entry.packets) {
      if (!blocked && p.type === "destroy") { p.after ??= this.tick + 1; if (p.after > this.tick) blocked = true; }
      if (blocked) keep.push(p); else en.client.apply(p, this.ctx);
    }
    en.entry.packets = keep;
  }
  // mobs: the live list; size(e) -> [width, height]; player { x, y, z }
  update(mobs, player, size, physics = null) {
    this.serverTick(mobs, player, size);
    this.clientTick(physics);
  }
  serverTick(mobs, player, size) {
    this.tick++;
    this.view.player = player;
    this.watch.update(player);
    const alive = new Set(mobs);
    for (const [e, en] of this.entries) if (!alive.has(e)) { en.entry.remove(); this.entries.delete(e); en.client.present = false; }
    // 1. every entry sends its location
    // a mob the tracker has not seen enters it first (EntityTracker.addEntityToTracker at spawn: updatePlayerList at once), all of them before
    // any entry sends its location, so a rider's attach can reach the client before its mount exists (riderFirst)
    for (const e of mobs) { const [width, height] = size(e); this.entryOf(e, width, height); }
    // Bytecode-read, not executed (Batch 45): native EntityTracker.updateTrackedEntities walks a HashSet<EntityTrackerEntry> (hashCode = entity id), i.e. bucket order, not
    // this list order; the port has no shared entity-id counter, so the relative order of different entities' packets within a tick is the live list's (each entity's own stream is unchanged).
    for (const e of mobs) {
      const height = size(e)[1];
      const en = this.entries.get(e);
      en.client.height = height;
      const { airBorne, changed } = this.observe(e, en);
      en.entry.sendLocation(airBorne, changed);
      this.settle(e, en);
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
  // `physics(client, mob)` moves a client entity like moveEntityWithHeading(0, 0) on the client's world (entities.js supplies it)
  // `physics` may carry `.turn(client, mob)` (the body turn) and `.pre(client, mob)` (the water check) next to the move itself.
  // World.updateEntities on the client: every entity in list order except a rider whose mount carries it, which is updated right after
  // its mount (a rider whose mount is gone or no longer carries it is let go and updates on its own).
  clientTick(physics = null) {
    for (const en of this.entries.values()) this.flush(en);
    const hooks = (e) => physics && !CLIENT_PHYSICS_OFF.has(e.type)
      ? [(c) => physics(c, e), physics.turn && ((c) => physics.turn(c, e)), physics.pre && ((c) => physics.pre(c, e))]
      : [null, physics?.turn && ((c) => physics.turn(c, e)), null];
    for (const [e, en] of this.entries) {
      const c = en.client;
      if (!c.present) continue;
      const mount = c.ridingEntity;
      if (mount) {
        if (mount.present && mount.riddenBy === c) continue;
        if (mount.riddenBy === c) mount.riddenBy = null;
        c.ridingEntity = null;
      }
      c.dead = e.health <= 0;
      c.step(...hooks(e));
      if (e.rider && e.type !== "pig") c.followLive(e); // the player rides it (entities.js sets `rider`); a ridden pig is NOT client-driven (see followLive)
      const rider = c.riddenBy;
      if (rider?.present) {
        if (rider.ridingEntity !== c) c.riddenBy = null;
        else rider.stepRider(...hooks(this.liveOf(rider)));
      }
    }
  }
  // What the client copies did this tick that needs the world's effects: [{ entity (live), sound | particle, ... }], oldest first
  takeFx() {
    const out = [];
    for (const [e, en] of this.entries) if (en.client.fx.length) { for (const x of en.client.fx) out.push({ entity: e, ...x }); en.client.fx.length = 0; }
    return out;
  }
  liveOf(client) { for (const [e, en] of this.entries) if (en.client === client) return e; return null; }
  // the client entity of a mob that is already tracked, without creating an entry (rendering)
  clientIfTracked(e) { const en = this.entries.get(e); return en?.client.present ? en.client : null; }
  // the client's entity for a mob, if the player has one
  clientOf(e, size) { const en = this.entryOf(e, size); return en.client.present ? en.client : null; }
  tracking(e, size) { return this.entryOf(e, size).entry.tracked; }
}
