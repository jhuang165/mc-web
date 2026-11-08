// Guns mod (not 1.7.10): per-world registration. A world record with `mods: { guns: true }` adds the gun and ammo items to
// the live item table, the Combat creative tab, creative search and the crafting grid; any other world (and every test that
// imports survival.js without loading a world) sees the vanilla tables. setGunsEnabled runs before the world's inventory is
// read (main.js), so saved gun stacks resolve.
import { GUN_ITEMS, GUNS, CREATIVE_ORDER, P320, AKM, M870, AMMO_45ACP, AMMO_762X39, AMMO_12G } from "./catalog.js";

export const gunsWorld = (record) => record?.mods?.guns === true;

let enabled = false;
export const gunsEnabled = () => enabled;

// tables: { items: ITEMS, combatTab: CREATIVE_TABS[8].items, search: SEARCH_ORDER, setCrafting } (main.js passes the live ones).
export function setGunsEnabled(on, tables) {
  on = on === true;
  if (on === enabled) return;
  enabled = on;
  const { items, combatTab, search, setCrafting } = tables;
  const strip = (list) => { for (let i = list.length - 1; i >= 0; i--) if (CREATIVE_ORDER.includes(list[i])) list.splice(i, 1); };
  strip(combatTab); strip(search);
  if (on) {
    for (const item of GUN_ITEMS) items[item.id] = item;
    combatTab.push(...CREATIVE_ORDER); search.push(...CREATIVE_ORDER);
  } else for (const item of GUN_ITEMS) delete items[item.id];
  setCrafting?.(on ? gunCraftingResult : null);
}

// Crafting table recipes (this project's own; 1.7.10 has no copper or iron nuggets). A key is an item id or [id, damage];
// logs are any of the two log blocks with any damage.
const IRON = 302, GOLD = 304, GUNPOWDER = 330, PAPER = 328, LAPIS = [351, 4], LOG = [4, 70];
export const GUN_RECIPES = [
  { output: P320, count: 1, rows: ["III", "GL ", "I  "], keys: { I: IRON, G: GOLD, L: LAPIS } },
  { output: AKM, count: 1, rows: ["III", "WIL", "W  "], keys: { I: IRON, W: LOG, L: LAPIS } },
  { output: M870, count: 1, rows: ["III", "WWI", " W "], keys: { I: IRON, W: LOG } },
  { output: AMMO_45ACP, count: 8, rows: ["I", "G"], keys: { I: IRON, G: GUNPOWDER } },
  { output: AMMO_762X39, count: 12, rows: ["I", "G", "G"], keys: { I: IRON, G: GUNPOWDER } },
  { output: AMMO_12G, count: 6, rows: ["P", "G", "I"], keys: { P: PAPER, G: GUNPOWDER, I: IRON } },
];

function accepts(key, stack) {
  if (key === undefined) return !stack;
  if (!stack) return false;
  if (key === LOG) return LOG.includes(stack.id);
  if (Array.isArray(key)) return stack.id === key[0] && (stack.damage | 0) === key[1];
  return stack.id === key;
}
// Shaped match anywhere in the grid, mirrored too, every other cell empty (CraftingManager's ShapedRecipes rule).
export function gunCraftingResult(cells, size) {
  for (const r of GUN_RECIPES) {
    const h = r.rows.length, w = Math.max(...r.rows.map((row) => row.length));
    if (w > size || h > size) continue;
    for (let ox = 0; ox <= size - w; ox++)
      for (let oy = 0; oy <= size - h; oy++)
        for (const mirror of [false, true]) {
          let ok = true;
          for (let y = 0; y < size && ok; y++)
            for (let x = 0; x < size && ok; x++) {
              const rx = x - ox, ry = y - oy, inside = rx >= 0 && rx < w && ry >= 0 && ry < h;
              const c = inside ? (r.rows[ry][mirror ? w - 1 - rx : rx] ?? " ") : " ";
              ok = accepts(c === " " ? undefined : r.keys[c], cells[y * size + x]);
            }
          // A crafted gun comes with an empty magazine (damage = rounds fired).
          if (ok) return { id: r.output, count: r.count, damage: GUNS[r.output]?.magazine ?? 0 };
        }
  }
  return null;
}
