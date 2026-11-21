// b87 summon87: Entity.readFromNBT (sa.f) and Entity.writeToNBT (sa.e) keys for the object entities whose own update never runs
// Entity.onEntityUpdate (sa.C): EntityTNTPrimed.h and EntityFallingBlock.h (bytecode-read). Their Air, Rotation, PortalCooldown, Dimension,
// UUID and Invulnerable therefore stay as read; OnGround and FallDistance are moveEntity's. summon87-reference.json (executed, Summon87Probe):
// a /summon tag's Rotation [400, -200], FallDistance -3.5, Air 11, Dimension -1, PortalCooldown 9 and UUID 5/6 are all written back
// (yaw % 360 = 40, pitch -200 % 360 = -200); an id-only tag writes Air 0, Rotation [0, 0], Dimension 0, PortalCooldown 0.
// Record fields: air, rotation [yaw, pitch] (degrees), portalCooldown, nbtDimension (the read Dimension; a record without one exports
// the dimension it is saved in, which is what the Entity constructor sets), uuid, invulnerable, onGround, fallDistance.
import { NBT } from "./nbt.js";
import { nbtGet } from "./nbt-get.js";
import { isUuid, uuidFields, newUuid, ensureUuid } from "./entity-uuid.js";

const f = Math.fround, short = (v) => (v << 16) >> 16, int = (v) => v | 0;
const finite = (v) => typeof v === "number" && Number.isFinite(v);

// sa.f: getTagList("Rotation", 5) (another element type reads as an empty list, func_150308_e past the end is 0), then setRotation (sa.b(FF)): yaw % 360
// and pitch % 360 (frem keeps the sign). FallDistance is the raw float (a negative one is kept), Air goes through setAir, Dimension and PortalCooldown are raw ints.
export function entityBaseOf(tag) {
  const rot = nbtGet(tag, "Rotation", NBT.LIST), items = rot?.elementType === NBT.FLOAT ? rot.items : [];
  const yaw = finite(items[0]) ? items[0] : 0, pitch = finite(items[1]) ? items[1] : 0;
  return {
    air: nbtGet(tag, "Air", NBT.SHORT, 0), rotation: [f(yaw % 360), f(pitch % 360)], portalCooldown: nbtGet(tag, "PortalCooldown", NBT.INT, 0),
    nbtDimension: nbtGet(tag, "Dimension", NBT.INT, 0), uuid: newUuid(), ...uuidFields(tag), invulnerable: nbtGet(tag, "Invulnerable", NBT.BYTE, 0) !== 0,
    // b88 entnbt88: a tag without both UUID longs keeps the constructor's UUID.randomUUID (sa.<init>, bytecode-read)
    onGround: nbtGet(tag, "OnGround", NBT.BYTE, 0) !== 0, fallDistance: f(nbtGet(tag, "FallDistance", NBT.FLOAT, 0)),
  };
}
// The browser save of those fields (defaults left out, so older records and fresh entities keep their shape).
export function entityBaseSave(e) {
  const o = {};
  if (Number.isInteger(e.air)) o.air = e.air;
  if (Array.isArray(e.rotation) && e.rotation.length === 2 && e.rotation.every(finite)) o.rotation = [...e.rotation];
  if (Number.isInteger(e.portalCooldown) && e.portalCooldown !== 0) o.portalCooldown = e.portalCooldown;
  if (Number.isInteger(e.nbtDimension)) o.nbtDimension = e.nbtDimension;
  o.uuid = ensureUuid(e); // b88 entnbt88: a natural one draws its random UUID on the first save (nothing reads it before writeToNBT)
  if (e.invulnerable === true) o.invulnerable = true;
  if (e.onGround === true) o.onGround = true;
  if (finite(e.fallDistance) && e.fallDistance !== 0) o.fallDistance = e.fallDistance;
  return o;
}
// A saved record back to the fields (unusable values dropped).
export function entityBaseRestore(d) {
  const o = {};
  if (!d || typeof d !== "object") return o;
  if (Number.isInteger(d.air)) o.air = short(d.air);
  if (Array.isArray(d.rotation) && d.rotation.length === 2 && d.rotation.every(finite)) o.rotation = d.rotation.map(f);
  if (Number.isInteger(d.portalCooldown)) o.portalCooldown = int(d.portalCooldown);
  if (Number.isInteger(d.nbtDimension)) o.nbtDimension = int(d.nbtDimension);
  if (isUuid(d.uuid)) o.uuid = d.uuid.toLowerCase();
  if (d.invulnerable === true) o.invulnerable = true;
  if (typeof d.onGround === "boolean") o.onGround = d.onGround;
  if (finite(d.fallDistance)) o.fallDistance = f(d.fallDistance);
  return o;
}

