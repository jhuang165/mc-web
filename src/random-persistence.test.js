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

test("weather, fluid and tree updates share one restored stream through interleaved reloads", async () => {
  const { Fluids } = await import("./fluids.js");
  const { Trees } = await import("./trees.js");
  const { Fire } = await import("./fire.js");
  const { importedRuntime } = await import("./world-import.js");
  const { LAVA, SAPLING, FIRE } = await import("./world.js");
  const LEAVES = 5;
  const makeWorld = edits => {
    const w = new World("shared-block-random");
    for (let x = 20; x < 52; x++) for (let z = 20; z < 52; z++)
      for (let y = 1; y < 64; y++) w.put(x, y, z, y < 10 ? 3 : y === 10 ? 1 : 0, 0, false);
    if (edits) w.restore(edits);
    return w;
  };
  const create = (w, payload) => {
    const weather = payload ? new Weather().restore(payload.weather).restoreSimulation(payload.worldRandom)
      : new Weather({ random: new JavaRandom(137), lcg: -97531 });
    const fizz = [], drops = [];
    const fluids = new Fluids(w, { random: weather.random, fizz: (...a) => fizz.push(a) });
    fluids.load(payload?.fluidTicks ?? { version: 1, time: 0, entries: [] });
    const trees = new Trees(w, { random: weather.random, light: () => 15, drop: (...a) => drops.push(a) }).watch();
    const fire = new Fire(w, { weather: () => weather });
    fire.watch();
    fire.sharedRandomTicks = true;
    fire.load(payload?.fireTicks ?? { version: 1, time: 0, entries: [] });
    weather.blockTick = (x, y, z, b) => fire.randomTick(x, y, z, b) || trees.randomTick(x, y, z, b);
    assert.equal(fluids.random, weather.random);
    assert.equal(trees.random, weather.random);
    assert.equal(fire.L.rand, weather.random);
    return { w, weather, fluids, trees, fire, fizz, drops };
  };
  const snapshot = r => json({ edits: [...r.w.edits], weather: r.weather.save(), worldRandom: r.weather.saveSimulation(),
    fluidTicks: r.fluids.save(), fireTicks: r.fire.save() });
  const reload = r => {
    const saved = snapshot(r), payload = importedRuntime(saved);
    const next = create(makeWorld(saved.edits), payload);
    assert.deepEqual(next.weather.saveSimulation(), payload.worldRandom, "constructors and queue loads consume no saved draws");
    return next;
  };
  const original = create(makeWorld());
  original.w.set(40, 11, 40, SAPLING);
  original.w.set(44, 11, 44, FIRE);
  original.fire.drain();
  let restored = reload(original), grew = false, lavaRandom = false, leafDrops = 0;
  const step = (r, tick) => {
    r.fizz.length = r.drops.length = 0;
    r.weather.updateWeather();
    // A controlled receding-lava cell exercises the random 30/120-tick delay.
    if (tick % 20 === 0) {
      r.w.put(24, 11, 24, LAVA, 1);
      r.w.put(25, 11, 24, LAVA, 3);
      const before = r.weather.random.seed;
      r.fluids.updateTick(24, 11, 24);
      lavaRandom ||= r.weather.random.seed !== before;
    }
    // Use real public block hooks; scheduled fluid/fire queues continue between inputs.
    r.fluids.tick();
    r.fire.tick();
    r.trees.randomTick(40, 11, 40, r.w.get(40, 11, 40));
    grew ||= r.w.get(40, 11, 40) === 4;
    r.w.put(46, 15, 46, LEAVES, 8);
    r.trees.randomTick(46, 15, 46, LEAVES);
    leafDrops += r.drops.length;
    for (const [cx, cz] of [[1, 1], [2, 2]]) r.weather.tickChunk(r.w, cx, cz);
    return { fizz: r.fizz, drops: r.drops };
  };
  for (let tick = 0; tick < 160; tick++) {
    if ([1, 19, 63, 100].includes(tick)) restored = reload(restored);
    assert.deepEqual(step(restored, tick), step(original, tick), `effects at ${tick}`);
    assert.deepEqual(restored.w.snapshot(), original.w.snapshot(), `blocks at ${tick}`);
    assert.deepEqual(restored.fluids.save(), original.fluids.save(), `fluid queue at ${tick}`);
    assert.deepEqual(restored.fire.save(), original.fire.save(), `fire queue at ${tick}`);
    assert.deepEqual(restored.weather.saveSimulation(), original.weather.saveSimulation(), `random state at ${tick}`);
  }
  assert.ok(grew, "sapling growth was exercised");
  assert.ok(lavaRandom, "lava slowdown consumed a shared draw");
  assert.ok(leafDrops > 0, "decaying leaves produced drops");
});

test("blast rays, drops, ore XP and chain fuses resume the shared weather stream after import", async () => {
  const { explodeBlocks } = await import("./explosion.js");
  const { importedRuntime } = await import("./world-import.js");
  const { TNT } = await import("./world.js");
  const make = payload => {
    const w = new World("blast-random-continuity");
    if (payload) w.restore(payload.edits);
    const weather = payload ? new Weather().restore(payload.weather).restoreSimulation(payload.worldRandom)
      : new Weather({ random: new JavaRandom(9876), lcg: -123 });
    return { w, weather };
  };
  const reload = r => {
    const data = json({ edits: [...r.w.edits], weather: r.weather.save(), worldRandom: r.weather.saveSimulation() });
    return make({ ...importedRuntime(data), edits: data.edits });
  };
  const original = make();
  let resumed = reload(original), drops = 0, xp = 0, chains = 0;
  const step = (r, tick) => {
    r.weather.updateWeather();
    // Real chunk sampling interleaves World.rand and updateLCG with blast draws.
    r.weather.tickChunk(r.w, 0, 0);
    const x = 32 + tick * 12, y = 55, z = 32;
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++)
      for (let dy = -3; dy <= 3; dy++) r.w.set(x + dx, y + dy, z + dz, 0);
    // Guaranteed close TNT and ores plus random-drop gravel/leaves and metadata wool.
    for (const [dx, dy, dz, id, meta] of [[0, 0, 0, TNT, 0], [1, 0, 0, 17, 0],
      [-1, 0, 0, 15, 0], [0, -1, 0, 25, 0], [0, 1, 0, 5, 0], [0, 0, 1, 8, 7]])
      r.w.set(x + dx, y + dy, z + dz, id, true, meta);
    const before = r.weather.random.save();
    const out = explodeBlocks(r.w, x + 0.5, y + 0.5, z + 0.5, 3, r.weather.random);
    assert.notDeepEqual(r.weather.random.save(), before, "blasts advance the saved world stream");
    for (const b of out.broken) r.w.set(b.x, b.y, b.z, 0);
    return out;
  };
  for (let tick = 0; tick < 6; tick++) {
    // Reload before and after separate blasts, retaining the accumulated edits.
    resumed = reload(resumed);
    const expected = step(original, tick), actual = step(resumed, tick);
    assert.deepEqual(actual, expected, `complete blast result ${tick}`);
    assert.deepEqual(resumed.w.snapshot(), original.w.snapshot());
    assert.deepEqual(resumed.weather.saveSimulation(), original.weather.saveSimulation());
    drops += actual.drops.length; xp += actual.xp.length; chains += actual.primed.length;
  }
  assert.ok(drops > 0, "item drop rolls and positions exercised");
  assert.ok(xp > 0, "ore XP rolls exercised");
  assert.equal(chains, 6, "chained TNT fuse rolls exercised on every reload");
});
