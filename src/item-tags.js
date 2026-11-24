// Batch 57 itemtags: the ItemStack tags display.Lore, SkullOwner, CustomPotionEffects and map_is_scaling on a browser stack.
//   stack.lore                 string[]   display.Lore (a list of strings; shown by ItemStack.getTooltip as dark purple italic lines)
//   stack.skullOwner           string     SkullOwner (ItemSkull.getItemStackDisplayName: "<name>'s Head" at damage 3)
//   stack.customPotionEffects  {id, amplifier, duration, ambient}[]  CustomPotionEffects (ItemPotion.getEffects(ItemStack) overrides the damage value)
//   stack.mapScaling           boolean    map_is_scaling (maps.js mapOnCreated)
// Batch 58 itemtags2: tags the port cannot show are kept as raw NBT so they survive every move, save and export unchanged:
//   stack.loreRaw   display.Lore when it is not a list of strings (getTagList("Lore", 8) reads it as empty, so no line is shown)
//   stack.skullRaw  the whole SkullOwner tag when it is a compound (Name, Id, Properties.textures[{Value, Signature}], extra keys) or another non-string type;
//                   skullOwner then holds the profile's name for the "<name>'s Head" title. No skin is fetched (no network): the default Steve skin is drawn.
// A raw tag is JSON: { t: type, v: payload }; a list payload is { e: elementType, v: [payload..] }, a compound payload [[key, raw]..], a long a decimal string.
// Executed against the unchanged 1.7.10 classes in tools/probes/ItemTagsProbe.java (public/research/item-tags-reference.json).
import { NBT } from './nbt.js';
import { nbtGet } from './nbt-get.js';
import { POTION_TYPES, getPotionEffects, makeEffect, isSplashDamage } from './potions.js';
import { profileOfOwnerTag } from './skull-profile.js';

const tag = (type, value) => ({ type, value });
const signedByte = (n) => (n << 24) >> 24;


// ---- raw NBT as JSON ----
const payloadJson = (type, v) => {
  switch (type) {
    case NBT.LONG: return BigInt.asIntN(64, BigInt(v)).toString();
    case NBT.BYTE_ARRAY: case NBT.INT_ARRAY: return [...v];
    case NBT.LIST: return { e: v.elementType, v: v.items.map((x) => payloadJson(v.elementType, x)) };
    case NBT.COMPOUND: return [...v].map(([k, t]) => [k, rawOf(t)]);
    default: return v;
  }
};
/** An NBT tag { type, value } as the JSON-safe { t, v } kept on a stack. */
export const rawOf = (t) => ({ t: t.type, v: payloadJson(t.type, t.value) });
const payloadFrom = (type, j) => {
  switch (type) {
    case NBT.BYTE: case NBT.SHORT: case NBT.INT: case NBT.FLOAT: case NBT.DOUBLE: if (typeof j !== 'number') throw new TypeError('raw number'); return j;
    case NBT.LONG: return BigInt(j);
    case NBT.STRING: if (typeof j !== 'string') throw new TypeError('raw string'); return j;
    case NBT.BYTE_ARRAY: if (!Array.isArray(j) || !j.every(Number.isInteger)) throw new TypeError('raw array'); return Int8Array.from(j);
    case NBT.INT_ARRAY: if (!Array.isArray(j) || !j.every(Number.isInteger)) throw new TypeError('raw array'); return Int32Array.from(j);
    case NBT.LIST: {
      const e = j?.e;
      if (!Number.isInteger(e) || e < 0 || e > 11 || !Array.isArray(j.v) || (e === 0 && j.v.length)) throw new TypeError('raw list');
      return { elementType: e, items: j.v.map((x) => payloadFrom(e, x)) };
    }
    case NBT.COMPOUND: if (!Array.isArray(j)) throw new TypeError('raw compound'); return new Map(j.map(([k, r]) => { if (typeof k !== 'string') throw new TypeError('raw key'); return [k, tagOf(r)]; }));
    default: throw new TypeError('raw type');
  }
};
/** The NBT tag { type, value } of a raw JSON tag; throws for a malformed one. */
export const tagOf = (r) => { if (!r || !Number.isInteger(r.t) || r.t < 1 || r.t > 11) throw new TypeError('raw tag'); return tag(r.t, payloadFrom(r.t, r.v)); };
const validRaw = (r) => { try { tagOf(r); return true; } catch { return false; } };
// b97 tiles97: ItemStack.readFromNBT keeps the whole `tag` compound. Keys the port does not model stay as raw NBT: stack.extraRaw {key: raw} for
// unknown keys of `tag`, stack.displayExtraRaw {key: raw} for unknown keys of display (Name, color and Lore are modelled).
const RAW_MAPS = ['extraRaw', 'displayExtraRaw', 'rawForms'];
const validRawMap = (m) => !!m && typeof m === 'object' && !Array.isArray(m) && Object.values(m).every(validRaw);
const rawMapEntries = (m) => (m && typeof m === 'object' ? Object.entries(m) : []);
const sameRaw = (a, b) => (a === undefined || b === undefined ? a === b : JSON.stringify(a) === JSON.stringify(b));
const stringList = (t) => t?.type === NBT.LIST && (t.value.elementType === NBT.STRING ? t.value.items.length > 0 : t.value.elementType === NBT.END && !t.value.items.length);

