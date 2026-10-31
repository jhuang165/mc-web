import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, LAVA, WATER, isLiquid } from "./world.js";
import { Fluids, LAVA_TICK_RATE, NETHER_LAVA_TICK_RATE, TICK_RATE, tickRate, inLava, entityLavaBox, viewpointBlock, liquidHeight } from "./fluids.js";
import { JavaRandom, lightEmission, lightOpacity, fogColor } from "./lighting.js";
import { LAVA_SCENARIOS, replay, compare } from "../tools/fluid-scenarios.mjs";
import { ItemEntities } from "./item-entities.js";
import { EntityWorld, moveEntityWithHeading } from "./entities.js";
import { Survival } from "./survival.js";

const STONE = 3, COBBLESTONE = 12, OBSIDIAN = 22, X0 = 20, Z0 = 20, FLOOR = 10;
function arena(options) {
  const w = new World("lava");
  for (let x = X0; x < X0 + 40; x++)
    for (let z = Z0; z < Z0 + 40; z++) for (let y = 1; y < 30; y++) w.set(x, y, z, y <= FLOOR ? STONE : 0, false);
  const fizzes = [];
  return { w, fl: new Fluids(w, { fizz: (...a) => fizzes.push(a), ...options }), fizzes };
}
const run = (fl, n) => {
  const out = [];
  for (let i = 0; i < n; i++) out.push(...fl.tick());
  return out;
};

// public/research/lava-reference.json holds what the unchanged BlockDynamicLiquid,
// BlockStaticLiquid and BlockLiquid did in each scenario (tools/verify-fluids.mjs):
// the grid after every tick, the pending tick count, the flow vectors, every
// random.fizz with its pitch, and the world Random's state after the run.
const reference = JSON.parse(readFileSync(new URL("../public/research/lava-reference.json", import.meta.url)));
test("the lava reference scenarios are the ones this build replays", () => {
  assert.equal(reference.scenarios.length, LAVA_SCENARIOS.length);
  reference.scenarios.forEach((r, i) =>
    assert.deepEqual({ ...LAVA_SCENARIOS[i] }, { name: r.name, dims: r.dims, ticks: r.ticks, grid: r.grid, events: r.events, ...(r.rseed ? { rseed: r.rseed, nether: r.nether } : {}) }));
});
for (const r of reference.scenarios)
  test(`lava matches the original classes tick for tick: ${r.name}`, () => {
    compare(r, { hashes: r.hashes, grid: r.final, pending: r.pending, flows: r.flows, fizz: r.fizz, rng: r.rng }, replay(r), reference.percent);
  });
test("the reference covers lava spreading, lava on water and the Nether", () => {
  assert.equal(reference.scenarios.reduce((n, r) => n + r.hashes.length, 0), 5900);
  assert.ok(reference.scenarios.reduce((n, r) => n + r.fizz.length, 0) > 1000);
  assert.deepEqual(reference.blocks, { water: [0, 3, false], lava: [15, 0, false] });
  assert.ok(reference.scenarios.some((r) => r.nether));
});

