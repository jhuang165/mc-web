// Batch 66 mpend3: an End saved by 0.93.0 (the 128 x 128 window, `window: legacy` or no field) is moved into the 256 x 256 window when the world loads.
//
// Native coordinates do not change: a legacy cell (lx, lz) is native (lx - 25, lz - 96); in the full window the same native cell is (nx + 128, nz + 128). So every stored
// coordinate of the End moves by (+103, +32): edits, tile maps, tile entities, scheduled ticks, redstone, falling blocks, crops, items, orbs, mobs (the dragon and its target),
// vehicles, the End's projectile lane and the players who stand in the End. The terrain itself is not stored (only edits are): the 256 window is generated from the world's seed
// by the End generator as for a new End (server-end.js fillEnd), so the newly visible area appears by itself.
// Crystals: natively a spike's crystal is made when its chunk is populated, which happens at the End's first load for every chunk that exists. A window of 128 left the spikes
// outside it (and the ones cut by its edge) without crystals, so an upgraded End with a living dragon gets exactly those crystals (`addEndCrystals`, server-dragon.js); a
// crystal the players already destroyed inside the old window stays destroyed, and an End whose dragon is dead (or from b63, which has no dragon field) gets none.
// The upgrade runs on the plain save record, before any system reads it (DedicatedSimulation constructor), and is a no-op for an End already `full`.
import { END_WINDOWS } from './client-dimensions.js';

const OLD = END_WINDOWS.legacy, NEW = END_WINDOWS.full;
export const UPGRADE_SHIFT = Object.freeze({ x: NEW.x - OLD.x, z: NEW.z - OLD.z }); // (+103, +32)
const DX = UPGRADE_SHIFT.x, DZ = UPGRADE_SHIFT.z;
// Keys that hold a position's x or z in saved rows (mobs, items, orbs, vehicles, projectiles, ticks, spawners): the dragon's target (tx, tz), a ghast's wander point (wx, wz) and
// an arrow's or fireball's stuck cell (xTile, zTile) are positions too. Motion (vx, mx), look (yaw) and the y coordinates are not touched.
const X_KEYS = new Set(['x', 'px', 'tx', 'wx', 'xTile']), Z_KEYS = new Set(['z', 'pz', 'tz', 'wz', 'zTile']);

export function shiftRows(v) { // in place, any depth
  if (Array.isArray(v)) { for (const e of v) shiftRows(e); return v; }
  if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) {
      const e = v[k];
      if (typeof e === 'number') { if (X_KEYS.has(k)) v[k] = e + DX; else if (Z_KEYS.has(k)) v[k] = e + DZ; } else if (e && typeof e === 'object') shiftRows(e);
    }
  }
  return v;
}
const key = k => { const [x, y, z] = String(k).split(',').map(Number); return `${x + DX},${y},${z + DZ}`; };
const rekey = o => { const out = {}; for (const k of Object.keys(o ?? {})) out[key(k)] = o[k]; return out; };
const xyz = t => { if (Array.isArray(t)) { t[0] += DX; t[2] += DZ; } return t; }; // a tuple [x, y, z, ...]

// The End record of the save (`dimensions.end`) in the new window; a copy, the argument is left alone.
export function upgradeEndRecord(rec) {
  const out = structuredClone(rec);
  if (Array.isArray(out.edits)) out.edits = out.edits.map(([k, v]) => [key(k), v]);
  if (out.tiles) for (const name of Object.keys(out.tiles)) out.tiles[name] = rekey(out.tiles[name]);
  for (const name of ['signs', 'skulls', 'items', 'falling', 'mobs', 'xpOrbs', 'vehicles']) if (out[name]) shiftRows(out[name]);
  if (out.tileEntities) shiftRows(out.tileEntities);
  for (const name of ['fluidTicks', 'fireTicks', 'fallingTicks']) if (out[name]?.entries) shiftRows(out[name].entries);
  if (Array.isArray(out.farms)) out.farms = out.farms.map(([k, v]) => [key(k), v]);
  const r = out.redstone;
  if (r) {
    for (const name of ['pending', 'deferred', 'torches', 'pistons']) if (Array.isArray(r[name])) r[name].forEach(xyz);
    if (Array.isArray(r.events)) for (const list of r.events) if (Array.isArray(list)) list.forEach(xyz);
    if (Array.isArray(r.lit)) r.lit = r.lit.map(key);
    if (Array.isArray(r.comparators)) r.comparators = r.comparators.map(([k, s]) => [key(k), s]);
  }
  out.window = 'full';
  out.upgradedFrom = 'legacy'; // read once by ServerEnd.ensure (crystals of the new spikes); not written again after the End has been built
  return out;
}

export const isLegacyEnd = rec => !!rec && typeof rec === 'object' && rec.window !== 'full';

// The whole save: the End record, the End's projectile lane and the players saved in the End. Returns the same object when there is no legacy End.
export function upgradeLegacyEnd(saved) {
  const rec = saved?.dimensions?.end;
  if (!isLegacyEnd(rec)) return saved;
  const out = { ...saved, dimensions: { ...saved.dimensions, end: upgradeEndRecord(rec) } };
  const lane = saved.projectiles?.lanes?.[1];
  if (lane) out.projectiles = { ...saved.projectiles, lanes: { ...saved.projectiles.lanes, 1: shiftRows(structuredClone(lane)) } };
  if (Array.isArray(saved.players)) {
    out.players = saved.players.map(entry => {
      const [id, p] = entry;
      if (p?.dimension !== 1 || !p.position) return entry;
      return [id, { ...p, position: { ...p.position, x: p.position.x + DX, z: p.position.z + DZ } }];
    });
  }
  return out;
}
