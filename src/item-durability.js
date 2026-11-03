// Live ItemStack.damageItem adapter. The replayed Java helper uses vanilla numeric
// item IDs while the browser inventory has its own IDs for several tool families.
import { attemptDamageItem } from "./enchantments.js";

const TOOL_IDS = {
  pickaxe: [270, 274, 257, 278, 285],
  axe: [271, 275, 258, 279, 286],
  shovel: [269, 273, 256, 277, 284],
  sword: [268, 272, 267, 276, 283],
};
const ARMOR_BASE = [298, 302, 306, 314, 310];

export function vanillaDamageItemId(stack, item) {
  if (item?.kind && TOOL_IDS[item.kind]) {
    const tier = stack.id >= 116 && stack.id <= 119 ? 4 : Number.isInteger(item.tier) ? item.tier : 0;
    const id = TOOL_IDS[item.kind][tier];
    if (id) return id;
  }
  if (item?.kind === "hoe") {
    const tier = ({ 120: 0, 121: 1, 122: 2, 123: 3, 124: 4 })[stack.id];
    return tier === undefined ? null : 290 + tier;
  }
  if (item?.armor !== undefined && stack.id >= 400 && stack.id <= 419) {
    const material = Math.floor((stack.id - 400) / 4), piece = item.armor;
    return (ARMOR_BASE[material] ?? 0) + piece || null;
  }
  if (item?.kind === "shears") return 359;
  if (item?.kind === "flint_and_steel") return 259;
  if (item?.kind === "bow") return 261;
  return null;
}

// Returns true when the live item crossed its own max-damage boundary. Copy the
// mutable fields into a vanilla-ID view so enchantments.js can apply the original
// Unbreaking type test (armour has its separate 60% random gate) without exposing
// browser-local IDs to that helper.
export function damageLiveItemStack(stack, item, amount, random) {
  const vanillaId = vanillaDamageItemId(stack, item);
  if (vanillaId === null) {
    stack.damage += amount;
    if (stack.damage <= item.durability) return false;
    return true;
  }
  const native = {
    id: vanillaId,
    damage: stack.damage ?? 0,
    count: stack.count,
    enchantments: stack.enchantments,
    unbreakable: stack.unbreakable,
  };
  attemptDamageItem(native, amount, random);
  stack.damage = native.damage;
  return stack.damage > item.durability;
}
