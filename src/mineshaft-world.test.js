// GEN-05b live-world mineshafts: replays public/research/mineshaft-world-reference.json
// (MineshaftWorldProbe, unchanged 1.7.10 classes over real Chunk storage) in original-ID space,
// then checks the live World mapping end to end.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { randomLong } from "./structure-framework.js";
import { RecordingWorld } from "./structure-framework-fixture.js";
import { GenWorld } from "./gen-world.js";
import { MapGenCaves, MapGenRavine } from "./mapgen.js";
import { ChunkProviderGenerate, BiomeTerrainState } from "./terrain-generator.js";
import {
  MineshaftPopulation, normalCubeDefaultIds, POWER_SOURCES, RAIL_BLOCKS, TORCH_STANDS,
  originalBlockMapperReady, generateLiveMineshafts,
} from "./mineshaft-world.js";
import { World } from "./world.js";
import { fromOriginal } from "./block-registry.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/mineshaft-world-reference.json", import.meta.url)));
const config = ref.config;
const worlds = ref.records.filter((r) => r.kind === "world");
const LANDSCAPE = { default: "java", amplified: "javaAmplified", largeBiomes: "javaLargeBiomes" };
const sha1 = (s) => createHash("sha1").update(s).digest("hex");
const piecesText = (start) => JSON.stringify(start.components.map((c) => c.describe()));
const startList = (gen) => gen.structureMap.values().map((s) => ({
  chunk: [s.chunkX, s.chunkZ], bb: s.boundingBox.toArray(), pieceCount: s.components.length, piecesSha1: sha1(piecesText(s)),
}));
// The probe's chunk hash: little-endian int32 id | meta << 12 per (x, z, y).
function cellsSha1(get) {
  const b = Buffer.alloc(65536 * 4);
  let k = 0;
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 0; y < 256; y++, k += 4) {
    const [id, meta] = get(x, y, z);
    b.writeInt32LE(id | meta << 12, k);
  }
  return sha1(b);
}
const arraysSha1 = (t) => cellsSha1((x, y, z) => { const i = (x * 16 + z) * 256 + y; return [t.blocks[i], t.metadata[i]]; });
const stack = (s) => (s ? [s[0], s[1], s[2], (s[3] ?? []).map(([id, lvl]) => [id, lvl])] : null);

// Native provideChunk input: terrain, biome surface, caves and ravines, cached per chunk.
function terrainSource(r) {
  const seed = BigInt(r.seed), state = new BiomeTerrainState(), gen = new ChunkProviderGenerate(seed, r.type, state), manager = gen.manager;
  const topAt = (x, z) => state.topBlock(manager.biomeAt(x, z));
  const caves = new MapGenCaves(seed, manager, topAt), ravines = new MapGenRavine(seed, manager, topAt), cache = new Map();
  return (x, z) => {
    let c = cache.get(`${x},${z}`);
    if (!c) {
      c = gen.provideChunk(x, z);
      caves.generate(x, z, c.blocks); ravines.generate(x, z, c.blocks);
      // Keep an untouched copy: the population world builds its chunks from these arrays.
      c = { blocks: c.blocks.slice(), metadata: c.metadata.slice() };
      cache.set(`${x},${z}`, c);
    }
    return c;
  };
}

function replay(r) {
  const [cx0, cz0] = r.origin, terrain = terrainSource(r);
  const inputs = [];
  for (let x = cx0 - 1; x <= cx0 + 8; x++) for (let z = cz0 - 1; z <= cz0 + 8; z++) inputs.push([x, z, arraysSha1(terrain(x, z))]);
  const pass = new MineshaftPopulation({ seed: BigInt(r.seed), chunkX: cx0, chunkZ: cz0, terrain });
  const w = pass.world, rows = [], drops = [];
  let calls, writes, callCount, writeCount, cartStart;
  w.onCall = (...a) => { callCount++; RecordingWorld.ints(calls, a); };
  w.onWrite = (...a) => { writeCount++; RecordingWorld.ints(writes, a); };
  w.onItem = (x, y, z, item, count, damage) => drops.push([x, y, z, item, count, damage, 10]);
  pass.run({
    beforePopulate() { calls = createHash("sha1"); writes = createHash("sha1"); callCount = 0; writeCount = 0; cartStart = w.carts.length; },
    afterPopulate(x, z, random, result) {
      const carts = w.carts.slice(cartStart).map((e) => [e.x, e.y, e.z, e.slots.map(stack)]);
      if (writeCount > 0 || carts.length || result)
        rows.push({ chunk: [x, z], result, writeCount, writesSha1: writes.digest("hex"), callCount, callsSha1: calls.digest("hex"), carts, nextLong: randomLong(random).toString() });
    },
  });
  const area = [];
  for (let x = cx0; x < cx0 + 8; x++) for (let z = cz0; z < cz0 + 8; z++) {
    const c = w.chunks.get(`${x},${z}`);
    area.push(c ? cellsSha1((a, y, b) => [c.getBlock(a, y, b), c.getMeta(a, y, b)]) : arraysSha1(terrain(x, z)));
  }
  return { pass, terrain, inputs, rows, drops, area };
}

