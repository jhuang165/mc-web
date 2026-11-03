// Minecraft Java 1.7.10 anvil: ContainerRepair.updateRepairOutput (repair cost, material repair, tool
// combining, enchantment merging, renaming, "Too Expensive"), the output slot's take step (experience
// deduction, material consumption) and the anvil block's 12% damage roll.
// Standalone: no anvil block, GUI or packet is wired into the game yet. Replayed against
// public/research/anvil-reference.json (tools/verify-anvil.mjs, tools/probes/AnvilProbe.java).
//
// 1.7.10 uses the simple repair-cost rule (setRepairCost(max(left, right) [-9 if named, floored at 0] + 2)
// and the additive cost below); the later "prior work penalty = 2 * n + 1" is NOT used here.
//
// Stacks are the plain objects of enchantments.js, plus two NBT-backed fields:
//   {id, count = 1, damage = 0, enchantments, storedEnchantments, unbreakable, repairCost = 0, displayName}
// `repairCost` is the "RepairCost" int tag (absent = 0), `displayName` the display.Name string (absent =
// unnamed). All cost arithmetic is Java int arithmetic (32-bit wrap).

import {
  ENCHANTED_BOOK, ENCHANTMENTS_BY_ID, canApply, canApplyTogether, getEnchantments, setEnchantments, itemInfo,
  isItemStackDamageable, addExperienceLevel,
} from "./enchantments.js";

export const ANVIL_BLOCK = 145;
export const TOO_EXPENSIVE = 40;
// Anvil damage per use. nextFloat() < 0.12f: the Random is the using player's entity Random.
export const ANVIL_DAMAGE_CHANCE = Math.fround(0.12);
// World.playAuxSFX ids: 1021 anvil used, 1020 anvil broken.
export const SFX_ANVIL_USE = 1021, SFX_ANVIL_BREAK = 1020;

const int = (v) => v | 0;
const idiv = (a, b) => Math.trunc(a / b); // Java int division (truncates toward zero)

// Item.getIsRepairable(tool, material): repair material item per tool/armour material (ItemTool, ItemSword,
// ItemArmor). Hoes, bows, shears, fishing rods, flint and steel and carrot on a stick are not repairable.
// Metadata of the material stack is ignored (planks of any wood work).
const WOOD = 5, COBBLESTONE = 4, IRON_INGOT = 265, GOLD_INGOT = 266, DIAMOND = 264, LEATHER = 334;
export const REPAIR_MATERIAL = {};
for (const [material, ids] of [
  [WOOD, [268, 269, 270, 271]],
  [COBBLESTONE, [272, 273, 274, 275]],
  [IRON_INGOT, [267, 256, 257, 258, 302, 303, 304, 305, 306, 307, 308, 309]], // iron tools; chain and iron armour
  [DIAMOND, [276, 277, 278, 279, 310, 311, 312, 313]],
  [GOLD_INGOT, [283, 284, 285, 286, 314, 315, 316, 317]],
  [LEATHER, [298, 299, 300, 301]],
]) for (const id of ids) REPAIR_MATERIAL[id] = material;
export const isRepairable = (toolId, materialId) => REPAIR_MATERIAL[toolId] === materialId;

// org.apache.commons.lang3.StringUtils.isBlank: null, empty or only Character.isWhitespace characters
// (Unicode space separators except the no-break spaces U+00A0, U+2007 and U+202F, plus U+0009-000D, U+001C-001F).
const isJavaWhitespace = (c) =>
  (c >= 0x09 && c <= 0x0d) || (c >= 0x1c && c <= 0x20) || c === 0x1680 || (c >= 0x2000 && c <= 0x2006) || (c >= 0x2008 && c <= 0x200a) ||
  c === 0x2028 || c === 0x2029 || c === 0x205f || c === 0x3000;
export const isBlank = (name) => {
  if (name == null) return true;
  for (let i = 0; i < name.length; i++) if (!isJavaWhitespace(name.charCodeAt(i))) return false;
  return true;
};

export const getRepairCost = (stack) => int(stack.repairCost ?? 0);
export const setRepairCost = (stack, cost) => { stack.repairCost = int(cost); };
export const hasDisplayName = (stack) => typeof stack.displayName === "string";
// ItemStack.getDisplayName: the custom name, else the item's localised name from `itemName(stack)`.
export const getDisplayName = (stack, itemName) => (hasDisplayName(stack) ? stack.displayName : itemName(stack));
export const getMaxDamage = (stack) => itemInfo(stack.id).maxDamage;
// ItemStack.setItemDamage clamps below at 0.
const setItemDamage = (stack, damage) => { stack.damage = damage < 0 ? 0 : damage; };

export function copyStack(stack) {
  if (!stack) return null;
  const c = { ...stack };
  if (Array.isArray(stack.enchantments)) c.enchantments = stack.enchantments.map((e) => ({ ...e }));
  if (Array.isArray(stack.storedEnchantments)) c.storedEnchantments = stack.storedEnchantments.map((e) => ({ ...e }));
  return c;
}

