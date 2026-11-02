// ItemEnchantedBook (original id 403 "enchanted_book"), Minecraft Java 1.7.10, as a port item:
// internal id 365, stack size 1. Its "StoredEnchantments" NBT list is kept on the port stack as
// `stored: [{id, lvl}]` (effect id and level, in list order); inventory.js copies, saves and
// compares it, so books with different lists never stack. Names come from the en_US lang file
// (public/research/fence-rail-reference.json "names"); effect ids and lang keys from
// src/enchantments.js. The book's enchanting use (anvils) is not ported.
import { ENCHANTMENTS_BY_ID, ENCHANTMENT_LIST, ENCHANTED_BOOK as ORIGINAL_ENCHANTED_BOOK } from "./enchantments.js";

export const ENCHANTED_BOOK_ITEM = 365;
export { ORIGINAL_ENCHANTED_BOOK };

// en_US.lang: enchantment.<name> and enchantment.level.1-10.
export const ENCHANTMENT_LANG = {
  "enchantment.damage.all": "Sharpness", "enchantment.damage.undead": "Smite", "enchantment.damage.arthropods": "Bane of Arthropods",
  "enchantment.knockback": "Knockback", "enchantment.fire": "Fire Aspect", "enchantment.protect.all": "Protection",
  "enchantment.protect.fire": "Fire Protection", "enchantment.protect.fall": "Feather Falling", "enchantment.protect.explosion": "Blast Protection",
  "enchantment.protect.projectile": "Projectile Protection", "enchantment.oxygen": "Respiration", "enchantment.waterWorker": "Aqua Affinity",
  "enchantment.digging": "Efficiency", "enchantment.untouching": "Silk Touch", "enchantment.durability": "Unbreaking",
  "enchantment.lootBonus": "Looting", "enchantment.lootBonusDigger": "Fortune", "enchantment.lootBonusFishing": "Luck of the Sea",
  "enchantment.fishingSpeed": "Lure", "enchantment.arrowDamage": "Power", "enchantment.arrowFire": "Flame",
  "enchantment.arrowKnockback": "Punch", "enchantment.arrowInfinite": "Infinity", "enchantment.thorns": "Thorns",
  ...Object.fromEntries(["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"].map((n, i) => [`enchantment.level.${i + 1}`, n])),
};
// StatCollector.translateToLocal: the key itself when the lang file has no entry.
const translate = (key) => ENCHANTMENT_LANG[key] ?? key;

// Enchantment.getTranslatedName: "<name> <level>", the level always written (Silk Touch I).
export function enchantmentName(id, lvl) {
  const e = ENCHANTMENTS_BY_ID[id];
  return e ? `${translate(e.name)} ${translate(`enchantment.level.${lvl}`)}` : null;
}

const int16 = (n) => (Number.isFinite(n) ? ((Math.trunc(n) << 16) >> 16) : 0);
// A clean `stored` list: entries with numeric id and lvl (NBT shorts), or null when empty.
export function normalizeStored(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const e of list) if (e && Number.isFinite(e.id) && Number.isFinite(e.lvl)) out.push({ id: int16(e.id), lvl: int16(e.lvl) });
  return out.length ? out : null;
}
export const copyStored = (list) => (Array.isArray(list) ? list.map((e) => ({ id: e.id, lvl: e.lvl })) : list);
// ItemStack.areItemStackTagsEqual for the StoredEnchantments tag: the same entries in the same order.
export function sameStored(a, b) {
  const x = Array.isArray(a) && a.length ? a : null, y = Array.isArray(b) && b.length ? b : null;
  if (!x || !y) return !x && !y;
  return x.length === y.length && x.every((e, i) => e.id === y[i].id && e.lvl === y[i].lvl);
}

// ItemEnchantedBook.addInformation: one line per known stored enchantment, after the name.
export const storedEnchantmentLines = (list) => (Array.isArray(list) ? list.map((e) => enchantmentName(e.id, e.lvl)).filter(Boolean) : []);

// Conversions: dungeon/mineshaft loot entries carry [403, count, damage, [[id, lvl], ...]];
// src/enchantments.js stacks use original ids with `storedEnchantments`.
export const storedFromPairs = (pairs) => normalizeStored((pairs || []).map(([id, lvl]) => ({ id, lvl })));
export const bookStack = (stored, count = 1) => ({ id: ENCHANTED_BOOK_ITEM, count, damage: 0, stored: normalizeStored(stored) ?? [] });
export const toEnchantmentStack = (stack) => ({ id: ORIGINAL_ENCHANTED_BOOK, count: stack.count ?? 1, damage: stack.damage ?? 0, storedEnchantments: copyStored(stack.stored) ?? [] });
export const fromEnchantmentStack = (stack) => bookStack(stack.storedEnchantments, stack.count ?? 1);

// The Creative tabs' books (Item.getSubItems / ItemEnchantedBook.func_92113_a): each enchantment of
// the tab's types at its maximum level; the search tab lists every level of every enchantment.
export const maxLevelBooks = (types) => ENCHANTMENT_LIST.filter((e) => types.includes(e.type)).map((e) => [{ id: e.id, lvl: e.maxLevel }]);
export const allLevelBooks = () => ENCHANTMENT_LIST.flatMap((e) => Array.from({ length: e.maxLevel - e.minLevel + 1 }, (_, i) => [{ id: e.id, lvl: e.minLevel + i }]));
