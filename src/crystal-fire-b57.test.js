// Batch 57 crystalfire: the crystal copy's fire drawn on the predicted-cell overlay and reconciled with the real world.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createCrystalFireLayer, CRYSTAL_FIRE_TOKEN } from "./crystal-fire-layer.js";
import { createPrediction } from "./client-prediction.js";
import { MobTracker, ClientEntity } from "./entity-tracker.js";
import { CRYSTAL_FIRE } from "./ender-crystal.js";

function setup(isEnd = true) {
  const blocks = new Map(), world = { isEnd, get: (x, y, z) => blocks.get(`${x},${y},${z}`) ?? 0, getMeta: () => 0, put(x, y, z, b) { blocks.set(`${x},${y},${z}`, b); } };
  let pred = null; const shown = [];
  const scene = { showPredictedCells: (c) => shown.push(...c), updateBlock: (x, z, y) => shown.push({ real: [x, y, z] }) };
  const layer = createCrystalFireLayer({ world: () => world, layer: () => (pred ??= createPrediction(world)), seen: () => (pred ? pred.read() : world), scene: () => scene });
  const copy = new ClientEntity("ender_crystal"); copy.present = true; copy.x = 4.5; copy.y = 60; copy.z = -2.5;
  copy.crystalFire = (c) => layer.tick(c);
  return { world, layer, copy, shown, pred: () => pred };
}

test("the copy's tick draws fire on the overlay before the real world has it, and the real landing ends the entry", () => {
  const { world, copy, shown, pred } = setup();
  copy.step();
  assert.equal(pred().view.get(4, 60, -3), CRYSTAL_FIRE);
  assert.equal(world.get(4, 60, -3), 0, "the real world is untouched");
  assert.deepEqual(shown, [{ x: 4, y: 60, z: -3 }]);
  assert.equal(pred().cells.get("4,60,-3").token, CRYSTAL_FIRE_TOKEN);
  copy.step(); // already fire on the client view: nothing more is drawn
  assert.equal(shown.length, 1);
  world.put(4, 60, -3, CRYSTAL_FIRE); // the server's own change lands
  copy.step();
  assert.equal(pred().active, false);
});

test("when the client breaks the fire, the next copy tick lights the cell again", () => {
  const { world, copy, layer, shown, pred } = setup();
  world.put(4, 60, -3, CRYSTAL_FIRE);
  copy.step();
  assert.equal(shown.length, 0, "real fire already there: nothing to predict");
  const p = (pred() ?? (layer.set(0, 0, 0, 0), pred())); // create the overlay through the layer's host
  p.set(4, 60, -3, 0, 0, 7); // the client's predicted break of the fire
  assert.equal(p.read().get(4, 60, -3), 0);
  copy.step();
  assert.equal(p.view.get(4, 60, -3), CRYSTAL_FIRE, "the copy lights it again on the client view");
  assert.equal(p.cells.size, 0, "the real world holds fire: the break entry is dropped and the cell meshed from the real world");
  assert.deepEqual(shown.at(-1), { real: [4, 60, -3] });
  world.put(4, 60, -3, 0); // the real fire is gone (the server's break landed): the copy lights the cell on the client view again
  copy.step();
  assert.equal(p.cells.get("4,60,-3").token, CRYSTAL_FIRE_TOKEN);
});

test("a non-End layer draws nothing, and the tracker gives the hook to crystal copies only", () => {
  const { copy, shown } = setup(false);
  copy.step();
  assert.equal(shown.length, 0);
  const t = new MobTracker(); const hook = () => {};
  t.crystalFire = hook;
  assert.equal(t.newClient("ender_crystal").crystalFire, hook);
  assert.equal(t.newClient("pig").crystalFire, null);
});
