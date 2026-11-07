// /summon for the EntityList registrations that are not mobs or carts: Item, XPOrb, PrimedTnt, FallingSand, Boat and the in-flight
// projectiles (Arrow, Snowball, Fireball, SmallFireball, WitherSkull, ThrownPotion, ThrownExpBottle, ThrownEnderpearl,
// EyeOfEnderSignal). CommandSummon (bu.b) builds each with EntityList.createEntityFromNBT and then moves it to the command's
// x, y, z (setLocationAndAngles keeps the entity's rotation), so the tag's own Pos is replaced. Keys outside each class's
// readEntityFromNBT are reported by the caller as ignored. Notes: public/research/commands.md.
import { NBT } from "./nbt.js";
import { nbtGet, hasNumber } from "./nbt-get.js";
import { JAVA_PROJECTILES, javaProjectileFromNbt } from "./java-projectiles.js";
import { primeTnt } from "./explosion.js";
import { newOrb } from "./experience.js";
import { spawnFalling, isFallingBlock, FALLING_Y_OFFSET } from "./falling.js";
import { fromOriginal } from "./block-registry.js";
import { ARTS } from "./hanging.js";

export const ENTITY_SUMMON = Object.freeze({
  Item: "entity:Item", XPOrb: "entity:XPOrb", PrimedTnt: "entity:PrimedTnt", FallingSand: "entity:FallingSand", Boat: "entity:Boat",
  Painting: "entity:Painting", ItemFrame: "entity:ItemFrame", LeashKnot: "entity:LeashKnot",
  ...Object.fromEntries(Object.keys(JAVA_PROJECTILES).filter((id) => id !== "FireworksRocketEntity").map((id) => [id, "entity:" + id])),
});
export const entityIdOfSummon = (type) => (typeof type === "string" && type.startsWith("entity:") ? type.slice(7) : null);
// The keys each class reads (Entity.readFromNBT's own keys are Pos, Motion, Rotation, FallDistance, Fire, Air, OnGround, Dimension, Invulnerable, PortalCooldown, UUID).
const BASE_KEYS = ["id", "Pos", "Motion", "Rotation", "FallDistance", "Fire", "Air", "OnGround", "Dimension", "Invulnerable", "PortalCooldown", "UUIDMost", "UUIDLeast"];
const KEYS = {
  Item: ["Health", "Age", "Item", "PickupDelay", "Thrower", "Owner"], XPOrb: ["Health", "Age", "Value"], PrimedTnt: ["Fuse"],
  FallingSand: ["Tile", "TileID", "Data", "Time", "DropItem", "HurtEntities", "FallHurtMax", "FallHurtAmount", "TileEntityData"], Boat: [],
  Painting: ["Direction", "Dir", "TileX", "TileY", "TileZ", "Motive"], ItemFrame: ["Direction", "Dir", "TileX", "TileY", "TileZ", "Item", "ItemRotation", "ItemDropChance"], LeashKnot: [],
};
// What this build keeps of each key set (the rest is reported).
const KEPT = {
  Item: ["Age", "Item", "PickupDelay", "Motion"], XPOrb: ["Value", "Motion"], PrimedTnt: ["Fuse"], FallingSand: ["Tile", "TileID", "Data", "Time"], Boat: ["Motion", "Rotation"],
  Painting: ["Direction", "Dir", "TileX", "TileY", "TileZ", "Motive"], ItemFrame: ["Direction", "Dir", "TileX", "TileY", "TileZ", "Item", "ItemRotation", "ItemDropChance"], LeashKnot: [],
};

const list = (tag, key, type, n) => {
  const l = nbtGet(tag, key, NBT.LIST);
  return l?.elementType === type && l.items.length >= n && l.items.slice(0, n).every(Number.isFinite) ? l.items : null;
};
const motionOf = (tag) => (list(tag, "Motion", NBT.DOUBLE, 3) ?? [0, 0, 0]).map((v) => (Math.abs(v) > 10 ? 0 : v));
const pair = (type, value) => ({ type, value });
const doubles = (items) => pair(NBT.LIST, { elementType: NBT.DOUBLE, items });

