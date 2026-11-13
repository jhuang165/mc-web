// Client half of S37 (batch 63 mpstats). The server's `{ type: 'stats', stats: { id: value }, full }` message carries absolute values: the first one after the join (`full`) replaces
// the local counters (the client's own counting is only a stand-in until then), later ones overwrite just the stats they name (StatFileWriter.func_150872_a).
import { isStat, MAX_STAT } from '../stats.js';

export function applyStatsMessage(stats, m) {
  if (!m || typeof m.stats !== 'object' || !m.stats) return 0;
  if (m.full === true) stats.values.clear();
  let n = 0;
  for (const [id, v] of Object.entries(m.stats)) {
    if (!isStat(id) || !Number.isFinite(v) || v < 0) continue;
    if (v > 0) stats.values.set(id, Math.min(MAX_STAT, Math.trunc(v))); else stats.values.delete(id);
    n++;
  }
  return n;
}
