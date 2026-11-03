import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ANVIL, BLOCKS } from "./world.js";
import { anvilDamage, anvilDropDamage, anvilFacing, anvilImpact, anvilModelBoxes, anvilPlacementMeta } from "./anvil-block.js";
import { JavaRandom } from "./java-random.js";
import { installPopulationItems, installPopulationRecipes } from "./population-content.js";
import { CREATIVE_TABS, SEARCH_ORDER } from "./creative.js";

const reference = JSON.parse(await readFile(new URL("../public/research/anvil-blocks-reference.json", import.meta.url)));

test("native BlockAnvil registry, orientation bounds, drops, and render flags", () => {
  const r = reference.block;
  assert.equal(ANVIL, 85);
  assert.equal(BLOCKS[ANVIL].name, "Anvil");
  assert.deepEqual([r.id, r.renderType, r.renderNormal, r.opaque, r.hardness, r.tickRate], [145, 35, false, false, 5, 2]);
  assert.deepEqual(r.damageDrops, Array.from({ length: 16 }, (_, m) => m >> 2));
  assert.deepEqual(r.bounds, [
    [0.125, 0, 0, 0.875, 1, 1], [0, 0, 0.125, 1, 1, 0.875],
    [0.125, 0, 0, 0.875, 1, 1], [0, 0, 0.125, 1, 1, 0.875],
  ]);
  assert.ok(r.sideRendered.every(Boolean));
  for (let meta = 0; meta < 16; meta++) {
    assert.equal(anvilDropDamage(meta), meta >> 2);
    assert.equal(anvilDamage(meta), meta >> 2);
    assert.equal(anvilFacing(meta), meta & 3);
  }
  assert.deepEqual(anvilModelBoxes(0)[0], [0.125, 0, 0.125, 0.875, 0.25, 0.875]);
  assert.deepEqual(anvilModelBoxes(1)[0], [0.125, 0, 0.125, 0.875, 0.25, 0.875]);
  assert.deepEqual(anvilModelBoxes(0)[1], [0.25, 0.25, 0.1875, 0.75, 0.3125, 0.8125]);
  assert.deepEqual(anvilModelBoxes(0)[2], [0.375, 0.3125, 0.25, 0.625, 0.625, 0.75]);
  assert.deepEqual(anvilModelBoxes(0)[3], [0.1875, 0.625, 0, 0.8125, 1, 1]);
});

test("native EntityFallingBlock fall(float): 720 controlled seed/distance cases", () => {
  const rows = reference.falls;
  assert.equal(rows.length, 720);
  for (const r of rows) {
    const impact = anvilImpact(r.meta, r.distance, new JavaRandom(BigInt(r.seed)));
    assert.deepEqual([impact.meta, impact.broken], [r.resultMeta, r.broken], `meta=${r.meta}, distance=${r.distance}, seed=${r.seed}`);
    assert.equal(impact.damage, Math.max(0, Math.min(Math.floor(Math.ceil(r.distance - 1) * 2), 40)));
    assert.equal(r.hurtEntities, true);
  }
});

test("ItemAnvil.onItemUse yaw conversion and carried damage bits", () => {
  const cases = [[0, 0], [Math.PI / 2, 3], [Math.PI, 2], [-Math.PI / 2, 1]];
  for (let damage = 0; damage <= 2; damage++) for (const [yaw, facing] of cases)
    assert.equal(anvilPlacementMeta(yaw, damage), (damage << 2) | facing);
});

test("native anvil item labels, Creative damage subtypes, and 31-ingot recipe shape", () => {
  const items = Array.from({ length: ANVIL + 1 }, (_, id) => ({ id }));
  installPopulationItems(items);
  assert.deepEqual(items[ANVIL].variants, ["Anvil", "Slightly Damaged Anvil", "Very Damaged Anvil"]);
  assert.deepEqual(CREATIVE_TABS[1].items.filter((s) => Array.isArray(s) ? s[0] === ANVIL : s === ANVIL), [ANVIL, [ANVIL, 1], [ANVIL, 2]]);
  assert.deepEqual(SEARCH_ORDER.filter((s) => Array.isArray(s) ? s[0] === ANVIL : s === ANVIL), [ANVIL, [ANVIL, 1], [ANVIL, 2]]);
  const recipes = [];
  installPopulationRecipes({ recipe: (...args) => recipes.push(args), shapeless() {} });
  assert.deepEqual(recipes[0], ["anvil", "Anvil", ["BBB", " I ", "III"], { B: 26, I: 302 }, ANVIL]);
});
