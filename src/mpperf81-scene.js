// Batch 81 mpperf81: a pen of mixed mobs over mixed terrain (every block id with random metadata, water and lava pools, fire), for tools/bench-alloc81.mjs and
// mpperf81-b81.test.js: the mob moves meet fences, stairs, slabs, snow, webs, soul sand, cactus, liquids and the other shaped or metadata-dependent boxes.
import { buildPenScene } from './mpperf78-scene.js';
import { lcg } from './mpperf77-scene.js';
import { BLOCKS, WATER, LAVA, FIRE } from './world.js';

export const TERRAIN_KINDS = ['cow', 'zombie', 'pig', 'spider', 'sheep', 'skeleton', 'chicken', 'creeper', 'villager', 'wolf', 'slime', 'enderman', 'horse', 'iron_golem', 'cave_spider', 'witch'];
export function buildTerrainPen({ mobs = 120, pen = 14, seed = 1, kind = TERRAIN_KINDS, density = 0.22 } = {}) {
  const s = buildPenScene({ mobs, pen, kind, seed });
  const w = s.world, rnd = lcg(seed * 31 + 7), c = s.players.values().next().value.position;
  const x0 = Math.floor(c.x) + 1, z0 = Math.floor(c.z) + 1, span = pen + 4;
  for (let x = x0; x < x0 + span; x++)
    for (let z = z0; z < z0 + span; z++) {
      const r = rnd();
      if (r < 0.04) w.put(x, 10, z, WATER, Math.floor(rnd() * 8), false);
      else if (r < 0.055) w.put(x, 10, z, LAVA, Math.floor(rnd() * 8), false);
      else if (r < 0.06) w.put(x, 10, z, FIRE, 0, false);
      else if (r < 0.06 + density) {
        const id = 1 + Math.floor(rnd() * (BLOCKS.length - 1));
        w.put(x, 10 + (rnd() < 0.2 ? 1 : 0), z, id, Math.floor(rnd() * 16), false);
      }
    }
  return s;
}
