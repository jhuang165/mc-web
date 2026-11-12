// The tracker and the client's view of non-mob entities: dropped items, experience orbs, arrows, thrown projectiles, falling blocks and
// primed TNT (natural-spawning.md "Batch 42", tools/probes/TrackerItemsProbe.java, public/research/tracker-items-reference.json).
// Executed (the unchanged EntityTrackerEntry `my`, tracking a real server entity; the client entity is the real class created from the
// packets the way NetHandlerPlayClient does and ticked with its own onUpdate; replayed by object-tracker.test.js):
//  - the entry's frequency and sendVelocity flags per type (the table below), every packet of the scenarios (S0E/S11 spawn at floor(pos * 32),
//    the S12 after it, S14/S18 position packets, the destroy), and the client entity's position, motion and rotation each tick.
// Bytecode-read (not executed): EntityTracker.addEntityToTracker's type table and ranges (clamped to 144 like the mobs'), the S0E type and
//  data codes, the client handlers (bjb.a(fw), a(fx), a(S14), a(S18), a(S12)), Entity.setPositionAndRotation2 (the box is lifted out of
//  blocks 1/32 deep; EntityArrow only sets position and rotation) and the onUpdate branches the client does not run (EntityItem merging
//  and lifetime, the falling block's landing, TNT's explosion and the damage of EntityThrowable.onImpact are all under !isRemote; its particles are not).
// Quirks the reference shows: an XP orb spawns on the client at the packet position unscaled (x, y and z in 1/32 blocks as blocks, until the
// first position packet), its homing uses the client player's eye height 0.12 where the server's is 1.62, a client item never merges or
// expires, a client snowball flies on through the block its server twin died in until the destroy packet arrives.
// Batch 44 (tools/probes/TrackerHitsProbe.java, public/research/tracker-hits-reference.json): the client copies emit their own particles (impacts of
// thrown entities, the crit trail, bubbles and water splash of arrows and hooks, rocket sparks, S1A 17 -> makeFireworks) through `particle` and `events`.
// Batch 45: arrows and hooks search the client world's entities (`hooks.clientTargets`); attackEntityFrom answers false there, so an arrow ricochets and a hook never attaches.
// Batch 46: boats, minecarts, paintings, item frames, leash knots and the dragon's parts are client targets too; their attackEntityFrom answers true on a client world, so an
// arrow that hits one ends (bowhit) and a hook "attaches" with no effect, and a burning arrow's setFire(5) on a client copy is set (and zeroed by the copy's next update).
// Batch 47 (tools/probes/TrackerVehiclesProbe.java, public/research/tracker-vehicles-reference.json): boats, minecarts, paintings, item frames and leash knots have client copies
// too (the same unchanged EntityTrackerEntry executed, the real client classes ticked), and they are the client's hit targets (`vehicleTargets`). Executed: the spawn packets and
// every S12/S14-S18/S1C of the scenarios, the boat's extra yOffset at spawn, its 8 tick interpolation (3 + 5) then its coast on the S12 motion (0.99F / 0.95F / 0.99F), the cart's
// 5 tick interpolation (3 + 2) with no motion of its own, the hanging boxes, the item frame's data watcher, and the dragon's three-draw retarget on a part hit (`retargetDragon`).
// Bytecode-read only: the boat's splash particles above 0.2625 blocks a tick (the reference run never reached that speed on the client), the furnace cart's S1C 16, a cart below y -64.
// Not modelled: the client copy of a boat or cart the client player rides (full physics; its live entity is the target and the renderer instead), the chunk send queue, the player's own attackEntityFrom call, a client world's lava hop random draws. Drawing still reads the live entities: the renderers of
// boats, carts, paintings, frames and knots are not switched to the copies.
// Batch 48 (tracker-birth.js, boats.js, minecarts.js): entries of placed boats and carts start from their creation state; pushes set airBorne (addVelocity) and attacks velocityChanged
// (setBeenAttacked), which this entry already honoured; the far-boat untrack matched the executed entry all along (the probe never logged its destroy); furnace (16) and command block cart (23, 24) watcher objects.
import { MobTracker, ClientEntity, TrackerEntry, sizeClass } from "./entity-tracker.js";
import { toOriginal, fromOriginal } from "./block-registry.js";
import { originalOfLive } from "./item-names.js";
import { flyEye } from "./eye-of-ender.js";
import { createRocket, tickRocket } from "./firework-rocket.js";
import { FishHook, setBox as setHookBox } from "./fishing.js";
import { ItemEntities } from "./item-entities.js";
import { ExperienceOrbs } from "./experience.js";
import { Arrows } from "./bow.js";
import { Projectiles } from "./projectiles.js";
import { moveEntity } from "./entities.js";
import { tickTnt } from "./explosion.js";
import { ringEntityActive } from "./streaming-ticks.js";
import { hangingGeometry, ARTS, FRAME_PIXELS } from "./hanging.js";
import { takeBirth } from "./tracker-birth.js";

const f = Math.fround;
const PI_D = 3.1415927410125732;
const sqrtF = (v) => f(Math.sqrt(v));
const ITEM_W = f(0.25), ORB_W = f(0.5), BLOCK_W = f(0.98);
export const CLIENT_EYE = f(0.12); // EntityPlayer.getEyeHeight, which EntityClientPlayerMP keeps (the server player's is 1.62F)
// EntityTracker.addEntityToTracker: range, update frequency, sendVelocityUpdates; S0E type and data (S11 for the orb). `width` is
// Entity.setSize's, which picks the size class of the position packets, `yOff` the entity's yOffset (posY - box bottom).
export const OBJECT_KINDS = {
  item: { range: 64, frequency: 20, velocity: true, type: 2, data: () => 1, width: ITEM_W, height: ITEM_W, yOff: f(ITEM_W / 2) },
  orb: { range: 160, frequency: 20, velocity: true, orb: true, width: ORB_W, height: ORB_W, yOff: f(ORB_W / 2) },
  arrow: { range: 64, frequency: 20, velocity: false, type: 60, data: (e) => e.shooterId ?? e.id, width: f(0.5), height: f(0.5), yOff: 0, arrow: true },
  snowball: { range: 64, frequency: 10, velocity: true, type: 61, data: () => 0, width: ITEM_W, height: ITEM_W, yOff: 0, thrown: true },
  egg: { range: 64, frequency: 10, velocity: true, type: 62, data: () => 0, width: ITEM_W, height: ITEM_W, yOff: 0, thrown: true },
  enderPearl: { range: 64, frequency: 10, velocity: true, type: 65, data: () => 0, width: ITEM_W, height: ITEM_W, yOff: 0, thrown: true },
  potion: { range: 64, frequency: 10, velocity: true, type: 73, data: (e) => e.damage | 0, width: ITEM_W, height: ITEM_W, yOff: 0, thrown: true },
  expBottle: { range: 64, frequency: 10, velocity: true, type: 75, data: () => 0, width: ITEM_W, height: ITEM_W, yOff: 0, thrown: true },
  eyeOfEnder: { range: 64, frequency: 4, velocity: true, type: 72, data: () => 0, width: ITEM_W, height: ITEM_W, yOff: 0, eye: true },
  firework: { range: 64, frequency: 10, velocity: true, type: 76, data: () => 0, width: ITEM_W, height: ITEM_W, yOff: 0, rocket: true },
  fishHook: { range: 64, frequency: 5, velocity: true, type: 90, data: (e) => e.anglerId ?? 0, width: ITEM_W, height: ITEM_W, yOff: 0, hook: true },
  tnt: { range: 160, frequency: 10, velocity: true, type: 50, data: () => 0, width: BLOCK_W, height: BLOCK_W, yOff: f(BLOCK_W / 2) },
  // Batch 47: boats and minecarts (range 80, every 3 ticks, with velocity), paintings, item frames and leash knots (range 160, never moved again). `lift` is the constructor's
  // yOffset the client adds to the packet's y (EntityBoat(world, x, y, z) calls setPosition(x, y + yOffset, z); EntityMinecart's does not), `extra` the interpolation ticks
  // setPositionAndRotation2 adds to the packet's 3 (EntityBoat: + 5 while empty; EntityMinecart: + 2).
  boat: { range: 80, frequency: 3, velocity: true, type: 1, data: () => 0, width: f(1.5), height: f(0.6), yOff: f(0.3), lift: f(0.3), vehicle: true, extra: 5 },
  minecart: { range: 80, frequency: 3, velocity: true, type: 10, data: (p) => p.cartType | 0, width: f(0.98), height: f(0.7), yOff: f(0.35), lift: 0, vehicle: true, extra: 2 },
  painting: { range: 160, frequency: 2147483647, velocity: false, type: null, data: (e) => e.dir | 0, width: f(0.5), height: f(0.5), yOff: 0, hanging: true },
  itemFrame: { range: 160, frequency: 2147483647, velocity: false, type: 71, data: (e) => e.dir | 0, width: f(0.5), height: f(0.5), yOff: 0, hanging: true },
  leashKnot: { range: 160, frequency: 2147483647, velocity: false, type: 77, data: () => 0, width: f(0.5), height: f(0.5), yOff: 0, hanging: true },
  falling: { range: 160, frequency: 20, velocity: true, type: 70, data: (e) => fallingData(e), width: BLOCK_W, height: BLOCK_W, yOff: f(BLOCK_W / 2) },
};
const NO_SPAWN_MOTION = new Set([70, 73, 75, 90, 71, 77]); // (71 and 77: the hanging copies take no motion)
const angleByte = (b) => f(f(b * 360) / 256); // (float)(b * 360) / 256.0F

