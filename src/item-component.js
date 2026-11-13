// ItemStack.func_151000_E (add.E, executed in tools/probes/ChatRarityProbe.java, public/research/chat-rarity-reference.json): the chat component of a
// stack, ChatComponentText("[") with the display name and "]" as siblings, the colour of EnumRarity (add.w -> Item.getRarity) and a show_item
// HoverEvent holding the stack's NBT text. It sets no italic, so a renamed stack looks like any other. The rarity table is the executed one:
// an item is common, or rare while the stack has an "ench" list; the golden apple is rare at damage 0 and epic above; a record is rare; an
// enchanted book is uncommon while it stores enchantments.
import { text } from "./chat-component.js";
import { originalOfLive } from "./item-names.js";
import { NBT } from "./nbt.js";
import { stringHash } from "./java-long.js";
import { writeFireworkTags } from "./fireworks-nbt.js";
import { writeBookTags } from "./books-nbt.js";

export const RARITY_COLOR = Object.freeze({ common: "white", uncommon: "yellow", rare: "aqua", epic: "light_purple" });
const GOLDEN_APPLE = 322, ENCHANTED_BOOK = 403;
const isRecord = (id) => id >= 2256 && id <= 2267;

const pairs = (v) => (Array.isArray(v) ? v : null);
/** The 1.7.10 original id and damage a browser stack stands for (id null when it has none). */
export function originalStack(stack) {
  const o = originalOfLive(stack.id);
  return { id: o?.id ?? null, damage: o?.damage ?? (stack.damage | 0) };
}
/** Item.getRarity of a browser stack as "common" | "uncommon" | "rare" | "epic". */
export function stackRarity(stack) {
  const { id, damage } = originalStack(stack);
  if (isRecord(id)) return "rare";
  if (id === GOLDEN_APPLE) return damage > 0 ? "epic" : "rare";
  const stored = pairs(stack.storedEnchantments) ?? pairs(stack.stored);
  if (id === ENCHANTED_BOOK && stored?.length) return "uncommon";
  return pairs(stack.enchantments) ? "rare" : "common";
}

