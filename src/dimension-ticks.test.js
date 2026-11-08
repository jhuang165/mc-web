// Batch 27 (natural-spawning.md "Round 9"): WorldServer's chunk loop in the Nether and the End, in the resident window and in the
// headless ring. The terrain is a flat synthetic floor (the generators are not under test); the rules are the bytecode-read ones in
// dimension-ticks-reference.json.
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { World, WorldChunk, FIRE, LAVA, ICE, WATER, SNOW_LAYER } from "./world.js";
import { DimensionWorld } from "./dimension-world.js";
import { JavaRandom } from "./java-random.js";
import { HeadlessColumns, attachRing } from "./headless-columns.js";
import { Weather } from "./weather.js";
import { MoodSound } from "./cave-ambience.js";
import { Fire } from "./fire.js";
import { Fluids, tickRate } from "./fluids.js";
import { NetherLive } from "./nether-portal-live.js";
import { NETHER_WART, SOUL_SAND } from "./nether-wart.js";
import { PORTAL } from "./nether-portal.js";
import { NETHERRACK } from "./nether-blocks.js";
import { meltResult } from "./snow.js";
import { Survival } from "./survival.js";
import { ItemEntities } from "./item-entities.js";
import { ExperienceOrbs } from "./experience.js";
import { Farming } from "./farming.js";
import { Trees } from "./trees.js";
import { breakPlayerBlock } from "./block-break-simulation.js";

const NETHER = -1, END = 1, END_STONE = 152, BEDROCK = 11, STONE = 3, FLOOR_Y = 39;
const FLOOR = { [NETHER]: NETHERRACK, [END]: END_STONE };
const cache = new Map();
const flat = (dim) => (cx, cz) => {
  const k = `${dim}:${cx},${cz}`;
  let c = cache.get(k);
  if (!c) {
    const blocks = new Uint8Array(65536);
    for (let i = 0; i < 256; i++) for (let y = 0; y <= FLOOR_Y; y++) blocks[i * 256 + y] = FLOOR[dim];
    c = { blocks, metadata: new Uint8Array(65536) };
    cache.set(k, c);
  }
  return { blocks: c.blocks.slice(), metadata: c.metadata.slice() };
};
function window(dim) {
  const w = new DimensionWorld("17", dim);
  w.generateTerrainChunk = flat(dim);
  w.blockLight = () => 9;
  w.streamAround(4 * 16 + 8, 4 * 16 + 8);
  return w;
}
// The same area with a ring (chunks -6..14 held) or with every chunk resident.
function setup(dim, withRing) {
  const world = window(dim);
  const gen = flat(dim);
  const ring = new HeadlessColumns(world, { generate: gen, perTick: 1000, every: 1 });
  if (withRing) { ring.update(4, 4); attachRing(world, ring); } else {
    for (let cx = -6; cx <= 14; cx++) for (let cz = -6; cz <= 14; cz++) {
      if (world.chunkAt(cx, cz)) continue;
      const c = gen(cx, cz), chunk = new WorldChunk(cx, cz, 256);
      chunk.blocks.set(c.blocks); chunk.meta.set(c.metadata);
      world.chunks.set(`${cx},${cz}`, chunk);
    }
    world.minX = -96; world.maxX = 240; world.minZ = -96; world.maxZ = 240;
  }
  return { world, ring };
}
const CHUNKS = [[9, 2], [10, 5], [11, 3], [7, 7], [-3, 3], [12, 1], [3, -3], [-4, -2], [5, 11], [0, 12]];
const warm = (ring) => { for (let i = 0; i < 60; i++) ring.randomTickChunks(4, 4, 10); };
const REPLAY_STEPS = 400;

