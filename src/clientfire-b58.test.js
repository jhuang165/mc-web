// Batch 58 clientfire: when the crystal copy's overlay fire ends, and the client-side BlockFire rules (bytecode-read from the unchanged 1.7.10 classes:
// WorldClient bjf.a(IIIIII) invalidateBlockReceiveRegion is an empty method, bjf.b() tick resets no block, only WorldServer mt calls Block.updateTick).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createCrystalFireLayer, CRYSTAL_FIRE_TOKEN } from "./crystal-fire-layer.js";
import { createPrediction } from "./client-prediction.js";
import { ClientEntity } from "./entity-tracker.js";
import { CRYSTAL_FIRE as ORIGINAL_FIRE } from "./ender-crystal.js";
import { portId } from "./ender-crystal-mobs.js";
const FIRE = portId(ORIGINAL_FIRE), BEDROCK = 7, STONE = 1;

function setup({ floor = BEDROCK } = {}) {
  const blocks = new Map(), unloaded = new Set();
  const world = { isEnd: true, get: (x, y, z) => blocks.get(`${x},${y},${z}`) ?? 0, getMeta: () => 0, put(x, y, z, b) { blocks.set(`${x},${y},${z}`, b); },
    isLoaded: (x, z) => !unloaded.has(`${Math.floor(x / 16)},${Math.floor(z / 16)}`) };
  world.put(4, 59, -3, floor);
  let pred = null; const shown = [];
  const scene = { showPredictedCells: (c) => shown.push(...c), updateBlock: (x, z, y) => shown.push({ real: [x, y, z] }) };
  const layer = createCrystalFireLayer({ world: () => world, layer: () => (pred ??= createPrediction(world)), seen: () => (pred ? pred.read() : world), scene: () => scene });
  const copy = new ClientEntity("ender_crystal"); copy.present = true; copy.x = 4.5; copy.y = 60; copy.z = -2.5;
  copy.crystalFire = (c) => layer.tick(c);
  return { world, layer, copy, shown, unloaded, pred: () => pred };
}

test("no timeout: the overlay fire stays through many ticks while the real cell is untouched", () => {
  const { copy, pred } = setup();
  for (let i = 0; i < 2000; i++) copy.step();
  assert.equal(pred().cells.get("4,60,-3").block, FIRE);
});

test("a server change to a different block replaces the client cell and ends the entry", () => {
  const { world, copy, pred, shown } = setup();
  copy.step();
  world.put(4, 60, -3, STONE); // S23 with a block that is not fire
  copy.step(); // drops the entry, then the copy sees stone (not fire) and lights it again: a fresh entry over the new base
  assert.equal(pred().cells.get("4,60,-3").block, FIRE);
  assert.ok(shown.some((s) => s.real?.join() === "4,60,-3"), "the cell was rebuilt from the real world when the S23 landed");
  world.put(4, 60, -3, 0); // another change lands: replaced again
  copy.step();
  assert.equal(pred().cells.get("4,60,-3").block, FIRE, "relit on the next copy tick, from the new base");
});

test("chunk data leaving the loaded set drops the entry without a mesh request", () => {
  const { copy, layer, pred, shown, unloaded } = setup();
  copy.step();
  unloaded.add("0,-1");
  const n = shown.length;
  layer.reconcile(); // drops (client chunk gone); the unloaded cell is not meshed by the layer
  assert.equal(pred().cells.size, 0);
  assert.equal(shown.length, n);
});

test("the client's BlockFire.onBlockAdded removes fire with no support: the client cell ends as air", () => {
  const { world, copy, pred } = setup({ floor: 0 });
  world.put(4, 60, -3, STONE); // the crystal's cell holds a block; setBlock(fire) replaces it, onBlockAdded then sets air
  copy.step();
  assert.equal(pred().view.get(4, 60, -3), 0);
  assert.equal(pred().cells.get("4,60,-3").token, CRYSTAL_FIRE_TOKEN);
});

test("a supported fire loses its entry shape when the support goes in the client view", () => {
  const { copy, pred } = setup();
  {
    copy.step();
    assert.equal(pred().view.get(4, 60, -3), FIRE);
    pred().set(4, 59, -3, 0, 0, 9); // the client breaks the bedrock below (predicted)
    copy.step(); // reconcile: onNeighborBlockChange removes the unsupported fire; the copy tick then lights it again and onBlockAdded removes it
    assert.equal(pred().view.get(4, 60, -3), 0);
  }
});

test("client world does no fire spread: no scheduled or random fire tick is modelled on the layer", () => {
  const { copy, pred } = setup();
  copy.step();
  for (let i = 0; i < 500; i++) copy.step();
  assert.deepEqual([...pred().cells.keys()], ["4,60,-3"], "only the crystal's own cell, no neighbour ever catches fire client side");
});
