// Batch 26 (natural-spawning.md "Round 8"): random block ticks and fire scheduled ticks in the headless ring, the ring's chunk rules,
// and the World.chunkAt miss cache. The replay ticks the same ring chunks in a ring-backed streamed world and in the same area with
// every chunk resident (the native rule: the chunk itself is all a random tick needs), and the edits and generators must match.
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { World, WorldChunk, FIRE, LAVA, SAPLING, CACTUS, SAND } from "./world.js";
import { JavaRandom } from "./java-random.js";
import { HeadlessColumns, attachRing } from "./headless-columns.js";
import { Weather, randomTickReach } from "./weather.js";
import { Trees } from "./trees.js";
import { Fire } from "./fire.js";
import { Plants } from "./plants.js";
import { ringRandomActive, ringBlockTickActive } from "./streaming-ticks.js";
import { wrapRandomTickLight } from "./headless-env.js";

const GRASS = 1, DIRT = 2, STONE = 3, LOG = 4, LEAVES = 5;
const silence = (w) => { w.blockLight = () => 0; return w; };
const cache = new Map();

// A ring-backed world (ring held over chunks -6..14 around player chunk 4, 4) or the same area all resident.
function setup(withRing) {
  const world = silence(new World("17", "javaStreamed", 12));
  const column = (cx, cz) => { const k = `${cx},${cz}`; return cache.get(k) ?? (cache.set(k, world.chunkAt(cx, cz) ? { blocks: world.chunkAt(cx, cz).blocks, metadata: world.chunkAt(cx, cz).meta } : world.generateTerrainChunk(cx, cz)), cache.get(k)); };
  const ring = new HeadlessColumns(world, { generate: column, perTick: 1000, every: 1 });
  if (withRing) { ring.update(4, 4); attachRing(world, ring); } else {
    for (let cx = -6; cx <= 14; cx++) for (let cz = -6; cz <= 14; cz++) {
      if (world.chunkAt(cx, cz)) continue;
      const c = column(cx, cz), chunk = new WorldChunk(cx, cz, 256);
      chunk.blocks.set(c.blocks); chunk.meta.set(c.metadata);
      world.chunks.set(`${cx},${cz}`, chunk);
    }
    world.minX = -96; world.maxX = 240; world.minZ = -96; world.maxZ = 240;
  }
  return { world, ring };
}

// Chunks outside the resident ticking window (chunks 1..6 here) that have every neighbour held: the ring chunks and the halo.
const CHUNKS = [[9, 2], [10, 5], [11, 3], [7, 7], [-3, 3], [12, 1], [3, -3], [-4, -2], [5, 11], [0, 12]];
// The refcounts of held columns are built a few columns a call; calls until every column takes part.
const warm = (ring) => { let list; for (let i = 0; i < 60; i++) list = ring.randomTickChunks(4, 4, 10); return list; };
const REPLAY_STEPS = 500;

