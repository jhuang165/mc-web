// What the player sees and hears when an entity takes damage or falls, ported from the unchanged 1.7.10 classes.
// Evidence: tools/probes/DamageFxProbe.java + tools/verify-damage-fx.mjs -> public/research/damage-fx-reference.json;
// the status of every effect (native-verified or approximated) is listed in public/research/damage-fx.md.
//   EntityRenderer.hurtCameraEffect   hurt roll sin(((hurtTime - p) / maxHurtTime)^4 * PI) * 14 degrees, the death roll 40 - 8000 / (deathTime + p + 200)
//   EntityLivingBase.fall             ceil(distance - 3 - (jump boost level)) points; the fall sound, then the landing block's step sound
//   EntityLivingBase.handleHealthUpdate(2)  every client plays its own hurt sound at (r - r) * 0.2 + 1, children included
import { mhSin } from "./lighting.js";
import { soundTypeOf } from "./block-sounds.js";

const f = Math.fround;
// EntityLivingBase.maxHurtTime (set to 10 by handleHealthUpdate and by EntityPlayerSP.setPlayerSPHealth) and maxHurtResistantTime.
export const MAX_HURT_TIME = 10;
export const MAX_HURT_RESISTANT_TIME = 20;
// Potion.jump (rv.j) is id 8.
export const JUMP_BOOST = 8;

// EntityRenderer.hurtCameraEffect (bll.f): the z rotation in GL degrees of the camera. A dead view (health <= 0) first
// rolls 40 - 8000 / (deathTime + p + 200); a view with hurtTime - p >= 0 then rolls -sin(f^4 * PI) * 14, f being
// (hurtTime - p) / maxHurtTime and sin MathHelper.sin's table. It also rotates by -attackedAtYaw and back around Y, but the
// client never sets attackedAtYaw: attackEntityFrom returns at once on a client world and handleHealthUpdate zeroes it,
// so the tilt is always a plain roll (verified: damage-fx-reference.json, `attackedAtYaw`).
export function hurtCameraRoll({ hurtTime = 0, maxHurtTime = MAX_HURT_TIME, health = 1, deathTime = 0 } = {}, partial = 0) {
  let angle = 0;
  if (health <= 0) angle += f(40 - f(8000 / f(f(deathTime + partial) + 200)));
  let t = f(hurtTime - partial);
  if (t < 0) return angle;
  t = f(t / maxHurtTime);
  t = mhSin(f(f(f(f(t * t) * t) * t) * f(3.1415927)));
  return f(angle + f(f(-t) * 14));
}

// EntityLivingBase.fall: the jump boost lowers the distance by (amplifier + 1); ceilingFloatInt of the float arithmetic.
// `amplifier` is the Jump Boost amplifier (0 for level I; a signed byte, so -3 lengthens the fall: executed b54jump) or undefined/-1 without the effect.
export function fallPoints(distance, amplifier = -1) {
  const boost = f(amplifier + 1), v = f(f(distance - 3) - boost), i = Math.trunc(v);
  return (v > i ? i + 1 : i) + 0;
}
// EntityLivingBase.func_146067_o (o): the fall sound by damage; EntityPlayer says "player", EntityMob "hostile", the rest "neutral".
export const fallSoundName = (points, kind = "neutral") => `game.${kind}.hurt.fall.${points > 4 ? "big" : "small"}`;
// The Block.SoundType of the block under the feet, played after the fall sound at volume * 0.5 and pitch * 0.75;
// null for air (Material.air).
export function landingStepSound(id) {
  if (!id) return null;
  const t = soundTypeOf(id);
  return t && { name: t.step, volume: f(t.volume * f(0.5)), pitch: f(t.frequency * f(0.75)) };
}
// What EntityLivingBase.fall plays and deals once an entity lands from `distance`: `points` of damage, the two sounds
// (both volume 1 pitch 1 for the fall sound itself) and nothing when `points` is not positive.
export function landingEffects(distance, { kind = "neutral", amplifier = -1, blockUnder = 0 } = {}) {
  const points = fallPoints(distance, amplifier);
  if (points <= 0) return { points, sounds: [] };
  const sounds = [{ name: fallSoundName(points, kind), volume: 1, pitch: 1 }], step = landingStepSound(blockUnder);
  if (step) sounds.push(step);
  return { points, sounds };
}

// EntityLivingBase.handleHealthUpdate(2) / (3): the client plays the hurt (or die) sound at getSoundVolume() and
// (random.nextFloat() - random.nextFloat()) * 0.2F + 1.0F. getSoundPitch's child bonus (1.5) is not used here.
export function statusPitch(rand) {
  const a = rand.nextFloat(), b = rand.nextFloat();
  return f(f(f(a - b) * f(0.2)) + 1);
}
// The same for a callback returning [0, 1) (Math.random), which is not a float but is drawn the same way.
export const statusPitchRandom = (random = Math.random) => f(f(f(random() - random()) * f(0.2)) + 1);

// EntityLivingBase.onDeathUpdate: deathTime 20 ends it; RendererLivingEntity.rotateCorpse tips a dead body over
// (deathTime + p - 1) / 20 * 1.6, square-rooted, capped at 1, times getDeathMaxRotation (90).
export function deathTipAngle(deathTime, partial, max = 90) {
  let t = f(f(f(f(deathTime + partial) - 1) / 20) * f(1.6));
  t = f(Math.sqrt(t));
  if (t > 1) t = 1;
  return f(t * max);
}