// Enchantment weight to the cost multiplier of ContainerRepair: 10 -> 1, 5 -> 2, 2 -> 4, 1 -> 8, else 0.
export function rarityMultiplier(weight) {
  return weight === 1 ? 8 : weight === 2 ? 4 : weight === 5 ? 2 : weight === 10 ? 1 : 0;
}

const damageableStack = (stack) => isItemStackDamageable(stack);
const registered = (id) => {
  const e = ENCHANTMENTS_BY_ID[id];
  if (!e) throw new TypeError("Unregistered enchantment " + id); // Enchantment.enchantmentsList[id] is null: NullPointerException
  return e;
};

// ContainerRepair.updateRepairOutput as a pure function of the two inputs and the typed name.
//   left, right: stacks or null; name: repairedItemName (null, "" or text); creative: player capabilities
//   itemName(stack): localised item name used when the left stack has no custom name (name == name comparison)
// Returns {output, maximumCost, stackSizeToBeUsedInRepair}; the last is null when the original returns before
// resetting the field (no left stack), i.e. the container keeps its previous value.
export function updateRepairOutput(left, right, name, { creative = false, itemName = () => "" } = {}) {
  if (!left) return { output: null, maximumCost: 0, stackSizeToBeUsedInRepair: null };
  let cost = 0, renameCost = 0, base = 0;
  const out = copyStack(left);
  const map = getEnchantments(out);
  let book = false;
  base = int(base + getRepairCost(left) + (right ? getRepairCost(right) : 0));
  let used = 0;
  const fail = () => ({ output: null, maximumCost: 0, stackSizeToBeUsedInRepair: used });

  if (right) {
    book = right.id === ENCHANTED_BOOK && (right.storedEnchantments || []).length > 0;
    if (damageableStack(out) && isRepairable(left.id, right.id)) {
      // Material repair: each unit restores up to a quarter of the maximum durability.
      const quarter = () => Math.min(out.damage ?? 0, idiv(getMaxDamage(out), 4));
      let j = quarter();
      if (j <= 0) return fail();
      let k = 0;
      for (; j > 0 && k < (right.count ?? 1); k++) {
        setItemDamage(out, (out.damage ?? 0) - j);
        cost = int(cost + Math.max(1, idiv(j, 100)) + map.size);
        j = quarter();
      }
      used = k;
    } else {
      if (!book && (out.id !== right.id || !damageableStack(out))) return fail();
      if (damageableStack(out) && !book) {
        // Two damaged tools: remaining durabilities plus a 12% bonus.
        const leftRemaining = getMaxDamage(left) - (left.damage ?? 0);
        const rightRemaining = getMaxDamage(right) - (right.damage ?? 0);
        const bonus = int(rightRemaining + idiv(getMaxDamage(out) * 12, 100));
        let remaining = getMaxDamage(out) - int(leftRemaining + bonus);
        if (remaining < 0) remaining = 0;
        if (remaining < (out.damage ?? 0)) {
          setItemDamage(out, remaining);
          cost = int(cost + Math.max(1, idiv(bonus, 100)));
        }
      }
      // Enchantment merge, in the right stack's enchantment order.
      for (const [id, rightLevel] of getEnchantments(right)) {
        const e = registered(id);
        const leftLevel = map.has(id) ? map.get(id) : 0;
        let level = leftLevel === rightLevel ? rightLevel + 1 : Math.max(leftLevel, rightLevel);
        const diff = level - leftLevel;
        let applies = canApply(e, left);
        if (creative || left.id === ENCHANTED_BOOK) applies = true;
        for (const other of map.keys()) {
          const o = ENCHANTMENTS_BY_ID[other];
          if (other !== id && o && !canApplyTogether(e, o)) { applies = false; cost = int(cost + diff); }
        }
        if (!applies) continue;
        if (level > e.maxLevel) level = e.maxLevel;
        map.set(id, level);
        let mult = rarityMultiplier(e.weight);
        if (book) mult = Math.max(1, mult >> 1);
        cost = int(cost + mult * diff);
      }
    }
  }

  // Renaming.
  if (isBlank(name)) {
    if (hasDisplayName(left)) {
      renameCost = damageableStack(left) ? 7 : int((left.count ?? 1) * 5);
      cost = int(cost + renameCost);
      delete out.displayName;
    }
  } else if (name !== getDisplayName(left, itemName)) {
    renameCost = damageableStack(left) ? 7 : int((left.count ?? 1) * 5);
    cost = int(cost + renameCost);
    if (hasDisplayName(left)) base = int(base + idiv(renameCost, 2));
    out.displayName = name;
  }

  // Cost of the final enchantment set.
  let counter = 0;
  for (const [id, level] of map) {
    const e = registered(id);
    counter++;
    let mult = rarityMultiplier(e.weight);
    if (book) mult = Math.max(1, mult >> 1);
    base = int(base + counter + level * mult);
  }
  if (book) base = Math.max(1, idiv(base, 2));

  let maximumCost = int(base + cost);
  let output = out;
  if (cost <= 0) output = null;
  if (renameCost === cost && renameCost > 0 && maximumCost >= TOO_EXPENSIVE) maximumCost = TOO_EXPENSIVE - 1; // rename only: never "too expensive"
  if (maximumCost >= TOO_EXPENSIVE && !creative) output = null;

  if (output) {
    let repair = getRepairCost(output);
    if (right && repair < getRepairCost(right)) repair = getRepairCost(right);
    if (hasDisplayName(output)) repair = int(repair - 9);
    if (repair < 0) repair = 0;
    setRepairCost(output, repair + 2);
    setEnchantments(map, output);
  }
  return { output, maximumCost, stackSizeToBeUsedInRepair: used };
}