function replay(withRing) {
  const realRandom = Math.random;
  let seed = new JavaRandom(4242);
  Math.random = () => seed.nextDouble();
  try {
    const { world, ring } = setup(withRing);
    const reads = (on) => { if (withRing) world.ringReads = on; };
    const weather = new Weather({ random: new JavaRandom(5), lcg: 77 });
    weather.raining = true; weather.rain = 1;
    const fire = new Fire(world, { weather: () => weather, stillLava: () => true });
    fire.watch();
    const trees = new Trees(world, { random: new JavaRandom(9), lcg: 31337, light: () => 15 }).watch();
    const plants = new Plants(world).watch();
    weather.blockTick = (x, y, z, b) => fire.randomTick(x, y, z, b) || trees.randomTick(x, y, z, b) || plants.randomTick(x, y, z, b);
    fire.sharedRandomTicks = true;
    const read = (x, y, z) => (withRing ? ring.get(x, y, z) : world.get(x, y, z));
    const surface = (x, z) => { let y = 200; while (y > 0 && !read(x, y, z)) y--; return y + 1; };
    reads(true);
    const regions = [];
    for (const [cx, cz] of CHUNKS) {
      const x = cx * 16 + 1, z = cz * 16 + 1, y0 = surface(x + 6, z + 6) + 2;
      regions.push([cx * 16, y0 - 4, cz * 16]);
      for (let dx = 0; dx < 15; dx++) for (let dz = 0; dz < 15; dz++) world.set(cx * 16 + dx, y0 - 1, cz * 16 + dz, dz < 5 && dx > 8 ? SAND : GRASS, true, 0);
      // leaves around a log that is then broken: the leaves are marked and decay on random ticks
      for (let dx = 0; dx < 5; dx++) for (let dz = 0; dz < 5; dz++) for (let dy = 0; dy < 3; dy++) world.set(x + dx, y0 + dy, z + dz, LEAVES, true, 0);
      world.set(x + 2, y0, z + 2, LOG, true, 0);
      world.set(x + 2, y0, z + 2, 0, true, 0);
      for (let dx = 0; dx < 3; dx++) world.set(x + 6 + dx, y0, z + 1, SAPLING, true, 0); // saplings on grass
      fire.ignite(x + 1, y0 + 3, z + 1); // fire on top of the leaves, which burn
      world.set(x + 6, y0 - 1, z + 8, LAVA, true, 0); // a lava source on the grass
      world.set(x + 6, y0, z + 8, LAVA, true, 0);
      for (let dy = 0; dy < 2; dy++) world.set(x + 10, y0 + dy, z + 2, CACTUS, true, 0); // cactus on sand
    }
    const snap = () => regions.flatMap(([x0, y0, z0]) => { const out = []; for (let x = x0; x < x0 + 16; x++) for (let y = y0; y < y0 + 14; y++) for (let z = z0; z < z0 + 16; z++) out.push(read(x, y, z)); return out; });
    const start = snap();
    reads(false);
    const counts = { leaves: 0, saplings: 0, fire: 0, cactus: 0 };
    const log = [];
    for (let tick = 0; tick < REPLAY_STEPS; tick++) {
      reads(true);
      try {
        fire.tick(0, 0);
        weather.tickChunks(world, CHUNKS);
      } finally { reads(false); }
      log.push([weather.lcg, trees.lcg, fire.time, world.edits.size, fire.queue.heap.length]);
    }
    reads(true);
    const end = snap();
    reads(false);
    const changed = end.filter((b, i) => b !== start[i]).length;
    const blocks = regions.map(([x0, y0, z0]) => { const out = []; for (let x = x0; x < x0 + 16; x++) for (let y = y0; y < y0 + 14; y++) for (let z = z0; z < z0 + 16; z++) out.push(read(x, y, z), withRing ? ring.getMeta(x, y, z) : world.getMeta(x, y, z)); return out.join(","); });
    const edits = [...world.edits].sort((a, b) => (a[0] < b[0] ? -1 : 1));
    for (const [cx, cz] of CHUNKS) for (let x = cx * 16; x < cx * 16 + 16; x++) for (let z = cz * 16; z < cz * 16 + 16; z++) for (let y = 60; y < 140; y++) {
      const b = read(x, y, z);
      if (b === LEAVES) counts.leaves++; else if (b === SAPLING) counts.saplings++; else if (b === FIRE) counts.fire++; else if (b === CACTUS) counts.cactus++;
    }
    return { log, blocks, edits, counts, added: changed, rands: [weather.lcg, String(weather.random.seed), String(trees.random.seed), trees.lcg, fire.time], ring, world };
  } finally { Math.random = realRandom; }
}

test("random ticks and fire in ring chunks match the all-resident world over 500 ticks", () => {
  const a = replay(true), b = replay(false);
  for (let i = 0; i < a.log.length; i++) assert.deepEqual(a.log[i], b.log[i], `tick ${i}`);
  assert.deepEqual(a.rands, b.rands);
  assert.deepEqual(a.edits.length, b.edits.length);
  assert.deepEqual(a.edits, b.edits, "the same blocks changed in the same order");
  assert.deepEqual(a.blocks, b.blocks);
  assert.deepEqual(a.counts, b.counts);
  // Chunks 9..12 and -3, -4 are ring chunks: leaves decayed, saplings or fire or cactus changed there.
  assert.ok(a.added > 100, `cells changed since the setup: ${a.added}`);
  const fresh = replay(true);
  assert.deepEqual(fresh.counts, a.counts, "deterministic");
  assert.ok(a.counts.leaves < 10 * 75, JSON.stringify(a.counts));
});