// EntityFallingBlock's S0E data: Block.getIdFromBlock | metadata << 16, the native id (the browser's block ids are its own).
const fallingNative = (e) => toOriginal(e.block, e.meta | 0) ?? [e.block & 65535, e.meta | 0];
export const fallingData = (e) => { const [id, meta] = fallingNative(e); return ((id & 65535) || 1) | ((meta | 0) << 16); };
// The browser block of a received falling block data word
const fromFallingData = (data) => { const hit = fromOriginal(data & 65535, data >> 16); return hit ? { block: hit.id, meta: hit.meta } : { block: 1, meta: 0 }; };
// An ItemStack as the native game holds it ({ id, count, damage } with the native item id), or null for a browser-only item.
export function nativeStack(stack) {
  if (!stack) return null;
  const o = originalOfLive(stack.id);
  return o ? { id: o.id, count: stack.count, damage: o.damage ?? stack.damage ?? 0 } : null;
}
const copyStack = (st) => (st ? { ...st, ...(st.fireworks ? { fireworks: JSON.parse(JSON.stringify(st.fireworks)) } : {}) } : null);
const sameStack = (a, b) => (a === b) || (a && b && typeof a === "object" && typeof b === "object" && a.id === b.id && a.count === b.count && (a.damage | 0) === (b.damage | 0) && JSON.stringify(a.fireworks ?? null) === JSON.stringify(b.fireworks ?? null));
// DataWatcher (te): the objects as [type, index, value], iterated like Java's HashMap (index & 15, then insertion order). Every object is
// "watched" from its creation; updateObject marks the watcher changed, getChanged returns the watched objects once and clears both flags.
// Types: 0 byte, 1 short, 5 ItemStack. Executed: tracker-extras-reference.json (the S1C packets of every kind).
export class Watcher {
  constructor(values, dirty = false) {
    this.objs = values.map(([type, idx, value]) => ({ type, idx, value, watched: true }));
    this.objs.sort((a, b) => (a.idx & 15) - (b.idx & 15));
    this.dirty = dirty;
  }
  update(values) {
    for (const [, idx, value] of values) {
      const o = this.objs.find((x) => x.idx === idx);
      if (o && !sameStack(o.value, value) && o.value !== value) { o.value = value; o.watched = true; this.dirty = true; }
    }
  }
  all() { return this.objs.map((o) => [o.type, o.idx, o.value]); }
  hasChanges() { return this.dirty; }
  changed() {
    if (!this.dirty) return null;
    this.dirty = false;
    const out = [];
    for (const o of this.objs) if (o.watched) { o.watched = false; out.push([o.type, o.idx, o.value]); }
    return out;
  }
}
// The data watcher objects of a kind from the entity (the stand-in `p` the tracker reads): the Entity flags and air, then the kind's own.
export function metaValues(kind, p) {
  const out = [[0, 0, p.fire > 0 ? 1 : 0], [1, 1, 300]];
  if (kind === "item") out.push([5, 10, copyStack(p.stack)]);
  else if (kind === "arrow") out.push([0, 16, p.crit ? 1 : 0]);
  else if (kind === "firework") out.push([5, 8, p.stack?.fireworks ? copyStack(p.stack) : null]);
  // EntityBoat: timeSinceHit (17), forwardDirection (18, 1), damageTaken (19, float); EntityMinecart adds the display tile (20), its offset (21, 6) and its flag (22);
  // EntityMinecartFurnace the powered flag (16, executed: cartFurnace); EntityMinecartCommandBlock the command (23) and the last output as its JSON (24, executed: cartCommand: "" and "" at
  // creation, then updateCommand writes the command and `null` or the ChatComponentText's JSON string; the port cannot tell whether updateCommand ran, so a cart with a command and no output reads `null`)
  else if (kind === "boat") out.push([2, 17, p.hit | 0], [2, 18, p.dir ?? 1], [3, 19, p.dmg ?? 0]);
  else if (kind === "minecart") { if (p.cartType === 2) out.push([0, 16, p.lit ? 1 : 0]); if (p.cartType === 6) out.push([4, 23, p.cmd ?? ""], [4, 24, p.cmdOut == null ? (p.cmd ? "null" : "") : JSON.stringify(p.cmdOut)]); out.push([2, 17, p.hit | 0], [2, 18, p.dir ?? 1], [3, 19, p.dmg ?? 0], [2, 20, p.dispRaw | 0], [2, 21, p.dispOffset ?? 6], [0, 22, p.dispOn ? 1 : 0]); }
  else if (kind === "itemFrame") out.push([5, 2, copyStack(p.stack)], [0, 3, p.rotation | 0]); // EntityItemFrame: the item (2) and its rotation (3)
  return out;
}
const DRAG_H = f(0.99), DRAG_V = f(0.95);
const SIN = Float32Array.from({ length: 65536 }, (_, i) => f(Math.sin((i * Math.PI * 2) / 65536))); // MathHelper.sin / cos: the 65536 entry float table
const mathSin = (r) => SIN[Math.trunc(f(r * f(10430.378))) & 65535];
const mathCos = (r) => SIN[Math.trunc(f(f(r * f(10430.378)) + 16384)) & 65535];
const velocityInt = (v) => Math.trunc(Math.max(-3.9, Math.min(3.9, v)) * 8000) + 0;