// b88 entnbt88 (executed, entnbt88-reference.json; bytecode-read sa.<init>, sa.f, sa.C): the Entity keys that no update of an item, orb, boat, cart, hanging entity or
// projectile changes, apart from the cooldown. Air: the constructor's datawatcher 1 starts at 300 (a "new:" row), readFromNBT's setAir(getShort("Air")) makes a tag
// without Air 0, and only EntityLivingBase.onEntityUpdate puts 300 back (an item, boat, cart, snowball, arrow or painting keeps 11 over ticks). UUID: UUID.randomUUID in the
// constructor, replaced only when the tag has both longs. Dimension: the constructor's provider id (-1 in the Nether), replaced by readFromNBT's getInteger, so a
// /summon in the Nether writes 0 (mobs too; only travelToDimension, sa.b(I), sets it again). PortalCooldown: the raw int (5000 and -7 load unchanged); sa.C counts a
// positive one down by 1 per update on a WorldServer (`if (am > 0) --am`, bytecode-read), and EntityHanging.onUpdate never calls it.
// Record fields: air (absent = 300, a natural entity), uuid, portalCooldown (absent = 0), nbtDimension (absent = the dimension it is saved in).
export function keptBaseOf(tag) {
  return { air: nbtGet(tag, "Air", NBT.SHORT, 0), uuid: newUuid(), ...uuidFields(tag), portalCooldown: nbtGet(tag, "PortalCooldown", NBT.INT, 0), nbtDimension: nbtGet(tag, "Dimension", NBT.INT, 0) };
}
export function keptBaseSave(e) {
  const o = { uuid: ensureUuid(e) };
  if (Number.isInteger(e.air)) o.air = e.air;
  if (Number.isInteger(e.portalCooldown) && e.portalCooldown !== 0) o.portalCooldown = e.portalCooldown;
  if (Number.isInteger(e.nbtDimension)) o.nbtDimension = e.nbtDimension;
  return o;
}
export function keptBaseRestore(d) {
  const o = {};
  if (!d || typeof d !== "object") return o;
  if (Number.isInteger(d.air)) o.air = short(d.air);
  if (isUuid(d.uuid)) o.uuid = d.uuid.toLowerCase();
  if (Number.isInteger(d.portalCooldown) && d.portalCooldown !== 0) o.portalCooldown = int(d.portalCooldown);
  if (Number.isInteger(d.nbtDimension)) o.nbtDimension = int(d.nbtDimension);
  return o;
}
// The countdown of Entity.onEntityUpdate for the kinds that run it without the port's portal walk (projectiles).
export function tickPortalCooldown(e) {
  if (e.portalCooldown > 0 && --e.portalCooldown === 0) delete e.portalCooldown;
}
// b88 entnbt88: the Entity keys a mob save used to drop (entities.js serializeOne listed them as transient). Fire, OnGround, FallDistance and rotationPitch are
// written by writeToNBT from the live fields, and readFromNBT puts them back (summon87-reference.json Pig row; entnbt88 ticks: a Pig's Fire -20 rests at -1 and a
// FallDistance -2 is kept). Saved only when they differ from the defaults, so older records keep their shape.
export function mobBaseSave(e) {
  const o = {};
  if (Number.isInteger(e.fire) && e.fire !== 0) o.fire = e.fire;
  if (e.onGround === true) o.onGround = true;
  if (finite(e.fallDistance) && e.fallDistance !== 0) o.fallDistance = e.fallDistance;
  if (finite(e.rotationPitch) && e.rotationPitch !== 0) o.rotationPitch = e.rotationPitch;
  return o;
}
// A saved mob record back to the live fields (readFromNBT: rotationPitch and prevRotationPitch both get the saved pitch).
export function mobBaseRestore(d) {
  const o = {};
  if (!d || typeof d !== "object") return o;
  if (Number.isInteger(d.fire)) o.fire = short(d.fire);
  if (typeof d.onGround === "boolean") o.onGround = d.onGround;
  if (finite(d.fallDistance)) o.fallDistance = f(d.fallDistance);
  if (finite(d.rotationPitch)) o.rotationPitch = o.prevRotationPitch = f(d.rotationPitch);
  return o;
}
// A chunk mob compound's keys for the record (Rotation[1] % 360, OnGround, FallDistance, Dimension; the import's Fire is java-mobs.js's).
export function mobBaseOf(tag) {
  const rot = nbtGet(tag, "Rotation", NBT.LIST), items = rot?.elementType === NBT.FLOAT ? rot.items : [], pitch = finite(items[1]) ? f(items[1] % 360) : 0;
  const o = { nbtDimension: nbtGet(tag, "Dimension", NBT.INT, 0) };
  if (pitch !== 0) o.rotationPitch = pitch;
  if (nbtGet(tag, "OnGround", NBT.BYTE, 0) !== 0) o.onGround = true;
  const fall = f(nbtGet(tag, "FallDistance", NBT.FLOAT, 0));
  if (fall !== 0) o.fallDistance = fall;
  const hurt = nbtGet(tag, "HurtTime", NBT.SHORT, 0), attack = nbtGet(tag, "AttackTime", NBT.SHORT, 0); // b92 entnbt92: sv.a reads both shorts (a missing one is 0)
  if (hurt !== 0) o.hurt = hurt;
  if (attack !== 0) o.attackTime = attack;
  const air = nbtGet(tag, "Air", NBT.SHORT, 300); // b91 entnbt91: sv.C counts it only in water, so a loaded mob keeps the saved supply (a record without `air` is 300)
  if (air !== 300) o.air = air;
  return o;
}
// A chunk compound's kept keys as a record (keptBaseOf with the defaults left out: Air 300 is what a record without `air` exports; a missing UUID is drawn on the first save).
export function keptBaseImport(tag) {
  const b = keptBaseOf(tag), o = { ...(b.air === 300 ? {} : { air: b.air }), ...uuidFields(tag), nbtDimension: b.nbtDimension };
  if (b.portalCooldown !== 0) o.portalCooldown = b.portalCooldown;
  return o;
}
