// The end of 1.7.10 ChunkProviderGenerate.populate after the lakes and dungeons: the biome's
// decorate, SpawnerAnimals.performWorldGenSpawning (creature spawn lists per biome slot,
// WeightedRandom, canCreatureTypeSpawnAtLocation, the sheep fleece roll) and the freeze/snow
// loop (getPrecipitationHeight, World.isBlockFreezable, World.func_147478_e and
// BlockSnow.canPlaceBlockAt). World adapter as gen-world.js, with biomeAt, getSavedBlockLight,
// getPrecipitationHeight and spawnEntity. Spawned animals are plain records; each entity's own
// Random (follow-range bonus, horse type and markings, chicken egg timer) is left out because it
// is unseeded in 1.7.10. Original numeric IDs. Replayed natively in population-tail.test.js.
import { javaTemperature } from "./java-world.js";
import { materialOf } from "./gen-world.js";

const f = Math.fround;
const WATER = 9, FLOWING_WATER = 8, BEDROCK = 7, SNOW_LAYER = 78, ICE = 79, PACKED_ICE = 174;

// BiomeGenBase.spawnableCreatureList entries [entity, weight, min group, max group].
const FARM = [["Sheep", 12, 4, 4], ["Pig", 10, 4, 4], ["Chicken", 10, 4, 4], ["Cow", 8, 4, 4]];
const LISTS = [
  [[0, 2, 7, 10, 11, 12, 13, 16, 17, 24, 25, 26, 37, 38, 39, 130, 140, 165, 166, 167], []],
  [[1, 129], [...FARM, ["EntityHorse", 5, 2, 6]]],
  [[3, 6, 20, 27, 28, 29, 34, 131, 132, 134, 155, 156, 157, 162], FARM],
  [[4, 18], [...FARM, ["Wolf", 5, 4, 4]]],
  [[5, 19, 30, 31, 32, 33, 133, 158, 160, 161], [...FARM, ["Wolf", 8, 4, 4]]],
  [[14, 15], [["MushroomCow", 8, 4, 8]]],
  // BiomeGenJungle adds a second chicken entry.
  [[21, 22, 23, 149, 151], [...FARM, ["Chicken", 10, 4, 4]]],
  [[35, 36, 163, 164], [...FARM, ["EntityHorse", 1, 2, 6]]],
];
export const CREATURES = new Map(LISTS.flatMap(([slots, list]) => slots.map((slot) => [slot, list])));
// BiomeGenBase.getSpawningChance.
export const SPAWN_CHANCE = f(0.1);

// WeightedRandom.getRandomItem.
export function weightedPick(random, list) {
  const total = list.reduce((n, e) => n + e[1], 0);
  if (total <= 0) throw new Error("IllegalArgumentException");
  let j = random.nextInt(total);
  for (const e of list) if ((j -= e[1]) < 0) return e;
  return null;
}

// EntitySheep.getRandomFleeceColor.
export function fleeceColor(random) {
  const n = random.nextInt(100);
  if (n < 5) return 15;
  if (n < 10) return 7;
  if (n < 15) return 8;
  if (n < 18) return 12;
  return random.nextInt(500) === 0 ? 6 : 0;
}

// SpawnerAnimals.canCreatureTypeSpawnAtLocation for creatures: a solid top surface below that is
// not bedrock, and no normal cube or liquid at the feet or normal cube at the head.
export function canCreatureSpawnAt(world, x, y, z) {
  const below = world.getBlock(x, y - 1, z);
  if (!world.solidTop(below, world.getBlockMetadata(x, y - 1, z))) return false;
  if (world.getBlock(x, y - 1, z) === BEDROCK) return false;
  if (world.isNormalCube(world.getBlock(x, y, z))) return false;
  if (world.isLiquid(world.getBlock(x, y, z))) return false;
  return !world.isNormalCube(world.getBlock(x, y + 1, z));
}