// EntityTrackerEntry for these kinds: the S1C after the spawn packet and the changed-metadata S1C at the end of the update block, before the
// velocityChanged S12 (executed order, tracker-extras-reference.json).
export class ObjectEntry extends TrackerEntry {
  constructor(p, options, view, watcher) { super(p, options, view); this.watcher = watcher; }
  emit(packet) {
    super.emit(packet);
    if (packet.type === "spawn") super.emit({ type: "meta", id: packet.id, list: this.watcher.all() });
  }
  sendLocation(airBorne = false, dataChanged = false) {
    const e = this.e, vc = e.velocityChanged, block = this.ticks % this.frequency === 0 || airBorne || dataChanged;
    e.velocityChanged = false;
    super.sendLocation(airBorne, dataChanged);
    if (block) { const list = this.watcher.changed(); if (list) this.send({ type: "meta", id: e.id, list }); }
    if (vc) this.send({ type: "velocity", vx: velocityInt(e.vx ?? 0), vy: velocityInt(e.vy ?? 0), vz: velocityInt(e.vz ?? 0) });
  }
}

// A client entity of one of the kinds above. Its fields are Java's: y is posY (the box bottom is y - yOff), vx/vy/vz the motion.
export class ObjectClient extends ClientEntity {
  constructor(kind, tracker) {
    super(kind);
    this.kind = kind; this.spec = OBJECT_KINDS[kind]; this.tracker = tracker; this.world = null;
    this.yaw = 0; this.pitch = 0; this.sim = null; this.id = 0;
    this.meta = new Map(); this.fish = null; this.vt = null; this.live = null; this.bb = null; this.dir = 0; this.cv = [0, 0, 0]; // the S1C objects by index; the hook's interpolation target; its last S12 motion
    this.prevYaw = 0; this.prevPitch = 0; this.cartType = 0; this.title = null; this.art = 0; // Batch 48: what the vehicle and hanging renderers read (the previous rotation, the S0E cart type, the painting's S10 title and its ARTS index)
  }
  // Entity.setPositionAndRotation2 for a non-living entity: position and rotation at once, then the box (shrunk 1/32 at the sides) is lifted
  // onto the highest block box it overlaps (EntityArrow's override sets position and rotation only).
  place(x, y, z, yaw, pitch) {
    if (this.spec.hanging) return; // a hanging copy is never moved (its frequency is Integer.MAX_VALUE; a stray position packet changes nothing the port models)
    if (this.spec.vehicle) { // EntityBoat / EntityMinecart.setPositionAndRotation2: a target for 3 + extra ticks (no box lift), the motion goes back to the last S12's
      this.vt = { x, y, z, yaw: yaw ?? this.yaw, pitch: pitch ?? this.pitch, inc: 3 + this.spec.extra };
      [this.vx, this.vy, this.vz] = this.cv;
      return;
    }
    if (this.spec.hook) { // EntityFishHook.setPositionAndRotation2: a target for the next 3 ticks, and the motion goes back to the last S12's
      this.fish = { x, y, z, yaw: yaw ?? this.yaw, pitch: pitch ?? this.pitch, inc: 3 };
      [this.vx, this.vy, this.vz] = this.cv;
      return;
    }
    this.x = x; this.y = y; this.z = z;
    if (yaw !== undefined) { this.yaw = yaw; this.pitch = pitch; }
    if (this.spec.arrow || !this.world) return;
    const r = f(this.spec.width) / 2, minY = this.y - this.spec.yOff, grow = 0.03125;
    const list = this.tracker.sims.items.boxes(this.world, x - r + grow, minY, z - r + grow, x + r - grow, minY + this.spec.height, z + r - grow);
    if (!list.length) return;
    let top = 0; // d3 starts at 0, as the original
    for (const b of list) if (b[4] > top) top = b[4];
    this.y += top - minY;
  }
  // EntityArrow.setVelocity and EntityThrowable.setVelocity: an entity that was never rotated takes its heading from the motion.
  setVelocity(vx, vy, vz) {
    this.vx = vx; this.vy = vy; this.vz = vz;
    if (this.spec.hook || this.spec.vehicle) this.cv = [vx, vy, vz]; // EntityFishHook / EntityBoat / EntityMinecart.setVelocity: the remembered S12 motion
    if ((this.spec.arrow || this.spec.thrown || this.spec.rocket) && this.sim.prevYaw === 0 && this.sim.prevPitch === 0) {
      const flat = sqrtF(vx * vx + vz * vz);
      this.yaw = this.sim.prevYaw = f((Math.atan2(vx, vz) * 180) / PI_D);
      this.pitch = this.sim.prevPitch = f((Math.atan2(vy, flat) * 180) / PI_D);
    }
  }
  apply(p) {
    if (p.type === "spawn" && this.spec.hanging) { this.spawnHanging(p); return; }
    if (p.type === "spawn") {
      this.present = true; this.id = p.id; this.vt = null; this.cv = [0, 0, 0];
      this.sx = p.x; this.sy = p.y; this.sz = p.z;
      if (p.orb) { // bjb.a(fx): the constructor takes the packet's integers as block coordinates
        this.x = p.x; this.y = p.y; this.z = p.z; this.yaw = this.pitch = 0;
      } else {
        this.x = p.x / 32; this.y = p.y / 32 + (this.spec.lift ?? 0); this.z = p.z / 32;
        this.yaw = angleByte(p.yaw); this.pitch = angleByte(p.pitch);
      }
      this.px = this.x; this.py = this.y; this.pz = this.z;
      this.prevYaw = this.yaw; this.prevPitch = this.pitch; this.cartType = this.kind === "minecart" ? p.data | 0 : 0; this.fuse = -1;
      this.vx = this.vy = this.vz = 0; this.onGround = false;
      this.meta.clear(); this.fish = null;
      this.sim = this.tracker.newSim(this);
      if (this.kind === "falling") Object.assign(this.sim, fromFallingData(p.data));
      // bjb.a(fw) zeroes the data of types 70, 73, 75 and 90, so their spawn packet's motion is not read (the S12 after it sets it)
      if (!p.orb && p.data > 0 && !NO_SPAWN_MOTION.has(this.spec.type)) this.setVelocity(p.vx / 8000, p.vy / 8000, p.vz / 8000);
    } else if (!this.present) return;
    else if (p.type === "move" || p.type === "moveLook" || p.type === "look") {
      if (p.type !== "look") { this.sx += p.dx; this.sy += p.dy; this.sz += p.dz; }
      const look = p.type !== "move";
      this.place(this.sx / 32, this.sy / 32, this.sz / 32, look ? angleByte(p.yaw) : undefined, look ? angleByte(p.pitch) : undefined);
    } else if (p.type === "teleport") {
      this.sx = p.x; this.sy = p.y; this.sz = p.z;
      this.place(this.sx / 32, this.sy / 32 + 0.015625, this.sz / 32, angleByte(p.yaw), angleByte(p.pitch));
    } else if (p.type === "meta") { for (const [, idx, value] of p.list) this.meta.set(idx, value); }
    else if (p.type === "velocity") this.setVelocity(p.vx / 8000, p.vy / 8000, p.vz / 8000);
    else if (p.type === "status") this.handleStatus(p.status);
    else if (p.type === "destroy") this.present = false;
  }
  // NetHandlerPlayClient.a(S10) / a(S0E 71, 77): EntityPainting(world, x, y, z, dir, title), EntityItemFrame(world, x, y, z, dir), EntityLeashKnot(world, x, y, z), built from the
  // packet's tile (the entity's x * 32 is not sent: the tile * 32 is). The box is EntityHanging.setDirection's (hanging.js, executed there); the knot's is its own 0.5 cube.
  spawnHanging(p) {
    this.present = true; this.id = p.id; this.meta.clear(); this.sim = { prevYaw: 0, prevPitch: 0 };
    const tx = Math.trunc(p.x / 32), ty = Math.trunc(p.y / 32), tz = Math.trunc(p.z / 32);
    this.vx = this.vy = this.vz = 0; this.onGround = false; this.dir = p.data | 0;
    if (this.kind === "leashKnot") {
      this.x = tx + 0.5; this.y = ty + 0.5; this.z = tz + 0.5; this.yaw = this.pitch = 0;
      this.bb = [this.x - 0.25, this.y, this.z - 0.25, this.x + 0.25, this.y + 0.5, this.z + 0.25];
    } else {
      const art = this.kind === "painting" ? ARTS.find((a) => a[0] === p.title) ?? ARTS[0] : null;
      this.title = art ? art[0] : null; this.art = art ? ARTS.indexOf(art) : 0;
      const g = hangingGeometry(this.dir, tx, ty, tz, art ? art[1] : FRAME_PIXELS, art ? art[2] : FRAME_PIXELS);
      this.x = g.x; this.y = g.y; this.z = g.z; this.yaw = g.yaw; this.pitch = 0; this.bb = g.bb;
    }
    this.px = this.x; this.py = this.y; this.pz = this.z; this.tile = [tx, ty, tz];
  }
  // The client box of a copy: Entity.setPosition's (half width, posY - yOffset, height) for the vehicles, the hanging box as built.
  box() {
    if (this.spec.hanging) return this.bb;
    const r = f(this.spec.width) / 2, minY = this.y - this.spec.yOff;
    return [this.x - r, minY, this.z - r, this.x + r, minY + f(this.spec.height), this.z + r];
  }
  // Batch 48: EntityBoat.h() and EntityMinecart.h() begin (not under isRemote, bytecode-read in xi and xl) with timeSinceHit (watcher 17) - 1 while above 0 and the damage
  // (19, a float) - 1 while above 0, written back to the client's own data watcher until the next S1C overwrites it.
  stepWobble() {
    const hit = this.meta.get(17) | 0, dmg = this.meta.get(19) ?? 0;
    if (hit > 0) this.meta.set(17, hit - 1);
    if (dmg > 0) this.meta.set(19, f(dmg - 1));
  }
  // EntityBoat.onUpdate (isRemote, isBoatEmpty) and EntityMinecart.onUpdate (isRemote): with increments left both step towards the last position packet (position by
  // (target - pos) / n, yaw by wrapAngleTo180(target - yaw) / n, pitch by (target - pitch) / n, then setRotation's % 360); the boat without increments coasts on
  // the S12 motion (position += motion, then 0.99F / 0.95F / 0.99F drag), the cart stays where it is. Bytecode-read for the branches, executed for the numbers.
  stepVehicle() {
    if (this.meta.has(16)) this.meta.set(16, 0); // EntityMinecartFurnace.onUpdate is not guarded by isRemote: the client sets its powered flag (16) from its own fuel (0) every update, so the S1C's 1 lasts only until the update (executed: cartFurnace)
    const v = this.vt;
    if (v && v.inc > 0) {
      const n = v.inc, wrap = (d) => { d %= 360; if (d >= 180) d -= 360; if (d < -180) d += 360; return d; };
      this.x += (v.x - this.x) / n; this.y += (v.y - this.y) / n; this.z += (v.z - this.z) / n;
      this.yaw = f(f(this.yaw + wrap(v.yaw - this.yaw) / n) % 360);
      this.pitch = f(f(this.pitch + (v.pitch - this.pitch) / n) % 360);
      v.inc--;
    } else if (this.kind === "boat") {
      this.x += this.vx; this.y += this.vy; this.z += this.vz;
      if (this.onGround) { this.vx *= 0.5; this.vy *= 0.5; this.vz *= 0.5; }
      this.vx *= DRAG_H; this.vy *= DRAG_V; this.vz *= DRAG_H; // float constants: 0.99F, 0.95F
    }
  }
  // S1A, Entity.handleHealthUpdate. Only EntityFireworkRocket overrides it (17: World.makeFireworks at the client's position and motion with the
  // Fireworks tag of its data watcher object 8); EntityFishHook does not (the pull of a hooked entity reaches the client as that entity's own packets).
  handleStatus(status) {
    if (status === 10 && this.kind === "minecart" && this.cartType === 3) this.fuse = 80; // EntityMinecartTNT.handleHealthUpdate(10): ignite() sets the client's fuse (the sound and setEntityState are server side)
    if (status === 17 && this.spec.rocket) this.tracker.events.push({ firework: { x: this.x, y: this.y, z: this.z, vx: this.vx, vy: this.vy, vz: this.vz, fireworks: this.meta.get(8)?.fireworks ?? null } });
  }
  // EntityFishHook.onUpdate on the client: the 3 tick interpolation towards the last position packet, else the flight with the S12 motion
  stepHook(world) {
    const s = this.sim, fish = this.fish;
    s.prevYaw = this.yaw; s.prevPitch = this.pitch;
    if (fish && fish.inc > 0) {
      Object.assign(s, { x: this.x, y: this.y, z: this.z, vx: this.vx, vy: this.vy, vz: this.vz }); setHookBox(s);
      s.waterMovement(this.tracker.hookEnv(world)); this.vx = s.vx; this.vy = s.vy; this.vz = s.vz; // super.onUpdate runs before the interpolation
      const wrap = (d) => { d %= 360; if (d >= 180) d -= 360; if (d < -180) d += 360; return d; };
      this.x += (fish.x - this.x) / fish.inc; this.y += (fish.y - this.y) / fish.inc; this.z += (fish.z - this.z) / fish.inc;
      this.yaw = f(this.yaw + wrap(fish.yaw - this.yaw) / fish.inc);
      this.pitch = f(this.pitch + (fish.pitch - this.pitch) / fish.inc);
      fish.inc--;
      this.yaw %= 360; this.pitch %= 360;
      return;
    }
    Object.assign(s, { x: this.x, y: this.y, z: this.z, vx: this.vx, vy: this.vy, vz: this.vz, yaw: this.yaw, pitch: this.pitch, onGround: this.onGround, dead: false });
    setHookBox(s);
    s.tick(this.tracker.hookEnv(world));
    this.x = s.x; this.y = s.y; this.z = s.z; this.vx = s.vx; this.vy = s.vy; this.vz = s.vz; this.yaw = s.yaw; this.pitch = s.pitch; this.onGround = s.onGround;
    this.prevYaw = s.prevYaw; this.prevPitch = s.prevPitch;
  }
  // World.updateEntityWithOptionalForce -> Entity.onUpdate of the client's entity: lastTickPos, then the kind's own tick.
  step(ctx) {
    if (!this.present) return;
    const world = ctx.world;
    if (world && !ringEntityActive(world, this)) return; // checkChunksExist over 32 blocks: an entity in an unloaded area does not tick
    this.px = this.x; this.py = this.y; this.pz = this.z;
    const t = this.tracker, s = this.sim, spec = this.spec;
    if (spec.hanging) return; // EntityHanging.onUpdate checks its wall only under !isRemote
    if (spec.vehicle) { this.prevYaw = this.yaw; this.prevPitch = this.pitch; this.stepWobble(); this.stepVehicle(); if (this.fuse > 0) this.fuse--; return; } // EntityMinecartTNT.h: after super.h, a fuse above 0 counts down (smoke; the explosion at 0 is under !isRemote)
    if (this.kind === "item") {
      s.x = this.x; s.y = this.y - spec.yOff; s.z = this.z; s.mx = this.vx; s.my = this.vy; s.mz = this.vz; s.onGround = this.onGround; s.dead = false;
      t.sims.items.items = [s]; t.sims.items.tick(world); t.sims.items.sounds.length = 0;
      this.x = s.x; this.y = s.y + spec.yOff; this.z = s.z; this.vx = s.mx; this.vy = s.my; this.vz = s.mz; this.onGround = s.onGround;
      if (s.dead) this.present = false;
    } else if (this.kind === "orb") {
      s.x = this.x; s.posY = this.y; s.y = this.y - spec.yOff; s.z = this.z; s.vx = this.vx; s.vy = this.vy; s.vz = this.vz; s.onGround = this.onGround; s.dead = false;
      s.bb = [s.x - 0.25, s.posY - 0.25, s.z - 0.25, s.x + 0.25, s.posY - 0.25 + 0.5, s.z + 0.25];
      t.sims.orbs.orbs = [s]; t.sims.orbs.tick(world, ctx.player ?? null, CLIENT_EYE); t.sims.orbs.sounds.length = 0;
      this.x = s.x; this.y = s.posY; this.z = s.z; this.vx = s.vx; this.vy = s.vy; this.vz = s.vz; this.onGround = s.onGround;
      if (s.dead) this.present = false;
    } else if (spec.arrow) {
      s.x = this.x; s.y = this.y; s.z = this.z; s.mx = this.vx; s.my = this.vy; s.mz = this.vz; s.yaw = this.yaw; s.pitch = this.pitch; s.dead = false;
      s.crit = ((this.meta.get(16) ?? 0) & 1) === 1; // EntityArrow.getIsCritical reads the data watcher (S1C), not the shooter's state
      s.clientBurning = ((this.meta.get(0) ?? 0) & 1) === 1; // Entity.isBurning on a client world reads the data watcher's flag 0 (the client's own fire counter is zeroed every update)
      t.sims.arrows.step(world, s, t.clientHitContext(s, this)); t.sims.arrows.events.length = 0;
      this.x = s.x; this.y = s.y; this.z = s.z; this.vx = s.mx; this.vy = s.my; this.vz = s.mz; this.yaw = s.yaw; this.pitch = s.pitch;
      if (s.dead) this.present = false;
    } else if (spec.thrown) {
      s.x = this.x; s.y = this.y; s.z = this.z; s.mx = this.vx; s.my = this.vy; s.mz = this.vz; s.yaw = this.yaw; s.pitch = this.pitch; s.dead = false;
      t.sims.balls.step(world, s, [], () => {}); t.sims.balls.events.length = 0; // EntityThrowable.onUpdate searches for entities only under !isRemote: no targets
      this.x = s.x; this.y = s.y; this.z = s.z; this.vx = s.mx; this.vy = s.my; this.vz = s.mz; this.yaw = s.yaw; this.pitch = s.pitch;
      if (s.dead) this.present = false;
    } else if (spec.eye) {
      // EntityEnderEye.onUpdate on the client: the flight only (the homing and the end are under !isRemote)
      Object.assign(s, { x: this.x, y: this.y, z: this.z, vx: this.vx, vy: this.vy, vz: this.vz, yaw: this.yaw, pitch: this.pitch });
      flyEye(s);
      this.x = s.x; this.y = s.y; this.z = s.z; this.yaw = s.yaw; this.pitch = s.pitch;
    } else if (spec.rocket) {
      const h = f(ITEM_W / 2);
      Object.assign(s, { x: this.x, y: this.y, z: this.z, mx: this.vx, my: this.vy, mz: this.vz, yaw: this.yaw, pitch: this.pitch, box: [this.x - h, this.y, this.z - h, this.x + h, this.y + ITEM_W, this.z + h], onGround: this.onGround });
      const out = tickRocket(s, world, s.rand, { remote: true, server: false });
      if (out.launch) t.sound("fireworks.launch", s.x, s.y, s.z, 3, 1); // playSoundAtEntity, not under !isRemote: the client copy calls it too (silent: RenderGlobal.playSound is empty)
      if (out.spark) t.particle("fireworksSpark", ...out.spark); // EntityFireworkRocket.onUpdate: the client's trail, from the client's own rand
      this.x = s.x; this.y = s.y; this.z = s.z; this.vx = s.mx; this.vy = s.my; this.vz = s.mz; this.yaw = s.yaw; this.pitch = s.pitch; this.onGround = s.onGround;
    } else if (spec.hook) {
      this.stepHook(world);
    } else if (this.kind === "falling") {
      // EntityFallingBlock.onUpdate: gravity, moveEntity, drag; the landing (and the block's removal) is under !isRemote
      s.x = this.x; s.y = this.y - spec.yOff; s.z = this.z; s.vx = this.vx; s.vy = this.vy - 0.03999999910593033; s.vz = this.vz; s.onGround = this.onGround;
      moveEntity(world, s, BLOCK_W, BLOCK_W, s.vx, s.vy, s.vz, 0);
      this.x = s.x; this.y = s.y + spec.yOff; this.z = s.z; this.onGround = s.onGround;
      this.vx = s.vx * 0.9800000190734863; this.vy = s.vy * 0.9800000190734863; this.vz = s.vz * 0.9800000190734863;
    } else if (this.kind === "tnt") {
      s.x = this.x; s.y = this.y - spec.yOff; s.z = this.z; s.vx = this.vx; s.vy = this.vy; s.vz = this.vz; s.onGround = this.onGround;
      const boom = tickTnt(world, s); // fuse 80 on the client; at 0 it dies without exploding
      this.x = s.x; this.y = s.y + spec.yOff; this.z = s.z; this.vx = s.vx; this.vy = s.vy; this.vz = s.vz; this.onGround = s.onGround;
      if (boom) this.present = false;
    }
  }
}

