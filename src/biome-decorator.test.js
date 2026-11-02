import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { JavaRandom } from "./java-random.js";
import { randomLong, MapGenCaves, MapGenRavine } from "./mapgen.js";
import { ChunkProviderGenerate, BiomeTerrainState } from "./terrain-generator.js";
import { populationSeed } from "./ore-generator.js";
import { DECORATOR_COUNTS } from "./decoration-features.js";
import { BiomeTrees } from "./tree-generators.js";
import { GenWorld } from "./gen-world.js";
import { BiomeDecorator, BiomeDecorators, pickFlower } from "./biome-decorator.js";
import { recordedWorld, stateSha1, assertEffects } from "./gen-world-recording.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/biome-decorator-reference.json", import.meta.url)));
const mod = (a, b) => ((a % b) + b) % b;
const sha1 = (bytes) => createHash("sha1").update(bytes).digest("hex");

// Native terrain, biome blocks, caves and ravines for each 4x4 region, checked against the probe inputs.
function regionChunks(region) {
  const seed = BigInt(region.seed), terrain = new ChunkProviderGenerate(seed, "default", new BiomeTerrainState());
  const topAt = (x, z) => terrain.biomeState.topBlock(terrain.manager.biomeAt(x, z));
  const caves = new MapGenCaves(seed, terrain.manager, topAt), ravines = new MapGenRavine(seed, terrain.manager, topAt);
  return region.inputs.map(([x, z, blocksSha1, metaSha1]) => {
    const { blocks, metadata } = terrain.provideChunk(x, z);
    caves.generate(x, z, blocks); ravines.generate(x, z, blocks);
    const bytes = Buffer.alloc(blocks.length * 2); blocks.forEach((v, i) => bytes.writeUInt16LE(v, i * 2));
    assert.equal(sha1(bytes), blocksSha1, `region ${region.index} input ${x},${z}`);
    assert.equal(sha1(Buffer.from(metadata)), metaSha1, `region ${region.index} input meta ${x},${z}`);
    return [x, z, blocks, metadata];
  });
}

test("GEN-04g decorator: native slots, biome classes and counts", () => {
  const classes = new Map(ref.config.biomes.map(([slot, biome, decorator, param]) => [slot, { biome, decorator, param }]));
  for (const slot of ref.config.slots) {
    assert.ok(DECORATOR_COUNTS.has(slot), `counts ${slot}`);
    assert.equal(classes.get(slot).decorator, "aia");
  }
  // The flower picker overrides keyed in biome-decorator.js.
  assert.deepEqual(ref.config.biomes.filter(([, b]) => b === "aip").map(([s]) => s), [1, 129]);
  assert.deepEqual(ref.config.biomes.filter(([, b]) => b === "aiv").map(([s]) => s), [6]);
  assert.deepEqual(ref.config.biomes.filter(([, b, , p]) => b === "aif" && p === 1).map(([s]) => s), [132]);
  assert.deepEqual(pickFlower(6, new JavaRandom(1n), 0, 64, 0), [38, 1]);
  const d = new BiomeDecorator(0);
  d.world = {};
  assert.throws(() => d.decorate(new GenWorld(), new JavaRandom(0n), 0, 0, 0, new BiomeTrees()), /Already decorating!!/);
});

test("GEN-04g decorator: native genDecorations over terrain, caves and ravines", () => {
  // One world's biome objects across every record, in probe order (shared tree generator state).
  const trees = new BiomeTrees(), decorators = new BiomeDecorators(), seen = new Set();
  for (const region of ref.regions) {
    const chunks = regionChunks(region);
    for (const rec of ref.records.filter((r) => r.region === region.index)) {
      const label = `record ${rec.label}`;
      const world = new GenWorld({ rand: new JavaRandom(BigInt(rec.worldRand)), light: (x, y, z) => mod(x * 5 + y * 11 + z * 3 + rec.lightBase, 16) });
      for (const [x, z, blocks, meta] of chunks) world.addChunk(x, z, blocks, meta);
      const r = recordedWorld(world);
      for (const [cx, cz, slot, ps, next] of rec.decorations) {
        const seed = populationSeed(BigInt(region.seed), cx, cz);
        assert.equal(seed.toString(), ps, `${label} population seed`);
        const random = new JavaRandom(seed);
        decorators.get(slot).decorate(world, random, slot, cx * 16, cz * 16, trees);
        assert.equal(randomLong(random).toString(), next, `${label} chunk ${cx},${cz} slot ${slot}`);
        seen.add(slot);
      }
      assert.equal(r.callCount, rec.callCount, `${label} calls`);
      assert.equal(r.calls.digest("hex"), rec.callSha1, `${label} call order`);
      assert.equal(r.writeCount, rec.writeCount, `${label} writes`);
      assert.equal(r.writes.digest("hex"), rec.writeSha1, `${label} write order`);
      assert.equal(world.pending.length, rec.pendingCount, `${label} pending`);
      assert.equal(sha1(world.pending.map((p) => JSON.stringify(p)).join(",")), rec.pendingSha1, `${label} pending order`);
      assertEffects(r, rec, label);
      assert.equal(stateSha1(world), rec.stateSha1, `${label} state`);
      assert.equal(randomLong(world.rand).toString(), rec.worldNextLong, `${label} world random`);
    }
  }
  assert.deepEqual([...seen].sort((a, b) => a - b), [...ref.config.slots].sort((a, b) => a - b));
});
