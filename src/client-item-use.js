// b85 mppredict85: the multiplayer client's own half of an item use that is not an onItemUse on a block. Natively PlayerControllerMP.sendUseItem (bje.a(yz, ahb, add))
// calls ItemStack.useItemRightClick on the CLIENT world too, after rightClickMouse found no block use (onPlayerRightClick false) and no entity interaction; the item's
// onItemRightClick then changes the client world and the client stack at once, and the server's C08 255 handling repeats it. Bytecode-read per class (1.7.10 jar):
//   ItemLilyPad (aej)      trace, canMineBlock (true on the client: ahb.a(yz,III) is iconst_1), canPlayerEdit, water meta 0 with air above: setBlock, --stack unless creative. No isRemote guard.
//   ItemBucket (abo)       no isRemote guard: an empty one removes the source and swaps/gives the filled bucket, a full one places (client-prediction.js dryBucketUse / heldPlan).
//   ItemGlassBottle (abl)  no isRemote guard and NO creative test: a traced water cell takes one bottle; a lone one becomes the water bottle (a(Ladd) -> new ItemStack(potion)),
//                          else the potion goes to the inventory or is dropped. The world is untouched.
//   ItemBoat (abj)         the spawn is inside `if (!world.isRemote)`, the decrement (unless creative) is not: a client with no entity or block blocking the boat's box loses one.
//   ItemSnowball / ItemEgg / ItemExpBottle (aed, ack, acp) and ItemPotion splash (adp): --stack unless creative, then the sound, and only the spawn is `!isRemote`.
//   ItemEnderPearl (aco)   creative returns before everything; otherwise as the snowball.
//   Nothing on the client: ItemEnderEye (acn, decrement and spawn both inside !isRemote), ItemMonsterPlacer (aee returns at once on a client), ItemFishingRod (acv, swing only; the hook
//   is !isRemote), ItemBow / ItemFood / drinkable potions (start the use animation only, client-use-predict.js), written books (screen only, b66).
//   ItemEmptyMap (acl) has no guard either: the client swaps in a filled map whose id comes from ITS OWN map counter (ahb.b("map") on the client world), which the server's S2F then
//   replaces. That id cannot be predicted, so it is left to S2F.
// The server's S2F (applySlots) sets the absolute stack, so the client's change and the server's equal change never add up.
import { ITEMS } from './survival.js';
import { LILY_PAD, WATER } from './world.js';
import { traceBucket } from './buckets.js';
import { lilyPadCell } from './lily-use.js';
import { dryBucketUse, tracedBucket, heldPlan } from './client-prediction.js';
import { Boats, BOAT_ITEM } from './boats.js';
import { ITEM_GLASS_BOTTLE, ITEM_POTION, isSplashDamage } from './potions.js';
import { isThrowable } from './player-throw-simulation.js';
import { ITEM_EXP_BOTTLE } from './spawn-eggs.js';

// { cells: [{ x, y, z, block, meta }], plan: heldPlan-style change or null }. `state`: { world, survival, held, eye, dir, yaw, playerBox, blocked(box) }.
export function clientUseItem(state) {
  const { world, survival, held, eye, dir } = state, id = held?.id ?? 0, creative = !!survival?.creative, none = { cells: [], plan: null };
  if (!id || !(held.count > 0) || !eye || !dir) return none;
  if (id === LILY_PAD) {
    const cell = lilyPadCell(world, eye, dir);
    return cell ? { cells: [{ x: cell[0], y: cell[1], z: cell[2], block: LILY_PAD, meta: 0 }], plan: creative ? null : { dCount: -1 } } : none;
  }
  if (tracedBucket(id)) {
    const out = dryBucketUse({ world, heldId: id }, eye, dir);
    return { cells: out.cells, plan: heldPlan({ kind: 'bucket', stack: held, creative, placed: out.used, took: out.took }), fizz: out.fizz };
  }
  if (id === ITEM_GLASS_BOTTLE) {
    const hit = traceBucket(world, eye, dir, true);
    if (!hit || world.get(...hit.block) !== WATER) return none;
    return { cells: [], plan: held.count === 1 ? { dCount: 0, swap: [id, ITEM_POTION] } : { dCount: -1, give: ITEM_POTION } }; // no creative test (abl)
  }
  if (id === BOAT_ITEM) {
    const boat = new Boats().place(world, { eye, dir, yaw: state.yaw, box: state.playerBox }, state.playerBox ? [{ bb: state.playerBox }] : [], []);
    if (!boat) return none;
    const b = boat.bb;
    if (state.blocked?.([b[0] + 0.1, b[1] + 0.1, b[2] + 0.1, b[3] - 0.1, b[4] - 0.1, b[5] - 0.1])) return none; // the client's entity copies (ahb.a(Entity, AABB) on the new boat)
    return { cells: [], plan: creative ? null : { dCount: -1 } };
  }
  const throws = isThrowable(id) || id === ITEM_EXP_BOTTLE || (id === ITEM_POTION && isSplashDamage(held.damage | 0));
  return { cells: [], plan: throws && !creative ? { dCount: -1 } : null };
}
