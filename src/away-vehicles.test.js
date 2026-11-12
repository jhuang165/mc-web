// Batch 46: carts, boats, hanging entities and rockets tick in the away run's one entity walk, at their place in the list (away-entities.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { populationBlockMapperReady } from "./population-world.js";
import { runAway, stateColumns, awayPlan } from "./away-world.js";
import { EntityWorld } from "./entities.js";
import { World } from "./world.js";
import { Minecarts } from "./minecarts.js";
import { Boats } from "./boats.js";
import { Hanging } from "./hanging.js";
import { FireworkRockets } from "./fireworks-live.js";
import { JavaRandom } from "./java-random.js";

await populationBlockMapperReady;
const STONE = 3;
const floorChunks = (cols) => cols.map(([x, z]) => {
  const blocks = new Uint8Array(65536), meta = new Uint8Array(65536);
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 10; y++) blocks[(lx * 16 + lz) * 256 + y] = STONE;
  return { x, z, blocks, meta };
});
const base = { seed: "away", biome: "javaStreamed", worldType: "flat", worldSpawn: [0, 64, 0], player: { time: 6000 } };
const run = (root, ticks) => {
  const cols = stateColumns(root), plan = { ...awayPlan(root, cols, ticks, 2), chunks: floorChunks(cols), records: [] };
  return runAway(plan);
};
const maker = new EntityWorld(new World("away-vehicles", "meadow"), []);
const mob = (type, x, y, z, extra = {}) => Object.assign(maker.serializeOne(maker.create(type, x, y, z)), extra);

// Records the order of each entity's update by spying on the per-entity entry points the walk calls. The spied tick is a plain wrapper, so the run itself is unchanged.
async function recordOrder(root, ticks) {
  const log = [], saved = [];
  const spy = (proto, name, label) => {
    const orig = proto[name]; saved.push([proto, name, orig]);
    proto[name] = function (...a) { log.push(label(this, a)); return orig.apply(this, a); };
  };
  spy(EntityWorld.prototype, "turnBody", (_, [e]) => `mob:${e.type}`);
  spy(Minecarts.prototype, "tickOne", () => "cart");
  spy(Boats.prototype, "tickOne", () => "boat");
  spy(Hanging.prototype, "tickOne", () => "hanging");
  spy(FireworkRockets.prototype, "tickOne", () => "rocket");
  try { await run(root, ticks); } finally { for (const [proto, name, orig] of saved) proto[name] = orig; }
  return log;
}

test("batch 46: a mob, a cart, a boat, a hanging entity and a rocket update in one ordered pass each tick, the saved vehicles after the mobs in list order", async () => {
  const carts = new Minecarts(); carts.spawnEmpty({ x: 5.5, y: 11, z: 5.5 });
  const boats = new Boats(); boats.spawnBoat({ x: 7.5, y: 11, z: 5.5 });
  const hanging = new Hanging(); hanging.entities.push(hanging.make("frame", 0, 9, 12, 5, { item: { id: 4, count: 1, damage: 0 }, rotation: 0, dropChance: 1 }));
  const rockets = new FireworkRockets(new JavaRandom(1n)); rockets.launch(11.5, 14, 5.5, null); rockets.rockets[0].lifetime = 1000;
  const root = { ...base, entities: [mob("cow", 3.5, 11, 8.5, { id: "mob-1" })], minecarts: carts.toJSON(), boats: boats.toJSON(), hanging: hanging.toJSON(), rockets: rockets.serialize() };
  const log = await recordOrder(root, 6);
  const first = log.slice(0, 5);
  assert.deepEqual(first, ["mob:cow", "cart", "boat", "hanging", "rocket"], `one pass in list order (${log.slice(0, 12)})`);
  assert.deepEqual(log.slice(5, 10), first, "the second tick repeats it");
});

test("batch 46: a mob riding a cart updates right after its mount, not at its own place in the list", async () => {
  const carts = new Minecarts(); carts.spawnEmpty({ x: 5.5, y: 11, z: 5.5 });
  const saved = carts.toJSON(), id = saved.carts[0].id;
  const root = { ...base, minecarts: saved, entities: [mob("cow", 3.5, 11, 8.5, { id: "mob-1" }), mob("pig", 5.5, 11, 5.5, { id: "mob-2", riding: `cart-${id}` })] };
  const log = await recordOrder(root, 3);
  assert.deepEqual(log.slice(0, 3), ["mob:cow", "cart", "mob:pig"], `the rider follows its cart (${log.slice(0, 6)})`);
});

test("batch 46: a cart and a rocket outside the loaded rule stay as saved and do not tick", async () => {
  const carts = new Minecarts(); carts.spawnEmpty({ x: 905.5, y: 11, z: 5.5 }); carts.spawnEmpty({ x: 5.5, y: 11, z: 5.5 });
  const rockets = new FireworkRockets(new JavaRandom(1n)); rockets.launch(900.5, 14, 5.5, null); rockets.rockets[0].lifetime = 1000;
  const root = { ...base, minecarts: carts.toJSON(), rockets: rockets.serialize() };
  const log = await recordOrder(root, 5);
  assert.equal(log.filter((l) => l === "rocket").length, 0, "the far rocket never ticks");
  assert.equal(log.filter((l) => l === "cart").length, 5, "only the near cart ticks (once a tick)");
});

test("batch 46: a launched rocket reports its join to the walk, and a rocket spawned in the pass ticks in that pass after what is already listed", () => {
  const rockets = new FireworkRockets(new JavaRandom(1n)), joined = [];
  rockets.joined = (r) => joined.push(r);
  const r = rockets.launch(1.5, 12, 1.5, null);
  assert.deepEqual(joined, [r]);
  const world = new EntityWorld(new World("away-vehicles-join", "meadow"), []);
  const seen = [];
  world.walks = new Map([["rocket", { list: () => rockets.rockets, tick: (e) => seen.push(e), reap: () => rockets.reap() }]]);
  const cow = world.create("cow", 0.5, 11, 0.5); world.entities.push(cow);
  rockets.joined = (e) => world.joined(e, "rocket");
  const late = rockets.launch(2.5, 12, 2.5, null);
  assert.ok(world.orderSeqs.get(late) > world.orderSeqs.get(cow), "stamped after the mob that was in the list");
});
