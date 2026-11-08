// Batch 29 (light-engine.md "Batch 29", natural-spawning.md "Round 10"): the bulk light of a headless ring column (ring-light.js) equals the
// light volume (StreamingLight, the fixed point a resident column holds) and the per-cell search, and the light-sensitive ring behaviour
// (night spawning under canopies and overhangs, ice and snow beside torches) is identical in a ring-backed world and with every chunk resident.
import test from "node:test";
import assert from "node:assert/strict";
import { World, WorldChunk, WATER, ICE, SNOW_LAYER, TORCH, GLOWSTONE } from "./world.js";
import { EntityWorld } from "./entities.js";
import { JavaRandom } from "./java-random.js";
import { StreamingLight } from "./streaming-light.js";
import { localDifficulty } from "./difficulty.js";
import { HeadlessColumns, attachRing } from "./headless-columns.js";
import { computeColumnLight } from "./ring-light.js";
import { Weather } from "./weather.js";
import { populationBlockMapperReady } from "./population-world.js";
import { wrapRandomTickLight } from "./headless-env.js";

await populationBlockMapperReady;
const silence = (w) => { w.blockLight = () => 0; return w; };
const world12 = () => silence(new World("17", "javaStreamed", 12));
const cache = new Map();
const source = (world) => (cx, cz) => { const k = `${cx},${cz}`; return cache.get(k) ?? (cache.set(k, world.chunkAt(cx, cz) ? { blocks: world.chunkAt(cx, cz).blocks, metadata: world.chunkAt(cx, cz).meta } : world.generateTerrainChunk(cx, cz)), cache.get(k)); };
const LEAVES = 5, STONE = 3, GRASS = 1;

test("bulk column light equals the light volume cell for cell, before and after edits that need invalidation", () => {
  const a = world12(), b = world12();
  b.streamAround(192, 64); // chunks 8..15 by 0..7
  const ring = new HeadlessColumns(a, { generate: (cx, cz) => b.chunkAt(cx, cz) ? { blocks: b.chunkAt(cx, cz).blocks, metadata: b.chunkAt(cx, cz).meta } : a.generateTerrainChunk(cx, cz), perTick: 1000, every: 1, radius: 6 });
  ring.update(11, 3);
  attachRing(a, ring);
  const columns = [[10, 3], [12, 4], [14, 5]];
  const compare = (ref, label) => {
    let n = 0, partial = 0;
    for (const [cx, cz] of columns) {
      assert.ok(ring.complete(cx, cz));
      const L = computeColumnLight(ring, cx, cz, false);
      ring.state(cx, cz).light = L; // as RingLight.light stores it
      for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y < 150; y++) {
        const x = cx * 16 + lx, z = cz * 16 + lz;
        assert.deepEqual([ring.light.skyAt(x, y, z), ring.light.blockAt(x, y, z)], [ref.skyAt(x, y, z), ref.blockAt(x, y, z)], `${label} ${x},${y},${z}`);
        n++; if (ref.skyAt(x, y, z) > 0 && ref.skyAt(x, y, z) < 15) partial++;
      }
    }
    assert.ok(ring.light.at && n === 3 * 256 * 150 && partial > 40, `${partial} partially lit cells of ${n}`);
  };
  compare(new StreamingLight(b), "fresh");
  // Edits: a roof over a field, a torch, a glowstone block, a hole in the ground. Applied to the ring (putOutside) and to the reference world.
  const edits = [];
  for (let x = 196; x < 204; x++) for (let z = 66; z < 74; z++) { const y = 95; edits.push([x, y, z, STONE]); }
  edits.push([200, 90, 70, TORCH], [215, 80, 82, GLOWSTONE], [180, 60, 71, 0], [180, 61, 71, 0], [180, 62, 71, 0]);
  for (const [x, y, z, id] of edits) { assert.ok(ring.putOutside(x, y, z, id, 0, false), `${x},${y},${z}`); b.set(x, y, z, id, false, 0); }
  for (const [cx, cz] of columns) assert.equal(ring.state(cx, cz).light, null, "edits invalidate the column and its neighbours");
  compare(new StreamingLight(b), "edited");
  // A column's own RingLight path switches to the bulk light once it is asked HOT times and its neighbours are present.
  const before = ring.light.bulk;
  for (let i = 0; i < 20; i++) ring.light.skyAt(20 * 16 > 0 ? 160 : 0, 70 + i, 70);
  assert.ok(ring.light.bulk > before || ring.state(10, 4).light, "hot columns are lit whole");
});

