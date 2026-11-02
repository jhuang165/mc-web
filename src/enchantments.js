// Minecraft Java 1.7.10 enchantments: the Enchantment registry and subclasses, EnumEnchantmentType,
// EnchantmentHelper, ItemEnchantedBook's stored-enchantment merge, ItemStack.attemptDamageItem's
// unbreaking skips and ContainerEnchantment (bookshelf power, slot levels, enchantItem).
// Standalone: not yet wired into combat, mining or the GUI. Replayed against
// public/research/enchantment-reference.json (tools/verify-enchantments.mjs).
//
// Stacks are plain objects with original numeric item IDs:
//   {id, count = 1, damage = 0, enchantments: [{id, lvl}], storedEnchantments: [{id, lvl}], unbreakable}
// `enchantments` is the "ench" NBT list, `storedEnchantments` the enchanted book's
// "StoredEnchantments" list; an absent or empty array means no list. Functions that the original
// mutates (addEnchantment, enchantItem, attemptDamageItem...) mutate the stack in place.
// Randoms are JavaRandom instances (src/java-random.js).
//
// 1.7.10 has no lapis cost and no per-player enchantment seed (both arrived in 1.8): the table uses
// its own container Random, rerolled every time the slot changes, and charges whole XP levels only.

const f = Math.fround;
const F015 = f(0.15);

export const BOOK = 340, ENCHANTED_BOOK = 403, SHEARS = 359, BOOKSHELF = 47;

// EnumEnchantmentType, in declaration order.
export const ENCHANTMENT_TYPES = ["all", "armor", "armor_feet", "armor_legs", "armor_torso", "armor_head", "weapon", "digger", "fishing_rod", "breakable", "bow"];

// Item data read from the unchanged Item classes (EnchantmentProbe "item" records):
// id: [kind, ItemArmor.armorType (-1 otherwise), getItemEnchantability, getMaxDamage].
// kind: armor | sword | tool (ItemTool) | axe (ItemAxe, an ItemTool) | bow | fishing_rod | book |
// enchanted_book | shears | other. Every other registered item is "other" with 0/0. Every damageable
// item here has stack limit 1 and no subtypes, so isDamageable is maxDamage > 0.
export const ITEM_ENCHANTING = {
  256: ["tool", -1, 14, 250], // iron_shovel
  257: ["tool", -1, 14, 250], // iron_pickaxe
  258: ["axe", -1, 14, 250], // iron_axe
  259: ["other", -1, 0, 64], // flint_and_steel
  261: ["bow", -1, 1, 384], // bow
  267: ["sword", -1, 14, 250], // iron_sword
  268: ["sword", -1, 15, 59], // wooden_sword
  269: ["tool", -1, 15, 59], // wooden_shovel
  270: ["tool", -1, 15, 59], // wooden_pickaxe
  271: ["axe", -1, 15, 59], // wooden_axe
  272: ["sword", -1, 5, 131], // stone_sword
  273: ["tool", -1, 5, 131], // stone_shovel
  274: ["tool", -1, 5, 131], // stone_pickaxe
  275: ["axe", -1, 5, 131], // stone_axe
  276: ["sword", -1, 10, 1561], // diamond_sword
  277: ["tool", -1, 10, 1561], // diamond_shovel
  278: ["tool", -1, 10, 1561], // diamond_pickaxe
  279: ["axe", -1, 10, 1561], // diamond_axe
  283: ["sword", -1, 22, 32], // golden_sword
  284: ["tool", -1, 22, 32], // golden_shovel
  285: ["tool", -1, 22, 32], // golden_pickaxe
  286: ["axe", -1, 22, 32], // golden_axe
  290: ["other", -1, 0, 59], // wooden_hoe
  291: ["other", -1, 0, 131], // stone_hoe
  292: ["other", -1, 0, 250], // iron_hoe
  293: ["other", -1, 0, 1561], // diamond_hoe
  294: ["other", -1, 0, 32], // golden_hoe
  298: ["armor", 0, 15, 55], // leather_helmet
  299: ["armor", 1, 15, 80], // leather_chestplate
  300: ["armor", 2, 15, 75], // leather_leggings
  301: ["armor", 3, 15, 65], // leather_boots
  302: ["armor", 0, 12, 165], // chainmail_helmet
  303: ["armor", 1, 12, 240], // chainmail_chestplate
  304: ["armor", 2, 12, 225], // chainmail_leggings
  305: ["armor", 3, 12, 195], // chainmail_boots
  306: ["armor", 0, 9, 165], // iron_helmet
  307: ["armor", 1, 9, 240], // iron_chestplate
  308: ["armor", 2, 9, 225], // iron_leggings
  309: ["armor", 3, 9, 195], // iron_boots
  310: ["armor", 0, 10, 363], // diamond_helmet
  311: ["armor", 1, 10, 528], // diamond_chestplate
  312: ["armor", 2, 10, 495], // diamond_leggings
  313: ["armor", 3, 10, 429], // diamond_boots
  314: ["armor", 0, 25, 77], // golden_helmet
  315: ["armor", 1, 25, 112], // golden_chestplate
  316: ["armor", 2, 25, 105], // golden_leggings
  317: ["armor", 3, 25, 91], // golden_boots
  340: ["book", -1, 1, 0], // book
  346: ["fishing_rod", -1, 1, 64], // fishing_rod
  359: ["shears", -1, 0, 238], // shears
  398: ["other", -1, 0, 25], // carrot_on_a_stick
  403: ["enchanted_book", -1, 0, 0], // enchanted_book
};
const PLAIN = ["other", -1, 0, 0];
export function itemInfo(id) {
  const [kind, armorType, enchantability, maxDamage] = ITEM_ENCHANTING[id] || PLAIN;
  return { kind, armorType, enchantability, maxDamage, damageable: maxDamage > 0 };
}
export const itemEnchantability = (id) => itemInfo(id).enchantability;

