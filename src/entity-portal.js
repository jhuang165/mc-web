// Non-player entities in portals (1.7.10 Entity.onEntityUpdate / setInPortal / travelToDimension, tools/probes/EntityPortalProbe.java,
// public/research/entity-portal-reference.json). Mobs, dropped items and experience orbs travel; the player's tamed wolves and
// leashed animals do not follow (they stay in the dimension the browser unloads). Batch 37: minecarts and boats travel too
// (kinds "cart" and "boat": EntityMinecart.onUpdate xl.h has its own copy of the portal block, bytecode-read identical to Entity.onEntityUpdate's;
// EntityBoat.onUpdate xi.h runs Entity.onUpdate; neither overrides travelToDimension). Their collision box is the entity's own `bb`.
import { ENTITY_TYPES } from "./entities.js";
import { mobScale } from "./slime.js";
import { fast93, boxPair93 } from "./mpperf93-fast.js"; // b93 mpperf93
import { OVERWORLD, NETHER, END, PortalState, transferTarget, GAME_IDS } from "./dimensions.js";

// Entities that never reach moveEntity -> doBlockCollisions, or that the port does not move between dimensions.
const SKIPPED = new Set(["ender_dragon", "ender_crystal"]);
export const SIZES = { item: [0.25, 0.25], orb: [0.5, 0.5], arrow: [0.5, 0.5], rocket: [0.25, 0.25] }; // b90 entnbt90: zc setSize(0.5, 0.5), zf setSize(0.25, 0.25)
// Collision box of a record: half width and height; `e.y` is the bottom for all three kinds (a mob's feet).
export function boxOf(kind, e) {
  if (kind === "cart" || kind === "boat") return e.bb ? [(e.bb[3] - e.bb[0]) / 2, e.bb[4] - e.bb[1]] : null;
  if (kind === "mob") { const t = ENTITY_TYPES[e.type], s = mobScale(e); return t ? [(t.width * s) / 2, t.height * s] : null; }
  return [SIZES[kind][0] / 2, SIZES[kind][1]];
}
// Entity.posY, the value transferEntityToWorld hands to the Teleporter: a mob's feet, an item's bottom + yOffset, an orb's centre.
export const POS_Y = { mob: 0, item: 0.125, orb: 0.25, cart: 0, boat: 0, arrow: 0, rocket: 0 }; // arrows and rockets: yOffset 0, `y` is the bottom and posY // a cart's or boat's `y` is already its posY
export const mobYawToMc = (yaw) => (-yaw * 180) / Math.PI + 0;
export const mcToMobYaw = (deg) => (-deg * Math.PI) / 180 + 0;

// transferEntityToWorld + the End exit of travelToDimension, for a non-player entity in Minecraft units/degrees.
// `from` is the dimension it leaves, `arg` the travelToDimension argument (1 from the End is the exit to the spawn point).
// `teleporter`: a Teleporter over the target dimension; `spawn`/`heightAt`: the Overworld spawn and its column's height value.
export function placeAfterTravel({ from, arg, entity, teleporter, spawn, heightAt }) {
  const e = { vx: 0, vy: 0, vz: 0, pitch: 0, teleportDirection: 0, ...entity };
  if (travelRoute(from, arg).spawn) { // b89 entnbt89: `from` is the saved Dimension (travelSource)
    // travelToDimension: world.getSpawnPoint, posY = getHeightValue; the copy keeps yaw, pitch and motion, no Teleporter.
    return { to: OVERWORLD, e: { ...e, x: spawn.x, y: heightAt(spawn.x, spawn.z), z: spawn.z }, teleporter: false };
  }
  const tt = transferTarget(from, arg, e.x, e.y, e.z, e.yaw);
  Object.assign(e, { x: tt.x, y: tt.y, z: tt.z, yaw: tt.yaw });
  if (arg === END) e.pitch = 0;
  if (tt.teleporter) teleporter.placeInPortal(e, tt.origin.x, tt.origin.y, tt.origin.z, tt.origin.yaw);
  e.yaw %= 360; // the copy is built from NBT: Entity.readFromNBT keeps rotationYaw % 360
  return { to: arg, e, teleporter: tt.teleporter };
}

