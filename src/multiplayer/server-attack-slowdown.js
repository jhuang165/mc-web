// b74 mpcombat74: EntityPlayer.attackTargetEntityWithCurrentItem, after a landed hit with knockback > 0 (Knockback enchantment + 1 while sprinting):
// the attacker's motionX / motionZ * 0.6 and setSprinting(false). The client never does this itself (EntityLivingBase.attackEntityFrom is false on a client world);
// the server's copy of the player does (the same lines as server-pvp.js), which movePlayer then reads. `info.knockback` is the total set by EntityWorld.attack.
export function attackerSlowdown(p, info) {
  if (!(info?.knockback > 0)) return false;
  if (p.velocity) { p.velocity.x *= 0.6; p.velocity.z *= 0.6; }
  if (p.motion) p.motion.sprinting = false;
  return true;
}
