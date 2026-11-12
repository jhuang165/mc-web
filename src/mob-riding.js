// Mob riding, Minecraft Java 1.7.10: Entity.mountEntity (sa.a), updateRidden (sa.ab), updateRiderPosition (sa.ac),
// getMountedYOffset (sa.ae), getYOffset (sa.ad) and EntityChicken's updateRiderPosition (wg.ac), plus the jockey
// spawns: EntitySpider.onSpawnWithEgg (yn.a) mounts a skeleton one time in a hundred, a child EntityZombie
// (yq.a) takes a free chicken in a 5 x 3 x 5 box or spawns a chicken jockey. Checked against the unchanged classes
// by tools/verify-mob-riding.mjs (public/research/mob-riding-reference.json); notes in public/research/mob-riding.md.
//
// A mount and its rider are two ordinary mobs joined by two non-enumerable references: `ridingEntity` on the rider
// (Entity.ridingEntity) and `riddenBy` on the mount (Entity.riddenByEntity). A save keeps one enumerable field,
// `riding`: the mount's id on the rider, which loading turns back into the references (linkRiders).
import { mhSin, mhCos } from "./lighting.js";
import { isVehicle, vehicleSeat } from "./vehicle-seat.js";
import { liveAttribute, healthBoostExtra } from "./mob-attributes.js";

const f = Math.fround;

// EntitySkeleton.getYOffset (yl.ad) is -0.5 (a wither skeleton too); every other rider here keeps Entity's 0.
export const riderYOffset = (type) => (type === "skeleton" || type === "wither_skeleton" ? -0.5 : 0);
// Entity.getMountedYOffset (sa.ae): height * 0.75 as a double of the float height; EntitySpider and EntityCaveSpider have no override.
export const mountedYOffset = (height) => f(height) * 0.75;

// Entity.updateRiderPosition: rider.setPosition(x, posY + getMountedYOffset() + rider.getYOffset(), z). EntityChicken
// (wg.ac) instead sits the rider on the chicken's body: (x + 0.1F * sin, y + height * 0.5F + rider.getYOffset(),
// z - 0.1F * cos) from renderYawOffset, and gives a living rider the chicken's renderYawOffset.
export function seatPosition(mount, rider, mountHeight) {
  if (isVehicle(mount)) return vehicleSeat(mount, riderYOffset(rider.type)); // boats and minecarts (vehicle-seat.js)
  if (mount.type === "chicken") {
    const a = f(f(mount.renderYawOffset * f(Math.PI)) / 180), s = mhSin(a), c = mhCos(a);
    return { x: mount.x + f(f(0.1) * s), y: mount.y + f(f(mountHeight) * f(0.5)) + riderYOffset(rider.type) + 0, z: mount.z - f(f(0.1) * c), renderYaw: mount.renderYawOffset };
  }
  return { x: mount.x, y: mount.y + mountedYOffset(mountHeight) + riderYOffset(rider.type), z: mount.z };
}

const hide = (o, key, value) => Object.defineProperty(o, key, { value, writable: true, configurable: true, enumerable: false });
// Entity.rotation deltas (entityRiderYawDelta, entityRiderPitchDelta), never saved.
const deltas = new WeakMap();

// Entity.setLocationAndAngles: the position and angles, with last tick's position the same.
export function setLocationAndAngles(e, x, y, z, yaw, pitch) {
  e.x = e.px = x;
  e.y = e.py = y;
  e.z = e.pz = z;
  e.rotationYaw = e.prevRotationYaw = yaw;
  e.rotationPitch = e.prevRotationPitch = pitch;
  e.yaw = (-yaw * Math.PI) / 180;
}

// Entity.mountEntity(mount): null dismounts to (mount.x, mount.minY + mount.height, mount.z) with the rider's own angles. A mount
// the rider already carries (anywhere up its own chain) is refused. Mounting releases a previous mount and overwrites whatever
// rode the new one. Returns whether the link changed.
export function mountEntity(rider, mount, heightOf) {
  deltas.set(rider, { yaw: 0, pitch: 0 });
  if (!mount) {
    const old = rider.ridingEntity;
    if (!old) return false;
    setLocationAndAngles(rider, old.x, old.y + f(heightOf(old)), old.z, rider.rotationYaw, rider.rotationPitch);
    hide(old, "riddenBy", null);
    hide(rider, "ridingEntity", null);
    return true;
  }
  for (let e = mount.ridingEntity; e; e = e.ridingEntity) if (e === rider) return false;
  if (rider.ridingEntity) hide(rider.ridingEntity, "riddenBy", null);
  hide(rider, "ridingEntity", mount);
  hide(mount, "riddenBy", rider);
  return true;
}

