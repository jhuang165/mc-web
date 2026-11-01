import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { JavaRandom } from "./lighting.js";
import { getBiome, BIOME_LIST } from "./java-biomes.js";
import {
  NoiseGeneratorImproved,
  NoiseGeneratorOctaves,
  NoiseGeneratorPerlin,
  NoiseGeneratorSimplex,
} from "./noise.js";
import {
  ChunkProviderGenerate,
  BiomeTerrainState,
  terrainIndex,
  chunkSeed,
} from "./terrain-generator.js";
const ref = JSON.parse(
  readFileSync(
    new URL("../public/research/terrain-reference.json", import.meta.url),
  ),
);
const nextLong = (r) =>
  BigInt.asIntN(
    64,
    (BigInt(r.nextInt()) << 32n) + BigInt(r.nextInt()),
  ).toString();
const hash = (a) => {
  const b = Buffer.alloc(a.length * 2);
  for (let i = 0; i < a.length; i++) b.writeUInt16LE(a[i], i * 2);
  return createHash("sha1").update(b).digest("hex");
};
const metaHash = (a) => createHash("sha1").update(a).digest("hex");
const same = (actual, expected, label) =>
  assert.deepEqual(Array.from(actual), expected, label);

test("GEN-02 noise: all original Improved, Octaves, Perlin and Simplex outputs exactly", () => {
  for (const r of ref.records.filter((r) => r.kind === "noise")) {
    const [x, y, z, nx, ny, nz] = r.area,
      random = () => new JavaRandom(BigInt(r.seed));
    const a = new Float64Array(nx * ny * nz);
    new NoiseGeneratorImproved(random()).add(
      a,
      x,
      y,
      z,
      nx,
      ny,
      nz,
      0.125,
      0.25,
      0.3,
      0.7,
    );
    same(a, r.improved, `Improved ${r.seed} ${r.area}`);
    same(
      new NoiseGeneratorOctaves(random(), 4).generate(
        x,
        y,
        z,
        nx,
        ny,
        nz,
        0.125,
        0.25,
        0.3,
      ),
      r.octaves,
      `Octaves ${r.seed}`,
    );
    const perlin = new NoiseGeneratorPerlin(random(), 4);
    same(
      perlin.generate(x, z, nx, nz, 0.125, 0.3, 1.5),
      r.perlin,
      `Perlin ${r.seed}`,
    );
    assert.equal(perlin.value(x * 0.125, z * 0.3), r.point);
    assert.equal(
      new NoiseGeneratorSimplex(random()).value(x * 0.125, z * 0.3),
      r.simplex,
    );
  }
});
test("GEN-02 constructor: all seven generators, parabolic floats and random draw order", () => {
  const mapping = {
    j: "lower",
    k: "upper",
    l: "selector",
    m: "surface",
    a: "scale",
    b: "depth",
    c: "mob",
  };
  for (const r of ref.records.filter((r) => r.kind === "constructor")) {
    const gen = new ChunkProviderGenerate(
      r.seed,
      "default",
      new BiomeTerrainState(),
    );
    for (const [field, expected] of Object.entries(r.fields)) {
      const noise = gen[mapping[field]],
        values =
          field === "m"
            ? noise.generate(-7, 19, 2, 2, 0.125, 0.3, 1.5)
            : noise.generate(-7, 3, 19, 2, 3, 2, 0.125, 0.25, 0.3);
      same(values, expected, `constructor ${r.seed} ${field}`);
    }
    same(gen.parabolic, r.parabolic, "parabolic field");
    assert.equal(nextLong(gen.random), r.nextLong);
  }
});
for (const type of ["default", "amplified", "largeBiomes"])
  test(`GEN-02 ${type}: exact full density, block/metadata hashes, biomes, columns and RNG`, () => {
    let gen, key;
    for (const r of ref.records.filter(
      (r) => r.kind === "chunk" && r.type === type,
    )) {
      if (key !== r.seed) {
        key = r.seed;
        gen = new ChunkProviderGenerate(
          BigInt(r.seed),
          type,
          new BiomeTerrainState(),
        );
      }
      const raw = gen.generateTerrain(r.x, r.z);
      same(gen.densityField, r.density, `density ${r.seed} ${r.x},${r.z}`);
      assert.equal(hash(raw), r.rawSha1, `raw ${r.seed} ${r.x},${r.z}`);
      const chunk = gen.provideChunk(r.x, r.z);
      assert.equal(
        hash(chunk.blocks),
        r.blocksSha1,
        `surface ${r.seed} ${r.x},${r.z}`,
      );
      assert.equal(metaHash(chunk.metadata), r.metadataSha1);
      same(chunk.biomes, r.biomes, "biomes");
      assert.equal(chunkSeed(r.x, r.z).toString(), r.chunkSeed);
      for (const [x, z, [blocks, meta]] of r.columns) {
        const i = terrainIndex(x, 0, z);
        same(chunk.blocks.slice(i, i + 256), blocks, "blocks column");
        same(chunk.metadata.slice(i, i + 256), meta, "metadata column");
      }
      assert.equal(nextLong(gen.random), r.nextLong, "post-surface random");
    }
  });
