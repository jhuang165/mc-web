// BiomeGenHell, BiomeGenEnd and ChunkProviderHell.getPossibleCreatures (Java 1.7.10): the monster list SpawnerAnimals
// (spawner-animals.js) uses in the Nether (the fortress list inside a fortress's bounds) and the End.
import { NETHER } from "./dimensions.js";
import { HELL_MONSTERS, SKY_MONSTERS } from "./spawn-lists.js";

export function dimensionSpawnList(world, x, y, z) {
  return world.dimension === NETHER ? world.fortressSpawns?.(x, y, z) ?? HELL_MONSTERS : SKY_MONSTERS;
}

// World.getSpawnPoint in any dimension. WorldServerMulti (Nether, End) replaces its WorldInfo with DerivedWorldInfo over the
// Overworld's, so SpawnerAnimals' 24-block exclusion uses the Overworld spawn point everywhere (bytecode: mm.<init> sets x = new ayp(parent info)).
// `record.worldSpawn` is [x, y, z] and is shared by the dimension views of one world.
export function spawnPointOf(record) {
  const s = record?.worldSpawn;
  return Array.isArray(s) && s.length >= 3 && s.every(Number.isFinite) ? { x: s[0], y: s[1], z: s[2] } : null;
}