// ---- Enchantment registry ----------------------------------------------

const PROTECTION = { base: [1, 10, 5, 5, 3], per: [11, 8, 6, 8, 6], threshold: [20, 12, 10, 12, 15] };
const DAMAGE = { base: [1, 5, 5], per: [11, 8, 8], threshold: [20, 20, 20] };
const superMin = (l) => 1 + l * 10;

function def(id, key, className, name, weight, maxLevel, type, min, max, extra = {}) {
  return { id, key, className, name: "enchantment." + name, weight, minLevel: 1, maxLevel, type, minEnchantability: min, maxEnchantability: max, ...extra };
}
const protection = (id, key, sub, name, weight) =>
  def(id, key, "EnchantmentProtection", name, weight, 4, sub === 2 ? "armor_feet" : "armor",
    (l) => PROTECTION.base[sub] + (l - 1) * PROTECTION.per[sub], (l) => PROTECTION.base[sub] + (l - 1) * PROTECTION.per[sub] + PROTECTION.threshold[sub], { protectionType: sub });
const damage = (id, key, sub, name, weight) =>
  def(id, key, "EnchantmentDamage", name, weight, 5, "weapon",
    (l) => DAMAGE.base[sub] + (l - 1) * DAMAGE.per[sub], (l) => DAMAGE.base[sub] + (l - 1) * DAMAGE.per[sub] + DAMAGE.threshold[sub], { damageType: sub });
const plus50 = (l) => superMin(l) + 50;

