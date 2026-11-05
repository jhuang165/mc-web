// /summon MinecartRideable | MinecartChest | MinecartFurnace | MinecartTNT | MinecartHopper | MinecartCommandBlock with a data tag
// (Fuel, PushX, PushZ, TNTFuse, TransferCooldown, Items with original ids, CustomName, Motion). The spawner cart is not modelled.
import { nbtGet, hasNumber } from "./nbt-get.js";
import { NBT } from "./nbt.js";
import { isContainerType, slotCount } from "./cart-variants.js";

// SUMMONABLE values for the carts; command-host.js routes them here.
export const CART_SUMMON = Object.freeze({ MinecartRideable: "cart:0", MinecartChest: "cart:1", MinecartFurnace: "cart:2", MinecartTNT: "cart:3", MinecartHopper: "cart:5", MinecartCommandBlock: "cart:6" });
export const cartTypeOfSummon = (type) => (typeof type === "string" && type.startsWith("cart:") ? Number(type.slice(5)) : null);

export function summonCart(minecarts, type, x, y, z, tag) {
  if (!minecarts) return false;
  const record = { x, y, z, items: [] }, ignored = [];
  if (tag instanceof Map) {
    if (hasNumber(tag, "Fuel")) record.fuel = nbtGet(tag, "Fuel", NBT.SHORT, 0);
    if (hasNumber(tag, "PushX")) record.pushX = nbtGet(tag, "PushX", NBT.DOUBLE, 0);
    if (hasNumber(tag, "PushZ")) record.pushZ = nbtGet(tag, "PushZ", NBT.DOUBLE, 0);
    if (hasNumber(tag, "TNTFuse")) record.fuse = nbtGet(tag, "TNTFuse", NBT.INT, -1);
    if (hasNumber(tag, "TransferCooldown")) record.cooldown = nbtGet(tag, "TransferCooldown", NBT.INT, -1);
    const name = nbtGet(tag, "CustomName", NBT.STRING, "");
    if (name) record.customName = name;
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
  return { ignored };
}
