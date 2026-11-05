// A reduced SpawnerAnimals pass for the jungle's ocelots (BiomeGenJungle's creature list has Ocelot, weight 2, groups of 1), bytecode-
// derived and not probed beyond the getCanSpawnHere rule (ocelot.js canSpawnHere, recorded in ocelot-reference.json): where the
// original walks every loaded chunk with a random point each, this tries a few random points a tick around the player and spawns
// where EntityOcelot.getCanSpawnHere (grass or leaves below, y >= 63, no entity or liquid, 2 in 3) allows, 24 blocks from the player
// and the world spawn, with the biome from world.biomeAt. The 40-mob save cap and a cap of 10 ocelots (a creature type's
// 10 * chunks / 256 for the loaded area) bound it. The original's chunk-generation spawn and its ~0.1 per-chunk chance are not
// reproduced: ocelots appear while exploring the jungle and a chance here keeps them rare.
import { canSpawnHere } from "./ocelot.js";
import { LEAVES2 } from "./world.js";
const GRASS = 1, LEAVES = 5, JUNGLE_BIOMES = new Set([21, 22, 23, 149, 151]);
export const SPAWN_ATTEMPTS_PER_TICK = 1, SPAWN_CHANCE_PER_TICK = 0.02, OCELOT_CAP = 10;
export function ocelotSpawnPass(m, player, survival, allowed) {
  if (!allowed || m.entities.length >= 40 || Math.random() >= SPAWN_CHANCE_PER_TICK) return 0;
  if (m.entities.filter((e) => e.type === "ocelot").length >= OCELOT_CAP) return 0;
  const world = m.world, rand = m.random;
  const spawn = world.spawn?.() ?? { x: 0, y: 64, z: 0 };
  for (let n = 0; n < SPAWN_ATTEMPTS_PER_TICK; n++) {
    const x = Math.floor(player.x + (rand() * 2 - 1) * 64), z = Math.floor(player.z + (rand() * 2 - 1) * 64);
    if (world.streaming ? !world.isTicking(x, z) : x < 2 || z < 2 || x > (world.maxX ?? 1e9) - 2 || z > (world.maxZ ?? 1e9) - 2) continue;
    if (!JUNGLE_BIOMES.has(world.biomeAt?.(x, z)?.id)) continue;
    // The top solid block of the column (feet one above).
    let y = Math.min(Math.floor(player.y) + 24, (world.height ?? 256) - 2);
    while (y > 0 && world.get(x, y - 1, z) === 0) y--;
    const below = world.get(x, y - 1, z), ok = below === GRASS || below === LEAVES || below === LEAVES2;
    const px = x + 0.5 - player.x, py = y - player.y, pz = z + 0.5 - player.z, sx = x + 0.5 - spawn.x, sz = z + 0.5 - spawn.z;
    if (px * px + py * py + pz * pz < 576 || sx * sx + (y - (spawn.y ?? y)) ** 2 + sz * sz < 576) continue;
    const crowded = m.entities.some((e) => Math.abs(e.x - x - 0.5) < 0.6 && Math.abs(e.z - z - 0.5) < 0.6 && Math.abs(e.y - y) < 1);
    const liquid = [8, 9, 10, 11].includes(world.get(x, y, z));
    const draw = { nextInt: (k) => Math.floor(rand() * k) };
    if (!canSpawnHere({ rand: draw, collides: crowded || world.get(x, y, z) !== 0, liquid, y, below: ok })) continue;
    m.spawnNatural("ocelot", x + 0.5, y, z + 0.5);
    return 1;
  }
  return 0;
}
