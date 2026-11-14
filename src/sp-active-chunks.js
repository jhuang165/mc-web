// Batch 69 spfarming: single player's active chunk set (WorldServer.func_147456_g over World.activeChunkSet).
// Bytecode-read (javap on the 1.7.10 client jar): the integrated server (`bsx.u`) runs every unpaused tick `if (mc.gameSettings.renderDistance != configurationManager.s())
// configurationManager.a(renderDistance)` with no clamp, and `mt.p()` (WorldServer.func_152379_p) returns `oi.s()` (that value), which `ahb.C` uses as the radius r of the square
// [-r, r] x [-r, r] it adds around each player's chunk. So the single-player radius is the render distance option itself (2..16 chunks), not 10. `mt.g` then iterates the HashSet
// in bucket order, which `ChunkSet.order` (server-chunks.js, executed against ActiveChunksProbe) reproduces for the native coordinates.
// Which chunks may tick is unchanged (Weather.activeChunks: the resident ticking window plus the held ring); this only orders them natively and takes the radius from the option.
import { Weather } from './weather.js';
import { ChunkSet } from './multiplayer/server-chunks.js';

// player: () => { x, z } (local coordinates); radius: () => chunks. Returns Weather.activeChunkSource's function.
export function spActiveChunkSource(player, radius) {
  const set = new ChunkSet();
  let key = null, native = [];
  return world => {
    const p = player(), r = Math.max(0, radius() | 0), ox = world?.originX ?? 0, oz = world?.originZ ?? 0;
    const eligible = Weather.activeChunks(p.x, p.z, r, world);
    if (ox % 16 || oz % 16) return eligible; // an origin off the chunk grid cannot be ordered from whole chunks (not seen in single player)
    const gx = ox / 16, gz = oz / 16, centre = [Math.floor((p.x + ox) / 16), Math.floor((p.z + oz) / 16)], k = `${r}|${centre}`;
    if (k !== key) { key = k; native = set.order([centre], r); }
    const have = new Map();
    for (const e of eligible) have.set(`${e[0] + gx},${e[1] + gz}`, e);
    const out = [];
    for (const [nx, nz] of native) { const e = have.get(`${nx},${nz}`); if (e) out.push(e); }
    return out;
  };
}
