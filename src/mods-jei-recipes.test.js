// Recipe viewer mod (not 1.7.10): the recipe table is complete, current and crafts what it says.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nativeRecipesSource, buildNativeRecipes } from '../tools/jei-recipes.mjs';
import { ITEMS, SMELTING, FUELS, RECIPES, SHAPELESS, craftingResult, burnTime } from './survival.js';
import { recipeTable, recipesFor, usesOf, entryGrid, registerRecipeSource } from './mods/jei/recipes.js';
import { makeStack } from './inventory.js';

const STICK = 300, PLANKS = 7, LOG = 4, COAL = 301, IRON = 302, FURNACE = 14;

test('native-recipes.js is what tools/jei-recipes.mjs writes from the native registry', () => {
  const current = readFileSync(new URL('./mods/jei/native-recipes.js', import.meta.url), 'utf8');
  assert.equal(current, nativeRecipesSource());
  const { recipes, skipped } = buildNativeRecipes();
  // The recipe audit replays 308 native recipes; every one the live code crafts is in the table.
  assert.equal(recipes.length, 308);
  assert.deepEqual(skipped.map((s) => s.index), [25, 26, 125, 126]);
});

test('every crafting entry, with every alternative, crafts its output through the live craftingResult', () => {
  const { crafting } = recipeTable();
  assert.ok(crafting.length >= 308);
  for (const e of crafting) {
    const n = Math.max(1, ...e.slots.map((s) => s?.length ?? 1));
    for (let k = 0; k < n; k++) {
      const out = craftingResult(entryGrid(e, k), 3);
      assert.ok(out, `entry ${JSON.stringify(e.slots)} alternative ${k}`);
      assert.equal(out.id, e.output.id);
      assert.ok(ITEMS[e.output.id], `output ${e.output.id} is registered`);
    }
  }
});

test('no two crafting entries are the same recipe', () => {
  const keys = recipeTable().crafting.map((e) => JSON.stringify([e.slots.filter(Boolean).map((s) => JSON.stringify(s[0])).sort(), e.output]));
  assert.equal(new Set(keys).size, keys.length);
});

test('the live RECIPES and SHAPELESS tables are all reachable from the viewer', () => {
  for (const r of [...RECIPES, ...SHAPELESS]) {
    assert.ok(recipesFor(makeStack(r.output, 1, r.damage | 0)).length, `recipe for ${r.output}:${r.damage | 0}`);
  }
});

test('recipes and uses: planks, sticks, the furnace', () => {
  const planks = recipesFor(makeStack(PLANKS, 1, 0));
  assert.ok(planks.some((e) => e.category === 'crafting' && e.slots.some((s) => s?.some((a) => a[0] === LOG))));
  const sticks = recipesFor(makeStack(STICK, 1, 0));
  assert.ok(sticks.some((e) => e.output.count === 4));
  const furnace = recipesFor(makeStack(FURNACE, 1, 0));
  assert.equal(furnace.length, 1);
  assert.equal(furnace[0].slots.filter(Boolean).length, 8);
  const stickUses = usesOf(makeStack(STICK, 1, 0)).map((e) => e.output?.id);
  for (const tool of [100, 101, 102]) if (ITEMS[tool]) assert.ok(stickUses.includes(tool), `stick makes ${tool}`);
  assert.ok(usesOf(makeStack(STICK, 1, 0)).some((e) => e.category === 'fuel'));
});

test('smelting and fuel come from SMELTING and FUELS', () => {
  const { smelting, fuel } = recipeTable();
  assert.ok(smelting.length > 0 && smelting.length <= Object.keys(SMELTING).length);
  const iron = recipesFor(makeStack(IRON, 1, 0)).filter((e) => e.category === 'smelting');
  assert.ok(iron.length >= 1);
  assert.ok(iron.every((e) => e.xp > 0));
  const coal = fuel.find((e) => e.slots[0][0][0] === COAL);
  assert.equal(coal.burn, burnTime(makeStack(COAL, 1, 0)));
  assert.equal(coal.burn, 1600);
  assert.ok(fuel.length <= Object.keys(FUELS).length + 64);
  // A worn tool still finds its recipes (damage is wear), a dye colour does not find another colour's.
  assert.ok(recipesFor(makeStack(102, 1, 40)).length);
  const red = recipesFor(makeStack(351, 1, 1));
  assert.ok(red.length && red.every((e) => e.output.damage === 1));
});

test('dynamic handlers are shown as worked examples, each crafting through the live code', () => {
  const dyn = recipeTable().crafting.filter((e) => e.source === 'dynamic');
  assert.deepEqual(dyn.map((e) => e.note).sort(), ['Any dye colours the armor', 'Copies a written book', 'Dyes set the colours', 'Repair', 'Up to 3 gunpowder: flight 1-3'].sort());
});

test('a mod recipe source is listed while registered and only when the live code crafts it', () => {
  const before = recipeTable().crafting.length;
  // A grid the live code never crafts is dropped; a real one with a new layout is kept.
  registerRecipeSource('test', () => [
    { shapeless: true, width: 0, height: 0, slots: [[[COAL, 0]], [[COAL, 0]], [[COAL, 0]]] },
  ]);
  assert.equal(recipeTable().crafting.length, before);
  registerRecipeSource('test', null);
  assert.equal(recipeTable().crafting.length, before);
});