test("Weather.tick random-ticks the ring chunks and the halo, not only the resident window", () => {
  const { world, ring } = setup(true);
  const weather = new Weather({ random: new JavaRandom(5), lcg: 1 });
  weather.rainTime = 100000; weather.thunderTime = 100000;
  const hit = new Set();
  // Every ring chunk with a section that has a ticking block (grass) draws; the spy records which chunks do.
  weather.blockTick = (x, y, z) => { hit.add(`${x >> 4},${z >> 4}`); return true; };
  world.ringReads = true;
  for (let i = 0; i < 40; i++) weather.tick(world, { x: 72.5, z: 72.5 });
  world.ringReads = false;
  const outside = [...hit].filter((k) => { const [cx, cz] = k.split(",").map(Number); return cx < 0 || cx >= 8 || cz < 0 || cz >= 8; });
  assert.ok(outside.length > 100, `ring chunks that ticked: ${outside.length}`);
  assert.ok(hit.has("7,4"), "the resident halo ticks too");
  const list = warm(ring);
  assert.ok(list.length > 350 && list.length < 441, `${list.length}`);
  assert.equal(list.some(([cx, cz]) => cx > 4 + 10 || cx < 4 - 10 || cz > 14 || cz < -6), false, "within the view distance of 10");
  assert.equal(list.some(([cx, cz]) => cx >= 1 && cx <= 6 && cz >= 1 && cz <= 6), false, "the ticking window is ticked by the resident list");
  // Without a ring only the resident ticking window runs.
  const plain = silence(new World("17", "javaStreamed", 12));
  const resident = Weather.activeChunks(72.5, 72.5, 10, plain);
  assert.equal(resident.length, 36);
});

test("a ring column takes part once its edits are hydrated, and its refcounts follow its writes", () => {
  const { world, ring } = setup(true);
  const cx = 10, cz = 4;
  assert.equal(warm(ring).some(([a, b]) => a === cx && b === cz), true);
  ring.isHydrated = (a) => a !== cx;
  ring.touch();
  assert.equal(warm(ring).some(([a, b]) => a === cx && b === cz), false, "an unhydrated column takes no writes, so it waits");
  ring.isHydrated = () => true;
  ring.touch();
  const x = cx * 16 + 3, z = cz * 16 + 3;
  let y = 200; while (y > 0 && !ring.get(x, y, z)) y--;
  const s = (y + 1) >> 4, n = ring.sectionTickCount(cx, cz, s);
  world.set(x, y + 1, z, SAPLING, true, 0);
  assert.equal(ring.sectionTickCount(cx, cz, s), n + 1);
  world.set(x, y + 1, z, 0, true, 0);
  assert.equal(ring.sectionTickCount(cx, cz, s), n, "removing it restores the count");
  assert.equal(ring.sectionTickCount(cx, cz, 15), 0);
  assert.equal(ring.sectionTickCount(500, 500, 0), 0, "a chunk without a column");
  // World.sectionTickCount answers for ring columns during the simulation tick only.
  assert.equal(world.sectionTickCount(cx, cz, s), 0);
  world.ringReads = true;
  assert.equal(world.sectionTickCount(cx, cz, s), n);
  world.ringReads = false;
});

test("ringRandomActive: the rim waits for the chunks a block's reach touches", () => {
  const { world, ring } = setup(true);
  const z = 70;
  assert.equal(ringRandomActive(world, 3 * 16 + 4, z), true, "the resident ticking window");
  assert.equal(ringRandomActive(world, 12 * 16 + 8, z, 4), true, "chunk 12: 11..13 are held");
  assert.equal(ringRandomActive(world, 14 * 16 + 8, z, 4), true, "chunk 14, far from its east edge, reads only its own chunk");
  assert.equal(ringRandomActive(world, 14 * 16 + 14, z, 4), false, "reads into chunk 15, which is not held");
  assert.equal(ringRandomActive(world, 14 * 16 + 14, z, 1), true, "a reach of 1 stays inside");
  assert.equal(ringRandomActive(world, 15 * 16 + 8, z, 1), false, "chunk 15 has no column");
  assert.equal(ringRandomActive(world, 7 * 16 + 14, z, 8), true, "the halo, with the ring held around it");
  assert.equal(ring.reaches(-6 * 16, z, 1), false, "the west rim");
  assert.equal(randomTickReach(LEAVES), 5);
  assert.equal(randomTickReach(SAPLING), 8);
  assert.equal(randomTickReach(FIRE), 4);
  assert.equal(ringRandomActive(silence(new World("17", "javaStreamed", 12)), 9 * 16 + 4, z), false, "no ring, no ring ticks");
});

