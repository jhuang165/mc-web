// BiomeGenHell, BiomeGenEnd and ChunkProviderHell.getPossibleCreatures (Java 1.7.10): the monster list SpawnerAnimals
// (spawner-animals.js) uses in the Nether (the fortress list inside a fortress's bounds) and the End.
import { NETHER } from "./dimensions.js";
import { HELL_MONSTERS, SKY_MONSTERS } from "./spawn-lists.js";

export function dimensionSpawnList(world, x, y, z) {
  return world.dimension === NETHER ? world.fortressSpawns?.(x, y, z) ?? HELL_MONSTERS : SKY_MONSTERS;
}
