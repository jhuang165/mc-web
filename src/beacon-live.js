// The live beacon tick (TileEntityBeacon.updateEntity) for the world's tiles: every 80 world ticks the pyramid check and
// the effects for players in range. `players` carries the local player; remote worlds never apply effects.
import { BEACON, tickBeacon } from './beacon.js';
import { canSeeSky } from './weather.js';

export function tickBeacons(beacons, { world, time, players, apply }) {
  if (!beacons.tiles.size || time % 80 !== 0) return;
  const get = (x, y, z) => world.get(x, y, z), sky = (x, y, z) => canSeeSky(world, x, y, z);
  for (const [key, tile] of beacons.tiles) {
    if (world.streaming && !world.isLoaded(tile.x, tile.z)) continue;
    if (get(tile.x, tile.y, tile.z) !== BEACON) { beacons.tiles.delete(key); continue; }
    for (const { player, effects } of tickBeacon(tile, { time, get, canSeeSky: sky, players })) for (const e of effects) apply(player, e);
  }
}