test("lava ticks every 30 ticks (10 in the Nether) and drops 2 levels per block", () => {
  assert.equal(tickRate(LAVA), LAVA_TICK_RATE);
  assert.equal(LAVA_TICK_RATE, 30);
  assert.equal(NETHER_LAVA_TICK_RATE, 10);
  assert.equal(tickRate(WATER), TICK_RATE);
  const { w, fl } = arena();
  w.set(40, 11, 40, LAVA);
  run(fl, 29);
  assert.equal(w.get(41, 11, 40), 0);
  run(fl, 1);
  // The first spread lands at level 2; flowing lava keeps its level in metadata.
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    assert.equal(w.get(40 + dx, 11, 40 + dz), LAVA);
    assert.equal(w.getMeta(40 + dx, 11, 40 + dz), 2);
  }
  run(fl, 4000);
  // Level 6 is the last cell that can still spread; level 8 would be gone.
  for (const [d, level] of [[1, 2], [2, 4], [3, 6]]) assert.equal(w.getMeta(40 + d, 11, 40), level);
  assert.equal(w.get(44, 11, 40), 0);
});
test("the Nether spreads by 1 level every 10 ticks", () => {
  const { w, fl } = arena({ nether: true });
  w.set(40, 11, 40, LAVA);
  run(fl, 10);
  assert.equal(w.getMeta(41, 11, 40), 1);
  run(fl, 1000);
  assert.equal(w.getMeta(47, 11, 40), 7);
});
test("lava makes no infinite sources, however many sources surround a cell", () => {
  const { w, fl } = arena();
  for (const x of [38, 40, 42]) w.set(x, 11, 40, LAVA);
  run(fl, 6000);
  assert.equal(w.get(39, 11, 40), LAVA);
  assert.notEqual(w.getMeta(39, 11, 40), 0);
  assert.notEqual(w.getMeta(41, 11, 40), 0);
});
test("water next to lava: a source makes obsidian, flowing lava makes cobblestone, with a fizz", () => {
  const a = arena();
  a.w.set(40, 11, 40, LAVA);
  a.w.set(41, 11, 40, WATER);
  a.fl.added(41, 11, 40);
  run(a.fl, 400);
  assert.equal(a.w.get(40, 11, 40), OBSIDIAN);
  assert.ok(a.fizzes.length >= 1);
  const [x, y, z, pitch] = a.fizzes[0];
  assert.deepEqual([x, y, z], [40.5, 11.5, 40.5]);
  assert.ok(pitch >= 2.6 - 0.8 && pitch <= 2.6 + 0.8);

  const b = arena();
  b.w.set(40, 11, 40, LAVA);
  run(b.fl, 30);
  assert.equal(b.w.getMeta(41, 11, 40), 2);
  b.w.set(42, 11, 40, WATER);
  b.fl.added(42, 11, 40);
  run(b.fl, 120);
  assert.equal(b.w.get(41, 11, 40), COBBLESTONE);
});
test("lava above water turns the water's cell to stone with a fizz", () => {
  const { w, fl, fizzes } = arena();
  w.set(40, 11, 40, WATER);
  w.set(40, 12, 40, LAVA);
  fl.added(40, 11, 40);
  run(fl, 31);
  assert.equal(w.get(40, 11, 40), STONE);
  assert.ok(fizzes.length >= 1);
});
test("water never flows into lava", () => {
  const { w, fl } = arena();
  w.set(40, 11, 40, LAVA);
  w.set(44, 11, 40, WATER);
  for (const x of [40, 44]) fl.added(x, 11, 40);
  run(fl, 2000);
  // Water reaching a lava cell hardens it instead of replacing it.
  assert.notEqual(w.get(40, 11, 40), WATER);
});

test("JavaRandom.nextInt matches java.util.Random", () => {
  assert.equal(new JavaRandom(0).nextInt(), -1155484576);
  const r = new JavaRandom(42);
  assert.deepEqual([r.nextInt(100), r.nextInt(100)], [30, 63]);
  assert.equal(new JavaRandom(42).nextInt(16), 11);
  assert.equal(new JavaRandom(42).nextInt(10), 0);
  assert.throws(() => new JavaRandom(1).nextInt(0));
});

test("lava emits light 15 and lets light through like water's neighbours (opacity 0), unlike water (3)", () => {
  assert.equal(lightEmission(LAVA), 15);
  assert.equal(lightOpacity(LAVA), 0);
  assert.equal(lightOpacity(WATER), 3);
  assert.equal(lightEmission(WATER), 0);
  assert.ok(isLiquid(LAVA) && isLiquid(WATER) && !isLiquid(STONE));
});
test("lava fog is (0.6, 0.1, 0) scaled by the fog brightness", () => {
  const base = { angle: 0.25, temperature: 0.8, look: [0, 0, 1], chunks: 10 };
  assert.deepEqual(fogColor({ ...base, lava: true }), [Math.fround(0.6), Math.fround(0.1), 0]);
  const half = fogColor({ ...base, lava: true, brightness: 0.5 });
  assert.equal(half[0], Math.fround(Math.fround(0.6) * 0.5));
});

test("handleLavaMovement uses the box shrunk by (0.1, 0.4, 0.1)", () => {
  const { w } = arena();
  w.set(40, 12, 40, LAVA);
  const box = (x, y, z) => [x - 0.3, y, z - 0.3, x + 0.3, y + 1.8, z + 0.3];
  assert.deepEqual(entityLavaBox([0, 0, 0, 1, 1.8, 1]).map((v) => Math.fround(v)), [0.1, 0.4, 0.1, 0.9, 1.4, 0.9].map((v) => Math.fround(v)));
  assert.ok(inLava(w, box(40.5, 11, 40.5)));
  // Feet just under the cell: the 0.4 trim leaves only the head's cell below y 13.4.
  assert.ok(!inLava(w, box(40.5, 8, 40.5)));
  assert.ok(!inLava(w, box(42.5, 11, 42.5)));
  assert.ok(!inLava(w, box(40.5, 13.7, 40.5)));
});
test("the viewpoint block is lava until the eye passes the surface", () => {
  const { w } = arena();
  w.set(40, 11, 40, LAVA);
  assert.equal(viewpointBlock(w, 40.5, 11.5, 40.5), LAVA);
  // A source is treated as full: the eye stays in the cell until it leaves it.
  assert.equal(viewpointBlock(w, 40.5, 11.99, 40.5), LAVA);
  assert.equal(viewpointBlock(w, 40.5, 12.1, 40.5), 0);
  assert.ok(liquidHeight(w, 40, 11, 40, LAVA) < 1);
});