// Entity.setDead on a mount in the middle of its own update (EntityLiving.despawnEntity): isDead is set, and the rider, which updates right after it in the list, finds
// the mount dead in updateRidden and is let go where it sits within the same tick (b38 jockey records: the skeleton falls on the tick its spider despawns).
export function freeRider(mount) {
  const r = mount.riddenBy;
  if (!r) return;
  if (r.ridingEntity === mount) hide(r, "ridingEntity", null);
  hide(mount, "riddenBy", null);
}
// World.updateEntities (ahb.h) and Entity.updateRidden's start: a mount that is dead frees the rider where it sits (sa.ab clears ridingEntity and returns).
// The mount of this world's list is dead once it left the list; riders also forget a mount that no longer carries them.
export function releaseDead(entities) {
  for (const e of entities) {
    const m = e.ridingEntity;
    // A boat or minecart is not in the mob list: it frees the rider when it is dead (Entity.updateRidden's isDead branch).
    if (m && (isVehicle(m) ? m.dead : !entities.includes(m) || (m.health <= 0 && m.death >= 20))) {
      hide(e, "ridingEntity", null);
      if (m.riddenBy === e) hide(m, "riddenBy", null);
    }
    // World.updateEntityWithOptionalForce (ahb.a, after the mount's update): a rider that is dead, or no longer carried, is let go on both sides.
    const r = e.riddenBy;
    if (r && (r.ridingEntity !== e || (!entities.includes(r) && !r.unspawned) || (r.health <= 0 && r.death >= 20))) {
      if (r.ridingEntity === e) hide(r, "ridingEntity", null);
      hide(e, "riddenBy", null);
    }
  }
}

// World.updateEntityWithOptionalForce updates a mount first and its rider straight after (a rider is skipped in the world's loop).
export function ridingOrder(list) {
  if (!list.some((e) => e.ridingEntity)) return list;
  const out = [], seen = new Set(), visit = (e) => {
    if (seen.has(e)) return;
    seen.add(e);
    out.push(e);
    if (e.riddenBy && list.includes(e.riddenBy)) visit(e.riddenBy);
  };
  for (const e of list) if (!e.ridingEntity || !list.includes(e.ridingEntity)) visit(e);
  for (const e of list) visit(e);
  return out;
}

// The start of a rider's update: Entity.updateRidden zeroes the motion before onUpdate.
export function beginRidden(e) {
  e.vx = e.vy = e.vz = 0;
  e.fallDistance = 0;
}

// The rest of Entity.updateRidden after the rider's own update: updateRiderPosition, then the rider turns half way (at most 10
// degrees a tick) with the change of the mount's yaw and pitch.
export function endRidden(e, heightOf) {
  const m = e.ridingEntity;
  if (!m) return;
  const seat = seatPosition(m, e, heightOf(m));
  e.x = seat.x;
  e.y = seat.y;
  e.z = seat.z;
  if (seat.renderYaw !== undefined && e.health > 0) e.renderYawOffset = seat.renderYaw;
  const d = deltas.get(e) ?? { yaw: 0, pitch: 0 };
  d.yaw += f((m.rotationYaw ?? m.yaw ?? 0) - (m.prevRotationYaw ?? m.prevYaw ?? 0));
  d.pitch += f((m.rotationPitch ?? m.pitch ?? 0) - (m.prevRotationPitch ?? m.prevPitch ?? 0));
  while (d.yaw >= 180) d.yaw -= 360;
  while (d.yaw < -180) d.yaw += 360;
  while (d.pitch >= 180) d.pitch -= 360;
  while (d.pitch < -180) d.pitch += 360;
  const clamp = (v) => Math.max(-10, Math.min(10, v * 0.5)), dy = clamp(d.yaw), dp = clamp(d.pitch);
  d.yaw -= dy;
  d.pitch -= dp;
  deltas.set(e, d);
  e.rotationYaw = f(e.rotationYaw + dy);
  e.rotationPitch = f((e.rotationPitch ?? 0) + dp);
  e.yaw = (-e.rotationYaw * Math.PI) / 180;
}

