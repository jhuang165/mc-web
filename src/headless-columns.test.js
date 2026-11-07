// Headless spawning columns (headless-columns.js): compaction, RingLight against the light volume, the worker protocol and the
// replay that matters: a streamed world with a headless ring draws exactly as the same world with every chunk resident (the
// native condition), and spawns land in the chunks the resident window never held.
import test from "node:test";
import assert from "node:assert/strict";
import { World, WorldChunk } from "./world.js";
import { EntityWorld } from "./entities.js";
import { JavaRandom } from "./java-random.js";
import { StreamingLight } from "./streaming-light.js";
import { localDifficulty } from "./difficulty.js";
import { HeadlessColumns, RingLight, compactColumn, createRing, ringKey } from "./headless-columns.js";
import { createStreamWorker, StreamPrefetch } from "./streaming-generator.js";
import { populationBlockMapperReady } from "./population-world.js";
import { Survival } from "./survival.js";
import { attachRing } from "./headless-columns.js";
import { wrapMobHooks } from "./headless-env.js";

await populationBlockMapperReady;
const silence = (w) => { w.blockLight = () => 0; return w; };
const world12 = () => silence(new World("17", "javaStreamed", 12));

test("compactColumn keeps blocks, sparse metadata and the top filled segment", () => {
  const blocks = new Uint8Array(65536), meta = new Uint8Array(65536), c = (lx, lz, y) => (lx * 16 + lz) * 256 + y;
  blocks[c(0, 0, 5)] = 1; blocks[c(3, 4, 70)] = 2; meta[c(3, 4, 70)] = 7; blocks[c(15, 15, 33)] = 9; meta[c(15, 15, 33)] = 3; meta[c(1, 1, 2)] = 4;
  const col = compactColumn(blocks, meta), ring = new HeadlessColumns({ height: 256, minX: 0, maxX: 0, minZ: 0, maxZ: 0 });
  assert.equal(col.top, 64);
  assert.equal(col.h, 80);
  assert.equal(col.blocks.length, 256 * 80);
  ring.cols.set(ringKey(2, -3), col);
  const at = (lx, lz, y) => [2 * 16 + lx, -3 * 16 + lz, y];
  for (const [lx, lz, y] of [[0, 0, 5], [3, 4, 70], [15, 15, 33], [1, 1, 2], [8, 8, 8], [3, 4, 71], [0, 0, 200]]) {
    const [x, z] = at(lx, lz, y);
    assert.equal(ring.get(x, y, z), blocks[c(lx, lz, y)], `${lx},${lz},${y}`);
    assert.equal(ring.getMeta(x, y, z), meta[c(lx, lz, y)], `meta ${lx},${lz},${y}`);
  }
  assert.equal(ring.top(2, -3), 64);
  assert.equal(ring.top(9, 9), -1);
  assert.equal(compactColumn(new Uint8Array(65536), new Uint8Array(65536)).top, 0);
});

test("RingLight equals the light volume cell for cell, in resident columns and in headless ones", () => {
  const a = world12(), refA = new StreamingLight(a), ringA = new HeadlessColumns(a), lightA = ringA.light;
  let n = 0, partial = 0;
  const rand = new JavaRandom(5);
  for (let i = 0; i < 4000; i++) {
    const x = 16 + rand.nextInt(96), z = 16 + rand.nextInt(96), y = 25 + rand.nextInt(70);
    const want = [refA.skyAt(x, y, z), refA.blockAt(x, y, z)], got = [lightA.skyAt(x, y, z), lightA.blockAt(x, y, z)];
    assert.deepEqual(got, want, `${x},${y},${z}`);
    if (want[0] > 0 && want[0] < 15) partial++;
    n++;
  }
  assert.ok(partial > 8, `sky values between 0 and 15 were sampled (${partial} of ${n})`);
  // Headless: another window of the same world is the reference for cells that are only headless columns here.
  const b = world12();
  b.streamAround(192, 64); // chunks 8..15 by 0..7
  assert.equal(b.minX, 128);
  const refB = new StreamingLight(b), ring = new HeadlessColumns(a, { generate: (cx, cz) => b.chunkAt(cx, cz) ? { blocks: b.chunkAt(cx, cz).blocks, metadata: b.chunkAt(cx, cz).meta } : a.generateTerrainChunk(cx, cz), perTick: 1000, every: 1, radius: 6 });
  ring.update(11, 3);
  assert.ok(ring.size >= 169 - 64, `${ring.size} columns`);
  const rand2 = new JavaRandom(9);
  for (let i = 0; i < 500; i++) {
    const x = 144 + rand2.nextInt(64), z = 16 + rand2.nextInt(96), y = 30 + rand2.nextInt(100);
    assert.equal(ring.outside(x, z), true);
    assert.deepEqual([ring.light.skyAt(x, y, z), ring.light.blockAt(x, y, z)], [refB.skyAt(x, y, z), refB.blockAt(x, y, z)], `${x},${y},${z}`);
  }
});

