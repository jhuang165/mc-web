// b83 mppiston83: the dedicated server's LiveRedstone `drop` hook. Before it the server's redstone had none, so nothing the engine drops reached the world: a piston
// destroying a mobility-1 block (BlockPistonBase.tryExtend: dropBlockAsItem, then setBlockToAir) and every redstone component that loses its support (dust, torches,
// levers, buttons, plates, repeaters, comparators, tripwire and hooks, the extended base behind a broken head, powered rails) vanished without an item, and a pot's
// stored plant with it. The engine already applies doTileDrops (gameRule, which the server sets) and draws the native offset (world.rand * 0.7F + 0.15 three times,
// Block.dropBlockAsItem_do), so the item spawns at that position with pickup delay 10 and no second spread. Like the other world-system drops
// (ServerItems.stacksDrop) a Creative world keeps none. `itemsOf()` is the dimension's ItemEntities.
import { spawnRedstoneDrop } from '../redstone-drops.js';
import { installSkullBreak } from '../skull.js';
import { makeStack } from '../inventory.js';
import { ruleOn } from '../game-rules.js';

export const serverRedstoneDrop = (sim, itemsOf) => (x, y, z, stack) => {
  // b84 drops84: Creative worlds drop too. 1.7.10 skips drops only for a Creative player's own harvest (ItemInWorldManager.tryHarvestBlock, harvested = false),
  // not for a piston, a support loss or any other setBlock; the old Survival-only gate was the port's convention.
  spawnRedstoneDrop(itemsOf(), x, y, z, stack);
};

// b84 drops84: BlockSkull.breakBlock on the server (skull.js installSkullBreak): any setBlock that replaces a skull (explosions, /setblock, /fill, the dragon, fire, a
// piston's own path aside, which consumes the tile itself) drops its item into the dimension's ItemEntities with the native spread, under doTileDrops.
export const installServerSkullBreak = (sim, world, skulls, itemsOf) => installSkullBreak(world, skulls, (stacks, x, y, z) => {
  if (!ruleOn(sim, 'doTileDrops')) return;
  itemsOf().dropBlock(stacks.map(d => makeStack(d.id, d.count, d.damage || 0, undefined, d.tags)), x, y, z);
});