// The tracker of the non-mob entities of an EntityWorld. `update(lists, player, world)`: lists maps a kind to the live entities of that kind.
export class ObjectTracker extends MobTracker {
  constructor(viewChunks = 10, random = Math.random) {
    super(viewChunks);
    this.kinds = new Map(); this.nextId = 1 << 24; this.dying = []; // entries whose entity left the world: their destroy packet is still queued
    const items = new ItemEntities(random), orbs = new ExperienceOrbs([], random), arrows = new Arrows(random), balls = new Projectiles(random);
    items.remote = true; balls.remote = true;
    this.sims = { items, orbs, arrows, balls };
    this.ctx = { world: null, player: null };
    // The client world's spawnParticle: every call is logged (tests) and handed to `hooks.particle(name, x, y, z, vx, vy, vz)` (main.js); the
    // snowballpoof of an impact go to the thrown simulator's effect renderer. `events` collects what a status packet made the client do.
    this.log = null; this.hooks = {}; this.events = []; this.fires = new WeakMap(); // the fire counters Entity.setFire left on client copies (log only; the copies zero theirs each update)
    const spawn = (name, ...a) => this.particle(name, ...a);
    balls.sink = spawn; balls.soundSink = arrows.soundSink = (...a) => this.sound(...a); balls.spawner = { spawn }; arrows.fx = { spawn };
  }
  particle(name, x, y, z, vx, vy, vz) {
    this.log?.push([name, x, y, z, vx, vy, vz]);
    if (name === "snowballpoof") this.sims.balls.poof(x, y, z);
    else this.hooks.particle?.(name, x, y, z, vx, vy, vz);
  }
  // The client world's playSoundAtEntity: every call is logged like the particles and handed to `hooks.sound(name, x, y, z, volume, pitch)`. It ends in RenderGlobal.playSound,
  // which is empty in 1.7.10 (bma.a(String,DDDFF) is a bare return), so main.js binds no sound hook: the log is evidence of the call order, not audio.
  sound(name, x, y, z, volume, pitch) {
    this.log?.push(["sound:" + name, x, y, z, volume, pitch, 0]);
    this.hooks.sound?.(name, x, y, z, volume, pitch);
  }
  // The client world's collidable entities near a client copy: `hooks.clientTargets()` -> [{ ref, box, kind?, immune?, answers? }] (main.js: the client mob copies, the
  // client player (a creative one is immune), the live boats, carts, paintings, item frames and leash knots, and the client dragon's seven parts). Only EntityArrow and
  // EntityFishHook search them (EntityThrowable's search is under !isRemote). `kind` names the class in the call log (default `ref.type`); `answers: true` marks the
  // entities whose attackEntityFrom returns true on a client world (EntityBoat, EntityMinecart, EntityHanging, EntityDragonPart: executed, tracker-hits-reference.json).
  targets() { return this.hooks.clientTargets?.() ?? []; }
  // attackEntityFrom on a client-world entity: living entities return false (World.isRemote), the entities above return true. The player's own call is not logged.
  attack(ref, damage, target = null) {
    if (target?.kind === "dragonPart") this.retargetDragon(ref); // EntityDragon.attackEntityFromPart: before the row (the row carries the new target)
    if (ref !== "player") this.log?.push(["call:attackEntityFrom:" + (target?.kind ?? ref.type), ref.x, ref.y, ref.z, damage, target?.answers ? 1 : 0, 0]);
    this.hooks.attack?.(ref, damage);
    return !!target?.answers;
  }
  // EntityDragon.attackEntityFromPart on the client dragon (executed: tools/probes/TrackerVehiclesProbe.java dragonPartHit, the dragon's target fields after a part hit): the target moves
  // to 5 blocks ahead of the dragon's yaw (MathHelper.sin/cos) plus three draws of its own Entity.rand, in the order x, y, z. A client dragon copy has no AI to follow it; the draws
  // advance its rand (which its wing and growl sounds also read) and `ref.target` keeps the point. A plain stand-in without a rand is left alone.
  retargetDragon(ref) {
    if (!ref?.rand) return;
    const yaw = ref.rotationYaw ?? 0, r = f(f(f(yaw) * f(Math.PI)) / 180), sin = mathSin(r), cos = mathCos(r), rand = ref.rand;
    const tx = ref.x + f(sin * 5) + f(f(rand.nextFloat() - 0.5) * 2), ty = ref.y + f(rand.nextFloat() * 3) + 1, tz = ref.z - f(cos * 5) + f(f(rand.nextFloat() - 0.5) * 2);
    ref.target = { x: tx, y: ty, z: tz };
  }
  // The boats, minecarts, paintings, item frames and leash knots of the client world (Batch 47: the client copies, within their tracking range and after their spawn packet; the
  // live entity only for the boat or cart the client player rides, whose client copy runs full physics the port does not model). `rides(live)` tells the ridden one.
  vehicleTargets(rides = () => false) {
    const out = [];
    for (const [live, en] of this.entries) {
      const c = en.client, spec = c.spec;
      if (!c.present || !(spec.vehicle || spec.hanging) || live.dead) continue;
      const ridden = spec.vehicle && rides(live) && live.bb;
      out.push({ ref: c, kind: c.kind, box: ridden ? live.bb : c.box(), answers: true });
    }
    return out;
  }
  // Entity.setFire(5) on a client copy (a burning client arrow, before attackEntityFrom): the counter becomes 100 unless it is higher, and the copy's next onEntityUpdate
  // zeroes it again on a client world (executed: the cow's fire reads 100 after the hit, 0 at its next update), so only the copy's flame for the rest of that tick shows.
  ignite(ref, target = null) {
    if (ref === "player") return;
    const fire = Math.max(this.fires.get(ref) ?? 0, 100);
    this.fires.set(ref, fire);
    this.log?.push(["call:setFire:" + (target?.kind ?? ref.type), ref.x, ref.y, ref.z, 5, fire, 0]);
    this.hooks.ignite?.(ref, fire);
  }
  // the ctx of Arrows.step for a client copy: its shooter is the live arrow's (EntityArrow's S0E data id resolves to it), skipped for 5 ticks
  clientHitContext(s, client) {
    s.shooter = client?.shooterLive === undefined ? null : this.hooks.clientOf?.(client.shooterLive) ?? null;
    return { remote: true, targets: this.targets(), attack: (ref, dmg, target) => this.attack(ref, dmg, target), ignite: (ref, target) => this.ignite(ref, target) };
  }
  drainEvents() { const e = this.events; this.events = []; return e; }
  // the env of a client fish hook: no angler, no entities, no fish timers (FishHook.tick's remote branch)
  hookEnv(world) { return (this._hookEnv ??= { remote: true, player: { x: 0, y: 0, z: 0, valid: true }, canLightningStrike: () => false, entities: (area) => this.targets().filter((t) => (!t.reach || t.reach(area)) && t.box[3] > area[0] && t.box[0] < area[3] && t.box[4] > area[1] && t.box[1] < area[4] && t.box[5] > area[2] && t.box[2] < area[5]).map((t) => ({ ...t, angler: t.ref === "player" })), hitEntity: (ref, target) => this.attack(ref, 0, target), canSeeSky: () => false, sound: (name, v, p, at) => this.sound(name, at.x, at.y, at.z, v, p), particle() {}, fx: { spawn: (...a) => this.particle(...a) }, world: null, worldRand: null }), this._hookEnv.world = world, this._hookEnv; }
  // the simulator state a client entity starts with
  newSim(c) {
    const k = c.kind, s = this.sims;
    if (k === "item") return { stack: { id: 0, count: 1, damage: 0 }, x: 0, y: 0, z: 0, mx: 0, my: 0, mz: 0, hover: 0, age: 0, ticks: 0, delay: 0, onGround: false, death: false, health: 5, fire: 0, px: 0, py: 0, pz: 0 };
    if (k === "orb") return { x: 0, y: 0, posY: 0, z: 0, vx: 0, vy: 0, vz: 0, value: 1, age: 0, health: 5, fire: 0, bb: [0, 0, 0, 0, 0, 0], px: 0, py: 0, pz: 0, color: 0, retarget: 0, target: false, id: c.id, fallDistance: 0, onGround: false };
    if (c.spec.arrow) return s.arrows.make({ x: 0, y: 0, z: 0, mx: 0, my: 0, mz: 0, yaw: 0, pitch: 0 }, s.arrows.rng(), {});
    if (c.spec.thrown) { const rand = s.balls.rng(); return { kind: k, x: 0, y: 0, z: 0, mx: 0, my: 0, mz: 0, yaw: 0, pitch: 0, px: 0, py: 0, pz: 0, prevYaw: 0, prevPitch: 0, ticks: 0, rand, random: rand, dead: false }; }
    if (c.spec.eye) return { x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, prevYaw: 0, prevPitch: 0, tx: 0, ty: 0, tz: 0, age: 0, drops: false, dead: false };
    if (c.spec.rocket) { const r = createRocket(c.x, c.y, c.z, null, s.balls.rng()); r.rand = s.balls.rng(); return r; } // the client's constructor draws its own random motion, the S12 replaces it
    if (c.spec.hook) return new FishHook(s.balls.rng()); // its own Entity.rand
    if (c.spec.vehicle || c.spec.hanging) return { prevYaw: 0, prevPitch: 0 };
    return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, onGround: false, collidedH: false, fallDistance: 0, fuse: 80, px: 0, py: 0, pz: 0 };
  }
  // Copies the live entity into the stand-in the tracker entry reads (Java's posY and field names).
  read(kind, e, p) {
    const spec = OBJECT_KINDS[kind];
    p.type = kind;
    p.id ??= e.entityId ?? e.id ?? this.nextId++;
    p.x = e.x; p.z = e.z; p.airBorne = e.airBorne; p.velocityChanged = !!e.velocityChanged;
    p.fire = e.fire ?? 0; p.stack = e.stack; p.crit = !!e.crit; p.anglerId = e.anglerId;
    if (kind === "item") {
      p.y = e.y + spec.yOff; p.vx = e.mx; p.vy = e.my; p.vz = e.mz; p.rotationYaw = e.rotationYaw ??= f(Math.random() * 360); p.rotationPitch = 0; p.health = e.stack?.count ?? 1;
    } else if (kind === "orb") {
      p.y = e.posY ?? e.y + spec.yOff; p.vx = e.vx; p.vy = e.vy; p.vz = e.vz; p.rotationYaw = 0; p.rotationPitch = 0; p.health = 0;
    } else if (kind === "tnt" || kind === "falling") {
      p.y = e.y + spec.yOff; p.vx = e.vx; p.vy = e.vy; p.vz = e.vz; p.rotationYaw = 0; p.rotationPitch = 0; p.health = 0;
      p.block = e.block; p.meta = e.meta;
    } else if (spec.vehicle) { // boats and carts: posY is the native field (the box bottom is `y`), yaw and pitch in degrees
      p.y = e.posY; p.vx = e.vx; p.vy = e.vy; p.vz = e.vz; p.rotationYaw = e.yaw ?? 0; p.rotationPitch = e.pitch ?? 0; p.health = 0;
      p.hit = kind === "boat" ? e.timeSinceHit : e.rolling; p.dir = kind === "boat" ? e.forwardDir : e.rollingDir; p.dmg = e.damage; p.cartType = e.type; p.dispRaw = e.dispRaw; p.dispOffset = e.dispOffset; p.dispOn = e.dispOn; p.lit = e.lit; p.cmd = e.command?.command; p.cmdOut = e.command?.lastOutput;
    } else if (spec.hanging) { // the entity's own position drives the range test, its tile (not x * 32) the spawn packet
      p.y = e.y; p.vx = p.vy = p.vz = 0; p.rotationYaw = kind === "leashKnot" ? 0 : e.yaw ?? 0; p.rotationPitch = 0; p.health = 0; p.dir = e.dir | 0;
      p.stack = kind === "itemFrame" ? e.item : null; p.rotation = e.rotation | 0;
      if (kind === "leashKnot") { const sm = !!e.summoned; p.x = sm ? e.px : e.x + 0.5; p.y = sm ? e.py : e.y + 0.5; p.z = sm ? e.pz : e.z + 0.5; p.tile = sm ? [Math.floor(e.px), Math.floor(e.py), Math.floor(e.pz)] : [e.x, e.y, e.z]; }
      else p.tile = [e.tx, e.ty, e.tz];
      if (kind === "painting") p.title = ARTS[e.art]?.[0] ?? ARTS[0][0];
    } else if (spec.eye || spec.hook) { // vx/vy/vz and the rotation in degrees, posY the box bottom
      p.y = e.y; p.vx = e.vx; p.vy = e.vy; p.vz = e.vz; p.rotationYaw = e.yaw ?? 0; p.rotationPitch = e.pitch ?? 0; p.health = 0;
    } else { // arrows and thrown entities, rockets: posY is the box bottom, the motion is mx/my/mz, the rotation degrees
      p.y = e.y; p.vx = e.mx; p.vy = e.my; p.vz = e.mz; p.rotationYaw = e.yaw ?? 0; p.rotationPitch = e.pitch ?? 0; p.health = 0;
      p.shooterId = e.shooterId; p.damage = e.damage;
    }
    return p;
  }
  create(e) {
    const kind = this.kinds.get(e), spec = OBJECT_KINDS[kind];
    const p = this.read(kind, takeBirth(e) ?? e, {}); // an entity its spawn site recorded starts the entry with its creation state (tracker-birth.js)
    const object = spec.orb ? { orb: true, value: e.value } : { kind, data: spec.data(p), objectType: spec.type, ...(kind === "painting" ? { title: p.title } : {}) };
    const dirty = kind === "item" || (kind === "itemFrame" && !!p.stack) || (kind === "arrow" && p.crit) || (kind === "firework" && !!p.stack?.fireworks); // updateObject calls in the entity's constructor
    const entry = new ObjectEntry(p, { range: spec.range, frequency: spec.frequency, velocity: spec.velocity, size: sizeClass(spec.width), arrow: !!spec.arrow, object }, this.view, new Watcher(metaValues(kind, p), dirty));
    const client = new ObjectClient(kind, this);
    client.live = e;
    client.shooterLive = e.shooter; // the arrow's shooter, for the client copy's 5-tick skip
    return { entry, client, health: p.health, wasGround: false };
  }
  observe(e, en) {
    const p = this.read(this.kinds.get(e), e, en.entry.e);
    en.entry.watcher.update(metaValues(this.kinds.get(e), p));
    if (e.igniteStatus) { e.igniteStatus = false; en.entry.send({ type: "status", id: en.entry.e.id, status: 10 }); } // EntityMinecartTNT.ignite: World.setEntityState(this, 10)
    return { airBorne: p.airBorne === true, changed: en.entry.watcher.hasChanges() };
  }
  settle(e, en) {
    en.health = en.entry.e.health;
    if (e.airBorne) e.airBorne = false;
    if (e.velocityChanged && !en.entry.e.velocityChanged) e.velocityChanged = false;
  }
  // lists: { item: [...], orb: [...], ... }
  serverTick(lists, player) {
    const all = [];
    for (const kind in lists) for (const e of lists[kind]) { this.kinds.set(e, kind); all.push(e); }
    // removeEntityFromAllTrackingPlayers: the destroy goes out now and the client entity lives until its queue flushes (one tick later)
    const alive = new Set(all);
    for (const [e, en] of this.entries) if (!alive.has(e)) {
      if (e.exploded && this.kinds.get(e) === "firework") en.entry.send({ type: "status", id: en.entry.e.id, status: 17 }); // World.setEntityState(rocket, 17), then setDead
      en.entry.remove(); this.entries.delete(e); this.dying.push(en); }
    super.serverTick(all, player, () => [0]);
    for (const e of this.kinds.keys()) if (!this.entries.has(e)) this.kinds.delete(e);
  }
  clientTick() {
    const ctx = this.ctx;
    for (const en of this.entries.values()) { en.client.world = ctx.world; this.flush(en); en.client.step(ctx); }
    for (const en of this.dying) { en.client.world = ctx.world; this.flush(en); en.client.step(ctx); }
    this.dying = this.dying.filter((en) => en.client.present && en.entry.packets.length);
  }
  update(lists, player, world) {
    this.ctx.world = world; this.ctx.player = player;
    const extra = this.hooks.extraLists?.(); // Batch 47: the boats, minecarts, paintings, item frames and leash knots (main.js)
    if (extra) lists = { ...lists, ...extra };
    this.serverTick(lists, player);
    this.clientTick();
  }
  clientEntity(e) { const en = this.entries.get(e); return en?.client.present ? en.client : null; }
}