export const ENCHANTMENT_LIST = [
  protection(0, "protection", 0, "protect.all", 10),
  protection(1, "fireProtection", 1, "protect.fire", 5),
  protection(2, "featherFalling", 2, "protect.fall", 5),
  protection(3, "blastProtection", 3, "protect.explosion", 2),
  protection(4, "projectileProtection", 4, "protect.projectile", 5),
  def(5, "respiration", "EnchantmentOxygen", "oxygen", 2, 3, "armor_head", (l) => 10 * l, (l) => 10 * l + 30),
  def(6, "aquaAffinity", "EnchantmentWaterWorker", "waterWorker", 2, 1, "armor_head", () => 1, () => 41),
  def(7, "thorns", "EnchantmentThorns", "thorns", 1, 3, "armor_torso", (l) => 10 + 20 * (l - 1), plus50),
  damage(16, "sharpness", 0, "damage.all", 10),
  damage(17, "smite", 1, "damage.undead", 5),
  damage(18, "baneOfArthropods", 2, "damage.arthropods", 5),
  def(19, "knockback", "EnchantmentKnockback", "knockback", 5, 2, "weapon", (l) => 5 + 20 * (l - 1), plus50),
  def(20, "fireAspect", "EnchantmentFireAspect", "fire", 2, 2, "weapon", (l) => 10 + 20 * (l - 1), plus50),
  def(21, "looting", "EnchantmentLootBonus", "lootBonus", 2, 3, "weapon", (l) => 15 + (l - 1) * 9, plus50),
  def(32, "efficiency", "EnchantmentDigging", "digging", 10, 5, "digger", (l) => 1 + 10 * (l - 1), plus50),
  def(33, "silkTouch", "EnchantmentUntouching", "untouching", 1, 1, "digger", () => 15, plus50),
  def(34, "unbreaking", "EnchantmentDurability", "durability", 5, 3, "breakable", (l) => 5 + (l - 1) * 8, plus50),
  def(35, "fortune", "EnchantmentLootBonus", "lootBonusDigger", 2, 3, "digger", (l) => 15 + (l - 1) * 9, plus50),
  def(48, "power", "EnchantmentArrowDamage", "arrowDamage", 10, 5, "bow", (l) => 1 + (l - 1) * 10, (l) => 1 + (l - 1) * 10 + 15),
  def(49, "punch", "EnchantmentArrowKnockback", "arrowKnockback", 2, 2, "bow", (l) => 12 + (l - 1) * 20, (l) => 12 + (l - 1) * 20 + 25),
  def(50, "flame", "EnchantmentArrowFire", "arrowFire", 2, 1, "bow", () => 20, () => 50),
  def(51, "infinity", "EnchantmentArrowInfinite", "arrowInfinite", 1, 1, "bow", () => 20, () => 50),
  def(61, "luckOfTheSea", "EnchantmentLootBonus", "lootBonusFishing", 2, 3, "fishing_rod", (l) => 15 + (l - 1) * 9, plus50),
  def(62, "lure", "EnchantmentFishingSpeed", "fishingSpeed", 2, 3, "fishing_rod", (l) => 15 + (l - 1) * 9, plus50),
];
// Enchantment.enchantmentsList: index = effect ID (0..255), null where unused.
export const ENCHANTMENTS_BY_ID = Array.from({ length: 256 }, () => null);
export const ENCHANTMENT = {};
for (const e of ENCHANTMENT_LIST) { ENCHANTMENTS_BY_ID[e.id] = e; ENCHANTMENT[e.key] = e; }
// enchantmentsBookList: the non-null registry in ID order.
export const BOOK_ENCHANTMENT_LIST = ENCHANTMENT_LIST.map((e) => e.id);
const byId = (e) => (typeof e === "number" ? ENCHANTMENTS_BY_ID[e] : e);

// Enchantment.canApplyTogether, called as first.canApplyTogether(second).
export function canApplyTogether(first, second) {
  const a = byId(first), b = byId(second);
  if (a.className === "EnchantmentProtection") {
    if (b.className !== "EnchantmentProtection") return a !== b;
    return a.protectionType === b.protectionType ? false : a.protectionType === 2 || b.protectionType === 2;
  }
  if (a.className === "EnchantmentDamage") return b.className !== "EnchantmentDamage";
  if (a.className === "EnchantmentLootBonus") return a !== b && b.id !== ENCHANTMENT.silkTouch.id;
  if (a.className === "EnchantmentUntouching") return a !== b && b.id !== ENCHANTMENT.fortune.id;
  return a !== b;
}

// EnumEnchantmentType.canEnchantItem(Item).
export function typeCanEnchantItem(type, itemId) {
  const it = itemInfo(itemId);
  if (type === "all") return true;
  if (type === "breakable" && it.damageable) return true;
  if (it.kind === "armor") {
    if (type === "armor") return true;
    return type === ["armor_head", "armor_torso", "armor_legs", "armor_feet"][it.armorType];
  }
  if (it.kind === "sword") return type === "weapon";
  if (it.kind === "tool" || it.kind === "axe") return type === "digger";
  if (it.kind === "bow") return type === "bow";
  if (it.kind === "fishing_rod") return type === "fishing_rod";
  return false;
}