// SpawnerAnimals.performWorldGenSpawning. The entry and the sheep fleece come from the world's
// Random, everything else from the population Random. The bounds loop compares z with x + w (sic).
export function performWorldGenSpawning(world, slot, x, z, w, h, random) {
  const list = CREATURES.get(slot);
  if (!list) throw new Error(`population-tail: no creature list for slot ${slot}`);
  if (!list.length) return;
  while (random.nextFloat() < SPAWN_CHANCE) {
    const [name, , min, max] = weightedPick(world.rand, list);
    const count = min + random.nextInt(1 + max - min);
    let px = x + random.nextInt(w), pz = z + random.nextInt(h);
    const ox = px, oz = pz;
    for (let i = 0; i < count; i++) {
      let spawned = false;
      for (let j = 0; !spawned && j < 4; j++) {
        const py = world.getTopSolidOrLiquidBlock(px, pz);
        if (canCreatureSpawnAt(world, px, py, pz)) {
          // setLocationAndAngles(x + 0.5f, y, z + 0.5f, nextFloat() * 360, 0); yOffset is 0.
          const entity = { name, x: f(px + 0.5), y: py, z: f(pz + 0.5), yaw: f(random.nextFloat() * 360), pitch: 0, fleece: -1 };
          world.spawnEntity(entity);
          if (name === "Sheep") entity.fleece = fleeceColor(world.rand);
          spawned = true;
        }
        px += random.nextInt(5) - random.nextInt(5);
        pz += random.nextInt(5) - random.nextInt(5);
        while (px < x || px >= x + w || pz < z || pz >= z + w) {
          px = ox + random.nextInt(5) - random.nextInt(5);
          pz = oz + random.nextInt(5) - random.nextInt(5);
        }
      }
    }
  }
}

const temperatureAt = (world, x, y, z) => javaTemperature(world.biomeAt(x, z), x, y, z);

// World.isBlockFreezable (canBlockFreeze with no water-adjacency check): still or flowing water of
// level 0 in a cold enough spot with saved block light below 10.
export function canBlockFreeze(world, x, y, z) {
  if (temperatureAt(world, x, y, z) > f(0.15)) return false;
  if (y < 0 || y >= 256 || world.getSavedBlockLight(x, y, z) >= 10) return false;
  const id = world.getBlock(x, y, z);
  return (id === WATER || id === FLOWING_WATER) && world.getBlockMetadata(x, y, z) === 0;
}

// BlockSnow.canPlaceBlockAt.
export function canPlaceSnow(world, x, y, z) {
  const below = world.getBlock(x, y - 1, z);
  if (below === ICE || below === PACKED_ICE) return false;
  if (materialOf(below) === "j") return true;
  if (below === SNOW_LAYER && (world.getBlockMetadata(x, y - 1, z) & 7) === 7) return true;
  return world.isOpaqueCube(below) && world.blocksMovement(below);
}

// World.func_147478_e(x, y, z, true): cold enough, dim, air, and a snow layer can stand there.
export function canSnowAt(world, x, y, z) {
  if (temperatureAt(world, x, y, z) > f(0.15)) return false;
  return y >= 0 && y < 256 && world.getSavedBlockLight(x, y, z) < 10 && world.isAirBlock(x, y, z) && canPlaceSnow(world, x, y, z);
}

// populate's last loop over the 16x16 columns offset by 8.
export function freezeAndSnow(world, chunkX, chunkZ) {
  const x0 = chunkX * 16 + 8, z0 = chunkZ * 16 + 8;
  for (let dx = 0; dx < 16; dx++) for (let dz = 0; dz < 16; dz++) {
    const x = x0 + dx, z = z0 + dz, y = world.getPrecipitationHeight(x, z);
    if (canBlockFreeze(world, x, y - 1, z)) world.setBlock(x, y - 1, z, ICE, 0, 2);
    if (canSnowAt(world, x, y, z)) world.setBlock(x, y, z, SNOW_LAYER, 0, 2);
  }
}

// From decorate on: the biome at (x + 16, z + 16), read before decorate, then decorate, animals
// over the 16x16 square offset by 8 with the same Random, then freezing and snow.
export function populateTail(world, random, decoration, chunkX, chunkZ, slot = world.biomeAt(chunkX * 16 + 16, chunkZ * 16 + 16).id) {
  const x = chunkX * 16, z = chunkZ * 16;
  decoration.decorate(world, random, slot, x, z);
  performWorldGenSpawning(world, slot, x + 8, z + 8, 16, 16, random);
  freezeAndSnow(world, chunkX, chunkZ);
  return slot;
}