// What a renderer draws: the live entity with its position replaced by the client entity's (x/y/z and the previous tick, in the live
// entity's own y convention). Without a client entity (not yet spawned on the client, or out of range) it is the live entity itself.
// The view object of one entity is stable (renderers key their meshes by it) and reads every other field through the live entity.
const VIEWS = new WeakMap();
export function objectView(tracker, e, kind) {
  const c = tracker.clientEntity(e);
  if (!c) return e;
  const off = OBJECT_KINDS[kind].yOff;
  let v = VIEWS.get(e);
  if (!v) VIEWS.set(e, (v = Object.create(e)));
  v.x = c.x; v.y = c.y - off; v.z = c.z; v.px = c.px; v.py = c.py - off; v.pz = c.pz;
  const spec = OBJECT_KINDS[kind];
  if (c.sim && (spec.arrow || spec.thrown || spec.eye || spec.rocket || spec.hook)) { v.yaw = c.yaw; v.pitch = c.pitch; v.prevYaw = c.sim.prevYaw ?? c.yaw; v.prevPitch = c.sim.prevPitch ?? c.pitch; }
  // what the S1C and the spawn packet gave the client entity: the renderers read these, not the live entity's fields
  if (kind === "item") { const st = c.meta?.get(10); if (st) v.stack = st; }
  else if (kind === "arrow") { v.crit = ((c.meta?.get(16) ?? 0) & 1) === 1; if (c.sim) { v.shake = c.sim.shake; v.inGround = c.sim.inGround; } } // the client's own stick and arrowShake
  else if (kind === "tnt") if (c.sim) v.fuse = c.sim.fuse; // the fuse is not synchronised: the client's own countdown from 80
  else if (kind === "falling" && c.sim?.block !== undefined) { v.block = c.sim.block; v.meta = c.sim.meta; }
  return v;
}
export const objectViews = (tracker, list, kind) => list.map((e) => objectView(tracker, e, kind));

