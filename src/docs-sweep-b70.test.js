// Batch 70 docs sweep: the facts the research docs now state, pinned so the text cannot drift from the code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { harvestBlock } from "./enchantment-effects.js";
import { struckByLightning } from "./weather.js";
import { killConverts } from "./zombie-villager.js";
import { NORMAL, HARD } from "./difficulty.js";

const zero = { nextInt: () => 0, nextFloat: () => 0, nextBoolean: () => false };

test("crops.md: Fortune adds seeds to a ripe wheat break (BlockCrops, 3 + fortune rolls), a young one drops a seed only", () => {
  const ripe = harvestBlock(59, 7, { fortune: 3, rand: zero });
  assert.equal(ripe.drops.filter((d) => d.id === 296).reduce((n, d) => n + d.count, 0), 1);
  assert.equal(ripe.drops.filter((d) => d.id === 295).reduce((n, d) => n + d.count, 0), 6);
  const none = harvestBlock(59, 7, { fortune: 0, rand: zero });
  assert.equal(none.drops.filter((d) => d.id === 295).reduce((n, d) => n + d.count, 0), 3);
  const young = harvestBlock(59, 3, { fortune: 3, rand: zero });
  assert.deepEqual(young.drops.map((d) => d.id), [295]);
});

test("enchantment-effects-armor.md: lightning's fire time is cut by Fire Protection IV (160 - floor(160 * 4 * 0.15) = 64 ticks)", () => {
  assert.equal(struckByLightning(-1, []).fire, 160);
  const boots = { id: 301, damage: 0, count: 1, enchantments: [{ id: 1, lvl: 4 }] };
  assert.equal(struckByLightning(-1, [boots]).fire, 64);
});

test("difficulty.md: a zombie's villager kill converts always on Hard and never on Easy", () => {
  assert.equal(killConverts(HARD, zero), true);
  assert.equal(killConverts(0, zero), false);
  assert.equal(typeof killConverts(NORMAL, zero), "boolean");
});