// b89 entnbt89 (bytecode-read sa.b(I), MinecraftServer.a(I), oi.a(sa, int, mt, mt)): travelToDimension takes its source as `this.dimension`, the saved Dimension tag
// (nbtDimension; a record without one is in the dimension it was made in), not the world it stands in. j = this.dimension, i = the argument: the destination is
// worldServerForDimension(i), or the Overworld (and dimension 0) when j == 1 and i == 1; transferEntityToWorld(entity, j, world(j), world(i)) scales by the new dimension
// (-1: / 8, 0: * 8, else the End's entrance, or the spawn when j == 1) and runs the Teleporter only when j != 1; the copy goes to the world spawn's top only when
// j == 1 and i == 1. world(j) itself only takes the old entity's chunk bookkeeping (updateEntityWithOptionalForce), which the port does not keep. So a /summon in the
// End (Dimension 0) that walks into the exit portal lands on the End's obsidian platform at (100, 49, 0), and an entity tagged Dimension 1 elsewhere skips the Teleporter.
export const travelSource = (e, live) => (Number.isInteger(e?.nbtDimension) ? e.nbtDimension : live);
export function travelRoute(source, arg) {
  const exit = source === END && arg === END;
  return { to: exit ? OVERWORLD : arg, spawn: exit, teleporter: source !== END };
}

// b97 portals97 (bytecode-read oi.a(sa, int, mt, mt), Executed Portals97Probe): a destination of the End puts the entity at (100, 49, 0) with yaw 90 and pitch 0 BEFORE copyDataFrom, so the copy's Rotation
// pitch is 0; the Nether and Overworld Teleporter keep the pitch, and the End exit (source 1, argument 1) copies the entity as it is.
export const endArrival = (source, arg) => arg === END && !travelRoute(source, arg).spawn;

// Per-entity Entity.timeUntilPortal / portalCounter / inPortal. The cooldown is the saved PortalCooldown tag (record.portalCooldown).
export class EntityPortals {
  constructor() { this.states = new WeakMap(); this.last = new WeakMap(); }
  state(e) {
    let s = this.states.get(e);
    if (!s) { s = new PortalState(); s.timeUntilPortal = e.portalCooldown | 0; /* b88 entnbt88: the raw PortalCooldown (readFromNBT's getInteger; 5000 and -7 load unchanged, entnbt88-reference.json) */ this.states.set(e, s); }
    return s;
  }
  // One tick after the entity moved. Returns null or { arg, endPortal, direction }: the travelToDimension argument.
  // `getId(x,y,z)`: block id of the current dimension; `dim`: the dimension; `riding`: it has a rider or a vehicle.
  // `ridden`: something rides it (BlockPortal and BlockEndPortal ignore it, but the countdown of Entity.onEntityUpdate still runs).
  // b90 entnbt90: `counted` = the entity's own update already ran sa.C's cooldown countdown (arrows, rockets); `noCollide` = it skips doBlockCollisions this update (an arrow
  // that started the update in the ground returns before zc.h's I() call).
  step(e, kind, { dim, getId, riding = false, ridden = false, counted = false, noCollide = false }) {
    const box = boxPair93(kind, e, boxOf, ENTITY_TYPES, mobScale, SIZES); // b93: a scratch pair, read before anything else calls it
    if (!box || (kind === "mob" && (e.health <= 0 || SKIPPED.has(e.type)))) return null;
    const s = this.state(e);
    let px, pz; // the position of the previous step (this one's when there was none)
    const lp = this.last.get(e);
    if (lp === undefined) { px = e.x; pz = e.z; this.last.set(e, { x: e.x, z: e.z }); }
    else if (fast93.mode === "off") { px = lp.x; pz = lp.z; this.last.set(e, { x: e.x, z: e.z }); }
    else { px = lp.x; pz = lp.z; lp.x = e.x; lp.z = e.z; } // b93 mpperf93: rewritten in place
    let result = null;
    // Entity.onEntityUpdate runs first in the next tick: it consumes the inPortal the previous tick's collision set.
    if (counted) s.timeUntilPortal = e.portalCooldown | 0;
    const go = s.tick(dim, { isPlayer: false, riding, countdown: !counted });
    if (go !== null) result = { arg: go, endPortal: false, direction: s.teleportDirection };
    else if (!riding && !ridden && !noCollide) {
      const hw = box[0], h = box[1], vehicle = kind === "cart" || kind === "boat", bb = e.bb;
      // doBlockCollisions: the box shrunk by 0.001 on every side; a vehicle has its own box, the others hang off their position.
      const x0 = Math.floor((vehicle ? bb[0] : e.x - hw) + 0.001), x1 = Math.floor((vehicle ? bb[3] : e.x + hw) - 0.001), z0 = Math.floor((vehicle ? bb[2] : e.z - hw) + 0.001), z1 = Math.floor((vehicle ? bb[5] : e.z + hw) - 0.001);
      const y0 = Math.floor((vehicle ? bb[1] : e.y) + 0.001), y1 = Math.floor((vehicle ? bb[4] : e.y + h) - 0.001);
      let nether = false, end = false;
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) {
        const b = getId(x, y, z);
        if (b === GAME_IDS.portal) nether = true; else if (b === GAME_IDS.endPortal) end = true;
      }
      // BlockEndPortal.onEntityCollidedWithBlock: travelToDimension(1) at once, no cooldown test and none written.
      if (end) result = { arg: END, endPortal: true, direction: s.teleportDirection };
      else if (nether) s.setInPortal(px, pz, e.x, e.z, { isPlayer: false });
    }
    if (s.timeUntilPortal !== 0) e.portalCooldown = s.timeUntilPortal; else if (e.portalCooldown !== undefined) delete e.portalCooldown; // b88 entnbt88: a negative one is kept too
    return result;
  }
  // The cooldown written before travelToDimension(Nether portal: 300); End portal travel keeps the one it had.
  cooldownAfter(e, result) { return result.endPortal ? e.portalCooldown | 0 : 300; }
}

