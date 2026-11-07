// EntityFallingBlock.fall(float) (xj.b) entity damage, Minecraft Java 1.7.10. Executed natively by tools/probes/CombatTrackerProbe.java
// (case "fallingBlock" records of public/research/combat-tracker-reference.json, replayed by src/falling-damage.test.js).
//   if (hurtEntities (g)) { i = ceil(distance - 1); if (i > 0) for each entity in the box:
//     entity.attackEntityFrom(block == anvil ? DamageSource.anvil : DamageSource.fallingBlock, min(floor(i * fallHurtAmount (i)), fallHurtMax (h))) }
// BlockAnvil.onStartFalling sets hurtEntities; the defaults are fallHurtMax 40 and fallHurtAmount 2.0. A plain falling block (sand, gravel,
// dragon egg) hurts only when summoned with HurtEntities (entity-summon.js). The anvil degradation roll stays in anvil-block.js anvilImpact.
const f = Math.fround;
export const FALL_HURT_AMOUNT = 2, FALL_HURT_MAX = 40;

/** The impact damage: `distance` is the accumulated Entity.fallDistance. Returns { distance: i, damage }. */
export function fallingBlockDamage(distance, amount = FALL_HURT_AMOUNT, max = FALL_HURT_MAX) {
  const i = Math.ceil(f(f(distance) - 1));
  if (!(i > 0)) return { distance: i, damage: 0 };
  return { distance: i, damage: Math.min(Math.floor(f(i * f(amount))), max) };
}

/** The Survival.damage / mob damage source key: "anvil" for an anvil, else "fallingBlock". */
export const fallingBlockSource = (isAnvil) => (isAnvil ? "anvil" : "fallingBlock");
