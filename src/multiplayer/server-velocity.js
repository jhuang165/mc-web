// b77 mpvelocity77: S12 EntityVelocity for the player himself.
// Bytecode-read (javap -c -p, 1.7.10 jar): `my.a(List)` (EntityTrackerEntry.updatePlayerList) ends with `if (entity.velocityChanged) { b(new hy(entity)); entity.velocityChanged = false; }`
// (`sa.H`; `hy` is S12PacketEntityVelocity), and `my.b(ft)` sends the packet to every tracking player AND, when the entity is an EntityPlayerMP (`mw`), to `mw.a` (playerNetServerHandler) itself.
// `hy(int, double, double, double)` clamps each component to +-3.9 and stores (int)(d * 8000); the client (NetHandlerPlayClient.handleEntityVelocity) calls setVelocity(x / 8000.0, ...).
// Entity.setBeenAttacked (velocityChanged = true) runs inside EntityLivingBase.attackEntityFrom for every hit that lands except DamageSource.drown (also EntityPlayer.onDeath's throw), so a mob, a
// player, an arrow or an explosion that hurts the player (and fall, fire, cactus ...) sends S12 with the server entity's motion at the tracker tick, after the tick's move.
// Wire here: the owner's own presence row carries `vel` (quantized) in the tick the hit settled; other viewers' rows drop it (the copy of a player moves nothing by its own motion, bll.e).
// Deviation (honest): the port's client does not run its own physics, the server integrates the player from his input, so the packet only sets the client's `velocity` (camera bob, cape);
// the position that follows already includes the knockback.
export const NO_S12 = new Set(['drowning']);

export const velocityPacket = v => {
  const c = d => Math.trunc(Math.max(-3.9, Math.min(3.9, d)) * 8000) / 8000;
  return { x: c(v.x), y: c(v.y), z: c(v.z) };
};

// Called where a landed hit is drained (server-survival takeHurt): marks `velocityChanged` for this tick.
export function markVelocityChanged(p, tick) {
  if (NO_S12.has(p.survival?.lastDamage)) return false;
  p.velHit = tick;
  return true;
}

// The `vel` field of a presence row for the tick `tick`, or {}.
export const velocityField = (p, tick) => (p.velHit === tick && p.velocity ? { vel: velocityPacket(p.velocity) } : {});

// Client half: S12 sets the player's own motion.
export function ownVelocity(row) {
  const v = row?.vel;
  return v && [v.x, v.y, v.z].every(Number.isFinite) ? { x: v.x, y: v.y, z: v.z } : null;
}