function replay(dim, withRing) {
  const realRandom = Math.random;
  const seed = new JavaRandom(4242);
  Math.random = () => seed.nextDouble();
  try {
    const { world, ring } = setup(dim, withRing);
    if (withRing) warm(ring);
    const reads = (on) => { if (withRing) world.ringReads = on; };
    const weather = new Weather({ random: new JavaRandom(5), lcg: 77 });
    weather.raining = true; weather.rain = 1; weather.thundering = true; weather.thunder = 1; // stale rain, as the shared Weather may hold
    weather.mood = new MoodSound(weather);
    weather.mood.countdown = 0; // the mood step draws in every chunk; nothing within 8 blocks of the (absent) player is ever heard
    const fire = new Fire(world, { weather: () => weather, stillLava: () => true });
    fire.watch(); fire.sharedRandomTicks = true;
    const nether = new NetherLive(world, { random: weather.random, difficulty: () => 3, pigman: () => { weather.pigmen = (weather.pigmen ?? 0) + 1; } });
    weather.blockTick = (x, y, z, b) => fire.randomTick(x, y, z, b) || nether.randomTick(x, y, z, b);
    const read = (x, y, z) => (withRing ? ring.get(x, y, z) : world.get(x, y, z));
    reads(true);
    const regions = [];
    const y0 = FLOOR_Y + 1;
    for (const [cx, cz] of CHUNKS) {
      const x = cx * 16 + 1, z = cz * 16 + 1;
      regions.push([cx * 16, y0 - 1, cz * 16]);
      world.set(x, y0 - 1, z, FLOOR[dim] === NETHERRACK ? NETHERRACK : BEDROCK, true, 0); // a fire base: netherrack, or bedrock
      fire.ignite(x, y0, z);
      world.set(x + 2, y0 - 1, z, STONE, true, 0); fire.ignite(x + 2, y0, z); // fire on a bare block: burns out
      world.set(x + 8, y0, z, LAVA, true, 0);
      for (let dx = 0; dx < 14; dx++) {
        for (let dz = 1; dz < 4; dz++) { world.set(x + dx, y0 - 1, z + dz, SOUL_SAND, true, 0); world.set(x + dx, y0, z + dz, NETHER_WART, true, 0); } // 42 warts
        world.set(x + dx, y0, z + 4, PORTAL, true, 1); // portal cells: BlockPortal.updateTick spawns nothing here
        for (let dz = 6; dz < 11; dz++) world.set(x + dx, y0, z + dz, WATER, true, 0); // a pool: no ice, no snow
        for (let dz = 12; dz < 14; dz++) world.set(x + dx, y0, z + dz, ICE, true, 0); // block light 9 melts it: air in the Nether, water in the End
      }
    }
    reads(false);
    const log = [];
    for (let tick = 0; tick < REPLAY_STEPS; tick++) {
      reads(true);
      try {
        fire.tick(0, 0);
        weather.mood.tick();
        weather.tickChunks(world, CHUNKS);
      } finally { reads(false); }
      log.push([weather.lcg, fire.time, world.edits.size, fire.queue.heap.length, weather.random.nextInt(1 << 20)]);
    }
    reads(true);
    const counts = { fire: 0, wartGrown: 0, ice: 0, water: 0, air: 0, snow: 0, bolts: weather.bolts.length, pigmen: weather.pigmen ?? 0, eternal: 0 };
    const blocks = regions.map(([x0, yy, z0]) => { const out = []; for (let x = x0; x < x0 + 16; x++) for (let y = yy; y < yy + 4; y++) for (let z = z0; z < z0 + 16; z++) out.push(read(x, y, z), withRing ? ring.getMeta(x, y, z) : world.getMeta(x, y, z)); return out; });
    for (const [cx, cz] of CHUNKS) {
      const x = cx * 16 + 1, z = cz * 16 + 1;
      if (read(x, y0, z) === FIRE) counts.eternal++;
      if (read(x + 2, y0, z) === FIRE) counts.fire++;
      for (let dx = 0; dx < 14; dx++) {
        for (let dz = 1; dz < 4; dz++) if (read(x + dx, y0, z + dz) === NETHER_WART && (withRing ? ring.getMeta(x + dx, y0, z + dz) : world.getMeta(x + dx, y0, z + dz)) > 0) counts.wartGrown++;
        for (let dz = 12; dz < 14; dz++) { const b = read(x + dx, y0, z + dz); if (b === ICE) counts.ice++; else if (b === WATER) counts.water++; else if (b === 0) counts.air++; }
      }
      for (let dx = 0; dx < 16; dx++) for (let dz = 0; dz < 16; dz++) for (let y = y0; y < y0 + 4; y++) if (read(cx * 16 + dx, y, cz * 16 + dz) === SNOW_LAYER) counts.snow++;
    }
    reads(false);
    return { log, blocks, counts, edits: [...world.edits].sort((a, b) => (a[0] < b[0] ? -1 : 1)), rands: [weather.lcg, String(weather.random.seed)], ring, world };
  } finally { Math.random = realRandom; }
}

