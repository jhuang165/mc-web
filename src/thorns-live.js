// Thorns between a mob and the player (Minecraft Java 1.7.10). Bytecode-read: EnchantmentHelper.func_151384_a(victim, attacker) (afv.a) walks the
// victim's getLastActiveItems (for a mob all FIVE equipment stacks, the held one first; for a player the four armour stacks) and, for every
// Thorns entry, EnchantmentThorns.func_151367_b (agj.b) rolls on the victim's Random and hurts the attacker with DamageSource.causeThornsDamage
// (victim): an EntityDamageSource "thorns" (not armour-bypassing, magic-flagged), the 0.5 / 1 "damage.thorns" sound at the attacker, 3 durability
// off the first stack carrying Thorns on a hit, 1 on a miss. Its callers (a scan of every class of the jar) are exactly three:
//   EntityMob.attackEntityAsMob (yg.n)             a landed melee hit: the hit PLAYER's armour hurts the mob (survival.thorns, entities.js hitPlayer)
//   EntityArrow.onUpdate (zc.h)                    a landed arrow hit on a living target (bow.js)
//   EntityPlayer.attackTargetEntityWithCurrentItem (yz.r)  a landed player hit on a living target: the hit MOB's equipment hurts the PLAYER (this file)
// EntityWolf (wv.n), EntitySlime, EntityIronGolem and EntityOcelot override attackEntityAsMob without calling EntityMob's, so they never trigger it.
// The death text is "death.attack.thorns" ("%1$s was killed trying to hurt %2$s") with the wearer as %2$s (probed, CombatTrackerProbe thorns:*).
import { thornsReaction } from "./armor-enchantments.js";
import { maxDamage } from "./mob-equipment.js";

/** Mob types whose melee does not extend EntityMob.attackEntityAsMob and so never triggers the victim's Thorns. */
export const NO_THORNS_ATTACKER = new Set(["wolf", "slime", "magma_cube", "iron_golem", "ocelot", "snow_golem"]);

/** The player hit a mob that wears Thorns: the mob's equipment rolls on its Random and hurts the player. `hurt(damage)` hurts the player
 *  (survival.damage with source "thorns"), `sound()` plays damage.thorns at the player. Stack wear is ItemStack.damageItem on the mob's own stack:
 *  Unbreaking is ignored and a stack past its maximum is removed (the original keeps an empty stack there). Returns the damages dealt. */
export function mobThornsOnPlayerHit(mob, random, { hurt, sound }) {
  if (!mob.equipment) return [];
  return thornsReaction({
    items: () => mob.equipment, random, hurt, sound,
    wear: (i, amount) => {
      const stack = mob.equipment[i];
      if (!stack) return;
      stack.damage = (stack.damage ?? 0) + amount;
      if (maxDamage(stack.id) > 0 && stack.damage > maxDamage(stack.id)) mob.equipment[i] = null;
    },
  });
}
