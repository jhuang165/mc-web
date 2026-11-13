// Another player's hurt as the viewing client sees it (batch 61). Bytecode-read (1.7.10 jar): S19 status 2 reaches EntityLivingBase.handleHealthUpdate (sv.a(byte)) on the
// EntityOtherPlayerMP copy: limbSwingAmount = 1.5, hurtResistantTime = maxHurtResistantTime, hurtTime = maxHurtTime = 10, attackedAtYaw 0, then (no sound: EntityPlayer.playSound goes to
// World.playSoundToNearExcept, which RenderGlobal leaves empty; the hurt sound arrives as the server's S29) and a 0-damage hit. The copy's own onUpdate (blg/bll.h) then counts hurtTime down
// and eases limbSwingAmount towards the movement speed, so the tint (RendererLivingEntity: hurtTime > 0) shows for 9 rendered ticks.
export const REMOTE_HURT_TICKS = 10, REMOTE_HURT_LIMB = 1.5;

/** One presence tick of a remote player entry; `hurt` is the presence flag. Call before the body's tick. Returns whether the copy is tinted. */
export function stepRemoteHurt(entry, hurt, body) {
  if (hurt) { entry.hurtTime = REMOTE_HURT_TICKS; if (body) body.limbSwingAmount = REMOTE_HURT_LIMB; }
  if ((entry.hurtTime || 0) > 0) entry.hurtTime--;
  return entry.hurtTime > 0;
}
