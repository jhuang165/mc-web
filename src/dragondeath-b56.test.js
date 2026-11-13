// Batch 56 dragon death track: the crystal copy's End fire rule on a client block layer, and its tracker hook.
import { test } from "node:test";
import assert from "node:assert/strict";
import { clientCrystalFire } from "./ender-crystal-mobs.js";
import { CRYSTAL_FIRE } from "./ender-crystal.js";
import { ClientEntity } from "./entity-tracker.js";

const layerOf = (isEnd) => {
  const cells = new Map(), writes = [];
  return { cells, writes, isEnd, get: (x, y, z) => cells.get(`${x},${y},${z}`) ?? 0, set: (x, y, z, id) => { cells.set(`${x},${y},${z}`, id); writes.push([x, y, z, id]); } };
};

test("the crystal copy sets fire in its own cell on the client layer, in the End only, once (wz.h has no isRemote guard, bytecode-read)", () => {
  const copy = { x: -3.5, y: 64, z: 7.25 };
  const end = layerOf(true);
  assert.equal(clientCrystalFire(copy, end), true);
  assert.deepEqual(end.writes, [[-4, 64, 7, CRYSTAL_FIRE]]);
  assert.equal(clientCrystalFire(copy, end), false);
  assert.equal(end.writes.length, 1);
  const other = layerOf(false);
  assert.equal(clientCrystalFire(copy, other), false);
  assert.equal(other.writes.length, 0);
});

test("ClientEntity ticks a crystal copy's hook after innerRotation, and does nothing without one", () => {
  const c = new ClientEntity("ender_crystal");
  c.present = true; c.x = 1.5; c.y = 70; c.z = 2.5;
  c.step();
  assert.equal(c.innerRotation, 1);
  const layer = layerOf(true);
  c.crystalFire = (copy) => clientCrystalFire(copy, layer);
  c.step();
  assert.equal(c.innerRotation, 2);
  assert.deepEqual(layer.writes, [[1, 70, 2, CRYSTAL_FIRE]]);
});
