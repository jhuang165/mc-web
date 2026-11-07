// Display names of items and blocks: the exact 1.7.10 en_US.lang strings (ItemStack.getDisplayName), read through
// tools/probes/ItemNameProbe.java into item-names-data.js. A browser item id maps to its original id/damage through
// original-items.js (the same table region import and the anvil use) or block-registry.js; items with no 1.7.10 counterpart
// keep their own name in 1.7.10's Title Case style. Notes: public/research/item-names.md.
import { ITEM_NAMES } from './item-names-data.js';
import { ORIGINAL_ITEMS } from './original-items.js';
import { toOriginal } from './block-registry.js';
import { potionName } from './potions.js';
import { ITEM_WRITTEN_BOOK, bookDisplayName } from './books.js';
import { ITEM_KEYS, EGG_ENTITIES } from './item-keys-data.js';
import { getPotionEffects, POTION_TYPES, isSplashDamage, potionPrefixKey } from './potions.js';
import { lang } from './lang.js';

// Browser potion item (original 373): the stack damage is the whole potion (ItemPotion.getItemStackDisplayName).
const POTION_ITEM = 385;
const SMALL = new Set(['of', 'and', 'with', 'the', 'in', 'on', 'a', 'an']);
/** "Block of redstone" -> "Block of Redstone": capitalize each word like 1.7.10's lang strings (small words stay lower case). */
export function titleCase(text) {
  return String(text).replace(/(^|[\s(-])([a-z])([\w']*)/g, (m, lead, c, rest) => (lead && SMALL.has(c + rest) ? m : lead + c.toUpperCase() + rest));
}

/** Original ItemStack.getDisplayName (damage-indexed names; a damage past the table reads its last entry). */
export function nativeName(id, damage = 0) {
  const names = ITEM_NAMES[id];
  if (!names) return undefined;
  const d = Math.max(0, damage | 0);
  return names[d < names.length ? d : names.length - 1];
}

// browser id -> original { id, damage? }; subtype keys ("263:1") pin the damage.
const BY_LIVE = new Map();
for (const [key, liveId] of Object.entries(ORIGINAL_ITEMS)) {
  const [id, damage] = key.split(':').map(Number);
  const prior = BY_LIVE.get(liveId);
  if (!prior || (damage === undefined && prior.damage !== undefined)) BY_LIVE.set(liveId, damage === undefined ? { id } : { id, damage });
}
/** Original item id (and pinned damage) a browser item id stands for, or null when it has none. */
export function originalOfLive(liveId) {
  const direct = BY_LIVE.get(liveId);
  if (direct) return direct;
  // A block item named like its block (BlockRegistry): the item id equals the block id for ItemBlock items.
  const block = toOriginal(liveId, 0);
  return block && ITEM_NAMES[block[0]] ? { id: block[0] } : null;
}

/** Native display name of a browser item (id, damage), or undefined for internal-only items. */
export function liveNativeName(liveId, damage = 0) {
  if (liveId === POTION_ITEM) return potionName(damage | 0);
  const o = originalOfLive(liveId);
  if (!o) return undefined;
  return nativeName(o.id, o.damage ?? damage);
}

// ---- Localized names (batch 16): the selected language's lang.table (en_US merged underneath, lang.js) read through the unlocalized
// names of ITEM_KEYS (tools/probes/ItemKeyProbe.java, public/research/item-keys-reference.json). English keeps the baked names above.
const tr = (key) => lang.table?.[key]?.trim();
/** ItemPotion.getItemStackDisplayName through the language table, or undefined while English is selected. */
export function localizedPotionName(meta) {
  if (!lang.table) return undefined;
  if (meta === 0) return tr('item.emptyPotion.name');
  const prefix = isSplashDamage(meta) ? lang.table['potion.prefix.grenade'] + ' ' : '';
  const list = getPotionEffects(meta);
  if (list && list.length) return prefix + lang.table[POTION_TYPES[list[0].id].key + '.postfix'];
  return tr(potionPrefixKey(meta)) + ' ' + tr('item.potion.name');
}
/** Localized name of a browser item (id, damage) or undefined (English selected, or no 1.7.10 key). */
export function localizedItemName(liveId, damage = 0, hasVariants = false) {
  if (!lang.table) return undefined;
  if (liveId === POTION_ITEM) return localizedPotionName(damage | 0);
  const o = originalOfLive(liveId);
  const keys = o && ITEM_KEYS[o.id];
  if (!keys) return undefined;
  const d = Math.max(0, o.damage ?? (hasVariants ? damage | 0 : 0));
  if (o.id === 383) {
    const entity = EGG_ENTITIES[damage & 255]; // ItemMonsterPlacer: translate(item.monsterPlacer.name) + " " + translate("entity." + name + ".name")
    const base = tr('item.monsterPlacer.name');
    if (!entity) return base;
    const key = `entity.${entity}.name`;
    return base + ' ' + (lang.table[key] ?? key).trim();
  }
  const key = keys[d < keys.length ? d : keys.length - 1];
  return tr(key + '.name');
}

/**
 * Name of a browser stack ({ id, damage, displayName? }) against the ITEMS table: an anvil/NBT display name unchanged,
 * a potion by ItemPotion's prefix rules, a damage subtype from en_US, otherwise the item's own (Title Case) name.
 */
export function stackName(stack, ITEMS) {
  if (!stack) return '';
  if (typeof stack.displayName === 'string') return stack.displayName;
  const item = ITEMS[stack.id];
  if (stack.id === POTION_ITEM) return localizedPotionName(stack.damage | 0) ?? potionName(stack.damage | 0);
  if (stack.id === ITEM_WRITTEN_BOOK) return bookDisplayName(stack); // ItemEditableBook.getItemStackDisplayName: the title
  return localizedItemName(stack.id, stack.damage, !!item?.variants) ?? item?.variants?.[stack.damage | 0] ?? item?.name ?? '';
}
/** The one display-name function (custom name first, then the selected language, then the baked English name). */
export const displayName = stackName;

/**
 * Rewrite every ITEMS entry's name and variants to the 1.7.10 strings (internal-only items get Title Case). Run once after all
 * item installers; returns the list of ids that fell back to Title Case.
 */
export function applyNativeNames(ITEMS) {
  const internal = [];
  for (const item of Object.values(ITEMS)) {
    const o = originalOfLive(item.id);
    if (item.id === POTION_ITEM) { item.name = potionName(0); continue; }
    if (!o || !ITEM_NAMES[o.id]) { item.name = titleCase(item.name); if (item.variants) item.variants = item.variants.map(titleCase); if (item.id) internal.push(item.id); continue; }
    const pinned = o.damage;
    if (item.variants && pinned === undefined) item.variants = item.variants.map((_, d) => nativeName(o.id, d));
    item.name = nativeName(o.id, pinned ?? 0);
  }
  return internal;
}