// A saved rider records its mount's id; loading rebuilds the links and drops an id nothing carries.
export const ridingId = (e) => (isVehicle(e.ridingEntity) ? `${e.ridingEntity.boat ? "boat" : "cart"}-${e.ridingEntity.id}` : e.ridingEntity?.id);
export function linkRiders(entities, heightOf) {
  const byId = new Map(entities.map((e) => [e.id, e]));
  for (const e of entities) {
    const id = e.riding;
    if (typeof id === "string" && /^(boat|cart)-/.test(id)) continue; // a vehicle's rider: vehicle-riders.js links it once the vehicles are loaded
    delete e.riding;
    const m = typeof id === "string" ? byId.get(id) : null;
    if (m && m !== e && m.health > 0) mountEntity(e, m, heightOf);
  }
}

// EntityChicken.getExperiencePoints (wg.e): 10 for a jockey without drawing from the random, else the animal's.
export const JOCKEY_EXPERIENCE = 10;
// EntityChicken.canDespawn (wg.v): a jockey with nobody on it.
export const chickenJockeyDespawns = (e) => e.type === "chicken" && !!e.chickenJockey && !e.riddenBy;
// The leader zombie's max-health bonus raises the cap only (nothing sets the health): a mob's own maximum, else its type's. Since batch 24 any mob
// can carry one (an imported generic.maxHealth base or modifier). Wolves, slimes and horses set their own base (EntityWolf.setTamed 20 or 8,
// EntitySlime.setSlimeSize size * size, the horse's rolled or saved base); their saved modifiers apply on top, operations 0/1/2 in
// ModifiableAttributeInstance order (probed attributes2 `maxHealth`: a tamed wolf with +4 is 24, a size 4 slime with *1.5 is 24).
export const OWN_MAX_HEALTH = new Set(["wolf", "slime", "magma_cube", "horse"]);
export const ownMaxHealthBase = (e, fallback) => e.type === "wolf" ? (e.owner ? 20 : 8)
  : e.type === "horse" ? (Number.isFinite(e.horse?.maxHealth) ? e.horse.maxHealth : fallback)
  : (Number.isInteger(e.size) && e.size >= 1 ? e.size * e.size : 1);
// setTamed and setSlimeSize overwrite any saved base; a wild wolf or a horse keeps it (`attributeBases`).
const baseIsReset = (e) => (e.type === "wolf" && !!e.owner) || e.type === "slime" || e.type === "magma_cube";
export function maxHealthOf(e, base) {
  const extra = healthBoostExtra(e);
  if (OWN_MAX_HEALTH.has(e.type)) return liveAttribute(baseIsReset(e) ? { modifiers: e.modifiers } : e, "generic.maxHealth", ownMaxHealthBase(e, base), extra);
  const own = Number.isFinite(e.maxHealth) && e.maxHealth > 0 ? e.maxHealth : base;
  if (!extra.length) return own;
  // a stored modifier or base decides the value (the potion modifier joins its operation 0 sum); a bare imported maximum just gains the amount
  return e.modifiers?.some((m) => m.attribute === "generic.maxHealth") || Number.isFinite(e.attributeBases?.["generic.maxHealth"]) ? liveAttribute(e, "generic.maxHealth", base, extra) : liveAttribute({}, "generic.maxHealth", own, extra);
}

// EntityAISelector sj.b over a chicken list: alive and not ridden. The box is the zombie's grown by 5, 3, 5.
export function freeChickenNear(zombie, entities, size) {
  const [zw, zh] = size(zombie), hw = zw / 2, box = [zombie.x - hw - 5, zombie.y - 3, zombie.z - hw - 5, zombie.x + hw + 5, zombie.y + zh + 3, zombie.z + hw + 5];
  for (const c of entities) {
    if (c.type !== "chicken" || c === zombie || !(c.health > 0) || c.riddenBy) continue;
    const [cw, ch] = size(c), w = cw / 2;
    if (c.x + w > box[0] && c.x - w < box[3] && c.y + ch > box[1] && c.y < box[4] && c.z + w > box[2] && c.z - w < box[5]) return c;
  }
  return null;
}
