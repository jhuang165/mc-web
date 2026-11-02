import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { JavaRandom } from "./java-random.js";
import { randomLong, MapGenCaves, MapGenRavine } from "./mapgen.js";
import { ChunkProviderGenerate, BiomeTerrainState } from "./terrain-generator.js";
import { populationSeed } from "./ore-generator.js";
import { getBiome } from "./java-biomes.js";
import { GenWorld } from "./gen-world.js";
import { BiomeDecoration } from "./biome-decorator.js";
import { CREATURES, SPAWN_CHANCE, performWorldGenSpawning, freezeAndSnow, populateTail } from "./population-tail.js";
import { recordedWorld, stateSha1, assertEffects } from "./gen-world-recording.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/population-tail-reference.json", import.meta.url)));
const mod = (a, b) => ((a % b) + b) % b;
const sha1 = (bytes) => createHash("sha1").update(bytes).digest("hex");
const bits = (v) => { const b = Buffer.alloc(4); b.writeFloatLE(v); return b.readInt32LE(); };

function regionTerrain(region) {
  const seed = BigInt(region.seed), terrain = new ChunkProviderGenerate(seed, "default", new BiomeTerrainState());
  const topAt = (x, z) => terrain.biomeState.topBlock(terrain.manager.biomeAt(x, z));
  const caves = new MapGenCaves(seed, terrain.manager, topAt), ravines = new MapGenRavine(seed, terrain.manager, topAt);
  const chunks = region.inputs.map(([x, z, blocksSha1, metaSha1]) => {
    const { blocks, metadata } = terrain.provideChunk(x, z);
    caves.generate(x, z, blocks); ravines.generate(x, z, blocks);
    const bytes = Buffer.alloc(blocks.length * 2); blocks.forEach((v, i) => bytes.writeUInt16LE(v, i * 2));
    assert.equal(sha1(bytes), blocksSha1, `region ${region.index} input ${x},${z}`);
    assert.equal(sha1(Buffer.from(metadata)), metaSha1, `region ${region.index} input meta ${x},${z}`);
    return [x, z, blocks, metadata];
  });
  return { chunks, biomeAt: (x, z) => terrain.manager.biomeAt(x, z) };
}

test("GEN-04i population tail: native creature lists, chances and temperatures", () => {
  const slots = ref.config.biomes.map(([slot]) => slot);
  assert.deepEqual([...CREATURES.keys()].sort((a, b) => a - b), slots);
  for (const [slot, temperature, chance, list] of ref.config.biomes) {
    assert.deepEqual(CREATURES.get(slot), list, `slot ${slot} creatures`);
    assert.equal(bits(SPAWN_CHANCE), chance, `slot ${slot} chance`);
    assert.equal(bits(getBiome(slot).temperature), temperature, `slot ${slot} temperature`);
  }
  // The isNormalCube set gen-world.js keys spawning on.
  const world = new GenWorld();
  assert.deepEqual(Array.from({ length: 256 }, (_, id) => id).filter((id) => id && world.isNormalCube(id)), ref.config.normalCubes);
});

test("GEN-04i population tail: native spawning, freeze/snow and decorate-spawn-snow over terrain", () => {
  // One world's biome objects across every record, in probe order.
  const decoration = new BiomeDecoration(), counts = { entities: 0, ice: 0, snow: 0 };
  for (const region of ref.regions) {
    const { chunks, biomeAt } = regionTerrain(region);
    for (const rec of ref.records.filter((r) => r.region === region.index)) {
      const label = `record ${rec.label} (${rec.mode})`;
      const world = new GenWorld({
        rand: new JavaRandom(BigInt(rec.worldRand)), biomeAt,
        light: (x, y, z) => mod(x * 5 + y * 11 + z * 3 + rec.lightBase, 16),
        blockLight: (x, y, z) => mod(x * 7 + y * 3 + z * 13 + rec.lightBase, 14),
      });
      for (const [x, z, blocks, meta] of chunks) world.addChunk(x, z, blocks, meta);
      const r = recordedWorld(world), entities = [];
      world.onEntity = (e) => entities.push(e);
      const write = world.onWrite;
      world.onWrite = (...a) => { write(...a); if (a[3] === 79) counts.ice++; if (a[3] === 78) counts.snow++; };
      const random = new JavaRandom(BigInt(rec.randSeed));
      for (const [cx, cz, slot, spawned, next] of rec.steps) {
        if (rec.mode === "spawn") for (let i = 0; i < 20; i++) performWorldGenSpawning(world, slot, cx * 16 + 8, cz * 16 + 8, 16, 16, random);
        else if (rec.mode === "snow") freezeAndSnow(world, cx, cz);
        else {
          random.setSeed(populationSeed(BigInt(region.seed), cx, cz));
          assert.equal(populateTail(world, random, decoration, cx, cz), slot, `${label} biome`);
        }
        assert.equal(entities.length, spawned, `${label} chunk ${cx},${cz} entities`);
        assert.equal(randomLong(random).toString(), next, `${label} chunk ${cx},${cz} random`);
      }
      if (rec.again) {
        // The probe's second snow pass after populating the first chunk again from decorate on.
        const [cx, cz, slot, spawned, next] = rec.again;
        random.setSeed(populationSeed(BigInt(region.seed), cx, cz));
        assert.equal(populateTail(world, random, decoration, cx, cz), slot, `${label} again biome`);
        const ex = rec.steps[1][0] * 16 + 8, ez = rec.steps[1][1] * 16 + 8;
        for (let i = 0; i < 256; i += 3) {
          const x = ex + (i & 15), z = ez + (i >> 4), h = world.getPrecipitationHeight(x, z);
          if (i % 4 === 0) world.setBlock(x, h, z, 1, 0, 2);
          else if (i % 4 === 1) world.setBlock(x, h - 1, z, 0, 0, 2);
          else if (i % 4 === 2) world.setBlock(x, h + 2, z, 1, 0, 2);
          else world.setBlock(x, h - 2, z, 0, 0, 2);
        }
        for (const [x, z] of rec.steps) freezeAndSnow(world, x, z);
        assert.equal(entities.length, spawned, `${label} again entities`);
        assert.equal(randomLong(random).toString(), next, `${label} again random`);
      }
      assert.deepEqual(entities.map((e) => [e.name, e.x, e.y, e.z, bits(e.yaw), bits(e.pitch), e.fleece]), rec.entities, `${label} entities`);
      counts.entities += entities.length;
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
  assert.ok(counts.entities > 1000 && counts.ice > 0 && counts.snow > 0, JSON.stringify(counts));
});