test("GEN-02 every biome slot: all surface branches and exact random consumption", () => {
  const records = ref.records.filter((r) => r.kind === "surface");
  assert.equal(records.length, BIOME_LIST.filter(Boolean).length);
  for (const r of records) {
    const gen = new ChunkProviderGenerate(
      BigInt(r.seed),
      "default",
      new BiomeTerrainState(),
    );
    for (const [k, c] of r.cases.entries()) {
      const blocks = new Uint16Array(65536),
        metadata = new Uint8Array(65536),
        base = ((c.z & 15) * 16 + (c.x & 15)) * 256;
      for (let y = 0; y <= c.height; y++)
        if (y < 42 || y > 46) blocks[base + y] = 1;
      const explicitAir = c.explicitAir ? new Uint8Array(65536) : null;
      if (explicitAir)
        for (let y = c.height + 1; y < 256; y++) explicitAir[base + y] = 1;
      gen.random = new JavaRandom(1234 + k);
      gen.surfaceColumn(
        getBiome(r.slot),
        blocks,
        metadata,
        c.x,
        c.z,
        c.noise,
        explicitAir,
      );
      same(
        blocks.slice(base, base + 256),
        c.column[0],
        `slot ${r.slot} case ${k} blocks`,
      );
      same(
        metadata.slice(base, base + 256),
        c.column[1],
        `slot ${r.slot} case ${k} metadata`,
      );
      assert.equal(
        nextLong(gen.random),
        c.nextLong,
        `slot ${r.slot} case ${k} RNG`,
      );
    }
  }
});
test("GEN-02 mesa singleton previous-world-seed noise and sequential reuse", () => {
  const state = new BiomeTerrainState();
  for (const r of ref.records.filter((r) => r.kind === "mesaSequence")) {
    const gen = new ChunkProviderGenerate(BigInt(r.seed), "default", state),
      blocks = new Uint16Array(65536),
      metadata = new Uint8Array(65536);
    blocks.fill(1, 0, 100);
    gen.replaceBlocksForBiome(
      0,
      0,
      blocks,
      metadata,
      new Array(256).fill(getBiome(165)),
    );
    assert.equal(hash(blocks), r.blocksSha1);
    assert.equal(metaHash(metadata), r.metadataSha1);
  }
});
test("GEN-02 fixtures include required natural biome families and coordinate/world-type coverage", () => {
  const chunks = ref.records.filter((r) => r.kind === "chunk"),
    ids = new Set(chunks.flatMap((r) => r.biomes));
  for (const id of [0, 3, 6, 32, 37, 163, 165])
    assert.ok(ids.has(id), `natural biome ${id}`);
  assert.ok(chunks.some((r) => r.x < 0));
  assert.ok(chunks.some((r) => Math.abs(r.x) > 1000000));
});
