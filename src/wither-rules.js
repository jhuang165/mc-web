// EntityWither (xc), EntityWitherSkull (zp) and the T-shape of BlockSkull.func_149965_a: constants and pure rules read from
// the unchanged 1.7.10 bytecode with javap (bytecode-derived; no probe record yet). The live entity, its AI, renderer and boss
// bar are NOT wired in this build (public/research/wither.md, Gaps). The T-shape builder itself is in skull.js.
export const WITHER = Object.freeze({
  width: 0.9, height: 4, maxHealth: 300, speed: 0.6, followRange: 40, armorValue: 4, experience: 50,
  invulStart: 220, startHealthFraction: 1 / 3, spawnExplosion: 7, skullExplosion: 1, skullDamage: 8, skullHeal: 5,
  chargedChance: 0.001, blockBreakCooldown: 20, skullSpeedCharged: 0.73,
});
export const NETHER_STAR = 2060;
// Armoured phase: health <= maxHealth / 2 (arrows are rejected while armoured).
export const witherArmored = (health) => health <= WITHER.maxHealth / 2;
// EntityWither.attackEntityFrom gate: false while invulnerable (Invul > 0), for drowning, for an arrow while armoured,
// and for a non-player attacker of the UNDEAD creature attribute.
export function witherAccepts({ invul = 0, health, drown = false, arrow = false, undeadMob = false }) {
  return !(invul > 0 || drown || (arrow && witherArmored(health)) || undeadMob);
}
// EntityWitherSkull.onImpact: the wither effect on a hit living entity by difficulty (0 Peaceful .. 3 Hard): none on Easy,
// 10 s on Normal, 40 s on Hard, amplifier 1.
export const witherSkullEffectTicks = (difficulty) => (difficulty >= 3 ? 20 * 40 : difficulty === 2 ? 20 * 10 : 0);
// Invulnerable spawn tick: heal 10 every 10 ticks, explode at 0.
export const invulTick = (invul) => ({ invul: invul - 1, explode: invul - 1 <= 0, heal: invul % 10 === 0 ? 10 : 0 });
// Block-breaking sweep: x, z within posX/posZ +-1, y in posY+0..3; bedrock, end portal (frame) and command block survive.
export const WITHER_PROOF = Object.freeze([7, 119, 120, 137]);
