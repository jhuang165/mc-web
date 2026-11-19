// b83 mppiston83: the dedicated server's LiveRedstone `drop` hook. Before it the server's redstone had none, so nothing the engine drops reached the world: a piston
// destroying a mobility-1 block (BlockPistonBase.tryExtend: dropBlockAsItem, then setBlockToAir) and every redstone component that loses its support (dust, torches,
// levers, buttons, plates, repeaters, comparators, tripwire and hooks, the extended base behind a broken head, powered rails) vanished without an item, and a pot's
// stored plant with it. The engine already applies doTileDrops (gameRule, which the server sets) and draws the native offset (world.rand * 0.7F + 0.15 three times,
// Block.dropBlockAsItem_do), so the item spawns at that position with pickup delay 10 and no second spread. Like the other world-system drops
// (ServerItems.stacksDrop) a Creative world keeps none. `itemsOf()` is the dimension's ItemEntities.
import { spawnRedstoneDrop } from '../redstone-drops.js';

export const serverRedstoneDrop = (sim, itemsOf) => (x, y, z, stack) => {
  if (!sim.serverItems?.survival) return;
  spawnRedstoneDrop(itemsOf(), x, y, z, stack);
};
