// Guns mod (not 1.7.10): per-world registration. A world record with `mods: { guns: true }` adds the gun and ammo items to
// the live item table, the Combat creative tab, creative search and the crafting grid; any other world (and every test that
// imports survival.js without loading a world) sees the vanilla tables. setGunsEnabled runs before the world's inventory is
// read (main.js), so saved gun stacks resolve.
//
// setGunPack (main.js, at boot) adds the locally installed TaCZ default gun pack (pack.js): its other guns and ammo join
// GUNS/AMMO, and the three hand-made guns take the pack's models and animations. Without the install, every pack id still
// registers as a placeholder item, so a world saved with pack guns keeps its stacks until the pack is back.
import { GUN_ITEMS, GUNS, AMMO, CREATIVE_ORDER, P320, AKM, M870, AMMO_45ACP, AMMO_762X39, AMMO_12G, GUN_SMITH } from "./catalog.js";
import { taczGun, taczAmmo, taczRecipes, packUrl } from "./pack.js";
import { TACZ_GUN_IDS, TACZ_AMMO_IDS } from "./ids.js";

export const gunsWorld = (record) => record?.mods?.guns === true;

let enabled = false;
export const gunsEnabled = () => enabled;

// The pack's guns, ammo and smithing recipes once setGunPack ran with an installed pack.
const pack = { installed: false, guns: [], ammo: [], recipes: [], items: [] };
export const gunPack = () => pack;
export const gunSmithRecipes = () => pack.recipes;
const LEGACY = new Set(Object.keys(GUNS).map(Number).concat(Object.keys(AMMO).map(Number)));
// Pack type order in the creative tab, as TaCZ's gun smith table groups them.
const TYPE_ORDER = ["pistol", "smg", "rifle", "dmr", "sniper", "shotgun", "mg", "rpg"];

// raw: loadTaczPack's result, or null. Once, before the first world loads.
export function setGunPack(raw) {
  if (enabled) throw new Error("setGunPack before setGunsEnabled");
  for (const g of pack.guns) if (!LEGACY.has(g.id)) delete GUNS[g.id];
  for (const a of pack.ammo) if (!LEGACY.has(a.id)) delete AMMO[a.id];
  for (const g of Object.values(GUNS)) delete g.pack;
  Object.assign(pack, { installed: false, guns: [], ammo: [], recipes: [], items: [] });
  if (raw?.guns) {
    pack.installed = true;
    for (const [name, entry] of Object.entries(raw.ammo ?? {})) {
      const a = taczAmmo(name, entry, raw.lang);
      if (a) pack.ammo.push(a);
    }
    for (const [name, entry] of Object.entries(raw.guns)) {
      const g = taczGun(name, entry, raw.lang);
      if (g && g.ammo != null) pack.guns.push(g);
    }
    pack.guns.sort((a, b) => (TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)) || (a.sort - b.sort) || (a.key < b.key ? -1 : 1));
    pack.ammo.sort((a, b) => a.id - b.id);
    for (const a of pack.ammo) if (!LEGACY.has(a.id)) AMMO[a.id] = a;
    for (const g of pack.guns) {
      // The hand-made guns keep their own stats, recoil and sound timing; they take only the pack's visuals.
      if (LEGACY.has(g.id)) GUNS[g.id].pack = g.pack;
      else GUNS[g.id] = g;
    }
    pack.recipes = taczRecipes(raw).filter((r) => GUNS[r.output] || AMMO[r.output]);
  }
  const ICON = (loc, fallback) => (loc ? packUrl.texture(loc) : fallback);
  for (const g of pack.guns) {
    if (LEGACY.has(g.id)) continue;
    pack.items.push({ id: g.id, name: g.name, stack: 1, damageRange: Math.max(1, g.magazine), iconUrl: ICON(g.pack.slot), gun: g });
  }
  for (const a of pack.ammo) {
    if (LEGACY.has(a.id)) continue;
    pack.items.push({ id: a.id, name: a.name, stack: a.stack, iconUrl: ICON(a.slot), ammo: a });
  }
  // Placeholders: an id the pack does not provide (not installed, or a gun this game cannot convert) keeps its stacks.
  const have = new Set(pack.items.map((i) => i.id));
  const placeholder = (id, gun) => ({ id, name: gun ? "Missing TaCZ Gun" : "Missing TaCZ Ammo", stack: gun ? 1 : 64, damageRange: gun ? 1000 : 0,
    iconUrl: "/media/mods/guns/gun_smith_table.png", missingPack: true });
  for (const id of Object.values(TACZ_GUN_IDS)) if (!LEGACY.has(id) && !have.has(id)) pack.items.push(placeholder(id, true));
  for (const id of Object.values(TACZ_AMMO_IDS)) if (!LEGACY.has(id) && !have.has(id)) pack.items.push(placeholder(id, false));
  return pack;
}

// Creative order: the three hand-made guns and their ammo, the gun smith table, then the pack's guns and ammo.
export const creativeOrder = () => [...CREATIVE_ORDER,
  ...pack.guns.filter((g) => !LEGACY.has(g.id)).map((g) => g.id), ...pack.ammo.filter((a) => !LEGACY.has(a.id)).map((a) => a.id)];

// tables: { items: ITEMS, combatTab: CREATIVE_TABS[8].items, search: SEARCH_ORDER, setCrafting } (main.js passes the live ones).
let registered = { items: [], order: [] };
export function setGunsEnabled(on, tables) {
  on = on === true;
  if (on === enabled) return;
  enabled = on;
  const { items, combatTab, search, setCrafting } = tables;
  const strip = (list, ids) => { for (let i = list.length - 1; i >= 0; i--) if (ids.has(list[i])) list.splice(i, 1); };
  const old = new Set([...registered.order, ...CREATIVE_ORDER]);
  strip(combatTab, old); strip(search, old);
  for (const item of registered.items) delete items[item.id];
  registered = { items: [], order: [] };
  if (on) {
    registered = { items: [...GUN_ITEMS, ...pack.items], order: creativeOrder() };
    for (const item of registered.items) items[item.id] = item;
    combatTab.push(...registered.order); search.push(...registered.order);
  }
  setCrafting?.(on ? gunCraftingResult : null);
}

// Crafting table recipes (this project's own; 1.7.10 has no copper or iron nuggets). A key is an item id or [id, damage];
// logs are any of the two log blocks with any damage.
const IRON = 302, GOLD = 304, GUNPOWDER = 330, PAPER = 328, LAPIS = [351, 4], LOG = [4, 70], CRAFTING_TABLE = 58;
export const GUN_RECIPES = [
  { output: P320, count: 1, rows: ["III", "GL ", "I  "], keys: { I: IRON, G: GOLD, L: LAPIS } },
  { output: AKM, count: 1, rows: ["III", "WIL", "W  "], keys: { I: IRON, W: LOG, L: LAPIS } },
  { output: M870, count: 1, rows: ["III", "WWI", " W "], keys: { I: IRON, W: LOG } },
  { output: AMMO_45ACP, count: 8, rows: ["I", "G"], keys: { I: IRON, G: GUNPOWDER } },
  { output: AMMO_762X39, count: 12, rows: ["I", "G", "G"], keys: { I: IRON, G: GUNPOWDER } },
  { output: AMMO_12G, count: 6, rows: ["P", "G", "I"], keys: { P: PAPER, G: GUNPOWDER, I: IRON } },
  // The pack's guns and ammo are made at the gun smith table (gun-smith.js), from TaCZ's own recipes.
  { output: GUN_SMITH, count: 1, rows: ["III", "ICI"], keys: { I: IRON, C: CRAFTING_TABLE } },
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
