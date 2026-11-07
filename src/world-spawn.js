// World spawn point and player spawn placement (Minecraft Java 1.7.10).
//
// createSpawnPosition ports WorldServer.createSpawnPosition (mt.b): findBiomePosition(0, 0, 256, spawn biomes, new Random(seed)), the
// "Unable to find spawn biome" fallback (0, 0), then up to 1000 steps of x += nextInt(64) - nextInt(64), z likewise, until
// WorldProvider.canCoordinateBeSpawn (surface provider: World.getTopBlock is grass; the check is the same for Superflat, whose top
// block at y 63 is rarely grass, so most flat worlds walk all 1000 steps), and WorldInfo.setSpawnPosition(x, getAverageGroundLevel, z)
// (64, or 4 for WorldType.FLAT). Verified against the unchanged jar: tools/probes/SpawnProbe.java, public/research/spawn-reference.json.
//
// playerSpawnPoint ports the EntityPlayerMP constructor's placement (bytecode-read, not executed): around the world spawn, in a
// non-Adventure world whose provider has sky, x and z move by nextInt(2k) - k with k = max(5, spawnProtectionSize - 6) (16 -> 10), the
// height is World.getTopSolidOrLiquidBlock there, and the player moves up one block at a time while it collides.
import { JavaRandom } from './java-random.js';
import { BIOMES_TO_SPAWN_IN } from './biome-layers.js';

export const SPAWN_WALK_LIMIT = 1000;
const GRASS = 2; // original block id

// World.getTopBlock (ahb.b): from y 63 upward while the cell above is solid, then that cell's block.
export function topBlock(x, z, blockAt) {
  let k = 63;
  while (blockAt(x, k + 1, z) !== 0) k++;
  return blockAt(x, k, z);
}

// WorldProviderSurface.canCoordinateBeSpawn (aqo.a): the top block is grass. blockAt(x, y, z) gives original ids.
export const canCoordinateBeSpawn = (x, z, blockAt) => topBlock(x, z, blockAt) === GRASS;

// WorldServer.createSpawnPosition for a provider with sky. Returns { x, y, z, foundBiome, steps }.
// `mayBeSpawn(x, z)` is an optional necessary condition (never false for a spawnable column) that lets the caller skip expensive
// carving for columns that cannot qualify.
export function createSpawnPosition({ seed, manager, blockAt, mayBeSpawn = null, averageGroundLevel = 64, biomes = BIOMES_TO_SPAWN_IN }) {
  const random = new JavaRandom(seed), found = manager.findBiomePosition(0, 0, 256, biomes, random);
  let x = found ? found[0] : 0, z = found ? found[2] : 0, steps = 0;
  while (!((!mayBeSpawn || mayBeSpawn(x, z)) && canCoordinateBeSpawn(x, z, blockAt))) {
    x += random.nextInt(64) - random.nextInt(64);
    z += random.nextInt(64) - random.nextInt(64);
    if (++steps === SPAWN_WALK_LIMIT) break;
  }
  return { x, y: averageGroundLevel, z, foundBiome: !!found, steps };
}

// World.getTopSolidOrLiquidBlock (ahb.i): from the top down, the first cell whose material blocks movement (Material.blocksMovement,
// false for water and lava despite the method's name, as the probe shows) and is not leaves; returns y + 1, or -1 when there is
// none. `isTop(x, y, z)` is that material test.
export function topSolidOrLiquidBlock(x, z, isTop, height = 256) {
  for (let y = height - 1; y > 0; y--) if (isTop(x, y, z)) return y + 1;
  return -1;
}

// Original-id form of the material test for generated terrain and Superflat layers: the ids whose Material does not block movement
// (air, liquids, plants, snow layer, rails, torches, redstone wire, pressure plates, vines, fire, web and similar logic materials).
const NO_BLOCKING = new Set([0, 6, 8, 9, 10, 11, 27, 28, 30, 31, 32, 37, 38, 39, 40, 50, 51, 55, 59, 63, 66, 68, 69, 70, 72, 75, 76, 77, 78, 83, 106, 115, 131, 132, 143, 157]);
export const originalTerrainIsTop = (blockAt) => (x, y, z) => !NO_BLOCKING.has(blockAt(x, y, z));

// EntityPlayerMP spawn placement. `random` is the entity's java.util.Random (unseeded natively), `spawn` the world spawn [x, y, z],
// `collides(x, y, z)` whether the player's box at that position hits a block, `topSolid(x, z)` getTopSolidOrLiquidBlock.
// Returns the feet position { x, y, z }.
export function playerSpawnPoint({ spawn, random = new JavaRandom(BigInt(Date.now())), adventure = false, hasSky = true, protectionSize = 16, topSolid, collides }) {
  let [x, y, z] = spawn;
  if (hasSky && !adventure) {
    const k = Math.max(5, protectionSize - 6);
    x += random.nextInt(k * 2) - k;
    z += random.nextInt(k * 2) - k;
    y = topSolid(x, z);
  }
  let py = y;
  for (let guard = 0; collides(x + 0.5, py, z + 0.5) && guard < 512; guard++) py += 1;
  return { x: x + 0.5, y: py, z: z + 0.5 };
}