// Enchantment.canApply(ItemStack): the anvil/command check, wider than the table's type check.
export function canApply(enchantment, stack) {
  const e = byId(enchantment), it = itemInfo(stack.id);
  if (e.className === "EnchantmentDamage" && it.kind === "axe") return true;
  if ((e.className === "EnchantmentDigging" || e.className === "EnchantmentUntouching") && stack.id === SHEARS) return true;
  if (e.className === "EnchantmentDurability" && isItemStackDamageable(stack)) return true;
  if (e.className === "EnchantmentThorns" && it.kind === "armor") return true;
  return typeCanEnchantItem(e.type, stack.id);
}

// ---- Damage sources and creature attributes ------------------------------

// DamageSource flags used by the modifiers: [projectile, explosion, fire, canHarmInCreative].
// `fall` marks the DamageSource.fall singleton, compared by identity in the original.
const source = (name, projectile, explosion, fire, creative = false) => ({ name, projectile, explosion, fire, canHarmInCreative: creative, fall: name === "fall" });
export const DAMAGE_SOURCES = {
  inFire: source("inFire", false, false, true), onFire: source("onFire", false, false, true), lava: source("lava", false, false, true),
  inWall: source("inWall", false, false, false), drown: source("drown", false, false, false), starve: source("starve", false, false, false),
  cactus: source("cactus", false, false, false), fall: source("fall", false, false, false), outOfWorld: source("outOfWorld", false, false, false, true),
  generic: source("generic", false, false, false), magic: source("magic", false, false, false), wither: source("wither", false, false, false),
  anvil: source("anvil", false, false, false), fallingBlock: source("fallingBlock", false, false, false),
  explosion: source("explosion", false, true, false), arrow: source("arrow", true, false, false),
  // causeFireballDamage keeps the damage type "onFire" but is fire and projectile.
  fireball: { ...source("onFire", true, false, true), fall: false }, thrown: source("thrown", true, false, false),
  indirectMagic: source("indirectMagic", false, false, false), thorns: source("thorns", false, false, false),
  mob: source("mob", false, false, false), player: source("player", false, false, false),
};
export const CREATURE_ATTRIBUTES = ["UNDEFINED", "UNDEAD", "ARTHROPOD"];

const floorFloat = (v) => { const i = Math.trunc(v); return v < i ? i - 1 : i; };
const f2i = (v) => (Number.isNaN(v) ? 0 : v >= 2147483647 ? 2147483647 : v <= -2147483648 ? -2147483648 : Math.trunc(v));

// Enchantment.calcModifierDamage (EnchantmentProtection only).
export function calcModifierDamage(enchantment, level, src) {
  const e = byId(enchantment);
  if (e.className !== "EnchantmentProtection") return 0;
  if (src.canHarmInCreative) return 0;
  const v = f(f(6 + level * level) / f(3));
  const t = e.protectionType;
  if (t === 0) return floorFloat(f(v * f(0.75)));
  if (t === 1 && src.fire) return floorFloat(f(v * f(1.25)));
  if (t === 2 && src.fall) return floorFloat(f(v * f(2.5)));
  if (t === 3 && src.explosion) return floorFloat(f(v * f(1.5)));
  if (t === 4 && src.projectile) return floorFloat(f(v * f(1.5)));
  return 0;
}
// Enchantment.func_152376_a (EnchantmentDamage only): extra attack damage as a float.
export function calcModifierLiving(enchantment, level, attribute) {
  const e = byId(enchantment);
  if (e.className !== "EnchantmentDamage") return 0;
  if (e.damageType === 0) return f(level * f(1.25));
  if (e.damageType === 1 && attribute === "UNDEAD") return f(level * f(2.5));
  if (e.damageType === 2 && attribute === "ARTHROPOD") return f(level * f(2.5));
  return 0;
}

// ---- Stack helpers --------------------------------------------------------

