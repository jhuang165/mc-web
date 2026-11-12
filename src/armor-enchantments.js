// Live armour and bow enchantment effects of Minecraft Java 1.7.10, and the enchantment glint.
// Replayed against public/research/armor-enchantment-reference.json (tools/probes/
// ArmorEnchantmentProbe.java, run by tools/verify-armor-enchantments.mjs) in
// src/armor-enchantments.test.js; the written evidence is public/research/enchantment-effects-armor.md.
//
// Obfuscated names: sv EntityLivingBase, sa Entity, yz EntityPlayer, zc EntityArrow, abm ItemBow,
// afv EnchantmentHelper, agi EnchantmentProtection, agj EnchantmentThorns, ro DamageSource.
//
// The per-enchantment arithmetic lives in enchantments.js (replayed against enchantment-reference.json);
// this module owns the call sites: which DamageSource a port damage reason is, the order of the
// enchantment step inside EntityLivingBase.damageEntity, setFire, decreaseAirSupply, the thorns
// reaction and ItemBow's use of the bow's enchantments.
import { JavaRandom } from "./java-random.js";
import {
  DAMAGE_SOURCES, ENCHANTMENT, getEnchantmentLevel, getEnchantmentModifierDamage, fireProtectionTicks,
  blastProtectionKnockback, getRespiration, firstItemWith, thornsShouldHit, thornsDamage,
} from "./enchantments.js";

const f = Math.fround;

// --- EnchantmentHelper's static Random -------------------------------------------------------
//
// EnchantmentHelper keeps ONE `private static final Random enchantmentRand = new Random()`, shared
// by every entity in the JVM and seeded from the clock. getEnchantmentModifierDamage draws from
// it (`rand.nextInt((n >> 1) + 1)`) on every damageEntity call that survives the armour step, even
// when the sum is 0. The port models it as one module-level JavaRandom, time-seeded like
// `new Random()` and never saved: the stream is shared by everything that uses this module (the
// player here; mobs wear no armour, so their unarmoured draws are not replayed and cannot change
// any result: nextInt(1) is always 0). Tests reseed it with `enchantmentRandom.setSeed`.
export const enchantmentRandom = new JavaRandom(BigInt(Math.floor(Math.random() * 2 ** 48)));

// --- DamageSource mapping --------------------------------------------------------------------

// Survival.damage reason strings (and a few explicit names) to DamageSource keys of enchantments.js.
// Anything unlisted is DamageSource.generic: only Protection (all) reduces it.
const REASON_SOURCES = {
  burning: "onFire", lava: "lava", fire: "inFire", lightning: "inFire", "a fall": "fall", drowning: "drown",
  starvation: "starve", suffocation: "inWall", anvil: "anvil", "a cactus": "cactus", void: "outOfWorld",
  poison: "magic", "an arrow": "arrow", "an explosion": "explosion",
};
export function damageSourceKey(reason) {
  if (DAMAGE_SOURCES[reason]) return reason;
  if (REASON_SOURCES[reason]) return REASON_SOURCES[reason];
  // "a zombie", "a spider" ...: DamageSource.causeMobDamage.
  return /^an? /.test(String(reason)) ? "mob" : "generic";
}
// DamageSource.isDamageAbsolute (ro.h): only starvation. EntityLivingBase.damageEntity skips the potion
// and enchantment step for it (and applyArmorCalculations is skipped for every bypass-armour source).
export const isAbsolute = (key) => key === "starve";
// DamageSource.isUnblockable (ro.e, field ro.p): set by setDamageBypassesArmor (ro.k). The 1.7.10 static initialiser (bytecode-read, ro.<clinit>) calls it for
// onFire, inWall, drown, starve, fall, outOfWorld, generic, magic and wither, and for the indirectMagic factory (ro.b(sa, sa)). inFire, lava, cactus, anvil, fallingBlock,
// explosions, arrows, thrown, thorns (magic flag only) and mob/player attacks are blockable. Keys here are damageSourceKey names.
export const UNBLOCKABLE_SOURCES = new Set(["onFire", "inWall", "drown", "starve", "fall", "outOfWorld", "generic", "magic", "wither", "indirectMagic"]);
export const isUnblockable = (key) => UNBLOCKABLE_SOURCES.has(key);
// EntityPlayer.damageEntity (yz.d(ro, float), bytecode-read): `if (!source.isUnblockable() && isBlocking() && amount > 0) amount = (1.0F + amount) * 0.5F`, before armour.
export function blockedDamage(amount, key, blocking) {
  return blocking && !isUnblockable(key) && amount > 0 ? f(f(1 + amount) * f(0.5)) : amount;
}

