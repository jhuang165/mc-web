// Batch 47: the away run's thrown balls target the carts, boats and hanging entities as the live ones do (away-entities.js walkHooks, entity-simulation.js vehicleTargets).
import { test } from "node:test";
import assert from "node:assert/strict";
import { populationBlockMapperReady } from "./population-world.js";
import { runAway, stateColumns, awayPlan } from "./away-world.js";
import { Minecarts } from "./minecarts.js";
import { Boats } from "./boats.js";
import { Hanging } from "./hanging.js";

await populationBlockMapperReady;
const STONE = 3;
const floorChunks = (cols) => cols.map(([x, z]) => {
  const blocks = new Uint8Array(65536), meta = new Uint8Array(65536);
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 10; y++) blocks[(lx * 16 + lz) * 256 + y] = STONE;
  return { x, z, blocks, meta };
});
const base = { seed: "away", biome: "javaStreamed", worldType: "flat", worldSpawn: [0, 64, 0], player: { time: 6000 } };
const run = async (root, ticks) => {
  const cols = stateColumns(root), plan = { ...awayPlan(root, cols, ticks, 2), chunks: floorChunks(cols), records: [] };
  // the LCG 4501 stub of away-mobs.test.js: Entity.rand seeds draw Math.random
  const real = Math.random; let s = 4501;
  Math.random = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  try { return await runAway(plan); } finally { Math.random = real; }
};
// A ball flying fast and level at 0.5 blocks over the floor from x = 1.5 towards +x.
const ball = (kind, y = 11.5) => ({ x: 1.5, y, z: 5.5, mx: 1, my: 0, mz: 0, yaw: 0, pitch: 0, ...(kind ? { kind } : {}) });
const count = (r) => r.entities?.projectiles?.length ?? 0;

test("batch 47: a snowball in the away run stops at a cart, which wobbles and keeps its place", async () => {
  const carts = new Minecarts(); carts.spawnEmpty({ x: 5.5, y: 11, z: 5.5 });
  const hit = await run({ ...base, minecarts: carts.toJSON(), projectiles: [ball()] }, 5);
  const miss = await run({ ...base, projectiles: [ball()] }, 5);
  assert.equal(count(miss), 1, "control: with nothing there the ball flies on");
  assert.equal(count(hit), 0, "the cart took the ball");
  assert.equal(hit.entities.minecarts.carts.length, 1, "no damage (thrown damage 0): the cart is not broken");
});

test("batch 47: an egg and a snowball stop at a boat; a ball over the boat's height does not", async () => {
  const boats = new Boats(); boats.spawnBoat({ x: 5.5, y: 11, z: 5.5 });
  for (const kind of ["egg", undefined]) {
    const hit = await run({ ...base, boats: boats.toJSON(), projectiles: [ball(kind)] }, 5);
    assert.equal(count(hit), 0, `${kind ?? "snowball"} stopped by the boat`);
    assert.equal(hit.entities.boats.length, 1, "the boat stays");
  }
  const over = await run({ ...base, boats: boats.toJSON(), projectiles: [ball(undefined, 14)] }, 5);
  assert.equal(count(over), 1, "a ball passing above the box flies on");
});

test("batch 47: a snowball knocks the item out of a frame in the away run", async () => {
  const h = new Hanging(); h.entities.push(h.make("frame", 0, 5, 11, 5, { item: { id: 4, count: 1, damage: 0 }, rotation: 0, dropChance: 1 }));
  const shot = [{ x: 5.5, y: 11.5, z: 1.5, mx: 0, my: 0, mz: 1, yaw: 0, pitch: 0 }];
  assert.equal(count(await run({ ...base, projectiles: shot }, 5)), 1, "control: nothing there, the ball flies on");
  const hit = await run({ ...base, hanging: h.toJSON(), projectiles: shot }, 5);
  assert.equal(count(hit), 0, "the frame took the ball");
  assert.equal(hit.entities.hanging.length, 1, "a frame with an item loses only the item (EntityItemFrame.attackEntityFrom)");
  assert.equal(hit.entities.drops.length, 1, "the item joined the list at once");
});