// A streamed world with a headless ring, and the same world with every chunk of the area resident (hand-built columns).
const SEED_STEPS = 260;
const cache = new Map(); // generated columns are a pure function of the seed: both replays share them
function replay(withRing) {
  const world = world12();
  const column = (cx, cz) => { const k = `${cx},${cz}`; return cache.get(k) ?? (cache.set(k, world.chunkAt(cx, cz) ? { blocks: world.chunkAt(cx, cz).blocks, metadata: world.chunkAt(cx, cz).meta } : world.generateTerrainChunk(cx, cz)), cache.get(k)); };
  const ring = new HeadlessColumns(world, { generate: column, perTick: 1000, every: 1 });
  const minX = world.minX, maxX = world.maxX, minZ = world.minZ, maxZ = world.maxZ;
  let probe;
  if (withRing) { ring.update(4, 4); probe = ring; } else {
    for (let cx = -6; cx <= 14; cx++) for (let cz = -6; cz <= 14; cz++) {
      if (world.chunkAt(cx, cz)) continue;
      const c = column(cx, cz), chunk = new WorldChunk(cx, cz, 256);
      chunk.blocks.set(c.blocks); chunk.meta.set(c.metadata);
      world.chunks.set(`${cx},${cz}`, chunk);
    }
    world.minX = -96; world.maxX = 240; world.minZ = -96; world.maxZ = 240;
    probe = new HeadlessColumns(world);
  }
  const mobs = new EntityWorld(world, []);
  mobs.worldRandom = new JavaRandom(1234);
  mobs.entitySeed = (rand) => rand.seed;
  mobs.difficulty = 2;
  mobs.localDifficulty = () => localDifficulty(2, 18000, 0, true);
  mobs.currentDate = () => new Date(2014, 9, 31);
  mobs.lightAt = (x, y, z) => probe.light.level(x, y, z, 11);
  mobs.thunderLightAt = (x, y, z) => probe.light.level(x, y, z, 10);
  mobs.fullLightAt = (x, y, z) => probe.light.level(x, y, z, 0);
  mobs.skyLightAt = (x, y, z) => probe.light.skyAt(x, y, z);
  mobs.lightSubtracted = () => 11;
  mobs.isThundering = () => false;
  if (withRing) mobs.ring = ring;
  const player = { x: 72.5, y: 80, z: 72.5 }, log = [];
  for (let tick = 0; tick < SEED_STEPS; tick++) {
    if (tick % 2 === 0) mobs.entities.length = 0;
    const before = mobs.entities.length;
    const total = mobs.naturalSpawn(player, { time: 18000 }, tick % 400 === 0);
    log.push({ tick, total, seed: String(mobs.worldRandom.seed), mobs: mobs.entities.slice(before).map((e) => [e.type, e.x, e.y, e.z, Math.fround(e.rotationYaw)]) });
  }
  return { log, window: { minX, maxX, minZ, maxZ }, ring };
}

