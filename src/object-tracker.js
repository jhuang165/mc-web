// The tracker and the client's view of non-mob entities: dropped items, experience orbs, arrows, thrown projectiles, falling blocks and
// primed TNT (natural-spawning.md "Batch 42", tools/probes/TrackerItemsProbe.java, public/research/tracker-items-reference.json).
// Executed (the unchanged EntityTrackerEntry `my`, tracking a real server entity; the client entity is the real class created from the
// packets the way NetHandlerPlayClient does and ticked with its own onUpdate; replayed by object-tracker.test.js):
//  - the entry's frequency and sendVelocity flags per type (the table below), every packet of the scenarios (S0E/S11 spawn at floor(pos * 32),
//    the S12 after it, S14/S18 position packets, the destroy), and the client entity's position, motion and rotation each tick.
// Bytecode-read (not executed): EntityTracker.addEntityToTracker's type table and ranges (clamped to 144 like the mobs'), the S0E type and
//  data codes, the client handlers (bjb.a(fw), a(fx), a(S14), a(S18), a(S12)), Entity.setPositionAndRotation2 (the box is lifted out of
//  blocks 1/32 deep; EntityArrow only sets position and rotation) and the onUpdate branches the client does not run (EntityItem merging
//  and lifetime, the falling block's landing, EntityThrowable's impact, TNT's explosion are all under !isRemote).
// Quirks the reference shows: an XP orb spawns on the client at the packet position unscaled (x, y and z in 1/32 blocks as blocks, until the
// first position packet), its homing uses the client player's eye height 0.12 where the server's is 1.62, a client item never merges or
// expires, a client snowball flies on through the block its server twin died in until the destroy packet arrives.
// Not modelled: S1C metadata (the stack, the arrow's crit flag, TNT's fuse: the renderers read those from the live server entity), the
// client's own entity hits (arrows and thrown entities against client mobs), the thrown entity's client impact particles, fireworks,
// eyes of ender, fishing hooks, the chunk send queue, and a client world's lava hop random draws.
import { MobTracker, ClientEntity, TrackerEntry, sizeClass } from "./entity-tracker.js";
import { ItemEntities } from "./item-entities.js";
import { ExperienceOrbs } from "./experience.js";
import { Arrows } from "./bow.js";
import { Projectiles } from "./projectiles.js";
import { moveEntity } from "./entities.js";
import { tickTnt } from "./explosion.js";
import { ringEntityActive } from "./streaming-ticks.js";

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
  tnt: { range: 160, frequency: 10, velocity: true, type: 50, data: () => 0, width: BLOCK_W, height: BLOCK_W, yOff: f(BLOCK_W / 2) },
  falling: { range: 160, frequency: 20, velocity: true, type: 70, data: (e) => ((e.block & 65535) || 1) | ((e.meta | 0) << 16), width: BLOCK_W, height: BLOCK_W, yOff: f(BLOCK_W / 2) },
};
const angleByte = (b) => f(f(b * 360) / 256); // (float)(b * 360) / 256.0F