for (const dim of [NETHER, END]) {
  test(`dimension ${dim}: ring chunks tick like an all-resident world over ${REPLAY_STEPS} ticks`, () => {
    const a = replay(dim, true), b = replay(dim, false);
    for (let i = 0; i < a.log.length; i++) assert.deepEqual(a.log[i], b.log[i], `tick ${i}`);
    assert.deepEqual(a.rands, b.rands);
    assert.deepEqual(a.edits, b.edits, "the same blocks changed in the same order");
    assert.deepEqual(a.blocks, b.blocks);
    assert.deepEqual(a.counts, b.counts);
    const c = a.counts;
    assert.equal(c.bolts, 0, "no biome of the Nether or the End can be struck");
    assert.equal(c.snow, 0, "rain never lays snow there");
    assert.equal(c.pigmen, 0, "BlockPortal.updateTick needs provider.isSurfaceWorld");
    assert.equal(c.eternal, CHUNKS.length, "fire over netherrack (Nether) or bedrock (End) never burns out");
    assert.ok(c.wartGrown > 0, `nether wart grew in ${c.wartGrown} spots`);
    assert.ok(c.fire < CHUNKS.length, `fire on a bare block burned out in some of ${CHUNKS.length} spots (${c.fire} left)`);
    // BlockIce.updateTick: water in the End, air in the Nether.
    assert.ok(c.ice > 0 && c.ice < CHUNKS.length * 28, `ice melted in some cells (${c.ice} of ${CHUNKS.length * 28} left)`);
    if (dim === NETHER) { assert.equal(c.water, 0); assert.ok(c.air > 0, "melted ice is air"); } else { assert.equal(c.air, 0); assert.ok(c.water > 0, "melted ice is water"); }
  });
}

test("the End keeps fire over netherrack and bedrock burning, the Nether does not treat bedrock that way", () => {
  const run = (dim, base) => {
    const world = window(dim), weather = new Weather({ random: new JavaRandom(3), lcg: 5 });
    const fire = new Fire(world, { weather: () => weather, stillLava: () => true });
    fire.watch(); fire.sharedRandomTicks = true;
    const x = 4 * 16 + 4, z = 4 * 16 + 4;
    world.set(x, FLOOR_Y, z, base, true, 0);
    fire.ignite(x, FLOOR_Y + 1, z);
    for (let t = 0; t < 600; t++) fire.tick(x, z);
    return world.get(x, FLOOR_Y + 1, z) === FIRE;
  };
  assert.equal(run(END, BEDROCK), true, "End: fire over bedrock");
  assert.equal(run(NETHER, BEDROCK), false, "Nether: bedrock is a bare block");
  assert.equal(run(END, STONE), false, "End: fire over stone burns out");
  assert.equal(run(NETHER, NETHERRACK), true);
  assert.equal(run(END, NETHERRACK), true, "netherrack in the End");
});

