// Batch 66 bonemeal2: ItemDye.func_150919_a (bone meal) for every IGrowable of 1.7.10, shared by single player (player-edit-simulation.js) and the dedicated server
// (multiplayer/server-use.js). One `useBoneMeal(host, x, y, z)` call is the native method: it returns `used` (IGrowable.func_149851_a, canFertilize: the stack is spent and the
// use stat counted) and applies the growth (func_149852_a gate, then func_149853_b) with the world Random. Executed evidence: public/research/bone-meal-reference.json
// (tools/probes/BoneMealProbe.java); bytecode-read: the implementers of IGrowable (ajo) are exactly BlockGrass (alh), BlockSapling (anj), BlockCrops (akf, so wheat, carrots and
// potatoes), BlockStem (anu), BlockMushroom (amc), BlockTallGrass (anz), BlockDoublePlant (ako) and BlockCocoa (ajz). Reeds, cactus, flowers, nether wart, lily pads, vines, melons,
// pumpkins and dead bushes do not implement it (the stack stays and no stat counts).
//   * mushrooms: always fertilisable; 40 % (one nextFloat) grow into a huge mushroom (WorldGenBigMushroom, type by block); a failed generation puts the mushroom back;
//   * tall grass (meta 1) and ferns (2): always fertilisable (a dead bush, 0, is not); they become a double tall grass / large fern when the cell above is air and the soil is
//     grass, dirt or farmland (BlockDoublePlant.canPlaceBlockAt); otherwise nothing changes and the stack is still spent;
//   * double plants: sunflower, lilac, rose bush and peony (type 0, 1, 4, 5) drop one copy of themselves (Block.func_149642_a: three world nextFloat); grass and fern (2, 3) refuse;
//   * cocoa: age below 2 gains one stage; stems and crops: existing farming.fertilize; saplings: existing trees.boneMeal (45 % gate); the grass block: flowers.growGrass.
import { WorldGenBigMushroom } from './tree-generators.js';
import { GenWorld } from './gen-world.js';
import { canPlaceDoublePlant } from './biome-features.js';
import { JavaRandom } from './java-random.js';
import { growGrass } from './flowers.js';
import { makeStack } from './inventory.js';
import { toOriginal, fromOriginal } from './block-registry.js';
import { SAPLING, COCOA, DOUBLE_PLANT, BROWN_MUSHROOM, RED_MUSHROOM, BROWN_MUSHROOM_BLOCK, RED_MUSHROOM_BLOCK, FERN, isCrop } from './world.js';
import { isStem } from './stems-cake.js';

const f = Math.fround;
// Original ids the native code uses.
const N_BROWN = 39, N_RED = 40, N_TALLGRASS = 31, N_COCOA = 127, N_DOUBLE = 175;
export const STACK_OF_BONE_MEAL_DAMAGE = 15;

// The world Random of BoneMeal: ahb.s. One shared stream for hosts that give none.
let sharedRand;
const defaultRand = () => (sharedRand ??= new JavaRandom(Math.floor(Math.random() * 2 ** 48)));

// A native-id view of a web world for the ported native generators; every write is recorded in `changed`.
function nativeView(w, changed) {
  const read = (x, y, z) => toOriginal(w.get(x, y, z), w.getMeta(x, y, z)) ?? [0, 0];
  return {
    getBlock: (x, y, z) => read(x, y, z)[0],
    getBlockMetadata: (x, y, z) => read(x, y, z)[1],
    isAirBlock: (x, y, z) => w.get(x, y, z) === 0,
    isOpaqueCube: (id) => GenWorld.prototype.isOpaqueCube(id),
    isReplaceable: (id) => GenWorld.prototype.isReplaceable(id),
    setBlock(x, y, z, id, meta = 0, flags = 3) {
      const m = id === 0 ? { id: 0, meta: 0 } : fromOriginal(id, meta);
      if (!m || !w.set(x, y, z, m.id, true, m.meta)) return false;
      changed.push([x, y, z]);
      return true;
    },
  };
}

// func_149851_a (canFertilize) of the new kinds, on native id / metadata. null: not one of them.
function nativeCan(id, meta) {
  if (id === N_BROWN || id === N_RED) return true;
  if (id === N_TALLGRASS) return meta !== 0;
  if (id === N_DOUBLE) return meta !== 2 && meta !== 3; // meta is the type (the top half's was read from the bottom half)
  if (id === N_COCOA) return ((meta & 12) >> 2) < 2;
  return null;
}

