import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { JavaRandom } from "./java-random.js";
import { randomLong, MapGenCaves, MapGenRavine } from "./mapgen.js";
import { ChunkProviderGenerate, BiomeTerrainState } from "./terrain-generator.js";
import { populationSeed } from "./ore-generator.js";
import { GenWorld } from "./gen-world.js";
import { BiomeDecoration, BIOME_DECORATE } from "./biome-decorator.js";
import {
  WorldGenDoublePlant, WorldGenDesertWells, WorldGenMelon, WorldGenVines, WorldGenIceSpike, WorldGenIcePath,
  WorldGenBlockBlob, MOSSY_COBBLESTONE, DOUBLE_PLANT,
} from "./biome-features.js";
import { recordedWorld, stateSha1, assertEffects } from "./gen-world-recording.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/biome-overrides-reference.json", import.meta.url)));
const mod = (a, b) => ((a % b) + b) % b;
const sha1 = (bytes) => createHash("sha1").update(bytes).digest("hex");

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

function generator(kind) {
  switch (kind) {
    case "well": return new WorldGenDesertWells();
    case "spike": return new WorldGenIceSpike();
    case "path": return new WorldGenIcePath(4);
    case "blob": return new WorldGenBlockBlob(MOSSY_COBBLESTONE, 0);
    case "melon": return new WorldGenMelon();
    case "vines": return new WorldGenVines();
  }
  const g = new WorldGenDoublePlant();
  if (kind !== "dpbreak") g.setType(+kind.slice(2));
  return g;
}

// The probe's breakPlants: each bottom half in turn loses its soil, its top or itself, notifying.
function breakPlants(world, x0, y0, z0) {
  let k = 0;
  for (let x = x0 - 8; x <= x0 + 8; x++) for (let z = z0 - 8; z <= z0 + 8; z++) for (let y = y0 - 4; y <= y0 + 4; y++) {
    if (world.getBlock(x, y, z) !== DOUBLE_PLANT || (world.getBlockMetadata(x, y, z) & 8) !== 0) continue;
    world.setBlock(x, y + (k % 3 === 0 ? -1 : k % 3 === 1 ? 1 : 0), z, 0, 0, 3);
    k++;
  }
}

function assertRecord(world, r, rec, label) {
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

const freshWorld = (rec, chunks) => {
  const world = new GenWorld({ rand: new JavaRandom(BigInt(rec.worldRand)), light: (x, y, z) => mod(x * 5 + y * 11 + z * 3 + rec.lightBase, 16) });
  for (const [x, z, blocks, meta] of chunks) world.addChunk(x, z, blocks, meta);
  return world;
};

// Classes without a decorate override (BiomeGenMesa only calls super).
const BASE_CLASSES = new Set(["aio", "aiv", "air", "aim", "aht", "aiu", "ail"]);

test("GEN-04h overrides: native biome classes and parameters", () => {
  for (const [slot, cls, param] of ref.config.biomes) {
    if (BASE_CLASSES.has(cls)) assert.ok(!BIOME_DECORATE.has(slot) && param === -1, `slot ${slot} ${cls} runs the base decorate`);
    else assert.deepEqual(BIOME_DECORATE.get(slot), [cls, param], `slot ${slot}`);
  }
  assert.equal(BIOME_DECORATE.size, ref.config.biomes.filter(([, cls]) => !BASE_CLASSES.has(cls)).length);
  assert.deepEqual(ref.config.blocks, [175, 103, 106, 174, 129, 97, 48, 24, 44, 80, 79, 12, 8]);
});

test("GEN-04h overrides: native generators and biome decorate over terrain, caves and ravines", () => {
  const decoration = new BiomeDecoration(), seen = new Set();
  assert.equal(ref.regions.length, 10);
  for (const region of ref.regions) {
    const chunks = regionChunks(region);
    for (const rec of ref.features.filter((r) => r.region === region.index)) {
      const label = `feature ${rec.label}`, world = freshWorld(rec, chunks), r = recordedWorld(world);
      const random = new JavaRandom(BigInt(rec.randSeed)), gen = generator(rec.feature);
      rec.origins.forEach(([x, y, z], i) => {
        assert.equal(y, world.getHeightValue(x, z) + (rec.feature === "well" ? 1 : 0), `${label} origin ${i}`);
        if (rec.feature === "dpbreak") gen.setType(i % 6);
        assert.equal(gen.generate(world, random, x, y, z), rec.results[i], `${label} result ${i}`);
        if (rec.feature === "dpbreak") breakPlants(world, x, y, z);
      });
      assert.equal(randomLong(random).toString(), rec.nextLong, `${label} random`);
      assertRecord(world, r, rec, label);
    }
    for (const rec of ref.records.filter((r) => r.region === region.index)) {
      const label = `decorate ${rec.label}`, world = freshWorld(rec, chunks), r = recordedWorld(world);
      for (const [cx, cz, slot, ps, next] of rec.decorations) {
        const seed = populationSeed(BigInt(region.seed), cx, cz);
        assert.equal(seed.toString(), ps, `${label} population seed`);
        const random = new JavaRandom(seed);
        decoration.decorate(world, random, slot, cx * 16, cz * 16);
        assert.equal(randomLong(random).toString(), next, `${label} chunk ${cx},${cz} slot ${slot}`);
        seen.add(slot);
      }
      assertRecord(world, r, rec, label);
    }
  }
  assert.deepEqual([...seen].sort((a, b) => a - b), [...ref.config.slots].sort((a, b) => a - b));
});
