// The client half of a dedicated server's health traffic (batch 60). Bytecode-read from the 1.7.10 jar:
// - S06 UpdateHealth (NetHandlerPlayClient bjb.a(ib)) calls EntityPlayerSP.setPlayerSPHealth (blk.n via bjk.n) and then the food level and saturation.
//   bjk.n: the first update only sets the health (field cd). After that f = oldHealth - newHealth: f <= 0 sets the health and, for f < 0, hurtResistantTime = maxHurtResistantTime / 2 (10);
//   f > 0 sets lastDamage, hurtResistantTime = 20 and calls damageEntity(generic, f) on the client (so Resistance, protection enchantments and Absorption reduce f again:
//   the client health is old - reduced f, not the server's value), then hurtTime = maxHurtTime = 10 (the camera tilt).
// - S19 entity status 2 (sv.a(byte)): limbSwingAmount 1.5, hurtResistantTime 20, hurtTime 10, the hurt sound (game.player.hurt, volume 1, pitch (r - r) * 0.2 + 1), then a 0 damage hit; status 3 plays the
//   death sound. The server sends it to the player too (EntityTracker func_151248_b -> EntityTrackerEntry.func_151261_b also writes to the EntityPlayerMP's own connection).
// - hurtResistantTime > 10 and (hurtResistantTime / 3) % 2 == 1 blinks the hearts (damage-hud.js heartsBlink, which reads `clientResist`).
// The over-a-connection client skips Survival.tick, so tickClientHealth runs the counters that tick would.
import { damageSourceKey, enchantedDamage } from '../armor-enchantments.js';

const finite = Number.isFinite;

/** EntityPlayerSP.setPlayerSPHealth. */
export function setClientHealth(s, health) {
  const next = Math.max(0, Math.min(s.maxHealth, health));
  if (!s.mpHealthSeen) { s.mpHealthSeen = true; s.health = next; s.syncedHealth = s.health; return; }
  const f = Math.fround(s.health - health);
  if (f <= 0) {
    s.health = next;
    if (f < 0) s.clientResist = 10;
  } else {
    // damageEntity(DamageSource.generic, f): generic bypasses armour; Resistance, the armour enchantments and Absorption apply (EntityPlayer.damageEntity, recalled order as Survival.damage).
    let dealt = f;
    const resistance = s.effects.get(11);
    if (resistance) dealt = Math.fround(Math.fround(dealt * (25 - (resistance.amplifier + 1) * 5)) / 25);
    dealt = enchantedDamage(s.inventory.armor, damageSourceKey('generic'), dealt);
    if (s.absorption > 0 && dealt > 0) { const taken = Math.min(s.absorption, dealt); s.absorption = Math.fround(s.absorption - taken); dealt = Math.fround(dealt - taken); }
    s.health = Math.max(0, Math.fround(s.health - dealt));
    s.clientResist = 20; s.hurtTime = 10;
  }
  s.syncedHealth = s.health;
}

/** S19 status 2 / 3 (`healthHurt`): the sound names to play now, plus the hurt counters; a death without keepInventory empties the client's own copy (the server dropped the items). */
export function applyHurtMessage(s, experience, m) {
  const sounds = [];
  if (m?.hurt) { s.hurtTime = 10; s.clientResist = 20; sounds.push('game.player.hurt'); }
  if (m?.die) {
    sounds.push('game.player.die');
    if (m.keep === false) { s.inventory.takeAll(); experience?.death(); }
  }
  return sounds;
}

/** S1D (`healthEffect`): addPotionEffect on the client player (PotionEffect.combine for one it already has). */
export function applyEffectMessage(s, m) {
  if (!m || ![m.id, m.amplifier, m.duration].every(finite)) return false;
  s.effects.player = s;
  return s.effects.add({ id: m.id, amplifier: m.amplifier, duration: m.duration, ambient: m.ambient === true });
}
/** S1E (`healthEffectEnd`): removePotionEffectClient. */
export function applyEffectEnd(s, m) {
  if (!m || !finite(m.id) || !s.effects.has(m.id)) return false;
  s.effects.player = s;
  s.effects.remove(m.id);
  return true;
}

/**
 * One client tick over a connection: EntityLivingBase.onUpdate counts hurtTime down, the hearts' hurtResistantTime falls, GuiIngame's updateCounter rises, and
 * updatePotionEffects counts each effect's duration down (it only removes one on the server; the client waits for S1E). performEffect is not run here: the server owns health and food.
 */
export function tickClientHealth(s) {
  s.ticks++;
  s.hurtTime = Math.max(0, s.hurtTime - 1);
  s.clientResist = Math.max(0, s.clientResist - 1);
  for (const e of s.effects.active.values()) if (e.duration > 0) e.duration--;
}