// NBTTagCompound.toString / NBTTagList.toString (executed in ChatRarityProbe, "nbt" rows) over the tags the browser stack carries, the same set
// region-export.js writes: ench, StoredEnchantments, RepairCost, display (Name, color), Unbreakable, Explosion, Fireworks, pages, author, title.
// A compound prints "{" + key ":" value "," per entry in the iteration order of the native HashMap (Java 8+ order, see hashMapKeys), a list
// "[" + index ":" value "," + "]", a byte "1b", a short "1s", an int bare, a long "1L", a float "1.0f", a double "1.0d", a string quoted with
// no escaping, a byte array "[N bytes]" and an int array "[1,2,]". Not carried by the port (so never written): display.Lore, SkullOwner,
// CustomPotionEffects, map tags.
const T = NBT;
const tag = (type, value) => ({ type, value });
const entryList = (values) => tag(T.LIST, { elementType: values.length ? T.COMPOUND : T.END, items: values.map((e) => new Map([["id", tag(T.SHORT, (e.id << 16) >> 16)], ["lvl", tag(T.SHORT, ((e.lvl ?? e.level) << 16) >> 16)]])) });
/** java.util.HashMap<String,?> iteration order: bucket (h ^ h>>>16) & (cap - 1), cap 16 doubled while size > 0.75 cap; a bucket keeps insertion order. */
export function hashMapKeys(keys) {
  let cap = 16;
  while (keys.length > cap * 0.75) cap *= 2;
  const bucket = (k) => { const h = stringHash(k); return (h ^ (h >>> 16)) & (cap - 1); };
  return keys.map((k, i) => [k, i, bucket(k)]).sort((a, b) => a[2] - b[2] || a[1] - b[1]).map((x) => x[0]);
}
const shortestFloat = (x) => { for (let p = 1; p <= 9; p++) { const t = x.toPrecision(p); if (Math.fround(Number(t)) === x) return Number(t); } return x; };
// Float.toString / Double.toString: plain decimal in [1e-3, 1e7), else "d.dddE<exp>". No stack tag the port carries holds a float or double.
function javaFloat(v, suffix, f32) {
  const x = f32 ? Math.fround(v) : v;
  if (!Number.isFinite(x)) return (Number.isNaN(x) ? "NaN" : x > 0 ? "Infinity" : "-Infinity") + suffix;
  const r = f32 ? shortestFloat(x) : x, abs = Math.abs(r);
  if (abs !== 0 && (abs >= 1e7 || abs < 1e-3)) {
    const [m, e] = r.toExponential().split("e");
    return `${m.includes(".") ? m : `${m}.0`}E${Number(e)}${suffix}`;
  }
  const t = String(r);
  return (t.includes(".") ? t : `${t}.0`) + suffix;
}
export function nbtText(t) {
  switch (t.type) {
    case T.BYTE: return `${(t.value << 24) >> 24}b`;
    case T.SHORT: return `${(t.value << 16) >> 16}s`;
    case T.INT: return String(t.value | 0);
    case T.LONG: return `${BigInt.asIntN(64, BigInt(t.value))}L`;
    case T.FLOAT: return javaFloat(t.value, "f", true);
    case T.DOUBLE: return javaFloat(t.value, "d", false);
    case T.STRING: return `"${t.value}"`;
    case T.BYTE_ARRAY: return `[${t.value.length} bytes]`;
    case T.INT_ARRAY: return `[${[...t.value].map((n) => `${n | 0},`).join("")}]`;
    case T.LIST: return `[${t.value.items.map((v, i) => `${i}:${nbtText(t.value.elementType === T.COMPOUND ? tag(T.COMPOUND, v) : tag(t.value.elementType, v))},`).join("")}]`;
    case T.COMPOUND: return `{${hashMapKeys([...t.value.keys()]).map((k) => `${k}:${nbtText(t.value.get(k))},`).join("")}}`;
    default: return "";
  }
}
/** The stack's "tag" compound as the port keeps it (null when empty), in insertion order of ItemStack/region-export. */
export function stackTagCompound(stack) {
  const e = new Map();
  const ench = pairs(stack.enchantments), stored = pairs(stack.storedEnchantments) ?? (stack.stored?.length ? pairs(stack.stored) : null);
  if (ench) e.set("ench", entryList(ench));
  if (stored) e.set("StoredEnchantments", entryList(stored));
  if (Number.isInteger(stack.repairCost)) e.set("RepairCost", tag(T.INT, stack.repairCost));
  const display = new Map();
  if (typeof stack.displayName === "string") display.set("Name", tag(T.STRING, stack.displayName));
  if (Number.isInteger(stack.color) && stack.color >= 0 && stack.color <= 0xffffff) display.set("color", tag(T.INT, stack.color));
  if (display.size) e.set("display", tag(T.COMPOUND, display));
  const entries = {};
  writeFireworkTags(stack, entries);
  writeBookTags(stack, entries);
  for (const [k, v] of Object.entries(entries)) e.set(k, v);
  if (typeof stack.unbreakable === "boolean") e.set("Unbreakable", tag(T.BYTE, stack.unbreakable ? 1 : 0));
  return e.size ? tag(T.COMPOUND, e) : null;
}
export function stackNbtText(stack) {
  const { id, damage } = originalStack(stack);
  const m = new Map([["id", tag(T.SHORT, id ?? stack.id)], ["Count", tag(T.BYTE, stack.count | 0)], ["Damage", tag(T.SHORT, damage)]]);
  const t = stackTagCompound(stack);
  if (t) m.set("tag", t);
  return nbtText(tag(T.COMPOUND, m));
}

/** ItemStack.func_151000_E. `name` is ItemStack.getDisplayName (the caller's localised name). */
export function itemComponent(stack, name) {
  const c = text("[").append(text(String(name))).append(text("]"));
  c.style.color = RARITY_COLOR[stackRarity(stack)];
  c.style.hover = { action: "show_item", value: text(stackNbtText(stack)) };
  return c;
}