test("an item in lava is thrown up with a fizz, burns and dies on the second tick", () => {
  const { w } = arena();
  w.set(40, 11, 40, LAVA);
  const items = new ItemEntities(() => 0.5);
  items.spawn({ id: 3, count: 1, damage: 0 }, 40.5, 11.5, 40.5, { motion: [0, 0, 0] });
  const e = items.items[0];
  assert.equal(e.health, 5);
  // The lava check of EntityItem.onUpdate runs when the item changes cell or on every 25th tick.
  e.ticks = 24;
  items.tick(w);
  assert.equal(e.health, 1);
  assert.equal(e.fire, 300);
  assert.equal(items.sounds.length, 1);
  assert.equal(items.sounds[0].name, "random.fizz");
  assert.equal(items.sounds[0].volume, 0.4);
  assert.ok(e.my > 0.1);
  items.tick(w);
  assert.equal(items.items.length, 0);
});
test("an item that escapes the lava still burns to death within 20 ticks, and water puts it out", () => {
  const { w } = arena();
  items: {
    const items = new ItemEntities(() => 0.5);
    items.spawn({ id: 3, count: 1, damage: 0 }, 40.5, 11.5, 40.5, { motion: [0, 0, 0] });
    const e = items.items[0];
    items.hurt(e, 4);
    e.fire = 300;
    for (let i = 0; i < 2; i++) items.tick(w);
    assert.equal(items.items.length, 0);
  }
  const wet = arena();
  wet.w.set(40, 11, 40, WATER);
  const items = new ItemEntities(() => 0.5);
  items.spawn({ id: 3, count: 1, damage: 0 }, 40.5, 11.5, 40.5, { motion: [0, 0, 0] });
  items.items[0].fire = 100;
  items.tick(wet.w);
  assert.equal(items.items[0].fire, 0);
});

test("the player: lava deals 4 (armour applies) then fire 1 per second, and water extinguishes", () => {
  const s = new Survival({ time: 0, slots: [] }, "survival");
  s.tick({ inLava: true });
  assert.equal(s.health, 16);
  assert.equal(s.fire, 300);
  assert.equal(s.lastDamage, "lava");
  // Standing in lava again within the hurt-resistance window changes nothing.
  s.tick({ inLava: true });
  assert.equal(s.health, 16);
  for (let i = 0; i < 9; i++) s.tick({});
  // Still in lava on the second tick, which sets the fire back to 300 before the 9 idle ticks.
  assert.equal(s.fire, 291);
  // fire is a multiple of 20 at 300, 280, ...: one damage point on the 20th tick after each
  let health = s.health;
  for (let i = 0; i < 200; i++) s.tick({});
  assert.ok(s.health < health);
  s.tick({ inWater: true });
  assert.equal(s.fire, 0);
  const c = new Survival({ time: 0, slots: [] }, "creative");
  c.tick({ inLava: true });
  assert.equal(c.health, 20);
});

test("a mob in lava is damaged 4, burns for 15 s, sinks slowly and swims up", () => {
  const { w } = arena();
  for (let x = 38; x <= 42; x++) for (let z = 38; z <= 42; z++) for (let y = 11; y <= 14; y++) w.set(x, y, z, LAVA);
  const world = new EntityWorld(w, [{ id: "mob-1", type: "pig", x: 40.5, y: 11, z: 40.5, health: 10 }]), e = world.entities[0];
  world.tick({ x: 40.5, y: 11, z: 90 }, new Survival());
  assert.equal(e.inLava, true);
  assert.equal(e.health, 6);
  assert.equal(e.fire, 300);
  assert.equal(e.burn, 1);
  for (let i = 0; i < 60; i++) world.tick({ x: 40.5, y: 11, z: 90 }, new Survival());
  assert.ok(e.health <= 0 || e.death);
});
test("moveEntityWithHeading in lava accelerates 0.02, drags x0.5 and sinks 0.02", () => {
  const { w } = arena();
  for (let y = 11; y <= 15; y++) for (let x = 36; x <= 44; x++) for (let z = 36; z <= 44; z++) w.set(x, y, z, LAVA);
  const e = { x: 40.5, y: 12, z: 40.5, vx: 0, vy: 0, vz: 0, rotationYaw: 0, onGround: false, collidedH: false, inWater: false, inLava: true, fallDistance: 0, aiMoveSpeed: 0.25 };
  moveEntityWithHeading(w, e, 0.9, 0.9, 1);
  assert.ok(Math.abs(e.vz - 0.01) < 1e-6);
  assert.ok(Math.abs(e.vy + 0.02) < 1e-9);
  assert.ok(Math.abs(e.z - 40.5 - 0.02) < 1e-6);
});