test("a streamed world with headless columns spawns exactly as one with every chunk resident, and spawns land beyond the window", () => {
  const a = replay(true), b = replay(false);
  assert.equal(a.ring.size, 441, "the whole 21 x 21 area is held");
  let outside = 0, total = 0;
  const { minX, maxX, minZ, maxZ } = a.window;
  for (let i = 0; i < a.log.length; i++) {
    assert.deepEqual(a.log[i], b.log[i], `tick ${i}`);
    for (const [, x, , z] of a.log[i].mobs) { total++; if (x < minX || x >= maxX || z < minZ || z >= maxZ) outside++; }
  }
  assert.ok(total > 100, `spawned ${total}`);
  assert.ok(outside > 20, `${outside} of ${total} spawns lie outside the 8 x 8 resident window`);
  // The band beyond 8 chunks of the player (outside the old reach entirely) is reached too.
  assert.ok(a.log.some((s) => s.mobs.some(([, x, , z]) => Math.abs(x - 72.5) > 64 || Math.abs(z - 72.5) > 64)));
});

test("without a ring the same world draws only in resident chunks (control)", () => {
  const world = world12(), mobs = new EntityWorld(world, []);
  mobs.worldRandom = new JavaRandom(1234); mobs.entitySeed = (rand) => rand.seed; mobs.difficulty = 2;
  mobs.localDifficulty = () => localDifficulty(2, 18000, 0, true);
  const player = { x: 72.5, y: 80, z: 72.5 };
  let outside = 0;
  for (let tick = 0; tick < 120; tick++) {
    if (tick % 2 === 0) mobs.entities.length = 0;
    mobs.naturalSpawn(player, { time: 18000 }, false);
    for (const e of mobs.entities) if (e.x < world.minX || e.x >= world.maxX || e.z < world.minZ || e.z >= world.maxZ) outside++;
  }
  assert.equal(outside, 0);
});

test("columns far from the player are dropped and the held area stays small", () => {
  const world = world12(), made = [];
  const ring = new HeadlessColumns(world, { generate: (cx, cz) => { made.push([cx, cz]); return world.generateTerrainChunk(cx, cz); }, perTick: 40, every: 1, radius: 3 });
  ring.update(4, 4);
  for (let i = 0; i < 3; i++) ring.update(4, 4);
  assert.equal(ring.size, 49);
  assert.ok(ring.bytes() < 49 * 80000, `${ring.bytes()} bytes`);
  ring.update(40, 40);
  assert.ok(ring.size <= 49 && [...ring.cols.keys()].every((k) => k > ringKey(30, 0)), "old columns are pruned");
  assert.equal(ring.stats.pruned, 49);
});

test("the worker answers ring requests with compacted columns for a column and for a population cell", async () => {
  const w = silence(new World("17", "javaStreamed", 13)), handle = await createStreamWorker({ seed: String(w.javaSeed), generationVersion: 13, originX: w.originX, originZ: w.originZ, worldType: w.worldType, generatorOptions: w.generatorOptions });
  const { message, transfer } = handle({ type: "ring", cell: true, x: 1, z: 0 });
  const got = structuredClone(message, { transfer });
  assert.equal(got.columns.length, 64);
  const ring = new HeadlessColumns(w), ref = w.population.cell(1, 0);
  ring.cx = 12; ring.cz = 3;
  ring.receive(got.columns);
  assert.equal(ring.size, 64);
  const [lcx, lcz] = [9, 2], src = ref.columns.get(`${lcx},${lcz}`), want = compactColumn(src.blocks, src.metadata);
  assert.deepEqual(ring.column(lcx, lcz), want);
  assert.equal(ring.top(lcx, lcz), want.top);
});

