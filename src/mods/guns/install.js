// Guns mod (not 1.7.10): per-world registration. A world record with `mods: { guns: true }` adds the gun and ammo items to
// the live item table, the Combat creative tab, creative search and the crafting grid; any other world (and every test that
// imports survival.js without loading a world) sees the vanilla tables. setGunsEnabled runs before the world's inventory is
// read (main.js), so saved gun stacks resolve.
//
// setGunPack (main.js, at boot) adds the locally installed TaCZ default gun pack (pack.js): its other guns and ammo join
// GUNS/AMMO, and the three hand-made guns take the pack's models and animations. Without the install, every pack id still
// registers as a placeholder item, so a world saved with pack guns keeps its stacks until the pack is back.
import { GUN_ITEMS, GUNS, AMMO, ATTACHMENTS, CREATIVE_ORDER, P320, AKM, M870, AMMO_45ACP, AMMO_762X39, AMMO_12G, GUN_SMITH } from "./catalog.js";
import { taczGun, taczAmmo, taczRecipes, packUrl } from "./pack.js";
import { TACZ_GUN_IDS, TACZ_AMMO_IDS, TACZ_ATTACHMENT_IDS } from "./ids.js";
import { taczAttachment, resolveAllowed, readGunTag, ATTACHMENT_TYPES, TYPE_NAMES } from "./fit.js";
import { AMMO_BOXES, AMMO_BOX_IRON, AMMO_BOX_GOLD, AMMO_BOX_DIAMOND, AMMO_BOX_CREATIVE, readBoxTag, boxLabel } from "./ammo-box.js";
import { partSummary } from "./attachment-screen.js";
import { ORIGINAL_ITEMS } from "../../original-items.js";

export const gunsWorld = (record) => record?.mods?.guns === true;

let enabled = false;
export const gunsEnabled = () => enabled;

// The pack's guns, ammo, attachments and smithing recipes once setGunPack ran with an installed pack.
const pack = { installed: false, guns: [], ammo: [], attachments: [], recipes: [], items: [] };
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
  for (const g of Object.values(GUNS)) { delete g.pack; delete g.attachments; delete g.extendedMag; delete g.builtinParts; }
  for (const id of Object.keys(ATTACHMENTS)) delete ATTACHMENTS[id];
  Object.assign(pack, { installed: false, guns: [], ammo: [], attachments: [], recipes: [], items: [] });
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
    for (const [name, entry] of Object.entries(raw.attachments ?? {})) {
      const a = taczAttachment(name, entry, raw.lang);
      if (a) pack.attachments.push(a);
    }
    pack.attachments.sort((a, b) => (ATTACHMENT_TYPES.indexOf(a.type) - ATTACHMENT_TYPES.indexOf(b.type)) || (a.sort - b.sort) || (a.key < b.key ? -1 : 1));
    for (const a of pack.attachments) ATTACHMENTS[a.id] = a;
    // Each gun's allow list (its tag file, whose `#tags` nest), kept only for the slot types the gun's data allows.
    const tags = raw.tags ?? {}, byKey = new Map(pack.attachments.map((a) => [a.key, a]));
    for (const g of pack.guns) {
      const types = new Set(g.attachmentTypes), names = resolveAllowed(tags[`allow_attachments/${g.key}`], tags);
      for (const b of Object.values(g.builtin ?? {})) for (const n of b.attachments) names.add(n);
      g.attachments = new Set([...names].filter((n) => byKey.has(n) && (!types.size || types.has(byKey.get(n).type))));
      // The part an empty slot shows and fires with (fit.js; catalog.js gunOf).
      g.builtinParts = Object.fromEntries(Object.entries(g.builtin ?? {}).filter(([t, b]) => byKey.get(b.default)?.type === t).map(([t, b]) => [t, byKey.get(b.default).id]));
    }
    pack.guns.sort((a, b) => (TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)) || (a.sort - b.sort) || (a.key < b.key ? -1 : 1));
    pack.ammo.sort((a, b) => a.id - b.id);
    for (const a of pack.ammo) if (!LEGACY.has(a.id)) AMMO[a.id] = a;
    for (const g of pack.guns) {
      // The hand-made guns keep their own stats, recoil and sound timing; they take only the pack's visuals.
      if (LEGACY.has(g.id)) Object.assign(GUNS[g.id], { pack: g.pack, attachments: g.attachments, extendedMag: g.extendedMag, builtinParts: g.builtinParts });
      else GUNS[g.id] = g;
    }
    pack.recipes = taczRecipes(raw).filter((r) => GUNS[r.output] || AMMO[r.output] || ATTACHMENTS[r.output]);
  }
  const ICON = (loc, fallback) => (loc ? packUrl.texture(loc) : fallback);
  for (const g of pack.guns) {
    if (LEGACY.has(g.id)) continue;
    pack.items.push({ id: g.id, name: g.name, stack: 1, damageRange: Math.max(1, g.magazine), iconUrl: ICON(g.pack.slot), gun: g, readTag: readGunTag });
  }
  // A legacy gun with the pack's biggest magazine fitted counts up to its size (PlayerInventory.read keeps damage in range).
  for (const item of GUN_ITEMS) if (item.gun) item.damageRange = Math.max(item.gun.magazine, ...(item.gun.extendedMag ?? []));
  for (const g of pack.guns) {
    // A stack with the biggest magazine fitted counts up to its size (PlayerInventory.read keeps damage in range).
    const item = pack.items.find((i) => i.id === g.id);
    if (item && g.extendedMag?.length) item.damageRange = Math.max(item.damageRange, ...g.extendedMag);
  }
  for (const a of pack.attachments) pack.items.push({ id: a.id, name: a.name, stack: 1, iconUrl: ICON(a.slot, "/media/mods/guns/gun_smith_table.png"), attachment: a,
    tooltip: () => [TYPE_NAMES[a.type], partSummary(a)] });
  // A gun's tooltip lists the parts it carries.
  for (const item of [...GUN_ITEMS, ...pack.items]) if (item.gun) item.tooltip = (s) => Object.entries(s.modTag?.attachments ?? {}).map(([t, id]) => ATTACHMENTS[id] ? `${TYPE_NAMES[t]}: ${ATTACHMENTS[id].name}` : null);
  for (const a of pack.ammo) {
    if (LEGACY.has(a.id)) continue;
    pack.items.push({ id: a.id, name: a.name, stack: a.stack, iconUrl: ICON(a.slot), ammo: a });
  }
  // Placeholders: an id the pack does not provide (not installed, or a gun this game cannot convert) keeps its stacks.
  const have = new Set(pack.items.map((i) => i.id));
  const placeholder = (id, gun) => ({ id, name: gun ? "Missing TaCZ Gun" : "Missing TaCZ Ammo", stack: gun ? 1 : 64, damageRange: gun ? 1000 : 0,
    iconUrl: "/media/mods/guns/gun_smith_table.png", missingPack: true, ...(gun ? { readTag: readGunTag } : {}) });
  for (const id of Object.values(TACZ_GUN_IDS)) if (!LEGACY.has(id) && !have.has(id)) pack.items.push(placeholder(id, true));
  for (const id of Object.values(TACZ_AMMO_IDS)) if (!LEGACY.has(id) && !have.has(id)) pack.items.push(placeholder(id, false));
  for (const id of Object.values(TACZ_ATTACHMENT_IDS)) if (!have.has(id)) pack.items.push({ ...placeholder(id, false), name: "Missing TaCZ Attachment", stack: 1 });
  return pack;
}