// BlockAnvil damage metadata: bits 0-1 facing, bits 2-3 damage stage 0..2. Returns the metadata after one
// more damaging use, or -1 when the anvil breaks (stage 3).
export function damagedAnvilMetadata(meta) {
  const facing = meta & 3;
  const stage = (meta >> 2) + 1;
  return stage > 2 ? -1 : facing | (stage << 2);
}

// ContainerRepair with its two input slots and the output slot's take step.
//   world: {isRemote, getBlock(x, y, z), getBlockMetadata(x, y, z), setBlockMetadataWithNotify(x, y, z, meta, flags),
//           setBlockToAir(x, y, z), playAuxSFX(id, x, y, z, data)}
//   player: {creative, experienceLevel, experienceTotal, experience}, read live (the container is built per player)
//   random: the player's Random (Entity.rand), used by the anvil damage roll
//   itemName(stack): localised default item name (see updateRepairOutput)
export class AnvilContainer {
  constructor({ world, x, y, z, player, random, itemName = () => "" }) {
    Object.assign(this, { world, x, y, z, player, random, itemName });
    this.inputs = [null, null];
    this.output = null;
    this.maximumCost = 0;
    this.stackSizeToBeUsedInRepair = 0;
    this.repairedItemName = null;
  }
  // InventoryBasic.setInventorySlotContents (stack limit 64) then onCraftMatrixChanged.
  setInput(slot, stack) {
    if (stack && (stack.count ?? 1) > 64) stack.count = 64;
    this.inputs[slot] = stack;
    this.updateRepairOutput();
  }
  // ContainerRepair.updateItemName: remember the text and recompute.
  setName(name) {
    this.repairedItemName = name;
    this.updateRepairOutput();
  }
  updateRepairOutput() {
    const r = updateRepairOutput(this.inputs[0], this.inputs[1], this.repairedItemName, { creative: !!this.player.creative, itemName: this.itemName });
    this.output = r.output;
    this.maximumCost = r.maximumCost;
    if (r.stackSizeToBeUsedInRepair !== null) this.stackSizeToBeUsedInRepair = r.stackSizeToBeUsedInRepair;
  }
  // SlotRepairOutput.canTakeStack. player: {creative, experienceLevel, experienceTotal, experience}.
  canTake(player = this.player) {
    return (player.creative || player.experienceLevel >= this.maximumCost) && this.maximumCost > 0 && this.output !== null;
  }
  // SlotRepairOutput.onPickupFromSlot. Returns the taken stack, or null when the player cannot take it.
  // Mutates the input slots, the player's experience and the world.
  take() {
    const { player, random } = this;
    if (!this.canTake(player)) return null;
    const stack = this.output;
    if (!player.creative) addExperienceLevel(player, -this.maximumCost);
    this.setInput(0, null);
    if (this.stackSizeToBeUsedInRepair > 0) {
      const material = this.inputs[1];
      if (material && (material.count ?? 1) > this.stackSizeToBeUsedInRepair) {
        material.count = (material.count ?? 1) - this.stackSizeToBeUsedInRepair;
        this.setInput(1, material);
      } else this.setInput(1, null);
    } else this.setInput(1, null);
    this.maximumCost = 0;
    const { world, x, y, z } = this;
    if (!player.creative && !world.isRemote && world.getBlock(x, y, z) === ANVIL_BLOCK && random.nextFloat() < ANVIL_DAMAGE_CHANCE) {
      const next = damagedAnvilMetadata(world.getBlockMetadata(x, y, z));
      if (next < 0) {
        world.setBlockToAir(x, y, z);
        world.playAuxSFX(SFX_ANVIL_BREAK, x, y, z, 0);
      } else {
        world.setBlockMetadataWithNotify(x, y, z, next, 2);
        world.playAuxSFX(SFX_ANVIL_USE, x, y, z, 0);
      }
    } else if (!world.isRemote) world.playAuxSFX(SFX_ANVIL_USE, x, y, z, 0);
    return stack;
  }
}