// b100 tiles100: a modelled tag whose NBT was not in the port's own canonical form (Unbreakable / map_is_scaling of another width or value, an `ench` entry with an int id or
// extra keys, an Explosion / Fireworks compound with extra keys or other widths) keeps the tag it was read from: stack.rawForms {Unbreakable, map_is_scaling, Explosion,
// Fireworks} and `raw` on an enchantment entry. The raw tag is written back only while the modelled value still equals what it reads as, so an edited stack writes the canonical form.
const sortedJson = (r) => JSON.stringify(r, (k, v) => (v && Array.isArray(v) && v.length && v.every((p) => Array.isArray(p) && typeof p[0] === 'string' && p[1] && p[1].t) ? [...v].sort((a, b) => (a[0] < b[0] ? -1 : 1)) : v));
export const sameNbt = (a, b) => sortedJson(rawOf(a)) === sortedJson(rawOf(b));
/** Keeps `t` (the tag as read) on the stack under `key` unless it equals the canonical tag the port would write. */
export function setRawForm(stack, key, t, canonical) {
  if (t && !(canonical && sameNbt(t, canonical))) (stack.rawForms ??= {})[key] = rawOf(t);
  else if (stack.rawForms) { delete stack.rawForms[key]; if (!Object.keys(stack.rawForms).length) delete stack.rawForms; }
}
/** The kept raw tag of `key`, as a tag, when `fits(tag)` (it still reads as the modelled value); else undefined. */
export function rawFormTag(stack, key, fits) {
  const r = stack.rawForms?.[key];
  if (!r) return undefined;
  try { const t = tagOf(r); return fits(t) ? t : undefined; } catch { return undefined; }
}
const numberOf = (t) => (t && t.type >= NBT.BYTE && t.type <= NBT.DOUBLE ? t.value : undefined);
const isFlag = (t, on) => { const v = numberOf(t); return v !== undefined && (Number(v) !== 0) === on; };
/** The tag of a boolean field (Unbreakable, map_is_scaling): the width it was read at, else a byte. */
export const flagTag = (stack, key, on) => rawFormTag(stack, key, (t) => isFlag(t, on)) ?? tag(NBT.BYTE, on ? 1 : 0);
export const shortOf = (t) => { const v = numberOf(t); if (v === undefined) return 0; if (typeof v === 'bigint') return Number(BigInt.asIntN(16, v)); return (Math.floor(v) << 16) >> 16; };
/** The `ench` / StoredEnchantments entry as a raw tag when it is not the canonical {id short, lvl short} compound. */
export function enchantEntryRaw(c) {
  if (c instanceof Map && c.size === 2 && c.get('id')?.type === NBT.SHORT && c.get('lvl')?.type === NBT.SHORT) return undefined;
  return c instanceof Map ? rawOf(tag(NBT.COMPOUND, c)) : undefined;
}
/** The compound Map written for an enchantment entry {id, lvl, raw?}. */
export function enchantEntryMap(e) {
  if (e.raw) {
    try { const t = tagOf(e.raw); if (t.type === NBT.COMPOUND && shortOf(t.value.get('id')) === e.id && shortOf(t.value.get('lvl')) === e.lvl) return t.value; } catch { /* canonical */ }
  }
  return new Map([['id', tag(NBT.SHORT, e.id)], ['lvl', tag(NBT.SHORT, e.lvl)]]);
}

