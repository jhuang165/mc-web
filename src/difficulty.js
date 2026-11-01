// EnumDifficulty (rd) and the 1.7.10 rules that read it, as recorded from the unchanged
// classes by tools/probes/DifficultyProbe.java (public/research/difficulty-reference.json).
// GameSettings.difficulty (bbj.au) is a client option, default Normal, which the integrated
// server copies to every World.difficultySetting.
const f = Math.fround;
export const PEACEFUL = 0, EASY = 1, NORMAL = 2, HARD = 3;
export const DIFFICULTY_NAMES = ["Peaceful", "Easy", "Normal", "Hard"];
// GameSettings reads "difficulty:<id>" with EnumDifficulty.getDifficultyEnum (id & 3 when
// cycled); anything else keeps the default.
export const difficultySetting = (v) => (Number.isInteger(v) && v >= 0 && v <= 3 ? v : NORMAL);

// EntityPlayer.attackEntityFrom (yz.a(ro, F)) for a DamageSource with isDifficultyScaled
// (mob melee, explosions): Peaceful 0, Easy amount / 2 + 1, Hard amount * 3 / 2. A result of
// 0 returns false before any damage, knockback or hurt sound. Arrows, falls, fire, lava,
// drowning, starvation and potions are not scaled.
export function scaleDamage(d, amount) {
  if (d === PEACEFUL) return 0;
  if (d === EASY) return f(f(amount / 2) + 1);
  if (d === HARD) return f(f(amount * 3) / 2);
  return amount;
}

// FoodStats.onUpdate (zr.a(yz)) with food 0: every 80 ticks starvation deals 1 while health is
// above 10, on Hard at any health, and on Normal above 1. Easy and Peaceful stop at 10.
export const starvationHurts = (d, health) => health > 10 || d === HARD || (health > 1 && d === NORMAL);
// The exhaustion step: saturation goes first; with none left, food drops except on Peaceful.
export const hungerDrops = (d) => d !== PEACEFUL;
// EntityPlayer.onLivingUpdate (yz.e): on Peaceful, with naturalRegeneration, the player heals 1
// whenever ticksExisted % 20 * 12 == 0 (that is, ticksExisted % 20 == 0) below max health.
export const peacefulRegen = (d, ticksExisted) => d === PEACEFUL && ticksExisted % 20 === 0;

// WorldProvider.getCurrentMoonPhaseFactor: WorldProvider.moonPhaseFactors (aqo.a) for
// getMoonPhase(worldTime) = (int)(worldTime / 24000 % 8 + 8) % 8.
export const MOON_FACTORS = [1, 0.75, 0.5, 0.25, 0, 0.25, 0.5, 0.75];
export const moonPhase = (worldTime) => ((Math.trunc(worldTime / 24000) % 8) + 8) % 8;
// World.func_147462_b (ahb.B(III)), the "local difficulty" the spawn rolls scale by: the
// chunk's inhabited time over 3,600,000 ticks (clamped to 1; x0.75 below Hard) plus a quarter
// of the moon factor, only when the block exists; Easy and Peaceful scale it by id / 2; the
// result is clamped to [0, 1], or [0, 1.5] on Hard.
export function localDifficulty(d, worldTime, inhabited, exists = true) {
  const hard = d === HARD;
  let v = 0;
  if (exists) {
    v = f(v + f(Math.min(1, Math.max(0, f(inhabited / 3600000))) * (hard ? 1 : f(0.75))));
    v = f(v + f(MOON_FACTORS[moonPhase(worldTime)] * f(0.25)));
  }
  if (d === EASY || d === PEACEFUL) v = f(v * f(d / 2));
  return Math.min(hard ? 1.5 : 1, Math.max(0, v));
}

// Chunk.inhabitedTime as PlayerManager keeps it: each watched chunk (PlayerInstance) adds
// totalWorldTime - previousWorldTime when updatePlayerInstances runs more than 8000 ticks
// after its last pass, and when the player stops watching it. The view radius (8 or 12
// chunks) covers this build's 8 x 8 chunks from anywhere, so every chunk holds the same
// value and one counter stands for all of them. A new PlayerManager starts its pass clock at
// 0 and a new PlayerInstance at the current time; leaving the world adds the pending time.
export class InhabitedTime {
  constructor(saved = 0, now = 0) {
    this.flushed = Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : 0;
    this.since = now;
    this.pass = 0;
  }
  tick(now) {
    if (now - this.pass > 8000) {
      this.pass = now;
      this.flushed += Math.max(0, now - this.since);
      this.since = now;
    }
  }
  // What World.func_147462_b reads from the chunk.
  get value() { return this.flushed; }
  save(now) { return this.flushed + Math.max(0, now - this.since); }
}

