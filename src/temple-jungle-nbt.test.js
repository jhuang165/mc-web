// Jungle pyramid (TeJP) persisted populated flags in data/Temple.dat, replayed against the native populated state recorded in
// structure-nbt-reference.json (tools/verify-structure-nbt.mjs: the two jungle census worlds, seeds 5 and 1). Populating the
// temple runs the original redstone wire / lever / repeater / sticky piston / tripwire onBlockAdded and neighbour updates
// (StructureRedstone over RedstoneWorld) instead of the relaxed inert path.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ChunkProviderGenerate, BiomeTerrainState } from "./terrain-generator.js";
import { MapGenCaves, MapGenRavine } from "./mapgen.js";
import { StructurePopulationArea } from "./structure-population-area.js";
import { StructureRedstone } from "./structure-redstone.js";
import { encodeStructureData, decodeStructureData, pieceId } from "./structure-nbt.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/structure-nbt-reference.json", import.meta.url)));
const bytesOf = (b64) => new Uint8Array(Buffer.from(b64, "base64"));
function terrainSource(seed, type) {
  const state = new BiomeTerrainState(), gen = new ChunkProviderGenerate(seed, type, state), manager = gen.manager;
  const top = (x, z) => state.topBlock(manager.biomeAt(x, z));
  const caves = new MapGenCaves(seed, manager, top), ravines = new MapGenRavine(seed, manager, top), cache = new Map();
  return { manager, terrain: (x, z) => {
    const k = `${x},${z}`; let chunk = cache.get(k);
    if (!chunk) { const c = gen.provideChunk(x, z); caves.generate(x, z, c.blocks); ravines.generate(x, z, c.blocks); chunk = { blocks: c.blocks.slice(), metadata: c.metadata.slice() }; cache.set(k, chunk); }
    return chunk;
  } };
}
const FLAGS = ["placedMainChest", "placedHiddenChest", "placedTrap1", "placedTrap2"];
const jungle = ref.records.filter((r) => r.label === "s5_-50_-48" || r.label === "s1_46_3");

test("the reference holds two native jungle pyramids with different populated flags", () => {
  assert.equal(jungle.length, 2);
  const flags = jungle.map((r) => FLAGS.map((f) => {
    const piece = decodeStructureData(bytesOf(r.baseline.populated.scatteredFeature)).starts[0].components[0];
    assert.equal(pieceId(piece), "TeJP");
    return piece[f];
  }));
  assert.deepEqual(flags, [[true, false, false, true], [false, true, false, false]]);
});

for (const rec of jungle) test(`jungle pyramid world ${rec.label}: populating with the live redstone rules writes the native Temple.dat`, () => {
  const seed = BigInt(rec.seed), [x, z] = rec.chunk, { terrain, manager } = terrainSource(seed, rec.type);
  const area = new StructurePopulationArea({ seed, chunkX: x, chunkZ: z, terrain, manager });
  assert.ok(area.redstone instanceof StructureRedstone);
  let notified = 0;
  const original = area.redstone.notifyBlockOfNeighborChange.bind(area.redstone);
  area.redstone.notifyBlockOfNeighborChange = (...args) => { notified++; return original(...args); };
  let created = null;
  area.run({ beforePopulate: () => { created = Buffer.from(encodeStructureData(area.population.generators.scatteredFeature)).toString("base64"); } });
  assert.ok(notified > 0, "the wire onBlockAdded neighbour notifications ran through the redstone rules");
  assert.equal(created, rec.created.scatteredFeature);
  const populated = encodeStructureData(area.population.generators.scatteredFeature);
  assert.deepEqual(populated, bytesOf(rec.baseline.populated.scatteredFeature));
  const piece = decodeStructureData(populated).starts[0].components[0];
  assert.equal(pieceId(piece), "TeJP");
  assert.equal(piece.placedMainChest || piece.placedHiddenChest || piece.placedTrap1 || piece.placedTrap2, true, "the populate window placed something");
});
