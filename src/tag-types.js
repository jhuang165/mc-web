// b99 tiles99: ItemStack.readFromNBT keeps the whole `tag` compound, and a KNOWN key with the wrong type simply stays in it unread (executed, tiles99-reference.json:
// `ench` as a string or int, a list whose entries have no numeric id/lvl, StoredEnchantments, display as an int, display.Name / color / Lore of another type, RepairCost,
// Unbreakable, CustomPotionEffects, map_is_scaling, SkullOwner, pages / title / author, Fireworks, Explosion all written back unchanged). The accessors (hasKey(key, type),
// getTagList(key, 10)) read nothing from it. So such a key is raw NBT, not a modelled field: `splitWrongTyped` takes it out before the typed readers run.
import { NBT } from './nbt.js';
const LIST_OF_COMPOUNDS = (t) => t.type === NBT.LIST && (!t.value.items.length || t.value.elementType === NBT.COMPOUND);
// An enchantment list entry the port models as {id, lvl}: a compound whose id and lvl are numeric tags (getShort reads any number; /give {id:16,lvl:3} are ints; a
// non-numeric or missing one reads 0 and is kept raw). Known loss: a numeric tag of another width is written back as a SHORT.
const NUMERIC = (t) => t && t.type >= NBT.BYTE && t.type <= NBT.DOUBLE;
const ENCHANT_LIST = (t) => LIST_OF_COMPOUNDS(t) && t.value.items.every((e) => e instanceof Map && NUMERIC(e.get('id')) && NUMERIC(e.get('lvl')));
const TOP = {
  ench: ENCHANT_LIST, StoredEnchantments: ENCHANT_LIST, RepairCost: (t) => t.type === NBT.INT, display: (t) => t.type === NBT.COMPOUND, Unbreakable: (t) => NUMERIC(t), // getBoolean / getByte read any number
  CustomPotionEffects: (t) => t.type === NBT.LIST, // a list of another element type reads as an empty list (item-tags.js listOf) and stays modelled
  map_is_scaling: (t) => NUMERIC(t), pages: (t) => t.type === NBT.LIST && (!t.value.items.length || t.value.elementType === NBT.STRING),
  author: (t) => t.type === NBT.STRING, title: (t) => t.type === NBT.STRING, Explosion: (t) => t.type === NBT.COMPOUND, Fireworks: (t) => t.type === NBT.COMPOUND && (!t.value.has('Flight') || t.value.get('Flight').type === NBT.BYTE) && (!t.value.has('Explosions') || LIST_OF_COMPOUNDS(t.value.get('Explosions'))),
};
const DISPLAY = { Name: (t) => t.type === NBT.STRING, color: (t) => t.type === NBT.INT };
/** { clean, top, display }: `clean` is a copy of the tag Map without the wrong-typed known keys (and without a wrong-typed display.Name / display.color); `top` and `display` map each removed key to its tag. */
export function splitWrongTyped(nbt) {
  const top = {}, display = {};
  let clean = nbt;
  for (const [k, t] of nbt) if (TOP[k] && !TOP[k](t)) { top[k] = t; if (clean === nbt) clean = new Map(nbt); clean.delete(k); }
  const d = clean.get('display');
  if (d?.type === NBT.COMPOUND) {
    for (const [k, t] of d.value) if (DISPLAY[k] && !DISPLAY[k](t)) {
      display[k] = t;
      if (clean.get('display') === d) clean.set('display', { type: NBT.COMPOUND, value: new Map(d.value) });
      clean.get('display').value.delete(k);
    }
  }
  return { clean, top, display };
}
