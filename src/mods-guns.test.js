// Guns mod (not 1.7.10): per-world registration, crafting and the magazine count kept in the stack's damage.
import test from "node:test";
import assert from "node:assert/strict";
import { ITEMS, craftingResult, setExtraCrafting, Survival } from "./survival.js";
import { CREATIVE_TABS, SEARCH_ORDER } from "./creative.js";
import { setGunsEnabled, gunsWorld, gunsEnabled, gunCraftingResult, creativeOrder, gunSmithRecipes } from "./mods/guns/install.js";
import { P320, AKM, M870, GUN_SMITH, AMMO_45ACP, AMMO_762X39, AMMO_12G, GUNS, roundsLeft, CREATIVE_ORDER } from "./mods/guns/catalog.js";
import { recipesFor, usesOf, recipeTable, entryGrid } from "./mods/jei/recipes.js";
import { smithCraft } from "./mods/guns/smith-screen.js";

const tables = () => ({ items: ITEMS, combatTab: CREATIVE_TABS[8].items, search: SEARCH_ORDER, setCrafting: setExtraCrafting });
const grid = (rows, keys) => rows.join("").split("").map((c) => (c === " " ? null : { count: 1, damage: 0, ...keys[c] }));
const IRON = { id: 302 }, GOLD = { id: 304 }, LAPIS = { id: 351, damage: 4 }, LOG = { id: 4, damage: 2 }, POWDER = { id: 330 }, PAPER = { id: 328 };

test("a vanilla session has no gun items, tab entries or recipes", () => {
  assert.equal(gunsEnabled(), false);
  for (const id of CREATIVE_ORDER) {
    assert.equal(ITEMS[id], undefined);
    assert.ok(!CREATIVE_TABS[8].items.includes(id));
    assert.ok(!SEARCH_ORDER.includes(id));
  }
  assert.equal(craftingResult(grid(["III", "GL ", "I  "], { I: IRON, G: GOLD, L: LAPIS }), 3), null);
});

test("only a record with mods.guns is a guns world", () => {
  assert.equal(gunsWorld({ mods: { guns: true } }), true);
  assert.equal(gunsWorld({ mods: { guns: "yes" } }), false);
  assert.equal(gunsWorld({}), false);
  assert.equal(gunsWorld(null), false);
});

test("enabling registers the items, Combat tab, search and crafting once; disabling restores vanilla", () => {
  const combat = [...CREATIVE_TABS[8].items], search = [...SEARCH_ORDER];
  setGunsEnabled(true, tables());
  setGunsEnabled(true, tables()); // a second load of a guns world adds nothing twice
  try {
    assert.equal(ITEMS[P320].name, "P320");
    assert.equal(ITEMS[AKM].name, "AKM");
    assert.equal(ITEMS[M870].stack, 1);
    assert.equal(ITEMS[AMMO_12G].stack, 36);
    assert.equal(ITEMS[P320].durability, undefined); // not damageable: no wear, repair or Unbreaking
    assert.deepEqual(CREATIVE_TABS[8].items, [...combat, ...creativeOrder()]);
    assert.deepEqual(SEARCH_ORDER, [...search, ...creativeOrder()]);
    assert.deepEqual(creativeOrder().slice(0, CREATIVE_ORDER.length + 4), [...CREATIVE_ORDER, 4301, 4302, 4303, 4304]); // the ammo boxes follow
    const crafted = craftingResult(grid(["III", "GL ", "I  "], { I: IRON, G: GOLD, L: LAPIS }), 3);
    assert.deepEqual([crafted.id, crafted.count, crafted.damage], [P320, 1, GUNS[P320].magazine]); // crafted empty
  } finally {
    setGunsEnabled(false, tables());
  }
  assert.equal(ITEMS[P320], undefined);
  assert.deepEqual(CREATIVE_TABS[8].items, combat);
  assert.deepEqual(SEARCH_ORDER, search);
  assert.equal(craftingResult(grid(["III", "GL ", "I  "], { I: IRON, G: GOLD, L: LAPIS }), 3), null);
});

