// Player use of potions and glass bottles (ItemPotion, ItemGlassBottle, BlockCauldron's bottle branch); see public/research/potions.md.
// ItemPotion.onItemRightClick: a splash bottle is thrown (EntityPotion, random.bow 0.5 / 0.4 / (rand * 0.4 + 0.8)), anything else
// starts the 32-tick drink; onEaten adds the potion effects and returns a glass bottle in Survival.
import { copyBucketTarget } from "./buckets-simulation.js";
import { traceBucket, DRINK_TICKS } from "./buckets.js";
import { makeStack } from "./inventory.js";
import { isSplashDamage, ITEM_POTION, ITEM_GLASS_BOTTLE } from "./potions.js";
import { stackPotionEffects } from "./item-tags.js";
import { WATER } from "./world.js";

export { ITEM_POTION, ITEM_GLASS_BOTTLE };

// Puts `stack` into the inventory, or throws it down when it does not fit (dropPlayerItemWithRandomChoice).
function give(state, stack) {
  state.survival.inventory.add(stack);
  if (stack.count > 0) state.items?.dropPlayer(stack, state.position, state.yaw, state.pitch);
}

/** ItemPotion.onItemRightClick. Returns "throw" or "drink" (drinking only starts when nothing is in use). */
export function usePotion(state, hooks = {}) {
  const held = state.survival.held, damage = held?.damage || 0;
  if (isSplashDamage(damage)) {
    const random = hooks.random ?? Math.random;
    if (!state.survival.creative) state.survival.take(ITEM_POTION);
    hooks.playSound?.("random.bow", { volume: 0.5, pitch: 0.4 / (random() * 0.4 + 0.8) });
    state.mobs?.potions?.throwFromPlayer(state.position, state.yaw, state.pitch, damage, "potion", 0.5, held.customPotionEffects); // EntityPotion keeps the stack: CustomPotionEffects travel with it
    if (!state.survival.creative) { hooks.resetEquipped?.(); hooks.renderHotbar?.(); hooks.markUnsaved?.(); }
    return "throw";
  }
  if (!state.eating) state.eating = { id: ITEM_POTION, ticks: DRINK_TICKS, drink: true };
  return "drink";
}

/** ItemPotion.onEaten: the drink is over. Returns whether a potion was held. */
export function finishPotion(player) {
  const inv = player.inventory, held = inv.held;
  if (!held || held.id !== ITEM_POTION) return false;
  const effects = stackPotionEffects(held); // ItemPotion.getEffects(stack): CustomPotionEffects override the damage value
  if (!player.creative && --held.count <= 0) inv.main[inv.current] = null;
  for (const e of effects ?? []) player.effects.add({ id: e.id, duration: e.duration, amplifier: e.amplifier, ...(e.ambient ? { ambient: true } : {}) }); // new PotionEffect(effect) copies the ambient flag
  if (!player.creative) {
    if (!inv.main[inv.current]) inv.main[inv.current] = makeStack(ITEM_GLASS_BOTTLE);
    else { const s = makeStack(ITEM_GLASS_BOTTLE); inv.add(s); }
  }
  return true;
}

/** Wraps buckets.finishDrinking: drinking a potion first, then milk. */
export const finishDrinkingItem = (player, fallback) => finishPotion(player) || fallback(player);

/** ItemGlassBottle.onItemRightClick along the captured ray: water source becomes a water bottle. */
export function useGlassBottle(state, bucket, hooks = {}) {
  const captured = copyBucketTarget(bucket);
  if (!captured || !captured.ray) return { branch: "bottle-no-ray" };
  const now = traceBucket(state.world, captured.ray.origin, captured.ray.dir, true);
  if (!now) return { branch: "bottle-nothing" };
  const [x, y, z] = now.block;
  if (state.world.get(x, y, z) !== WATER) return { branch: "bottle-not-water" };
  const inv = state.survival.inventory, held = inv.held, bottle = makeStack(ITEM_POTION, 1, 0);
  if (--held.count <= 0) inv.main[inv.current] = bottle;
  else give(state, bottle);
  hooks.resetEquipped?.(); hooks.renderHotbar?.(); hooks.markUnsaved?.();
  return { branch: "fill-bottle" };
}

/** BlockCauldron.onBlockActivated, glass bottle branch: a water bottle for one level (the bottle stack shrinks after the add). */
export function bottleFromCauldron(state, level) {
  if (level <= 0) return null;
  const inv = state.survival.inventory, held = inv.held, potion = makeStack(ITEM_POTION, 1, 0);
  give(state, potion);
  if (--held.count <= 0) inv.main[inv.current] = null;
  return level - 1;
}
