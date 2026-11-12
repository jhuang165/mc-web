// Potion effects on mobs: the four a Hard spider can spawn with (EntitySpider.GroupData),
// through EntityLivingBase.updatePotionEffects (sv.aO) and the Potion attribute modifiers.
// Recorded in DifficultyProbe's "potion" cases (public/research/difficulty-reference.json).
import { potionColor, potionParticles } from "./fx.js";
import { liveAttribute, healthBoostExtra } from "./mob-attributes.js";
const f = Math.fround;
export const SPEED = 1, STRENGTH = 5, REGENERATION = 10, INVISIBILITY = 14;
export const RESISTANCE = 11, ABSORPTION = 22;
export const SLOWNESS = 2, INSTANT_HEALTH = 6, FIRE_RESISTANCE = 12, WATER_BREATHING = 13, WEAKNESS = 18, POISON = 19, WITHER = 20;
// Speed, strength, regeneration and invisibility from the spider spawn roll, plus what an EntityWitch drinks (instant health, speed, fire
// resistance, water breathing) or throws (slowness, weakness, poison; witch.js).
// Resistance (11) and Absorption (22) come from /effect, ActiveEffects and spawners: 1.7.10 has no potion item for them.
// Nausea (9) is the cured zombie villager's villager (EntityZombie.convertToVillager); it has no effect on the mob here.
// Haste (3), mining fatigue (4), jump boost (8), blindness (15), night vision (16), hunger (17), health boost (21) and saturation (23) are kept and counted
// down but do nothing here: Potion.isReady is false for them and performEffect only acts on a player (hunger, saturation); jump boost is read by the mob jump
// (entities.js). Health boost (21) adds its maxHealth modifier when it is added at run time (Potion.applyAttributesModifiersToEntity, rt: 4 * (amplifier + 1), operation 0,
// not saved) and takes it off, clamping health, when it ends (executed, b54hb); an effect that only a load put in the map has no modifier.
// Instant health (6) and instant damage (7) are kept too: PotionHealth.isReady (ru.a) is true for any duration of 1 or more, so every update performs them (executed, b54inst).
export const INERT_EFFECTS = [3, 4, 8, 15, 16, 17, 21, 23];
export const INSTANT_DAMAGE = 7, HEALTH_BOOST = 21;
const MOB_EFFECTS = new Set([SPEED, SLOWNESS, 9, INSTANT_HEALTH, INSTANT_DAMAGE, STRENGTH, REGENERATION, INVISIBILITY, FIRE_RESISTANCE, WATER_BREATHING, WEAKNESS, POISON, WITHER, RESISTANCE, ABSORPTION, ...INERT_EFFECTS]);
// EntityLivingBase.isEntityUndead (sv.aR): zombies and zombie villagers, skeletons of both types, pigmen, the wither and the zombie and skeleton horses.
const UNDEAD = new Set(["zombie", "skeleton", "wither_skeleton", "pigman", "wither"]);
const isUndead = (e) => UNDEAD.has(e.type) || (e.type === "horse" && (e.horse?.type === 3 || e.horse?.type === 4));
// The live maximum health with the effects counted (entities.js registers mob-riding.js maxHealthOf), for the clamp a health boost change makes.
let maxHealthHook = null;
export const setMaxHealthHook = (fn) => { maxHealthHook = fn; };
const liveMax = (e) => (maxHealthHook ? maxHealthHook(e) : Infinity);
// The mob's effects as the activePotionsMap iterates them. `effects` is kept in insertion order; the HashMap's table starts at 16 buckets, grows to 32 when a 13th
// entry goes in and never shrinks (`effectsWide` is that growth), and keeps the insertion order inside a bucket (a resize splits chains without reordering them;
// the executed b54order records are from a Java 8 or later HashMap). The key is the Integer id, so the bucket is id & 15 or id & 31.
export function effectsInMapOrder(e) {
  const list = e.effects ?? [];
  if (list.length > 12) e.effectsWide = true;
  const mask = e.effectsWide ? 31 : 15;
  return list.map((x, i) => [x, i]).sort((a, b) => (a[0].id & mask) - (b[0].id & mask) || a[1] - b[1]).map((x) => x[0]);
}

