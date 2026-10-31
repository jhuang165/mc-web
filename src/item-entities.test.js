import { test } from "node:test";
import assert from "node:assert/strict";
import { ItemEntities } from "./item-entities.js";

// Stone below y = 10.
const world = {
  get: (x, y, z) => (y < 10 && y >= 0 ? 3 : 0),
  solid(x, y, z) {
    return this.get(x, y, z) !== 0;
  },
};
const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const dirt = (count = 1) => ({ id: 2, count, damage: 0 });

test("a broken block drops one entity per item inside the block with a 10-tick delay", () => {
  const items = new ItemEntities(seeded());
  items.dropBlock([dirt(3)], 4, 10, 4);
  assert.equal(items.items.length, 3);
  for (const e of items.items) {
    assert.equal(e.stack.count, 1);
    assert.equal(e.delay, 10);
    assert.equal(e.my, 0.2);
    assert.ok(e.x >= 4.15 && e.x <= 4.85 && e.z >= 4.15 && e.z <= 4.85);
    assert.ok(Math.abs(e.mx) <= 0.1 && Math.abs(e.mz) <= 0.1);
  }
});

test("items fall under 0.04 gravity, land on the block top and slow with 0.588 ground drag", () => {
  const items = new ItemEntities(seeded(7)),
    e = items.spawn(dirt(), 2.5, 12.125, 2.5, { motion: [0.1, 0, 0] });
  items.tick(world);
  assert.ok(Math.abs(e.my - (0 - 0.04) * 0.98) < 1e-6);
  for (let i = 0; i < 60; i++) items.tick(world);
  assert.equal(e.y, 10);
  assert.ok(e.onGround);
  assert.ok(Math.abs(e.mx) < 1e-6, "ground friction stops the item");
  assert.ok(e.x > 2.5 && e.x < 4);
});

test("nearby equal items merge into the larger stack, keeping the longer delay and younger age", () => {
  const items = new ItemEntities(seeded(3)),
    a = items.spawn(dirt(1), 2.5, 10.125, 2.5, { motion: [0, 0, 0], delay: 5 }),
    b = items.spawn(dirt(4), 2.8, 10.125, 2.5, { motion: [0, 0, 0] });
  a.age = 100;
  b.age = 300;
  for (let i = 0; i < 25; i++) items.tick(world);
  assert.equal(items.items.length, 1);
  assert.equal(items.items[0], b);
  assert.equal(b.stack.count, 5);
  assert.equal(b.age, 125);
  const c = items.spawn({ id: 3, count: 1 }, 2.5, 10.125, 2.5, { motion: [0, 0, 0] });
  for (let i = 0; i < 25; i++) items.tick(world);
  assert.equal(items.items.length, 2, "different items never merge");
  assert.ok(items.items.includes(c));
});

test("merging respects the stack limit", () => {
  const items = new ItemEntities(seeded(5));
  items.spawn(dirt(40), 2.5, 10.125, 2.5, { motion: [0, 0, 0] });
  items.spawn(dirt(30), 2.6, 10.125, 2.5, { motion: [0, 0, 0] });
  for (let i = 0; i < 25; i++) items.tick(world);
  assert.equal(items.items.length, 2);
});

test("pickup waits for the delay, uses the grown player box and leaves leftovers", () => {
  const items = new ItemEntities(seeded(9)),
    e = items.spawn(dirt(5), 3.4, 10.125, 2.5, { motion: [0, 0, 0], delay: 2 }),
    feet = { x: 2, y: 10, z: 2.5 };
  let room = 3;
  const add = (s) => {
    const n = Math.min(room, s.count);
    room -= n;
    s.count -= n;
    return n > 0;
  };
  assert.equal(items.collect(feet, 0.6, 1.8, add).length, 0, "delay still running");
  items.tick(world);
  items.tick(world);
  const picked = items.collect(feet, 0.6, 1.8, add);
  assert.equal(picked.length, 1);
  assert.equal(picked[0].count, 3);
  assert.equal(e.stack.count, 2);
  assert.equal(items.items.length, 1);
  assert.equal(items.collect({ x: 6, y: 10, z: 2.5 }, 0.6, 1.8, () => true).length, 0, "out of reach");
});

test("items despawn after 6,000 ticks and below y = -64", () => {
  const items = new ItemEntities(seeded(11)),
    e = items.spawn(dirt(), 2.5, 10.125, 2.5, { motion: [0, 0, 0] });
  e.age = 5999;
  items.tick(world);
  assert.equal(items.items.length, 0);
  const open = { get: () => 0, solid: () => false };
  items.spawn(dirt(), 2.5, -63, 2.5);
  for (let i = 0; i < 40; i++) items.tick(open);
  assert.equal(items.items.length, 0);
});

test("an item inside a solid block is pushed up out of it without collision", () => {
  const items = new ItemEntities(seeded(13)),
    e = items.spawn(dirt(), 2.5, 9.5, 2.5, { motion: [0, 0, 0] });
  items.tick(world);
  assert.ok(e.my > 0, "pushed upwards");
  for (let i = 0; i < 20; i++) items.tick(world);
  assert.ok(e.y >= 10 - 1e-9);
});

test("thrown items leave along the view with a 40-tick delay; death drops scatter", () => {
  const items = new ItemEntities(seeded(17)),
    t = items.dropPlayer(dirt(), { x: 0, y: 10, z: 0 }, 0, 0);
  assert.equal(t.delay, 40);
  assert.ok(Math.abs(t.y - (10 + 1.32 - 0.125)) < 1e-9);
  assert.ok(t.mz < -0.25, "yaw 0 looks towards -z");
  const d = items.dropPlayer(dirt(), { x: 0, y: 10, z: 0 }, 0, 0, true, true);
  assert.ok(Math.hypot(d.mx, d.mz) <= 0.5);
  assert.equal(d.my, 0.2);
  assert.ok(d.death);
});

test("saved items round-trip and pre-0.10 piles load as one entity per stack", () => {
  const items = new ItemEntities(seeded(19));
  items.spawn(dirt(7), 2.5, 10.125, 2.5, { motion: [0, 0, 0] }).age = 50;
  const saved = JSON.parse(JSON.stringify(items.serialize())),
    loaded = new ItemEntities();
  loaded.load(saved, (s) => s);
  assert.equal(loaded.items.length, 1);
  assert.equal(loaded.items[0].stack.count, 7);
  assert.equal(loaded.items[0].age, 50);
  loaded.load([{ position: { x: 1, y: 10, z: 1 }, stacks: [dirt(3), { id: 3, count: 2 }], expires: 7000, death: true }], (s) => s, 2000);
  assert.equal(loaded.items.length, 2);
  assert.equal(loaded.items[0].age, 1000);
  assert.ok(loaded.items.every((e) => e.death && e.y === 10));
});