// --- EntityLivingBase.applyPotionDamageCalculations (sv.c), the enchantment part ---------------

// `armor` is the four armour stacks (boots first, as InventoryPlayer.armorInventory). An amount of 0 or
// less returns 0 at once without drawing; otherwise the shared Random is drawn once, the sum is capped
// at 25, the draw adds up to half, the result is capped at 20 and the amount becomes
// amount * (25 - k) / 25 in floats when k > 0. The Resistance potion (earlier in the same method) is not ported.
export function enchantedDamage(armor, key, amount, random = enchantmentRandom) {
  if (!(amount > 0)) return 0;
  if (isAbsolute(key)) return amount;
  let k = getEnchantmentModifierDamage(armor, DAMAGE_SOURCES[key] ?? DAMAGE_SOURCES.generic, random);
  if (k > 20) k = 20;
  if (k > 0 && k <= 20) amount = f(f(amount * (25 - k)) / 25);
  return amount;
}

// --- Entity.setFire (sa.e) ---------------------------------------------------------------------

// Burning ticks for `seconds`: seconds * 20 shortened by Fire Protection (the best piece, floor(ticks * level * 0.15F)
// off); the counter only ever grows (`if (fire < j) fire = j`). Returns the new counter.
export function setFireTicks(armor, fire, seconds) {
  const ticks = fireProtectionTicks(armor, seconds * 20);
  return fire < ticks ? ticks : fire;
}

// Entity.setFire(seconds) on a mob: the same shortening by the Fire Protection on its worn stacks (`equipment`, hand first:
// getFireTimeForEntity reads getLastActiveItems, all five slots). Writes and returns the mob's counter.
export function setMobFire(e, seconds) {
  return (e.fire = setFireTicks(e.equipment ?? [], e.fire || 0, seconds));
}

// --- Explosion.doExplosionA knockback (EnchantmentProtection.func_92092_a) -----------------------

// The scale applied to the knockback of an explosion hit: impact - floor(impact * level * 0.15F) for the best Blast
// Protection piece. floor_double of a fraction is 0 for impact <= 1 at levels up to 6, so, as in the original, the
// enchantment only changes the knockback at very high levels (the damage reduction is the separate step above).
export const blastKnockback = (armor, impact) => blastProtectionKnockback(armor, impact);

// --- EntityLivingBase.decreaseAirSupply (sv.j) ---------------------------------------------------

// Respiration level i (best piece): with i > 0 and rand.nextInt(i + 1) > 0 the air stays; otherwise it drops by one.
// `rand` is the entity's own Random; it is drawn only when i > 0.
export function decreaseAir(armor, air, rand) {
  const i = getRespiration(armor);
  return i > 0 && rand.nextInt(i + 1) > 0 ? air : air - 1;
}

// --- Thorns (EnchantmentHelper.func_151384_a, EnchantmentThorns.func_151367_b) -------------------------