test("StreamPrefetch asks for ring cells only when the window needs nothing, and hands the columns to the ring", async () => {
  const w = silence(new World("17", "javaStreamed", 13)), sent = [];
  const prefetch = new StreamPrefetch(w, { postMessage: (m) => sent.push(m) }, { margin: 0 });
  const ring = createRing(w, { worker: true });
  assert.ok(ring instanceof HeadlessColumns && !ring.generate);
  prefetch.ring = ring;
  ring.update(4, 4); // chunks around the first window: the cells of the page cache are pulled, the rest needs the worker
  prefetch.update(72, 72);
  const asks = sent.filter((m) => m.type === "ring");
  assert.equal(asks.length, 1);
  assert.equal(asks[0].cell, true);
  const col = compactColumn(new Uint8Array(65536).fill(1), new Uint8Array(65536));
  prefetch.receive({ type: "ring", x: asks[0].x, z: asks[0].z, cell: true, columns: [[-1, -1, col]] });
  assert.equal(ring.top(-1, -1), col.top);
  prefetch.update(72, 72);
  assert.equal(sent.filter((m) => m.type === "ring").length, 2, "the next cell is requested once the reply arrived");
});

test("Nether and End worlds fill their ring from their own generator and spawn beyond the window", async () => {
  const { DimensionWorld } = await import("./dimension-world.js");
  const { NETHER, END } = await import("./dimensions.js");
  for (const dim of [NETHER, END]) {
    const w = new DimensionWorld("17", dim);
    w.streamAround(0, 0);
    const ring = createRing(w);
    assert.ok(ring.generate, "no worker: columns come from the generator in small budgets");
    ring.radius = 4;
    const mobs = new EntityWorld(w, []);
    mobs.ring = ring; mobs.difficulty = 2; mobs.worldRandom = new JavaRandom(3); mobs.localDifficulty = () => 1.5;
    let outside = 0;
    for (let tick = 0; tick < 300; tick++) {
      if (tick % 2 === 0) mobs.entities.length = 0;
      mobs.naturalSpawn({ x: 8.5, y: 70, z: 8.5 }, { time: 0 }, false);
      for (const e of mobs.entities) if (e.x < w.minX || e.x >= w.maxX || e.z < w.minZ || e.z >= w.maxZ) outside++;
    }
    assert.equal(ring.size, 81, `dimension ${dim}`);
    assert.ok(outside > 0, `dimension ${dim}: ${outside} spawns beyond the window`);
  }
});