// The ammo boxes (ammo-box.js): this project's own icons.
const BOX_ITEMS = Object.values(AMMO_BOXES).map((b) => ({ id: b.id, name: b.name, stack: 1, iconUrl: `/media/mods/guns/ammo_box_${b.key}.png`,
  ammoBox: b, readTag: readBoxTag, tooltip: (s) => [boxLabel(s), b.id === AMMO_BOX_CREATIVE ? null : "Use: fill  Sneak + use: empty"] }));
// Creative order: the three hand-made guns and their ammo, the gun smith table, the ammo boxes, then the pack's guns, ammo
// and attachments.
export const creativeOrder = () => [...CREATIVE_ORDER, ...BOX_ITEMS.map((i) => i.id),
  ...pack.guns.filter((g) => !LEGACY.has(g.id)).map((g) => g.id), ...pack.ammo.filter((a) => !LEGACY.has(a.id)).map((a) => a.id),
  ...pack.attachments.map((a) => a.id)];

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
    registered = { items: [...GUN_ITEMS, ...BOX_ITEMS, ...pack.items], order: creativeOrder() };
    for (const item of registered.items) items[item.id] = item;
    combatTab.push(...registered.order); search.push(...registered.order);
  }
  setCrafting?.(on ? gunCraftingResult : null);
}

// Crafting table recipes (this project's own; 1.7.10 has no copper or iron nuggets). A key is an item id or [id, damage];
// logs are any of the two log blocks with any damage.
// The crafting table and chest by their 1.7.10 ids (58, 54), mapped to this game's live ones.
const IRON = 302, GOLD = 304, DIAMOND = 303, GUNPOWDER = 330, PAPER = 328, LAPIS = [351, 4], COAL = 301, LOG = [4, 70];
const CRAFTING_TABLE = ORIGINAL_ITEMS[58] ?? 58, CHEST = ORIGINAL_ITEMS[54] ?? 54;
export const GUN_RECIPES = [
  { output: P320, count: 1, rows: ["III", "GL ", "I  "], keys: { I: IRON, G: GOLD, L: LAPIS } },
  { output: AKM, count: 1, rows: ["III", "WIL", "W  "], keys: { I: IRON, W: LOG, L: LAPIS } },
  { output: M870, count: 1, rows: ["III", "WWI", " W "], keys: { I: IRON, W: LOG } },
  { output: AMMO_45ACP, count: 8, rows: ["I", "G"], keys: { I: IRON, G: GUNPOWDER } },
  { output: AMMO_762X39, count: 12, rows: ["I", "G", "G"], keys: { I: IRON, G: GUNPOWDER } },
  { output: AMMO_12G, count: 6, rows: ["P", "G", "I"], keys: { P: PAPER, G: GUNPOWDER, I: IRON } },
  // Gunpowder from one coal or charcoal, anywhere in the grid, so ammo needs no creeper farm.
  { output: GUNPOWDER, count: 1, rows: ["C"], keys: { C: COAL } },
  // The pack's guns and ammo are made at the gun smith table (gun-smith.js), from TaCZ's own recipes.
  { output: GUN_SMITH, count: 1, rows: ["III", "ICI"], keys: { I: IRON, C: CRAFTING_TABLE } },
  // Ammo boxes: a chest banded with iron, gold or diamonds (a creative box is creative-only).
  { output: AMMO_BOX_IRON, count: 1, rows: ["I I", "ICI", "III"], keys: { I: IRON, C: CHEST } },
  { output: AMMO_BOX_GOLD, count: 1, rows: ["G G", "GCG", "GGG"], keys: { G: GOLD, C: CHEST } },
  { output: AMMO_BOX_DIAMOND, count: 1, rows: ["D D", "DCD", "DDD"], keys: { D: DIAMOND, C: CHEST } },
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
