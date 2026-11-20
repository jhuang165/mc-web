// b87 summon87: Entity.readFromNBT (sa.f) and Entity.writeToNBT (sa.e) keys for the object entities whose own update never runs
// Entity.onEntityUpdate (sa.C): EntityTNTPrimed.h and EntityFallingBlock.h (bytecode-read). Their Air, Rotation, PortalCooldown, Dimension,
// UUID and Invulnerable therefore stay as read; OnGround and FallDistance are moveEntity's. summon87-reference.json (executed, Summon87Probe):
// a /summon tag's Rotation [400, -200], FallDistance -3.5, Air 11, Dimension -1, PortalCooldown 9 and UUID 5/6 are all written back
// (yaw % 360 = 40, pitch -200 % 360 = -200); an id-only tag writes Air 0, Rotation [0, 0], Dimension 0, PortalCooldown 0.
// Record fields: air, rotation [yaw, pitch] (degrees), portalCooldown, nbtDimension (the read Dimension; a record without one exports
// the dimension it is saved in, which is what the Entity constructor sets), uuid, invulnerable, onGround, fallDistance.
import { NBT } from "./nbt.js";
import { nbtGet } from "./nbt-get.js";
import { isUuid, uuidFields } from "./entity-uuid.js";

const f = Math.fround, short = (v) => (v << 16) >> 16, int = (v) => v | 0;
const finite = (v) => typeof v === "number" && Number.isFinite(v);

// sa.f: getTagList("Rotation", 5) (another element type reads as an empty list, func_150308_e past the end is 0), then setRotation (sa.b(FF)): yaw % 360
// and pitch % 360 (frem keeps the sign). FallDistance is the raw float (a negative one is kept), Air goes through setAir, Dimension and PortalCooldown are raw ints.
export function entityBaseOf(tag) {
  const rot = nbtGet(tag, "Rotation", NBT.LIST), items = rot?.elementType === NBT.FLOAT ? rot.items : [];
  const yaw = finite(items[0]) ? items[0] : 0, pitch = finite(items[1]) ? items[1] : 0;
  return {
    air: nbtGet(tag, "Air", NBT.SHORT, 0), rotation: [f(yaw % 360), f(pitch % 360)], portalCooldown: nbtGet(tag, "PortalCooldown", NBT.INT, 0),
    nbtDimension: nbtGet(tag, "Dimension", NBT.INT, 0), ...uuidFields(tag), invulnerable: nbtGet(tag, "Invulnerable", NBT.BYTE, 0) !== 0,
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
  if (isUuid(e.uuid)) o.uuid = e.uuid;
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
