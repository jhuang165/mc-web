// Batch 78 mpperf78: dense pen scene for the push benchmark and tests. N animals packed into a pen of `pen` x `pen` blocks beside one player.
import { buildPlayersScene } from './mpperf77-scene.js';
import { lcg } from './mpperf77-scene.js';

export function buildPenScene({ mobs = 200, pen = 14, kind = 'cow', seed = 1, players = 1 } = {}) {
  const s = buildPlayersScene({ players, layout: 'cluster', mobs: 0, dim: 0, seed });
  const host = s.mobs.mobs, rnd = lcg(seed + 99), c = s.players.values().next().value.position;
  host.entities.length = 0;
  const kinds = Array.isArray(kind) ? kind : [kind];
  for (let i = 0; i < mobs; i++) {
    const m = host.create(kinds[i % kinds.length], c.x + 3 + rnd() * pen, 10, c.z + 3 + rnd() * pen);
    m.persistent = true; host.entities.push(m);
  }
  return s;
}