test("GEN-05b live mineshafts: probe block facts match the JS world", () => {
  const ids = Array.from({ length: 256 }, (_, i) => i);
  assert.deepEqual(normalCubeDefaultIds(), config.normalCubeDefault);
  assert.deepEqual(ids.filter((id) => GenWorld.prototype.isNormalCube(id)), config.normalCube);
  assert.deepEqual([...POWER_SOURCES], config.canProvidePower);
  assert.deepEqual([...RAIL_BLOCKS], config.rails);
  assert.deepEqual([...TORCH_STANDS], config.torchStands);
});

const replays = new Map();
test("GEN-05b live mineshafts: load order, start search and mineshaft-only population replay natively", () => {
  assert.equal(worlds.length, 4);
  assert.deepEqual(new Set(worlds.map((r) => r.type)), new Set(["default", "amplified", "largeBiomes"]));
  let rows = 0, writes = 0, carts = 0;
  for (const r of worlds) {
    const got = replay(r), label = r.label;
    replays.set(label, got);
    assert.deepEqual(got.inputs, r.inputs, `${label} provideChunk inputs`);
    assert.deepEqual(got.pass.order, r.populated, `${label} population order`);
    assert.equal(r.populated.length, 81);
    assert.deepEqual(startList(got.pass.mineshafts), r.starts, `${label} starts`);
    assert.equal(got.rows.length, r.chunks.length, `${label} rows`);
    got.rows.forEach((row, i) => {
      const want = r.chunks[i];
      assert.deepEqual({ ...row, carts: null }, { ...want, carts: null }, `${label} chunk ${want.chunk}`);
      assert.deepEqual(row.carts, want.carts.map(([x, y, z, s]) => [x, y, z, s]), `${label} carts ${want.chunk}`);
    });
    assert.deepEqual(got.pass.world.liveSpawners().map((t) => [t.x, t.y, t.z, t.name]), r.spawners, `${label} spawners`);
    assert.equal(got.pass.world.pending.length, r.pendingCount, `${label} pending`);
    assert.deepEqual(got.pass.world.pending, r.pending, `${label} pending`);
    assert.deepEqual(got.drops, r.drops, `${label} drops`);
    assert.deepEqual(got.area, r.areaSha1, `${label} live-area cells`);
    assert.equal(randomLong(got.pass.world.rand).toString(), r.worldNextLong, `${label} World.rand`);
    rows += r.chunks.length; writes += r.chunks.reduce((n, c) => n + c.writeCount, 0); carts += r.chunks.reduce((n, c) => n + c.carts.length, 0);
  }
  assert.ok(rows > 150 && writes > 40000 && carts >= 10, `${rows} ${writes} ${carts}`);
});

