// The live beacon tick (TileEntityBeacon.updateEntity) for the world's tiles: every 80 world ticks the pyramid check and
// the effects for players in range. `players` carries the local player; remote worlds never apply effects. `full(tile)`: the
// check just took this pyramid from below 4 levels to 4 (the Beaconator achievement, pyramid.js fullBeaconReach).
import { BEACON, tickBeacon } from './pyramid.js';
import { canSeeSky } from './weather.js';

export function tickBeacons(beacons, { world, time, players, apply, full = null }) {
  if (!beacons.tiles.size || time % 80 !== 0) return;
  const get = (x, y, z) => world.get(x, y, z), sky = (x, y, z) => canSeeSky(world, x, y, z);
  for (const [key, tile] of beacons.tiles) {
    if (world.streaming && !world.isLoaded(tile.x, tile.z)) continue;
    if (get(tile.x, tile.y, tile.z) !== BEACON) { beacons.tiles.delete(key); continue; }
    const before = tile.levels | 0;
    for (const { player, effects } of tickBeacon(tile, { time, get, canSeeSky: sky, players })) for (const e of effects) apply(player, e);
    if (full && tile.levels === 4 && before < 4) full(tile);
  }
}