// hosts: { items, xpOrbs, primed (array), falling (FallingBlocks), boats, projectiles, arrows, eyes, mobs, dimension }.
// Returns { ignored, spawned } (spawned false when the class discards itself on load, e.g. an Item without a stack).
export function summonEntity(hosts, id, x, y, z, tag, { convertItem = () => null } = {}) {
  const t = tag instanceof Map ? tag : new Map(), ignored = [];
  let vehicle = null; // the Boat a Riding chain can seat a mob in
  const known = new Set([...BASE_KEYS, ...(KEYS[id] ?? [])]);
  if (JAVA_PROJECTILES[id]) {
    const entity = new Map(t);
    entity.set("id", pair(NBT.STRING, id));
    entity.set("Pos", doubles([x, y, z]));
    const made = javaProjectileFromNbt(entity, { convertItem, dimension: hosts.dimension ?? 0 });
    if (!made.record) return { ignored: [`${id} (${made.lost})`], spawned: false };
    const record = made.record;
    const append = (holder, extra = {}) => holder.load([...holder.serialize(...(extra.args ?? [])), record], ...(extra.args ?? []));
    if (made.list === "projectiles") append(hosts.projectiles);
    else if (made.list === "arrows") append(hosts.arrows);
    else if (made.list === "thrownPotions") append(hosts.mobs.potions);
    else if (made.list === "fireballs") {
      const holder = record.kind === "witherSkull" ? hosts.mobs.skulls : hosts.mobs.fireballs, dim = hosts.dimension ?? 0;
      holder.load([...holder.serialize(dim), record], dim);
    } else if (made.list === "eyes") {
      const s = hosts.eyes.serialize();
      hosts.eyes.load({ random: s.random, eyes: [...s.eyes, record] });
    } else return { ignored: [`${id} (not kept)`], spawned: false };
    return { ignored: [...t.keys()].filter((k) => !known.has(k) && !PROJECTILE_KEYS.has(k)), spawned: true };
  }
  const motion = motionOf(t);
  let spawned = true;
  if (id === "Item") {
    const item = nbtGet(t, "Item", NBT.COMPOUND), stack = item ? convertItem(item) : null;
    if (!stack) spawned = false; // EntityItem.readEntityFromNBT: no readable stack is setDead
    else hosts.items.spawn(stack, x, y, z, { motion, delay: Math.max(0, Math.min(40, nbtGet(t, "PickupDelay", NBT.SHORT, 0))) }).age = Math.max(0, nbtGet(t, "Age", NBT.SHORT, 0));
  } else if (id === "XPOrb") {
    const value = nbtGet(t, "Value", NBT.SHORT, 0);
    if (value <= 0) spawned = false; // a 0-value orb has nothing to give; not kept
    else { const o = newOrb(value, x, y, z); [o.vx, o.vy, o.vz] = motion; hosts.xpOrbs.orbs.push(o); }
  } else if (id === "PrimedTnt") {
    const e = primeTnt(x, y, z, { fuse: nbtGet(t, "Fuse", NBT.BYTE, 0) });
    [e.vx, e.vy, e.vz] = motion;
    hosts.primed.push(e);
  } else if (id === "FallingSand") {
    // EntityFallingBlock.readEntityFromNBT: TileID (any numeric) when present, else Tile & 255; Data; Time.
    const original = hasNumber(t, "TileID") ? nbtGet(t, "TileID", NBT.INT, 0) : nbtGet(t, "Tile", NBT.BYTE, 0) & 255;
    const cell = fromOriginal(original, nbtGet(t, "Data", NBT.BYTE, 0) & 15);
    if (!cell || !isFallingBlock(cell.id)) spawned = false; // an unregistered or non-falling block: the entity discards itself or just hangs
    else {
      const e = spawnFalling(cell.id, cell.meta ?? 0, 0, 0, 0, hosts.falling.entityRandom());
      Object.assign(e, { x, y: y - FALLING_Y_OFFSET, z, px: x, py: y - FALLING_Y_OFFSET, pz: z, vx: motion[0], vy: motion[1], vz: motion[2], ticks: Math.max(1, nbtGet(t, "Time", NBT.BYTE, 0) & 255) });
      // EntityFallingBlock.readEntityFromNBT: HurtEntities (a number) reads FallHurtAmount (float) and FallHurtMax (int); without it only an anvil hurts.
      if (hasNumber(t, "HurtEntities")) Object.assign(e, { hurtEntities: nbtGet(t, "HurtEntities", NBT.BYTE, 0) !== 0, fallHurtAmount: nbtGet(t, "FallHurtAmount", NBT.FLOAT, 0), fallHurtMax: nbtGet(t, "FallHurtMax", NBT.INT, 0) });
      hosts.falling.entities.push(e);
    }
  } else if (id === "Boat") {
    const rotation = list(t, "Rotation", NBT.FLOAT, 2), boat = hosts.boats.spawnBoat({ x, y, z, yaw: rotation?.[0] ?? 0, vx: motion[0], vy: motion[1], vz: motion[2] });
    boat.pitch = boat.prevPitch = Math.fround(rotation?.[1] ?? 0);
    vehicle = boat;
  } else if (id === "Painting" || id === "ItemFrame") {
    // EntityHanging.readEntityFromNBT: a numeric "Direction" wins over the pre-1.2 "Dir" (0 to 3 mapped 2, 1, 0, 3; anything else leaves 0); then
    // TileX/Y/Z and setDirection. EntityPainting reads Motive first (an unknown name is Kebab); EntityItemFrame reads a non-empty Item and, only then,
    // ItemRotation (i % 4, Java remainder) and ItemDropChance.
    const dir = hasNumber(t, "Direction") ? nbtGet(t, "Direction", NBT.BYTE, 0) : [2, 1, 0, 3][nbtGet(t, "Dir", NBT.BYTE, 0)] ?? 0;
    const tx = nbtGet(t, "TileX", NBT.INT, 0), ty = nbtGet(t, "TileY", NBT.INT, 0), tz = nbtGet(t, "TileZ", NBT.INT, 0);
    // Any byte is kept (summon-reference.json: native CommandSummon spawns Direction 4, 5, 127 and -1; setDirection only turns yaw to dir * 90).
    if (!hosts.hanging) spawned = false;
    else if (id === "Painting") {
      const motive = nbtGet(t, "Motive", NBT.STRING, ""), art = ARTS.findIndex((a) => a[0] === motive);
      hosts.hanging.summon("painting", dir, tx, ty, tz, x, y, z, { art: art < 0 ? 0 : art });
    } else {
      const itemTag = nbtGet(t, "Item", NBT.COMPOUND), stack = itemTag && itemTag.size ? convertItem(itemTag) : null;
      const extra = {};
      if (stack) {
        extra.item = stack;
        extra.rotation = nbtGet(t, "ItemRotation", NBT.BYTE, 0) % 4;
        if (hasNumber(t, "ItemDropChance")) extra.dropChance = nbtGet(t, "ItemDropChance", NBT.FLOAT, 1);
      }
      hosts.hanging.summon("frame", dir, tx, ty, tz, x, y, z, extra);
    }
  } else if (id === "LeashKnot") {
    // su: readEntityFromNBT is empty, so only the base keys are read and the knot's tile stays 0, 0, 0.
    if (hosts.mobs?.knotSummon) hosts.mobs.knotSummon(x, y, z); else spawned = false;
  } else return { ignored: [`${id} (not kept)`], spawned: false };
  for (const k of t.keys()) if (!known.has(k) || (KEYS[id].includes(k) && !KEPT[id].includes(k))) ignored.push(k);
  return { ignored: ignored.filter((k) => k !== "id"), spawned, vehicle };
}
// Keys the projectile readers use beyond BASE_KEYS (java-projectiles.js).
const PROJECTILE_KEYS = new Set(["xTile", "yTile", "zTile", "inTile", "inData", "shake", "inGround", "pickup", "life", "damage", "direction", "ExplosionPower", "ownerName", "Potion", "potionValue", "inTile", "Item", "Life", "LifeTime"]);