/** The four fields of `s` normalised for a stack (what Inventory.read keeps). */
export function readItemTags(s) {
  const out = {};
  if (Array.isArray(s.lore) && s.lore.every((l) => typeof l === 'string')) out.lore = [...s.lore];
  if (typeof s.skullOwner === 'string') out.skullOwner = s.skullOwner;
  if (validRaw(s.loreRaw)) out.loreRaw = structuredClone(s.loreRaw);
  if (validRaw(s.skullRaw)) out.skullRaw = structuredClone(s.skullRaw);
  if (Array.isArray(s.customPotionEffects)) {
    out.customPotionEffects = s.customPotionEffects.filter((e) => e && POTION_TYPES[e.id] && Number.isFinite(e.duration) && Number.isFinite(e.amplifier))
      .map((e) => ({ id: e.id | 0, amplifier: signedByte(e.amplifier), duration: e.duration | 0, ambient: e.ambient === true }));
  }
  if (typeof s.mapScaling === 'boolean') out.mapScaling = s.mapScaling;
  for (const f of RAW_MAPS) if (validRawMap(s[f])) out[f] = structuredClone(s[f]);
  return out;
}
/** Deep copy of the four fields onto `stack` (makeStack). */
export function cloneItemTags(stack) {
  if (Array.isArray(stack.lore)) stack.lore = [...stack.lore];
  if (Array.isArray(stack.customPotionEffects)) stack.customPotionEffects = stack.customPotionEffects.map((e) => ({ ...e }));
  if (stack.loreRaw) stack.loreRaw = structuredClone(stack.loreRaw);
  if (stack.skullRaw) stack.skullRaw = structuredClone(stack.skullRaw);
  for (const f of RAW_MAPS) if (stack[f]) stack[f] = structuredClone(stack[f]);
}
const sameList = (a, b, eq) => Array.isArray(a) === Array.isArray(b) && (!Array.isArray(a) || (a.length === b.length && a.every((x, i) => eq(x, b[i]))));
/** ItemStack.areItemStackTagsEqual over the four fields. */
export function sameItemTags(a, b) {
  return a.skullOwner === b.skullOwner && a.mapScaling === b.mapScaling && sameRaw(a.loreRaw, b.loreRaw) && sameRaw(a.skullRaw, b.skullRaw) && RAW_MAPS.every((f) => sameRaw(a[f], b[f])) && sameList(a.lore, b.lore, (x, y) => x === y)
    && sameList(a.customPotionEffects, b.customPotionEffects, (x, y) => x.id === y.id && x.amplifier === y.amplifier && x.duration === y.duration && !!x.ambient === !!y.ambient);
}
/** ItemStack.hasTagCompound over the four fields. */
export const hasItemTags = (s) => !!s && (Array.isArray(s.lore) || !!s.loreRaw || !!s.skullRaw || !!s.extraRaw || rawMapEntries(s.displayExtraRaw).length > 0 || typeof s.skullOwner === 'string' || Array.isArray(s.customPotionEffects) || typeof s.mapScaling === 'boolean');

