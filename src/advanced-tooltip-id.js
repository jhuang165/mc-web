// Batch 59 (smallchecks): the " (#0358/N)" suffix ItemStack.getTooltip puts on the title when advanced tooltips (F3+H) are on. Executed (tools/probes/SmallChecksProbe.java,
// public/research/smallchecks-reference.json, 315 registered ids): the title becomes name + " (#" + id padded to 4 digits + ("/" + damage when the item hasSubtypes) + ")", with
// an empty name giving no parentheses. The ids below are the original ids whose sweep suffix carried a damage; every other registered item shows only "(#0000)".
// 1.7.10 adds no registry-name or NBT line (the sweep and the probe rows show none); the Durability line is gui.js's.
import { ORIGINAL_ITEMS } from "./original-items.js";

export const SUBTYPE_ORIGINAL_IDS = new Set([3,5,6,12,17,18,24,31,35,37,38,43,44,78,95,97,98,125,126,139,145,155,159,160,161,162,171,175,263,322,349,350,351,358,373,383,397]);

const reverse = new Map();
for (const [key, live] of Object.entries(ORIGINAL_ITEMS)) {
  const [id, damage] = key.split(":").map(Number);
  if (!reverse.has(live) || damage === undefined) reverse.set(live, { id, damage });
}

// stack: a port stack {id, damage, rawDamage?}; returns "" for an id with no original id.
export function advancedTitleSuffix(stack, hasName = true) {
  const o = reverse.get(stack?.id);
  if (!o) return "";
  const id = String(o.id).padStart(4, "0");
  let body = "#" + id;
  if (SUBTYPE_ORIGINAL_IDS.has(o.id)) body += "/" + (Number.isInteger(stack.rawDamage) && stack.rawDamage > 0 ? stack.rawDamage : o.damage ?? stack.damage ?? 0);
  return hasName ? ` (${body})` : body;
}
