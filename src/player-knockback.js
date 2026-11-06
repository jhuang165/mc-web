// Knockback on the local player (1.7.10). The sources are queued on `survival.knockQueue` ({ kind: "knock", x, z } from a fresh hit whose
// DamageSource has an entity, `{ kind: "add", x, y, z }` for the Entity.addVelocity kicks that follow it) and applied to the movement
// velocity once per tick by tickLivingSimulation (hooks.knock / hooks.push). Evidence: player-knockback-reference.json
// (tools/probes/PlayerKnockbackProbe.java); rules in public/research/player-knockback.md.
import { mhSin, mhCos } from "./lighting.js";
const f = Math.fround;

// EntityLivingBase.attackEntityFrom (sv.a(ro, F)): a fresh hit (hurtResistantTime not above half the window) whose source has an entity
// calls knockBack(entity, amount, entity.x - x, entity.z - z). Survival.damage calls this after the Creative, spawn-protection and
// hurt-window refusals, so it only sees hits that landed.
export function queueKnockBack(survival, from) {
  (survival.knockQueue ??= []).push({ kind: "knock", x: from.x, z: from.z });
}
// Entity.addVelocity (sa.g(DDD)V) on the player, applied after the knockback of the same hit (EntityMob.attackEntityAsMob, EntityArrow
// Punch, EntityIronGolem.attackEntityAsMob).
export function queueVelocity(survival, x, y, z) {
  (survival.knockQueue ??= []).push({ kind: "add", x, y, z });
}

// EntityLivingBase.knockBack (sv.a(Entity, F, D, D)V) on a velocity {x, y, z}. The player's knockbackResistance is 0, so the
// Entity.rand roll never succeeds. A coincident attacker is nudged by Math.random like attackEntityFrom does.
export function knockBack(velocity, position, from, nudge = Math.random, resistance = 0, roll = Math.random) {
  let dx = from.x - position.x, dz = from.z - position.z;
  while (dx * dx + dz * dz < 1e-4) {
    dx = (nudge() - nudge()) * 0.01;
    dz = (nudge() - nudge()) * 0.01;
  }
  if (roll() < resistance) return false;
  const len = f(Math.sqrt(dx * dx + dz * dz)), k = f(0.4);
  velocity.x = velocity.x / 2 - (dx / len) * k;
  velocity.y = velocity.y / 2 + k;
  velocity.z = velocity.z / 2 - (dz / len) * k;
  if (velocity.y > 0.4000000059604645) velocity.y = 0.4000000059604645;
  return true;
}

// Apply and empty the queue in order.
export function drainKnockback(survival, velocity, position, nudge = Math.random) {
  const queue = survival?.knockQueue;
  if (!queue?.length) return 0;
  const n = queue.length;
  for (const k of queue.splice(0)) {
    if (k.kind === "knock") knockBack(velocity, position, k, nudge);
    else { velocity.x += k.x; velocity.y += k.y; velocity.z += k.z; }
  }
  return n;
}

// EntityMob.attackEntityAsMob (yg.n): after a landed hit with Knockback level i > 0 on the held item, the target gets
// addVelocity(-sin(yaw) * i * 0.5F, 0.1, cos(yaw) * i * 0.5F) and the mob's own horizontal motion is multiplied by 0.6.
// `mob.rotationYaw` is the Java yaw in degrees. Returns whether it applied.
export function mobKnockbackKick(survival, mob, level) {
  if (!(level > 0)) return false;
  const yaw = Number.isFinite(mob.rotationYaw) ? mob.rotationYaw : (-(mob.yaw || 0) * 180) / Math.PI,
    rad = f(f(yaw * f(Math.PI)) / 180);
  queueVelocity(survival, f(f(-mhSin(rad) * level) * 0.5), 0.1, f(f(mhCos(rad) * level) * 0.5));
  mob.vx *= 0.6;
  mob.vz *= 0.6;
  return true;
}

// EntityIronGolem.attackEntityAsMob: a landed hit adds 0.4 to the target's motionY (Entity.motionY += 0.4000000059604645).
export function golemLift(survival) { queueVelocity(survival, 0, 0.4000000059604645, 0); }

// EntityArrow.onUpdate Punch: a landed hit with knockbackStrength i > 0 and horizontal speed h > 0 adds
// (mx * i * 0.6F / h, 0.1, mz * i * 0.6F / h) to the hit entity.
export function arrowPunch(survival, a, sqrtF) {
  const h = sqrtF(a.mx * a.mx + a.mz * a.mz);
  if (!(a.knockback > 0) || !(h > 0)) return false;
  queueVelocity(survival, (a.mx * a.knockback * 0.6000000238418579) / h, 0.1, (a.mz * a.knockback * 0.6000000238418579) / h);
  return true;
}
