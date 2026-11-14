// Batch 64 mpstats2: items that ItemStack.tryPlaceItemIntoWorld applies to the clicked block on the dedicated server and that the block-placing path does not cover:
//   * seeds, carrots, potatoes, melon and pumpkin seeds (ItemSeeds.onItemUse: farmland below, air above, the top face) and nether wart on soul sand, with the single-player rules
//     (player-edit-simulation.js plant-crop / plant-nether-wart); the item is taken outside Creative;
//   * a spawn egg on a block (ItemMonsterPlacer.onItemUse, spawn-egg-use.js useEggOnBlock): the mob joins this dimension's mobs, and the stack is spent only when a mob was created.
// Each returns true when the click was the item's (the click is used up even when nothing happens), and the use statistic (StatList.objectUseStats) follows every `true`
// ItemStack.tryPlaceItemIntoWorld got back: the caller counts it with `sim.stats.used`. Flint and steel is counted where it is applied (server-dimensions.js useItem).
import { plantedBlock } from '../crops.js';
import { NETHER_WART, ITEM_NETHER_WART } from '../nether-wart.js';
import { SOUL_SAND } from '../nether-blocks.js';
import { SAPLING, isCrop, DYE, FIRE, YELLOW_FLOWER, RED_FLOWER } from '../world.js';
import { growGrass, JRandom } from '../flowers.js';
import { ITEM_SPAWN_EGG, ITEM_FIRE_CHARGE } from '../spawn-eggs.js';
import { useEggOnBlock, eggMobType } from '../spawn-egg-use.js';
import { ITEMS } from '../survival.js';
import { SUPPORTED, MOB_LIMIT } from './server-mobs.js';

const FLOWERS = { yellow: YELLOW_FLOWER, red: RED_FLOWER };

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
  // b65 mpstats3: ItemFireball.onItemUse (bytecode-read): returns false only when the player may not edit; otherwise the cell on the clicked face takes fire when it is air,
  // the charge is spent outside Creative and the click is `true` whatever the cell held, so ItemStack.tryPlaceItemIntoWorld counts the use stat every time.
  if (id === ITEM_FIRE_CHARGE) {
    if (s.adventure) return false;
    const q = target.adjacent, w = sim.world;
    if (q && q[1] >= 0 && q[1] < (w.height ?? 256) && (!w.inside || w.inside(...q)) && w.get(...q) === 0) {
      sound('fire.ignite', 1, Math.fround(Math.fround(sim.soundRand.nextFloat() * Math.fround(0.4)) + Math.fround(0.8)), { x: q[0] + 0.5, y: q[1] + 0.5, z: q[2] + 0.5 });
      if (p.dimension) w.set(q[0], q[1], q[2], FIRE, true, 0); else sim.fire.ignite(...q);
    }
    if (!s.creative) s.take(id);
    return sim.stats.used(p, id), true;
  }
  // ItemDye.onItemUse with bone meal (damage 15; ItemDye.func_150919_a, bytecode-read): true only on a block that can be fertilised (IGrowable.func_149851_a: a sapling and a
  // grass block always, a crop or stem below its last stage). The stack is spent and the use stat counted whether or not the growth roll then succeeds (a sapling's 45 %).
  // Mushrooms, double plants and cocoa are not modelled on the server (the single-player bone meal does not do them either).
  if (id === DYE && s.held?.damage === 15) {
    if (s.adventure || (!s.creative && !s.usable(id))) return false;
    let grown = false;
    if (block === SAPLING) { sim.trees.boneMeal(x, y, z); grown = true; }
    else if (block === 1) { sim.boneRandom ??= new JRandom(Date.now()); growGrass(sim.world, FLOWERS, sim.boneRandom, sim.world.biome, x, y, z); grown = true; }
    else if (sim.farming.fertilize(x, y, z)) { sim.farming.drain(); grown = true; }
    if (!grown) return false;
    if (!s.creative) s.take(id);
    return sim.stats.used(p, id), true;
  }
  return false;
}
