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

// Ring entities (batch 24): item entities, experience orbs, arrows, thrown balls and falling blocks in ring chunks update exactly as
// the same entities in the all-resident world do (World.updateEntities: every loaded entity through updateEntityWithOptionalForce's
// 32-block checkChunksExist; WorldServer.tickUpdates' b0 = 0 own-chunk test for the sand's scheduled update). Ring mobs' deaths drop
// items and orbs that tick there too.
import { ItemEntities } from "./item-entities.js";
import { ExperienceOrbs } from "./experience.js";
import { Arrows, arrowTargets } from "./bow.js";
import { Projectiles, mobTargets } from "./projectiles.js";
import { FallingBlocks } from "./falling.js";
import { drainMobEvents } from "./living-simulation.js";
import { residentOnly } from "./headless-env.js";
import { SAND, GRAVEL } from "./world.js";

const ENTITY_STEPS = 320;
const inWindow = (e) => e.x >= 0 && e.x < 128 && e.z >= 0 && e.z < 128;
function seeded(seed) { const r = new JavaRandom(seed); return () => r.nextDouble(); }
function entityReplay(withRing) {
  const realRandom = Math.random;
  Math.random = seeded(4242); // orb motion (EntityXPOrb's Math.random) and the other Math.random draws: identical in both replays
  try {
    const world = world12();
    const column = (cx, cz) => { const k = `${cx},${cz}`; return cache.get(k) ?? (cache.set(k, world.chunkAt(cx, cz) ? { blocks: world.chunkAt(cx, cz).blocks, metadata: world.chunkAt(cx, cz).meta } : world.generateTerrainChunk(cx, cz)), cache.get(k)); };
    const ring = new HeadlessColumns(world, { generate: column, perTick: 1000, every: 1 });
    let probe;
    if (withRing) { ring.update(4, 4); attachRing(world, ring); probe = ring; } else {
      for (let cx = -6; cx <= 14; cx++) for (let cz = -6; cz <= 14; cz++) {
        if (world.chunkAt(cx, cz)) continue;
        const c = column(cx, cz), chunk = new WorldChunk(cx, cz, 256);
        chunk.blocks.set(c.blocks); chunk.meta.set(c.metadata);
        world.chunks.set(`${cx},${cz}`, chunk);
      }
      world.minX = -96; world.maxX = 240; world.minZ = -96; world.maxZ = 240;
      world.isTicking = (x, z) => { const cx = Math.floor(x) >> 4, cz = Math.floor(z) >> 4; for (let a = cx - 2; a <= cx + 2; a++) for (let b = cz - 2; b <= cz + 2; b++) if (!world.chunkAt(a, b)) return false; return true; };
      probe = new HeadlessColumns(world);
    }
    const read = withRing ? (x, y, z) => ring.get(x, y, z) : (x, y, z) => world.get(x, y, z);
    const surface = (x, z) => { let y = 200; while (y > 0 && !read(x, y, z)) y--; return y + 1; };
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
    const items = new ItemEntities(seeded(11)), xpOrbs = new ExperienceOrbs([], seeded(12)), arrows = new Arrows(seeded(13)), balls = new Projectiles(seeded(14));
    let fallSeed = 900n;
    const falling = new FallingBlocks(world, { drop: (stack, x, posY, z) => items.spawn(stack, x, posY, z), entityRandom: () => new JavaRandom(fallSeed++) }).watch();
    mobs.shoot = (e, target, scale) => arrows.skeletonShoot(e, target, scale, 2);
    mobs.lootItems = items;
    const player = { x: 72.5, y: 80, z: 72.5, alive: true, width: 0.6, height: 1.8 }, survival = new Survival(), log = [];
    // Ring places: chunks 8 to 12 (outside the 8 x 8 window, inside the ring's 5 x 5 test) and chunk 7 (resident, outside the ticking window).
    const spots = [[150, 40], [170, 90], [190, 60], [120, 120], [40, 170], [180, 180], [-40, 60], [200, 20], [125, 30]];
    const sand = [];
    if (withRing) world.ringReads = true;
    for (const [i, [x, z]] of spots.entries()) {
      const y = surface(x, z);
      for (let k = 0; k < 3; k++) { world.set(x, y + 4 + k, z, k === 1 ? GRAVEL : SAND, true, 0); sand.push([x, z]); }
      items.spawn({ id: 264, count: 1 + i }, x + 0.5, y + 6, z + 0.5);
      items.spawn({ id: 264, count: 1 }, x + 0.6, y + 6, z + 0.4); // merges with the one above when they meet
      xpOrbs.spawn(7 + i, { x: x + 0.5, y: y + 3, z: z + 0.5 });
      arrows.list.push(arrows.make({ x: x + 0.5, y: y + 8, z: z + 0.5, mx: 0.4, my: 0.3, mz: -0.2, yaw: 0, pitch: 0 }, arrows.rng(), { pickup: 0 }));
      balls.spawnThrowable({ x: x + 0.5, y: y + 1, z: z + 0.5 }, i, -0.6, "snowball");
    }
    world.ringReads = false;
    let ringItems = 0, ringOrbs = 0, ringArrows = 0, ringFalling = 0, ringBalls = 0, deathDrops = 0, deathXp = 0, killed = 0;
    for (let tick = 0; tick < ENTITY_STEPS; tick++) {
      if (withRing) world.ringReads = true; // main.js: simulation reads see the ring columns
      try {
        falling.tick();
        items.tick(world);
        balls.tick(world, mobTargets(mobs.entities, null));
        balls.drain();
        mobs.tick(player, survival);
        xpOrbs.tick(world, player);
        const before = items.items.length;
        for (const ev of drainMobEvents({ mobs, xpOrbs, items })) if (ev.xp && !inWindow(ev.position)) deathXp++;
        for (const it of items.items.slice(before)) if (!inWindow(it)) deathDrops++;
        arrows.tick(world, { targets: arrowTargets(mobTargets(mobs.entities, null), false), mobs, survival, player });
        arrows.drain();
        if (tick % 25 === 5) { // a ring mob dies (the player's kill: drops now, experience at deathTime 20)
          const e = mobs.entities.find((m) => m.health > 0 && !inWindow(m) && mobs.isActive(m));
          if (e) { mobs.kill(e); killed++; }
        }
      } finally { world.ringReads = false; }
      ringItems += items.items.filter((e) => !inWindow(e)).length;
      ringOrbs += xpOrbs.orbs.filter((e) => !inWindow(e)).length;
      ringArrows += arrows.list.filter((e) => !inWindow(e)).length;
      ringFalling += falling.entities.filter((e) => !inWindow(e)).length;
      ringBalls += balls.balls.filter((e) => !inWindow(e)).length;
      log.push({
        tick, seed: String(mobs.worldRandom.seed),
        mobs: mobs.entities.map((e) => [e.id, e.type, e.x, e.y, e.z, e.health]),
        items: items.items.map((e) => [e.stack.id, e.stack.count, e.x, e.y, e.z, e.age, e.onGround]),
        orbs: xpOrbs.orbs.map((o) => [o.value, o.x, o.posY, o.z, o.age]),
        arrows: arrows.list.map((a) => [a.x, a.y, a.z, a.inGround, a.ticksInGround]),
        balls: balls.balls.map((b) => [b.x, b.y, b.z]),
        falling: falling.entities.map((e) => [e.block, e.x, e.y, e.z, e.ticks]),
      });
    }
    const columns = sand.map(([x, z]) => { const out = []; for (let y = 40; y < 140; y++) out.push(read(x, y, z)); return out; });
    return { log, columns, counts: { ringItems, ringOrbs, ringArrows, ringFalling, ringBalls, deathDrops, deathXp, killed }, items, world, ring, falling };
  } finally { Math.random = realRandom; }
}