// A client entity of one of the kinds above. Its fields are Java's: y is posY (the box bottom is y - yOff), vx/vy/vz the motion.
export class ObjectClient extends ClientEntity {
  constructor(kind, tracker) {
    super(kind);
    this.kind = kind; this.spec = OBJECT_KINDS[kind]; this.tracker = tracker; this.world = null;
    this.yaw = 0; this.pitch = 0; this.sim = null; this.id = 0;
  }
  // Entity.setPositionAndRotation2 for a non-living entity: position and rotation at once, then the box (shrunk 1/32 at the sides) is lifted
  // onto the highest block box it overlaps (EntityArrow's override sets position and rotation only).
  place(x, y, z, yaw, pitch) {
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
    if ((this.spec.arrow || this.spec.thrown) && this.sim.prevYaw === 0 && this.sim.prevPitch === 0) {
      const flat = sqrtF(vx * vx + vz * vz);
      this.yaw = this.sim.prevYaw = f((Math.atan2(vx, vz) * 180) / PI_D);
      this.pitch = this.sim.prevPitch = f((Math.atan2(vy, flat) * 180) / PI_D);
    }
  }
  apply(p) {
    if (p.type === "spawn") {
      this.present = true; this.id = p.id;
      this.sx = p.x; this.sy = p.y; this.sz = p.z;
      if (p.orb) { // bjb.a(fx): the constructor takes the packet's integers as block coordinates
        this.x = p.x; this.y = p.y; this.z = p.z; this.yaw = this.pitch = 0;
      } else {
        this.x = p.x / 32; this.y = p.y / 32; this.z = p.z / 32;
        this.yaw = angleByte(p.yaw); this.pitch = angleByte(p.pitch);
      }
      this.px = this.x; this.py = this.y; this.pz = this.z;
      this.vx = this.vy = this.vz = 0; this.onGround = false;
      this.sim = this.tracker.newSim(this);
      if (!p.orb && p.data > 0) this.setVelocity(p.vx / 8000, p.vy / 8000, p.vz / 8000);
    } else if (!this.present) return;
    else if (p.type === "move" || p.type === "moveLook" || p.type === "look") {
      if (p.type !== "look") { this.sx += p.dx; this.sy += p.dy; this.sz += p.dz; }
      const look = p.type !== "move";
      this.place(this.sx / 32, this.sy / 32, this.sz / 32, look ? angleByte(p.yaw) : undefined, look ? angleByte(p.pitch) : undefined);
    } else if (p.type === "teleport") {
      this.sx = p.x; this.sy = p.y; this.sz = p.z;
      this.place(this.sx / 32, this.sy / 32 + 0.015625, this.sz / 32, angleByte(p.yaw), angleByte(p.pitch));
    } else if (p.type === "velocity") this.setVelocity(p.vx / 8000, p.vy / 8000, p.vz / 8000);
    else if (p.type === "destroy") this.present = false;
  }
  // World.updateEntityWithOptionalForce -> Entity.onUpdate of the client's entity: lastTickPos, then the kind's own tick.
  step(ctx) {
    if (!this.present) return;
    const world = ctx.world;
    if (world && !ringEntityActive(world, this)) return; // checkChunksExist over 32 blocks: an entity in an unloaded area does not tick
    this.px = this.x; this.py = this.y; this.pz = this.z;
    const t = this.tracker, s = this.sim, spec = this.spec;
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
      t.sims.arrows.step(world, s, {}); t.sims.arrows.events.length = 0;
      this.x = s.x; this.y = s.y; this.z = s.z; this.vx = s.mx; this.vy = s.my; this.vz = s.mz; this.yaw = s.yaw; this.pitch = s.pitch;
      if (s.dead) this.present = false;
    } else if (spec.thrown) {
      s.x = this.x; s.y = this.y; s.z = this.z; s.mx = this.vx; s.my = this.vy; s.mz = this.vz; s.yaw = this.yaw; s.pitch = this.pitch; s.dead = false;
      t.sims.balls.step(world, s, [], () => {}); t.sims.balls.events.length = 0;
      this.x = s.x; this.y = s.y; this.z = s.z; this.vx = s.mx; this.vy = s.my; this.vz = s.mz; this.yaw = s.yaw; this.pitch = s.pitch;
      if (s.dead) this.present = false;
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
  }
  // the simulator state a client entity starts with
  newSim(c) {
    const k = c.kind, s = this.sims;
    if (k === "item") return { stack: { id: 0, count: 1, damage: 0 }, x: 0, y: 0, z: 0, mx: 0, my: 0, mz: 0, hover: 0, age: 0, ticks: 0, delay: 0, onGround: false, death: false, health: 5, fire: 0, px: 0, py: 0, pz: 0 };
    if (k === "orb") return { x: 0, y: 0, posY: 0, z: 0, vx: 0, vy: 0, vz: 0, value: 1, age: 0, health: 5, fire: 0, bb: [0, 0, 0, 0, 0, 0], px: 0, py: 0, pz: 0, color: 0, retarget: 0, target: false, id: c.id, fallDistance: 0, onGround: false };
    if (c.spec.arrow) return s.arrows.make({ x: 0, y: 0, z: 0, mx: 0, my: 0, mz: 0, yaw: 0, pitch: 0 }, s.arrows.rng(), {});
    if (c.spec.thrown) { const rand = s.balls.rng(); return { kind: k, x: 0, y: 0, z: 0, mx: 0, my: 0, mz: 0, yaw: 0, pitch: 0, px: 0, py: 0, pz: 0, prevYaw: 0, prevPitch: 0, ticks: 0, rand, random: rand, dead: false }; }
    return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, onGround: false, collidedH: false, fallDistance: 0, fuse: 80, px: 0, py: 0, pz: 0 };
  }
  // Copies the live entity into the stand-in the tracker entry reads (Java's posY and field names).
  read(kind, e, p) {
    const spec = OBJECT_KINDS[kind];
    p.type = kind;
    p.id ??= e.entityId ?? e.id ?? this.nextId++;
    p.x = e.x; p.z = e.z; p.airBorne = e.airBorne; p.velocityChanged = !!e.velocityChanged;
    if (kind === "item") {
      p.y = e.y + spec.yOff; p.vx = e.mx; p.vy = e.my; p.vz = e.mz; p.rotationYaw = e.rotationYaw ??= f(Math.random() * 360); p.rotationPitch = 0; p.health = e.stack?.count ?? 1;
    } else if (kind === "orb") {
      p.y = e.posY ?? e.y + spec.yOff; p.vx = e.vx; p.vy = e.vy; p.vz = e.vz; p.rotationYaw = 0; p.rotationPitch = 0; p.health = 0;
    } else if (kind === "tnt" || kind === "falling") {
      p.y = e.y + spec.yOff; p.vx = e.vx; p.vy = e.vy; p.vz = e.vz; p.rotationYaw = 0; p.rotationPitch = 0; p.health = 0;
      p.block = e.block; p.meta = e.meta;
    } else { // arrows and thrown entities: posY is the box bottom, the motion is mx/my/mz, the rotation degrees
      p.y = e.y; p.vx = e.mx; p.vy = e.my; p.vz = e.mz; p.rotationYaw = e.yaw ?? 0; p.rotationPitch = e.pitch ?? 0; p.health = 0;
      p.shooterId = e.shooterId; p.damage = e.damage;
    }
    return p;
  }
  create(e) {
    const kind = this.kinds.get(e), spec = OBJECT_KINDS[kind];
    const p = this.read(kind, e, {});
    const object = spec.orb ? { orb: true, value: e.value } : { kind, data: spec.data(p), objectType: spec.type };
    const entry = new TrackerEntry(p, { range: spec.range, frequency: spec.frequency, velocity: spec.velocity, size: sizeClass(spec.width), arrow: !!spec.arrow, object }, this.view);
    return { entry, client: new ObjectClient(kind, this), health: p.health, wasGround: false };
  }
  observe(e, en) {
    const p = this.read(this.kinds.get(e), e, en.entry.e);
    return { airBorne: p.airBorne === true, changed: p.health !== en.health };
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
    for (const [e, en] of this.entries) if (!alive.has(e)) { en.entry.remove(); this.entries.delete(e); this.dying.push(en); }
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
  if (c.sim && (kind === "arrow" || OBJECT_KINDS[kind].thrown)) { v.yaw = c.yaw; v.pitch = c.pitch; v.prevYaw = c.sim.prevYaw ?? c.yaw; v.prevPitch = c.sim.prevPitch ?? c.pitch; }
  return v;
}
export const objectViews = (tracker, list, kind) => list.map((e) => objectView(tracker, e, kind));
