// EntityLivingBase.entityLivingToAttack / revengeTimer (sv.i, sv.bm; getAITarget aJ, func_142015_aE aK, setRevengeTarget b): the creature that last hurt
// a mob. attackEntityFrom sets it for every accepted hit whose DamageSource entity is a living entity (a player, a mob's melee, a shooter behind an
// arrow, a creeper's blast, thorns' wearer). `e.revenge` keeps the timer (age + 1 at the hit, 0 for none) and this map the target: "player" or the
// attacking mob's entity. onEntityUpdate (sv.C) clears it when the target is no longer alive or 100 ticks after the hit (EntityWorld.tick).
const revengeBy = new WeakMap();
export const noteRevenge = (e, by) => revengeBy.set(e, by);
export const revengeOf = (e) => revengeBy.get(e) ?? null;
// The living entity of a damage source in this port's source object: the player, the shooter of an arrow, or the attacking mob; null when the
// source has no living entity (fall, fire, a string-named projectile).
export function sourceEntity(ew, victim, source) {
  if (source.player) return "player";
  const by = source.shooter ?? source.attacker;
  return by && typeof by === "object" && by !== victim && ew.entities.includes(by) ? by : null;
}
// getAITarget as the Brain view the target tasks use (null for none, a dead target counted as cleared).
export function revengeBrain(ai, e) {
  if (!e.revenge) return null;
  const by = revengeBy.get(e);
  if (by === "player") return ai.player;
  return by && by.health > 0 && ai.entities().includes(by) ? ai.brain(by) : null;
}