// Ring mobs tick (batch 22): a streamed world with a headless ring updates mobs in ring chunks exactly as the same world with
// every chunk resident does, where an entity updates when the chunks two away from its own are loaded (checkChunksExist, 32 blocks).
const TICK_STEPS = 320;
function tickReplay(withRing) {
  const world = world12();
  const column = (cx, cz) => { const k = `${cx},${cz}`; return cache.get(k) ?? (cache.set(k, world.chunkAt(cx, cz) ? { blocks: world.chunkAt(cx, cz).blocks, metadata: world.chunkAt(cx, cz).meta } : world.generateTerrainChunk(cx, cz)), cache.get(k)); };
  const ring = new HeadlessColumns(world, { generate: column, perTick: 1000, every: 1 });
  const loaded = (cx, cz) => !!world.chunkAt(cx, cz) || ring.cols.has(ringKey(cx, cz));
  let probe;
  if (withRing) { ring.update(4, 4); attachRing(world, ring); probe = ring; } else {
    for (let cx = -6; cx <= 14; cx++) for (let cz = -6; cz <= 14; cz++) {
      if (world.chunkAt(cx, cz)) continue;
      const c = column(cx, cz), chunk = new WorldChunk(cx, cz, 256);
      chunk.blocks.set(c.blocks); chunk.meta.set(c.metadata);
      world.chunks.set(`${cx},${cz}`, chunk);
    }
    world.minX = -96; world.maxX = 240; world.minZ = -96; world.maxZ = 240;
    // The native rule on the all-resident world: the 5 x 5 chunks around the entity's chunk exist.
    world.isTicking = (x, z) => { const cx = Math.floor(x) >> 4, cz = Math.floor(z) >> 4; for (let a = cx - 2; a <= cx + 2; a++) for (let b = cz - 2; b <= cz + 2; b++) if (!world.chunkAt(a, b)) return false; return true; };
    probe = new HeadlessColumns(world);
  }
  const rand = new JavaRandom(77);
  const mobs = new EntityWorld(world, [], () => rand.nextDouble());
  mobs.worldRandom = new JavaRandom(1234);
  mobs.entitySeed = (r) => r.seed;
  mobs.difficulty = 2;
  mobs.localDifficulty = () => localDifficulty(2, 18000, 0, true);
  mobs.currentDate = () => new Date(2014, 9, 31);
  mobs.lightAt = (x, y, z) => probe.light.level(x, y, z, 11);
  mobs.thunderLightAt = (x, y, z) => probe.light.level(x, y, z, 10);
  mobs.fullLightAt = (x, y, z) => probe.light.level(x, y, z, 0);
  mobs.skyLightAt = (x, y, z) => probe.light.skyAt(x, y, z);
  mobs.lightSubtracted = () => 11;
  mobs.isThundering = () => false;
  mobs.isDaytime = () => false;
  mobs.naturalSpawning = true;
  if (withRing) mobs.ring = ring;
  const player = { x: 72.5, y: 80, z: 72.5, alive: true, width: 0.6, height: 1.8 }, survival = new Survival(), log = [];
  let ringTicked = 0;
  for (let tick = 0; tick < TICK_STEPS; tick++) {
    const total = mobs.naturalSpawn(player, { time: 18000 }, tick % 400 === 0);
    mobs.tick(player, survival);
    mobs.drain?.();
    for (const e of mobs.entities) if (e.age > 0 && !(e.x >= 0 && e.x < 128 && e.z >= 0 && e.z < 128)) ringTicked++;
    log.push({ tick, total, seed: String(mobs.worldRandom.seed), mobs: mobs.entities.map((e) => [e.id, e.type, e.x, e.y, e.z, e.health]) });
  }
  return { log, ringTicked, loaded };
}

test("mobs in ring chunks tick like mobs in an all-resident world: same positions, despawns and spawn draws over 320 ticks", () => {
  const a = tickReplay(true), b = tickReplay(false);
  assert.ok(a.ringTicked > 100, `ring mobs were updated (${a.ringTicked} mob-ticks)`);
  for (let i = 0; i < a.log.length; i++) assert.deepEqual(a.log[i], b.log[i], `tick ${i}`);
  // Mobs outside the window moved (not frozen at their spawn cell) and some were removed by despawning.
  const first = new Map();
  let moved = 0, gone = 0;
  for (const s of a.log) {
    const now = new Set();
    for (const [id, , x, y, z] of s.mobs) {
      now.add(id);
      if (!first.has(id)) first.set(id, [x, y, z]);
      else { const f = first.get(id); if ((x < 0 || x >= 128 || z < 0 || z >= 128) && Math.hypot(x - f[0], z - f[2]) > 0.5) moved++; }
    }
    for (const id of first.keys()) if (!now.has(id) && !first.get(id).gone) { first.get(id).gone = true; gone++; }
  }
  assert.ok(moved > 0, "a ring mob walked");
  assert.ok(gone > 0, "mobs despawned or died");
});

