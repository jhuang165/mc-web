import { test } from "node:test";
import assert from "node:assert/strict";
import { World, WATER, LAVA, FIRE } from "./world.js";
import { Fluids } from "./fluids.js";
import { Fire } from "./fire.js";
import { Weather } from "./weather.js";
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
  // This isolates scheduling from the still-incomplete world RNG persistence.
  restoredWeather.random.seed = weather.random.seed;
  const seed = restoredWeather.random.seed;
  restored.load(json(original.save()));
  assert.equal(restoredWeather.random.seed, seed, "load consumes no world random draws");
  assert.deepEqual(restored.save(), original.save());
  for (let i = 0; i < 80; i++) {
    assert.deepEqual(restored.tick(), original.tick());
    assert.deepEqual(restored.save(), original.save());
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
