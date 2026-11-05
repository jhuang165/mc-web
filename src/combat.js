// Mob hurt, death and pushing rules of 1.7.10 (public/research/combat.md): the parts of
// EntityLivingBase.attackEntityFrom, onDeath and onDeathUpdate that entities.js calls, the
// per-mob dropFewItems / dropEquipment / dropRareDrop rolls on Entity.rand, and
// Entity.applyEntityCollision. combat-reference.json holds the original's results.
import { WOOL, RED_FLOWER } from "./world.js";
import { pearlCount as endermanPearls, ENDER_PEARL_ITEM as ENDER_PEARL } from "./enderman.js";
import { golemDrops } from "./iron-golem.js";
import { witherSkeletonDrops } from "./wither-skeleton.js";
import { CARROT, POTATO } from "./crops.js";
import { slimeDrops, slimeExperience } from "./slime.js";
import { witchDrops, witchEquipmentDrop, witchExperience } from "./witch.js";
import { squidDrops, squidExperience } from "./squid-bat.js";
import { dropCount as horseDropCount } from "./horse.js";
import { DISC_FIRST } from "./note-jukebox-content.js";
const f = Math.fround;
// Item ids of this build: porkchop, cooked porkchop, beef, steak, rotten flesh, leather,
// arrow, bone, bow, string, spider eye, gunpowder, iron ingot. The chicken ids are entities.js's.
const PORK = 202, COOKED_PORK = 203, BEEF = 204, STEAK = 205, FLESH = 206, LEATHER = 315, ARROW = 320, BONE = 311, BOW = 127, STRING = 321, SPIDER_EYE = 326, GUNPOWDER = 330, IRON = 302;
export const FEATHER = 317, RAW_CHICKEN = 318, COOKED_CHICKEN = 319;
export const ANIMALS = new Set(["pig", "cow", "sheep", "chicken", "wolf", "ocelot", "mooshroom", "horse"]);
// DamageSource.setDamageBypassesArmor: these skip applyArmorCalculations. Melee, arrows,
// explosions, lava, cactus and inFire (fire blocks, lightning) are blocked by armour.
const UNBLOCKABLE = new Set(["fall", "onFire", "drown", "inWall", "starve", "generic", "magic", "wither", "outOfWorld"]);
// EntityZombie.getTotalArmorValue: 2 natural points; the others wear nothing here.
const ARMOR = { zombie: 2 };
// EntityLivingBase.applyArmorCalculations: amount * (25 - armour) / 25 in floats.
export function armorReduced(type, amount, source) {
  const armor = ARMOR[type] || 0;
  if (!armor || UNBLOCKABLE.has(source)) return amount;
  return f(f(amount * (25 - armor)) / 25);
}
// getSoundVolume (EntityCow 0.4) and getSoundPitch, on Entity.rand.
// EntityCow (and EntityMooshroom), EntityWolf and EntityOcelot (bf) override getSoundVolume with 0.4F; EntityHorse with 0.8F.
export const soundVolume = (type) => (type === "horse" ? f(0.8) : type === "cow" || type === "mooshroom" || type === "wolf" || type === "squid" || type === "ocelot" ? f(0.4) : type === "bat" ? f(0.1) : 1);
export const soundPitch = (rand, child) => f(f(f(rand.nextFloat() - rand.nextFloat()) * f(0.2)) + (child ? f(1.5) : 1));
// EntitySkeleton holds a bow (equipment drop chance 0.085F); no other mob here carries
// equipment, so only its dropEquipment and getExperiencePoints draw for one.
const BOW_DROP = f(0.085), BOW_DURABILITY = 384;
// EntityLivingBase.onDeath without looting, for a mob that is not a child: dropFewItems,
// dropEquipment and, after a player hit, the rand.nextInt(200) < 5 rare drop (only the
// zombie has one), then EntityCreeper's record roll when a skeleton's arrow killed it (no
// records in this build: the roll is drawn and nothing drops). Each entry is one EntityItem:
// [id, damage]. `burning` is isBurning (cooked meat).
// `looting` is EnchantmentHelper.getLootingModifier of the player's held item (only a player kill
// carries it): the extra nextInt(looting + 1) of the bonus drops, nextInt(3 + looting) for skeleton
// arrows and bones, the equipment drop's nextFloat - looting * 0.01F and the rare drop's
// nextInt(200) - looting. EntityLiving.dropFewItems draws its bonus only when looting > 0; the
// animals' drop formulas always draw nextInt(1 + looting).
export function mobDrops(e, { playerHit, burning = false, bySkeleton = false, looting = 0 }, rand) {
  const out = [], add = (id, n = 1, damage = 0) => { for (let i = 0; i < n; i++) out.push([id, damage]); };
  const generic = () => rand.nextInt(3) + (looting > 0 ? rand.nextInt(looting + 1) : 0);
  switch (e.type) {
    case "pig": add(burning ? COOKED_PORK : PORK, rand.nextInt(3) + 1 + rand.nextInt(1 + looting)); break;
    case "mooshroom": // EntityMooshroom drops like EntityCow
    case "cow": {
      add(LEATHER, rand.nextInt(3) + rand.nextInt(1 + looting));
      add(burning ? STEAK : BEEF, rand.nextInt(3) + 1 + rand.nextInt(1 + looting));
      break;
    }
    case "sheep": if (!e.sheared) add(WOOL, 1, e.color || 0); break;
    case "chicken": add(FEATHER, rand.nextInt(3) + rand.nextInt(1 + looting)); add(burning ? COOKED_CHICKEN : RAW_CHICKEN); break;
    case "zombie": add(FLESH, generic()); break;
    case "enderman": add(ENDER_PEARL, endermanPearls(rand, looting)); break; // EntityEnderman.dropFewItems: 0 to 1 + looting pearls; the carried block is not dropped
    case "wither_skeleton": for (const [id] of witherSkeletonDrops(rand, { looting })) add(id); break; // EntitySkeleton type 1: coal and bones (wither-skeleton.js)
    case "skeleton": add(ARROW, rand.nextInt(3 + looting)); add(BONE, rand.nextInt(3 + looting)); break;
    case "spider":
    case "cave_spider": // EntityCaveSpider inherits EntitySpider.dropFewItems
      add(STRING, generic());
      if (playerHit && (rand.nextInt(3) === 0 || rand.nextInt(1 + looting) > 0)) add(SPIDER_EYE);
      break;
    case "creeper": add(GUNPOWDER, generic()); break;
    case "iron_golem": for (const [id, n, damage] of golemDrops(rand, RED_FLOWER)) add(id, n, damage); break; // EntityIronGolem.dropFewItems
    case "slime": for (const id of slimeDrops(rand, e.size, looting)) add(id); break; // EntitySlime.dropFewItems (slime.js)
    case "witch": for (const [id] of witchDrops(rand, looting)) add(id); break; // EntityWitch.dropFewItems (witch.js)
    case "snow_golem": { const n = rand.nextInt(16); if (n > 0) add(312, n); break; } // EntitySnowman.dropFewItems: nextInt(16) snowballs
    case "horse": add([LEATHER, LEATHER, LEATHER, FLESH, BONE][e.horse?.type ?? 0], horseDropCount(rand, looting)); break; // EntityHorse.u(): leather, rotten flesh or bone (horse.js)
    case "squid": for (const s of squidDrops(rand, looting)) add(s.id, 1, s.damage); break; // EntitySquid.dropFewItems: ink sacs (squid-bat.js)
  }
  // EntityLiving.dropEquipment: a damageable item drops worn, maxDamage minus
  // nextInt(1 + nextInt(maxDamage - 25)), kept within [1, maxDamage - 25].
  if (e.type === "skeleton" && playerHit && f(rand.nextFloat() - f(looting * f(0.01))) < BOW_DROP) {
    const k = Math.max(BOW_DURABILITY - 25, 1);
    add(BOW, 1, Math.min(k, Math.max(1, BOW_DURABILITY - rand.nextInt(rand.nextInt(k) + 1))));
  }
  // EntityLiving.dropEquipment for a witch's held potion (0.085F).
  if (e.type === "witch") { const held = witchEquipmentDrop(rand, e.held, playerHit, looting); if (held) add(held.id, 1, held.damage); }
  const rare = playerHit && rand.nextInt(200) - looting < 5;
  if (rare && e.type === "zombie") add([IRON, CARROT, POTATO][rand.nextInt(3)]);
  if (rare && e.type === "wither_skeleton") add(2050, 1, 1); // EntitySkeleton.dropRareDrop: the wither skeleton skull
  if (e.type === "creeper" && bySkeleton) add(DISC_FIRST + rand.nextInt(12)); // EntityCreeper.onDeath: Item.getItemById(2256 + nextInt(12))
  return out;
}
// getExperiencePoints at deathTime 20: EntityAnimal 1 + World.rand.nextInt(3); EntityMob
// 5, plus 1 + rand.nextInt(3) per equipment item whose drop chance is at most 1.
export function experiencePoints(e, rand, worldRand) {
  if (e.type === "squid") return squidExperience(worldRand); // EntityWaterMob.getExperiencePoints: 1 + world.rand.nextInt(3)
  if (e.type === "villager" || e.type === "iron_golem" || e.type === "snow_golem" || e.type === "bat") return 0; // EntityLiving.experienceValue stays 0 (EntityVillager is no EntityMob or EntityAnimal)
  if (ANIMALS.has(e.type)) return 1 + worldRand.nextInt(3);
  if (e.type === "slime") return slimeExperience(e.size); // experienceValue = size
  if (e.type === "witch") return witchExperience(rand, e.held); // 5 plus 1 + nextInt(3) for a held potion
  return 5 + (e.type === "skeleton" || e.type === "wither_skeleton" ? 1 + rand.nextInt(3) : 0);
}
// Entity.applyEntityCollision (sa.g(Lsa;)V) called on `self` for `other`: each is moved
// 0.05 apart along the larger axis distance's square root, nothing when they are within
// 0.01 on both axes. entityCollisionReduction is 0 for every entity here.
export function applyEntityCollision(self, other, moveSelf = true, moveOther = true) {
  let dx = other.x - self.x, dz = other.z - self.z, d = Math.max(Math.abs(dx), Math.abs(dz));
  if (d < 0.009999999776482582) return;
  d = f(Math.sqrt(d));
  dx /= d;
  dz /= d;
  const k = Math.min(1, 1 / d);
  dx = dx * k * 0.05000000074505806;
  dz = dz * k * 0.05000000074505806;
  if (moveSelf) { self.vx -= dx; self.vz -= dz; }
  if (moveOther) { other.vx += dx; other.vz += dz; }
}
// AxisAlignedBB.intersectsWith of [minX, minY, minZ, maxX, maxY, maxZ] boxes, strict.
export const boxesMeet = (a, b) => b[3] > a[0] && b[0] < a[3] && b[4] > a[1] && b[1] < a[4] && b[5] > a[2] && b[2] < a[5];