// Every armour piece's enchantment list is walked in slot order; each Thorns entry rolls on the wearer's Random
// (nextFloat < 0.15 * level). A hit takes thornsDamage (level > 10 ? level - 10 : 1 + nextInt(4)) off the attacker,
// plays damage.thorns at 0.5 / 1 and costs the FIRST armour piece carrying Thorns 3 durability; a miss costs that piece 1.
// `items()` returns the live armour array (boots first), `hurt(damage)` hurts the attacker (DamageSource.causeThornsDamage:
// an entity damage source whose entity is the wearer), `sound()` plays the sound and `wear(index, amount)` is
// ItemStack.damageItem(amount, wearer). Returns the damage dealt to the attacker per hit, in order.
export function thornsReaction({ items, random, hurt = () => {}, sound = () => {}, wear = () => {} }) {
  const dealt = [], snapshot = items().slice();
  for (const stack of snapshot) {
    if (!stack) continue;
    for (const { id, lvl } of Array.isArray(stack.enchantments) ? stack.enchantments : []) {
      if (id !== ENCHANTMENT.thorns.id) continue;
      const first = firstItemWith(ENCHANTMENT.thorns, items());
      if (thornsShouldHit(lvl, random)) {
        const damage = thornsDamage(lvl, random);
        hurt(damage);
        sound();
        dealt.push(damage);
        if (first >= 0) wear(first, 3);
      } else if (first >= 0) wear(first, 1);
    }
  }
  return dealt;
}

// --- ItemBow.onPlayerStoppedUsing (abm.a) ----------------------------------------------------------

// The bow's enchantments as ItemBow reads them: Power (id 48), Punch (49), Flame (50), Infinity (51).
export function bowEnchantments(bow) {
  const level = (e) => (bow ? getEnchantmentLevel(e.id, bow) : 0);
  return { power: level(ENCHANTMENT.power), punch: level(ENCHANTMENT.punch), flame: level(ENCHANTMENT.flame), infinity: level(ENCHANTMENT.infinity) };
}
// `flag` (EntityPlayer creative or Infinity) lets the bow fire without an arrow and without consuming one; the
// arrow is then canBePickedUp 2. Power adds level * 0.5 + 0.5 to the arrow damage (a double), Punch sets
// knockbackStrength, Flame setFire(100) on the arrow: 100 SECONDS, so 2000 ticks (the reference records fire 2000). Mutates the port arrow ({damage, knockback, fire, pickup}).
export function applyBowEnchantments(arrow, bow, creative) {
  const e = bowEnchantments(bow), flag = creative || e.infinity > 0;
  if (e.power > 0) arrow.damage = arrow.damage + e.power * 0.5 + 0.5;
  if (e.punch > 0) arrow.knockback = e.punch;
  if (e.flame > 0) arrow.fire = Math.max(arrow.fire || 0, 100 * 20);
  if (flag) arrow.pickup = 2;
  return { ...e, flag };
}

// --- ItemStack.hasEffect (the glint) ---------------------------------------------------------------------

// Native item ids whose hasEffect ignores the "ench" list: 384 experience bottle, 387 written book, 399 nether star and
// 403 enchanted book always glint; 322 golden apple and 373 potion glint when damage > 0 (replayed over every item of the
// unchanged item registry, damage 0, 1 and 8). Every other item glints exactly when its tag has an "ench" list.
export function hasEffectNative(id, damage = 0, hasEnchantList = false) {
  if (id === 384 || id === 387 || id === 399 || id === 403) return true;
  if (id === 322 || id === 373) return damage > 0;
  return hasEnchantList;
}
// The port's stacks: `enchantments` is the "ench" list (inventory.js keeps an empty list distinct from none, as the
// original's tag does, and the original glints for it too), the enchanted book is port item 365 (`storesEnchantments`);
// the golden apple (322, `glintDamage` 1: the enchanted golden apple), potion, experience bottle and nether star items are
// handled through item flags; the port has no written book yet.
export function stackHasEffect(stack, item) {
  if (!stack) return false;
  if (item?.storesEnchantments || item?.alwaysGlint) return true; // alwaysGlint: ItemExpBottle.hasEffect
  if (item?.glintDamage !== undefined && (stack.damage | 0) >= item.glintDamage) return true; // ItemAppleGold.hasEffect: damage > 0
  return Array.isArray(stack.enchantments);
}
