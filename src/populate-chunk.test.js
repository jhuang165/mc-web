import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { JavaRandom } from "./java-random.js";
import { randomLong, MapGenCaves, MapGenRavine } from "./mapgen.js";
import { ChunkProviderGenerate, BiomeTerrainState } from "./terrain-generator.js";
import { GenWorld } from "./gen-world.js";
import { BiomeDecoration } from "./biome-decorator.js";
import { populateChunk } from "./populate-chunk.js";
import { recordedWorld, stateSha1, assertEffects } from "./gen-world-recording.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/populate-chain-reference.json", import.meta.url)));
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

// The probe's tile listing: chunks in long-key order (z unsigned), entries by y, z, x.
function tiles(world) {
  const chunks = [...world.chunks.values()].sort((a, b) => a.x - b.x || (a.z >>> 0) - (b.z >>> 0));
  return chunks.flatMap((c) => [...c.tiles.values()].sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x)
    .map((t) => [t.x, t.y, t.z, t.kind, t.kind === "chest" ? t.slots : t.name, false]));
}

test("GEN-04j populate chain: lakes, dungeons with chests and spawners, decorate, animals and snow", () => {
  // One world's biome objects across every record, in probe order.
  const decoration = new BiomeDecoration(), counts = { chests: 0, spawners: 0, entities: 0, lakes: 0, removed: 0 };
  for (const region of ref.regions) {
    const { chunks, biomeAt } = regionTerrain(region), seed = BigInt(region.seed);
    for (const rec of ref.records.filter((r) => r.region === region.index)) {
      const label = `record ${rec.label}`;
      const world = new GenWorld({
        rand: new JavaRandom(BigInt(rec.worldRand)), biomeAt,
        light: (x, y, z) => mod(x * 5 + y * 11 + z * 3 + rec.lightBase, 16),
        blockLight: (x, y, z) => mod(x * 7 + y * 3 + z * 13 + rec.lightBase, 14),
        skyLight: (x, y, z) => mod(x * 3 + y * 5 + z * 7 + rec.lightBase, 16),
      });
      for (const [x, z, blocks, meta] of chunks) world.addChunk(x, z, blocks, meta);
      const r = recordedWorld(world), entities = [];
      world.onEntity = (e) => entities.push(e);
      // The provider's Random, seeded with the world seed and reseeded by each populate.
      const random = new JavaRandom(seed);
      for (const [cx, cz, biome, spawned, next] of rec.steps) {
        const { biome: read, events } = populateChunk(world, random, seed, decoration, cx, cz);
        assert.equal(read.id, biome, `${label} chunk ${cx},${cz} biome`);
        assert.equal(entities.length, spawned, `${label} chunk ${cx},${cz} entities`);
        assert.equal(randomLong(random).toString(), next, `${label} chunk ${cx},${cz} random`);
        counts.lakes += events.filter(([f, , , , ok]) => f !== "dungeon" && ok).length;
      }
      assert.deepEqual(entities.map((e) => [e.name, e.x, e.y, e.z, bits(e.yaw), bits(e.pitch), e.fleece]), rec.entities, `${label} entities`);
      assert.deepEqual(tiles(world), rec.tiles, `${label} tile entities`);
      {
        // The probe's removal pass: by x, z, y, chests emptied slot by slot and set to air with
        // notification, spawners overwritten with stone at flag 2.
        const all = [...world.chunks.values()].flatMap((c) => [...c.tiles.values()]).sort((a, b) => a.x - b.x || a.z - b.z || a.y - b.y);
        for (const t of all) {
          if (t.kind === "chest") { for (let i = 0; i < 27; i++) world.setChestSlot(t, i, null); world.setBlockToAir(t.x, t.y, t.z); }
          else world.setBlock(t.x, t.y, t.z, 1, 0, 2);
        }
        assert.deepEqual(tiles(world), rec.removed, `${label} removed tile entities`);
        counts.removed += all.length;
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
      for (const t of rec.tiles) counts[t[3] === "chest" ? "chests" : "spawners"]++;
      counts.entities += entities.length;
    }
  }
  assert.ok(counts.chests >= 20 && counts.spawners >= 20 && counts.entities > 0 && counts.lakes > 0 && counts.removed >= 20, JSON.stringify(counts));
});
