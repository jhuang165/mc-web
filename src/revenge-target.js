// EntityLivingBase.entityLivingToAttack / revengeTimer (sv.i, sv.bm; getAITarget aJ, func_142015_aE aK, setRevengeTarget b): the creature that last hurt
// a mob. attackEntityFrom sets it for every accepted hit whose DamageSource entity is a living entity (a player, a mob's melee, a shooter behind an
// arrow, a creeper's blast, thorns' wearer). `e.revenge` keeps the timer (age + 1 at the hit, 0 for none) and this map the target: "player" or the
// attacking mob's entity. onEntityUpdate (sv.C) clears it when the target is no longer alive or 100 ticks after the hit (EntityWorld.tick).
const revengeBy = new WeakMap();
export const noteRevenge = (e, by) => revengeBy.set(e, by);
// b90 credit90 (bytecode-read sv.a(ro, F), sv.C 465-505): a dead EntityPlayer as the source entity (a respawned placer's TNT) is still setRevengeTarget'd; sv.C drops it at the mob's next update (isEntityAlive).
export const DEAD_ATTACKER = Object.freeze({ health: 0, dead: true });
// b91 credit91 (bytecode-read yg.a, yh.c, yq.a, td.bq 107-182): the dead attacker as the creature's entityToAttack. EntityMob / EntityPigZombie store the DamageSource entity with no test of its life,
// EntityZombie hands it to a reinforcement as setAttackTarget, and td.bq drops it at the next update (sa.Z false). Dead, at the body's position (`from`).
export const deadTargetAt = (source) => { const at = source.from ?? source.entity ?? {}; return { alive: false, x: at.x ?? 0, y: at.y ?? 0, z: at.z ?? 0, height: 0, eyeHeight: 0 }; };
export const revengeOf = (e) => revengeBy.get(e) ?? null;
// The living entity of a damage source in this port's source object: the player, the shooter of an arrow, or the attacking mob; null when the
// source has no living entity (fall, fire, a string-named projectile).
export function sourceEntity(ew, victim, source) {
  if (source.player) return "player";
  const by = source.shooter ?? source.attacker;
  return by && typeof by === "object" && ew.entities.includes(by) ? by : null;
}
// getAITarget as the Brain view the target tasks use (null for none, a dead target counted as cleared).
export function revengeBrain(ai, e) {
  if (!e.revenge) return null;
  const by = revengeBy.get(e);
  if (by === "player") return ai.player;
  return by && by.health > 0 && ai.entities().includes(by) ? ai.brain(by) : null;
}