// NBT "ActiveEffects": Id, Amplifier (byte), Duration (int), Ambient. Unknown ids and spent effects
// are dropped. The saved Amplifier is a signed byte (PotionEffect.b reads dh.d), so a native 255 comes back as -1 and shifts like Java's ints do.
// Entries go into the map in list order (a later entry with the same id replaces the earlier one in the earlier one's place, as HashMap.put does); a duration of
// 0 or below is kept (PotionEffect.readCustomPotionEffectFromNBT has no check; the first update removes it) and ids outside 1..23 are dropped.
export function readMobEffects(saved) {
  if (!Array.isArray(saved)) return [];
  const out = [];
  for (const e of saved) {
    if (!e || !MOB_EFFECTS.has(e.id) || !Number.isInteger(e.duration) || e.duration > 2147483647 || e.duration < -2147483648) continue;
    const entry = { id: e.id, duration: e.duration, amplifier: Number.isInteger(e.amplifier) ? Math.max(-128, Math.min(255, e.amplifier)) : 0, ...(e.ambient === true ? { ambient: true } : {}) };
    const at = out.findIndex((o) => o.id === e.id);
    if (at >= 0) out[at] = entry; else out.push(entry);
  }
  return out;
}
export const mobEffect = (e, id) => e.effects?.find((x) => x.id === id) ?? null;
// EntityLivingBase.addPotionEffect: PotionEffect.combine keeps the stronger amplifier, and the
// longer duration at equal strength. The HashMap iterates small Integer keys in order.
export function addMobEffect(e, id, duration = 2147483647, amplifier = 0) {
  if (!MOB_EFFECTS.has(id)) return false;
  if (e.type === "wither") return false; // EntityWither.addPotionEffect (xc.c(rj)) is empty: the boss takes no effects
  const list = (e.effects ??= []), old = list.find((x) => x.id === id);
  if (!old) list.push({ id, duration, amplifier });
  else if (amplifier > old.amplifier) Object.assign(old, { duration, amplifier });
  else if (amplifier === old.amplifier && duration > old.duration) old.duration = duration;
  // PotionHealthBoost (rt): onNewPotionEffect adds the maxHealth modifier. Re-adding runs onChangedPotionEffect(effect, true): the modifier comes off, health is clamped to the
  // smaller maximum (rt.a), and the modifier goes on again with the combined amplifier, so a raised effect does not keep health above the old maximum.
  if (id === HEALTH_BOOST) {
    const effect = old ?? list[list.length - 1];
    if (old) { old.boost = false; clampHealth(e); }
    effect.boost = true;
  }
  if (list.length > 12) e.effectsWide = true;
  // PotionAbsorption (rr): onNewPotionEffect adds 4 * (amplifier + 1) to the absorption amount. Re-adding an effect the mob has runs onChangedPotionEffect(effect, true):
  // remove (the amount minus 4 * (amplifier + 1) of the COMBINED effect, floored at 0), then apply it again, so a spent shield is refilled to the full amount.
  if (id === ABSORPTION) {
    const k = 4 * ((old ?? { amplifier }).amplifier + 1);
    e.absorption = f((old ? Math.max(0, f((e.absorption || 0) - k)) : e.absorption || 0) + k);
  }
  return true;
}
// EntityLivingBase.onFinishedPotionEffect: an expired Absorption effect takes its 4 * (amplifier + 1) off the amount (setAbsorptionAmount floors at 0).
// Potion.removeAttributesModifiersFromEntity of PotionHealthBoost (rt.a): the modifier goes, then health above the new maximum is cut to it.
function clampHealth(e, max = liveMax(e)) { if (e.health > max) e.health = f(max); }
const finished = (e, effect, max) => {
  if (effect.id === HEALTH_BOOST) clampHealth(e, max?.());
  if (effect.id === ABSORPTION) e.absorption = Math.max(0, f((e.absorption || 0) - 4 * (effect.amplifier + 1)));
};
// Entity.isInvisible: the flag updatePotionEffects sets from the Invisibility effect.
export const isInvisible = (e) => !!mobEffect(e, INVISIBILITY);