// Batch 48: what the boat, minecart, painting, item frame and leash knot renderers draw (RenderManager draws WorldClient's entities: the copies). A view is the live entity (the
// renderers key their meshes by it, and the fields the port keeps only on the live side, a TNT cart's fuse or a spawner cart's logic, read through it) with the copy's position,
// previous position, rotation and watched fields laid over it. Bytecode-read: RenderBoat / RenderMinecart read the data watcher (timeSinceHit, damage, forward direction, rolling
// amplitude and direction) and lerp the previous and current rotation; RenderItemFrame the watched item and rotation; RenderPainting its art by the S10 title.
// An entity the tracker follows whose copy is not there (before its spawn packet, after its destroy, out of the 80 / 160 block range) is not drawn, as natively; one the tracker does
// not follow (yet) falls back to the live entity, as does the boat or cart the client player rides (its copy would run full physics natively; not modelled).
const SHOWN = new WeakMap(), SHOWN_KNOTS = new WeakMap();
function shownOf(tracker, e, rides) {
  const en = tracker.entries.get(e);
  if (!en) return e; // not tracked yet
  const c = en.client;
  if (!c.present) return null;
  if (rides && c.spec.vehicle) return e;
  return c;
}
function laidOver(e) {
  let v = SHOWN.get(e);
  if (!v) SHOWN.set(e, (v = Object.create(e)));
  return v;
}
// RenderMinecart's display block from the copy's data watcher: 22 (has a custom display) 1 shows the block of 20 (id | data << 16) at the offset of 21; null leaves the type's own.
function displayOf(c, out) {
  if (c.meta.get(22) !== 1) return null;
  const raw = c.meta.get(20) | 0;
  out ??= {};
  out.id = raw & 0xffff; out.data = raw >> 16; out.offset = c.meta.get(21) | 0;
  return out;
}
// A boat or cart view: posY (the native field) is the copy's y, `y` the box bottom, the previous position in posY's convention as the live renderers' lerp reads it.
export function vehicleView(tracker, e, rides = false) {
  const c = shownOf(tracker, e, rides);
  if (c === null || c === e) return c;
  const off = c.spec.yOff, v = laidOver(e);
  v.x = c.x; v.z = c.z; v.posY = c.y; v.y = c.y - off; v.px = c.px; v.pz = c.pz; v.py = c.py;
  v.yaw = c.yaw; v.pitch = c.pitch; v.prevYaw = c.prevYaw; v.prevPitch = c.prevPitch;
  const hit = c.meta.get(17) ?? 0, dir = c.meta.get(18) ?? 1, dmg = c.meta.get(19) ?? 0;
  if (c.kind === "boat") { v.timeSinceHit = hit; v.forwardDir = dir; v.damage = dmg; }
  else { v.rolling = hit; v.rollingDir = dir; v.damage = dmg; v.type = c.cartType; v.fuse = c.fuse; v.display = displayOf(c, v.display); }
  const r = f(c.spec.width) / 2, bb = (Object.hasOwn(v, "bb") ? v.bb : (v.bb = [0, 0, 0, 0, 0, 0]));
  bb[0] = c.x - r; bb[1] = c.y - off; bb[2] = c.z - r; bb[3] = c.x + r; bb[4] = bb[1] + f(c.spec.height); bb[5] = c.z + r;
  return v;
}
// The views of a list of live boats or carts (skipping the ones that are not on the client); `visible(x, z)` is the port's loaded-chunk test.
export function vehicleViews(tracker, list, rides = () => false, visible = null) {
  const out = [];
  for (const e of list) {
    if (e.dead) continue;
    const v = vehicleView(tracker, e, rides(e));
    if (v && (!visible || visible(v.x, v.z))) out.push(v);
  }
  return out;
}
// A painting or item frame view: the copy's geometry (built from the packet's tile), the S10 art, and the frame's watched item (2) and rotation (3).
export function hangingViews(tracker, list, visible = null) {
  const out = [];
  for (const e of list) {
    if (e.dead) continue;
    const c = shownOf(tracker, e, false);
    if (c === null) continue;
    if (c === e) { if (!visible || visible(e.x, e.z)) out.push(e); continue; }
    if (visible && !visible(c.x, c.z)) continue;
    const v = laidOver(e);
    v.x = c.x; v.y = c.y; v.z = c.z; v.yaw = c.yaw; v.dir = c.dir; v.tx = c.tile[0]; v.ty = c.tile[1]; v.tz = c.tile[2];
    if (c.kind === "painting") v.art = c.art;
    else { v.item = c.meta.get(2) ?? null; v.rotation = c.meta.get(3) | 0; }
    out.push(v);
  }
  return out;
}
// The leash knots to draw ({ x, y, z } tile; summoned ones add id and the copy's centre): a summoned knot stands on its floored tile on the client (the copy's spawn).
export function knotViews(tracker, list) {
  const out = [];
  for (const k of list) {
    if (k.dead) continue;
    const c = shownOf(tracker, k, false);
    if (c === null) continue;
    let v = SHOWN_KNOTS.get(k);
    if (!v) SHOWN_KNOTS.set(k, (v = {}));
    if (c === k) { v.x = k.x; v.y = k.y; v.z = k.z; if (k.summoned) { v.px = k.px; v.py = k.py; v.pz = k.pz; v.id = k.id; } }
    else { v.x = c.tile[0]; v.y = c.tile[1]; v.z = c.tile[2]; if (k.summoned) { v.px = c.x; v.py = c.y; v.pz = c.z; v.id = k.id; } }
    out.push(v);
  }
  return out;
}
