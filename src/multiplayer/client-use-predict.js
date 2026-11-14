// Batch 64 mpclientanim: the item use a connected client starts locally when it sends C08 (the server still decides the result).
// Natively PlayerControllerMP.sendUseItem runs ItemStack.useItemRightClick on the client too, so EntityPlayerSP sets itemInUse at once and its own
// onUpdate plays the eat / drink sounds and crumbs (the server's copies of those sounds skip the eater: simulation.js useSound `except: p.id`).
// The server then sends the food, effects and the burp (random.burp reaches the eater: `except: null`), so a predicted use never applies them.
import { ITEMS } from '../survival.js';
import { BOW, canDraw } from '../bow.js';
import { MILK_BUCKET, DRINK_TICKS } from '../buckets.js';
import { ITEM_POTION, isSplashDamage } from '../potions.js';

/** The `eating` state for the held stack, or null when the use does not start (ItemFood.canEat, nothing to draw, a splash potion is thrown). */
export function predictUse(held, survival) {
  const id = held?.id ?? 0, item = ITEMS[id];
  if (!id) return null;
  if (item?.kind === 'sword') return { id, ticks: 72000, block: true }; // ItemSword: EnumAction.block, 72000 ticks
  if (id === BOW) return canDraw(survival) ? { id, ticks: 0, bow: true } : null;
  if (id === MILK_BUCKET) return { id, ticks: DRINK_TICKS, drink: true };
  if (id === ITEM_POTION) return isSplashDamage(held.damage | 0) ? null : { id, ticks: DRINK_TICKS, drink: true };
  if (item?.food && !survival.creative && (survival.food < 20 || item.alwaysEdible) && survival.usable(id)) return { id, ticks: 32 };
  return null;
}

// b65 mpuse2: S2F (NetHandlerPlayClient.handleSetSlot) puts a NEW ItemStack object into the held slot, and EntityPlayer.onUpdate compares `inventory.getCurrentItem() != itemInUse`
// by identity (yz.h, bytecode-read), so any set-slot message for the held slot (even an equal stack) clears the use via clearItemInUse. `message.slots` lists main-inventory cells.
export function slotReplacesUse(message, current) {
  return (message?.slots ?? []).some(s => s?.slot === current);
}
