// Batch 78 falling78: EntityFallingBlock.TileEntityData on the dedicated server.
// The server's FallingBlocks used to be built without the `tile` hook, so a landed block kept its saved TileEntityData unapplied (b77 follow-up). This is the same code as single
// player (falling-tiles.js applyFallingTileData) over the stores of one dimension. `dim` is the Simulation itself or a dimension state (`n` of server-nether.js): both have
// world, tiles (the Survival with chests, furnaces, dispensers, hoppers and brewing stands), tileEntities (signs, skulls, beacons, spawners), redstone and dirtyTiles.
// Command blocks have no tile store on the server (only command block carts run commands there), so a falling command block's data is not applied.
import { applyFallingTileData } from '../falling-tiles.js';
import { musicOf } from './server-music.js';

export function serverFallingTile(dim) {
  return (x, y, z, block, data, dataByte) => {
    const te = dim.tileEntities;
    const host = { survival: dim.tiles, signs: te?.signs, spawners: te?.spawners, skulls: te?.skulls, beacons: te?.beacons, world: dim.world, music: dim.redstone ? musicOf(dim.redstone) : null, comparators: dim.redstone?.tiles };
    // the description packet (S33 / S35) goes out with the next tick's cell changes
    if (applyFallingTileData({ block, x, y, z, data, dataByte, host })) dim.dirtyTiles?.add(`${x},${y},${z}`);
  };
}
