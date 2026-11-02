import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { JavaRandom } from "./java-random.js";
import { randomLong, MapGenCaves, MapGenRavine } from "./mapgen.js";
import { ChunkProviderGenerate, BiomeTerrainState } from "./terrain-generator.js";
import { populateBeforeDecoration, LAKE_WATER, LAKE_LAVA, DESERT_SLOT, DESERT_HILLS_SLOT } from "./population-stage.js";
const ref = JSON.parse(readFileSync(new URL("../public/research/population-stage-reference.json", import.meta.url)));
const materials = new Map(ref.config.materials.map(([id, solid, liquid]) => [id, { solid, liquid }]));
const mod = (a, b) => ((a % b) + b) % b;
const out = (x, y, z) => y < 0 || y >= 256 || x < -30000000 || z < -30000000 || x >= 30000000 || z >= 30000000;
const int32 = (hash, values) => { const b = Buffer.alloc(values.length * 4); values.forEach((v, i) => b.writeInt32LE(v, i * 4)); hash.update(b); };
class StageWorld {
  constructor(terrain, chunks) {
    this.terrain = terrain; this.chunks = chunks; this.edits = new Map(); this.tiles = new Map();
    this.calls = createHash("sha1"); this.callCount = 0; this.writes = createHash("sha1"); this.writeCount = 0; this.ids = new Map();
  }
  call(...a) { this.callCount++; int32(this.calls, a); }
  getBlock(x, y, z) {
    this.call(0, x, y, z);
    if (out(x, y, z)) return 0;
    const key = `${x},${y},${z}`; if (this.edits.has(key)) return this.edits.get(key);
    return this.chunks.get(`${x >> 4},${z >> 4}`)[((x & 15) * 16 + (z & 15)) * 256 + y];
  }
  isAirBlock(x, y, z) { return this.getBlock(x, y, z) === 0; }
  setBlock(x, y, z, id, meta, flags) {
    this.call(1, x, y, z, id, meta, flags);
    if (out(x, y, z)) return false;
    const key = `${x},${y},${z}`;
    this.edits.set(key, id); this.writeCount++; int32(this.writes, [x, y, z, id, meta, flags]);
    this.ids.set(id, (this.ids.get(id) ?? 0) + 1); this.tiles.delete(key);
    if (id === 54) { const t = { size: 27, slots: Array(27).fill(null), writes: [] }; t.setSlot = (i, s) => { t.slots[i] = s; t.writes.push([i, s]); }; this.tiles.set(key, t); }
    if (id === 52) { const t = { name: "Pig" }; t.setEntityName = (n) => { t.name = n; }; this.tiles.set(key, t); }
    return true;
  }
  setBlockToAir(x, y, z) { return this.setBlock(x, y, z, 0, 0, 3); }
  isSolid(id) { return materials.get(id).solid; }
  isLiquid(id) { return materials.get(id).liquid; }
  getSkyLight(x, y, z) { this.call(2, x, y, z); return mod(x * 31 + y * 7 + z * 17, 5) === 0 ? 0 : 15; }
  biome(x, z) { this.call(3, x, z); return this.terrain.manager.biomeAt(x, z); }
  biomeTop(x, z) { return this.terrain.biomeState.topBlock(this.biome(x, z)); }
  canFreeze(x, y, z) { this.call(4, x, y, z); return mod(x * 7 + z * 13, 11) === 0; }
  getTileEntity(x, y, z) { this.call(5, x, y, z); return this.tiles.get(`${x},${y},${z}`); }
}
function inputs(r) {
  const terrain = new ChunkProviderGenerate(BigInt(r.worldSeed), "default", new BiomeTerrainState());
  const topAt = (x, z) => terrain.biomeState.topBlock(terrain.manager.biomeAt(x, z));
  const caves = new MapGenCaves(BigInt(r.worldSeed), terrain.manager, topAt), ravines = new MapGenRavine(BigInt(r.worldSeed), terrain.manager, topAt);
  const chunks = new Map();
  for (const [x, z, sha1] of r.inputs) {
    const { blocks } = terrain.provideChunk(x, z); caves.generate(x, z, blocks); ravines.generate(x, z, blocks);
    const bytes = Buffer.alloc(blocks.length * 2); blocks.forEach((v, i) => bytes.writeUInt16LE(v, i * 2));
    assert.equal(createHash("sha1").update(bytes).digest("hex"), sha1, `input ${r.worldSeed} ${x},${z}`);
    chunks.set(`${x},${z}`, blocks);
  }
  return new StageWorld(terrain, chunks);
}
function replay(r) {
  const w = inputs(r), random = new JavaRandom(0n), trace = [], structureCalls = [], label = JSON.stringify([r.worldSeed, r.chunk, r.mode]);
  // Stand-ins matching the probe: log the call, draw nothing, report a village only in "village" mode.
  const structures = r.mode === "none" ? null : (rand, cx, cz) => {
    for (const name of ["mineshaft", "village", "stronghold", "scattered"]) structureCalls.push(`${name} ${cx} ${cz}`);
    return r.mode === "village";
  };
  const result = populateBeforeDecoration(w, random, BigInt(r.worldSeed), r.chunk[0], r.chunk[1], { structures, trace });
  assert.deepEqual([result.biome.slot, result.biome.id], r.biome, label);
  assert.deepEqual(trace, r.draws, label);
  assert.deepEqual(structureCalls, r.structureCalls, label);
  assert.equal(w.writeCount, r.writeCount, label);
  assert.equal(w.writes.digest("hex"), r.writeSha1, label);
  assert.deepEqual([...w.ids].sort((a, b) => a[0] - b[0]), r.writeIds, label);
  const tiles = [...w.tiles].map(([key, t]) => t.slots ? [key, "chest", t.slots, t.writes] : [key, "spawner", t.name]);
  assert.deepEqual(tiles, r.tiles, label);
  assert.equal(w.callCount, r.callCount, label);
  assert.equal(w.calls.digest("hex"), r.callSha1, label);
  assert.equal(randomLong(random).toString(), r.nextLong, label);
  return result;
}
test("GEN-04 population stage: native block and biome identities", () => {
  assert.deepEqual([ref.config.water, ref.config.lava], [LAKE_WATER, LAKE_LAVA]);
  assert.deepEqual([ref.config.desert[0], ref.config.desertHills[0]], [DESERT_SLOT, DESERT_HILLS_SLOT]);
});
test("GEN-04 population stage: seed, structure hook, lake gates and eight dungeon attempts up to biome.decorate", () => {
  const seen = new Set();
  for (const r of ref.records) {
    const { events, village } = replay(r);
    assert.equal(village, r.mode === "village");
    assert.equal(events.filter(([f]) => f === "dungeon").length, 8);
    for (const [feature, , , , ok] of events) seen.add(`${feature}:${ok}`);
    // y >= 63 lava attempts draw nextInt(10) and generate only on 0.
    for (const [bound, value] of r.draws) if (bound === 10) seen.add(value === 0 ? "lava:highPass" : "lava:highSkip");
    if (r.biome[0] === DESERT_SLOT || r.biome[0] === DESERT_HILLS_SLOT) seen.add(`desert:${r.biome[0]}`);
  }
  for (const k of ["water:true", "water:false", "lava:true", "lava:false", "lava:highPass", "lava:highSkip", "dungeon:true", "dungeon:false", "desert:2", "desert:17"])
    assert.ok(seen.has(k), k);
});
