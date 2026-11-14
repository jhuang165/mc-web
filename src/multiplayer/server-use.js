// Batch 64 mpstats2: items that ItemStack.tryPlaceItemIntoWorld applies to the clicked block on the dedicated server and that the block-placing path does not cover:
//   * seeds, carrots, potatoes, melon and pumpkin seeds (ItemSeeds.onItemUse: farmland below, air above, the top face) and nether wart on soul sand, with the single-player rules
//     (player-edit-simulation.js plant-crop / plant-nether-wart); the item is taken outside Creative;
//   * a spawn egg on a block (ItemMonsterPlacer.onItemUse, spawn-egg-use.js useEggOnBlock): the mob joins this dimension's mobs, and the stack is spent only when a mob was created.
// Each returns true when the click was the item's (the click is used up even when nothing happens), and the use statistic (StatList.objectUseStats) follows every `true`
// ItemStack.tryPlaceItemIntoWorld got back: the caller counts it with `sim.stats.used`. Flint and steel is counted where it is applied (server-dimensions.js useItem).
import { plantedBlock } from '../crops.js';
import { NETHER_WART, ITEM_NETHER_WART } from '../nether-wart.js';
import { SOUL_SAND } from '../nether-blocks.js';
import { isCrop } from '../world.js';
import { ITEM_SPAWN_EGG } from '../spawn-eggs.js';
import { useEggOnBlock, eggMobType } from '../spawn-egg-use.js';
import { ITEMS } from '../survival.js';
import { SUPPORTED, MOB_LIMIT } from './server-mobs.js';

export function useOnBlock(sim, p, target, id) {
  const s = p.survival, [x, y, z] = target.block, block = sim.world.get(x, y, z), item = ITEMS[id];
  const sound = (name, volume, pitch, at) => sim.soundsOut.push({ name, ...at, volume, pitch, except: null, dim: p.dimension | 0 });
  if (id === ITEM_NETHER_WART) {
    if (!((s.creative || s.usable(id)) && target.adjacent?.[1] === y + 1 && block === SOUL_SAND && sim.world.get(x, y + 1, z) === 0 && y + 1 < (sim.world.height ?? 128) - 1)) return false;
    sim.world.set(x, y + 1, z, NETHER_WART, true, 0);
    if (!s.creative) s.take(id);
    sound('step.grass', 0.5, 1, { x: x + 0.5, y: y + 1, z: z + 0.5 });
    return sim.stats.used(p, id), true;
  }
  if (plantedBlock(id)) {
    if ((s.creative || s.usable(id)) && target.adjacent?.[1] === y + 1 && sim.farming.plant(x, y, z, id)) {
      if (!s.creative) s.take(id);
      sim.farming.drain(); // the mesh updates are the clients' own (the cell change goes out with the world's edits)
      sound('step.grass', 0.5, 1, { x: x + 0.5, y: y + 1, z: z + 0.5 });
      return sim.stats.used(p, id), true;
    }
    return !item?.food || block === 29 || block === 30 || isCrop(block); // a blocked planting on farmland or a crop is still a used click (no stat: ItemSeeds returned false)
  }
  if (id === ITEM_SPAWN_EGG) {
    const type = eggMobType(s.held?.damage ?? 0), mobs = sim.mobs?.mobs;
    if (!mobs || (type && !(SUPPORTED.has(type) && mobs.entities.length < MOB_LIMIT))) { sim.stats.used(p, id); return true; } // a kind the server does not keep: nothing spawns, nothing is spent
    useEggOnBlock({ world: sim.world, survival: s, mobs }, target, {});
    sim.stats.used(p, id); // ItemMonsterPlacer.onItemUse returns true whether or not a mob was created
    return true;
  }
  return false;
}