// ModifiableAttributeInstance.computeValue: operation 0 amounts add to the base, operation 1
// amounts add base x amount, operation 2 amounts multiply by 1 + amount.
export function attributeValue(base, modifiers = [], min = -Infinity, max = Infinity) {
  let d0 = base;
  for (const [amount, op] of modifiers) if (op === 0) d0 += amount;
  let d1 = d0;
  for (const [amount, op] of modifiers) if (op === 1) d1 += d0 * amount;
  for (const [amount, op] of modifiers) if (op === 2) d1 *= 1 + amount;
  return Math.min(max, Math.max(min, d1));
}
// EntityLiving.onSpawnWithEgg (sw.a(sy)): "Random spawn bonus", nextGaussian() * 0.05 as an
// operation 1 modifier on followRange. Returns the modifier list entry.
export const spawnBonus = (rand) => [rand.nextGaussian() * 0.05, 1];

// EntitySpider.onSpawnWithEgg (yn.a(sy)) without group data: EntityLiving's bonus (entity
// rand), the jockey roll World.rand.nextInt(100) == 0 (a skeleton rider; its own spawn rolls
// use its own Random), then on Hard with World.rand.nextFloat() < 0.1 x local difficulty
// GroupData.func_111104_a picks World.rand.nextInt(5): 0-1 speed, 2 strength,
// 3 regeneration, 4 invisibility, added as PotionEffect(id, Integer.MAX_VALUE).
export const SPIDER_EFFECTS = [1, 1, 5, 10, 14];
export function spiderSpawnRolls(rand, worldRand, d, local) {
  const followRange = attributeValue(16, [spawnBonus(rand)], 0, 2048);
  const jockey = worldRand.nextInt(100) === 0;
  let effect = 0;
  if (d === HARD && worldRand.nextFloat() < f(f(0.1) * local)) effect = SPIDER_EFFECTS[worldRand.nextInt(5)];
  return { followRange, jockey, effect };
}

