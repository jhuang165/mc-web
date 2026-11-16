// Batch 76 mpcauldron76: BlockCauldron.onBlockActivated on the dedicated server (bytecode-read `ajw`, javap -c -p).
//   * isRemote: return true; empty hand: return true (the click is consumed, nothing else happens);
//   * water bucket: below level 3, outside Creative the held stack is REPLACED by an empty bucket, and the level becomes 3; returns true at any level (a full cauldron keeps the full bucket);
//   * glass bottle at level > 0: outside Creative a water bottle (damage 0) goes to the inventory, or an EntityItem is spawned at (x + 0.5, y + 1.5, z + 0.5) with no pickup delay and
//     the usual random EntityItem motion; then the bottle stack shrinks by one (an emptied slot is cleared; the add happens first, so a lone bottle's slot is not reused), and the level
//     drops by one (Creative too). The method falls out of the branch to `return false`; the client has already consumed the click (its onBlockActivated is `return true` while isRemote,
//     bytecode-read `bje.a`: the C08 packet is sent whatever the block said), so no second packet follows and nothing else runs. Here the click is simply consumed;
//   * leather armour (ItemArmor with ArmorMaterial.CLOTH) at level > 0: ItemArmor.removeColor (any piece, coloured or not), level - 1, returns true (Creative too);
//   * every other item: false (the item's own onItemUse runs on the server; its onItemRightClick never does, see `clientSwallows`).
// Every level change is BlockCauldron.func_150024_a: clamp 0..3, metadata flags 2, then World.func_147453_f (comparator update). The world's change funnel (LiveRedstone) does the comparator
// update and wakes the neighbours too, which native does not for a flag 2 write (harmless: the cauldron is no power source).
// No sound: BlockCauldron has no sound string and no liquid.splash exists in 1.7.10 (earlier note, bytecode-read).
import { CAULDRON, BUCKET_ITEM, WATER_BUCKET_ITEM, cauldronWash } from '../stone-utility.js';
import { ITEM_POTION, ITEM_GLASS_BOTTLE } from '../potion-use.js';
import { makeStack } from '../inventory.js';

const clamp3 = n => Math.min(Math.max(n, 0), 3);

/** BlockCauldron.func_150024_a: the level (clamped to 0..3) written to the cell. */
export function setCauldronLevel(world, x, y, z, level) { world.set(x, y, z, CAULDRON, true, clamp3(level)); }

/**
 * The player's right click on the cauldron at (x, y, z) (the caller has checked the block and that the click is not a sneak with an item in hand).
 * Returns true when the cauldron consumed the click.
 */
export function cauldronActivate(sim, p, x, y, z) {
  const s = p.survival, held = s.held, w = sim.world, level = w.getMeta(x, y, z);
  if (!held) return true; // an empty hand: return true
  const creative = !!s.creative, inv = s.inventory;
  if (held.id === WATER_BUCKET_ITEM) {
    if (level < 3) {
      if (!creative) inv.main[inv.current] = makeStack(BUCKET_ITEM); // InventoryPlayer.setInventorySlotContents(currentItem, new ItemStack(Items.bucket))
      setCauldronLevel(w, x, y, z, 3);
    }
    return true;
  }
  if (held.id === ITEM_GLASS_BOTTLE) {
    if (level > 0) {
      if (!creative) {
        const bottle = makeStack(ITEM_POTION, 1, 0);
        inv.add(bottle);
        if (bottle.count > 0) sim.items.spawn(bottle, x + 0.5, y + 1.5, z + 0.5, { delay: 0 }); // inventory full: new EntityItem(world, x + .5, y + 1.5, z + .5, stack)
        if (--held.count <= 0) inv.main[inv.current] = null;
      }
      setCauldronLevel(w, x, y, z, level - 1);
    }
    return true;
  }
  const wash = cauldronWash(held, level);
  if (wash.handled) {
    inv.main[inv.current] = wash.stack; // removeColor on the held stack itself
    setCauldronLevel(w, x, y, z, wash.level);
    return true;
  }
  return false;
}

/**
 * The client's block-click packet is the only one sent when the block "used" the click (Minecraft.func_147121_ag: PlayerControllerMP.onPlayerRightClick returned true, so
 * sendUseItem is skipped; recalled, not re-read). BlockCauldron.onBlockActivated returns true on every client world unless the player sneaks with an item, so the item's own
 * onItemRightClick (bucket, bow, food, potion, egg, rod, boat, map, armour) never reaches the server from a cauldron click; onItemUse (block placing) still does.
 */
export const clientSwallows = (b, p) => b === CAULDRON && !(p.input?.sneak && p.survival.held);