// A departing entity as the destination's inbox takes it: its save record (a vehicle without a rider, the 300-tick cooldown or, for the End portal, the one it had)
// and the transferEntityToWorld input in Minecraft units. Shared by the live tick (dimension-live.js depart) and the away run (away-entities.js).
export function entityDeparture(portals, kind, e, r, owner) {
  const rec = structuredClone(owner.serializeOne(e));
  const vehicle = kind === "cart" || kind === "boat";
  delete rec.rider; // the player never travels with the vehicle
  rec.portalCooldown = portals.cooldownAfter(e, r) || undefined;
  if (kind === "item") { delete rec.delay; delete rec.hover; } // b94 portals94 (bytecode-read xk.b/xk.a): EntityItem writes only Health, Age, Thrower, Owner and Item; the pickup delay (xk.b) and hoverStart (xk.c, random in the constructor) are not NBT, so the copy (new EntityItem(world)) starts with delay 0 and a fresh hover
  const source = Number.isInteger(e.nbtDimension) ? e.nbtDimension : undefined; // b89 entnbt89: travelToDimension's source (travelSource); undefined = the live dimension
  delete rec.nbtDimension; // b88 entnbt88: travelToDimension (sa.b(I), bytecode-read) sets Entity.dimension to the destination, which copyDataFrom carries over
  const v = { vx: e.vx ?? e.mx ?? 0, vy: e.vy ?? e.my ?? 0, vz: e.vz ?? e.mz ?? 0 };
  const mc = vehicle ? { x: e.x, y: e.posY, z: e.z, ...v, yaw: e.yaw ?? 0, pitch: 0 }
    : kind === "mob" ? { x: e.x, y: e.y, z: e.z, ...v, yaw: mobYawToMc(e.yaw ?? 0), pitch: 0 }
    : kind === "arrow" || kind === "rocket" ? { x: e.x, y: e.y + POS_Y[kind], z: e.z, ...v, yaw: e.yaw ?? 0, pitch: e.pitch ?? 0 } // degrees, as zc.h / zf.h store them
    : { x: e.x, y: e.y + POS_Y[kind], z: e.z, ...v, yaw: 0, pitch: 0 };
  mc.teleportDirection = r.direction;
  return { rec, mc, arg: r.arg, source };
}
export { OVERWORLD, NETHER, END };
