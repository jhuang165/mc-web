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
// b65 lead: S19 status 9 (EntityPlayerMP.onItemUseFinish sends it to the eater, mw.p bytecode) -> EntityPlayer.handleHealthUpdate(9) -> onItemUseFinish on the client:
// updateItemUse(stack, 16) (food: 16 crumbs and random.eat; drink: one random.drink), then clearItemInUse. ItemFood.onEaten's client copy only shrinks a stack the S2F
// that follows replaces, and its burp is World.playSoundAtEntity, silent on a client (the server's random.burp reaches the eater). Returns the use state left: null.
export function finishPredictedUse(use, { foodEffects = () => {}, sound = () => {}, random = Math.random } = {}) {
  if (!use || use.bow || use.block) return use;
  if (use.drink) sound('random.drink', { volume: 0.5, pitch: random() * 0.1 + 0.9 });
  else foodEffects(use.id, 16);
  return null;
}