test("World.chunkAt remembers misses and notices new chunks", () => {
  const world = silence(new World("17", "javaStreamed", 12));
  assert.equal(world.chunkAt(20, 20), null);
  assert.equal(world.chunkAt(20, 20), null);
  assert.equal(world.misses.keys.size, 1);
  world.chunks.set("20,20", new WorldChunk(20, 20, 256));
  assert.ok(world.chunkAt(20, 20), "the map grew, so the miss is forgotten");
  assert.equal(world.chunkAt(21, 20), null);
  world.streamAround(21 * 16 + 8, 20 * 16 + 8);
  assert.ok(world.chunkAt(21, 20), "a new window drops the remembered misses");
});

test("random-tick light in ring chunks comes from RingLight, in the window from the scene", () => {
  const { world, ring } = setup(true);
  world.blockLight = () => 7; world.fullLight = () => 11;
  const trees = { light: () => 13 }, farming = { lightLevel: () => 14 };
  wrapRandomTickLight(world, ring, () => 0, trees, farming);
  assert.equal(world.blockLight(40, 70, 40), 7);
  assert.equal(trees.light(40, 70, 40), 13);
  assert.equal(farming.lightLevel(40, 70, 40), 14);
  const x = 10 * 16 + 4, z = 4 * 16 + 4;
  let y = 200; while (y > 0 && !ring.get(x, y, z)) y--;
  assert.equal(trees.light(x, y + 5, z), 15, "open sky above the ring column");
  assert.equal(farming.lightLevel(x, y + 5, z), 15);
  assert.equal(world.fullLight(x, y + 5, z), 15);
  assert.equal(world.blockLight(x, y + 5, z), 0, "no block light there");
});

test("the ring's random-tick rules are the bytecode-read ones (ring-random-ticks-reference.json)", async () => {
  const ref = JSON.parse(await readFile(new URL("../public/research/ring-random-ticks-reference.json", import.meta.url), "utf8")).facts;
  assert.equal(ref.drawsPerSection, 3);
  assert.equal(ref.chunkExistsTestInRandomTick, false);
  assert.equal(ref.tickUpdatesRange, 0);
  assert.equal(randomTickReach(LEAVES), ref.leafDecayReach, "leaf decay reaches 5 blocks, as BlockLeaves.updateTick's chunk test does");
  // Three draws per ticking section: a chunk with one ticking section advances the update LCG three times (plus the ice step's one in 16).
  const world = silence(new World("17", "javaStreamed", 12));
  const weather = new Weather({ random: new JavaRandom(5), lcg: 1 });
  weather.random.nextInt = () => 1; // no lightning, no ice and snow step
  let calls = 0;
  weather.blockTick = () => { calls++; return true; };
  const chunk = world.chunkAt(1, 1);
  chunk.tickCounts = new Int32Array(16); chunk.tickCounts[4] = 1;
  weather.tickChunk(world, 1, 1);
  assert.ok(calls <= 3);
  let lcg = 1; for (let i = 0; i < 3; i++) lcg = (Math.imul(lcg, 3) + 1013904223) | 0;
  assert.equal(weather.lcg, lcg, "three draws");
});

test("scheduled ticks with a known reach run up to the rim; without one they wait for all eight neighbours", () => {
  const { world } = setup(true);
  const z = 70;
  assert.equal(ringBlockTickActive(world, 14 * 16 + 8, z), false, "default: eight neighbours, chunk 15 is not held");
  assert.equal(ringBlockTickActive(world, 14 * 16 + 8, z, 5), true, "a fluid in the middle of the rim chunk");
  assert.equal(ringBlockTickActive(world, 14 * 16 + 13, z, 5), false, "its flow search would read chunk 15");
  assert.equal(ringBlockTickActive(world, 14 * 16 + 13, z, 1), true);
  assert.equal(ringBlockTickActive(world, 15 * 16 + 8, z, 1), false, "no column, no writes");
});
