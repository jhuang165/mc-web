// ItemStack.func_151000_E (add.E, executed in tools/probes/ChatRarityProbe.java, public/research/chat-rarity-reference.json): the chat component of a
// stack, ChatComponentText("[") with the display name and "]" as siblings, the colour of EnumRarity (add.w -> Item.getRarity) and a show_item
// HoverEvent holding the stack's NBT text. It sets no italic, so a renamed stack looks like any other. The rarity table is the executed one:
// an item is common, or rare while the stack has an "ench" list; the golden apple is rare at damage 0 and epic above; a record is rare; an
// enchanted book is uncommon while it stores enchantments.
import { text } from "./chat-component.js";
import { originalOfLive } from "./item-names.js";

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

// NBTTagCompound.toString over the tags the browser stack carries, in the HashMap order the executed rows show (id, Count, tag, Damage; inside
// the tag ench, display, StoredEnchantments). Other native tags (RepairCost, Unbreakable, books, fireworks) are not written.
const list = (l) => `[${l.map((e, i) => `${i}:{lvl:${(e.lvl ?? e.level) | 0}s,id:${e.id | 0}s,},`).join("")}]`;
export function stackNbtText(stack) {
  const { id, damage } = originalStack(stack);
  const tag = [];
  const ench = pairs(stack.enchantments), stored = pairs(stack.storedEnchantments) ?? pairs(stack.stored);
  if (ench) tag.push(`ench:${list(ench)},`);
  if (typeof stack.displayName === "string") tag.push(`display:{Name:"${stack.displayName}",},`);
  if (stored?.length) tag.push(`StoredEnchantments:${list(stored)},`);
  const count = ((stack.count | 0) << 24) >> 24;
  return `{id:${id ?? stack.id}s,Count:${count}b,${tag.length ? `tag:{${tag.join("")}},` : ""}Damage:${(damage << 16) >> 16}s,}`;
}

/** ItemStack.func_151000_E. `name` is ItemStack.getDisplayName (the caller's localised name). */
export function itemComponent(stack, name) {
  const c = text("[").append(text(String(name))).append(text("]"));
  c.style.color = RARITY_COLOR[stackRarity(stack)];
  c.style.hover = { action: "show_item", value: text(stackNbtText(stack)) };
  return c;
}