test("item entities, orbs, arrows, thrown balls and falling sand in ring chunks tick like the all-resident world over 320 ticks", () => {
  const a = entityReplay(true), b = entityReplay(false);
  for (let i = 0; i < a.log.length; i++) assert.deepEqual(a.log[i], b.log[i], `tick ${i}`);
  assert.deepEqual(a.columns, b.columns, "the sand and gravel landed in the same ring cells");
  const c = a.counts;
  assert.ok(c.ringItems > 1000 && c.ringOrbs > 1000 && c.ringArrows > 1000 && c.ringBalls > 0 && c.ringFalling > 20, JSON.stringify(c));
  assert.ok(c.killed > 3 && c.deathDrops > 0 && c.deathXp > 0, `ring deaths dropped items and experience (${JSON.stringify(c)})`);
  // The entities moved: arrows stuck in ring ground, sand fell onto ring terrain, an item pair merged, orbs from ring deaths exist.
  const last = a.log.at(-1);
  assert.ok(last.arrows.some((r) => r[3] && !inWindow({ x: r[0], z: r[2] })), "an arrow stuck in a ring column");
  assert.ok(last.falling.length === 0 && a.columns.some((col) => col.includes(SAND)), "falling blocks landed");
  assert.ok(last.items.some(([, n]) => n > 1), "items merged");
  assert.ok(last.orbs.length > 9, "death orbs joined the seeded ones");
});

