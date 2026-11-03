import {populationDrops,populationXp} from './population-content.js';
import { ICE, WATER, WOOL, RED_FLOWER, SNOW_LAYER } from './world.js';
import { snowballsFor, iceLeavesWater } from './snow.js';
import { cropDrops } from './farming.js';
import { leafDrops } from './trees.js';
import { oreExperience } from './experience.js';
import { ITEMS, MATERIALS } from './survival.js';
import { makeStack, copyStack } from './inventory.js';
import { enchantedBreakDrops, javaLikeRandom, playerMiningState } from './enchantment-effects.js';

// The authoritative live player block-break path, with synchronous presentation
// hooks. Random sources stay separate: Math.random drives gravel/crops/ore XP, while
// the tree system's random stream drives leaf drops as it does in the browser.
export function breakPlayerBlock({ world, survival, items, xpOrbs, farming, trees, heldTool }, coords, {
  creative = false,
  random = Math.random,
  leafRandom = trees.random,
  dropRandom = null, // JavaRandom standing in for World.rand (block drop draws); defaults to `random`
  updateBlock = () => {},
  renderHotbar = () => {},
  playBlockSound = () => {},
  destroyParticles = () => {},
  markUnsaved = () => {},
} = {}) {
  const p = coords, block = world.get(...p), key = p.join(','), m = MATERIALS[block] || {}, tool = heldTool;
  if (!block || (block === 11 && !creative)) return false;

  const harvest = creative || playerMiningState(survival, block, tool).harvest;
  let drop = harvest ? (m.drop ?? block) : 0,
    count = block === SNOW_LAYER ? snowballsFor(world.getMeta(...p)) : m.count || 1;
  const shearing = ITEMS[tool]?.kind === 'shears' && survival.count(tool) > 0;
  // Silk Touch / Fortune on the held tool (Block.harvestBlock); shears keep their own drops.
  const heldStack = survival.held,
    enchanted = harvest && !creative && !shearing && heldStack?.id === tool && survival.count(tool) > 0
      ? enchantedBreakDrops(block, world.getMeta(...p), heldStack, block === 5 || block === 71 ? leafRandom : (dropRandom ?? javaLikeRandom(random)))
      : null;
  if (shearing && (block === 5 || block===71 || block === 39)) { drop = block; count = 1; }
  if (!enchanted && block === 25 && random() < 0.1) { drop = 313; count = 1; }
  const crops = enchanted || (shearing && block === 39) ? null : cropDrops(block, random, world.getMeta(...p));
  const leaves = (block === 5||block===71) && harvest && !creative && !shearing && !enchanted
    ? leafDrops(leafRandom, world.getMeta(...p),block).map((d) => ({ ...d, count: 1 }))
    : null;
  const drops = enchanted?.drops ?? (harvest ? populationDrops(block,world.getMeta(...p),{random,shears:shearing}) : null) ?? leaves ?? crops ?? (drop ? [{ id: drop, count }] : []);
  const furnace = survival.furnaces[key], chest = survival.chests[key], meta = world.getMeta(...p);

  if (!world.set(...p, 0)) return false;
  // BlockIce.harvestBlock leaves flowing water over a solid/liquid cell in Survival.
  if (block === ICE && !creative && !enchanted?.silk && iceLeavesWater(world.get(p[0], p[1] - 1, p[2])))
    world.set(...p, WATER, true, 0);
  farming.observe(...p);
  if (furnace) {
    items.spill(furnace.items.filter(Boolean), ...p);
    delete survival.furnaces[key];
  }
  if (chest) {
    const stacks = chest.items.filter(Boolean).map(copyStack);
    items.spill(stacks, ...p);
    delete survival.chests[key];
  }
  if (!creative) {
    items.dropBlock(drops.map((d) => makeStack(
      d.id,
      d.count,
      d.damage ?? (d.id === block && (block === WOOL || block === RED_FLOWER || block === 6 || block === 56 || block === 58 || block === 4 || block === 48 || block===5 || block===71) ? ((block===4||block===5||block===71)?meta&3:block===48?meta&7:meta) : 0),
    )), ...p);
    if (enchanted) { if (enchanted.xp) xpOrbs.spawn(enchanted.xp, { x: p[0] + 0.5, y: p[1] + 0.5, z: p[2] + 0.5 }); }
    else if (drop) xpOrbs.spawn(populationXp(block,random)||oreExperience(block, random), { x: p[0] + 0.5, y: p[1] + 0.5, z: p[2] + 0.5 });
    // BlockMobSpawner.dropBlockAsItemWithChance: experience without an item, when harvested.
    else if (harvest && m.xp) xpOrbs.spawn(m.xp(random), { x: p[0] + 0.5, y: p[1] + 0.5, z: p[2] + 0.5 });
    survival.exhaust(0.025);
    survival.wearBlock(block, tool);
  }
  updateBlock(p[0], p[2], p[1]);
  renderHotbar();
  playBlockSound(false, block);
  destroyParticles(world, ...p, block, meta);
  markUnsaved();
  return true;
}
