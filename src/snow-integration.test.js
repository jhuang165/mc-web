import { test } from "node:test";
import assert from "node:assert/strict";
import { SNOW_LAYER, ICE, LADDER, CACTUS, RAIL, slipperiness } from "./world.js";
import { ITEMS, MATERIALS, Survival } from "./survival.js";
import { breakTicks, canHarvest, digSpeed } from "./mining.js";
import { blockSound } from "./audio.js";
import { CREATIVE_TABS, SEARCH_ORDER, itemTab } from "./creative.js";
import { blockTile, TILES } from "./block-textures.js";
import { ItemEntities } from "./item-entities.js";
import { snowballsFor, iceLeavesWater, stackedSnowMeta } from "./snow.js";

// Wooden tier tools; 312 is the snowball.
const shovel = Object.values(ITEMS).find((i) => i.kind === "shovel" && i.tier === 0), pickaxe = Object.values(ITEMS).find((i) => i.kind === "pickaxe" && i.tier === 0);

test("snow layer: hardness 0.1, harvested only with a shovel, drops meta + 1 snowballs", () => {
  assert.deepEqual([MATERIALS[SNOW_LAYER].hardness, MATERIALS[SNOW_LAYER].drop], [0.1, 312]);
  assert.equal(canHarvest(SNOW_LAYER, MATERIALS[SNOW_LAYER], null), false);
  assert.equal(canHarvest(SNOW_LAYER, MATERIALS[SNOW_LAYER], pickaxe), false);
  assert.equal(canHarvest(SNOW_LAYER, MATERIALS[SNOW_LAYER], shovel), true);
  assert.equal(digSpeed(SNOW_LAYER, shovel), shovel.speed);
  const p = new Survival({ inventory: { [shovel.id]: 1 } });
  assert.ok(p.mining(SNOW_LAYER, shovel.id).harvest);
  assert.ok(!p.mining(SNOW_LAYER, 0).harvest);
  assert.deepEqual([0, 1, 6, 7].map(snowballsFor), [1, 2, 7, 8]);
  assert.ok(breakTicks(p.mining(SNOW_LAYER, shovel.id)) < breakTicks(p.mining(SNOW_LAYER, 0)));
});

test("ice: hardness 0.5, no drop, a pickaxe is the effective tool, water stays only over solid or liquid", () => {
  assert.deepEqual([MATERIALS[ICE].hardness, MATERIALS[ICE].drop], [0.5, 0]);
  assert.equal(digSpeed(ICE, pickaxe), pickaxe.speed);
  assert.equal(digSpeed(ICE, shovel), 1);
  assert.equal(iceLeavesWater(3), true);
  assert.equal(iceLeavesWater(0), false);
  assert.equal(iceLeavesWater(10), true);
});

test("snow stacks one layer per click up to eight and stops at a full block", () => {
  assert.equal(stackedSnowMeta(0), 1);
  assert.equal(stackedSnowMeta(6), 7);
  assert.equal(stackedSnowMeta(7), null);
});

test("snow and ice are named block items with the original textures and sounds", () => {
  assert.equal(ITEMS[SNOW_LAYER].name, "Snow");
  assert.equal(ITEMS[ICE].name, "Ice");
  assert.equal(TILES[blockTile(SNOW_LAYER, 2)], "snow");
  assert.equal(TILES[blockTile(ICE, 2)], "ice");
  assert.equal(TILES[blockTile(1, 0, false, 0, true)], "grass_side_snowed");
  assert.equal(TILES[blockTile(1, 0)], "grass_side");
  assert.equal(TILES[blockTile(1, 2, false, 0, true)], "grass_top");
  assert.equal(blockSound(SNOW_LAYER), "snow");
  assert.equal(blockSound(23), "snow");
});

test("creative lists place snow and ice where the original tabs do", () => {
  assert.equal(itemTab(SNOW_LAYER).label, "decorations");
  assert.equal(itemTab(ICE).label, "buildingBlocks");
  const blocks = CREATIVE_TABS[0].items;
  assert.deepEqual(blocks.slice(blocks.indexOf(ICE) - 1, blocks.indexOf(ICE) + 2), [64, ICE, 23]);
  // The rail (66) sits between the ladder (65) and the snow layer (78).
  assert.deepEqual(SEARCH_ORDER.slice(SEARCH_ORDER.indexOf(SNOW_LAYER) - 2, SEARCH_ORDER.indexOf(SNOW_LAYER) + 4), [RAIL, 64, SNOW_LAYER, ICE, 23, CACTUS]);
});

test("a dropped item slides farther on ice (drag 0.98 * 0.98) than on stone (0.6 * 0.98)", () => {
  const run = (floor) => {
    const world = { get: (x, y, z) => (y < 10 && y >= 0 ? floor : 0), solid(x, y, z) { return this.get(x, y, z) !== 0; } };
    const items = new ItemEntities(() => 0.5), e = items.spawn({ id: 2, count: 1, damage: 0 }, 20.5, 10, 20.5, { motion: [0.2, 0, 0] });
    for (let i = 0; i < 40; i++) items.tick(world);
    return e.x - 20.5;
  };
  assert.ok(run(ICE) > run(3) * 3, `${run(ICE)} vs ${run(3)}`);
  assert.equal(Math.fround(slipperiness(ICE) * Math.fround(0.98)), Math.fround(Math.fround(0.98) * Math.fround(0.98)));
});
