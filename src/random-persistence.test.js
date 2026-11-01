// Port regression checks for browser random-state snapshots; native behavior
// replays remain in weather.test.js, fire.test.js and the original probes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { JavaRandom } from "./lighting.js";
import { Weather } from "./weather.js";
import { World } from "./world.js";

const json = value => JSON.parse(JSON.stringify(value));

test("JavaRandom resumes mixed draws exactly, including a cached Gaussian and zero seed", () => {
  for (const seed of [0, 7, -1, 281474976710655n]) for (const cached of [false, true]) {
    const original = new JavaRandom(seed);
    original.nextInt(100000);
    if (cached) original.nextGaussian();
    const restored = new JavaRandom(99);
    assert.equal(restored.restore(json(original.save())), true);
    for (let i = 0; i < 40; i++) {
      const draw = r => [r.nextInt(), r.nextInt(1073741825), r.nextFloat(), r.nextDouble(), r.nextGaussian()];
      assert.deepEqual(draw(restored), draw(original));
      assert.deepEqual(restored.save(), original.save());
    }
  }
  const zero = new JavaRandom(1);
  assert.equal(zero.restore({ version: 1, seed: "0", gaussian: null }), true);
  assert.equal(zero.seed, 0n);
});

test("invalid random snapshots leave the existing stream and Gaussian cache untouched", () => {
  const random = new JavaRandom(7);
  random.nextGaussian();
  const saved = random.save();
  for (const data of [undefined, null, {}, { ...saved, version: 2 },
    ...[0, "-1", "1.5", "01", "281474976710656", "9".repeat(1000)].map(seed => ({ ...saved, seed })),
    ...[undefined, Infinity, NaN, "1", true].map(gaussian => ({ ...saved, gaussian }))]) {
    assert.equal(random.restore(data), false);
    assert.deepEqual(random.save(), saved);
  }
});

test("world random and block-tick LCG continue across reloads, including timer rolls", () => {
  const world = new World("random-continuity"), original = new Weather({ random: new JavaRandom(7), lcg: -1234567 });
  // Force sampling all sections, independently of the terrain's sparse refcounts.
  world.sectionTickCount = () => 1;
  const makeRestore = current => new Weather().restore(json(current.save())).restoreSimulation(json(current.saveSimulation()));
  let restored = makeRestore(original), sampled = 0;
  for (let tick = 0; tick < 300; tick++) {
    if (tick === 17 || tick === 119) restored = makeRestore(restored);
    if (tick % 25 === 0) original.rainTime = restored.rainTime = original.thunderTime = restored.thunderTime = 0;
    const run = weather => {
      const cells = [];
      weather.blockTick = (x, y, z, b) => { cells.push([x, y, z, b, weather.random.nextInt(7)]); return true; };
      weather.updateWeather();
      for (const [cx, cz] of [[1, 1], [2, 1], [1, 2]]) weather.tickChunk(world, cx, cz);
      sampled += cells.length;
      return cells;
    };
    assert.deepEqual(run(restored), run(original), `random tick calls at ${tick}`);
    assert.deepEqual(restored.save(), original.save());
    assert.deepEqual(restored.saveSimulation(), original.saveSimulation());
  }
  assert.ok(sampled > 0, "randomly ticking cells were visited");
});

test("invalid or missing world-random envelopes retain legacy startup state atomically", () => {
  const weather = new Weather({ random: new JavaRandom(7), lcg: 123 });
  const saved = weather.saveSimulation(), other = new JavaRandom(99).save();
  for (const data of [undefined, null, {}, { ...saved, version: 2 },
    ...[undefined, 1.5, -2147483649, 2147483648, "7"].map(lcg => ({ version: 1, random: other, lcg })),
    { version: 1, random: { version: 1, seed: "bad", gaussian: null }, lcg: 456 }]) {
    assert.equal(weather.restoreSimulation(data), weather);
    assert.deepEqual(weather.saveSimulation(), saved);
  }
});
