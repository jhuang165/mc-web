import { test } from "node:test";
import assert from "node:assert/strict";
import { World, WATER, LAVA, FIRE, SAND, GRAVEL } from "./world.js";
import { Fluids } from "./fluids.js";
import { Fire } from "./fire.js";
import { Weather } from "./weather.js";
import { FallingBlocks } from "./falling.js";
import { JavaRandom } from "./lighting.js";

const json = (value) => JSON.parse(JSON.stringify(value));
function world() {
  const w = new World("tick-save");
  for (let x = 20; x < 36; x++) for (let z = 20; z < 36; z++)
    for (let y = 1; y < 64; y++) w.set(x, y, z, y <= 10 ? 3 : 0, false);
  return w;
}
function copy(w) {
  const next = world();
  // Include the same edits that the browser save path uses.
  next.restore(json([...w.edits]));
  return next;
}
function fire(w) {
  const weather = new Weather({ random: new JavaRandom(7), lcg: 99 });
  const runtime = new Fire(w, { weather: () => weather });
  runtime.sharedRandomTicks = true;
  return { runtime, weather };
}

test("water resumes at its remaining delay and matches uninterrupted flow after a JSON round trip", () => {
  const w = world(), original = new Fluids(w);
  w.set(26, 11, 26, WATER);
  for (let i = 0; i < 3; i++) original.tick();
  const restoredWorld = copy(w), restored = new Fluids(restoredWorld);
  restored.load(json(original.save()));
  assert.equal(restored.save().entries[0].delay, 2);
  for (let i = 0; i < 40; i++) {
    assert.deepEqual(restored.tick(), original.tick(), `flow at tick ${i}`);
    assert.deepEqual(restored.save(), original.save(), `pending work at tick ${i}`);
  }
  assert.deepEqual(restoredWorld.data, w.data);
  assert.deepEqual(restoredWorld.meta, w.meta);
});

test("water and lava keep distinct block identities, stale entries, duplicate suppression and equal-time order", () => {
  const w = world(), original = new Fluids(w);
  w.put(26, 11, 26, WATER, 0);
  original.schedule(26, 11, 26, 12);
  w.put(26, 11, 26, LAVA, 0);
  original.schedule(26, 11, 26, 12);
  w.put(27, 11, 26, WATER, 0);
  original.schedule(27, 11, 26, 12);
  for (let i = 0; i < 9; i++) original.tick();
  const next = new Fluids(copy(w));
  next.load(json(original.save()));
  assert.deepEqual(next.save(), original.save());
  next.schedule(26, 11, 26, 1);
  assert.equal(next.pending.size, 3, "the existing lava deadline wins");
  const visited = [];
  next.updateTick = (x, y, z) => visited.push([x, y, z, next.world.get(x, y, z)]);
  next.tick(); next.tick();
  assert.deepEqual(visited, []);
  next.tick();
  assert.deepEqual(visited, [[26, 11, 26, LAVA], [27, 11, 26, WATER]], "stale water is skipped without changing tie order");
});

test("fire keeps its remaining delay without drawing a replacement wake delay", () => {
  const w = world(), { runtime: original, weather } = fire(w);
  original.watch();
  original.ignite(26, 11, 26);
  original.drain();
  for (let i = 0; i < 17; i++) original.tick();
  const { runtime: restored, weather: restoredWeather } = fire(copy(w));
  restored.watch();
  restoredWeather.restoreSimulation(json(weather.saveSimulation()));
  const seed = restoredWeather.random.seed;
  restored.load(json(original.save()));
  assert.equal(restoredWeather.random.seed, seed, "load consumes no world random draws");
  assert.deepEqual(restored.save(), original.save());
  for (let i = 0; i < 80; i++) {
    assert.deepEqual(restored.tick(), original.tick());
    assert.deepEqual(restored.save(), original.save());
    assert.deepEqual(restoredWeather.saveSimulation(), weather.saveSimulation());
  }
  assert.deepEqual(restored.world.data, w.data);
  assert.deepEqual(restored.world.meta, w.meta);
});

test("explicit empty queues keep settled blocks asleep; missing and unsupported data use legacy wake", () => {
  const w = world();
  w.put(26, 11, 26, WATER, 0);
  w.put(28, 11, 26, FIRE, 0);
  for (const runtime of [new Fluids(w), fire(w).runtime]) {
    runtime.load({ version: 1, time: 30, entries: [] });
    assert.equal(runtime.save().entries.length, 0);
    runtime.load(undefined);
    assert.ok(runtime.save().entries.length > 0);
    runtime.load({ version: 2, time: 30, entries: [] });
    assert.ok(runtime.save().entries.length > 0);
  }
});