function spawnReplay(mode) {
  const world = world12(), column = source(world);
  const ring = new HeadlessColumns(world, { generate: column, perTick: 1000, every: 1 });
  let probe;
  if (mode === "resident") {
    for (let cx = -6; cx <= 14; cx++) for (let cz = -6; cz <= 14; cz++) {
      if (world.chunkAt(cx, cz)) continue;
      const c = column(cx, cz), chunk = new WorldChunk(cx, cz, 256);
      chunk.blocks.set(c.blocks); chunk.meta.set(c.metadata);
      world.chunks.set(`${cx},${cz}`, chunk);
    }
    world.minX = -96; world.maxX = 240; world.minZ = -96; world.maxZ = 240;
    probe = new HeadlessColumns(world);
  } else { ring.update(4, 4); attachRing(world, ring); probe = ring; }
  if (mode === "search") probe.light.hot = Infinity;
  // Canopies and overhangs in ring chunks, set after the terrain exists: stone roofs 3 above the ground, leaf blobs, a torch under one.
  const read = (x, y, z) => (mode === "resident" ? world.get(x, y, z) : ring.get(x, y, z));
  const spots = [[10, 3], [11, 5], [-3, 4], [12, 1], [4, 10], [-2, -2], [9, 9]];
  for (const [cx, cz] of spots) {
    const x0 = cx * 16 + 2, z0 = cz * 16 + 2;
    let top = 0;
    for (let y = 200; y > 0; y--) if (read(x0 + 5, y, z0 + 5)) { top = y + 1; break; }
    for (let dx = 0; dx < 12; dx++) for (let dz = 0; dz < 5; dz++) world.set(x0 + dx, top + 3, z0 + dz, STONE, true, 0);
    for (let dx = 0; dx < 6; dx++) for (let dz = 7; dz < 13; dz++) for (let dy = 3; dy < 5; dy++) world.set(x0 + dx, top + dy, z0 + dz, LEAVES, true, 0);
    world.set(x0 + 1, top, z0 + 1, TORCH, true, 0);
  }
  const mobs = new EntityWorld(world, []);
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
  if (mode !== "resident") mobs.ring = ring;
  const player = { x: 72.5, y: 80, z: 72.5 }, log = [];
  let covered = 0, total = 0;
  for (let tick = 0; tick < 200; tick++) {
    if (mode !== "resident") ring.update(4, 4);
    if (tick % 2 === 0) mobs.entities.length = 0;
    const before = mobs.entities.length;
    const n = mobs.naturalSpawn(player, { time: 18000 }, tick % 400 === 0);
    const made = mobs.entities.slice(before);
    for (const e of made) { total++; if (probe.light.heightAt(Math.floor(e.x), Math.floor(e.z)) > Math.floor(e.y) + 1) covered++; }
    log.push({ tick, n, seed: String(mobs.worldRandom.seed), mobs: made.map((e) => [e.type, e.x, e.y, e.z]) });
  }
  return { log, covered, total, bulk: ring.light.bulk };
}

test("night spawning under canopies and overhangs in ring chunks is the same with bulk light, the per-cell search and every chunk resident", () => {
  const bulk = spawnReplay("bulk"), search = spawnReplay("search"), resident = spawnReplay("resident");
  assert.ok(bulk.bulk > 5, `bulk columns were lit (${bulk.bulk})`);
  assert.equal(search.bulk, 0);
  assert.ok(bulk.total > 60, `spawned ${bulk.total}`);
  assert.ok(bulk.covered > 3, `${bulk.covered} spawns stand under a roof or canopy`);
  for (let i = 0; i < bulk.log.length; i++) { assert.deepEqual(bulk.log[i], search.log[i], `search ${i}`); assert.deepEqual(bulk.log[i], resident.log[i], `resident ${i}`); }
});

