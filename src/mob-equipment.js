// Mob equipment of 1.7.10 (public/research/mob-equipment.md), replayed against
// public/research/mob-equipment-reference.json (tools/probes/EquipmentProbe.java):
// EntityLiving.addRandomArmor (sw.bC) and enchantEquipment (sw.bD), EntityZombie's iron sword or
// shovel, the Halloween pumpkin, getTotalArmorValue, the held item's attribute modifiers, dropEquipment
// with its looting and damage rolls, getExperiencePoints, and the item pickup of canPickUpLoot mobs.
//
// A mob's gear is `equipment`: five native stacks { id, count, damage, enchantments? } (slot 0 the held
// item, 1 boots to 4 helmet, as EntityLiving.getEquipmentInSlot) in the ORIGINAL 1.7.10 item ids that
// enchantments.js uses, `dropChances` the five floats of equipmentDropChances and `canPickUpLoot`.
// mob-equipment-live.js converts to the browser's item ids at the edges (drops, pickup, rendering).
import { addRandomEnchantment, getEnchantmentLevel, getEnchantmentModifierLiving, getKnockbackModifier, getFireAspectModifier, ENCHANTMENT, itemInfo } from "./enchantments.js";

const f = Math.fround;
export const HELD = 0, BOOTS = 1, LEGGINGS = 2, CHESTPLATE = 3, HELMET = 4;
export const DEFAULT_DROP_CHANCE = f(0.085);
export const PUMPKIN = 86, LIT_PUMPKIN = 91, SKULL = 397;
// Native ids.
export const IRON_SWORD = 267, IRON_SHOVEL = 256, GOLDEN_SWORD = 283, STONE_SWORD = 272, BOW = 261;

// ItemArmor.damageReduceAmount per piece (helmet, chestplate, leggings, boots) for the tiers of
// the material order of the native ids (leather, chain, iron, diamond, gold; ids 298 + 4 * material + piece).
// EntityLiving.func_82161_a (sw.a(slot, tier)) numbers the tiers leather, gold, chain, iron, diamond.
export const TIER_MATERIAL = [0, 4, 1, 2, 3];
export const ARMOR_POINTS = [[1, 3, 2, 1], [2, 5, 4, 1], [2, 6, 5, 2], [3, 8, 6, 3], [2, 5, 3, 1]];
export const armorPieceId = (slot, tier) => 298 + 4 * TIER_MATERIAL[tier] + (HELMET - slot);
export const isArmor = (id) => id >= 298 && id <= 317;
// [piece (0 helmet .. 3 boots), tier] of an armour id.
const armorOf = (id) => ({ tier: Math.floor((id - 298) / 4), piece: (id - 298) % 4 });
export const armorPoints = (id) => (isArmor(id) ? ARMOR_POINTS[armorOf(id).tier][armorOf(id).piece] : 0);
// The slot ItemArmor.armorType maps to in EntityLiving.getArmorPosition: helmet 4 ... boots 1.
export const armorSlotOf = (id) => HELMET - armorOf(id).piece;

// Item.getItemAttributeModifiers "Weapon modifier": ItemSword 4 + the tier's damage, ItemTool its
// damageVsEntity (shovel 1, pickaxe 2, axe 3 + tier damage). Tiers: wood 0, stone 1, iron 2, diamond 3, gold 0.
const TIER_DAMAGE = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 0 };
const TIER_BY_ID = (ids) => Object.fromEntries(ids.map((id, tier) => [id, TIER_DAMAGE[tier]]));
const SWORDS = TIER_BY_ID([268, 272, 267, 276, 283]);
const SHOVELS = TIER_BY_ID([269, 273, 256, 277, 284]);
const PICKAXES = TIER_BY_ID([270, 274, 257, 278, 285]);
const AXES = TIER_BY_ID([271, 275, 258, 279, 286]);
export const isSword = (id) => id in SWORDS;
export function weaponModifier(id) {
  if (id in SWORDS) return 4 + SWORDS[id];
  if (id in SHOVELS) return 1 + SHOVELS[id];
  if (id in PICKAXES) return 2 + PICKAXES[id];
  if (id in AXES) return 3 + AXES[id];
  return 0;
}
export const maxDamage = (id) => itemInfo(id).maxDamage || 0;

export const emptyGear = () => ({ equipment: [null, null, null, null, null], dropChances: Array(5).fill(DEFAULT_DROP_CHANCE), canPickUpLoot: false });
const stack = (id, damage = 0) => ({ id, count: 1, damage });
export const cloneStack = (s) => (s ? { ...s, ...(s.enchantments ? { enchantments: s.enchantments.map((e) => ({ id: e.id, lvl: e.lvl })) } : {}) } : null);

