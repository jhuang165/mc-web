import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { WorldGenMinable, populationSeed, generateOres, OVERWORLD_ORES } from "./ore-generator.js";
import { JavaRandom } from "./java-random.js";
import { ChunkProviderGenerate, BiomeTerrainState } from "./terrain-generator.js";
import { MapGenCaves, MapGenRavine, randomLong } from "./mapgen.js";
const ref = JSON.parse(readFileSync(new URL("../public/research/population-reference.json", import.meta.url)));
const hash = (blocks) => {
  const bytes = Buffer.alloc(blocks.length * 2);
  for (let i = 0; i < blocks.length; i++) bytes.writeUInt16LE(blocks[i], i * 2);
  return createHash("sha1").update(bytes).digest("hex");
};
class Fixture {
  constructor(name) {
    this.name = name;
    this.edits = new Map();
    this.chunks = new Map();
    this.writes = [];
    this.reads = createHash("sha1");
    this.readCount = 0;
  }
  getBlock(x, y, z) {
    const bytes = Buffer.alloc(12);
    [x, y, z].forEach((v, i) => bytes.writeInt32LE(v, i * 4));
    this.reads.update(bytes);
    this.readCount++;
    if (y < 0 || y >= 256 || x < -30000000 || z < -30000000 || x >= 30000000 || z >= 30000000) return 0;
    const key = `${x},${y},${z}`;
    if (this.edits.has(key)) return this.edits.get(key);
    if (this.name === "natural") {
      const blocks = this.chunks.get(`${x >> 4},${z >> 4}`);
      assert.ok(blocks, `missing ${x},${z}`);
      return blocks[((x & 15) * 16 + (z & 15)) * 256 + y];
    }
    return this.name === "mixed" ? [1, 3, 13, 0, 8, 9, 10, 11, 7, 24, 159, 172, 1, 1, 1, 1][((x + z) % 16 + 16) % 16] : 1;
  }
  setBlock(x, y, z, id, meta, flags) {
    if (y < 0 || y >= 256 || x < -30000000 || z < -30000000 || x >= 30000000 || z >= 30000000) return false;
    this.edits.set(`${x},${y},${z}`, id);
    this.writes.push([x, y, z, id, meta, flags]);
    return true;
  }
}
function check(w, random, r) {
  assert.deepEqual(w.writes, r.writes, `writes ${JSON.stringify([r.kind, r.fixture, r.seed, r.size, r.pos, r.chunk])}`);
  assert.equal(w.readCount, r.readCount);
  assert.equal(w.reads.digest("hex"), r.readSha1);
  assert.equal(randomLong(random).toString(), r.nextLong);
}
test("GEN-04 population seeds: unchanged provider reseeding, signed division, overflow and negative/far chunks", () => {
  for (const r of ref.records.filter(r => r.kind === "populationSeed")) {
    const seed = populationSeed(r.seed, ...r.chunk);
    assert.equal(seed.toString(), r.populationSeed);
    assert.equal(randomLong(new JavaRandom(seed)).toString(), r.nextLong);
  }
});
test("GEN-04 WorldGenMinable: exact native candidate reads, ordered writes and random state", () => {
  for (const r of ref.records.filter(r => r.kind === "vein")) {
    const w = new Fixture(r.fixture), random = new JavaRandom(r.seed);
    assert.equal(new WorldGenMinable(r.ore, r.size, r.target).generate(w, random, ...r.pos), r.result);
    check(w, random, r);
  }
});
test("GEN-04 base decorator: native ore configuration, attempts, precedence, cross-chunk writes and random state", () => {
  for (const r of ref.records.filter(r => r.kind === "ores" && r.fixture !== "natural")) {
    const w = new Fixture(r.fixture), random = new JavaRandom(r.randomSeed), attempts = [];
    assert.deepEqual(OVERWORLD_ORES, r.plan);
    generateOres(w, random, r.chunk[0] * 16, r.chunk[1] * 16, (...row) => attempts.push(row));
    assert.deepEqual(attempts, r.attempts);
    check(w, random, r);
  }
});
test("GEN-04 base ore pass on unchanged native terrain/surface/cave/ravine fixtures", () => {
  for (const r of ref.records.filter(r => r.kind === "ores" && r.fixture === "natural")) {
    const w = new Fixture(r.fixture), random = new JavaRandom(r.randomSeed), attempts = [];
    const terrain = new ChunkProviderGenerate(BigInt(r.seed), "default", new BiomeTerrainState());
    const topAt = (x,z) => terrain.biomeState.topBlock(terrain.manager.biomeAt(x,z));
    const caves = new MapGenCaves(BigInt(r.seed), terrain.manager, topAt), ravines = new MapGenRavine(BigInt(r.seed), terrain.manager, topAt);
    for (const [x, z, sha1] of r.inputs) {
      const { blocks } = terrain.provideChunk(x, z);
      caves.generate(x, z, blocks);
      ravines.generate(x, z, blocks);
      assert.equal(hash(blocks), sha1, `input ${r.seed} ${x},${z}`);
      w.chunks.set(`${x},${z}`, blocks);
    }
    generateOres(w, random, r.chunk[0] * 16, r.chunk[1] * 16, (...row) => attempts.push(row));
    assert.deepEqual(attempts, r.attempts);
    check(w, random, r);
  }
});