// ItemDye.func_150919_a on the cell. host: { world, trees, farming, flowers, grassRandom, items, rand? }.
// Returns { used, changed: [[x, y, z], ...] (cells written outside trees/farming), farm: farming.drain() is due }.
export function useBoneMeal(host, x, y, z) {
  const w = host.world, b = w.get(x, y, z), out = { used: false, changed: [], farm: false };
  if (b === SAPLING) { host.trees.boneMeal(x, y, z); out.used = true; return out; }
  if (b === 1) { // BlockGrass.func_149853_b: always fertilisable, always grows
    for (const q of growGrass(w, host.flowers, host.grassRandom, w.biome, x, y, z)) out.changed.push(q);
    out.used = true;
    return out;
  }
  if (isCrop(b) || isStem(b)) {
    const rand = host.rand ?? defaultRand();
    if (host.farming.fertilize(x, y, z, () => rand.nextFloat())) { out.farm = true; out.used = true; }
    return out;
  }
  const rand = host.rand ?? defaultRand(), view = nativeView(w, out.changed);
  let [id, meta] = toOriginal(b, w.getMeta(x, y, z)) ?? [0, 0];
  if (id === N_DOUBLE && (meta & 8)) { // the top half reads its type from the bottom half
    const below = toOriginal(w.get(x, y - 1, z), w.getMeta(x, y - 1, z));
    meta = below && below[0] === N_DOUBLE ? below[1] & 7 : meta & 7;
  } else if (id === N_DOUBLE) meta &= 7;
  if (nativeCan(id, meta) !== true) return out;
  out.used = true;
  if (id === N_BROWN || id === N_RED) { // BlockMushroom: shouldFertilize 40 %, then func_149884_c
    if (!(rand.nextFloat() < 0.4)) return out;
    const keep = w.getMeta(x, y, z);
    view.setBlock(x, y, z, 0, 0, 3);
    if (!new WorldGenBigMushroom(id === N_BROWN ? 0 : 1).generate(view, rand, x, y, z)) {
      w.set(x, y, z, b, true, keep);
      out.changed.push([x, y, z]);
    }
  } else if (id === N_TALLGRASS) { // BlockTallGrass: a fern (2) becomes a large fern (3), grass a double tall grass (2)
    const type = meta === 2 ? 3 : 2;
    if (canPlaceDoublePlant(view, x, y, z)) {
      view.setBlock(x, y, z, N_DOUBLE, type, 2);
      view.setBlock(x, y + 1, z, N_DOUBLE, 8, 2);
    }
  } else if (id === N_DOUBLE) { // BlockDoublePlant: Block.func_149642_a drops (block, 1, type) with three world nextFloat
    const spread = () => f(rand.nextFloat() * f(0.7)) + f(f(1 - f(0.7))) * 0.5;
    const dx = spread(), dy = spread(), dz = spread();
    host.items?.spawn(makeStack(DOUBLE_PLANT, 1, meta), x + dx, y + dy, z + dz, { delay: 10 });
  } else if (id === N_COCOA) { // BlockCocoa: age + 1 (flag 2), the direction kept
    w.set(x, y, z, COCOA, true, ((((meta & 12) >> 2) + 1) << 2) | (meta & 3));
    out.changed.push([x, y, z]);
  }
  return out;
}

// RenderGlobal.playAuxSFX 2005 (ItemDye.func_150918_a): the particles rise to the block's maxY after setBlockBoundsBasedOnState. Bytecode-read bounds: a sapling and tall grass
// or fern 0.8 (BlockBush 0.4 * 2), a mushroom 0.4, a young crop 0.25, a stem (meta * 2 + 2) / 16, cocoa 0.75, a double plant and every full block 1.
export function sparkleHeight(world, x, y, z) {
  const b = world.get(x, y, z);
  if (b === SAPLING || b === 39 || b === FERN) return f(0.8);
  if (b === BROWN_MUSHROOM || b === RED_MUSHROOM) return f(f(0.2) * 2);
  if (isCrop(b)) return f(0.25);
  if (isStem(b)) return f(((world.getMeta(x, y, z) & 15) * 2 + 2) / 16);
  if (b === COCOA) return f(0.75);
  return 1;
}
export { BROWN_MUSHROOM_BLOCK, RED_MUSHROOM_BLOCK };
