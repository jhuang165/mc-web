// Minecraft Java 1.7.10 ChunkProviderGenerate.populate from its first line
// through the eight dungeon attempts, stopping where biome.decorate begins.
// World adapter (original numeric IDs): biome(x,z) -> java-biomes entry
// (getBiomeGenForCoords), the WorldGenLakes services (getBlock, setBlock,
// isSolid, isLiquid, getSkyLight, biomeTop, canFreeze) and the WorldGenDungeons
// services (isAirBlock, setBlockToAir, getTileEntity). `random` is the
// provider's Random; it is reseeded here and left at the decorator's input.
import { populationSeed } from "./ore-generator.js";
import { WorldGenLakes } from "./lake-generator.js";
import { WorldGenDungeons } from "./dungeon-generator.js";

// Blocks.water / Blocks.lava (still IDs) and the BiomeGenBase.desert /
// desertHills singletons, compared by registry slot.
export const LAKE_WATER = 9, LAKE_LAVA = 11, DESERT_SLOT = 2, DESERT_HILLS_SLOT = 17;

// `structures(random, chunkX, chunkZ)` stands in for the mapFeaturesEnabled
// branch: it must run mineshaft, village, stronghold and scattered features in
// that order on the same Random and return the village result. Omitted means
// map features are off. `trace` collects the provider's own [bound, value]
// nextInt draws; features draw on the same stream but are not traced.
export function populateBeforeDecoration(world, random, worldSeed, chunkX, chunkZ, { structures = null, trace = null } = {}) {
  const x0 = chunkX * 16, z0 = chunkZ * 16;
  const biome = world.biome(x0 + 16, z0 + 16); // Read before reseeding.
  random.setSeed(populationSeed(worldSeed, chunkX, chunkZ));
  const draw = (bound) => { const v = random.nextInt(bound); trace?.push([bound, v]); return v; };
  const village = structures ? structures(random, chunkX, chunkZ) === true : false;
  const events = [];
  if (biome.slot !== DESERT_SLOT && biome.slot !== DESERT_HILLS_SLOT && !village && draw(4) === 0) {
    const x = x0 + draw(16) + 8, y = draw(256), z = z0 + draw(16) + 8;
    events.push(["water", x, y, z, new WorldGenLakes(LAKE_WATER).generate(world, random, x, y, z)]);
  }
  if (!village && draw(8) === 0) {
    const x = x0 + draw(16) + 8, y = draw(draw(248) + 8), z = z0 + draw(16) + 8;
    // The extra nextInt(10) is drawn only at y >= 63.
    if (y < 63 || draw(10) === 0)
      events.push(["lava", x, y, z, new WorldGenLakes(LAKE_LAVA).generate(world, random, x, y, z)]);
  }
  for (let i = 0; i < 8; i++) {
    const x = x0 + draw(16) + 8, y = draw(256), z = z0 + draw(16) + 8;
    events.push(["dungeon", x, y, z, new WorldGenDungeons().generate(world, random, x, y, z)]);
  }
  return { biome, village, events };
}