const list = (a) => (Array.isArray(a) ? a : []);
const toShort = (v) => (v << 16) >> 16;
const toByte = (v) => (v << 24) >> 24;
export const isItemEnchanted = (stack) => list(stack.enchantments).length > 0;
// ItemStack.isItemStackDamageable.
export const isItemStackDamageable = (stack) => itemInfo(stack.id).maxDamage > 0 && !stack.unbreakable;
// Item.isItemTool(stack): ItemBook needs a single book, ItemEnchantedBook never qualifies.
export function isItemTool(stack) {
  if (stack.id === BOOK) return (stack.count ?? 1) === 1;
  if (stack.id === ENCHANTED_BOOK) return false;
  return itemInfo(stack.id).damageable; // every damageable item has stack limit 1
}
// ItemStack.isItemEnchantable: what the table accepts.
export const isItemEnchantable = (stack) => isItemTool(stack) && !isItemEnchanted(stack);

// EnchantmentHelper.getEnchantmentLevel: first matching "ench" entry (never stored book enchantments).
export function getEnchantmentLevel(id, stack) {
  if (!stack) return 0;
  for (const e of list(stack.enchantments)) if (e.id === id) return e.lvl;
  return 0;
}
// EnchantmentHelper.getMaxEnchantmentLevel over e.g. EntityLivingBase.getLastActiveItems().
export function getMaxEnchantmentLevel(id, stacks) {
  let max = 0;
  for (const s of stacks) { const l = getEnchantmentLevel(id, s); if (l > max) max = l; }
  return max;
}
// EnchantmentHelper.getEnchantments: LinkedHashMap id -> level (stored list for enchanted books).
export function getEnchantments(stack) {
  const map = new Map();
  for (const e of list(stack.id === ENCHANTED_BOOK ? stack.storedEnchantments : stack.enchantments)) map.set(e.id, e.lvl);
  return map;
}
// ItemStack.addEnchantment: appends; the level is narrowed through a byte.
export function addEnchantment(stack, enchantment, level) {
  if (!Array.isArray(stack.enchantments)) stack.enchantments = [];
  stack.enchantments.push({ id: toShort(byId(enchantment).id), lvl: toShort(toByte(level)) });
}
// ItemEnchantedBook.addEnchantment: keeps the higher level of a repeated ID, else appends.
export function addStoredEnchantment(stack, enchantment, level) {
  const e = byId(enchantment);
  if (!e) throw new TypeError("Unregistered enchantment"); // the original dereferences null
  const stored = list(stack.storedEnchantments);
  let add = true;
  for (const entry of stored) if (entry.id === e.id) { if (entry.lvl < level) entry.lvl = toShort(level); add = false; break; }
  if (add) stored.push({ id: toShort(e.id), lvl: toShort(level) });
  stack.storedEnchantments = stored;
}
// EnchantmentHelper.setEnchantments(Map, stack); `map` is a Map or [[id, level], ...] in key order.
export function setEnchantments(map, stack) {
  const entries = map instanceof Map ? [...map] : map;
  const out = [];
  for (const [id, lvl] of entries) {
    out.push({ id: toShort(id), lvl: toShort(lvl) });
    if (stack.id === ENCHANTED_BOOK) addStoredEnchantment(stack, id, lvl);
  }
  if (out.length > 0) { if (stack.id !== ENCHANTED_BOOK) stack.enchantments = out; }
  else delete stack.enchantments;
}

// ---- Entity getters --------------------------------------------------------
// `held` is EntityLivingBase.getHeldItem(); `items` is getLastActiveItems() (the four armour slots
// for players, the five equipment slots, held item first, for EntityLiving).

