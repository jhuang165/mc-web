// The browser side of mob equipment (mob-equipment.md): native (1.7.10 item id) stacks to the browser's item ids
// and back, the default gear of each mob type, and the world's loot pickup. Kept apart from mob-equipment.js so
// that module (imported by difficulty.js) needs no item registry.
import { ORIGINAL_ITEMS } from "./original-items.js";
import { ITEMS } from "./survival.js";
import { emptyGear, readGear, cloneStack, pickUpItem, GOLDEN_SWORD, STONE_SWORD, BOW } from "./mob-equipment.js";

const LIVE_TO_ORIGINAL = new Map();
for (const [key, live] of Object.entries(ORIGINAL_ITEMS)) {
  const [id, damage] = key.split(":").map(Number);
  if (!LIVE_TO_ORIGINAL.has(live) || damage === undefined) LIVE_TO_ORIGINAL.set(live, { id, ...(damage === undefined ? {} : { damage }) });
}
const pairs = (list) => list.map((e) => ({ id: e.id, lvl: e.lvl }));

export function toLiveStack(s) {
  const id = s && (ORIGINAL_ITEMS[`${s.id}:${s.damage ?? 0}`] ?? ORIGINAL_ITEMS[s.id]);
  if (id === undefined || !ITEMS[id]) return null;
  const damage = ITEMS[id].durability ? Math.min(s.damage ?? 0, ITEMS[id].durability) : ORIGINAL_ITEMS[`${s.id}:${s.damage ?? 0}`] !== undefined ? 0 : s.damage ?? 0;
  return { id, count: s.count ?? 1, damage, ...(s.enchantments?.length ? { enchantments: pairs(s.enchantments) } : {}) };
}
export function fromLiveStack(s) {
  const original = s && LIVE_TO_ORIGINAL.get(s.id);
  if (!original) return null;
  return { id: original.id, count: s.count ?? 1, damage: original.damage ?? s.damage ?? 0, ...(Array.isArray(s.enchantments) && s.enchantments.length ? { enchantments: pairs(s.enchantments) } : {}) };
}

// The mob types that carry equipment, and what their class constructors leave in the hand when a save has none.
export const GEAR_TYPES = new Set(["zombie", "pigman", "skeleton", "wither_skeleton"]);
const DEFAULT_HELD = { pigman: GOLDEN_SWORD, skeleton: BOW, wither_skeleton: STONE_SWORD };
export function defaultGear(type) {
  const gear = emptyGear();
  if (DEFAULT_HELD[type]) gear.equipment[0] = { id: DEFAULT_HELD[type], count: 1, damage: 0 };
  return gear;
}
// Entity fields a restored mob takes: Equipment, DropChances and CanPickUpLoot (EntityLiving NBT), or the type's defaults.
// A pigman saved before this build has only `held`.
export function gearFieldsFrom(e) {
  if (!GEAR_TYPES.has(e.type)) return { equipment: undefined, dropChances: undefined, canPickUpLoot: undefined };
  if (!e.equipment) {
    const gear = defaultGear(e.type), legacy = e.type === "pigman" ? fromLiveStack(e.held) : null;
    if (e.type === "pigman" && e.held === null) gear.equipment[0] = null;
    else if (legacy) gear.equipment[0] = legacy;
    return gear;
  }
  return readGear({ equipment: e.equipment, dropChances: e.dropChances, canPickUpLoot: e.canPickUpLoot });
}
export const gearOf = (e) => (e.equipment ? e : null);

// EntityLiving.onLivingUpdate's pickup loop for one mob: each live item entity within the mob's box grown by
// (1, 0, 1), in the list's order, that it prefers to what it carries. `items` is ItemEntities.items, `box`
// the mob's [x0, y0, z0, x1, y1, z1], `box(item)` the item's. Taken items are marked dead; the replaced
// stacks come back as native stacks for the caller to drop. Returns the dropped stacks.
export function pickUpLoot(e, items, mobBox, itemBox, rand) {
  const dropped = [];
  if (!e.canPickUpLoot || !items?.length) return dropped;
  const [x0, y0, z0, x1, y1, z1] = mobBox;
  for (const item of items) {
    if (item.dead || !item.stack?.count) continue;
    const [a, b, c, d, g, h] = itemBox(item);
    if (!(d > x0 - 1 && a < x1 + 1 && g > y0 && b < y1 && h > z0 - 1 && c < z1 + 1)) continue;
    const native = fromLiveStack(item.stack);
    if (!native) continue;
    const taken = pickUpItem(e, native, rand);
    if (!taken) continue;
    if (taken.dropped) dropped.push(cloneStack(taken.dropped));
    e.persistent = true;
    item.dead = true;
  }
  return dropped;
}