// Potion.moveSpeed: movementSpeed x (1 + 0.2 x (amplifier + 1)), operation 2.
export function speedModifiers(e) {
  const s = mobEffect(e, SPEED);
  const slow = mobEffect(e, SLOWNESS);
  return [...(s ? [[0.20000000298023224 * (s.amplifier + 1), 2]] : []), ...(slow ? [[-0.15000000596046448 * (slow.amplifier + 1), 2]] : [])];
}
// Potion.damageBoost (PotionAttackDamage): attackDamage x (1 + 1.3 x (amplifier + 1)),
// operation 2; EntityMob.attackEntityAsMob casts the value to float.
// `gear` is the held/worn items' attack modifiers (operation 0, applied live by EntityLivingBase.onUpdate and never saved: probed `weapon`
// records); the mob's own saved attackDamage base and modifiers (an imported list, mob-attributes.js liveAttribute) count too.
export function attackDamage(e, base, gear = 0) {
  const s = mobEffect(e, STRENGTH);
  return f(liveAttribute(e, "generic.attackDamage", base, [...(gear ? [[gear, 0]] : []), ...(s ? [[1.3 * (s.amplifier + 1), 2]] : [])]));
}

// updatePotionEffects: each PotionEffect.onUpdate runs performEffect when Potion.isReady
// (regeneration: duration % (50 >> amplifier) == 0, before the decrement; heal(1) below max
// health) and counts down; spent effects go. Then the swirls of the effects' colour
// (fx.potionParticles; rare while invisible). `size` is the mob's box (width, height),
// `rand` its Entity.rand; without `fx` the swirl rolls are still drawn.
const NO_FX = { spawn() {} };
// `maxHealth` is a number or a function returning the live maximum (it changes when a health boost ends).
export function tickMobEffects(e, size, maxHealth, rand, fx, hurt) {
  if (!e.effects?.length) return;
  const maxNow = typeof maxHealth === "function" ? maxHealth : () => maxHealth;
  // EntityLivingBase.updatePotionEffects walks the activePotionsMap (bucket order); PotionEffect.onUpdate performs and counts down an effect with time left, and an
  // effect left at 0 or below is removed (onFinishedPotionEffect) before the next one runs.
  for (const effect of effectsInMapOrder(e)) {
    if (effect.duration > 0) {
      const max = maxNow();
      if (effect.id === REGENERATION) {
        const k = 50 >> effect.amplifier;
        if ((k <= 0 || effect.duration % k === 0) && e.health > 0 && e.health < max) e.health = Math.min(max, f(e.health + 1));
      }
      // Potion.performEffect: instant health heals Math.max(4 << amplifier, 0) (damages the undead by 6 << amplifier, DamageSource.magic) and instant damage the
      // other way round; poison hurts 1 every 25 >> amplifier ticks but never kills.
      if (effect.id === INSTANT_HEALTH || effect.id === INSTANT_DAMAGE) {
        if ((effect.id === INSTANT_HEALTH) !== isUndead(e)) { if (e.health > 0) e.health = Math.min(max, f(e.health + Math.max(4 << effect.amplifier, 0))); }
        else if (hurt) hurt(e, 6 << effect.amplifier, "magic");
      }
      if (effect.id === POISON && e.health > 1) {
        const k = 25 >> effect.amplifier;
        if (k <= 0 || effect.duration % k === 0) e.health = Math.max(1, f(e.health - 1));
      }
      // Potion.performEffect for the wither: attackEntityFrom(DamageSource.wither, 1.0F) every 40 >> amplifier ticks (every tick when the
      // shift reaches zero), so the hurt window and a kill go through the world's attack path (`hurt`, which also plays the sounds).
      if (effect.id === WITHER && e.health > 0 && hurt) {
        const k = 40 >> effect.amplifier;
        if (k <= 0 || effect.duration % k === 0) hurt(e, 1, "wither");
      }
      effect.duration--;
    }
    if (effect.duration <= 0) {
      e.effects = e.effects.filter((x) => x !== effect);
      finished(e, effect, maxNow);
    }
  }
  potionParticles(fx ?? NO_FX, { x: e.x, y: e.y, z: e.z, yOffset: 0, width: size.width, height: size.height }, potionColor(e.effects), rand, { invisible: isInvisible(e) });
}