function snowReplay(mode) {
  const realRandom = Math.random, seed = new JavaRandom(99);
  Math.random = () => seed.nextDouble();
  try {
    const world = world12(), column = source(world);
    const ring = new HeadlessColumns(world, { generate: column, perTick: 1000, every: 1 });
    let probe;
    if (mode === "resident") {
      for (let cx = -6; cx <= 14; cx++) for (let cz = -6; cz <= 14; cz++) {
        if (world.chunkAt(cx, cz)) continue;
        const c = column(cx, cz), chunk = new WorldChunk(cx, cz, 256);
        chunk.blocks.set(c.blocks); chunk.meta.set(c.metadata);
        world.chunks.set(`${cx},${cz}`, chunk);
      }
      world.minX = -96; world.maxX = 240; world.minZ = -96; world.maxZ = 240;
      probe = new HeadlessColumns(world);
      world.blockLight = (x, y, z) => (y < 0 || y >= 256 ? 0 : probe.light.search(x, y, z) & 15); // uncached: the reference sees every edit
    } else {
      ring.update(4, 4); attachRing(world, ring); probe = ring;
      if (mode === "search") ring.light.hot = Infinity;
      wrapRandomTickLight(world, ring, () => 0, null, null);
    }
    world.temperatureAt = () => 0; // a cold biome: water freezes and snow lies
    const weather = new Weather({ random: new JavaRandom(5), lcg: 77 });
    weather.raining = true; weather.rain = 1;
    const read = (x, y, z) => (mode === "resident" ? world.get(x, y, z) : ring.get(x, y, z));
    if (mode !== "resident") world.ringReads = true;
    const chunks = [[9, 2], [10, 5], [11, 3], [-3, 3], [12, 1], [3, -3], [5, 11], [0, 12], [-4, -2], [10, 8]], regions = [];
    for (const [cx, cz] of chunks) {
      let y0 = 200;
      while (y0 > 0 && !read(cx * 16 + 8, y0, cz * 16 + 8)) y0--;
      y0 += 2;
      regions.push([cx * 16, y0 - 3, cz * 16]);
      for (let dx = 0; dx < 16; dx++) for (let dz = 0; dz < 16; dz++) {
        for (let y = y0 - 1; y < y0 + 8; y++) world.set(cx * 16 + dx, y, cz * 16 + dz, 0, true, 0);
        world.set(cx * 16 + dx, y0 - 2, cz * 16 + dz, GRASS, true, 0);
        world.set(cx * 16 + dx, y0 - 1, cz * 16 + dz, dx < 8 ? WATER : GRASS, true, 0); // a pond on the west half, open ground east
      }
      for (let dx = 4; dx < 8; dx++) for (let dz = 8; dz < 16; dz++) world.set(cx * 16 + dx, y0 + 3, cz * 16 + dz, STONE, true, 0); // roof over part of the pond
      world.set(cx * 16 + 6, y0, cz * 16 + 3, TORCH, true, 0); // a torch beside the pond: block light 10+ for four blocks
    }
    const snap = () => regions.flatMap(([x0, y0, z0]) => { const out = []; for (let x = x0; x < x0 + 16; x++) for (let y = y0; y < y0 + 12; y++) for (let z = z0; z < z0 + 16; z++) out.push(read(x, y, z)); return out; });
    const log = [];
    for (let tick = 0; tick < 1800; tick++) {
      if (mode !== "resident") ring.update(4, 4);
      if (tick === 900) for (const [cx, cz] of chunks) { const [x0, y0, z0] = regions.find((r) => r[0] === cx * 16 && r[2] === cz * 16); world.set(x0 + 2, y0 + 3, z0 + 5, TORCH, true, 0); }
      weather.tickChunks(world, chunks);
      log.push([weather.lcg, String(weather.random.seed)]);
    }
    const end = snap();
    let ice = 0, snow = 0;
    for (const b of end) { if (b === ICE) ice++; else if (b === SNOW_LAYER) snow++; }
    return { log, end, ice, snow, bulk: ring.light.bulk };
  } finally { Math.random = realRandom; }
}

test("ice and snow in ring chunks (cold rain, torches placed before and during the run) match the all-resident world", () => {
  const bulk = snowReplay("bulk"), search = snowReplay("search"), resident = snowReplay("resident");
  assert.ok(bulk.bulk > 5, `bulk columns were lit (${bulk.bulk})`);
  assert.ok(bulk.ice > 50 && bulk.snow > 50, `ice ${bulk.ice}, snow ${bulk.snow}`);
  assert.deepEqual([search.ice, search.snow], [resident.ice, resident.snow], "search counts");
  assert.deepEqual([bulk.ice, bulk.snow], [resident.ice, resident.snow], "bulk counts");
  const diverge = (x) => x.log.findIndex((e, i) => e[0] !== resident.log[i][0] || e[1] !== resident.log[i][1]);
  assert.equal(diverge(search), -1, "search log");
  assert.equal(diverge(bulk), -1, "bulk log");
  assert.deepEqual(bulk.end, resident.end);
  assert.deepEqual(search.end, resident.end);
  assert.equal(bulk.ice, resident.ice);
});
