import { test } from "node:test";
import assert from "node:assert/strict";
import { World, PHYSICS, fallingVelocity, raycast, collides } from "./world.js";
test("terrain is deterministic and seeds produce different worlds", () => {
  const a = new World("a"),
    b = new World("a"),
    c = new World("b");
  assert.deepEqual(a.snapshot(), b.snapshot());
  assert.notDeepEqual(a.snapshot().data, c.snapshot().data);
  assert.equal(a.edits.size, 0);
});
test("edits survive save / restore, the y 0 floor included", () => {
  const a = new World("save");
  a.set(20, 50, 20, 8);
  a.set(21, 20, 20, 0);
  // Only Survival mining refuses bedrock (main.js); a Creative player can open the floor onto the void.
  assert.equal(a.get(20, 0, 20), 11);
  assert.equal(a.set(20, 0, 20, 0), true);
  assert.equal(a.get(20, -1, 20), 0);
  const b = new World("save");
  b.restore([...a.edits]);
  assert.deepEqual(a.snapshot(), b.snapshot());
  assert.throws(() => b.restore([["1,2,3", 900]]));
});
test("ray selection finds a block and correct placement neighbor", () => {
  const a = new World("ray");
  for (let x = 10; x < 20; x++) a.set(x, 60, 10, 0);
  a.set(15, 60, 10, 3);
  const hit = raycast(a, { x: 10.5, y: 60.5, z: 10.5 }, { x: 1, y: 0, z: 0 });
  assert.deepEqual(hit.block, [15, 60, 10]);
  assert.deepEqual(hit.adjacent, [14, 60, 10]);
  assert.equal(
    raycast(a, { x: 10.5, y: 60.5, z: 10.5 }, { x: 1, y: 0, z: 0 }, 3),
    null,
  );
});
test("player has collision-free spawn and cannot stand inside blocks", () => {
  const w = new World("Overworld"),
    p = w.spawn();
  assert.equal(collides(w, p.x, p.y, p.z), false);
  assert.equal(collides(w, p.x, p.y - 0.1, p.z), true);
});
test("recovered 20 Hz vertical recurrence produces a vanilla-height jump", () => {
  let y = 0,
    v = PHYSICS.jump,
    max = 0;
  for (let i = 0; i < 20; i++) {
    y += v;
    max = Math.max(max, y);
    v = fallingVelocity(v);
  }
  assert.ok(Math.abs(max - 1.2522) < 0.001);
  assert.ok(y < 0);
  assert.equal(PHYSICS.tick, 0.05);
});
test("a spawn column dug through the floor is skipped", () => {
  const w = new World("8675309", "java", 9);
  assert.equal(w.height, 256);
  const s = w.spawn(), x = Math.floor(s.x), z = Math.floor(s.z);
  for (let y = w.height - 1; y >= 0; y--) w.set(x, y, z, 0);
  const t = w.spawn();
  assert.notDeepEqual([Math.floor(t.x), Math.floor(t.z)], [x, z]);
  assert.ok(w.solid(Math.floor(t.x), Math.floor(t.y) - 1, Math.floor(t.z)));
});