export const getKnockbackModifier = (held) => getEnchantmentLevel(ENCHANTMENT.knockback.id, held);
export const getFireAspectModifier = (held) => getEnchantmentLevel(ENCHANTMENT.fireAspect.id, held);
export const getEfficiencyModifier = (held) => getEnchantmentLevel(ENCHANTMENT.efficiency.id, held);
export const getSilkTouchModifier = (held) => getEnchantmentLevel(ENCHANTMENT.silkTouch.id, held) > 0;
export const getFortuneModifier = (held) => getEnchantmentLevel(ENCHANTMENT.fortune.id, held);
export const getLuckOfTheSeaModifier = (held) => getEnchantmentLevel(ENCHANTMENT.luckOfTheSea.id, held);
export const getLureModifier = (held) => getEnchantmentLevel(ENCHANTMENT.lure.id, held);
export const getLootingModifier = (held) => getEnchantmentLevel(ENCHANTMENT.looting.id, held);
export const getRespiration = (items) => getMaxEnchantmentLevel(ENCHANTMENT.respiration.id, items);
export const getAquaAffinityModifier = (items) => getMaxEnchantmentLevel(ENCHANTMENT.aquaAffinity.id, items) > 0;
// EnchantmentHelper.func_92099_a: index of the first item carrying the enchantment, or -1.
export function firstItemWith(enchantment, items) {
  const id = byId(enchantment).id;
  return items.findIndex((s) => s && getEnchantmentLevel(id, s) > 0);
}

function forEachModifier(stack, fn) {
  if (!stack) return;
  for (const { id, lvl } of list(stack.enchantments)) { const e = ENCHANTMENTS_BY_ID[id]; if (e) fn(e, lvl); }
}
// EnchantmentHelper.getEnchantmentModifierDamage(armour, source): protection points, capped at 25,
// then halved with a random top-up from EnchantmentHelper's own static Random (`random`).
export function getEnchantmentModifierDamage(armor, src, random) {
  let m = 0;
  for (const s of armor) forEachModifier(s, (e, l) => { m += calcModifierDamage(e, l, src); });
  if (m > 25) m = 25;
  return ((m + 1) >> 1) + random.nextInt((m >> 1) + 1);
}
// EnchantmentHelper.func_152377_a(stack, attribute) / getEnchantmentModifierLiving(attacker, target).
export function getEnchantmentModifierLiving(held, attribute) {
  let m = 0;
  forEachModifier(held, (e, l) => { m = f(m + calcModifierLiving(e, l, attribute)); });
  return m;
}
// EnchantmentProtection.getFireTimeForEntity: fire protection shortens burning.
export function fireProtectionTicks(items, ticks) {
  const l = getMaxEnchantmentLevel(ENCHANTMENT.fireProtection.id, items);
  if (l > 0) ticks -= floorFloat(f(f(f(ticks) * f(l)) * F015));
  return ticks;
}
// EnchantmentProtection.func_92092_a: blast protection reduces explosion knockback.
export function blastProtectionKnockback(items, knockback) {
  const l = getMaxEnchantmentLevel(ENCHANTMENT.blastProtection.id, items);
  if (l > 0) knockback -= Math.floor(knockback * f(f(l) * F015));
  return knockback;
}
// EnchantmentThorns.func_92094_a / func_92095_b.
export const thornsShouldHit = (level, random) => level > 0 && random.nextFloat() < f(F015 * level);
export const thornsDamage = (level, random) => (level > 10 ? level - 10 : 1 + random.nextInt(4));
// EnchantmentDamage.func_151368_a: Bane of Arthropods slowness IV length (the attacker's Random).
export const baneSlownessTicks = (level, random) => 20 + random.nextInt(10 * level);

// EnchantmentDurability.negateDamage.
export function negateDamage(stack, level, random) {
  if (itemInfo(stack.id).kind === "armor" && random.nextFloat() < f(0.6)) return false;
  return random.nextInt(level + 1) > 0;
}
// ItemStack.attemptDamageItem: true when the item breaks. Mutates stack.damage.
export function attemptDamageItem(stack, amount, random) {
  if (!isItemStackDamageable(stack)) return false;
  if (amount > 0) {
    const l = getEnchantmentLevel(ENCHANTMENT.unbreaking.id, stack);
    let skipped = 0;
    for (let i = 0; l > 0 && i < amount; i++) if (negateDamage(stack, l, random)) skipped++;
    amount -= skipped;
    if (amount <= 0) return false;
  }
  stack.damage = (stack.damage ?? 0) + amount;
  return stack.damage > itemInfo(stack.id).maxDamage;
}

// ---- Enchanting -------------------------------------------------------------

