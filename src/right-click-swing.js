// b80 spswing80: whether a right click swings the arm, for the client that cannot run the single-player edit (multiplayer). The same table as the single
// player swing (applyPlayerEdit with spswing79-rules.js), answered from the client world alone. Minecraft.rightClickMouse (bao.am, bytecode-read):
//   on a block, PlayerControllerMP.onPlayerRightClick (bje.a) is Block.onBlockActivated unless sneaking with an item (true -> swing), then false for an empty
//   hand, false when a held ItemBlock's canPlaceItemBlockOnSide refuses, else ItemStack.tryPlaceItemIntoWorld = the client-world Item.onItemUse. Only a true
//   answer swings (bjk.ba) and clears the flag; a false one goes on to sendUseItem (bje.a(yz, ahb, add)), whose Item.onItemRightClick swings only for the
//   fishing rod (acv is the only item class that calls swingItem). On an entity or on nothing there is no swing but the rod's.
// Adventure mode changes none of it in 1.7.10: onPlayerRightClick has no game type test and EntityPlayer.canPlayerEdit (yz.a(IIIILadd;)) is
// `allowEdit || stack != null && stack.canEditBlocks()`, with Item.canItemEditBlocks (adb.v) true and overridden by no item; CanPlaceOn is 1.8.
import { ITEMS } from './survival.js';
import { DYE } from './world.js';
import { activatesOnClick, dryPlace } from './client-prediction.js';
import { clientUseResult, clickedSide } from './spswing79-rules.js';
import { boneMealCanFertilize } from './bone-meal.js';
import { plantedBlock } from './crops.js';
import { wartPlantedBy } from './nether-wart.js';
import { SOUL_SAND } from './nether-blocks.js';
import { ITEM_SIGN, placeSign } from './signs.js';
import { FISHING_ROD } from './fishing-content.js';

const FARMLAND = new Set([29, 30]);

// Item.onItemUse's answer on the client world for the held stack on `target` (call before the click changes the world). `state` is { world, survival,
// position, flowers, yaw, entities } as dryPlace takes it; `entities(box)` is the client world's checkNoEntityCollision (b82 mpplace82: bje.a returns
// false before the C08 when the held ItemBlock's abh.a canPlace -> ahb.a(Block, IIIZ, side, null, stack) meets a copy, so no swing).
export function clientItemUse(state, target, id, held) {
  if (!target?.block || !id) return false;
  const rule = clientUseResult(state, target, id, held);
  if (rule != null) return rule;
  const world = state.world, [x, y, z] = target.block, side = clickedSide(target), block = world.get(x, y, z);
  // ItemDye bone meal (acj): func_150919_a answers canFertilize on the client.
  if (id === DYE) return boneMealCanFertilize(world, x, y, z);
  // ItemSeeds / ItemSeedFood (adw, adv): top face of the soil block with air above.
  if (plantedBlock(id)) return side === 1 && FARMLAND.has(block) && world.get(x, y + 1, z) === 0;
  if (wartPlantedBy(id)) return side === 1 && block === SOUL_SAND && world.get(x, y + 1, z) === 0;
  // ItemSign (adz): side 0, a non-solid block, canPlayerEdit or canPlaceBlockAt refuse; then `if (world.isRemote) return true` (no stack size test).
  if (id === ITEM_SIGN) return placeSign({ world: readOnly(world), survival: { creative: true }, yaw: state.yaw ?? 0 }, { id, target }).placed;
  // ItemBlock (with ItemSnow, ItemSlab's fall-through), ItemReed-like placers and the door item: the dry run of the placement.
  return !!state.survival && dryPlace(state, { id, item: ITEMS[id], target }, {}).placed;
}

// { world, target, held, sneaking, aimed, survival, position, yaw, flowers, entities }: true when this right click swings on the client.
// `aimedType` is the aimed mob's type: EntityCreeper.interact calls swingItem for flint and steel (on the client too, b77).
export function rightClickSwings({ world, target, held, sneaking = false, aimed = false, aimedType = null, survival = null, position, yaw = 0, flowers, entities = null }) {
  const id = held?.id ?? 0;
  if (id === FISHING_ROD) return true; // ItemFishingRod.onItemRightClick swings (or an activated block did)
  if (aimed && aimedType === 'creeper' && ITEMS[id]?.kind === 'flint_and_steel') return true;
  if (aimed || !target?.block) return false;
  if (!(sneaking && id) && activatesOnClick(world.get(...target.block), world, target.block, id, held?.damage ?? 0)) return true;
  if (!id) return false; // onPlayerRightClick: `if (stack == null) return false`
  return clientItemUse({ world, survival, position, flowers, yaw, entities }, target, id, held);
}

// b83 attack83: true when the native client sends no block C08 for this right click. PlayerControllerMP.onPlayerRightClick (bje.a(yz, ahb, add, IIII, azw),
// bytecode-read): after Block.onBlockActivated declined (or was skipped by a sneaking click with an item), a held ItemBlock whose
// func_150936_a (canPlaceItemBlockOnSide -> World.canPlaceEntityOnSide, which includes checkNoEntityCollision against the client's copies and the
// placer) refuses makes it return false BEFORE the C08 is sent; rightClickMouse then sends only the C08 with direction 255 (sendUseItem ->
// tryUseItem -> ItemBlock's onItemRightClick, which does nothing). The server never tries the placement and resends no cell. Only the entity refusals
// are taken here: the client's copies stand where the server's entities no longer do, so this is where the server alone would place.
export function clientWithholdsPlace({ world, target, held, sneaking = false, survival = null, position, yaw = 0, flowers, entities = null }) {
  const id = held?.id ?? 0;
  if (!target?.block || !id || !survival) return false;
  if (!(sneaking && id) && activatesOnClick(world.get(...target.block), world, target.block, id, held?.damage ?? 0)) return false;
  if (clientUseResult({ world, survival, position, flowers, yaw, entities }, target, id, held) != null) return false; // an item with its own onItemUse rule: the ItemReed placers (cake, repeater, cauldron ...), slab merges, beds, signs. These are no ItemBlock refusal, so the block C08 goes
  const reason = dryPlace({ world, survival, position, flowers, yaw, entities }, { id, item: ITEMS[id], target }, {}).result?.reason;
  return withheldReason(reason);
}

// b84 mpplace84: every refusal of abh.a (ItemBlock.func_150936_a -> World.canPlaceEntityOnSide, bytecode-read ahb.a(aji, IIIZ, I, sa, add)): the collision
// with an entity (the client's copies and the placer), the target cell not Material.isReplaceable ('occupied'), and Block.canReplace ->
// canPlaceBlockOnSide / canPlaceBlockAt (the '*-support' reasons). All return false from bje.a before the C08, so rightClickMouse sends only direction 255.
// Not these: door-side / door-support (ItemDoor.onItemUse is no ItemBlock), cocoa-support (ItemDye), pot-support (ItemReed; clientUseResult answers first).
const NOT_ITEMBLOCK = new Set(['door-side', 'door-support', 'cocoa-support']);
export function withheldReason(reason) {
  if (typeof reason !== 'string' || NOT_ITEMBLOCK.has(reason)) return false;
  return reason === 'entity-collision' || reason === 'player-collision' || reason === 'occupied' || reason.endsWith('-support');
}

// A view of the world whose writes go nowhere (placeSign sets the block; only its answer is wanted).
function readOnly(world) {
  const view = Object.create(world);
  view.set = () => true; view.put = () => true;
  return view;
}
