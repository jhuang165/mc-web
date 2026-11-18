// b79 spswing79: what Item.onItemUse answers on the CLIENT world, which is what decides the hand swing.
// Minecraft.rightClickMouse (bao.am, b78) swings only when PlayerControllerMP.onPlayerRightClick returns true, i.e. when the client-world Block.onBlockActivated
// answered true or ItemStack.tryPlaceItemIntoWorld (= Item.onItemUse) did. Bytecode-read (javap -c -p, the item classes of the 1.7.10 jar, a(ItemStack, EntityPlayer,
// World, x, y, z, side, hitX, hitY, hitZ)Z). `remote` = World.isRemote, which is true for the client:
//   ItemHoe (ada): false unless side != 0, the block above is Material.air and the clicked block is grass or dirt; then true (no remote test, no stack test).
//   ItemFlintAndSteel (acw) and ItemFireball (acq): true after the canPlayerEdit test (no placement test at all; the fire charge returns true at once when remote).
//   ItemMonsterPlacer (aee): true at once when remote. ItemBed (abg): true at once when remote, any face. ItemFirework (acs): FALSE when remote (only the server launches).
//   ItemReed (abi: sugar cane, cake, repeater, comparator, brewing stand, cauldron, flower pot): false only for a stack of size 0 (or canPlayerEdit); a refused
//   canPlaceEntityOnSide still returns true. ItemRedstone (ads): true when the clicked block is a snow layer or the cell on the clicked side is air, whether or not the wire can stand.
//   ItemSkull (aeb): false for side 0 or a clicked block whose material is not solid, otherwise true (no replaceable or support test). ItemLead (adf): true only on a
//   render-type 11 block (the two fences). ItemDye (acj): bone meal true only when IGrowable.func_149851_a (canFertilize; the port's bone-meal.js `used`);
//   cocoa beans true for side 2..5 of a jungle log (the cell beside it is not tested); every other dye false. ItemSeeds / ItemSeedFood (adw, adv): side 1, farmland
//   (soul sand for nether wart) and air above, which the existing plant branches already test. ItemSign (adz), ItemDoor (ach), ItemBlock (abh) keep the placement refusals.
import { ITEMS } from './survival.js';
import { DYE, FENCE, SNOW_LAYER } from './world.js';
import { NETHER_FENCE } from './nether-blocks.js';
import { ITEM_SPAWN_EGG, ITEM_FIRE_CHARGE } from './spawn-eggs.js';
import { ITEM_BED } from './bed.js';
import { ITEM_CAKE } from './stems-cake.js';
import { ITEM_SKULL } from './skull.js';
import { signSolid, } from './signs.js';
import { REEDS_ITEM } from './plants.js';
import { ITEM_REDSTONE, ITEM_REPEATER } from './redstone-blocks.js';
import { ITEM_COMPARATOR } from './redstone-blocks-2.js';
import { ITEM_BREWING_STAND } from './brewing.js';
import { ITEM_CAULDRON, ITEM_FLOWER_POT } from './stone-utility.js';
import { originalId, LEAD_ORIGINAL } from './horse-gear.js';
import { isRailId } from './rails.js';
import { blockOfItem as shapedItemBlock, WOOD_SLAB, woodSlabType, planWoodSlabUse } from './shaped-blocks.js';
import { heldSlabType, planSlabUse } from './stone-utility.js';

const ITEM_REEDS = new Set([REEDS_ITEM, ITEM_CAKE, ITEM_REPEATER, ITEM_COMPARATOR, ITEM_BREWING_STAND, ITEM_CAULDRON, ITEM_FLOWER_POT]);
const GRASS = 1, DIRT = 2, LOG = 4, JUNGLE = 3;

// The clicked face (0 bottom, 1 top, 2 north, 3 south, 4 west, 5 east) from the ray target, -1 without one.
export function clickedSide(target) {
  if (!target?.block || !target.adjacent) return -1;
  const d = [0, 1, 2].map((i) => target.adjacent[i] - target.block[i]);
  if (d[1] < 0) return 0;
  if (d[1] > 0) return 1;
  if (d[2] < 0) return 2;
  if (d[2] > 0) return 3;
  if (d[0] < 0) return 4;
  return d[0] > 0 ? 5 : -1;
}

// true / false when the held item's onItemUse answer on the client is known from the table above, null when the existing placement outcome decides
// (ItemBlock, sign, door, seeds, bone meal). Call it BEFORE the click changes the world.
export function clientUseResult(state, target, id, held) {
  if (!target?.block || !id) return null;
  const world = state.world, [x, y, z] = target.block, side = clickedSide(target), block = world.get(x, y, z), item = ITEMS[id];
  if (item?.kind === 'hoe') return side > 0 && (block === GRASS || block === DIRT) && world.get(x, y + 1, z) === 0;
  if (item?.kind === 'flint_and_steel' || id === ITEM_FIRE_CHARGE || id === ITEM_SPAWN_EGG || id === ITEM_BED) return true;
  if (ITEM_REEDS.has(id)) return held?.count !== 0;
  if (id === ITEM_REDSTONE) return block === SNOW_LAYER || (!!target.adjacent && world.get(...target.adjacent) === 0);
  if (id === ITEM_SKULL) return side > 0 && signSolid(block);
  if (originalId(held) === LEAD_ORIGINAL) return block === FENCE || block === NETHER_FENCE;
  // b80 spswing80: ItemMinecart (adj.a, bytecode-read): true on any BlockRailBase (aje.a) with no stack size or remote test (the client decrements and
  // returns; attributes2-reference.json minecartOnRail count 0 executed: used, spawned, after -1); false on anything else.
  if (item?.minecartType !== undefined) return isRailId(block);
  // b80 spswing80: ItemSlab (aeg.a, bytecode-read): a merge into the clicked half (side 1 of a bottom half, side 0 of a top half) or into the same-type
  // single slab in the cell on the clicked side returns true even when checkNoEntityCollision refuses the double slab; otherwise ItemBlock decides.
  const slab = slabMerges(world, target, side, id, held);
  if (slab != null) return slab;
  if (id === DYE) {
    const damage = held?.damage ?? 0;
    if (damage === 15) return null;
    return damage === 3 && block === LOG && (world.getMeta(x, y, z) & 3) === JUNGLE && side >= 2;
  }
  return null;
}

// ItemSlab.onItemUse (aeg.a): false for a stack of size 0, true on a merge (the double slab may still be refused by an entity), null when the
// slab falls to ItemBlock.onItemUse (the placement outcome decides). Not a slab item: null.
function slabMerges(world, target, side, id, held) {
  const wood = (shapedItemBlock(id) || id) === WOOD_SLAB;
  const type = wood ? woodSlabType(held?.damage || 0) : heldSlabType(id, held?.damage || 0);
  if (type < 0) return null;
  if (held?.count === 0) return false;
  if (side < 0) return null;
  const here = target.block, adj = target.adjacent, cell = (p) => ({ id: world.get(...p), meta: world.getMeta(...p) });
  return (wood ? planWoodSlabUse : planSlabUse)(type, cell(here), cell(adj), side, 0.5).merge ? true : null;
}
