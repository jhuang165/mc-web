// Guns mod (not 1.7.10): the gun smith table's screen. TaCZ's table is a recipe browser: pick a gun or ammo, see what it
// costs, craft it from the materials carried. Here it is a GuiSlot list (menu-ui.js) of the pack's recipes (pack.js
// taczRecipes) with a Guns / Ammo tab pair, each row showing the output and its materials, red where the player has too
// few, and a Craft button for the selected row. The crafting itself is the pure smithCount / canSmith / smithCraft below.
import { GUNS } from "./catalog.js";
import { ORIGINAL_ITEMS } from "../../original-items.js";

// "log" is any 1.7.10 log (log 17 and log2 162, every wood), "planks" any planks (5), "wool" any colour of wool (35), as
// this game's live ids; a material with `damage` needs that exact value.
const live = (original) => ORIGINAL_ITEMS[original] ?? original;
const ANY = { log: new Set([live(17), live(162)]), planks: new Set([live(5)]), wool: new Set([live(35)]) };
export const smithIconId = (m) => (typeof m.item === "string" ? [...ANY[m.item]][0] : m.item);
export const smithMatches = (stack, m) => {
  if (!stack || !(stack.count > 0)) return false;
  if (typeof m.item === "string") return ANY[m.item]?.has(stack.id) ?? false;
  return stack.id === m.item && (m.damage == null || (stack.damage | 0) === m.damage);
};
// How many of a material the slots hold.
export const smithCount = (slots, m) => slots.reduce((n, s) => n + (smithMatches(s, m) ? s.count : 0), 0);
export const canSmith = (slots, recipe) => recipe.materials.every((m) => smithCount(slots, m) >= m.count);

// Takes the materials from `slots` (an array of stacks, emptied slots set to null) and returns the output stack, or null
// when the player lacks something. A crafted gun comes unloaded (every round of its magazine counted as fired).
export function smithCraft(slots, recipe) {
  if (!canSmith(slots, recipe)) return null;
  for (const m of recipe.materials) {
    let need = m.count;
    for (let i = 0; i < slots.length && need > 0; i++) {
      const s = slots[i];
      if (!smithMatches(s, m)) continue;
      const take = Math.min(need, s.count);
      s.count -= take;
      need -= take;
      if (s.count === 0) slots[i] = null;
    }
  }
  const gun = GUNS[recipe.output];
  return { id: recipe.output, count: recipe.count, damage: gun && gun.feed !== "inventory" ? gun.magazine : 0 };
}

const TABS = [["gun", "Guns"], ["ammo", "Ammo"], ["attachment", "Attachments"]];
let styled = false;
// The item icons in list rows (here and attachment-screen.js).
export function ensureStyle() {
  if (styled || typeof document === "undefined") return;
  styled = true;
  const s = document.createElement("style");
  s.textContent = `.smith-icon{position:absolute;overflow:hidden;pointer-events:none}.smith-icon .vanilla-item-icon{position:absolute;left:0;top:0;width:100%;height:100%}`;
  document.head.append(s);
}

// ctx: { recipes, slots() -> the inventory's main stacks, icon(id, damage), name(id, damage), craft(recipe) -> bool, close, show }.
export function gunSmithScreen({ recipes, slots, icon, name, craft, close, show, tab = "gun" }) {
  let selected = -1, scroll = 0;
  const self = {
    id: "gun-smith",
    escape: close,
    init(g, w, h) {
      ensureStyle();
      const c = Math.trunc(w / 2), list = recipes.filter((r) => r.kind === tab);
      g.text("Gun Smith Table", c, 8, { center: true });
      TABS.forEach(([k, label], i) => {
        g.button({ x: c - 152 + i * 102, y: 18, w: 100, h: 20 }, label, () => { if (tab !== k) { tab = k; selected = -1; scroll = 0; show(self); } }, { enabled: tab !== k });
      });
      if (!list.length) {
        g.text(recipes.length ? "Nothing to make here" : "No recipes: install the TaCZ gun pack (npm run mods:fetch-tacz)", c, Math.trunc(h / 2) - 4, { center: true, color: 0xa0a0a0 });
      } else {
        const have = slots();
        const rows = g.slotList({ top: 44, bottom: h - 36, slotHeight: 24, width: 300, scrollbarX: c + 154 }, {
          count: list.length, scroll,
          selected: (i) => i === selected,
          click: (i, double) => {
            selected = i;
            craftButton.enable(canSmith(slots(), list[i]));
            if (double && canSmith(slots(), list[i])) make();
          },
          entry(i, y, parent, x) {
            const r = list[i];
            const cell = g.image("smith-icon", x + 1, y + 1, 18, 18, parent);
            cell.innerHTML = icon(r.output, 0);
            g.text(`${name(r.output)}${r.count > 1 ? ` x${r.count}` : ""}`, x + 22, y + 1, { parent });
            let mx = x + 22;
            for (const m of r.materials) {
              const id = smithIconId(m);
              const sm = g.image("smith-icon", mx, y + 11, 10, 10, parent);
              sm.innerHTML = icon(id, m.damage ?? 0);
              const n = smithCount(have, m), label = `${m.count}`;
              g.text(label, mx + 11, y + 12, { parent, color: n >= m.count ? 0xa0a0a0 : 0xff5555 });
              mx += 14 + label.length * 6;
            }
          },
        });
        this.rows = rows;
      }
      const make = () => {
        const r = list[selected];
        if (!r || !craft(r)) return;
        scroll = this.rows?.scroll ?? 0;
        show(self);
      };
      const craftButton = g.button({ x: c - 154, y: h - 28, w: 150, h: 20 }, "Craft", make, { enabled: selected >= 0 && !!list[selected] && canSmith(slots(), list[selected]) });
      g.button({ x: c + 4, y: h - 28, w: 150, h: 20 }, "Done", close);
    },
  };
  return self;
}
