// Minecraft Java 1.7.10 ChunkProviderGenerate.populate with map features off, on one gen-world.js
// world: the biome at (x + 16, z + 16) read before the reseed, the water and lava lakes and eight
// dungeon attempts (population-stage.js), then the biome's decorate, worldgen animals and the
// freeze/snow loop (population-tail.js), all on the provider's Random. Structures are not run.
// Replayed natively in populate-chunk.test.js.
import { populateBeforeDecoration } from "./population-stage.js";
import { populateTail } from "./population-tail.js";

// `decoration` is the BiomeDecoration holding every biome's decorator state; `random` is reseeded
// here and left where populate leaves it.
export function populateChunk(world, random, worldSeed, decoration, chunkX, chunkZ) {
  const { biome, events } = populateBeforeDecoration(world, random, worldSeed, chunkX, chunkZ);
  populateTail(world, random, decoration, chunkX, chunkZ, biome.slot);
  return { biome, events };
}