// EntityZombie.onSpawnWithEgg (yq.a(sy)) with no group data, in the original draw order.
// `rand` is Entity.rand, `worldRand` World.rand, `local` World.func_147462_b at the zombie and
// `date` World.getCurrentDate's month (1-12) and day. EntityLiving.addRandomArmor (sw.bC) and
// EntityZombie.addRandomArmor (yq.bC) pick armour tiers and the iron sword or shovel, and
// enchantEquipment (sw.bD) rolls per item; this build gives mobs no equipment, so the slots
// are reported and `diverged` marks an enchantment roll that passed (EnchantmentHelper's own
// draws are not reproduced, so later values of `rand` differ from the original).
export function zombieSpawnRolls(rand, worldRand, d, local, date = { month: 6, day: 1 }) {
  const out = { diverged: false, equipment: [] };
  const follow = [spawnBonus(rand)];
  out.loot = rand.nextFloat() < f(f(0.55) * local);
  // EntityZombie.GroupData (ys): child, then villager.
  out.child = worldRand.nextFloat() < f(0.05);
  out.villager = worldRand.nextFloat() < f(0.05);
  // A child rides the first chicken in range (5, 3, 5) or, failing the second roll, a new one.
  if (out.child) {
    out.nearbyChicken = worldRand.nextFloat() < 0.05;
    if (!out.nearbyChicken) out.newChicken = worldRand.nextFloat() < 0.05;
  }
  out.doors = rand.nextFloat() < f(local * f(0.1));
  // sw.bC: a helmet always, then boots-ward until a roll of the stop chance.
  const slots = [null, null, null, null, null];
  if (rand.nextFloat() < f(f(0.15) * local)) {
    let tier = rand.nextInt(2);
    const stop = d === HARD ? f(0.1) : f(0.25);
    for (let k = 0; k < 3; k++) if (rand.nextFloat() < f(0.095)) tier++;
    for (let i = 3; i >= 0; i--) {
      if (i < 3 && rand.nextFloat() < stop) break;
      slots[i + 1] = { tier };
    }
  }
  // yq.bC: an iron sword (1 in 3) or iron shovel, 5% on Hard, else 1%.
  if (rand.nextFloat() < (d === HARD ? f(0.05) : f(0.01))) slots[0] = { weapon: rand.nextInt(3) === 0 ? "iron_sword" : "iron_shovel" };
  // sw.bD: the held item at 0.25 x local, each armour piece at 0.5 x local.
  if (slots[0] && rand.nextFloat() < f(f(0.25) * local)) out.diverged = true;
  for (let i = 0; i < 4 && !out.diverged; i++) if (slots[i + 1] && rand.nextFloat() < f(f(0.5) * local)) out.diverged = true;
  out.equipment = slots.flatMap((s, i) => (s ? [i] : []));
  if (out.diverged) return out;
  // Halloween: no helmet, 31 October, a quarter of zombies wear a pumpkin (a tenth of those lit).
  if (!slots[4] && date.month === 10 && date.day === 31 && rand.nextFloat() < f(0.25)) {
    out.pumpkin = rand.nextFloat() < f(0.1) ? "lit_pumpkin" : "pumpkin";
    out.equipment.push(4);
  }
  // "Random spawn bonus" on knockbackResistance (operation 0) and "Random zombie-spawn bonus"
  // on followRange (operation 2, only above 1).
  out.knockback = rand.nextDouble() * 0.05000000074505806;
  const bonus = rand.nextDouble() * 1.5 * local;
  if (bonus > 1) follow.push([bonus, 2]);
  out.followRange = attributeValue(40, follow, 0, 2048);
  // The leader: reinforcement chance + 0.5 to 0.75, max health x (2 to 5), breaks doors.
  out.leader = rand.nextFloat() < f(local * f(0.05));
  out.reinforcementBonus = 0;
  out.maxHealth = 20;
  if (out.leader) {
    out.reinforcementBonus = rand.nextDouble() * 0.25 + 0.5;
    out.maxHealth = attributeValue(20, [[rand.nextDouble() * 3 + 1, 2]], 0, Number.MAX_VALUE);
    out.doors = true;
  }
  return out;
}
// EntityZombie.applyEntityAttributes: zombie.spawnReinforcements (yq.bp, range 0 to 1) has the
// base rand.nextDouble() * 0.1F.
export const reinforcementBase = (random) => random() * 0.10000000149011612;
export const reinforcementChance = (v) => Math.min(1, Math.max(0, v));
// The "Zombie reinforcement caller/callee charge", -0.05F, operation 0.
export const REINFORCEMENT_CHARGE = -0.05000000074505806;

// EntityZombie.attackEntityFrom (yq.a(ro, F)) after the hit counted and a living target was
// found (attack target, else revenge target, else the source's entity): on Hard with
// Entity.rand.nextFloat() < the reinforcement chance, up to 50 tries of
// floor(pos) + nextInt(7..40) x nextInt(-1..1) per axis (x, y, z). A spot needs a solid top
// at y - 1 and getBlockLightValue < 10, then (with the new zombie at the integer position)
// no entity in its box, no block boxes and no liquid. Returns the spot or null.
export function zombieReinforcement(rand, d, chance, x, y, z, place) {
  if (d !== HARD || !(rand.nextFloat() < chance)) return null;
  const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
  const offset = () => (rand.nextInt(34) + 7) * (rand.nextInt(3) - 1);
  for (let i = 0; i < 50; i++) {
    const px = bx + offset(), py = by + offset(), pz = bz + offset();
    if (!place.solidTop(px, py - 1, pz) || place.light(px, py, pz) >= 10) continue;
    if (!place.fits(px, py, pz)) continue;
    return { x: px, y: py, z: pz };
  }
  return null;
}

// EntityZombie.attackEntityAsMob (yq.n(sa)): after a hit, a zombie with nothing in its hand
// that is burning sets the target on fire for 2 x difficulty id seconds with
// rand.nextFloat() < id x 0.3F. Returns the fire ticks, or 0.
export function zombieFireOnHit(rand, d, burning, holding = false) {
  if (holding || !burning) return 0;
  return rand.nextFloat() < f(d * f(0.3)) ? 2 * d * 20 : 0;
}

// EntityLiving.getMaxSafePointTries (sw.ax): with an attack target,
// (int)(health - maxHealth * 0.33F) - (3 - id) * 4, at least 0, plus 3; otherwise 3.
export function maxSafePointTries(hasTarget, health, maxHealth, d) {
  if (!hasTarget) return 3;
  const i = Math.trunc(f(health - f(maxHealth * f(0.33)))) - (3 - d) * 4;
  return (i < 0 ? 0 : i) + 3;
}