test("ring columns take edits: writes land in the column, grow it, and reach the resident column when the window shifts to it", () => {
  const world = world12(), ring = new HeadlessColumns(world, { generate: (cx, cz) => world.generateTerrainChunk(cx, cz), perTick: 1000, every: 1, radius: 6 });
  ring.update(4, 4);
  attachRing(world, ring);
  const x = 150, z = 70; // chunk 9, 4: outside the window (chunks 0..7)
  assert.equal(world.isLoaded(x, z), false);
  const before = ring.get(x, 70, z), column = world.generateTerrainChunk(9, 4);
  assert.equal(before, column.blocks[((x & 15) * 16 + (z & 15)) * 256 + 70]);
  // Not readable through the plain world, readable while ringReads is set and through the view.
  assert.equal(world.get(x, 70, z), 0);
  world.ringReads = true; assert.equal(world.get(x, 70, z), before); world.ringReads = false;
  assert.ok(world.set(x, 70, z, 7, true, 0) && world.set(x, 71, z, 5, true, 3) && world.set(x, 200, z, 4, true, 9), "writes accepted");
  assert.equal(ring.get(x, 70, z), 7);
  assert.equal(ring.getMeta(x, 71, z), 3);
  assert.equal(ring.get(x, 200, z), 4, "the column grew to hold the cell");
  assert.equal(ring.getMeta(x, 200, z), 9);
  assert.equal(ring.top(9, 4), 192);
  assert.equal(ring.get(x + 1, 70, z), column.blocks[(((x + 1) & 15) * 16 + (z & 15)) * 256 + 70], "neighbours untouched");
  assert.equal(world.dirtyColumns.has("9,4"), true, "the edit is journalled for the save");
  // Unhydrated journals refuse writes (the saved edits of that column could otherwise be lost).
  ring.isHydrated = () => false;
  assert.equal(world.set(x, 72, z, 1), false);
  ring.isHydrated = () => true;
  // The window shifts onto the column: the new resident chunk carries the edits.
  assert.ok(world.streamAround(150, 70));
  const chunk = world.chunkAt(9, 4);
  assert.ok(chunk, "resident now");
  assert.equal(world.get(x, 70, z), 7);
  assert.equal(world.get(x, 71, z), 5);
  assert.equal(world.getMeta(x, 71, z), 3);
  assert.equal(world.get(x, 200, z), 4);
  // And back: the column that leaves the window keeps its live blocks in the ring.
  world.set(x, 73, z, 20);
  assert.ok(world.streamAround(8, 70));
  assert.equal(world.isLoaded(x, z), false);
  assert.equal(ring.get(x, 73, z), 20);
  assert.equal(ring.get(x, 200, z), 4);
});

test("stored edits reach a held ring column when its journal hydrates", () => {
  const world = world12(), ring = new HeadlessColumns(world, { generate: (cx, cz) => world.generateTerrainChunk(cx, cz), perTick: 1000, every: 1, radius: 6 });
  attachRing(world, ring);
  ring.isHydrated = () => false;
  ring.update(4, 4);
  const x = 150, z = 70, cell = ((x & 15) * 16 + (z & 15)) * 256 + 60;
  const stored = ring.get(x, 60, z);
  world.restoreColumns([{ x: 9, z: 4, cells: Uint16Array.of(cell), values: Uint16Array.of(41 | (2 << 8)), order: Uint32Array.of(0) }]);
  assert.equal(ring.get(x, 60, z), stored, "not hydrated: stored edit not yet shown");
  ring.isHydrated = () => true;
  world.restoreColumns([{ x: 9, z: 4, cells: Uint16Array.of(cell), values: Uint16Array.of(41 | (2 << 8)), order: Uint32Array.of(0) }]);
  assert.equal(ring.get(x, 60, z), 41);
  assert.equal(ring.getMeta(x, 60, z), 2);
});

test("ring light and sky hooks answer for ring-only cells", () => {
  const world = world12(), ring = new HeadlessColumns(world, { generate: (cx, cz) => world.generateTerrainChunk(cx, cz), perTick: 1000, every: 1, radius: 6 });
  ring.update(4, 4);
  const mobs = { lightAt: () => -1, canSeeSky: () => "base" };
  wrapMobHooks(mobs, ring, () => 0);
  assert.equal(mobs.lightAt(10, 70, 10), -1, "resident cell: the scene's answer");
  const x = 150, z = 70, top = ring.light.heightAt(x, z);
  assert.equal(mobs.canSeeSky(x, top, z), true);
  assert.equal(mobs.canSeeSky(x, top - 1, z), false);
  assert.equal(mobs.lightAt(x, top, z), 15);
  assert.equal(mobs.canSeeSky(10, 70, 10), "base");
});
