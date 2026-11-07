// Biome decoration audit with map features ON: the unchanged ChunkProviderGenerate over small areas that hold villages,
// temples, mineshafts and strongholds in several biomes (public/research/biome-audit-structures-reference.json from
// tools/verify-structure-area.mjs with STRUCTURE_AREAS_FILE=tools/probes/biome-audit-structure-areas.json), replayed through
// StructurePopulationArea: structure populate order and the provider Random they share with lakes, dungeons and the biome's decorate.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ChunkProviderGenerate, BiomeTerrainState } from "./terrain-generator.js";
import { MapGenCaves, MapGenRavine } from "./mapgen.js";
import { StructurePopulationArea, structureChunkSha1 } from "./structure-population-area.js";

const reference = JSON.parse(readFileSync(new URL("../public/research/biome-audit-structures-reference.json", import.meta.url)));
const wanted = JSON.parse(readFileSync(new URL("../tools/probes/biome-audit-structure-areas.json", import.meta.url)));
const bits = (n) => { const b = Buffer.alloc(4); b.writeFloatLE(n); return b.readInt32LE(); };
const stack = (s) => s ? [s[0], s[1], s[2], (s[3] ?? []).map(([id, level]) => [id, level])] : null;

function terrainSource(seed) {
  const state = new BiomeTerrainState(), gen = new ChunkProviderGenerate(seed, "default", state), manager = gen.manager;
  const top = (x, z) => state.topBlock(manager.biomeAt(x, z));
  const caves = new MapGenCaves(seed, manager, top), ravines = new MapGenRavine(seed, manager, top), cache = new Map();
  const terrain = (x, z) => {
    const k = `${x},${z}`; let chunk = cache.get(k);
    if (!chunk) {
      const c = gen.provideChunk(x, z); caves.generate(x, z, c.blocks); ravines.generate(x, z, c.blocks);
      chunk = { blocks: c.blocks.slice(), metadata: c.metadata.slice() }; cache.set(k, chunk);
    }
    return chunk;
  };
  return { terrain, manager };
}
function tileRow(world, t) {
  const head = [t.x, t.y, t.z];
  switch (t.kind) {
    case "chest": case "dispenser": case "furnace": return [...head, t.kind, world.getBlockMetadata(t.x, t.y, t.z), t.slots.map(stack)];
    case "spawner": return [...head, "spawner", t.name];
    case "flowerPot": return [...head, "flowerPot", t.item, t.data];
    default: throw new Error(`unexpected tile kind ${t.kind}`);
  }
}
const sortTiles = (rows) => rows.sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);
const entityRow = (e) => e.type === "Villager" ? ["Villager", e.x, e.y, e.z, 0, e.profession] : e.type === "Witch" ? ["Witch", e.x, e.y, e.z, bits(e.yaw), -1] : [e.name, e.x, e.y, e.z, bits(e.yaw), -1];

test("structure audit areas are the requested labels and cover every structure kind", () => {
  assert.deepEqual(reference.records.map((r) => `${r.label}:${r.seed}:${r.origin[0]}:${r.origin[1]}:${r.size}`), wanted);
  const kinds = new Set(reference.records.flatMap((r) => Object.entries(r.starts).filter(([, v]) => v.length).map(([k]) => k)));
  for (const k of ["mineshaft", "village", "stronghold", "scatteredFeature"]) assert.ok(kinds.has(k), `${k} start in an audit area`);
});

for (const rec of reference.records) {
  test(`structure audit ${rec.label} (seed ${rec.seed}, ${rec.size}x${rec.size} at ${rec.origin}) replays native populate`, () => {
    const { terrain, manager } = terrainSource(BigInt(rec.seed)), [cx, cz] = rec.origin;
    const area = new StructurePopulationArea({ seed: BigInt(rec.seed), chunkX: cx, chunkZ: cz, size: rec.size, terrain, manager, traceWorldRand: true, relaxRedstone: rec.label.startsWith("jungleTemple") }).run();
    area.world.onCall = null; area.world.onWrite = null;
    assert.deepEqual(area.order.map(([x, z]) => `${x},${z}`), rec.steps.map((s) => s.chunk.join(",")), "populate order");
    for (const input of rec.inputs) assert.equal(area.searchRows.find((r) => r.chunk[0] === input[0] && r.chunk[1] === input[1]).inputSha1, input[2], `provideChunk bytes ${input.slice(0, 2)}`);
    for (const [name, generator] of Object.entries(area.population.generators)) {
      const starts = generator.structureMap.values().map((s) => [[s.chunkX, s.chunkZ], s.boundingBox.toArray(), s.components.length]);
      assert.deepEqual(starts, rec.starts[name], `${name} start maps`);
    }
    area.steps.forEach((row, i) => {
      const native = rec.steps[i], at = `${rec.label} chunk ${native.chunk}`;
      assert.equal(row.writeCount, native.writeCount, `ordered writes ${at}`);
      assert.equal(row.writesSha1, native.writesSha1, `ordered write hash ${at}`);
      assert.equal(row.nextLong, native.providerNextLong, `provider Random ${at}`);
      assert.equal(row.worldNextLong, native.worldNextLong, `World.rand ${at}`);
      assert.equal(row.callCount, native.callCount, `ordered world calls ${at}`);
      assert.equal(row.callsSha1, native.callsSha1, `ordered call hash ${at}`);
    });
    const tilesByChunk = new Map(), entitiesByChunk = new Map();
    for (const c of area.world.chunks.values()) for (const t of c.tiles.values()) {
      const k = `${t.x >> 4},${t.z >> 4}`; (tilesByChunk.get(k) ?? tilesByChunk.set(k, []).get(k)).push(tileRow(area.world, t));
    }
    for (const e of area.world.animals) {
      const k = `${Math.floor(e.x) >> 4},${Math.floor(e.z) >> 4}`; (entitiesByChunk.get(k) ?? entitiesByChunk.set(k, []).get(k)).push(entityRow(e));
    }
    for (const native of rec.chunks) {
      const k = native.chunk.join(","), at = `${rec.label} chunk ${k}`;
      assert.equal(structureChunkSha1(area.world.chunk(...native.chunk)), native.sha1, `final chunk hash ${at}`);
      assert.deepEqual(sortTiles(tilesByChunk.get(k) ?? []), native.tiles, `tiles ${at}`);
      assert.deepEqual(entitiesByChunk.get(k) ?? [], native.entities, `entities ${at}`);
    }
    assert.deepEqual(area.world.carts.map((e) => [e.x, e.y, e.z, e.slots.map(stack)]), rec.carts, "carts");
    assert.deepEqual(area.world.pending, rec.pending, "pending ticks");
    assert.deepEqual(area.world.items.map((d) => [d.x, d.y, d.z, d.item, d.count, d.damage, 10]), rec.drops, "drops");
  });
}
