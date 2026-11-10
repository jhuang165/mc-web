import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BLOCKS, FENCE, blockBounds, collisionBounds, collisionBoxes, selectionBounds, collides, opaqueCube, normalCube, solidBlock } from "./world.js";
import { fenceConnectsTo, fenceMask, fenceCollisionBoxes, fenceBounds, fenceRenderBoxes } from "./fences.js";
import { toOriginal, fromOriginal } from "./block-registry.js";
import { lightOpacity } from "./lighting.js";
import { MATERIALS, ITEMS, RECIPES, FUELS } from "./survival.js";
import { CREATIVE_TABS } from "./creative.js";
import { digSpeed } from "./mining.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/fence-rail-reference.json", import.meta.url)));
const records = (c) => ref.records.filter((r) => r.case === c);
const facts = (block) => records("facts").find((r) => r.block === block);
const byOriginal = new Map(records("block").map((r) => [r.id, r]));

// A cell map with a fence at the origin and stone where the mask asks (bit 0 z-1, 1 z+1, 2 x-1, 3 x+1).
function grid(cells = {}) {
  const map = new Map(Object.entries(cells));
  return { get: (x, y, z) => map.get(`${x},${y},${z}`) ?? 0, getMeta: () => 0, solid(x, y, z) { return solidBlock(this.get(x, y, z)); } };
}
function fenceWorld(mask, neighbour = 3) {
  const cells = { "0,0,0": FENCE };
  if (mask & 1) cells["0,0,-1"] = neighbour;
  if (mask & 2) cells["0,0,1"] = neighbour;
  if (mask & 4) cells["-1,0,0"] = neighbour;
  if (mask & 8) cells["1,0,0"] = neighbour;
  return grid(cells);
}

test("fence block facts match BlockFence", () => {
  const f = facts("fence");
  assert.equal(BLOCKS[FENCE].name, "Fence");
  assert.deepEqual(toOriginal(FENCE, 0), [85, 0]);
  assert.deepEqual(fromOriginal(85, 0), { id: FENCE, meta: 0, exact: true });
  assert.equal(f.opacity, 0);
  assert.equal(lightOpacity(FENCE), f.opacity);
  assert.equal(opaqueCube(FENCE), f.opaque);
  assert.equal(normalCube(FENCE), f.normalCube);
  assert.equal(MATERIALS[FENCE].hardness, f.hardness);
  assert.equal(MATERIALS[FENCE].drop ?? FENCE, fromOriginal(f.drop).id);
  assert.equal(f.requiresTool, false);
  assert.equal(digSpeed(FENCE, { kind: "axe", speed: 2 }), 2, "an axe is effective (Material.wood)");
  assert.equal(digSpeed(FENCE, { kind: "pickaxe", speed: 2 }), 1);
  assert.equal(FUELS[FENCE], 300);
  assert.equal(ITEMS[FENCE].stack ?? 64, 64);
});

test("canConnectFenceTo agrees with the original for every port block", () => {
  for (let id = 1; id < BLOCKS.length; id++) {
    if (BLOCKS[id].reserved) continue;
    const [mc, meta] = toOriginal(id, 0);
    const r = byOriginal.get(mc);
    assert.ok(r, `${BLOCKS[id].name} -> ${mc}`);
    assert.equal(fenceConnectsTo(id), !!(r.fence & (1 << meta)), `${BLOCKS[id].name} (${mc}:${meta})`);
  }
  assert.equal(fenceConnectsTo(0), false);
});

test("collision boxes, bounds and selection follow addCollisionBoxesToList and setBlockBoundsBasedOnState", () => {
  for (const r of records("fence")) {
    const w = fenceWorld(r.mask);
    assert.equal(fenceMask(w, 0, 0, 0), r.mask);
    assert.deepEqual(fenceCollisionBoxes(r.mask), r.collision, `mask ${r.mask}`);
    assert.deepEqual(collisionBoxes(w, 0, 0, 0), r.collision);
    assert.deepEqual(fenceBounds(r.mask), r.bounds);
    assert.deepEqual(blockBounds(w, 0, 0, 0), r.bounds);
    assert.deepEqual(selectionBounds(w, 0, 0, 0), r.selection);
    // One-box callers get the union of the arms, 1.5 high.
    const u = collisionBounds(w, 0, 0, 0);
    assert.deepEqual(u, [r.bounds[0], 0, r.bounds[2], r.bounds[3], 1.5, r.bounds[5]]);
  }
  // A neighbouring fence connects; a torch or air does not.
  assert.equal(fenceMask(fenceWorld(15, FENCE), 0, 0, 0), 15);
  assert.equal(fenceMask(fenceWorld(15, 20), 0, 0, 0), 0);
});

test("a fence blocks the player 1.5 blocks up, including from the cell above it", () => {
  const w = grid({ "5,10,5": FENCE });
  // Overlapping the post at y 11.4 (above the fence cell) still collides; 11.5 is clear.
  assert.equal(collides(w, 5.5, 11.4, 5.5), true);
  assert.equal(collides(w, 5.5, 11.5, 5.5), false);
  // Beside the post on an unconnected side: the 0.6-wide player clears 0.625 at x 5.925+.
  assert.equal(collides(w, 6.1, 10, 5.5), false);
  assert.equal(collides(w, 5.8, 10, 5.5), true);
  // A two-arm corner (north and east) blocks its arms but not the open south-west quarter.
  const corner = grid({ "5,10,5": FENCE, "5,10,4": 3, "6,10,5": 3 });
  assert.deepEqual(collisionBoxes(corner, 5, 10, 5), [[0.375, 0, 0, 0.625, 1.5, 0.625], [0.375, 0, 0.375, 1, 1.5, 0.625]]);
  assert.equal(collides(corner, 5.5, 10.6, 5.1), true);
  assert.equal(collides(corner, 5.05, 10.6, 5.95), false);
});

test("RenderBlocks.renderBlockFence: a post with bars towards each connected side", () => {
  assert.deepEqual(fenceRenderBoxes(0), [[0.375, 0, 0.375, 0.625, 1, 0.625], [0.4375, 0.75, 0.4375, 0.5625, 0.9375, 0.5625], [0.4375, 0.375, 0.4375, 0.5625, 0.5625, 0.5625]]); // nothing connects: blm.a still draws the two x bars at the post (render-types.test.js)
  const ew = fenceRenderBoxes(4 | 8);
  assert.equal(ew.length, 3);
  assert.deepEqual(ew[1], [0, 0.75, 0.4375, 1, 0.9375, 0.5625]);
  assert.deepEqual(ew[2], [0, 0.375, 0.4375, 1, 0.5625, 0.5625]);
  const ns = fenceRenderBoxes(1);
  assert.deepEqual(ns[1], [0.4375, 0.75, 0, 0.5625, 0.9375, 0.5625]);
  assert.equal(fenceRenderBoxes(15).length, 5);
});

test("6 sticks craft 2 fences; the fence is a Creative decoration", () => {
  const recipe = RECIPES.find((r) => r.output === FENCE);
  assert.ok(recipe);
  assert.deepEqual([recipe.width, recipe.height, recipe.count], [3, 2, 2]);
  assert.deepEqual(recipe.pattern, Array(6).fill(300));
  assert.ok(CREATIVE_TABS[1].items.includes(FENCE));
});