test("gun and ammo recipes: shaped, mirrored, shifted, damage-checked lapis, any log", () => {
  const r = (rows, keys, size = 3) => { const o = gunCraftingResult(grid(rows, keys), size); return o && [o.id, o.count]; };
  assert.deepEqual(r(["III", "WIL", "W  "], { I: IRON, W: LOG, L: LAPIS }), [AKM, 1]);
  assert.deepEqual(r(["III", "LIW", "  W"], { I: IRON, W: { id: 70, damage: 1 }, L: LAPIS }), [AKM, 1]); // mirrored, acacia/dark oak log
  assert.deepEqual(r(["III", "WWI", " W "], { I: IRON, W: LOG }), [M870, 1]);
  assert.equal(r(["III", "GL ", "I  "], { I: IRON, G: GOLD, L: { id: 351, damage: 1 } }), null); // red dye is not lapis
  assert.deepEqual(r([" I ", " G ", "   "], { I: IRON, G: POWDER }), [AMMO_45ACP, 8]);
  assert.deepEqual(r(["I ", "G "], { I: IRON, G: POWDER }, 2), [AMMO_45ACP, 8]); // the 2x2 player grid
  assert.deepEqual(r(["  I", "  G", "  G"], { I: IRON, G: POWDER }), [AMMO_762X39, 12]);
  assert.deepEqual(r(["P  ", "G  ", "I  "], { P: PAPER, G: POWDER, I: IRON }), [AMMO_12G, 6]);
  assert.equal(r(["I  ", "G  ", "G I"], { I: IRON, G: POWDER }), null); // an extra item breaks the match
  const COAL = { id: 301 }, CHARCOAL = { id: 301, damage: 1 };
  assert.deepEqual(r(["   ", "  C", "   "], { C: COAL }), [330, 1]); // one coal, anywhere: one gunpowder
  assert.deepEqual(r(["C"], { C: COAL }, 2), [330, 1]);
  assert.deepEqual(r(["C"], { C: CHARCOAL }, 2), [330, 1]); // charcoal too
  assert.equal(r(["CC"], { C: COAL }, 2), null);
});

test("rounds left come from the stack damage and saved gun stacks load in a guns world", () => {
  assert.equal(roundsLeft({ id: AKM, damage: 0 }), 30);
  assert.equal(roundsLeft({ id: AKM, damage: 7 }), 23);
  assert.equal(roundsLeft({ id: AKM, damage: 40 }), 0);
  assert.equal(roundsLeft({ id: 302, damage: 0 }), 0);
  const saved = { slots: [{ id: AKM, count: 1, damage: 5 }, { id: AMMO_762X39, count: 40, damage: 0 }] };
  setGunsEnabled(true, tables());
  try {
    const s = new Survival(saved, "survival");
    assert.deepEqual([s.inventory.main[0].id, s.inventory.main[0].damage], [AKM, 5]);
    assert.equal(s.inventory.main[1].count, 40);
  } finally {
    setGunsEnabled(false, tables());
  }
});

test("the recipe browser lists the table's grid recipe and every fallback gun's real smithing recipe", () => {
  setGunsEnabled(true, tables());
  try {
    const table = recipesFor({ id: GUN_SMITH, count: 1, damage: 0 }).find((r) => r.category === "crafting");
    assert.ok(table);
    const cells = entryGrid(table);
    assert.equal(cells.filter((s) => s?.id === 302).length, 5);
    assert.equal(craftingResult(cells, 3).id, GUN_SMITH);
    const smith = recipeTable().smithing;
    assert.deepEqual(smith.map((e) => e.output.id).sort(), [P320, AKM, M870].sort());
    for (const gun of Object.values(GUNS)) {
      // Creative guns start at damage 0; a crafted gun is unloaded. Both find the same recipe.
      const r = recipesFor({ id: gun.id, count: 1, damage: 0 }).find((r) => r.category === "smithing");
      assert.ok(r, gun.name);
      assert.equal(r.station, GUN_SMITH);
      const live = gunSmithRecipes().find((s) => s.output === gun.id);
      const slots = r.slots.map((alts) => ({ ...alts[0] }));
      assert.deepEqual(smithCraft(slots, live), r.output);
      assert.ok(slots.every((s) => s === null));
      assert.ok(usesOf({ id: GUN_SMITH, count: 1, damage: 0 }).some((e) => e.output.id === gun.id));
    }
    const pistol = smith.find((e) => e.output.id === P320);
    assert.ok(usesOf({ id: 351, count: 1, damage: 4 }).includes(pistol));
    assert.ok(!usesOf({ id: 351, count: 1, damage: 1 }).includes(pistol));
  } finally { setGunsEnabled(false, tables()); }
  assert.equal(recipeTable().smithing.length, 0);
  assert.deepEqual(recipesFor({ id: GUN_SMITH, count: 1, damage: 0 }), []);
});
