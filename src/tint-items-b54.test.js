// Batch 54: item atlas tints. The native item colours are executed (leafcolor-reference.json, tag b53lc): the tall grass item is white for damage 0 (the dead shrub, icon "deadbush")
// and ColorizerGrass for grass and fern; ItemReed draws its own untinted items/reeds icon and the reed block (BlockReed) has no getRenderColor tint, so its block tile is not baked with the grass colour.
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { blockTile, TILES } from "./block-textures.js";
import { itemFromOriginal } from "./region-import.js";
import { REEDS } from "./world.js";
import { REEDS_ITEM } from "./plants.js";
import { ITEMS } from "./survival.js";

const ref = JSON.parse(await readFile(new URL("../public/research/leafcolor-reference.json", import.meta.url), "utf8"));
const src = await readFile(new URL("./block-textures.js", import.meta.url), "utf8");
const grassTiles = /const GRASS_TILES=\[([^\]]*)\]/.exec(src)[1].split(",").map((s) => s.replace(/'/g, ""));

test("the executed tall grass item colour: white for damage 0, grass colour for 1 and 2", () => {
  const tall = ref.records[0].items.find((i) => i.id === 31);
  assert.equal(tall.pass0[0], 0xffffff);
  assert.ok(tall.pass0.slice(1, 3).every((c) => c === ref.records[0].grass));
});

test("tall grass damage 0 stands for the dead shrub item, whose tile is the white deadbush, not the baked grass tile", () => {
  const shrub = itemFromOriginal(31, 0), grass = itemFromOriginal(31, 1), fern = itemFromOriginal(31, 2);
  assert.equal(TILES[blockTile(shrub.id, 2, false, shrub.damage)], "deadbush");
  assert.equal(TILES[blockTile(grass.id, 2, false, grass.damage)], "tallgrass");
  assert.equal(TILES[blockTile(fern.id, 2, false, fern.damage)], "fern");
  assert.ok(!grassTiles.includes("deadbush"));
  for (const t of ["tallgrass", "fern", "grass_top"]) assert.ok(grassTiles.includes(t), t + " keeps the grass colour");
});

test("sugar cane: the item is the untinted items/reeds icon and the reed block tile is not grass-baked in the item atlas", () => {
  assert.equal(ITEMS[REEDS_ITEM].texture, "reeds");
  assert.equal(itemFromOriginal(338, 0).id, REEDS_ITEM);
  assert.equal(TILES[blockTile(REEDS, 2)], "reeds");
  assert.ok(!grassTiles.includes("reeds"));
});