// EntityLiving.addRandomArmor (sw.bC), the armour part only: with Entity.rand.nextFloat() < 0.15 x local
// a tier (nextInt(2), plus one per three rolls of 0.095) from the helmet down, each further piece
// continuing unless nextFloat() < the stop chance (0.1 on Hard, else 0.25). `slots` is the five stacks.
export function addRandomArmor(rand, hard, local, slots) {
  if (!(rand.nextFloat() < f(f(0.15) * local))) return;
  let tier = rand.nextInt(2);
  const stop = hard ? f(0.1) : f(0.25);
  for (let k = 0; k < 3; k++) if (rand.nextFloat() < f(0.095)) tier++;
  for (let i = 3; i >= 0; i--) {
    if (i < 3 && rand.nextFloat() < stop) break;
    if (!slots[i + 1]) slots[i + 1] = stack(armorPieceId(i + 1, tier));
  }
}
// EntityLiving.enchantEquipment (sw.bD): the held item at 0.25 x local, each armour piece (boots up) at
// 0.5 x local, EnchantmentHelper.addRandomEnchantment at (int)(5.0F + local * nextInt(18)).
export function enchantEquipment(rand, local, slots) {
  const level = () => Math.trunc(f(5 + f(local * rand.nextInt(18))));
  if (slots[HELD] && rand.nextFloat() < f(f(0.25) * local)) addRandomEnchantment(rand, slots[HELD], level());
  for (let i = BOOTS; i <= HELMET; i++) if (slots[i] && rand.nextFloat() < f(f(0.5) * local)) addRandomEnchantment(rand, slots[i], level());
}
// The Halloween step of EntityZombie and EntitySkeleton.onSpawnWithEgg: no helmet, 31 October, a quarter of mobs
// wear a pumpkin (a tenth of those a jack-o'-lantern) that never drops (its chance is set to 0).
export function halloweenHead(rand, slots, chances, date) {
  if (slots[HELMET] || date.month !== 10 || date.day !== 31 || !(rand.nextFloat() < f(0.25))) return false;
  slots[HELMET] = stack(rand.nextFloat() < f(0.1) ? LIT_PUMPKIN : PUMPKIN);
  chances[HELMET] = 0;
  return true;
}

// EntityLivingBase.getTotalArmorValue (sv.aV): ItemArmor.damageReduceAmount over all five equipment slots
// (a helmet carried in the hand counts), capped by the caller (EntityZombie adds 2, at most 20).
export const totalArmor = (equipment) => equipment.reduce((n, s) => n + (s ? armorPoints(s.id) : 0), 0);
// The sum of the equipment's attack modifiers added to the generic.attackDamage attribute.
export const attackBonus = (equipment) => equipment.reduce((n, s) => n + (s ? weaponModifier(s.id) : 0), 0);

// EntityLiving.dropEquipment (sw.a(ZI)): for each slot, `recentlyHit` or a chance above 1 (an item the mob
// picked up, 2.0) lets nextFloat() - looting x 0.01F < the chance drop it; below 1 a damageable item
// drops with damage maxDamage - nextInt(nextInt(max(maxDamage - 25, 1)) + 1) kept within [1, maxDamage - 25].
export function dropEquipment(gear, rand, { playerHit = false, looting = 0 } = {}) {
  const out = [];
  gear.equipment.forEach((s, i) => {
    if (!s) return;
    const chance = gear.dropChances[i], whole = chance > 1;
    if (!(playerHit || whole)) return;
    if (!(f(rand.nextFloat() - f(looting * f(0.01))) < chance)) return;
    const drop = cloneStack(s);
    const max = maxDamage(s.id);
    if (!whole && max > 0) {
      const k = Math.max(max - 25, 1);
      drop.damage = Math.max(1, Math.min(k, max - rand.nextInt(rand.nextInt(k) + 1)));
    }
    out.push(drop);
  });
  return out;
}
// EntityLiving.getExperiencePoints: each equipment item whose chance is at most 1 adds 1 + nextInt(3).
export function equipmentExperience(gear, rand) {
  let xp = 0;
  gear.equipment.forEach((s, i) => { if (s && gear.dropChances[i] <= 1) xp += 1 + rand.nextInt(3); });
  return xp;
}

