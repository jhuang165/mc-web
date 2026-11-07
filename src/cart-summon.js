// /summon MinecartRideable | MinecartChest | MinecartFurnace | MinecartTNT | MinecartHopper | MinecartCommandBlock with a data tag
// (Fuel, PushX, PushZ, TNTFuse, TransferCooldown, Items with original ids, CustomName, Motion). MinecartSpawner reads the MobSpawnerBaseLogic keys (spawner-cart.md).
import { nbtGet, hasNumber } from "./nbt-get.js";
import { NBT } from "./nbt.js";
import { isContainerType, slotCount } from "./cart-variants.js";
import { Y_OFFSET } from "./minecarts.js";

// SUMMONABLE values for the carts; command-host.js routes them here.
export const CART_SUMMON = Object.freeze({ MinecartRideable: "cart:0", MinecartChest: "cart:1", MinecartFurnace: "cart:2", MinecartTNT: "cart:3", MinecartSpawner: "cart:4", MinecartHopper: "cart:5", MinecartCommandBlock: "cart:6" });
export const cartTypeOfSummon = (type) => (typeof type === "string" && type.startsWith("cart:") ? Number(type.slice(5)) : null);

// `y` is the location CommandSummon (and MobSpawnerBaseLogic) pass to Entity.setLocationAndAngles, which stores posY = y + yOffset: a cart's box then
// starts at y, not 0.35 below it (summon-reference.json, tools/probes/SummonProbe.java: a cart at y 64.5 has posY 64.85 and its box from 64.5).
export function summonCart(minecarts, type, x, y, z, tag) {
  if (!minecarts) return false;
  const record = { x, y: y + Y_OFFSET, z, items: [] }, ignored = [];
  if (tag instanceof Map) {
    if (hasNumber(tag, "Fuel")) record.fuel = nbtGet(tag, "Fuel", NBT.SHORT, 0);
    if (hasNumber(tag, "PushX")) record.pushX = nbtGet(tag, "PushX", NBT.DOUBLE, 0);
    if (hasNumber(tag, "PushZ")) record.pushZ = nbtGet(tag, "PushZ", NBT.DOUBLE, 0);
    if (hasNumber(tag, "TNTFuse")) record.fuse = nbtGet(tag, "TNTFuse", NBT.INT, -1);
    if (hasNumber(tag, "TransferCooldown")) record.cooldown = nbtGet(tag, "TransferCooldown", NBT.INT, -1);
    const name = nbtGet(tag, "CustomName", NBT.STRING, "");
    if (name) record.customName = name;
    if (type === 6) { // CommandBlockLogic.func_145759_b (agp.b(dh)); the CustomName key is shared with the entity name
      record.command = { command: nbtGet(tag, "Command", NBT.STRING, ""), successCount: nbtGet(tag, "SuccessCount", NBT.INT, 0) };
      if (name) record.command.customName = name;
      if (hasNumber(tag, "TrackOutput")) record.command.trackOutput = !!nbtGet(tag, "TrackOutput", NBT.BYTE, 1);
      const last = nbtGet(tag, "LastOutput", NBT.STRING, null);
      if (last != null) record.command.lastOutput = last;
    }
    if (type === 4) record.spawner = spawnerRecord(tag);
    const items = nbtGet(tag, "Items", NBT.LIST);
    if (isContainerType(type)) {
      for (const it of items?.items ?? []) {
        const slot = nbtGet(it, "Slot", NBT.BYTE, -1) & 255;
        if (slot < slotCount(type)) record.items.push({ slot, id: nbtGet(it, "id", NBT.SHORT, 0), damage: nbtGet(it, "Damage", NBT.SHORT, 0), count: nbtGet(it, "Count", NBT.BYTE, 0) });
      }
    } else if (items) ignored.push("Items");
  }
  const cart = minecarts.spawnCart(type, record);
  const motion = tag instanceof Map ? nbtGet(tag, "Motion", NBT.LIST) : null;
  if (motion?.elementType === NBT.DOUBLE) [cart.vx, cart.vy, cart.vz] = [0, 1, 2].map((i) => (Number.isFinite(motion.items[i]) && Math.abs(motion.items[i]) <= 10 ? motion.items[i] : 0));
  return { ignored, cart };
}

// MobSpawnerBaseLogic.readFromNBT (agq.a(dh)) over a command tag: EntityId, Delay, MinSpawnDelay (with MaxSpawnDelay and SpawnCount),
// MaxNearbyEntities (with RequiredPlayerRange), SpawnRange, then SpawnPotentials and SpawnData as compounds.
// A command tag reaches readEntityFromNBT, which reads EntityId and Delay unconditionally: absent they are "" and 0.
export function spawnerRecord(tag) {
  const r = { EntityId: "", Delay: 0 }, num = ["Delay", "MinSpawnDelay", "MaxSpawnDelay", "SpawnCount", "MaxNearbyEntities", "RequiredPlayerRange", "SpawnRange"];
  if (tag.get("EntityId")?.type === NBT.STRING) r.EntityId = tag.get("EntityId").value;
  for (const k of num) if (hasNumber(tag, k)) r[k] = nbtGet(tag, k, NBT.SHORT, 0);
  const list = nbtGet(tag, "SpawnPotentials", NBT.LIST);
  if (list?.elementType === NBT.COMPOUND && list.items.length) r.SpawnPotentials = list.items;
  const data = nbtGet(tag, "SpawnData", NBT.COMPOUND);
  if (data) r.SpawnData = data;
  return r;
}