test("Weather.tickDimension draws as WorldServer.func_147456_g does with nothing to tick: 100000 roll, 1-in-16 ice step, no timers", () => {
  const world = window(NETHER);
  const weather = new Weather({ random: new JavaRandom(11), lcg: 9 });
  weather.rainTime = 5; weather.thunderTime = 5; weather.raining = false;
  const mirror = new JavaRandom(11);
  let lcg = 9;
  const chunks = [[1, 1], [2, 2], [3, 3], [4, 4]];
  for (let t = 0; t < 300; t++) {
    weather.tickChunks(world, chunks);
    for (let i = 0; i < chunks.length; i++) { mirror.nextInt(100000); if (mirror.nextInt(16) === 0) lcg = (Math.imul(lcg, 3) + 1013904223) | 0; }
  }
  assert.equal(weather.lcg, lcg, "the lcg stepped on exactly the chunks the 1-in-16 roll chose");
  assert.equal(weather.random.nextInt(1 << 30), mirror.nextInt(1 << 30), "and the shared Random drew in step");
  // tickDimension does not run the weather timers (World.updateWeatherBody skips provider.hasNoSky) and ticks the window chunks.
  const w2 = new Weather({ random: new JavaRandom(1), lcg: 1 });
  w2.rainTime = 5; w2.thunderTime = 5;
  for (let t = 0; t < 20; t++) w2.tickDimension(world, { x: 4 * 16 + 8, z: 4 * 16 + 8 });
  assert.equal(w2.rainTime, 5); assert.equal(w2.thunderTime, 5);
  assert.equal(w2.raining, false);
});

test("lava ticks every 10 in the Nether and the End (aqo.g) but the level step is 1 only in the Nether (aqo.f)", () => {
  assert.equal(tickRate(LAVA, true), 10); assert.equal(tickRate(LAVA, false), 30); assert.equal(tickRate(WATER, true), 5);
  const make = (nether, skyless) => { const w = window(NETHER); return new Fluids(w, { nether, skyless }); };
  assert.equal(make(true, true).skyless, true);
  assert.equal(make(false, true).nether, false, "End: step 2, rate 10");
  assert.equal(new Fluids(window(NETHER), { nether: true }).skyless, true, "the old nether flag keeps both");
  const scheduled = (nether, skyless) => {
    const w = window(NETHER), f = new Fluids(w, { nether, skyless });
    w.set(70, FLOOR_Y + 1, 70, LAVA, true, 0);
    f.schedule?.(70, FLOOR_Y + 1, 70, LAVA);
    return [...f.queue?.heap ?? []].map((e) => e.time);
  };
  const nether = scheduled(true, true), end = scheduled(false, true), over = scheduled(false, false);
  if (nether.length) { assert.equal(nether[0], 10); assert.equal(end[0], 10); assert.equal(over[0], 30); }
});

test("ice melts to air in the Nether and breaks to nothing", () => {
  assert.deepEqual(meltResult(ICE, 9), { block: WATER, meta: 0 });
  assert.deepEqual(meltResult(ICE, 9, true), { block: 0, meta: 0 });
  assert.equal(meltResult(ICE, 3, true), null);
  for (const [dim, expect] of [[NETHER, 0], [END, WATER]]) {
    const world = window(dim);
    world.set(70, FLOOR_Y + 1, 70, ICE, true, 0);
    const survival = new Survival({ slots: [] }, "survival");
    breakPlayerBlock({ world, survival, items: new ItemEntities(() => 0.5), xpOrbs: new ExperienceOrbs([], () => 0.5), farming: new Farming(world), trees: new Trees(world, { random: new JavaRandom(9) }), heldTool: 0 }, [70, FLOOR_Y + 1, 70]);
    assert.equal(world.get(70, FLOOR_Y + 1, 70), expect, `dimension ${dim}`);
  }
});

test("dimension ticks match the bytecode-read reference", async () => {
  const ref = JSON.parse(await readFile(new URL("../public/research/dimension-ticks-reference.json", import.meta.url), "utf8")).facts;
  assert.equal(ref.worldServerLoopReadsProvider, false);
  assert.equal(ref.weatherTimersSkippedWhen, "aqo.g (hasNoSky: Nether and End)");
  assert.deepEqual(ref.lavaTickRate, { water: 5, lavaWhereG: 10, lavaOtherwise: 30, field: "aqo.g" });
  assert.equal(ref.lavaLevelStepField, "aqo.f");
  assert.equal(ref.iceHellField, "aqo.f");
  assert.equal(ref.fireEndBedrock, true);
  assert.equal(ref.portalUpdateTickNeeds, "aqo.d() isSurfaceWorld");
  assert.equal(ref.moodIsServerSide, true);
  assert.equal(tickRate(LAVA, true), ref.lavaTickRate.lavaWhereG);
});
