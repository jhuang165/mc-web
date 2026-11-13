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
const sameRaw = (a, b) => (a === undefined || b === undefined ? a === b : JSON.stringify(a) === JSON.stringify(b));
const stringList = (t) => t?.type === NBT.LIST && (t.value.elementType === NBT.STRING ? t.value.items.length > 0 : t.value.elementType === NBT.END && !t.value.items.length);

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
  return out;
}
/** Deep copy of the four fields onto `stack` (makeStack). */
export function cloneItemTags(stack) {
  if (Array.isArray(stack.lore)) stack.lore = [...stack.lore];
  if (Array.isArray(stack.customPotionEffects)) stack.customPotionEffects = stack.customPotionEffects.map((e) => ({ ...e }));
  if (stack.loreRaw) stack.loreRaw = structuredClone(stack.loreRaw);
  if (stack.skullRaw) stack.skullRaw = structuredClone(stack.skullRaw);
}
const sameList = (a, b, eq) => Array.isArray(a) === Array.isArray(b) && (!Array.isArray(a) || (a.length === b.length && a.every((x, i) => eq(x, b[i]))));
/** ItemStack.areItemStackTagsEqual over the four fields. */
export function sameItemTags(a, b) {
  return a.skullOwner === b.skullOwner && a.mapScaling === b.mapScaling && sameRaw(a.loreRaw, b.loreRaw) && sameRaw(a.skullRaw, b.skullRaw) && sameList(a.lore, b.lore, (x, y) => x === y)
    && sameList(a.customPotionEffects, b.customPotionEffects, (x, y) => x.id === y.id && x.amplifier === y.amplifier && x.duration === y.duration && !!x.ambient === !!y.ambient);
}
/** ItemStack.hasTagCompound over the four fields. */
export const hasItemTags = (s) => !!s && (Array.isArray(s.lore) || !!s.loreRaw || !!s.skullRaw || typeof s.skullOwner === 'string' || Array.isArray(s.customPotionEffects) || typeof s.mapScaling === 'boolean');

// ---- NBT ----
const effectTag = (e) => tag(NBT.COMPOUND, new Map([['Id', tag(NBT.BYTE, e.id)], ['Amplifier', tag(NBT.BYTE, e.amplifier)], ['Duration', tag(NBT.INT, e.duration)], ['Ambient', tag(NBT.BYTE, e.ambient ? 1 : 0)]]));
/** Adds display.Lore (into entries.display when there is one), SkullOwner, CustomPotionEffects and map_is_scaling to a `tag` entries object. */
export function writeItemTags(stack, entries) {
  if (stack.loreRaw || Array.isArray(stack.lore)) {
    const display = entries.display ?? (entries.display = tag(NBT.COMPOUND, new Map()));
    display.value.set('Lore', stack.loreRaw ? tagOf(stack.loreRaw) : tag(NBT.LIST, { elementType: stack.lore.length ? NBT.STRING : NBT.END, items: [...stack.lore] }));
  }
  if (stack.skullRaw) entries.SkullOwner = tagOf(stack.skullRaw);
  else if (typeof stack.skullOwner === 'string') entries.SkullOwner = tag(NBT.STRING, stack.skullOwner);
  if (Array.isArray(stack.customPotionEffects)) {
    entries.CustomPotionEffects = tag(NBT.LIST, { elementType: stack.customPotionEffects.length ? NBT.COMPOUND : NBT.END, items: stack.customPotionEffects.map((e) => effectTag(e).value) });
  }
  if (typeof stack.mapScaling === 'boolean') entries.map_is_scaling = tag(NBT.BYTE, stack.mapScaling ? 1 : 0);
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
  if (scaling) { const v = nbtGet(nbt, 'map_is_scaling', NBT.BYTE); if (v !== undefined) stack.mapScaling = v !== 0; }
  return ['SkullOwner', 'CustomPotionEffects', 'map_is_scaling'];
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