test("malformed tick entries are skipped, and overdue work retains order", () => {
  const w = world(), fl = new Fluids(w);
  w.put(26, 11, 26, WATER, 0);
  const valid = { x: 26, y: 11, z: 26, block: WATER, delay: -2 };
  fl.load({ version: 1, time: 100, entries: [
    null, { ...valid, x: -1 }, { ...valid, y: 1.5 }, { ...valid, block: FIRE },
    { ...valid, delay: Infinity }, { ...valid, delay: Number.MAX_SAFE_INTEGER }, valid,
    { ...valid, delay: 50 },
  ] });
  assert.deepEqual(fl.save().entries, [valid]);
  const seen = [];
  fl.updateTick = (...xyz) => seen.push(xyz);
  fl.tick();
  assert.deepEqual(seen, [[26, 11, 26]]);
});


test("falling columns retain one-tick deadlines and active entities across repeated reloads", () => {
  const w = world(), original = new FallingBlocks(w).watch();
  w.set(26, 19, 26, SAND, true, 1);
  w.set(26, 20, 26, GRAVEL);
  w.set(26, 21, 26, SAND);
  original.tick();
  assert.equal(original.save().entries[0].delay, 1);
  let restored = new FallingBlocks(copy(w), {}, json(original.serialize())).watch();
  restored.load(json(original.save()));
  for (let i = 0; i < 50; i++) {
    // Reload while a mixture of entities and pending column updates exists.
    if (i === 2 || i === 5) {
      const next = new FallingBlocks(copy(restored.world), {}, json(restored.serialize())).watch();
      next.load(json(restored.save()));
      restored = next;
    }
    original.tick(); restored.tick();
    assert.deepEqual(restored.serialize(), original.serialize(), `entities at tick ${i}`);
    assert.deepEqual(restored.save(), original.save(), `pending work at tick ${i}`);
    assert.deepEqual(restored.world.data, w.data, `blocks at tick ${i}`);
    assert.deepEqual(restored.world.meta, w.meta, `metadata at tick ${i}`);
  }
  assert.deepEqual([11, 12, 13].map(y => w.get(26, y, 26)), [SAND, GRAVEL, SAND]);
  assert.equal(w.getMeta(26, 11, 26), 1);
});

test("falling queues keep stale identities, duplicate suppression and equal-time order", () => {
  const w = world(), original = new FallingBlocks(w);
  w.put(26, 19, 26, SAND, 0);
  original.schedule(26, 19, 26);
  w.put(26, 19, 26, GRAVEL, 0);
  original.schedule(26, 19, 26);
  w.put(27, 19, 26, SAND, 0);
  original.schedule(27, 19, 26);
  original.tick();
  const restored = new FallingBlocks(copy(w));
  restored.load(json(original.save()));
  restored.schedule(26, 19, 26);
  assert.deepEqual(restored.save(), original.save(), "repeat request keeps the earlier deadline");
  const visited = [];
  restored.fall = (x, y, z) => visited.push([x, y, z, restored.world.get(x, y, z)]);
  restored.tick();
  assert.deepEqual(visited, [[26, 19, 26, GRAVEL], [27, 19, 26, SAND]]);
});

test("falling queues validate imports, order overdue work and preserve explicit empty queues", () => {
  const w = world(), falling = new FallingBlocks(w);
  w.set(26, 19, 26, SAND);
  for (const data of [undefined, { version: 2, time: 20, entries: [] }, { version: 1, time: -1, entries: [] }]) {
    falling.pending.clear();
    falling.load(data);
    assert.ok(falling.pending.size > 0, "legacy or unsupported envelopes wake edited blocks");
  }
  falling.load({ version: 1, time: 20, entries: [] });
  falling.tick(); falling.tick();
  assert.equal(w.get(26, 19, 26), SAND, "an explicit empty queue stays asleep");
  assert.equal(falling.pending.size, 0);
  w.set(27, 19, 26, GRAVEL);
  const entry = { x: 26, y: 19, z: 26, block: SAND, delay: -2 };
  falling.load({ version: 1, time: 100, entries: [
    null, { ...entry, x: -1 }, { ...entry, y: 1.5 }, { ...entry, block: WATER },
    { ...entry, delay: Infinity }, { ...entry, delay: Number.MAX_SAFE_INTEGER },
    entry, { ...entry, delay: -10 },
    { x: 27, y: 19, z: 26, block: GRAVEL, delay: -3 },
  ] });
  assert.deepEqual(falling.save().entries, [
    { x: 27, y: 19, z: 26, block: GRAVEL, delay: -3 }, entry,
  ], "first duplicate wins; earliest deadline runs first");
  const visited = [];
  falling.fall = (x, y, z) => visited.push([x, y, z]);
  falling.tick();
  assert.deepEqual(visited, [[27, 19, 26], [26, 19, 26]]);
});