test("sand whose own chunk is held but whose 32-block surroundings are not falls instantly, as BlockFalling does (metadata 0)", () => {
  const world = world12(), ring = new HeadlessColumns(world, { generate: (cx, cz) => world.generateTerrainChunk(cx, cz), perTick: 1000, every: 1 });
  ring.update(4, 4);
  attachRing(world, ring);
  const falling = new FallingBlocks(world).watch();
  const x = 13 * 16 + 5, z = 4 * 16 + 7; // chunk 13: held, but chunk 15 (two further) is not
  assert.equal(ring.holds(x, z), true);
  assert.equal(ring.active(x, z), false);
  world.ringReads = true;
  let ground = 200; while (ground > 0 && !world.get(x, ground, z)) ground--;
  const y = ground + 10;
  world.set(x, y, z, SAND, true, 1); // red sand
  for (let i = 0; i < 4; i++) falling.tick();
  assert.equal(falling.entities.length, 0, "no EntityFallingBlock");
  assert.equal(world.get(x, y, z), 0);
  assert.equal(world.get(x, ground + 1, z), SAND, "landed on the first cell it cannot fall through");
  assert.equal(world.getMeta(x, ground + 1, z), 0, "setBlock(x, y, z, this) drops the metadata");
  // Inside the ring's 5 x 5 test the same block spawns the falling entity.
  const x2 = 10 * 16 + 5;
  let g2 = 200; while (g2 > 0 && !world.get(x2, g2, z)) g2--;
  world.set(x2, g2 + 10, z, SAND, true, 1);
  for (let i = 0; i < 4; i++) falling.tick();
  world.ringReads = false;
  assert.equal(falling.entities.length, 1);
  assert.equal(falling.entities[0].meta, 1);
});

test("ring entities are drawn only while their column is resident", () => {
  const world = world12(), list = [{ x: 10, z: 10 }, { x: 150, z: 70 }];
  assert.equal(residentOnly(world, list), list, "no ring: unchanged");
  attachRing(world, new HeadlessColumns(world));
  assert.deepEqual(residentOnly(world, list), [list[0]]);
});

test("the ring's entity and scheduled-tick tests are the bytecode-read ranges (ring-entities-reference.json)", async () => {
  const { readFile } = await import("node:fs/promises");
  const { ringEntityActive, ringTickActive } = await import("./streaming-ticks.js");
  const ref = JSON.parse(await readFile(new URL("../public/research/ring-entities-reference.json", import.meta.url), "utf8")).facts;
  assert.deepEqual([ref.entityCheckRange, ref.tickUpdatesRange, ref.fallingCheckRange, ref.updateEntitiesTypeTests], [32, 0, 32, 0]);
  const world = world12(), ring = new HeadlessColumns(world, { generate: (cx, cz) => world.generateTerrainChunk(cx, cz), perTick: 1000, every: 1 });
  ring.update(4, 4); // chunks -6..14 held
  attachRing(world, ring);
  // 32 blocks are two whole chunks: an entity anywhere in chunk 12 updates (12 + 2 = 14 held), in chunk 13 it does not.
  assert.equal(ringEntityActive(world, { x: 12 * 16, z: 70 }), true);
  assert.equal(ringEntityActive(world, { x: 12 * 16 + 15.9, z: 70 }), true);
  assert.equal(ringEntityActive(world, { x: 13 * 16, z: 70 }), false);
  // b0 = 0: a scheduled update runs wherever its own chunk is held.
  assert.equal(ringTickActive(world, 14 * 16 + 15, 70), true);
  assert.equal(ringTickActive(world, 15 * 16, 70), false);
});
