// b75 mpplayerfx75 (replaces b74's motion slowdown). EntityPlayer.attackTargetEntityWithCurrentItem (yz.a(sa), bytecode-read): after a landed hit with knockback > 0 (Knockback
// enchantment + 1 while sprinting) the attacker's motionX / motionZ * 0.6 and setSprinting(false), all inside `if (target.attackEntityFrom(...))`. On the attacker's own client that
// call is false (EntityLivingBase.attackEntityFrom returns at once when worldObj.isRemote, sv.a(ro, F) offset 9-20), so the client's own motion is NOT slowed; only the server's
// EntityPlayerMP does it, and the server's motion does not move a player (the client's position packets do). What reaches the owner is the sprint flag: setSprinting(false) changes
// data watcher flag 3, and `my.b(ft)` sends that S1C to the player himself, so his client stops sprinting until its next onLivingUpdate re-reads the sprint key (a held sprint
// key starts it again at once). Here the server moves the player, so scaling the motion would slow him for real (b74 did): only the sprint flag is cleared now, the `sprinting`
// field of the player's row is the S1C the owner reads, and movePlayer re-sets it from the held sprint key on the next tick.
// MOB TARGETS ONLY. Against a REMOTE PLAYER the native client does slow itself: EntityOtherPlayerMP (bll) overrides attackEntityFrom(ro, float) with `iconst_1; ireturn`
// (bytecode-read), so the client's `if (attackEntityFrom(...))` is true and, with knockback > 0, it scales its own motionX/Z by 0.6 and stops sprinting. The port's server moves the
// player, so `server-pvp.js` scales the real motion for player targets (that is the client-side slowdown).
// b82 mpplace82: the same holds for an ender dragon. The hit entity is its EntityDragonPart (wy), whose attackEntityFrom (wy.a(ro, F)) is
// `aw() ? false : wx.a(this, ro, F)` and EntityDragon.attackEntityFromPart (xa.a(wy, ro, F)) ends in `iconst_1; ireturn` with no isRemote test
// (bytecode-read). On the attacker's client the part copy answers true, so the client slows itself (motion * 0.6) and stops sprinting; the
// critical and the enchantment sparks stay off (both are gated by `instanceof sv`, and the part is not an EntityLivingBase). `info.part` marks it.
export function attackerSlowdown(p, info) {
  if (!(info?.knockback > 0)) return false;
  if (info.part && p.velocity) { p.velocity.x *= 0.6; p.velocity.z *= 0.6; }
  if (p.motion) p.motion.sprinting = false;
  return true;
}
