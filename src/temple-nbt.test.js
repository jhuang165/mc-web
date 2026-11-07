// Witch hut (TeSH) persisted state in data/Temple.dat, replayed against temple-nbt-reference.json
// (tools/verify-temple-nbt.mjs: unchanged native population of chunks that contain the hut).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ChunkProviderGenerate, BiomeTerrainState } from "./terrain-generator.js";
import { MapGenCaves, MapGenRavine } from "./mapgen.js";
import { StructurePopulationArea } from "./structure-population-area.js";
import { decodeNbt } from "./nbt.js";
import { encodeStructureData, decodeStructureData, pieceId, STRUCTURE_PIECE_IDS } from "./structure-nbt.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/temple-nbt-reference.json", import.meta.url)));
const bytesOf = (b64) => new Uint8Array(Buffer.from(b64, "base64"));
function terrainSource(seed) {
  const state = new BiomeTerrainState(), gen = new ChunkProviderGenerate(seed, "default", state), manager = gen.manager;
  const top = (x, z) => state.topBlock(manager.biomeAt(x, z));
  const caves = new MapGenCaves(seed, manager, top), ravines = new MapGenRavine(seed, manager, top), cache = new Map();
  return { manager, terrain: (x, z) => {
    const k = `${x},${z}`; let chunk = cache.get(k);
    if (!chunk) { const c = gen.provideChunk(x, z); caves.generate(x, z, c.blocks); ravines.generate(x, z, c.blocks); chunk = { blocks: c.blocks.slice(), metadata: c.metadata.slice() }; cache.set(k, chunk); }
    return chunk;
  } };
}

test("the Temple data covers witch huts: TeSH is registered and its Witch flag flips once the hut is populated", () => {
  assert.ok(STRUCTURE_PIECE_IDS.includes("TeSH"));
  assert.equal(ref.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.deepEqual(ref.witch.s0_2_46, { created: [0], populated: [1] });
  assert.deepEqual(ref.witch.s0_3_46, { created: [0], populated: [0] }, "hut barely touched by the window: no witch yet");
});

for (const rec of ref.records) test(`witch hut world ${rec.label}: the port writes the native Temple.dat before and after population`, () => {
  const seed = BigInt(rec.seed), [x, z] = rec.chunk, { terrain, manager } = terrainSource(seed);
  const area = new StructurePopulationArea({ seed, chunkX: x, chunkZ: z, terrain, manager });
  let created = null;
  area.run({ beforePopulate: () => { created = Buffer.from(encodeStructureData(area.population.generators.scatteredFeature)).toString("base64"); } });
  const populated = Buffer.from(encodeStructureData(area.population.generators.scatteredFeature)).toString("base64");
  assert.equal(created, rec.created.scatteredFeature);
  assert.equal(populated, rec.populated.scatteredFeature);
  const start = decodeStructureData(bytesOf(populated)).starts[0], hut = start.components.find((c) => pieceId(c) === "TeSH");
  assert.equal(hut.hasWitch, ref.witch[rec.label].populated[0] === 1);
  const tag = [...decodeNbt(bytesOf(populated)).tag.value.get("data").value.get("Features").value.values()][0].value.get("Children").value.items[0];
  assert.equal(tag.get("Witch").value, ref.witch[rec.label].populated[0]);
  assert.deepEqual(encodeStructureData([start]), bytesOf(populated));
});