// EntityLiving.getArmorPosition (sw.c): a pumpkin block or skull the helmet slot, armour its own slot, else the hand.
export function armorPosition(s) {
  if (s.id === PUMPKIN || s.id === SKULL) return HELMET;
  return isArmor(s.id) ? armorSlotOf(s.id) : HELD;
}
const hasTag = (s) => !!s.enchantments?.length;
// Whether the mob swaps its stack in `slot` for the candidate (the flag of EntityLiving.onLivingUpdate's loop).
export function prefersPickup(slot, current, candidate) {
  if (!current) return true;
  const newer = (a, b) => (a.damage ?? 0) > (b.damage ?? 0) || (hasTag(a) && !hasTag(b));
  if (slot === HELD) {
    if (isSword(candidate.id) && !isSword(current.id)) return true;
    if (isSword(candidate.id) && isSword(current.id)) {
      const a = weaponModifier(candidate.id), b = weaponModifier(current.id);
      return a === b ? newer(candidate, current) : a > b;
    }
    return false;
  }
  if (isArmor(candidate.id) && !isArmor(current.id)) return true;
  if (isArmor(candidate.id) && isArmor(current.id)) {
    const a = armorPoints(candidate.id), b = armorPoints(current.id);
    return a === b ? newer(candidate, current) : a > b;
  }
  return false;
}
// One candidate item entity: the mob takes it into its slot (the whole stack), drops the old item when
// nextFloat() - 0.1F < its chance, keeps its chance at 2.0 and becomes persistent. Returns
// { slot, dropped } or null when it does not want it.
export function pickUpItem(gear, candidate, rand) {
  const slot = armorPosition(candidate), current = gear.equipment[slot];
  if (!prefersPickup(slot, current, candidate)) return null;
  let dropped = null;
  if (current && f(rand.nextFloat() - f(0.1)) < gear.dropChances[slot]) dropped = current;
  gear.equipment[slot] = cloneStack(candidate);
  gear.dropChances[slot] = 2;
  return { slot, dropped };
}

// The held bow's effect on a skeleton's arrow (EntitySkeleton.attackEntityWithRangedAttack): Power adds
// level x 0.5 + 0.5 damage, Punch sets the knockback, Flame (or the wither type) sets fire for 100 s (2000 ticks).
export function bowEffects(bow, wither = false) {
  const level = (e) => (bow ? getEnchantmentLevel(e.id, bow) : 0);
  const power = level(ENCHANTMENT.power), punch = level(ENCHANTMENT.punch), flame = level(ENCHANTMENT.flame);
  return { damage: power > 0 ? power * 0.5 + 0.5 : 0, knockback: punch, fire: flame > 0 || wither ? 2000 : 0 };
}

// NBT: Equipment (five compounds, an empty one for a missing stack), DropChances and CanPickUpLoot.
export function saveGear(gear) {
  return {
    equipment: gear.equipment.map((s) => (s ? { id: s.id, count: s.count ?? 1, damage: s.damage ?? 0, ...(hasTag(s) ? { enchantments: s.enchantments.map((e) => ({ id: e.id, lvl: e.lvl })) } : {}) } : null)),
    dropChances: gear.dropChances.map(f),
    canPickUpLoot: !!gear.canPickUpLoot,
  };
}
export function readGear(saved) {
  const gear = emptyGear();
  if (!saved || typeof saved !== "object") return gear;
  if (Array.isArray(saved.equipment)) saved.equipment.slice(0, 5).forEach((s, i) => {
    if (!s || !Number.isInteger(s.id) || s.id <= 0 || s.id > 4095) return;
    const max = maxDamage(s.id);
    gear.equipment[i] = { id: s.id, count: Math.max(1, Math.min(64, s.count | 0 || 1)), damage: Math.max(0, Math.min(max || 32767, Number.isFinite(s.damage) ? s.damage | 0 : 0)),
      ...(Array.isArray(s.enchantments) && s.enchantments.length ? { enchantments: s.enchantments.filter((e) => Number.isInteger(e?.id) && Number.isInteger(e?.lvl)).map((e) => ({ id: e.id, lvl: e.lvl })) } : {}) };
  });
  if (Array.isArray(saved.dropChances)) saved.dropChances.slice(0, 5).forEach((c, i) => { if (Number.isFinite(c)) gear.dropChances[i] = f(c); });
  gear.canPickUpLoot = !!saved.canPickUpLoot;
  return gear;
}

// EntityMob.attackEntityAsMob (yg.n) on a living target: the attribute plus the held item's damage enchantment
// against the target's creature attribute ("UNDEFINED", "UNDEAD", "ARTHROPOD"), its Knockback level and, once the
// hit lands, Fire Aspect level x 4 seconds of fire.
export function meleeEffects(held, creature = "UNDEFINED") {
  return { damage: getEnchantmentModifierLiving(held, creature), knockback: getKnockbackModifier(held), fire: getFireAspectModifier(held) * 4 };
}