// EnchantmentHelper.calcItemStackEnchantability: one table slot's level.
export function calcItemStackEnchantability(random, slot, bookshelves, stack) {
  if (itemEnchantability(stack.id) <= 0) return 0;
  if (bookshelves > 15) bookshelves = 15;
  const v = random.nextInt(8) + 1 + (bookshelves >> 1) + random.nextInt(bookshelves + 1);
  return slot === 0 ? Math.max(Math.trunc(v / 3), 1) : slot === 1 ? Math.trunc((v * 2) / 3) + 1 : Math.max(v, bookshelves * 2);
}

// EnchantmentHelper.mapEnchantmentData: candidate {enchantment, level} per ID in the iteration
// order of the original HashMap<Integer, EnchantmentData>, or null. Books accept every enchantment.
// Uses the type check (not canApply), so axes never get Sharpness and shears nothing but Unbreaking.
export function mapEnchantmentData(level, stack) {
  const isBook = stack.id === BOOK, entries = new Map();
  for (const e of ENCHANTMENT_LIST) {
    if (!typeCanEnchantItem(e.type, stack.id) && !isBook) continue;
    for (let l = e.minLevel; l <= e.maxLevel; l++)
      if (level >= e.minEnchantability(l) && level <= e.maxEnchantability(l)) entries.set(e.id, { enchantment: e, level: l });
  }
  if (entries.size === 0) return null;
  return hashMapOrder([...entries.values()]);
}
// java.util.HashMap (Java 8+) iteration order for small Integer keys inserted in ascending order:
// bucket = id & (capacity - 1); capacity doubles from 16 while size exceeds 0.75 * capacity.
// Collisions keep insertion order. Iterator removal never resizes, so filtering keeps this order.
function hashMapOrder(values) {
  let capacity = 16;
  while (values.length > capacity * 0.75) capacity *= 2;
  return values.map((v, i) => [v, i]).sort((a, b) => (a[0].enchantment.id & (capacity - 1)) - (b[0].enchantment.id & (capacity - 1)) || a[1] - b[1]).map((x) => x[0]);
}
// WeightedRandom.getRandomItem(Random, Collection).
function weightedPick(random, entries) {
  const total = entries.reduce((n, d) => n + d.enchantment.weight, 0);
  if (total <= 0) throw new RangeError("WeightedRandom total weight must be positive");
  let r = random.nextInt(total);
  for (const d of entries) { r -= d.enchantment.weight; if (r < 0) return d; }
  return null;
}
// EnchantmentHelper.buildEnchantmentList: [{enchantment, level}] or null.
export function buildEnchantmentList(random, stack, level) {
  let ench = itemEnchantability(stack.id);
  if (ench <= 0) return null;
  ench = Math.trunc(ench / 2);
  ench = 1 + random.nextInt((ench >> 1) + 1) + random.nextInt((ench >> 1) + 1);
  const base = ench + level;
  const variation = f(f(f(random.nextFloat() + random.nextFloat()) - 1) * F015);
  let modified = f2i(f(f(f(base) * f(1 + variation)) + f(0.5)));
  if (modified < 1) modified = 1;
  let result = null;
  let candidates = mapEnchantmentData(modified, stack);
  if (candidates && candidates.length) {
    const first = weightedPick(random, candidates);
    if (first) {
      result = [first];
      for (let n = modified; random.nextInt(50) <= n; n >>= 1) {
        candidates = candidates.filter((c) => result.every((d) => canApplyTogether(d.enchantment, c.enchantment)));
        if (candidates.length) result.push(weightedPick(random, candidates));
      }
    }
  }
  return result;
}
// EnchantmentHelper.addRandomEnchantment: a book always becomes an enchanted book, even when the
// list is null; others gain every listed enchantment. Returns the same (mutated) stack.
export function addRandomEnchantment(random, stack, level) {
  const chosen = buildEnchantmentList(random, stack, level);
  const isBook = stack.id === BOOK;
  if (isBook) stack.id = ENCHANTED_BOOK;
  if (chosen) for (const d of chosen) {
    if (isBook) addStoredEnchantment(stack, d.enchantment, d.level);
    else addEnchantment(stack, d.enchantment, d.level);
  }
  return stack;
}