test("GEN-05b live mineshafts: generationVersion 10 Java worlds carry the native cells and structure records", async () => {
  await originalBlockMapperReady;
  for (const r of worlds) {
    const got = replays.get(r.label) ?? replay(r), [cx0, cz0] = r.origin, ox = cx0 * 16, oz = cz0 * 16, label = r.label;
    const v10 = new World(r.seed, LANDSCAPE[r.type], 10), v9 = new World(r.seed, LANDSCAPE[r.type], 9);
    assert.deepEqual([v10.originX, v10.originZ], [ox, oz], `${label} origin`);
    assert.equal(v9.generatedStructures, undefined);
    // Cells population changed are fromOriginal of the native cell; every other cell is the v9 cell.
    let changed = 0;
    for (const c of got.pass.world.chunks.values()) {
      const lx = c.x - cx0, lz = c.z - cz0;
      if (lx < 0 || lz < 0 || lx >= 8 || lz >= 8) continue;
      const src = got.terrain(c.x, c.z);
      for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 0; y < 256; y++) {
        const i = (x * 16 + z) * 256 + y, id = c.getBlock(x, y, z), meta = c.getMeta(x, y, z), wx = lx * 16 + x, wz = lz * 16 + z;
        if (id === src.blocks[i] && meta === src.metadata[i]) {
          assert.equal(v10.get(wx, y, wz), v9.get(wx, y, wz));
          assert.equal(v10.getMeta(wx, y, wz), v9.getMeta(wx, y, wz));
          continue;
        }
        const m = fromOriginal(id, meta);
        assert.ok(m, `${label} ${id}:${meta}`);
        assert.deepEqual([v10.get(wx, y, wz), v10.getMeta(wx, y, wz)], [m.id, m.meta], `${label} ${wx},${y},${wz}`);
        changed++;
      }
    }
    assert.ok(changed > 1000, `${label} ${changed}`);
    // Structure records: world-local, native creation order, original item IDs.
    const g = v10.generatedStructures, inArea = (x, z) => x >= ox && z >= oz && x < ox + 128 && z < oz + 128;
    assert.deepEqual(JSON.parse(JSON.stringify(g)), g);
    assert.deepEqual(g.mineshafts.map((m) => [m.chunkX + cx0, m.chunkZ + cz0]),
      r.starts.filter((s) => s.bb[0] <= ox + 127 && s.bb[3] >= ox && s.bb[2] <= oz + 127 && s.bb[5] >= oz).map((s) => s.chunk));
    for (const m of g.mineshafts) {
      const s = r.starts.find((s) => s.chunk[0] === m.chunkX + cx0 && s.chunk[1] === m.chunkZ + cz0);
      assert.deepEqual(m.boundingBox, [s.bb[0] - ox, s.bb[1], s.bb[2] - oz, s.bb[3] - ox, s.bb[4], s.bb[5] - oz]);
    }
    assert.deepEqual(g.spawners, r.spawners.filter(([x, , z]) => inArea(x, z)).map(([x, y, z, entityId]) => ({ x: x - ox, y, z: z - oz, entityId })));
    assert.ok(g.spawners.every((s) => s.entityId === "CaveSpider" && v10.get(s.x, s.y, s.z) === fromOriginal(52).id));
    const carts = r.chunks.flatMap((c) => c.carts).filter(([x, , z]) => inArea(Math.floor(x), Math.floor(z)));
    assert.deepEqual(g.minecartChests, carts.map(([x, y, z, slots]) => ({
      x: x - ox, y, z: z - oz,
      items: slots.flatMap((s, slot) => (s ? [{ slot, id: s[0], damage: s[2], count: s[1], ...(s[3].length ? { stored: s[3].map(([id, lvl]) => ({ id, lvl })) } : {}) }] : [])),
    })), label);
    assert.ok(g.minecartChests.every((c) => c.x % 1 === 0.5 && c.y % 1 === 0.5 && c.z % 1 === 0.5 && c.items.length > 0));
    assert.deepEqual(g.pendingTicks, []);
    assert.equal(g.droppedItems, r.drops.filter(([x, , z]) => inArea(Math.floor(x), Math.floor(z))).length);
  }
});

test("GEN-05b live mineshafts: an unmapped original block throws instead of being dropped", () => {
  const r = worlds[0], [cx0, cz0] = r.origin, terrain = terrainSource(r), originals = new Map();
  for (let x = cx0; x < cx0 + 8; x++) for (let z = cz0; z < cz0 + 8; z++) originals.set(`${x},${z}`, terrain(x, z));
  const world = { originX: cx0 * 16, originZ: cz0 * 16, chunkAt: () => ({ blocks: [], meta: [] }) };
  const mapBlock = (id, meta) => (id === 66 ? null : fromOriginal(id, meta));
  assert.throws(() => generateLiveMineshafts(world, { seed: BigInt(r.seed), originals, ringTerrain: terrain, mapBlock }),
    /unmapped original block 66:\d+ at/);
});