// ---- NBT ----
const effectTag = (e) => tag(NBT.COMPOUND, new Map([['Id', tag(NBT.BYTE, e.id)], ['Amplifier', tag(NBT.BYTE, e.amplifier)], ['Duration', tag(NBT.INT, e.duration)], ['Ambient', tag(NBT.BYTE, e.ambient ? 1 : 0)]]));
/** Adds display.Lore (into entries.display when there is one), SkullOwner, CustomPotionEffects and map_is_scaling to a `tag` entries object. */
export function writeItemTags(stack, entries) {
  for (const [k, r] of rawMapEntries(stack.extraRaw)) if (!(k in entries)) entries[k] = tagOf(r);
  const displayExtra = rawMapEntries(stack.displayExtraRaw);
  if (displayExtra.length) {
    const display = entries.display ?? (entries.display = tag(NBT.COMPOUND, new Map()));
    for (const [k, r] of displayExtra) if (!display.value.has(k)) display.value.set(k, tagOf(r));
  }
  if (stack.loreRaw || Array.isArray(stack.lore)) {
    const display = entries.display ?? (entries.display = tag(NBT.COMPOUND, new Map()));
    display.value.set('Lore', stack.loreRaw ? tagOf(stack.loreRaw) : tag(NBT.LIST, { elementType: stack.lore.length ? NBT.STRING : NBT.END, items: [...stack.lore] }));
  }
  if (stack.skullRaw) entries.SkullOwner = tagOf(stack.skullRaw);
  else if (typeof stack.skullOwner === 'string') entries.SkullOwner = tag(NBT.STRING, stack.skullOwner);
  if (Array.isArray(stack.customPotionEffects)) {
    entries.CustomPotionEffects = tag(NBT.LIST, { elementType: stack.customPotionEffects.length ? NBT.COMPOUND : NBT.END, items: stack.customPotionEffects.map((e) => effectTag(e).value) });
  }
  if (typeof stack.mapScaling === 'boolean') entries.map_is_scaling = flagTag(stack, 'map_is_scaling', stack.mapScaling);
}
// NBTTagCompound.getTagList(key, type): an empty list for a list of another element type (a non-empty one).
const listOf = (map, key, type) => {
  const t = map instanceof Map ? map.get(key) : undefined;
  if (t?.type !== NBT.LIST) return undefined;
  return t.value.items.length && t.value.elementType !== type ? { items: [] } : t.value;
};
/** PotionEffect.readCustomPotionEffectFromNBT: the effect, or null for an id outside 1..23 (no such Potion). */
export function readCustomEffect(c) {
  const id = nbtGet(c, 'Id', NBT.BYTE, 0);
  if (!(id >= 0 && id < 32) || !POTION_TYPES[id]) return null;
  return { id, amplifier: nbtGet(c, 'Amplifier', NBT.BYTE, 0), duration: nbtGet(c, 'Duration', NBT.INT, 0), ambient: nbtGet(c, 'Ambient', NBT.BYTE, 0) !== 0 };
}
/** Reads the tags from an item `tag` compound Map onto the stack; returns the keys it consumed (`lost` stays empty: nothing of these tags is dropped any more). */
export function readItemTagsNbt(stack, nbt, lost = []) {
  const display = nbt.get('display')?.type === NBT.COMPOUND ? nbt.get('display').value : undefined;
  // ItemStack.getTooltip: hasKey("Lore", 9) then getTagList("Lore", 8)
  // A Lore tag that is not a list of strings shows nothing, but stays as raw NBT (loreRaw).
  const lore = display?.get('Lore');
  if (lore) { if (stringList(lore)) stack.lore = lore.value.items.map(String); else stack.loreRaw = rawOf(lore); }
  const owner = nbt.get('SkullOwner');
  if (owner?.type === NBT.STRING) stack.skullOwner = owner.value;
  else if (owner) {
    // ItemSkull reads a GameProfile (NBTUtil.func_152459_a): the title shows its Name. The whole tag (Id, Properties, extra keys) is kept raw.
    stack.skullRaw = rawOf(owner);
    // A profile whose Name is missing prints "null's Head" (String.format of a null name, executed); no profile at all (no Name and no usable Id) is an NPE natively, the port shows "Head".
    const profile = profileOfOwnerTag(owner);
    if (profile) stack.skullOwner = profile.name ?? 'null';
  }
  // ItemPotion.getEffects: hasKey("CustomPotionEffects", 9); a list of anything but compounds reads as empty.
  const custom = listOf(nbt, 'CustomPotionEffects', NBT.COMPOUND);
  if (custom) stack.customPotionEffects = custom.items.map(readCustomEffect).filter(Boolean);
  const scaling = nbt.get('map_is_scaling');
  if (scaling) { const v = nbtGet(nbt, 'map_is_scaling', NBT.BYTE); if (v !== undefined) { stack.mapScaling = v !== 0; setRawForm(stack, 'map_is_scaling', scaling, tag(NBT.BYTE, v !== 0 ? 1 : 0)); } }
  return ['SkullOwner', 'CustomPotionEffects', 'map_is_scaling'];
}
/** b97 tiles97: the unknown keys of `tag` (not in `recognized`) and of display (not Name, color, Lore) kept raw on the stack. */
export function readExtraRaw(stack, nbt, recognized) {
  const extra = {}, dextra = {}, display = nbt.get('display')?.type === NBT.COMPOUND ? nbt.get('display').value : undefined;
  for (const [k, t] of nbt) if (!recognized.has(k)) extra[k] = rawOf(t);
  if (display) for (const [k, t] of display) if (k !== 'Name' && k !== 'color' && k !== 'Lore') dextra[k] = rawOf(t);
  // An empty `tag` compound is kept too (executed: native writes `tag: {}` back, and it does not stack with a plain item): extraRaw = {}.
  if (Object.keys(extra).length || nbt.size === 0) stack.extraRaw = extra; else delete stack.extraRaw;
  if (Object.keys(dextra).length) stack.displayExtraRaw = dextra; else delete stack.displayExtraRaw;
}

// ---- use ----
/** ItemPotion.getEffects(ItemStack) as PotionHelper rows (null for none): the custom list when present, else the damage value's effects. */
export function stackPotionEffects(stack) {
  if (Array.isArray(stack?.customPotionEffects)) {
    const splash = isSplashDamage(stack.damage | 0);
    return stack.customPotionEffects.map((e) => ({ ...makeEffect(e.id, e.duration, e.amplifier, splash), ambient: !!e.ambient }));
  }
  return getPotionEffects(stack?.damage | 0);
}
/** ItemSkull.getItemStackDisplayName's owner part: "<name>'s Head" for a player head (damage 3) with a SkullOwner string, else null. */
export const skullOwnerName = (stack) => (typeof stack?.skullOwner === 'string' && (stack.damage | 0) === 3 ? `${stack.skullOwner}'s Head` : null);
/** ItemStack.getTooltip's Lore lines: the section-sign formatted text, as { text, color, italic }. */
export const loreLines = (stack) => (Array.isArray(stack?.lore) ? stack.lore.map((text) => ({ text, color: 'dark_purple', italic: true })) : []);
