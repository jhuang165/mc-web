// World.canPlaceEntityOnSide / ItemBlock.onItemUse target rules: placement only writes into a replaceable cell, and
// clicking vines, tall grass or a dead bush places into the clicked cell. Native flags: public/research/replaceable-reference.json.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { placeHeldBlock, placementReplaceable } from "./block-placement-simulation.js";
import { World, BLOCKS, TORCH, TALL_GRASS, VINE, DEAD_BUSH, FERN, RAIL, YELLOW_FLOWER, RED_FLOWER } from "./world.js";
import { Survival, ITEMS } from "./survival.js";
import { toOriginal } from "./block-registry.js";

const reference = JSON.parse(readFileSync(new URL("../public/research/replaceable-reference.json", import.meta.url)));
const LEAVES = 5, STONE = 1;
const stateFor = (world, survival) => ({ world, survival, position: { x: 0.5, y: 40, z: 0.5 }, flowers: { yellow: YELLOW_FLOWER, red: RED_FLOWER }, yaw: 0, farming: { observe() {} } });
const fresh = (name) => {
  const world = new World(name, "meadow", 1), survival = new Survival();
  for (let x = 8; x < 16; x++) for (let y = 18; y < 26; y++) for (let z = 8; z < 16; z++) world.set(x, y, z, 0);
  return { world, survival };
};
const place = (world, survival, id, block, adjacent, count = 4) => {
  survival.inventory.setStack(0, { id, count, damage: 0 });
  return placeHeldBlock(stateFor(world, survival), { id, item: ITEMS[id], target: { block, adjacent } }, { collides: () => false });
};

test("port replaceability matches Material.isReplaceable of the original block for every internal block", () => {
  assert.equal(reference.blocks, 171);
  assert.deepEqual(reference.replaceable, [0, 8, 9, 10, 11, 31, 32, 51, 78, 106]);
  const native = new Set(reference.replaceable);
  let checked = 0;
  for (let id = 0; id < BLOCKS.length; id++) {
    const mc = toOriginal(id, 0);
    if (!mc) continue;
    assert.equal(placementReplaceable(id), native.has(mc[0]), `internal ${id} (${BLOCKS[id]?.name}) -> original ${mc[0]}`);
    checked++;
  }
  assert.ok(checked >= 139, `${checked} internal blocks checked`);
});

test("a torch the ray passed through is not overwritten: the placement fails and keeps the item", () => {
  const { world, survival } = fresh("replace-torch");
  const leaf = [10, 20, 10], cell = [10, 21, 10];
  world.set(...leaf, LEAVES, true, 4);
  world.set(11, 21, 10, STONE);
  world.set(...cell, TORCH, true, 2); // a wall torch on the stone beside the cell above the leaves
  for (const id of [TORCH, STONE]) {
    const out = place(world, survival, id, leaf, cell);
    assert.equal(out.placed, false, `item ${id}`);
    assert.equal(out.reason, "occupied");
    assert.equal(survival.count(id), 4, "the item is kept");
    assert.equal(world.get(...cell), TORCH);
    assert.equal(world.getMeta(...cell), 2);
  }
  world.set(...cell, RAIL, true, 0);
  assert.equal(place(world, survival, STONE, leaf, cell).reason, "occupied");
  assert.equal(world.get(...cell), RAIL);
});

test("torches stay refused on leaves (no solid top) and keep their count", () => {
  const { world, survival } = fresh("replace-leaves");
  const leaf = [12, 20, 12];
  world.set(...leaf, LEAVES, true, 4);
  const out = place(world, survival, TORCH, leaf, [12, 21, 12]);
  assert.equal(out.reason, "torch-support");
  assert.equal(survival.count(TORCH), 4);
  assert.equal(world.get(12, 21, 12), 0);
});

test("clicking tall grass, a fern, vines or a dead bush places into the clicked cell", () => {
  for (const plant of [TALL_GRASS, FERN, DEAD_BUSH, VINE]) {
    const { world, survival } = fresh("replace-plant-" + plant);
    const cell = [10, 21, 10];
    world.set(10, 20, 10, plant === DEAD_BUSH ? 12 : 2);
    world.set(...cell, plant, true, plant === VINE ? 1 : 0);
    const out = place(world, survival, STONE, cell, [10, 22, 10]);
    assert.equal(out.placed, true, `plant ${plant}`);
    assert.deepEqual(out.position, cell);
    assert.equal(world.get(...cell), STONE);
    assert.equal(world.get(10, 22, 10), 0);
    assert.equal(survival.count(STONE), 3);
  }
});

test("a torch placed by clicking tall grass keeps the clicked face: a floor torch on the block below", () => {
  const { world, survival } = fresh("replace-torch-grass");
  const cell = [10, 21, 10];
  world.set(10, 20, 10, 2);
  world.set(...cell, TALL_GRASS);
  const out = place(world, survival, TORCH, cell, [10, 22, 10]);
  assert.equal(out.placed, true);
  assert.deepEqual(out.position, cell);
  assert.equal(world.get(...cell), TORCH);
});
