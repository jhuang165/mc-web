// Potion effects on mobs: the four a Hard spider can spawn with (EntitySpider.GroupData),
// through EntityLivingBase.updatePotionEffects (sv.aO) and the Potion attribute modifiers.
// Recorded in DifficultyProbe's "potion" cases (public/research/difficulty-reference.json).
import { potionColor, potionParticles } from "./fx.js";
import { liveAttribute } from "./mob-attributes.js";
const f = Math.fround;
export const SPEED = 1, STRENGTH = 5, REGENERATION = 10, INVISIBILITY = 14;
export const SLOWNESS = 2, INSTANT_HEALTH = 6, FIRE_RESISTANCE = 12, WATER_BREATHING = 13, WEAKNESS = 18, POISON = 19, WITHER = 20;
// Speed, strength, regeneration and invisibility from the spider spawn roll, plus what an EntityWitch drinks (instant health, speed, fire
// resistance, water breathing) or throws (slowness, weakness, poison; witch.js).
// Nausea (9) is the cured zombie villager's villager (EntityZombie.convertToVillager); it has no effect on the mob here.
const MOB_EFFECTS = new Set([SPEED, SLOWNESS, 9, INSTANT_HEALTH, STRENGTH, REGENERATION, INVISIBILITY, FIRE_RESISTANCE, WATER_BREATHING, WEAKNESS, POISON, WITHER]);

// NBT "ActiveEffects": Id, Amplifier (byte), Duration (int). Unknown ids and spent effects
// are dropped.
export function readMobEffects(saved) {
  if (!Array.isArray(saved)) return [];
  const out = [];
  for (const e of saved)
    if (e && MOB_EFFECTS.has(e.id) && Number.isInteger(e.duration) && e.duration > 0 && e.duration <= 2147483647 && !out.some((o) => o.id === e.id))
      out.push({ id: e.id, duration: e.duration, amplifier: Number.isInteger(e.amplifier) ? Math.max(0, Math.min(255, e.amplifier)) : 0 });
  return out.sort((a, b) => a.id - b.id);
}
export const mobEffect = (e, id) => e.effects?.find((x) => x.id === id) ?? null;
// EntityLivingBase.addPotionEffect: PotionEffect.combine keeps the stronger amplifier, and the
// longer duration at equal strength. The HashMap iterates small Integer keys in order.
export function addMobEffect(e, id, duration = 2147483647, amplifier = 0) {
  if (!MOB_EFFECTS.has(id)) return false;
  if (e.type === "wither") return false; // EntityWither.addPotionEffect (xc.c(rj)) is empty: the boss takes no effects
  const list = (e.effects ??= []), old = list.find((x) => x.id === id);
  if (!old) list.push({ id, duration, amplifier }), list.sort((a, b) => a.id - b.id);
  else if (amplifier > old.amplifier) Object.assign(old, { duration, amplifier });
  else if (amplifier === old.amplifier && duration > old.duration) old.duration = duration;
  return true;
}
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
export function tickMobEffects(e, size, maxHealth, rand, fx, hurt) {
  if (!e.effects?.length) return;
  for (const effect of e.effects) {
    if (effect.duration <= 0) continue;
    if (effect.id === REGENERATION) {
      const k = 50 >> effect.amplifier;
      if ((k <= 0 || effect.duration % k === 0) && e.health > 0 && e.health < maxHealth) e.health = Math.min(maxHealth, f(e.health + 1));
    }
    // Potion.performEffect: instant health heals 4 << amplifier, poison hurts 1 every 25 >> amplifier ticks but never kills.
    if (effect.id === INSTANT_HEALTH && e.health > 0) e.health = Math.min(maxHealth, f(e.health + (4 << effect.amplifier)));
    if (effect.id === POISON && e.health > 1) {
      const k = 25 >> effect.amplifier;
      if (k <= 0 || effect.duration % k === 0) e.health = Math.max(1, f(e.health - 1));
    }
    // Potion.performEffect for the wither: attackEntityFrom(DamageSource.wither, 1.0F) every 40 >> amplifier ticks (every tick when the
    // shift reaches zero), so the hurt window and a kill go through the world's attack path (`hurt`, which also plays the sounds).
    if (effect.id === WITHER && e.health > 0 && hurt) {
      const k = 40 >> effect.amplifier;
      if (k <= 0 || effect.duration % k === 0) hurt(e, 1);
    }
    effect.duration--;
  }
  e.effects = e.effects.filter((x) => x.duration > 0);
  potionParticles(fx ?? NO_FX, { x: e.x, y: e.y, z: e.z, yOffset: 0, width: size.width, height: size.height }, potionColor(e.effects), rand, { invisible: isInvisible(e) });
}