// Java Random.nextLong: ((long) next(32) << 32) + next(32), as a BigInt.
export function nextLong(random) {
  const hi = BigInt(random.next(32)), lo = BigInt(random.next(32));
  return BigInt.asIntN(64, (hi << 32n) + lo);
}

// ContainerEnchantment's bookshelf scan: for each of the eight neighbours whose two blocks are air,
// count bookshelves two blocks out (and the two side cells of a diagonal), at table height and one
// above. world: {getBlock(x, y, z) -> id, isAirBlock?(x, y, z)}. At most 32; slot levels clamp to 15.
export function bookshelfPower(world, x, y, z) {
  const air = world.isAirBlock ? (a, b, c) => world.isAirBlock(a, b, c) : (a, b, c) => world.getBlock(a, b, c) === 0;
  const shelf = (a, b, c) => (world.getBlock(a, b, c) === BOOKSHELF ? 1 : 0);
  let power = 0;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    if ((dz === 0 && dx === 0) || !air(x + dx, y, z + dz) || !air(x + dx, y + 1, z + dz)) continue;
    power += shelf(x + dx * 2, y, z + dz * 2) + shelf(x + dx * 2, y + 1, z + dz * 2);
    if (dx !== 0 && dz !== 0)
      power += shelf(x + dx * 2, y, z + dz) + shelf(x + dx * 2, y + 1, z + dz) + shelf(x + dx, y, z + dz * 2) + shelf(x + dx, y + 1, z + dz * 2);
  }
  return power;
}

// EntityPlayer.addExperienceLevel for the negative costs used here (the positive branch only plays
// the level-up sound). player: {experienceLevel, experienceTotal, experience}.
export function addExperienceLevel(player, levels) {
  player.experienceLevel += levels;
  if (player.experienceLevel < 0) { player.experienceLevel = 0; player.experience = 0; player.experienceTotal = 0; }
}

// ContainerEnchantment's server-side state. `random` is the container's own Random (new Random()
// per opened table); `remote` mirrors World.isRemote (clients draw nameSeed but keep levels).
export class EnchantingTable {
  constructor({ world, x, y, z, random, remote = false }) {
    Object.assign(this, { world, x, y, z, random, remote });
    this.item = null;
    this.nameSeed = 0n; // Seeds the client's EnchantmentNameParts text only.
    this.enchantLevels = [0, 0, 0];
  }
  // InventoryBasic.setInventorySlotContents with stack limit 1, then onCraftMatrixChanged.
  setItem(stack) {
    this.item = stack;
    if (stack && (stack.count ?? 1) > 1) stack.count = 1;
    this.onCraftMatrixChanged();
  }
  onCraftMatrixChanged() {
    const stack = this.item;
    if (stack && isItemEnchantable(stack)) {
      this.nameSeed = nextLong(this.random);
      if (!this.remote) {
        const power = bookshelfPower(this.world, this.x, this.y, this.z);
        for (let i = 0; i < 3; i++) this.enchantLevels[i] = calcItemStackEnchantability(this.random, i, power, stack);
      }
    } else this.enchantLevels = [0, 0, 0];
  }
  // ContainerEnchantment.enchantItem. player: {experienceLevel, experienceTotal, experience, creative}.
  // Returns whether the click was accepted; a null list keeps the levels and charges nothing.
  enchantItem(player, slot) {
    const stack = this.item, cost = this.enchantLevels[slot];
    if (!(cost > 0 && stack && (player.experienceLevel >= cost || player.creative))) return false;
    if (this.remote) return true;
    const chosen = buildEnchantmentList(this.random, stack, cost);
    const isBook = stack.id === BOOK;
    if (chosen) {
      addExperienceLevel(player, -cost);
      if (isBook) stack.id = ENCHANTED_BOOK;
      // Books drop one random enchantment of a multi-enchantment roll.
      const skip = isBook && chosen.length > 1 ? this.random.nextInt(chosen.length) : -1;
      chosen.forEach((d, i) => {
        if (isBook && i === skip) return;
        if (isBook) addStoredEnchantment(stack, d.enchantment, d.level);
        else addEnchantment(stack, d.enchantment, d.level);
      });
      this.onCraftMatrixChanged();
    }
    return true;
  }
}
