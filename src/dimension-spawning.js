// BiomeGenHell, BiomeGenEnd and ChunkProviderHell.getPossibleCreatures (Java 1.7.10).
import { END, NETHER } from "./dimensions.js";
import { solidTopSurface } from "./doors-panes.js";
import { weightedPick } from "./population-tail.js";
import { isLiquid, normalCube } from "./world.js";

const HELL = [["Ghast", 50, 4, 4], ["PigZombie", 100, 4, 4], ["LavaSlime", 1, 4, 4]];
const SKY = [["Enderman", 10, 4, 4]];
const TYPES = { Ghast: "ghast", PigZombie: "pigman", LavaSlime: "magma_cube", Enderman: "enderman", Blaze: "blaze" };
const BEDROCK = 11; // internal block ID
const distanceSq = (x, y, z, p) => (x - p.x) ** 2 + (y - p.y) ** 2 + (z - p.z) ** 2;

export function dimensionSpawnList(world, x, y, z) {
  return world.dimension === NETHER ? world.fortressSpawns?.(x, y, z) ?? HELL : SKY;
}

export function dimensionSpawnType(name, random) {
  if (name === "Skeleton") return random.nextInt(5) > 0 ? "wither_skeleton" : "skeleton";
  return TYPES[name];
}

function spawnCell(world, x, y, z, player) {
  if (y < 1 || y >= world.actualHeight - 1 || !world.isTicking(x, z)) return false;
  const feet = world.get(x, y, z), floor = world.get(x, y - 1, z);
  return floor !== BEDROCK && solidTopSurface(world, x, y - 1, z) &&
    !normalCube(feet) && !isLiquid(feet) && !normalCube(world.get(x, y + 1, z)) &&
    distanceSq(x + 0.5, y, z + 0.5, player) >= 24 ** 2;
}

// Adapt the native monster pass to the six-by-six ticking window (36 of the native
// 256 cap slots). Sampling two pack starts per tick bounds work in the browser.
export function spawnDimensionMonsters(mobs, player, random, hooks, hostileTypes) {
  const { world, entities } = mobs;
  if (world.dimension !== NETHER && world.dimension !== END) return;
  let count = entities.filter(e => e.health > 0 && hostileTypes.has(e.type) && world.isTicking(e.x, e.z)).length;
  const cap = Math.floor(70 * 36 / 256) + 1;
  if (count >= cap) return;
  const gx = Math.floor(player.x / 16), gz = Math.floor(player.z / 16);
  for (let attempt = 0; attempt < 2 && count < cap; attempt++) {
    const x0 = (gx + random.nextInt(6) - 3) * 16 + random.nextInt(16);
    const z0 = (gz + random.nextInt(6) - 3) * 16 + random.nextInt(16);
    // The End's exposed island floors lie at the column surface. Nether spawn
    // attempts must sample beneath the bedrock ceiling, across all cave levels.
    const y = world.dimension === END ? world.surface(x0, z0) : random.nextInt(world.actualHeight);
    if (!spawnCell(world, x0, y, z0, player)) continue;
    const list = dimensionSpawnList(world, x0, y, z0);
    const [name, , min, max] = weightedPick(random, list);
    const group = min + random.nextInt(max - min + 1), packLimit = name === "Ghast" ? 1 : group;
    let x = x0, z = z0, spawned = 0;
    for (let i = 0; i < group * 3 && spawned < packLimit && count < cap; i++) {
      if (i) {
        x += random.nextInt(6) - random.nextInt(6);
        z += random.nextInt(6) - random.nextInt(6);
      }
      if (!spawnCell(world, x, y, z, player) || dimensionSpawnList(world, x, y, z) !== list) continue;
      const type = dimensionSpawnType(name, random);
      const e = hooks.createMob(type, x + 0.5, y, z + 0.5, random.nextFloat() * 360);
      if (!e || !hooks.canSpawnHere(e)) continue;
      e.naturalDimensionSpawn = true;
      hooks.initMob(e);
      hooks.addMob(e);
      spawned++;
      count++;
    }
  }
}
