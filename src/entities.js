import { entityActive } from './streaming-ticks.js';
import { spawnDimensionMonsters } from "./dimension-spawning.js";
import { gameRule } from "./game-rules.js";
import { spiderAttack, spiderDrops, spiderFindsPlayer, STRING, SPIDER_EYE, isSpider, soundType, caveSpiderPoisonTicks } from "./spider.js";
import { countsAs, boxesIntersect, monsterCanSpawnHere, mobBox, SPAWN_BRIGHTNESS } from "./mob-spawner.js";
import { ENDERMAN_HEALTH, ENDERMAN_WIDTH, ENDERMAN_HEIGHT, ENDERMAN_SPEED, ENDERMAN_ATTACK, SPEED_BOOST as ENDERMAN_BOOST, endermanFields, endermanFieldsFrom, SOUNDS as ENDERMAN_SOUNDS, livingSound as endermanLiving } from "./enderman.js";
import { endermanTick, endermanHurt, endermanSpawn, ENDERMAN_TRANSIENT } from "./enderman-live.js";
import { SILVERFISH, SILVERFISH_SOUNDS, silverfishActionState, legacyFields as silverfishFields, silverfishCanSpawnHere, hurtSummon, attackReady, pathWeight as silverfishPathWeight, eggSpawn } from "./silverfish.js";
import { POISON } from "./status-effects.js";
import { WITHER_SKELETON_STATS, witherHitEffect } from "./wither-skeleton.js";
import {CARROT,zombieRareDrop} from './crops.js';
import { creeperFields, creeperSavedFields, creeperTick, creeperFall, creeperDrops, GUNPOWDER } from "./creeper.js";
import { SIZE, HEIGHT, hash, slipperiness, collisionBoxes as cellCollisionBoxes, normalCube, WOOL, isLiquid, DYE, BLOCKS, PUMPKIN } from "./world.js";
import { isOnLadder, ladderClamp, LADDER_CLIMB } from "./ladders.js";
import { mobStepEvents, isEntityMob } from "./mob-steps.js";
import { ITEMS } from "./survival.js";
import { weaponEnchantments, arthropodSlowness, javaLikeRandom } from "./enchantment-effects.js";
import { insideOpaqueBlock, mobEyeHeight } from "./suffocation.js";
import { mhSin, mhCos, JavaRandom } from "./lighting.js";
import { enterWater, burst, drownBubbles } from "./fx.js";
import { waterAcceleration, entityWaterBox, inLava, eyeInWater } from "./fluids.js";
import { sheepColor, childColor } from "./sheep.js";
import { sneakEdge, criticalDamage } from "./player-movement.js";
import { MobAI } from "./ai.js";
import { VILLAGER_TYPE, VILLAGER_SOUNDS, villagerFields } from "./villager.js";
import { IRON_GOLEM_TYPE, IRON_GOLEM_SOUNDS, ironGolemFields, ironGolemShape } from "./iron-golem.js";
import { createVillages, PLAYER_NAME } from "./village-host.js";
import { SLIME, mobScale, slimeDamage, slimeTouches, slimeFields, slimeFieldsFrom, slimeRestore, slimeWidth, slimeSoundName, slimeVolume, slimeSquishStart, slimeSquishEnd, slimeActionState, slimeChildren, slimeCanSpawnHere, isSlimeChunk, SLIMEBALL } from "./slime.js";
import { isSlimeLike } from "./slime.js";
import { PIGMAN, MAGMA, isPigman, isMagma, magmaDamage, magmaJumpMotion, pigmanEquipment } from "./nether-melee.js";
import { pigmanFields, pigmanFieldsFrom, pigmanHurt, pigmanTick, pigmanThink, pigStrike } from "./nether-melee-live.js";
import { SQUID, BAT } from "./squid-bat.js";
import { ENDER_CRYSTAL_TYPE, crystalUpdate, crystalAttack } from "./ender-crystal-mobs.js";
import { installMooshroomGolem } from "./mooshroom-golem-live.js";
import { installHorseGear, gearFieldsFrom } from "./horse-gear-live.js";
import { installPigSaddle } from "./pig-saddle-live.js";
import { HORSE_ENTITY, horseRideThink, horseFields, horseFieldsFrom, horseChildFields, installHorse } from "./horse-live.js";
import { dragonUpdate, dragonHit, installDragonMobs } from "./dragon-mobs.js";
import { blazeUpdate, ghastUpdate, fireballMobTalk, installFireballMobs } from "./blaze-ghast-mobs.js";
import { witherUpdate, witherPost, witherTalk, witherRanged, installWither } from "./wither-boss-mobs.js";
import { squidBatUpdate, squidBatTalk, squidBatSpawnPass, installSquidBat } from "./squid-bat-mobs.js";
import { WITCH, WITCH_SOUNDS, witchDrink, witchDamage, ITEM_POTION, potionEffects } from "./witch.js";
import { webMove } from './webs.js';
import { blockCollisions } from "./block-collisions.js";
import { NORMAL, PEACEFUL, attributeValue, spawnBonus, spiderSpawnRolls, zombieSpawnRolls, reinforcementBase, reinforcementChance, REINFORCEMENT_CHARGE, zombieReinforcement, zombieFireOnHit } from "./difficulty.js";
import { readMobEffects, addMobEffect, tickMobEffects, speedModifiers, attackDamage } from "./mob-effects.js";
import { NAUSEA, CURE_NAUSEA_TICKS, AUX_INFECT, AUX_CURE, killConverts, startConversionTicks, conversionBoost, canCure, startConversion, remedySound, auxSound, readZombieVillager } from "./zombie-villager.js";
import { landingEffects, JUMP_BOOST, statusPitchRandom } from "./damage-fx.js";
import { WOLF_WIDTH, WOLF_HEIGHT, WOLF_SPEED, WILD_MAX_HEALTH, TAMED_MAX_HEALTH, WOLF_SOUNDS, wolfFields, wolfFieldsFrom, isTamed as wolfTamed, maxHealth as wolfMaxHealth, tailAngle, interestedAngle, shakeAngle, wetShade, wolfSay, hurtAmount as wolfHurtAmount, attackStrength as wolfAttack, puppyFields, interact as wolfClick, updateWolf } from "./wolf.js";
import { noteWolfHurt } from "./wolf-ai.js";
import { OCELOT_WIDTH, OCELOT_HEIGHT, OCELOT_SPEED, OCELOT_HEALTH, OCELOT_SOUNDS, ocelotFields, ocelotFieldsFrom, isTamed as ocelotTamed, ocelotSay, kittenFields, kittenLitter, interact as ocelotClick, sitsOnChest } from "./ocelot.js";
import { ocelotSpawnPass } from "./ocelot-spawn.js";
import { armorReduced, soundVolume, soundPitch, mobDrops, experiencePoints, applyEntityCollision, boxesMeet, ANIMALS, FEATHER, RAW_CHICKEN, COOKED_CHICKEN } from "./combat.js";
const f = Math.fround;
// MathHelper.wrapAngleTo180_float (qh.g).
export function wrapDegrees(a) {
  a = f(a % 360);
  if (a >= 180) a = f(a - 360);
  if (a < -180) a = f(a + 360);
  return a;
}
// sv.h shifts each prev angle by whole turns until it is within 180 degrees of
// the current one, so the renderer's lerp never spins the long way round.
export function nearAngle(prev, cur) {
  while (f(cur - prev) < -180) prev = f(prev - 360);
  while (f(cur - prev) >= 180) prev = f(prev + 360);
  return prev;
}
// RendererLivingEntity.interpolateRotation (boh.a(FFF)F).
export function interpolateRotation(prev, cur, partial) {
  let d = f(cur - prev);
  while (d < -180) d = f(d + 360);
  while (d >= 180) d = f(d - 360);
  return f(prev + f(partial * d));
}
// EntityBodyHelper.func_75665_a (tr.a(FFF)F): `to` turned toward `from`, at most `max` away.
const clampYaw = (from, to, max) => f(from - Math.min(Math.max(wrapDegrees(f(from - to)), -max), max));
// Transient render state, rebuilt on load: lastTickPos (which World sets equal
// to prevPos before every onUpdate), the Java-convention yaw/pitch degrees and
// the limb swing. `gait` is the old limb phase from earlier saves.
// Physics state is rebuilt on load as well: motion is already reset there.
// Entity.rand, one java.util.Random per entity; never saved.
const RANDOMS = new WeakMap();
export const entityRandom = (e) => {
  let r = RANDOMS.get(e);
  if (!r) RANDOMS.set(e, (r = new JavaRandom(Math.floor(Math.random() * 2 ** 48))));
  return r;
};
// Seeds Entity.rand (the combat replay in combat.test.js).
export const setEntityRandom = (e, rand) => RANDOMS.set(e, rand);
const TRANSIENT = [...ENDERMAN_TRANSIENT, "inWeb", "onGround", "collidedH", "inWater", "fallDistance", "moveForward", "aiMoveSpeed", "jumping", "jumpTicks", "lastDamage", "inLava", "fire", "idle", "revenge", "recentlyHit"];
const INTERPOLATED = [...TRANSIENT, "eggTimer", "wingRotation", "destPos", "oFlapSpeed", "oFlap", "wingRotDelta", "px", "py", "pz", "rotationYaw", "prevRotationYaw", "renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead", "rotationPitch", "prevRotationPitch", "limbSwing", "limbSwingAmount", "prevLimbSwingAmount", "bodyTicks", "bodyHeadYaw", "gait"];
// Entity.rotationYaw is Java degrees (0 faces +z, increasing toward -x); e.yaw
// is the radian bearing used by the movement code, which turns toward +x.
const javaYaw = (e) => f((-e.yaw * 180) / Math.PI) + 0;
// Seed every prev field from the current state (spawn, load, reset): RenderManager
// sets lastTickPos = pos at ticksExisted 0 so nothing interpolates from the origin.
export function syncInterpolation(e) {
  const yaw = javaYaw(e);
  return Object.assign(e, {
    px: e.x, py: e.y, pz: e.z,
    rotationYaw: yaw, prevRotationYaw: yaw, renderYawOffset: yaw, prevRenderYawOffset: yaw,
    rotationYawHead: yaw, prevRotationYawHead: yaw, rotationPitch: 0, prevRotationPitch: 0,
    limbSwing: 0, limbSwingAmount: 0, prevLimbSwingAmount: 0, bodyTicks: 0, bodyHeadYaw: yaw,
  });
}
// What RenderManager.renderEntitySimple and RendererLivingEntity.doRender feed
// the model at `partial`: lastTickPos lerp, body/head yaw through
// interpolateRotation (head relative to the body), pitch, limbSwing
// (limbSwing - limbSwingAmount * (1 - partial), x3 for children) and
// limbSwingAmount (lerped, capped at 1), age in ticks, and the death roll
// (deathTime + partial - 1) / 20 * 1.6 -> sqrt, capped at 1, times 90 degrees.
// EntitySheep.func_70894_j (wp.p(F)): how far the head has dropped, 0 to 1, for the
// grazing timer `br` (40 down to 0): it lowers over the first 4 ticks, stays down
// from 36 to 4 and rises over the last 4.
export function sheepHeadDrop(timer, partial) {
  if (timer <= 0) return 0;
  if (timer >= 4 && timer <= 36) return 1;
  return timer < 4 ? f(f(timer - partial) / 4) : f(-f(f(timer - 40) - partial) / 4);
}
// EntitySheep.func_70890_k (wp.q(F)): the head pitch in radians; a grazing sheep
// looks down 36 degrees and nods by 0.21991149 rad, otherwise it follows rotationPitch.
export function sheepHeadPitch(timer, partial, pitchDegrees = 0) {
  if (timer > 4 && timer <= 36) {
    const x = f(f(timer - 4 - partial) / 32);
    return f(0.62831855 + f(0.21991149 * f(Math.sin(f(x * 28.7)))));
  }
  return timer > 0 ? f(0.62831855) : f(pitchDegrees / 57.295776);
}
// RenderChicken.handleRotationFloat (bng.a(wg, F)F): the wing angle fed to the
// model as ageInTicks, (sin(oFlap + (wingRotation - oFlap) * partial) + 1) *
// (oFlapSpeed + (destPos - oFlapSpeed) * partial), with MathHelper.sin's table.
export function chickenFlap(e, partial) {
  const p = f(partial), a = f(e.oFlap + f(f(e.wingRotation - e.oFlap) * p)), b = f(e.oFlapSpeed + f(f(e.destPos - e.oFlapSpeed) * p));
  return f(f(mhSin(a) + 1) * b);
}
// EntityWolf's render inputs: ch() tail, getInterestedAngle, getShakeAngle at the head/mane/body/tail offsets and the
// wet shading (RenderWolf and ModelWolf.setLivingAnimations, wolf-renderer.js).
function wolfPose(e, p) {
  return { wolf: { tail: tailAngle(e), interested: interestedAngle(e, p), shakeHead: shakeAngle(e, p, 0), shakeMane: shakeAngle(e, p, -0.08), shakeBody: shakeAngle(e, p, -0.16), shakeTail: shakeAngle(e, p, -0.2), shade: wetShade(e, p), wet: !!e.wet, tamed: wolfTamed(e), angry: !!e.angry, sitting: !!e.sitting, collar: e.collar } };
}
export function mobPose(e, partial) {
  const p = f(partial), lerp = (a, b) => a + (b - a) * p,
    body = interpolateRotation(e.prevRenderYawOffset, e.renderYawOffset, p),
    head = interpolateRotation(e.prevRotationYawHead, e.rotationYawHead, p);
  let swing = f(e.limbSwing - f(e.limbSwingAmount * f(1 - p))),
    amount = f(e.prevLimbSwingAmount + f(f(e.limbSwingAmount - e.prevLimbSwingAmount) * p)),
    death = 0;
  if (e.growingAge < 0) swing = f(swing * 3);
  if (amount > 1) amount = 1;
  if (e.death > 0) death = f(Math.min(1, f(Math.sqrt(f(f(f(f(e.death + p) - 1) / 20) * f(1.6))))) * 90);
  const headPitch = f(e.prevRotationPitch + f(f(e.rotationPitch - e.prevRotationPitch) * p));
  return {
    ...(e.type === "chicken" ? { flap: chickenFlap(e, p) } : {}),
    ...(e.type === "wolf" ? wolfPose(e, p) : {}),
    ...(e.type === "ocelot" ? { ocelot: { catType: e.catType, tamed: ocelotTamed(e), sitting: !!e.sitting, sneaking: !!e.sneaking, sprinting: !!e.sprinting } } : {}),
    ...(e.type === "sheep" ? { headDrop: sheepHeadDrop(e.eatTimer || 0, p), headTilt: sheepHeadPitch(e.eatTimer || 0, p, headPitch) } : {}),
    x: lerp(e.px, e.x), y: lerp(e.py, e.y), z: lerp(e.pz, e.z),
    bodyYaw: body, headYaw: f(head - body),
    headPitch,
    limbSwing: swing, limbSwingAmount: amount, age: e.age + p, death: isSpider(e.type) || e.type === "silverfish" ? death * 2 : death,
  };
}
// Widths and heights are each 1.7.10 constructor's setSize: EntityPig (wo)
// 0.9 x 0.9, EntityCow (wh) 0.9 x 1.3, EntitySheep (wp) 0.9 x 1.3, EntityZombie
// (yq) 0.6 x 1.8. `movement` is the applyEntityAttributes (aD)
// SharedMonsterAttributes.movementSpeed base (pig 0.25, cow (double)0.2f, sheep
// (double)0.23f, zombie (double)0.23f) and sheep maxHealth is 8; `ai` holds the AI
// task speed multipliers from each constructor: EntityAIPanic (uz) pig 1.25, cow
// 2.0, sheep 1.25; EntityAITempt (vk) pig 1.2, cow 1.25, sheep 1.1; EntityAIFollowParent
// (uh) pig 1.1, cow 1.25, sheep 1.1; EntityAIMate (ua) and EntityAIWander (vc) 1.0;
// the zombie's EntityAIAttackOnCollide (us) and EntityAIWander 1.0. A sheep has no
// `drop`: wool comes from its own dropFewItems (wp.b), and mutton does not exist yet.
export const ENTITY_TYPES = {
  pig: { health: 10, width: 0.9, height: 0.9, movement: 0.25, ai: { wander: 1, mate: 1, panic: 1.25, tempt: 1.2, follow: 1.1 }, drop: 202 },
  cow: { health: 10, width: 0.9, height: 1.3, movement: f(0.2), ai: { wander: 1, mate: 1, panic: 2, tempt: 1.25, follow: 1.25 }, drop: 204 },
  // EntityMooshroom (wm) extends EntityCow; EntitySnowman (wr): 0.4 x 1.8, 4 health, speed 0.2 (snow-golem.js, mooshroom-golem-live.js).
  mooshroom: { health: 10, width: 0.9, height: 1.3, movement: f(0.2), ai: { wander: 1, mate: 1, panic: 2, tempt: 1.25, follow: 1.25 }, drop: 204 },
  snow_golem: { health: 4, width: f(0.4), height: f(1.8), movement: f(0.2), ai: { wander: 1 }, drop: 0 },
  sheep: { health: 8, width: 0.9, height: 1.3, movement: f(0.23), ai: { wander: 1, mate: 1, panic: 1.25, tempt: 1.1, follow: 1.1 }, drop: 0 },
  // EntityChicken (wg): 0.3 x 0.7, 4 health, speed 0.25; panic 1.4, mate 1.0, tempt
  // (wheat seeds, ade.N) 1.0, follow parent 1.1, wander 1.0. No `drop`: feathers and
  // chicken come from its own dropFewItems (wg.b(ZI)).
  chicken: { health: 4, width: f(0.3), height: f(0.7), movement: 0.25, ai: { wander: 1, mate: 1, panic: 1.4, tempt: 1, follow: 1.1 }, drop: 0 },
  // EntityWolf (wv): 0.6 x 0.8, speed 0.3, 8 health (20 once tamed: wolf.js maxHealth), bite 2 wild / 4 tamed
  // (wolf.js attackStrength); tasks, targets and mutex bits in wolf-ai.js. No drops.
  horse: HORSE_ENTITY, // EntityHorse (wi): horse-live.js
  wolf: { health: WILD_MAX_HEALTH, width: WOLF_WIDTH, height: WOLF_HEIGHT, movement: WOLF_SPEED, ai: { wander: 1, mate: 1 }, damage: 2, drop: 0 },
  // EntityOcelot (wn): 0.6 x 0.8, speed 0.3, 10 health, bite 3 at chickens (ocelot-ai.js tasks); no drops (ocelot.js).
  ocelot: { health: OCELOT_HEALTH, width: OCELOT_WIDTH, height: OCELOT_HEIGHT, movement: OCELOT_SPEED, ai: { wander: 0.8, mate: 0.8 }, damage: 3, drop: 0 },
  zombie: {
    health: 20,
    width: 0.6,
    height: 1.8,
    movement: f(0.23),
    ai: { wander: 1, chase: 1 },
    damage: 3,
    drop: 206,
  },
  // EntitySpider (yn): legacy AI uses speed 0.8 as input, fixed 0.1 land acceleration.
  spider: { health: 16, width: f(1.4), height: f(0.9), movement: f(0.8), ai: { wander: 1 }, damage: 2, drop: 0 },
  // EntityCaveSpider (xy) extends EntitySpider: setSize(0.7, 0.5) and maxHealth 12 (xy.aD);
  // speed, damage and the legacy AI are the spider's. Spawners only: never spawned naturally.
  cave_spider: { health: 12, width: f(0.7), height: f(0.5), movement: f(0.8), ai: { wander: 1 }, damage: 2, drop: 0 },
  // EntitySkeleton (yl): 0.6 x 1.8, 20 health, speed 0.25 (applyEntityAttributes). Its
  // arrow and bone drops are rolled in `kill`, so there is no `drop`; the task
  // speeds (ArrowAttack 1.0, FleeSun 1.0, Wander 1.0) are in the AI's brain.
  skeleton: { health: 20, width: 0.6, height: 1.8, movement: 0.25, ai: { wander: 1 }, drop: 0 },
  wither_skeleton: WITHER_SKELETON_STATS, // EntitySkeleton type 1 (wither-skeleton.js)
  // EntityCreeper (xz): 0.6 x 1.8, EntityMob's 20 health, speed 0.25; EntityAIAttackOnCollide
  // 1.0 and EntityAIWander 0.8. `damage` is EntityMob's attackDamage 2, which the swell
  // task (mutex 1, ahead of the attack) keeps from ever being dealt. Gunpowder comes from
  // `kill` (creeper.js creeperDrops).
  creeper: { health: 20, width: 0.6, height: 1.8, movement: 0.25, ai: { wander: 0.8, chase: 1 }, damage: 2, drop: 0 },
  // EntityVillager (yv): 0.6 x 1.8, 20 health, speed 0.5, no drops or experience (villager.js).
  villager: VILLAGER_TYPE,
  // EntityIronGolem (wt): 1.4 x 2.9, 100 health, speed 0.25; the attack, drops and AI are iron-golem.js / village-ai.js.
  iron_golem: IRON_GOLEM_TYPE,
  // EntitySilverfish (yk): 0.3 x 0.7, 8 health, speed 0.6, damage 1; legacy AI (silverfish.js), no drops.
  // EntityEnderman (ya): 40 health, 0.6 x 2.9, speed 0.3, attack 7; enderman.js (stare, teleport, carry), no AI-task list in 1.7.10.
  enderman: { health: ENDERMAN_HEALTH, width: ENDERMAN_WIDTH, height: ENDERMAN_HEIGHT, movement: f(ENDERMAN_SPEED), ai: { chase: 1, wander: 1 }, damage: ENDERMAN_ATTACK, drop: 0 },
  silverfish: { health: SILVERFISH.health, width: SILVERFISH.width, height: SILVERFISH.height, movement: f(SILVERFISH.speed), ai: { wander: 1 }, damage: SILVERFISH.damage, drop: 0 },
  // EntityWitch (yp): 0.6 x 1.8, 26 health, speed 0.25; the potion attack (witch.js, witch-potions.js) replaces melee. Drops in combat.js.
  witch: { health: WITCH.health, width: WITCH.width, height: WITCH.height, movement: WITCH.movement, ai: { wander: 1 }, damage: WITCH.attackDamage, drop: 0 },
  // EntitySlime (ym): 0.6 x 0.6 at size 1, scaled by `size` (mobScale); health and damage are size-based (slime.js), drops in combat.js.
  slime: { health: 1, width: 0.6, height: 0.6, movement: SLIME.speed, ai: {}, damage: 1, drop: 0 },
  // EntityMagmaCube (yf): a slime with its own numbers (nether-melee.js); health, damage and armour follow the size.
  magma_cube: { health: 1, width: 0.6, height: 0.6, movement: MAGMA.speed, ai: {}, damage: 3, drop: 0 },
  // EntityPigZombie (yh): 0.6 x 1.8, 20 health, speed 0.5 (+0.45 while it has a target), attack 5, armour 2; legacy AI (nether-melee-live.js).
  pigman: { health: PIGMAN.health, width: PIGMAN.width, height: PIGMAN.height, movement: PIGMAN.movement, ai: { wander: 1 }, damage: PIGMAN.attackDamage, drop: 0 },
  // EntitySquid (ws) 0.95 x 0.95, 10 health; EntityBat (we) 0.5 x 0.9, 6 health. Legacy motion, no AI tasks (squid-bat.js, squid-bat-mobs.js).
  // EntityEnderCrystal (wz) 2 x 2, 5 health: not a living mob (ender-crystal-mobs.js).
  ender_crystal: ENDER_CRYSTAL_TYPE,
  squid: { health: SQUID.health, width: SQUID.width, height: SQUID.height, movement: 0.25, ai: {}, drop: 0 },
  bat: { health: BAT.health, width: BAT.width, height: BAT.height, movement: 0.10000000149011612, ai: {}, drop: 0 },
};
// The slime's own sound names and volume depend on its size.
const hurtOf = (e) => (isSlimeLike(e) ? slimeSoundName(e.size) : isPigman(e) ? PIGMAN.sounds.hurt : hurtSound(e.type));
const deathOf = (e) => (isSlimeLike(e) ? slimeSoundName(e.size) : isPigman(e) ? PIGMAN.sounds.death : deathSound(e.type));
const volumeOf = (e) => (isSlimeLike(e) ? slimeVolume(e.size) : soundVolume(e.type));
// Fire-immune mobs (Entity.isImmuneToFire): the magma cube and the pigman.
const fireproof = (e) => e.type === "magma_cube" || e.type === "pigman";
// EntityMob subclasses: no panic counter, 5 experience, despawning, 0.5 - brightness path weights.
export const HOSTILE = new Set(["zombie", "skeleton", "spider", "cave_spider", "creeper", "silverfish", "witch", "slime", "enderman", "magma_cube", "pigman", "wither_skeleton"]);
// EntityMoveHelper.onUpdateMoveHelper (tv.c) hands EntityLiving.setAIMoveSpeed
// (sw.i) `(float)(speed * movementSpeed)`; sw.i also sets moveForward to it. The
// zombie's "Baby speed boost" (yq.br) is operation 1: base * (1 + 0.5); a Speed effect
// (mob-effects.js) is operation 2.
export function aiMoveSpeed(e, multiplier) {
  const boost = e.type === "zombie" && e.growingAge < 0 ? [[0.5, 1]] : e.type === "enderman" && e.speedBoost ? [[ENDERMAN_BOOST, 0]] : e.type === "pigman" && e.pigTarget ? [[PIGMAN.boost, 0]] : [];
  // EntityWitch: the "Drinking speed penalty" modifier (-0.25, operation 0) while a potion is being drunk.
  const drink = e.type === "witch" && e.drinking ? [[-0.25, 0]] : [];
  return f(multiplier * attributeValue(e.horse?.speed ?? ENTITY_TYPES[e.type].movement, [...drink, ...boost, ...speedModifiers(e)]));
}
// Wheat (ade.O) breeds and tempts cows and sheep; chickens take wheat seeds (309, any
// ItemSeeds in the original) through EntityAITempt / isBreedingItem.
// Pigs use only carrots (ade.bF), including the carrot held by EntityAITempt.
const BREED_ITEM = { pig: CARROT, mooshroom: 305, cow: 305, sheep: 305, chicken: 309 };
export const EGG = 316;
export { FEATHER, RAW_CHICKEN, COOKED_CHICKEN };
// getHurtSound / getDeathSound: the pig says its hurt sound, the cow's death sound is
// its hurt sound, and the sheep uses mob.sheep.say for say, hurt and death alike.
// EntityCaveSpider inherits the spider's sounds.
const hurtSound = (type) => (type = soundType(type), type === "squid" || type === "snow_golem" ? null : type === "ocelot" ? OCELOT_SOUNDS.hit : type === "enderman" ? ENDERMAN_SOUNDS.hit : type === "silverfish" ? SILVERFISH_SOUNDS.hurt : type === "witch" ? WITCH_SOUNDS.hurt : type === "villager" ? VILLAGER_SOUNDS.hit : type === "iron_golem" ? IRON_GOLEM_SOUNDS.hit : type === "pig" ? "mob.pig.say" : (type === "sheep" || type === "spider" || type === "creeper") ? "mob." + type + ".say" : "mob." + type + ".hurt");
// EntityChicken's death sound is its hurt sound as well.
const deathSound = (type) => (type = soundType(type), type === "squid" || type === "snow_golem" ? null : type === "ocelot" ? OCELOT_SOUNDS.hit : type === "enderman" ? ENDERMAN_SOUNDS.death : type === "silverfish" ? SILVERFISH_SOUNDS.death : type === "witch" ? WITCH_SOUNDS.death : type === "villager" ? VILLAGER_SOUNDS.death : type === "iron_golem" ? IRON_GOLEM_SOUNDS.death : type === "sheep" ? "mob.sheep.say" : "mob." + type + (type === "cow" || type === "chicken" ? ".hurt" : ".death"));
// Entity.setPosition's box (half width and height in floats) and Entity.canBePushed:
// living entities until setDead (deathTime 20, or removal).
export const pushBox = (o, width, height) => {
  const w = f(f(width) / 2), h = f(height);
  return [o.x - w, o.y, o.z - w, o.x + w, o.y + h, o.z + w];
};
const pushable = (o) => o.type !== "bat" && o.type !== "ender_crystal" && o.type !== "ender_dragon" && (o.health > 0 || (o.death ?? 0) < 20); // EntityBat.canBePushed is false
// Chunk.canBlockSeeTheSky without a height map (weather.js `canSeeSky` is the real one
// that main.js hooks in): no solid block at or above (x, y, z).
const openSky = (world, x, y, z) => {
  for (let yy = Math.max(0, y); yy < (world.height ?? HEIGHT); yy++) if (world.solid(x, yy, z)) return false;
  return true;
};
export function actorCollides(world, x, y, z, w, h) {
  for (
    let bx = Math.floor(x - w / 2 + 0.001);
    bx <= Math.floor(x + w / 2 - 0.001);
    bx++
  )
    for (let by = Math.floor(y + 0.001); by <= Math.floor(y + h - 0.001); by++)
      for (
        let bz = Math.floor(z - w / 2 + 0.001);
        bz <= Math.floor(z + w / 2 - 0.001);
        bz++
      )
        if (world.solid(bx, by, bz)) return true;
  return false;
}
// --- Motion: Entity.moveEntity (sa.d) and EntityLivingBase.moveEntityWithHeading (sv.e(FF)) ---
const STEP_HEIGHT = 0.5; // EntityLivingBase constructor: stepHeight = 0.5f
const JUMP_MOVEMENT_FACTOR = f(0.02); // sv.aQ
// World.getCollidingBoundingBoxes (ahb.a): block boxes overlapping `b`, as
// [minX, minY, minZ, maxX, maxY, maxZ]. The scan starts a block low like the original.
function collisionBoxes(world, b) {
  const out = [];
  for (let bx = Math.floor(b[0]); bx < Math.floor(b[3] + 1); bx++)
    for (let by = Math.floor(b[1]) - 1; by < Math.floor(b[4] + 1); by++)
      for (let bz = Math.floor(b[2]); bz < Math.floor(b[5] + 1); bz++)
        // Block.addCollisionBoxesToList: a fence gives its post and each arm as separate boxes.
        for (const [a, c, d, g, h, i] of cellCollisionBoxes(world, bx, by, bz))
          if (bx + g > b[0] && bx + a < b[3] && by + h > b[1] && by + c < b[4] && bz + i > b[2] && bz + d < b[5]) out.push([bx + a, by + c, bz + d, bx + g, by + h, bz + i]);
  return out;
}
// Entity.func_145771_j [sa.j(DDD)Z], used by items and XP orbs (the player overrides it,
// pushOutOfBlocks): when the box overlaps a block collision box or the cell of (cx, cy, cz) is a
// normal cube, push towards the nearest side whose neighbour is not a normal cube, never down and
// up by default, at rand.nextFloat() * 0.2F + 0.1F. Returns [axis (0 x, 1 y, 2 z), motion] or null.
export function entityPushOut(world, cx, cy, cz, box, random) {
  const x = Math.floor(cx), y = Math.floor(cy), z = Math.floor(cz);
  if (!collisionBoxes(world, box).length && !normalCube(world.get(x, y, z))) return null;
  const fx = cx - x, fy = cy - y, fz = cz - z, open = (dx, dy, dz) => !normalCube(world.get(x + dx, y + dy, z + dz));
  let side = 3, best = 9999;
  if (open(-1, 0, 0) && fx < best) (best = fx), (side = 0);
  if (open(1, 0, 0) && 1 - fx < best) (best = 1 - fx), (side = 1);
  if (open(0, 1, 0) && 1 - fy < best) (best = 1 - fy), (side = 3);
  if (open(0, 0, -1) && fz < best) (best = fz), (side = 4);
  if (open(0, 0, 1) && 1 - fz < best) (best = 1 - fz), (side = 5);
  const speed = f(f(f(random()) * f(0.2)) + f(0.1));
  return side === 0 ? [0, -speed] : side === 1 ? [0, speed] : side === 3 ? [1, speed] : side === 4 ? [2, -speed] : [2, speed];
}
// AxisAlignedBB.calculateXOffset/YOffset/ZOffset (azt.a/b/c): how far `bb` may still move along one axis.
const offsetX = (o, bb, d) => {
  if (bb[4] > o[1] && bb[1] < o[4] && bb[5] > o[2] && bb[2] < o[5]) {
    if (d > 0 && bb[3] <= o[0]) d = Math.min(d, o[0] - bb[3]);
    else if (d < 0 && bb[0] >= o[3]) d = Math.max(d, o[3] - bb[0]);
  }
  return d;
};
const offsetY = (o, bb, d) => {
  if (bb[3] > o[0] && bb[0] < o[3] && bb[5] > o[2] && bb[2] < o[5]) {
    if (d > 0 && bb[4] <= o[1]) d = Math.min(d, o[1] - bb[4]);
    else if (d < 0 && bb[1] >= o[4]) d = Math.max(d, o[4] - bb[1]);
  }
  return d;
};
const offsetZ = (o, bb, d) => {
  if (bb[3] > o[0] && bb[0] < o[3] && bb[4] > o[1] && bb[1] < o[4]) {
    if (d > 0 && bb[5] <= o[2]) d = Math.min(d, o[2] - bb[5]);
    else if (d < 0 && bb[2] >= o[5]) d = Math.max(d, o[5] - bb[2]);
  }
  return d;
};
const shift = (bb, dx, dy, dz) => {
  bb[0] += dx; bb[3] += dx; bb[1] += dy; bb[4] += dy; bb[2] += dz; bb[5] += dz;
};
// EntityPlayerSP.onLivingUpdate, after the sneak ySize raise: func_145771_j [blk.j(DDD)Z] at the
// box's four corners (posX -/+ width * 0.35, minY + 0.5, posZ +/- width * 0.35) in this order.
// A corner whose cell or the cell above is a normal cube sets motionX or motionZ to -/+0.1F
// towards the nearest side whose two cells are clear (x tested before z, ties keep the first);
// later corners overwrite earlier ones. Never up or down, unlike the Entity version in item-entities.js.
const PUSH_OUT = f(0.1);
export function pushOutOfBlocks(world, e, width) {
  const r = f(width) * 0.35, y = e.y + 0.5;
  for (const [sx, sz] of [[-1, 1], [-1, -1], [1, -1], [1, 1]]) pushOutCorner(world, e, e.x + sx * r, y, e.z + sz * r);
}
function pushOutCorner(world, e, px, py, pz) {
  const x = Math.floor(px), y = Math.floor(py), z = Math.floor(pz), fx = px - x, fz = pz - z,
    blocked = (dx, dz) => normalCube(world.get(x + dx, y, z + dz)) || normalCube(world.get(x + dx, y + 1, z + dz));
  if (!blocked(0, 0)) return;
  let side = -1, best = 9999;
  if (!blocked(-1, 0) && fx < best) (best = fx), (side = 0);
  if (!blocked(1, 0) && 1 - fx < best) (best = 1 - fx), (side = 1);
  if (!blocked(0, -1) && fz < best) (best = fz), (side = 4);
  if (!blocked(0, 1) && 1 - fz < best) (best = 1 - fz), (side = 5);
  if (side === 0) e.vx = -PUSH_OUT;
  if (side === 1) e.vx = PUSH_OUT;
  if (side === 4) e.vz = -PUSH_OUT;
  if (side === 5) e.vz = PUSH_OUT;
}

// Entity.moveEntity (sa.d(DDD)) for a walking mob: y first, then x, then z
// against the block boxes; when a horizontal move is blocked while on the
// ground, retry with stepHeight (0.5) and keep that result unless it is no
// farther. Sets the collided/onGround flags, zeroes motion on blocked axes and
// runs Entity.updateFallState (sa.a(DZ)V); returns the fall distance on landing.
// The player also passes `ySize` (after onLivingUpdate's sneak raise); it decays here.
// `step` is Entity.stepHeight (0 for EntityTNTPrimed, which never steps). The tail runs the block
// collisions and the burning-box test (block-collisions.js) with `hooks`; without them only webs.
export function moveEntity(world, e, w, h, dx, dy, dz, step = STEP_HEIGHT, hooks) {
  // Entity.width/height are floats (setSize), so the box edges use their float values.
  w = f(w);
  h = f(h);
  if (e.inWeb) {
    const requested = { vx: dx, vy: dy, vz: dz };
    [dx, dy, dz] = webMove(e, requested);
    e.vx = e.vy = e.vz = 0;
  }
  // Entity.moveEntity begins with ySize *= 0.4F (only the player's eye drop uses it).
  if (e.ySize !== undefined) e.ySize = f(e.ySize * f(0.4));
  // A sneaking EntityPlayer on the ground never walks off an edge (player-movement.js).
  const sneakEdgeOn = !!(e.sneaking && e.onGround);
  if (sneakEdgeOn)
    [dx, dz] = sneakEdge(dx, dz, (ox, oz) => !collisionBoxes(world, [e.x - w / 2 + ox, e.y - 1, e.z - w / 2 + oz, e.x + w / 2 + ox, e.y - 1 + h, e.z + w / 2 + oz]).length);
  const odx = dx, ody = dy, odz = dz, half = w / 2,
    // An entity that keeps its bounding box (`e.bb`, as Entity.boundingBox) moves that
    // box itself, so its centre carries the same rounding as the original.
    bb = e.bb ? e.bb.slice() : [e.x - half, e.y, e.z - half, e.x + half, e.y + h, e.z + half],
    start = bb.slice(),
    grow = (box, gx, gy, gz) => [gx < 0 ? box[0] + gx : box[0], gy < 0 ? box[1] + gy : box[1], gz < 0 ? box[2] + gz : box[2], gx > 0 ? box[3] + gx : box[3], gy > 0 ? box[4] + gy : box[4], gz > 0 ? box[5] + gz : box[5]];
  let list = collisionBoxes(world, grow(bb, dx, dy, dz));
  for (const o of list) dy = offsetY(o, bb, dy);
  shift(bb, 0, dy, 0);
  const grounded = e.onGround || (ody !== dy && ody < 0);
  for (const o of list) dx = offsetX(o, bb, dx);
  shift(bb, dx, 0, 0);
  for (const o of list) dz = offsetZ(o, bb, dz);
  shift(bb, 0, 0, dz);
  // The step retry also needs the sneak-edge flag or ySize < 0.05F: an eye still lowered
  // from sneaking (0.08 on the first tick after release) does not step.
  if (step > 0 && grounded && (sneakEdgeOn || !(e.ySize >= f(0.05))) && (odx !== dx || odz !== dz)) {
    const sx = dx, sy = dy, sz = dz, flat = bb.slice();
    dx = odx; dy = step; dz = odz;
    bb.splice(0, 6, ...start);
    list = collisionBoxes(world, grow(bb, odx, step, odz));
    for (const o of list) dy = offsetY(o, bb, dy);
    shift(bb, 0, dy, 0);
    for (const o of list) dx = offsetX(o, bb, dx);
    shift(bb, dx, 0, 0);
    for (const o of list) dz = offsetZ(o, bb, dz);
    shift(bb, 0, 0, dz);
    dy = -step;
    for (const o of list) dy = offsetY(o, bb, dy);
    shift(bb, 0, dy, 0);
    if (sx * sx + sz * sz >= dx * dx + dz * dz) {
      dx = sx; dy = sy; dz = sz;
      bb.splice(0, 6, ...flat);
    }
  }
  e.x = (bb[0] + bb[3]) / 2;
  e.y = bb[1];
  e.z = (bb[2] + bb[5]) / 2;
  if (e.bb) e.bb = bb;
  e.collidedH = odx !== dx || odz !== dz;
  e.onGround = ody !== dy && ody < 0;
  if (odx !== dx) e.vx = 0;
  if (ody !== dy) e.vy = 0;
  if (odz !== dz) e.vz = 0;
  let landed = 0;
  // EntityLivingBase.updateFallState (sv.a(DZ)V) first runs handleWaterMovement when the entity
  // is not already in water, on the moved box: landing in water (even 1 deep) cancels the fall.
  if ((hooks?.living || e.living) && !e.inWater && waterAcceleration(world, entityWaterBox(bb), false).wet) e.fallDistance = 0;
  if (e.onGround) {
    landed = e.fallDistance;
    e.fallDistance = 0;
  } else if (dy < 0) e.fallDistance = f(e.fallDistance - dy);
  blockCollisions(world, bb, e, hooks);
  return landed;
}
// Entity.moveFlying (sa.a(FFF)): `forward` (and `strafe`) scaled to `friction`,
// rotated by rotationYaw through MathHelper's sine table and added to motion.
export function moveFlying(e, strafe, forward, friction) {
  let d = f(f(strafe * strafe) + f(forward * forward));
  if (d < f(1e-4)) return;
  d = f(Math.sqrt(d));
  if (d < 1) d = 1;
  d = f(friction / d);
  strafe = f(strafe * d);
  forward = f(forward * d);
  const yaw = f(f(e.rotationYaw * f(Math.PI)) / 180), sin = mhSin(yaw), cos = mhCos(yaw);
  e.vx += f(f(strafe * cos) - f(forward * sin));
  e.vz += f(f(forward * cos) + f(strafe * sin));
}
// Entity.handleWaterMovement (sa.N) through World.handleMaterialAcceleration: the
// box shrunk 0.4 vertically and 0.001 all round is wet below each cell's liquid
// surface, and living entities are pushed 0.014 along the summed flow vector.
function inWater(world, e, w, h) {
  const r = w / 2, { wet, push } = waterAcceleration(world, entityWaterBox([e.x - r, e.y, e.z - r, e.x + r, e.y + h, e.z + r]));
  addVelocity(e, ...push);
  return wet;
}
// Entity.func_70038_c / isOffsetPositionInLiquid (sa.c(DDD)): the box moved by
// (dx, dy, dz) has no block in it and no liquid.
function offsetInLiquid(world, e, w, h, dx, dy, dz) {
  const half = w / 2, b = [e.x - half + dx, e.y + dy, e.z - half + dz, e.x + half + dx, e.y + h + dy, e.z + half + dz];
  if (collisionBoxes(world, b).length) return false;
  for (let bx = Math.floor(b[0]); bx < Math.floor(b[3] + 1); bx++)
    for (let by = Math.floor(b[1]); by < Math.floor(b[4] + 1); by++)
      for (let bz = Math.floor(b[2]); bz < Math.floor(b[5] + 1); bz++)
        if (isLiquid(world.get(bx, by, bz))) return false;
  return true;
}
// The air part of EntityLivingBase.onEntityUpdate (sv.C): with the eye (posY + height * 0.85F)
// inside water the air supply drops by 1 (no Respiration, so no draw); at -20 it is set to 0
// and 8 "bubble" from Entity.rand go up around posY. Out of water it is back to 300. Returns
// true when attackEntityFrom(drown, 2) follows.
export function breathe(world, e, height, rand, fx) {
  if (!eyeInWater(world, e.x, e.y + f(f(height) * f(0.85)), e.z)) {
    e.air = 300;
    return false;
  }
  e.air = (e.air ?? 300) - 1;
  if (e.air !== -20) return false;
  e.air = 0;
  drownBubbles(fx ?? { spawn() {} }, { x: e.x, y: e.y, z: e.z, mx: e.vx, my: e.vy, mz: e.vz }, rand);
  return true;
}
// EntityLiving.onEntityUpdate's roll: true (and livingSoundTime set to -interval) when
// rand.nextInt(1000) < livingSoundTime++.
export function livingSoundRoll(e, rand, interval) {
  const time = e.livingSoundTime ?? 0;
  e.livingSoundTime = time + 1;
  if (rand.nextInt(1000) >= time) return false;
  e.livingSoundTime = -interval;
  return true;
}
// EntityLivingBase.jump (sv.bj): 0.42 upward (no jump boost, no sprint).
export function jump(e) {
  e.vy = e.type === "magma_cube" ? magmaJumpMotion(e.size) : 0.41999998688697815; // yf.bj: 0.42 + size * 0.1
}
// EntityLivingBase.moveEntityWithHeading (sv.e(FF)), without strafe. AI mobs
// accelerate at 0.04 in water (legacy spiders 0.02); drag is 0.8. Lava uses
// acceleration 0.02 and drag 0.5; gravity is 0.02 in either liquid. On land,
// friction is 0.91 * block slipperiness. Acceleration is aiMoveSpeed (spiders:
// fixed 0.1) * 0.16277136 / friction^3; 0.02 in the air. Spiders can climb.
// Gravity is 0.08 with 0.98 vertical drag. Returns the landing fall distance.
export function moveEntityWithHeading(world, e, w, h, forward, hooks) {
  let landed;
  if (e.inWater) {
    const y0 = e.y;
    moveFlying(e, e.moveStrafing || 0, forward, f(isSpider(e.type) || e.type === "silverfish" ? 0.02 : 0.04));
    landed = moveEntity(world, e, w, h, e.vx, e.vy, e.vz, e.type === "enderman" ? 1 : e.stepHeight ?? STEP_HEIGHT, hooks);
    e.vx *= 0.800000011920929;
    e.vy *= 0.800000011920929;
    e.vz *= 0.800000011920929;
    e.vy -= 0.02;
    if (e.collidedH && offsetInLiquid(world, e, w, h, e.vx, e.vy + 0.6 - e.y + y0, e.vz)) e.vy = 0.30000001192092896;
  } else if (e.inLava) {
    const y0 = e.y;
    moveFlying(e, e.moveStrafing || 0, forward, f(0.02));
    landed = moveEntity(world, e, w, h, e.vx, e.vy, e.vz, e.type === "enderman" ? 1 : e.stepHeight ?? STEP_HEIGHT, hooks);
    e.vx *= 0.5;
    e.vy *= 0.5;
    e.vz *= 0.5;
    e.vy -= 0.02;
    if (e.collidedH && offsetInLiquid(world, e, w, h, e.vx, e.vy + 0.6 - e.y + y0, e.vz)) e.vy = 0.30000001192092896;
  } else {
    // The block under the feet (floor(minY) - 1) only counts while on the ground.
    const slip = () => (e.onGround ? f(slipperiness(world.get(Math.floor(e.x), Math.floor(e.y) - 1, Math.floor(e.z))) * f(0.91)) : f(0.91));
    let friction = slip();
    const accel = f(f(0.16277136) / f(f(friction * friction) * friction));
    moveFlying(e, e.moveStrafing || 0, forward, e.onGround ? f((isSpider(e.type) || e.type === "silverfish" || e.type === "pigman" ? f(0.1) : e.aiMoveSpeed) * accel) : e.jumpFactor ?? JUMP_MOVEMENT_FACTOR);
    friction = slip();
    // isOnLadder: EntitySpider's override is its wall flag; others test the ladder cell (ladders.js).
    const climbable = () => (isSpider(e.type) ? e.climbing : isOnLadder(world, e.x, e.y, e.z));
    if (climbable()) {
      ladderClamp(e, e.player && e.sneaking, ["vx", "vy", "vz"]);
      e.fallDistance = 0;
    }
    landed = moveEntity(world, e, w, h, e.vx, e.vy, e.vz, e.type === "enderman" ? 1 : e.stepHeight ?? STEP_HEIGHT, hooks);
    if (e.collidedH && climbable()) e.vy = LADDER_CLIMB;
    e.vy -= 0.08;
    e.vy *= 0.9800000190734863;
    e.vx *= friction;
    e.vz *= friction;
  }
  return landed;
}
// EntityLivingBase.knockBack (sv.a(Entity, F, DD)V), reached from attackEntityFrom
// with dx, dz = attacker - victim: the knockbackResistance roll, then half the
// old motion plus 0.4 away from the attacker horizontally and 0.4 up (capped at
// 0.4). attackEntityFrom nudges a coincident attacker by a random sliver first, with
// Math.random (`nudge`); the resistance roll is Entity.rand.nextDouble() there.
export function knockBack(e, fromX, fromZ, random = Math.random, nudge = random) {
  let dx = fromX - e.x, dz = fromZ - e.z;
  while (dx * dx + dz * dz < 1e-4) {
    dx = (nudge() - nudge()) * 0.01;
    dz = (nudge() - nudge()) * 0.01;
  }
  if (random() < (e.knockbackResistance || 0)) return false;
  const len = f(Math.sqrt(dx * dx + dz * dz)), k = f(0.4);
  e.vx = e.vx / 2 - (dx / len) * k;
  e.vy = e.vy / 2 + k;
  e.vz = e.vz / 2 - (dz / len) * k;
  if (e.vy > 0.4000000059604645) e.vy = 0.4000000059604645;
  return true;
}
// Entity.addVelocity (sa.g(DDD)V).
export function addVelocity(e, x, y, z) {
  e.vx += x;
  e.vy += y;
  e.vz += z;
}
export function entityHit(origin, dir, e, reach) {
  if (e.type === "ender_dragon") return dragonHit(origin, dir, e, reach); // dragon-mobs.js: its seven parts are the targets
  const base = ENTITY_TYPES[e.type], scale=mobScale(e),t={width:base.width*scale,height:base.height*scale};
  let near = 0,
    far = reach;
  for (const [axis, min, max] of [
    ["x", e.x - t.width / 2, e.x + t.width / 2],
    ["y", e.y, e.y + t.height],
    ["z", e.z - t.width / 2, e.z + t.width / 2],
  ]) {
    if (Math.abs(dir[axis]) < 1e-8) {
      if (origin[axis] < min || origin[axis] > max) return null;
    } else {
      const a = (min - origin[axis]) / dir[axis],
        b = (max - origin[axis]) / dir[axis];
      near = Math.max(near, Math.min(a, b));
      far = Math.min(far, Math.max(a, b));
      if (far < near) return null;
    }
  }
  return near <= reach ? near : null;
}
// The player's attackDamage attribute with the held item's modifier (1 bare-handed): swords
// 5 + tier (gold 5), axes 4, pickaxes 3 and shovels 2 + tier, only for an item actually held.
export function heldAttackDamage(tool, survival) {
  const item = ITEMS[tool];
  if (!(survival.creative || survival.count(tool) > 0) || !["sword", "axe", "pickaxe", "shovel"].includes(item?.kind)) return survival.effects?.attackDamage ? survival.effects.attackDamage(1) : 1;
  const base = item.kind === "sword" ? 5 + (item.name.startsWith("Golden") ? 0 : item.tier) : item.kind === "axe" ? 4 + item.tier : item.kind === "pickaxe" ? 3 + item.tier : 2 + item.tier;
  return survival.effects?.attackDamage ? survival.effects.attackDamage(base) : base;
}
export class EntityWorld {
  constructor(world, saved, random = Math.random) {
    this.world = world;
    this.random = random;
    // The client Fx (main.js) the death puffs, splashes and feeding hearts spawn into.
    this.fx = null;
    this.events = [];
    this.clientSounds = [];
    this.entities = [];
    this.nextId = 1;
    this.spawnClock = 0;
    // EnumDifficulty id (difficulty.js); main.js sets it from the settings. `worldRandom` is
    // World.rand and `localDifficulty(x, y, z)` World.func_147462_b, both hooked in by main.js.
    this.difficulty = NORMAL;
    this.worldRandom = null;
    this.fishStates = new WeakMap(); // silverfish.js legacy AI state, never saved
    this.localDifficulty = null;
    if (Array.isArray(saved)) {
      for (const e of saved.slice(0, 256)) {
        const m = this.restore(e);
        if (!m) continue;
        this.entities.push(m);
        this.nextId++;
      }
      this.nextId = Math.max(
        this.nextId,
        ...this.entities
          .map((e) => Number(String(e.id).replace("mob-", "")) + 1)
          .filter(Number.isFinite),
      );
    } else if (!world.dimension) this.seedAnimals();
  }
  // A saved mob record (a browser save, java-mobs.js import or /summon's data tag) back to a live mob, or null when it
  // is unusable. The caller adds it and advances nextId.
  restore(e, { summoned = false } = {}) {
    const world = this.world;
    const t = ENTITY_TYPES[e.type];
    if (
      !t ||
      ![e.x, e.y, e.z, e.health].every(Number.isFinite) ||
      (world.streaming ? !world.inside(Math.floor(e.x),0,Math.floor(e.z)) : e.x < 0 || e.x >= SIZE || e.z < 0 || e.z >= SIZE) ||
      e.y < -64 ||
      e.y >= (world.height ?? HEIGHT) ||
      (e.health <= 0 && !summoned && !(e.type === "ender_dragon" && e.dragonSave?.deathTicks >= 0 && e.dragonSave.deathTicks < 200))
    )
      return null;
    const fresh = this.create(e.type, e.x, e.y, e.z);
    this.nextId--; // restore callers advance once after accepting the mob
    return syncInterpolation({
      ...fresh,
      ...e,
      id: /^mob-\d+$/.test(e.id) ? e.id : fresh.id,
      health: Math.max(0, Math.min(e.type === "wolf" && typeof e.owner === "string" && e.owner.trim() ? TAMED_MAX_HEALTH : isSlimeLike(e) ? slimeFieldsFrom(e).health : t.health, e.health)),
      yaw: Number.isFinite(e.yaw) ? e.yaw : 0,
      age: Number.isFinite(e.age) ? e.age : 0,
      growingAge:Number.isInteger(e.growingAge)?(summoned?e.growingAge:Math.max(-24000,Math.min(6000,e.growingAge))):0,
      love:Number.isInteger(e.love)?(summoned?e.love:Math.max(0,Math.min(600,e.love))):0,
      mateTicks:0,
      // EntityVillager.readEntityFromNBT: Profession, Riches and Offers; the trade timers and the customer start over.
      ...(e.type === "villager" ? villagerFields(e.profession, e.riches, e.offers) : {}),
      // EntityIronGolem.readEntityFromNBT: PlayerCreated only; the timers and the home area start over.
      ...(e.type === "iron_golem" ? ironGolemFields(e.playerCreated) : {}),
      // EntityTameable and EntityWolf NBT: owner, sitting, angry and the collar; the shake, begging and AI state start over.
      ...(e.type === "wolf" ? wolfFieldsFrom(e, fresh) : {}),
      // EntityTameable and EntityOcelot NBT: owner, sitting and CatType; the pose flags start over.
      ...(e.type === "ocelot" ? ocelotFieldsFrom(e) : {}),
      ...(e.type === "horse" ? horseFieldsFrom(e, fresh) : {}),
      ...gearFieldsFrom(e), // horse-gear-live.js: leash, CustomName, PersistenceRequired
      ...(e.type === "sheep" ? { color: Number.isInteger(e.color) && e.color >= 0 && e.color < 16 ? e.color : 0, sheared: e.sheared === true, eatTimer: 0 } : {}),
      // EntityPig.readEntityFromNBT: Saddle (pig-saddle.js); the steering task starts over.
      ...(e.type === "pig" ? { saddled: e.saddled === true } : {}),
      // timeUntilNextEgg is not saved in 1.7.10: a fresh roll from create, whatever the save says.
      ...(e.type === "chicken" ? { eggTimer: fresh.eggTimer } : {}),
      // EntityBat.readEntityFromNBT: BatFlags bit 1 is the hanging state (datawatcher 16).
      ...(e.type === "bat" ? { batHanging: e.batHanging === true } : {}),
      ...(isSpider(e.type) ? { climbing: false, spiderTarget: false, spiderRevenge: 0, stepDistance: 0, nextStep: 1 } : {}),
      // EntitySilverfish has no NBT of its own: the summon cooldown starts over.
      ...(e.type === "silverfish" ? { summonCooldown: 0 } : {}),
      // EntitySlime.readEntityFromNBT: Size (size - 1); health is clamped to size * size, the jump and squish start over.
      ...(isSlimeLike(e) ? slimeRestore(e, fresh) : {}),
      ...(e.type === "pigman" ? pigmanFieldsFrom(e) : {}),
      ...(e.type === "enderman" ? endermanFieldsFrom(e) : {}),
      // EntityWitch keeps its held potion (Equipment) but not the drinking state (datawatcher 21, the penalty modifier).
      ...(e.type === "witch" ? { drinking: false, drinkTimer: 0, held: e.held && e.held.id === ITEM_POTION && potionEffects(e.held.damage).length ? { id: ITEM_POTION, damage: e.held.damage, count: 1 } : null } : {}),
      // EntityCreeper.readEntityFromNBT: "powered" and "ignited" are saved, the swell
      // state (datawatcher 16) and timeSinceIgnited start over.
      ...(e.type === "creeper" ? { ...creeperFields(), ...creeperSavedFields(e), powered: e.powered === true, ignited: e.ignited === true } : {}),
      // NBT ActiveEffects and the Attributes the spawn rolls modified.
      effects: readMobEffects(e.effects),
      knockbackResistance: Number.isFinite(e.knockbackResistance) ? Math.min(1, Math.max(0, e.knockbackResistance)) : fresh.knockbackResistance,
      ...(Number.isFinite(e.followRange) ? { followRange: Math.min(2048, Math.max(0, e.followRange)) } : { followRange: undefined }),
      ...(e.type === "zombie" ? { reinforcement: Number.isFinite(e.reinforcement) ? reinforcementChance(e.reinforcement) : fresh.reinforcement, villager: false, conversionTime: undefined, ...readZombieVillager(e) } : {}),
      // yv.cd's flag is not saved; a cured villager's +5 reputation is given on its first village refresh.
      defaultReputation: undefined,
      wander: 0,
      hurt: 0,
      recentlyHit: 0,
      attack: 0,
      flee: 0,
      vx: 0,
      vz: 0,
      vy: 0,
      // A mob that travelled through a portal arrives with the Teleporter's motion (entity-portal.js); PortalCooldown is saved.
      ...(e.portalMotion ? { vx: e.portalMotion.vx || 0, vy: e.portalMotion.vy || 0, vz: e.portalMotion.vz || 0, portalMotion: undefined } : {}),
      portalCooldown: Number.isInteger(e.portalCooldown) && e.portalCooldown > 0 ? Math.min(300, e.portalCooldown) : undefined,
      ...this.physics(),
    });
  }
  create(type, x, y, z, random = this.random) {
    return syncInterpolation({
      id: "mob-" + this.nextId++,
      type,
      x,
      y,
      z,
      health: ENTITY_TYPES[type].health,
      yaw: 0,
      vy: 0,
      vx: 0,
      vz: 0,
      age: 0,
      wander: 0,
      hurt: 0,
      attack: 0,
      flee: 0,
      revenge: 0,
      recentlyHit: 0,
      idle: 0,
      burn: 0,
      growingAge:0,love:0,mateTicks:0,
      // EntitySheep.func_110161_a: a natural fleece colour; bit 16 of datawatcher
      // byte 16 (`sheared`); and the grazing timer (EntityAIEatGrass, mirrored in wp.br).
      ...(type === "sheep" ? { color: sheepColor(random), sheared: false, eatTimer: 0 } : {}),
      ...(type === "villager" ? villagerFields() : {}),
      ...(type === "iron_golem" ? ironGolemFields() : {}),
      ...(type === "wolf" ? wolfFields() : {}),
      ...(type === "ocelot" ? ocelotFields() : {}),
      ...(type === "horse" ? horseFields(random) : {}),
      // EntityChicken (wg): timeUntilNextEgg = rand.nextInt(6000) + 6000 (wg.bu; not saved in
      // 1.7.10), wingRotation/destPos and their previous values 0, wingRotDelta (bt) 1.0.
      ...(isSpider(type) ? { climbing: false, spiderTarget: false, spiderRevenge: 0, stepDistance: 0, nextStep: 1 } : {}),
      ...(type === "creeper" ? creeperFields() : {}),
      ...(type === "silverfish" ? { summonCooldown: 0 } : {}),
      ...(type === "enderman" ? endermanFields() : {}),
      ...(type === "witch" ? { drinking: false, drinkTimer: 0, held: null } : {}),
      ...(type === "slime" || type === "magma_cube" ? slimeFields(null, random) : {}),
      ...(type === "pigman" ? pigmanFields() : {}),
      ...(type === "ender_crystal" ? { innerRotation: Math.floor(random() * 100000) } : {}), // EntityEnderCrystal: innerRotation = rand.nextInt(100000)
      ...(type === "bat" ? { batHanging: true } : {}), // EntityBat's constructor: setIsBatHanging(true)
      ...(type === "chicken" ? { eggTimer: Math.floor(random() * 6000) + 6000, wingRotation: 0, destPos: 0, oFlapSpeed: 0, oFlap: 0, wingRotDelta: 1 } : {}),
      // EntityZombie.func_110161_a adds a 0 to 0.05 "Random spawn bonus" to knockbackResistance.
      knockbackResistance: type === "zombie" ? random() * 0.05000000074505806 : 0,
      // EntityZombie.applyEntityAttributes: zombie.spawnReinforcements.
      ...(type === "zombie" ? { reinforcement: reinforcementBase(random) } : {}),
      effects: [],
      ...this.physics(),
    });
  }
  // EntityEgg.onImpact (zl.a): a chick (EntityChicken, setGrowingAge(-24000)) at the
  // egg's position with the egg's rotationYaw (Java degrees) and pitch 0. Capped at
  // the 40 mobs a save keeps.
  hatch(x, y, z, yawDegrees) {
    if (this.entities.length >= 40) return null;
    const chick = this.create("chicken", x, y, z);
    chick.growingAge = -24000;
    chick.yaw = (-yawDegrees * Math.PI) / 180;
    syncInterpolation(chick);
    this.entities.push(chick);
    return chick;
  }
  // Fresh motion state: grounded only after the first collision, no AI move target yet.
  physics() {
    return { onGround: false, collidedH: false, inWater: null, inLava: false, fire: 0, fallDistance: 0, moveForward: 0, aiMoveSpeed: 0, jumping: false, jumpTicks: 0, lastDamage: 0 };
  }
  seedAnimals() {
    const spawn = this.world.spawn();
    for (let i = 0; i < 8; i++) {
      for (let attempt = 0; attempt < 30; attempt++) {
        const angle = hash(i, attempt, this.world.numericSeed) * Math.PI * 2,
          r = 10 + hash(i, attempt, 313) * 24,
          x = Math.floor(spawn.x + Math.sin(angle) * r),
          z = Math.floor(spawn.z + Math.cos(angle) * r);
        if (x < 3 || z < 3 || x > SIZE - 3 || z > SIZE - 3) continue;
        // SpawnListEntry weights for a plains biome's creatures: sheep 12, pig 10, chicken 10, cow 8.
        const y = this.world.surface(x, z), roll = hash(i, 51, this.world.numericSeed) * 40, type = roll < 12 ? "sheep" : roll < 22 ? "pig" : roll < 32 ? "chicken" : "cow", t = ENTITY_TYPES[type];
        if (
          this.world.get(x, y - 1, z) !== 1 ||
          actorCollides(this.world, x + 0.5, y, z + 0.5, t.width, t.height)
        )
          continue;
        let n = 0;
        this.entities.push(this.create(type, x + 0.5, y, z + 0.5, () => hash(i * 31 + attempt, n++, this.world.numericSeed + 977)));
        break;
      }
    }
  }
  pick(origin, dir, reach, wallDistance = reach) {
    let result = null;
    for (const e of this.entities) {
      if (e.health <= 0) continue;
      const distance = entityHit(origin, dir, e, Math.min(reach, wallDistance));
      if (distance !== null && (!result || distance < result.distance))
        result = { entity: e, distance };
    }
    return result;
  }
  // A damage source with an attacking entity at (fromX, fromZ): `byPlayer` for the player
  // (melee, its arrows and snowballs), else `attacker` names the mob (a skeleton's arrow, a
  // creeper's blast). See attackEntityFrom.
  damage(e, amount, fromX, fromZ, byPlayer = true, attacker = null, extra = null) {
    return this.attackEntityFrom(e, amount, { from: { x: fromX, z: fromZ }, player: byPlayer, attacker, name: byPlayer ? "player" : "mob", ...extra });
  }
  // EntityLivingBase.attackEntityFrom (sv.a(ro, F)); `source` is { name, from, player,
  // attacker }. EntityAnimal's part comes first, even for a rejected hit: fleeingTick 60 (a
  // counter nothing reads any more) and love reset. limbSwingAmount jumps to 1.5. While
  // hurtResistantTime > 10 (`hurt` > 0) only damage above lastDamage counts, the difference
  // being dealt, and the hit is not fresh. damageEntity takes armour off (the zombie's 2
  // points). A player attacker sets recentlyHit 100 and the revenge that EntityAIPanic and
  // EntityAIHurtByTarget read (only the player is a target here). A fresh hit then rolls
  // setBeenAttacked (not for drowning) and, with an attacker, knockBack on Entity.rand, and
  // plays the hurt or death sound with getSoundPitch; a top-up hit is silent and pushes nothing.
  attackEntityFrom(e, amount, source = {}) {
    if (!this.entities.includes(e)) return false;
    if (e.type === "ender_crystal") return crystalAttack(this, e); // any damage explodes it (ender-crystal-mobs.js)
    if (e.type === "silverfish") this.silverfishHurt(e, source);
    if (e.type === "enderman" && e.health > 0 && !endermanHurt(this, e, source, entityRandom(e)).proceed) return true;
    if (ANIMALS.has(e.type)) { e.flee = 60; e.love = 0; e.mateTicks = 0; }
    if (e.health <= 0) return false;
    if (e.type === "pigman") pigmanHurt(this, e, source, entityRandom); // yh.a: a player's hit angers it and every pigman within 32 blocks
    // EntityWolf.attackEntityFrom: the Sit task's wish is cleared (EntityAISit.setSitting(false)) and damage from a
    // creature that is neither a player nor an arrow is (amount + 1) / 2.
    // EntityOcelot.attackEntityFrom: the Sit task's wish is cleared.
    if (e.type === "ocelot") e.sitWish = false;
    if (e.type === "wolf") {
      e.sitWish = false;
      amount = wolfHurtAmount(amount, { attacker: source.attacker || source.player, player: source.player, arrow: source.arrow });
    }
    const rand = entityRandom(e), name = source.name ?? "generic";
    // Potion.fireResistance: fire damage is refused.
    if ((name === "onFire" || name === "inFire" || name === "lava") && (e.effects?.some((x) => x.id === 12) || fireproof(e))) return false;
    e.limbSwingAmount = 1.5;
    let fresh = true;
    if (e.hurt > 0) {
      if (amount <= e.lastDamage) return false;
      this.damageEntity(e, amount - e.lastDamage, name, source);
      e.lastDamage = amount;
      fresh = false;
    } else {
      e.lastDamage = amount;
      this.damageEntity(e, amount, name, source);
      e.hurt = 10;
    }
    if (source.player) { e.revenge = (e.age || 0) + 1; e.recentlyHit = 100; if (e.type === "wolf") noteWolfHurt(e, "player"); }
    // A wolf also takes revenge on a creature that hit it (EntityAIHurtByTarget reads getAITarget).
    else if (e.type === "wolf" && source.attacker && source.attacker !== e) { e.revenge = (e.age || 0) + 1; noteWolfHurt(e, source.attacker); }
    if (e.type === "villager") this.villagerHurtBy(e, source);
    if (fresh) {
      if (name !== "drown") rand.nextDouble();
      if (source.from) knockBack(e, source.from.x, source.from.z, () => rand.nextDouble(), Math.random);
    }
    const child = e.growingAge < 0, sound = { volume: soundVolume(e.type), position: e };
    // The server's own sound (hurt, or die when the hit kills) at getSoundPitch(): `events`, replayed against the original
    // by combat-reference.json. A fresh hit also sends status 2 to the clients (handleHealthUpdate: the hurt sound at
    // (r - r) * 0.2 + 1, no child pitch) and onDeath sends status 3 (the die sound the same way): the client's own
    // sounds go to `clientSounds`, so a fresh hit is heard twice in 1.7.10 (damage-fx.md).
    if (fresh) (this.clientSounds ??= []).push({ sound: hurtOf(e), ...sound, pitch: statusPitchRandom() });
    if (e.health <= 0) {
      if (fresh) this.events.push({ sound: deathOf(e), ...sound, pitch: soundPitch(rand, child) });
      this.onDeath(e, source);
      if (fresh) (this.clientSounds ??= []).push({ sound: deathOf(e), ...sound, pitch: statusPitchRandom() });
    } else if (fresh) this.events.push({ sound: hurtOf(e), ...sound, pitch: soundPitch(rand, child) });
    if (e.type === "zombie") this.callReinforcement(e, !!source.player);
    // EntityMob.attackEntityFrom: a hit that counted makes the attacker the target (only the player here).
    if (e.type === "silverfish" && source.player && e.health > 0) this.silverfishState(e).target = this.ai.player;
    return true;
  }
  // EntityLivingBase.damageEntity: armour, then setHealth (a float, clamped at 0).
  damageEntity(e, amount, name, source = null) {
    amount = armorReduced(e.type, amount, name, e.size);
    // EntityWitch.applyPotionDamageCalculations: its own damage is ignored, magic damage is cut to 15 %.
    if (e.type === "witch") amount = witchDamage(amount, { isMagic: name === "magic" || name === "indirectMagic", byWitch: source?.attacker === e });
    if (amount !== 0) e.health = Math.max(0, f(e.health - amount));
  }
  // EntityZombie.attackEntityFrom (yq.a(ro, F)) once the hit counts, even a killing one. The
  // target is the attack target, else the revenge target, else the attacker; only the player
  // is a target here, so a hit by a skeleton's arrow on a zombie with no target calls no one.
  // The new zombie stands at the integer corner of its block, as setPosition puts it.
  callReinforcement(e, byPlayer) {
    const player = this.ai.player;
    if (!(byPlayer || e.revenge || this.ai.brain(e).attackTarget === player) || this.entities.length >= 40) return null;
    const t = ENTITY_TYPES.zombie, w = t.width / 2;
    const spot = zombieReinforcement(entityRandom(e), this.difficulty, e.reinforcement ?? 0, e.x, e.y, e.z, {
      solidTop: (x, y, z) => y >= 0 && y < (this.world.height ?? HEIGHT) && normalCube(this.world.get(x, y, z)),
      light: (x, y, z) => (this.lightAt ? this.lightAt(x, y, z) : 0),
      fits: (x, y, z) => {
        if ((this.world.streaming ? !this.world.isTicking(x,z) : x < 1 || z < 1 || x >= SIZE - 1 || z >= SIZE - 1) || y < 0 || y + t.height > (this.world.height ?? HEIGHT)) return false;
        const box = [x - w, y, z - w, x + w, y + t.height, z + w];
        const meets = (o, ow, oh) => o.x + ow > box[0] && o.x - ow < box[3] && o.y + oh > box[1] && o.y < box[4] && o.z + ow > box[2] && o.z - ow < box[5];
        // World.checkNoEntityCollision: living mobs and the player.
        if (player.alive && meets(player, 0.3, 1.8)) return false;
        for (const o of this.entities) {
          if (o.health <= 0) continue;
          const s = this.ai.size(o);
          if (meets(o, s.width / 2, s.height)) return false;
        }
        if (collisionBoxes(this.world, box).length) return false;
        for (let bx = Math.floor(box[0]); bx < Math.floor(box[3] + 1); bx++)
          for (let by = Math.floor(box[1]); by < Math.floor(box[4] + 1); by++)
            for (let bz = Math.floor(box[2]); bz < Math.floor(box[5] + 1); bz++) if (isLiquid(this.world.get(bx, by, bz))) return false;
        return true;
      },
    });
    if (!spot) return null;
    const z = this.spawnNatural("zombie", spot.x, spot.y, spot.z);
    this.ai.brain(z).attackTarget = player;
    e.reinforcement = reinforcementChance(e.reinforcement + REINFORCEMENT_CHARGE);
    z.reinforcement = reinforcementChance(z.reinforcement + REINFORCEMENT_CHARGE);
    return z;
  }
  // A mob from SpawnerAnimals (or a reinforcement), with EntityLiving.onSpawnWithEgg's rolls
  // (difficulty.js): the spider's Hard potion effect; the zombie's knockback, follow range and
  // leader bonus. Rolls this build has no use for (equipment, children, villagers, jockeys,
  // loot pickup, door breaking, the leader's health) are drawn and dropped.
  spawnNatural(type, x, y, z) {
    const e = this.create(type, x, y, z);
    this.onSpawnWithEgg(e);
    this.entities.push(e);
    return e;
  }
  // EntityLiving.onSpawnWithEgg(null) and its overrides. EntityCaveSpider's (xy.a(sy)) returns
  // its argument without calling super: no follow-range roll, no jockey, no effect.
  onSpawnWithEgg(e) {
    const type = e.type, x = e.x, y = e.y, z = e.z, rand = entityRandom(e);
    const world = (this.worldRandom ??= new JavaRandom(Math.floor(Math.random() * 2 ** 48)));
    const local = this.localDifficulty ? this.localDifficulty(Math.floor(x), Math.floor(y), Math.floor(z)) : 0;
    if (type === "spider") {
      const r = spiderSpawnRolls(rand, world, this.difficulty, local);
      e.followRange = r.followRange;
      if (r.effect) addMobEffect(e, r.effect);
    } else if (type === "zombie" || type === "pigman") {
      const now = new Date(), r = zombieSpawnRolls(rand, world, this.difficulty, local, { month: now.getMonth() + 1, day: now.getDate() });
      // EntityZombie.GroupData: a child (isChild never ages out for a zombie) and a zombie villager.
      // EntityPigZombie.onSpawnWithEgg (yh.a) runs EntityZombie's rolls, then bC (the golden sword only); the child and villager rolls are
      // drawn and dropped (magma-pigman.md Gaps).
      if (type === "pigman") e.held = pigmanEquipment();
      else {
        if (r.child) e.growingAge = -1;
        if (r.villager) e.villager = true;
      }
      if (!r.diverged) {
        e.knockbackResistance = r.knockback;
        e.followRange = r.followRange;
        if (type === "zombie") e.reinforcement = reinforcementChance(e.reinforcement + r.reinforcementBonus);
      }
    } else if (type === "ocelot") {
      // EntityOcelot.onSpawnWithEgg: one chance in seven of two kittens (age -24000, CatType 0) at the same spot.
      for (let i = kittenLitter(world); i > 0 && this.entities.length < 40; i--) {
        const kit = this.create("ocelot", x, y, z);
        kit.growingAge = -24000;
        this.entities.push(kit);
      }
    }
    return e;
  }
  // The mob-spawner.js context hooks for this world (MobSpawnerBaseLogic.updateSpawner). `env`
  // supplies the light: skyLight(x, y, z) (the saved sky value), lightValue(x, y, z)
  // (World.getBlockLightValue), thundering() and thunderLightValue(x, y, z) (skylightSubtracted
  // 10); `extraCollision(box)` adds boats/minecarts (preventEntitySpawning and their boxes).
  // A spawn beyond the 40 mobs a save keeps is refused after its rolls (createMob null).
  spawnerHooks(env = {}) {
    const height = this.world.height ?? HEIGHT;
    const sized = (o) => { const s = this.size(o); return mobBox(o.x, o.y, o.z, s[0], s[1]); };
    const light = (fn, fallback) => fn ?? ((x, y, z) => (this.lightAt ? this.lightAt(x, y, z) : fallback));
    const lightEnv = {
      skyLight: env.skyLight ?? (() => 0),
      lightValue: light(env.lightValue, 0),
      thunderLightValue: light(env.thunderLightValue ?? env.lightValue, 0),
    };
    const blocked = (box) => {
      const p = this.ai?.player;
      if (p?.alive && boxesIntersect(box, mobBox(p.x, p.y, p.z, 0.6, 1.8))) return true;
      // World.checkNoEntityCollision: not yet setDead (a dying mob still counts).
      for (const o of this.entities) if (pushable(o) && boxesIntersect(box, sized(o))) return true;
      return !!env.extraCollision?.(box);
    };
    const liquid = (box) => {
      for (let bx = Math.floor(box[0]); bx < Math.floor(box[3] + 1); bx++)
        for (let by = Math.floor(box[1]); by < Math.floor(box[4] + 1); by++)
          for (let bz = Math.floor(box[2]); bz < Math.floor(box[5] + 1); bz++) if (by >= 0 && by < height && isLiquid(this.world.get(bx, by, bz))) return true;
      return false;
    };
    return {
      countNearby: (type, box) => this.entities.reduce((n, o) => n + (countsAs(type, o.type) && boxesIntersect(box, sized(o)) ? 1 : 0), 0),
      createMob: (type, x, y, z, yaw) => {
        if (!ENTITY_TYPES[type] || this.entities.length >= (env.limit ?? 40)) return null;
        const e = this.create(type, x, y, z);
        // setLocationAndAngles(x, y, z, yaw, 0).
        for (const k of ["rotationYaw", "prevRotationYaw", "renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead", "bodyHeadYaw"]) e[k] = yaw;
        e.yaw = (-yaw * Math.PI) / 180;
        return e;
      },
      canSpawnHere: (e) => {
        const t = ENTITY_TYPES[e.type], box = { x: e.x, y: e.y, z: e.z, width: t.width * mobScale(e), height: t.height * mobScale(e) };
        const sb = mobBox(e.x, e.y, e.z, box.width, box.height);
        // Pig zombies and magma cubes use only the space checks. Ghasts also
        // roll 1 in 20; blazes override EntityMob.isValidLightLevel.
        if (["pigman", "magma_cube", "ghast", "blaze"].includes(e.type)) {
          if (e.type === "ghast" && entityRandom(e).nextInt(20) !== 0) return false;
          return this.difficulty !== PEACEFUL && !blocked(sb) && !collisionBoxes(this.world, sb).length && !liquid(sb);
        }
        if (e.type === "silverfish") {
          // EntitySilverfish.getCanSpawnHere: no light rolls (isValidLightLevel is true), stone-friendly path weight, no player within 5.
          const p = this.ai?.player;
          return silverfishCanSpawnHere(e, {
            difficulty: this.difficulty, entityCollision: blocked, blockCollision: (b) => collisionBoxes(this.world, b).length > 0, liquid,
            belowId: (x, y, z) => this.world.get(x, y, z),
            brightness: (x, y, z) => SPAWN_BRIGHTNESS[lightEnv.lightValue(x, y, z)],
            playerWithin: (x, y, z, range) => !!p?.alive && (p.x - x) ** 2 + (p.y - y) ** 2 + (p.z - z) ** 2 < range * range,
          }, (m) => mobBox(m.x, m.y, m.z, t.width, t.height));
        }
        // A Slime spawner (SPAWNER_ENTITY_IDS) uses the slime's own swamp and slime chunk rules (no light rule of EntityMob).
        if (e.type === "slime") return this.slimeCanSpawn(e, entityRandom(e), env.time ?? 0, () => !blocked(sb) && !collisionBoxes(this.world, sb).length && !liquid(sb));
        if (HOSTILE.has(e.type))
          return monsterCanSpawnHere(box, { difficulty: this.difficulty, thundering: !!env.thundering?.(), ...lightEnv, entityCollision: blocked, blockCollision: (b) => collisionBoxes(this.world, b).length > 0, liquid }, entityRandom(e));
        // EntityAnimal.getCanSpawnHere: grass below and full light above 8, then EntityLiving's checks.
        const x = Math.floor(e.x), y = Math.floor(e.y), z = Math.floor(e.z), b = mobBox(e.x, e.y, e.z, t.width, t.height);
        return this.world.get(x, y - 1, z) === 2 && (env.fullLight ?? lightEnv.lightValue)(x, y, z) > 8 && !blocked(b) && !collisionBoxes(this.world, b).length && !liquid(b);
      },
      initMob: (e) => this.onSpawnWithEgg(e),
      addMob: (e) => this.entities.push(e),
      // EntityLiving.spawnExplosionParticle (entity status 20 on the client): 20 explode puffs.
      explosionParticles: (e) => {
        const t = ENTITY_TYPES[e.type];
        if (this.fx) burst(this.fx, "explode", 20, { x: e.x, y: e.y, z: e.z, width: t.width, height: t.height }, entityRandom(e));
      },
    };
  }
  // EntityMob.attackEntityAsMob (yg.n(sa)): the attackDamage attribute (Strength applies) as a
  // mob damage source, which EntityPlayer.attackEntityFrom scales by difficulty
  // (Survival.scaledDamage); a burning zombie with an empty hand may set the player alight.
  hitPlayer(e, survival) {
    // Thorns (EnchantmentHelper.func_151384_a) hurts the mob as a player-caused hit that knocks it back from the player.
    const wearer = this.ai?.player, thorns = {
      hurt: (damage) => this.attackEntityFrom(e, damage, { from: wearer && { x: wearer.x, z: wearer.z }, player: true, name: "thorns" }),
      sound: () => this.events.push({ sound: "damage.thorns", volume: 0.5, pitch: 1, position: { x: e.x, y: e.y, z: e.z } }),
    };
    const hit = survival.scaledDamage(attackDamage(e, e.type === "wolf" ? wolfAttack(e) : e.type === "slime" ? slimeDamage(e.size) : e.type === "magma_cube" ? magmaDamage(e.size) : ENTITY_TYPES[e.type].damage), "a " + e.type, { attacker: thorns });
    // EntityLivingBase.setRevengeTarget on the player: its wolves defend it (EntityAIOwnerHurtByTarget).
    if (hit) this.ai.playerHurtBy(e);
    if (hit && e.type === "zombie") {
      const ticks = zombieFireOnHit(entityRandom(e), this.difficulty, e.burn > 0 || e.fire > 0);
      if (ticks) survival.setFire(ticks / 20);
    }
    // EntityCaveSpider.attackEntityAsMob: addPotionEffect(new PotionEffect(poison, ticks, 0)).
    if (hit && e.type === "wither_skeleton") survival.effects?.add(witherHitEffect()); // EntitySkeleton.attackEntityAsMob, type 1
    if (hit && e.type === "cave_spider") {
      const ticks = caveSpiderPoisonTicks(this.difficulty);
      if (ticks > 0) survival.effects?.add({ id: POISON, duration: ticks, amplifier: 0 });
    }
    return hit;
  }
  // `critical` is the jump-attack test of attackTargetEntityWithCurrentItem (damage * 1.5F).
  // The entity as Crit2FX follows it: position, box floor, size (halved for a child), motion.
  fxTarget(e) {
    const t = ENTITY_TYPES[e.type], s = mobScale(e);
    return { x: e.x, z: e.z, minY: e.y, width: f(t.width * s), height: f(t.height * s), mx: e.vx, my: e.vy, mz: e.vz };
  }
  // EntityPlayer.attackTargetEntityWithCurrentItem (yz.r) with the held weapon's enchantments, in the
  // original's order: damage f (x 1.5 for a critical hit) plus Sharpness/Smite/Bane f1; Fire Aspect sets
  // the target alight for 1 s before the hit (undone when the hit does not land); the hit (Looting rides on
  // the source into onDeath); on a landed hit the Knockback + sprint push, then Bane of Arthropods'
  // slowness roll on the player's Random; the tool wears and, for Fire Aspect, the target burns for
  // level * 4 s. `info` receives {knockback, enchantCritical, slowness} for the caller (the player's
  // own slowdown, the magic-crit particles, the hotbar).
  attack(e, tool, survival, player, extraKnockback = 0, critical = false, info = {}) {
    if (!this.entities.includes(e) || e.health <= 0) return false;
    const item = ITEMS[tool],
      owned = survival.creative || survival.count(tool) > 0,
      held = owned && survival.held?.id === tool ? survival.held : null,
      weapon = weaponEnchantments(held, e.type);
    let damage = heldAttackDamage(tool, survival);
    if (critical) damage = criticalDamage(damage);
    damage = f(damage + weapon.damage);
    const knockback = extraKnockback + weapon.knockback, ignite = weapon.fireAspect > 0 && !(e.fire > 0);
    if (ignite) e.fire = Math.max(e.fire || 0, 20);
    const landed = !(e.hurt > 0 && damage <= e.lastDamage) && this.damage(e, damage, player.x, player.z, true, null, { looting: weapon.looting });
    if (landed) {
      this.ai.playerHit(e); // EntityLivingBase.setLastAttacker: the owner's wolves join in (EntityAIOwnerHurtTarget)
      // Entity.addVelocity(-sin(yaw) * n * 0.5F, 0.1, cos(yaw) * n * 0.5F) with the sine table and Java
      // floats; player.yaw is this build's radian view yaw (Java yaw = 180 - yaw degrees).
      if (knockback > 0 && Number.isFinite(player.yaw)) {
        const rad = f(f(f(180 - player.yaw * (180 / Math.PI)) * f(Math.PI)) / 180);
        addVelocity(e, f(f(-mhSin(rad) * knockback) * 0.5), 0.1, f(f(mhCos(rad) * knockback) * 0.5));
      }
      info.knockback = knockback;
      info.enchantCritical = weapon.damage > 0;
      info.slowness = arthropodSlowness(survival.inventory?.armor, held, e.type, info.playerRandom ?? (this.playerRandom ??= javaLikeRandom(this.random)));
    }
    // The reference shows no tool wear when the hit is refused by the hurt window.
    if (landed) {
      if (owned && ["sword", "axe", "pickaxe", "shovel"].includes(item?.kind)) survival.wear(tool, item.kind === "sword" ? 1 : 2);
      survival.exhaust(0.3);
    }
    if (weapon.fireAspect > 0 && landed) e.fire = Math.max(e.fire || 0, weapon.fireAspect * 80);
    else if (ignite) e.fire = 0;
    return landed;
  }
  // EntityLivingBase.onDeath: a mob that is not a child drops its items (combat.js
  // mobDrops) on Entity.rand; the experience waits for deathTime 20 (deathUpdate). The death
  // counter starts on the next onEntityUpdate, or in this one for fire and drowning.
  onDeath(e, source = {}) {
    if (e.type === "villager") this.villagerDied(e, source);
    this.gearDeath(e); // horse-gear-live.js: the horse inventory and the lead drop
    // ... and only while gamerule doMobLoot is true (dropFewItems, dropEquipment and the rare drop alike).
    if ((e.growingAge >= 0 || e.type === "zombie" || e.type === "pigman") && gameRule("doMobLoot")) {
      const at = { x: e.x, y: e.y, z: e.z };
      for (const [drop, damage] of mobDrops(e, { playerHit: e.recentlyHit > 0, burning: e.fire > 0, bySkeleton: source.attacker === "skeleton", looting: source.player ? source.looting || 0 : 0 }, entityRandom(e)))
        this.events.push({ drop, count: 1, ...(damage ? { damage } : {}), position: at });
    }
    e.death = 0;
    if (e.eatTimer) e.eatTimer = 0;
    // EntityLivingBase.onDeath: Entity.onKillEntity of the attacker, a zombie's villager rule.
    if (e.type === "villager" && source.attacker?.type === "zombie") this.zombieKilledVillager(source.attacker, e);
  }
  // The player's kill (main.js /kill, tests): a generic death with the player as attacker.
  kill(e) {
    if (e.health <= 0) return;
    e.health = 0;
    e.recentlyHit = 100;
    this.events.push({ sound: deathOf(e), volume: soundVolume(e.type), pitch: soundPitch(entityRandom(e), e.growingAge < 0), position: e });
    this.onDeath(e, { player: true });
  }
  // EntityLivingBase.onDeathUpdate (sv.aF): at deathTime 20 a mob a player hit within the
  // last 100 ticks, not a child, leaves its experience (split into orbs by xpOrbs.spawn),
  // then is setDead with 20 "explode" puffs drawn on Entity.rand.
  deathUpdate(e, t) {
    e.death = (e.death || 0) + 1;
    if (e.death !== 20) return;
    const rand = entityRandom(e);
    if (e.recentlyHit > 0 && (e.growingAge >= 0 || e.type === "zombie" || e.type === "pigman") && gameRule("doMobLoot")) {
      const world = (this.worldRandom ??= new JavaRandom(Math.floor(Math.random() * 2 ** 48)));
      this.events.push({ xp: experiencePoints(e, rand, world), position: { x: e.x, y: e.y, z: e.z } });
    }
    if (isSlimeLike(e)) this.splitSlime(e, rand);
    if (this.fx) burst(this.fx, "explode", 20, { x: e.x, y: e.y, z: e.z, width: t.width, height: t.height }, rand);
  }
  // EntityLivingBase.fall (sv.b(F)): ceil(distance - 3) points of fall damage
  // (no jump boost), through attackEntityFrom without an attacker, so no knockback.
  fall(e, distance) {
    // Entity.fall: the rider falls with its mount (EntityPig calls super.fall; EntityHorse has its own fall).
    if (e.type === "pig") e.rider?.fall?.(distance);
    // Jump Boost (Potion.jump, id 8) takes amplifier + 1 off the distance; the fall sound plays first, then the damage
    // and the landing block's step sound (EntityLivingBase.fall; EntityMob says "hostile", the rest "neutral").
    const jump = e.effects?.find?.((x) => x.id === JUMP_BOOST), cell = [Math.floor(e.x), Math.floor(e.y - 0.20000000298023224), Math.floor(e.z)],
      { points, sounds } = landingEffects(distance, { kind: isEntityMob(e.type) ? "hostile" : "neutral", amplifier: jump ? jump.amplifier : -1, blockUnder: this.world.get(...cell) });
    if (points > 0) {
      this.events.push({ sound: sounds[0].name, volume: 1, pitch: 1, position: e });
      this.hazard(e, points, "fall");
      for (const s of sounds.slice(1)) this.events.push({ sound: s.name, volume: s.volume, pitch: s.pitch, position: e });
    }
    // EntityCreeper.fall (xz.b(F)) then pushes the fuse on.
    if (e.type === "creeper") creeperFall(e, distance);
  }
  // attackEntityFrom with a source that has no attacker: fall, onFire, lava, drown,
  // inFire (fire blocks, lightning), cactus, explosion (unowned TNT), generic.
  hazard(e, points, name = "generic") {
    return this.attackEntityFrom(e, points, { name });
  }
  // EntityLivingBase.onEntityUpdate after the fire (Entity.onEntityUpdate) and before the air: a mob
  // that is still alive and has a corner of its eye box (suffocation.js) inside a normal cube takes
  // attackEntityFrom(inWall, 1): armour is bypassed, the hurt window applies, no knockback.
  suffocate(e, t) {
    if (e.health > 0 && insideOpaqueBlock(this.world, e.x, e.y, e.z, t.width, mobEyeHeight(t.height))) this.hazard(e, 1, "inWall");
  }
  // EntityWitch.onLivingUpdate (yp.e), the server half before EntityLiving's: the drinking countdown and the rolls that start a drink
  // (witch.js witchDrink), on Entity.rand, then the effects of a finished potion are added.
  witchUpdate(e, t) {
    const m = this.ai.brain(e), target = m.attackTarget, w = { drinking: !!e.drinking, timer: e.drinkTimer || 0, held: e.held ?? null };
    const hasEffect = (id) => !!e.effects?.some((x) => x.id === id);
    const r = witchDrink(w, {
      rand: entityRandom(e), inWater: eyeInWater(this.world, e.x, e.y + f(f(t.height) * f(0.85)), e.z), burning: e.fire > 0, health: e.health, maxHealth: t.health,
      target, targetDistSq: target ? m.distSq(target) : 0, hasEffect,
    });
    e.drinking = w.drinking;
    e.drinkTimer = w.timer;
    e.held = w.held;
    if (r.finished) for (const [id, amplifier, duration] of potionEffects(r.finished.damage)) addMobEffect(e, id, duration, amplifier);
  }
  // EntityLivingBase.onEntityUpdate's air (see `breathe` below): drowning deals 2 with no
  // attacker, so no knockback or revenge. The air is saved with the mob.
  breathe(e, t) {
    if (breathe(this.world, e, t.height, entityRandom(e), this.fx) && !e.effects?.some((x) => x.id === 13)) this.hazard(e, 2, "drown");
  }
  // EntityLiving.onEntityUpdate (sw.C), after the air: rand.nextInt(1000) < livingSoundTime++
  // resets the time to -getTalkInterval (EntityAnimal 120, else 80) and plays the living sound
  // at getSoundVolume (EntityCow 0.4, else 1) and getSoundPitch ((rand - rand) * 0.2 + 1, 1.5
  // for a child). EntityCreeper has no living sound but still rolls and resets.
  talk(e) {
    if (e.type === "squid" || e.type === "bat") return squidBatTalk(this, e);
    if (e.type === "blaze" || e.type === "ghast") return fireballMobTalk(this, e); // blaze-ghast-mobs.js
    if (e.type === "wither") return witherTalk(this, e); // wither-boss-mobs.js
    if (e.type === "horse") return this.horseTalk(e, livingSoundRoll);
    const rand = entityRandom(e);
    if (!livingSoundRoll(e, rand, HOSTILE.has(e.type) || e.type === "villager" ? 80 : 120) || e.type === "creeper" || e.type === "iron_golem" || e.type === "snow_golem" || isSlimeLike(e)) return;
    // EntityWolf.getLivingSound (t) rolls before the sound's pitch.
    const wolfSound = e.type === "wolf" ? wolfSay(e, rand) : e.type === "ocelot" ? ocelotSay(e, rand) : null;
    const pitch = f(f(f(rand.nextFloat() - rand.nextFloat()) * f(0.2)) + (e.growingAge < 0 ? f(1.5) : 1));
    if (e.type === "ocelot" && !wolfSound) return; // a wild ocelot's living sound is "" (it still rolled the pitch)
    this.events.push({ sound: e.type === "pigman" ? PIGMAN.sounds.say : e.type === "enderman" ? endermanLiving(e) : e.type === "witch" ? WITCH_SOUNDS.idle : wolfSound ? wolfSound : e.type === "villager" ? (e.customer ? VILLAGER_SOUNDS.haggle : VILLAGER_SOUNDS.idle) : "mob." + soundType(e.type) + ".say", volume: soundVolume(e.type), pitch, position: { x: e.x, y: e.y, z: e.z } });
  }
  // The fire and lava part of Entity.onEntityUpdate (sa.C): water puts the fire
  // out; a burning mob takes 1 (onFire) whenever the counter is a multiple of 20;
  // lava (handleLavaMovement) deals 4 (lava), sets fire for 15 s (counter 300) and
  // halves the fall distance. EntityAIPanic keeps animals running while they burn.
  burn(e, t) {
    // Entity.isImmuneToFire: the counter runs down by 4, no onFire damage, lava neither burns nor hurts (setOnFireFromLava does nothing).
    // EntityMagmaCube.handleLavaMovement (yf.P) is false: it ignores lava altogether.
    if (fireproof(e)) {
      e.fire = Math.max(0, (e.fire || 0) - 4);
      e.burn = 0;
      e.inLava = e.type === "magma_cube" ? false : inLava(this.world, [e.x - t.width / 2, e.y, e.z - t.width / 2, e.x + t.width / 2, e.y + t.height, e.z + t.width / 2]);
      if (e.inLava) e.fallDistance *= 0.5;
      return;
    }
    // handleWaterMovement: only water; rain puts a burning mob out in moveEntity's tail.
    if (e.inWater) e.fire = 0;
    if (e.fire > 0) {
      if (e.fire % 20 === 0) this.hazard(e, 1, "onFire");
      e.fire--;
    }
    const r = t.width / 2;
    if ((e.inLava = inLava(this.world, [e.x - r, e.y, e.z - r, e.x + r, e.y + t.height, e.z + r]))) {
      this.hazard(e, 4, "lava");
      e.fire = Math.max(e.fire, 300);
      e.fallDistance *= 0.5;
    }
    // Fire blocks and cactus act in moveEntity's tail (walk, block-collisions.js).
    e.burn = e.fire > 0 ? 1 : 0;
  }
  feed(e,id,survival){
    if(!this.entities.includes(e)||e.health<=0||!BREED_ITEM[e.type]||id!==BREED_ITEM[e.type]||(!survival.creative&&!survival.count(id)))return false;
    if(e.growingAge!==0||e.love>0)return false;e.love=600;
    if(!survival.creative)survival.take(id);
    // EntityAnimal.func_146082_f: World.setEntityState(18), which the client shows as 7 hearts.
    if(this.fx){const t=ENTITY_TYPES[e.type];burst(this.fx,'heart',7,{x:e.x,y:e.y,z:e.z,width:t.width,height:t.height},entityRandom(e),0.5);}
    return true;
  }
  // EntityAIMate.spawnBaby (ua.g): the child of two animals in love (growingAge -24000,
  // at the mother's position, a sheep's colour from the parents' dyes), both parents'
  // age set to 6000 and love cleared, and 1 to 7 experience (its hearts are a server
  // spawnParticle, which singleplayer never shows). A full world
  // (40 mobs) keeps them waiting. Returns whether the baby was born.
  spawnBaby(a,b){
    if(this.entities.length>=40)return false;
    const baby=this.create(a.type,a.x,a.y,a.z);baby.growingAge=-24000;
    // EntityWolf.createChild (wv.b): the puppy of a tamed wolf is tamed to the same owner.
    if(a.type==='wolf')Object.assign(baby,puppyFields(a));
    // EntityOcelot.createChild (wn.b): a tamed parent's kitten has its owner and CatType.
    if(a.type==='ocelot')Object.assign(baby,kittenFields(a));
    // EntitySheep.createChild (wp.b(rx)): the lamb's colour is the parents' dye mix.
    if(a.type==='sheep')baby.color=childColor(a.color,b.color,this.random);
    if(a.type==='horse')Object.assign(baby,horseChildFields(a,b,entityRandom(a)));
    this.entities.push(baby);a.growingAge=b.growingAge=6000;a.love=b.love=0;a.mateTicks=b.mateTicks=0;
    // The breeding experience needs gamerule doMobLoot.
    if(gameRule("doMobLoot"))this.events.push({xp:1+Math.floor(Math.random()*7),position:{x:a.x,y:a.y,z:a.z}});
    return true;
  }
  // EntityAIVillagerMate.giveBirth (up.g): EntityVillager.createChild is a new villager whose onSpawnWithEgg draws
  // World.rand.nextInt(5) for the profession; the child (growing age -24000) stands where the parent does.
  spawnVillagerChild(parent) {
    const baby = this.create("villager", parent.x, parent.y, parent.z);
    baby.growingAge = -24000;
    baby.profession = (this.worldRandom ??= new JavaRandom(Math.floor(Math.random() * 2 ** 48))).nextInt(5);
    baby.rotationYaw = baby.rotationYawHead = parent.rotationYaw ?? 0;
    this.entities.push(baby);
    return baby;
  }
  // EntityMob.attackEntityAsMob (yg.n) against another creature: the attackDamage attribute as a mob damage source (no
  // difficulty scaling: that is the player's); a burning zombie with an empty hand may set the victim alight.
  hitMob(e, target) {
    if (!this.entities.includes(target) || target.health <= 0) return false;
    const hit = this.attackEntityFrom(target, attackDamage(e, e.type === "wolf" ? wolfAttack(e) : ENTITY_TYPES[e.type].damage), { from: { x: e.x, z: e.z }, attacker: e, name: "mob", player: false });
    if (hit && e.type === "zombie") {
      const ticks = zombieFireOnHit(entityRandom(e), this.difficulty, e.burn > 0 || e.fire > 0);
      if (ticks) target.fire = Math.max(target.fire || 0, ticks);
    }
    return hit;
  }
  // EntityZombie.onKillEntity (yq.a(sv)): on Normal (half the time) and Hard the villager is replaced by a zombie
  // villager: copyLocationAndAngles, EntityZombie.onSpawnWithEgg(null) (its rolls may add a child), isVillager, a child
  // villager makes a child zombie, then world event 1016 (mob.zombie.infect).
  zombieKilledVillager(zombie, villager) {
    if (!killConverts(this.difficulty, entityRandom(zombie))) return;
    const z = this.create("zombie", villager.x, villager.y, villager.z);
    for (const k of ["yaw", "rotationYaw", "prevRotationYaw", "renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead", "rotationPitch", "prevRotationPitch"]) if (villager[k] !== undefined) z[k] = villager[k];
    this.onSpawnWithEgg(z);
    z.villager = true;
    if (villager.growingAge < 0) z.growingAge = -1;
    this.entities.push(syncInterpolation(z));
    // The villager is removed at once (World.removeEntity), without a death animation or experience.
    villager.death = 20;
    villager.recentlyHit = 0;
    this.events.push(auxSound(AUX_INFECT, { nextFloat: () => f(this.random()) }, z));
  }
  // EntityZombie.interact (yq.a(yz)) with a golden apple: returns whether the item was used. The stack shrinks outside
  // Creative; the countdown is nextInt(2401) + 3600 on the zombie's Entity.rand.
  cure(e, id, survival, damage = 0) {
    if (!this.entities.includes(e) || !canCure(e, id, damage) || (!survival.creative && !survival.count(id))) return false;
    if (!survival.creative) survival.take(id);
    this.startZombieConversion(e, startConversionTicks(entityRandom(e)));
    return true;
  }
  // yq.a(int): the timer, Weakness removed, Strength for the timer's length, entity state 16 (mob.zombie.remedy).
  startZombieConversion(e, ticks) {
    startConversion(e, ticks, addMobEffect);
    // The client plays state 16 with its own Random: the entity's server Random is not touched.
    this.events.push(remedySound({ nextFloat: () => f(this.random()) }, e));
  }
  // yq.h's conversion step: the timer drops by getConversionTimeBoost each tick; at 0 or below the villager returns.
  tickConversion(e) {
    const boost = conversionBoost(entityRandom(e), (x, y, z) => this.world.get(x, y, z), e.x, e.y, e.z);
    e.conversionTime -= boost;
    if (e.conversionTime > 0) return false;
    this.cureZombie(e);
    return true;
  }
  // yq.cd (convertToVillager): a new villager at the zombie's place, onSpawnWithEgg (follow-range bonus on its own
  // Entity.rand, profession World.rand.nextInt(5)), the default-reputation flag, a child stays a child (-24000),
  // Nausea for 200 ticks and world event 1017 (mob.zombie.unfect). The zombie is removed.
  cureZombie(e) {
    const v = this.create("villager", e.x, e.y, e.z);
    for (const k of ["yaw", "rotationYaw", "prevRotationYaw", "renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead", "rotationPitch", "prevRotationPitch"]) if (e[k] !== undefined) v[k] = e[k];
    v.followRange = attributeValue(16, [spawnBonus(entityRandom(v))], 0, 2048);
    v.profession = (this.worldRandom ??= new JavaRandom(Math.floor(Math.random() * 2 ** 48))).nextInt(5);
    v.defaultReputation = true;
    if (e.growingAge < 0) v.growingAge = -24000;
    addMobEffect(v, NAUSEA, CURE_NAUSEA_TICKS, 0);
    this.entities.push(syncInterpolation(v));
    e.health = 0;
    e.death = 20;
    e.recentlyHit = 0;
    this.events.push(auxSound(AUX_CURE, { nextFloat: () => f(this.random()) }, v));
  }
  // World.spawnEntityInWorld(EntityIronGolem) at a village's spawn cell or a pumpkin golem's position.
  spawnIronGolem(x, y, z, playerCreated = false) {
    const g = this.create("iron_golem", x, y, z);
    g.playerCreated = playerCreated;
    this.entities.push(g);
    return g;
  }
  // BlockPumpkin.onBlockAdded (golem half): the iron T under a placed pumpkin becomes a player-created golem.
  // Returns the cleared cells (the caller redraws them), or null when the shape is not there.
  tryBuildIronGolem(x, y, z) {
    const w = this.world, IRON = BLOCKS.findIndex((b) => b.name === "Iron block");
    if (w.get(x, y, z) !== PUMPKIN) return null;
    const shape = ironGolemShape((a, b, c) => w.get(a, b, c) === IRON, x, y, z);
    if (!shape) return null;
    for (const [a, b, c] of shape.cells) w.set(a, b, c, 0, true, 0);
    this.spawnIronGolem(shape.at.x, shape.at.y, shape.at.z, true);
    return shape.cells;
  }
  // EntityIronGolem.attackEntityAsMob against the player (7 + nextInt(15) as a mob hit): returns whether it hurt.
  hitGolemPlayer(e, damage, survival) {
    return survival.scaledDamage(damage, "an Iron Golem", { attacker: null });
  }
  villageBurst(name, e, size, rand) {
    if (this.fx) burst(this.fx, name, 5, { x: e.x, y: e.y, z: e.z, width: size.width, height: size.height }, rand, 1);
  }
  // The village collection (World.villageCollectionObj), made on first use.
  get villages() {
    return (this.villageCollection ??= createVillages(this));
  }
  // EntityVillager.setRevengeTarget (yv.b(sv)) for a player hit: the village notes the aggressor, the player
  // loses 1 reputation (3 for a child) and the villager shows angry particles.
  villagerHurtBy(e, source) {
    const village = this.ai.brain(e).village;
    if (!village || !source.player) return;
    village.addOrRenewAggressor(this.ai.player);
    village.changeReputation(PLAYER_NAME, e.growingAge < 0 ? -3 : -1);
    if (e.health > 0 && this.fx) burst(this.fx, "angryVillager", 5, { x: e.x, y: e.y, z: e.z, width: 0.6, height: 1.8 }, entityRandom(e), 1);
  }
  // EntityVillager.onDeath (yv.a(ro)): killed by a player -2 reputation; by a monster the village ends its mating
  // season; with no known attacker, a player within 16 blocks ends it too.
  villagerDied(e, source) {
    const village = this.ai.brain(e).village;
    if (!village) return;
    if (source.player) village.changeReputation(PLAYER_NAME, -2);
    else if (source.attacker && HOSTILE.has(source.attacker.type ?? source.attacker)) village.endMatingSeason();
    else if (!source.attacker) {
      const p = this.ai.player;
      if (p?.alive && (p.x - e.x) ** 2 + (p.y - e.y) ** 2 + (p.z - e.z) ** 2 < 256) village.endMatingSeason();
    }
  }
  // EntitySheep.interact (wp.a(yz)) with shears (ade.aZ) held: an unsheared adult
  // is sheared, drops 1 to 3 wool of its colour (entityDropItem(stack, 1.0F) with
  // motionY += rand * 0.05 and motionX/Z += (rand - rand) * 0.1), plays mob.sheep.shear
  // and the shears lose 1 durability (not in Creative).
  shear(e,id,survival){
    if(!this.entities.includes(e)||e.health<=0||e.type!=='sheep'||id!==125||e.sheared||e.growingAge<0)return false;
    if(!survival.creative&&!survival.count(id))return false;
    const r=this.random,n=1+Math.floor(r()*3);e.sheared=true;
    for(let i=0;i<n;i++){const my=f(r()*f(0.05)),mx=f(f(r()-r())*f(0.1)),mz=f(f(r()-r())*f(0.1));
      this.events.push({drop:WOOL,count:1,damage:e.color,offsetY:1,kick:[mx,my,mz],position:{x:e.x,y:e.y,z:e.z}});}
    this.events.push({sound:'mob.sheep.shear',volume:1,position:{x:e.x,y:e.y,z:e.z}});
    if(!survival.creative)survival.wear(id,1);
    return true;
  }
  // ItemDye.itemInteractionForEntity (acj.a(add, yz, sv)): after EntitySheep.interact
  // declined (shears, wheat), a dye whose fleece colour (~damage & 15) differs from an
  // unsheared sheep's sets it and loses one item (Creative restores the stack). Lambs
  // are dyed too. Returns true for any sheep, as the original does.
  dye(e,stack,survival){
    if(!this.entities.includes(e)||e.health<=0||e.type!=='sheep'||stack?.id!==DYE)return false;
    const colour=~stack.damage&15;
    if(!e.sheared&&e.color!==colour){
      e.color=colour;
      if(!survival.creative)survival.inventory.decr(survival.inventory.current,1);
    }
    return true;
  }
  // The tick-4 step of EntityAIEatGrass (ud.e, task in ai.js): the tall grass at the feet
  // is destroyed without a drop, or the grass block below turns to dirt (level event
  // 2001), and EntitySheep.eatGrassBonus (wp.p) clears the sheared flag and ages a lamb
  // by 60 seconds.
  eatGrass(e){
    const w=this.world,x=Math.floor(e.x),y=Math.floor(e.y),z=Math.floor(e.z);
    let at=null;
    if(w.get(x,y,z)===39)at=[x,y,z,39];else if(w.get(x,y-1,z)===1)at=[x,y-1,z,1];
    if(at){
      // EntityAIEatGrass.updateTask: the block edit and event 2001 need gamerule mobGriefing; eatGrassBonus runs either way.
      if(gameRule("mobGriefing")){
        w.set?.(at[0],at[1],at[2],at[3]===39?0:2);
        this.events.push({eatGrass:{x:at[0],y:at[1],z:at[2],block:at[3]}});
      }
      e.sheared=false;
      if(e.growingAge<0)e.growingAge=Math.min(0,e.growingAge+1200);
    }
  }
  // The AI service: the brains (navigator, helpers and tasks per mob, see ai.js) hang off
  // a WeakMap, so they are never saved and a loaded world starts them fresh.
  get ai(){
    return this.mobAI??=new MobAI(this,{
      ENTITY_TYPES,BREED_ITEM,aiMoveSpeed,entityRandom,isRaining:()=>this.isRaining?.(),
      mobSize:(e)=>{const base=ENTITY_TYPES[e.type],scale=mobScale(e);return{width:base.width*scale,height:base.height*scale};},
      spawnBaby:(a,b)=>this.spawnBaby(a,b),
      moveWithHeading:(e,forward)=>{const base=ENTITY_TYPES[e.type],scale=mobScale(e);this.moveWith(e,{...base,width:base.width*scale,height:base.height*scale},forward);},
      wearHeld:(amount)=>this.wearStick?.(this.ai.survival,amount),
      eatGrass:(e)=>this.eatGrass(e),
      attackPlayer:(e,survival)=>this.hitPlayer(e,survival),
      attackMob:(e,target)=>this.hitMob(e,target),
      difficulty:()=>this.difficulty,
      // EntitySkeleton.attackEntityWithRangedAttack: the arrow itself is made by bow.js
      // (entities.js cannot import it: projectiles.js already imports this file).
      rangedAttack:(e,target,scale)=>e.type==="wither"?witherRanged(this,e,target):e.type==="witch"?this.potions?.throwAt(e,target):e.type==="snow_golem"?this.golemBalls.shoot(e,target):this.shoot?.(e,target,scale),
      isDaytime:()=>this.day,
      canSeeSky:(x,y,z)=>this.canSeeSky?this.canSeeSky(x,y,z):openSky(this.world,x,y,z),
      despawn:(e)=>{e.health=0;e.death=20;},
    });
  }
  tick(player, survival, heldItem=0) {
    const night = !this.world.dimension &&
      survival.time % 24000 > 13000 && survival.time % 24000 < 23000;
    this.spawnClock++;
    // World.isDaytime (skylightSubtracted < 4); main.js hooks the real light level in.
    this.day = this.isDaytime ? this.isDaytime() : !night;
    this.ai.beginTick(player, survival, heldItem);
    // World.tick: villageCollectionObj.tick() before the entities.
    this.villages.tick();
    // Splash potions thrown by witches (witch-potions.js; main.js attaches it).
    this.potions?.tick(player, survival);
    this._fireballs?.tick(); // blaze/ghast fireballs (fireballs.js)
    this._skulls?.tick(); // wither skulls (wither-boss-mobs.js)
    this._golemBalls?.tick(); // snow golem snowballs (mooshroom-golem-live.js)
    // WorldServer.tick runs SpawnerAnimals.findChunksForSpawning only while gamerule doMobSpawning is true; no monsters on Peaceful.
    const hostile = this.difficulty !== PEACEFUL && gameRule("doMobSpawning");
    if (this.world.dimension) {
      // A natural monster can leave the working set before its normal
      // despawn tick. Apply the distance check to those actors as well.
      this.entities = this.entities.filter(e => !e.naturalDimensionSpawn || e.persistent ||
        (player.x - e.x) ** 2 + (player.y - e.y) ** 2 + (player.z - e.z) ** 2 <= 128 ** 2);
      if (hostile && survival.health > 0) {
        const rand = (this.worldRandom ??= new JavaRandom(Math.floor(this.random() * 2 ** 48)));
        spawnDimensionMonsters(this, player, rand, this.spawnerHooks({ limit: 256, lightValue: this.dimensionBlockLight }), HOSTILE);
      }
    }
    if (!this.world.dimension) {
    ocelotSpawnPass(this, player, survival, gameRule("doMobSpawning")); // SpawnerAnimals for the jungle's ocelots (ocelot-spawn.js)
    squidBatSpawnPass(this, player, survival, gameRule("doMobSpawning")); // water and ambient creatures spawn on Peaceful too
    }
    if (
      night && hostile &&
      !survival.creative &&
      this.spawnClock >= 200 &&
      this.entities.filter((e) => e.type === "zombie").length < 5
    ) {
      this.spawnClock = 0;
      for (let i = 0; i < 16; i++) {
        const a = hash(i, survival.time, this.world.numericSeed) * Math.PI * 2,
          x = Math.floor(player.x + Math.sin(a) * 24),
          z = Math.floor(player.z + Math.cos(a) * 24);
        if (this.world.streaming ? !this.world.isTicking(x,z) : x < 2 || z < 2 || x > SIZE - 2 || z > SIZE - 2) continue;
        const y = this.world.surface(x, z);
        if (this.world.get(x, y - 1, z) !== 1) continue;
        this.spawnNatural("zombie", x + 0.5, y, z + 0.5);
        break;
      }
    }
    // Skeletons come out at night with the zombies, on their own timer and cap (the
    // original rolls both from one spawn pass over lit-dark cells within 24 to 128
    // blocks; this build keeps its simpler ring around the player).
    this.skeletonClock = (this.skeletonClock || 0) + 1;
    if (
      night && hostile &&
      !survival.creative &&
      this.skeletonClock >= 240 &&
      this.entities.filter((e) => e.type === "skeleton").length < 3
    ) {
      this.skeletonClock = 0;
      for (let i = 0; i < 16; i++) {
        const a = hash(i + 100, survival.time, this.world.numericSeed) * Math.PI * 2,
          x = Math.floor(player.x + Math.sin(a) * 24),
          z = Math.floor(player.z + Math.cos(a) * 24);
        if (this.world.streaming ? !this.world.isTicking(x,z) : x < 2 || z < 2 || x > SIZE - 2 || z > SIZE - 2) continue;
        const y = this.world.surface(x, z);
        if (this.world.get(x, y - 1, z) !== 1) continue;
        this.spawnNatural("skeleton", x + 0.5, y, z + 0.5);
        break;
      }
    }
    this.spiderClock = (this.spiderClock || 0) + 1;
    if (night && hostile && !survival.creative && this.spiderClock >= 260 && this.entities.filter(e => e.type === "spider").length < 3) {
      this.spiderClock = 0;
      for (let i = 0; i < 16; i++) {
        const a = hash(i + 200, survival.time, this.world.numericSeed) * Math.PI * 2,
          x = Math.floor(player.x + Math.sin(a) * 24), z = Math.floor(player.z + Math.cos(a) * 24);
        if (this.world.streaming ? !this.world.isTicking(x,z) : x < 2 || z < 2 || x > SIZE - 2 || z > SIZE - 2) continue;
        const y = this.world.surface(x, z), t = ENTITY_TYPES.spider;
        if (this.world.get(x, y - 1, z) !== 1 || actorCollides(this.world, x + 0.5, y, z + 0.5, t.width, t.height)) continue;
        this.spawnNatural("spider", x + 0.5, y, z + 0.5);
        break;
      }
    }
    // Witches are in the default monster list (weight 5, groups of 1); this build rolls them on the same night ring at a low rate
    // (witch.md: not the weighted SpawnerAnimals pass).
    this.witchClock = (this.witchClock || 0) + 1;
    if (night && hostile && !survival.creative && this.witchClock >= 600 && this.entities.filter((e) => e.type === "witch").length < 1) {
      this.witchClock = 0;
      for (let i = 0; i < 16; i++) {
        const a = hash(i + 300, survival.time, this.world.numericSeed) * Math.PI * 2,
          x = Math.floor(player.x + Math.sin(a) * 24), z = Math.floor(player.z + Math.cos(a) * 24);
        if (this.world.streaming ? !this.world.isTicking(x,z) : x < 2 || z < 2 || x > SIZE - 2 || z > SIZE - 2) continue;
        const y = this.world.surface(x, z), t = ENTITY_TYPES.witch;
        if (this.world.get(x, y - 1, z) !== 1 || actorCollides(this.world, x + 0.5, y, z + 0.5, t.width, t.height)) continue;
        this.spawnNatural("witch", x + 0.5, y, z + 0.5);
        break;
      }
    }
    endermanSpawn(this, player, survival, night && hostile, { actorCollides, SIZE, ENTITY_TYPES });
    // Creepers: the same night ring as the skeletons, with their own clock and cap.
    this.creeperClock = (this.creeperClock || 0) + 1;
    if (night && hostile && !survival.creative && this.creeperClock >= 250 && this.entities.filter((e) => e.type === "creeper").length < 3) {
      this.creeperClock = 0;
      for (let i = 0; i < 16; i++) {
        const a = hash(i + 300, survival.time, this.world.numericSeed) * Math.PI * 2,
          x = Math.floor(player.x + Math.sin(a) * 24), z = Math.floor(player.z + Math.cos(a) * 24);
        if (this.world.streaming ? !this.world.isTicking(x,z) : x < 2 || z < 2 || x > SIZE - 2 || z > SIZE - 2) continue;
        const y = this.world.surface(x, z), t = ENTITY_TYPES.creeper;
        if (this.world.get(x, y - 1, z) !== 1 || actorCollides(this.world, x + 0.5, y, z + 0.5, t.width, t.height)) continue;
        this.spawnNatural("creeper", x + 0.5, y, z + 0.5);
        break;
      }
    }
    this.slimeSpawn(player, survival, hostile);
    // A mob spawned during the loop (a baby) joins the next tick's updates, as World.spawnEntityInWorld queues it.
    for (const e of this.entities.slice()) {
      if (!entityActive(this.world,e)) continue;
      // World.updateEntityWithOptionalForce and EntityLivingBase.onEntityUpdate
      // keep last tick's state for RenderManager and RendererLivingEntity.
      e.px = e.x;
      e.py = e.y;
      e.pz = e.z;
      e.prevRotationYaw = e.rotationYaw;
      e.prevRenderYawOffset = e.renderYawOffset;
      e.prevRotationYawHead = e.rotationYawHead;
      e.prevRotationPitch = e.rotationPitch;
      e.prevLimbSwingAmount = e.limbSwingAmount;
      const base=ENTITY_TYPES[e.type],scale=mobScale(e),t={...base,width:base.width*scale,height:base.height*scale};
      if (e.type === "ender_dragon") { dragonUpdate(this, e, player, survival); continue; } // EntityDragon (dragon-mobs.js)
      if (e.type === "ender_crystal") { if (e.health > 0) crystalUpdate(this, e); continue; } // EntityEnderCrystal.onUpdate: fire in the End, nothing else
      // EntityMob.onUpdate (yg.h): on Peaceful the mob is setDead, with no death or drops.
      if (HOSTILE.has(e.type) && this.difficulty === PEACEFUL) {
        e.health = 0;
        e.death = 20;
        continue;
      }
      if (e.health <= 0) {
        // Entity.onEntityUpdate still runs the fire (attackEntityFrom refuses the hits).
        this.burn(e, t);
        e.hurt = Math.max(0, e.hurt - 1);
        this.dying(e, t);
        continue;
      }
      // EntityCreeper.onUpdate (xz.h) runs its fuse before EntityLivingBase.onUpdate. The
      // explosion is main.js's; func_146077_cc passes gamerule mobGriefing as isSmoking (block
      // damage). The creeper is gone without drops.
      if (e.type === "creeper") {
        const out = creeperTick(e);
        if (out.sound) this.events.push({ sound: out.sound.name, volume: out.sound.volume, pitch: out.sound.pitch, position: { x: e.x, y: e.y, z: e.z } });
        if (out.explode) {
          this.events.push({ explode: { ...out.explode, source: e, smoking: gameRule("mobGriefing") } });
          e.health = 0;
          e.death = 20;
          continue;
        }
      }
      // EntityZombie.onUpdate (yq.h): a converting zombie counts its timer down before EntityLivingBase.onUpdate.
      if (e.conversionTime !== undefined && this.tickConversion(e)) continue;
      e.age++;
      if(e.growingAge<0&&e.type!=='zombie')e.growingAge++;else if(e.growingAge>0)e.growingAge--;
      e.love=Math.max(0,e.love-1);
      // The inLove countdown's hearts (every 10 ticks) run on the server's copy only: the
      // client never learns inLove, so 1.7.10 singleplayer shows none.
      e.attack = Math.max(0, e.attack - 1);
      e.flee = Math.max(0, e.flee - 1);
      // EntityLivingBase.onEntityUpdate: the revenge target lapses after 100 ticks.
      if (e.revenge && e.age + 1 - e.revenge > 100) e.revenge = 0;
      const wasInWater = e.inWater;
      if (e.inWater = inWater(this.world, e, t.width, t.height)) e.fallDistance = 0;
      // Entity.handleWaterMovement: entering water (not on the entity's first update, when
      // inWater is still unset) splashes. EntityMob plays the hostile sound.
      if (e.inWater && wasInWater === false) {
        const s = enterWater(this.fx, { x: e.x, z: e.z, minY: e.y, width: t.width, mx: e.vx, my: e.vy, mz: e.vz }, entityRandom(e));
        this.events.push({ sound: HOSTILE.has(e.type) ? "game.hostile.swim.splash" : "game.neutral.swim.splash", volume: s.volume, pitch: s.pitch, position: { x: e.x, y: e.y, z: e.z } });
      }
      this.burn(e, t);
      // Entity.onEntityUpdate: below posY -64, kill(), which EntityLivingBase makes
      // attackEntityFrom(outOfWorld, 4): no armour, the hurt window applies.
      if (e.y < -64 && e.health > 0) this.hazard(e, 4, "outOfWorld");
      this.suffocate(e, t);
      if (e.type !== "squid") this.breathe(e, t); // EntityWaterMob.onEntityUpdate handles the squid's air
      // EntityLivingBase.onEntityUpdate after the fire and air: hurtTime and
      // hurtResistantTime run down, a mob at 0 health goes on to onDeathUpdate (a mob the
      // fire or water killed counts its first death tick now), then recentlyHit runs down.
      e.hurt = Math.max(0, e.hurt - 1);
      if (e.health <= 0) {
        this.dying(e, t);
        continue;
      }
      if (e.recentlyHit > 0) e.recentlyHit--;
      // EntityLivingBase.updatePotionEffects, the end of onEntityUpdate.
      tickMobEffects(e, t, base.health, entityRandom(e), this.fx);
      this.talk(e);
      if (e.type === "squid" || e.type === "bat") { squidBatUpdate(this, e, t); continue; } // squid-bat-mobs.js
      if (e.type === "ghast") { ghastUpdate(this, e, t); continue; } if (e.type === "blaze") blazeUpdate(this, e, t); // blaze-ghast-mobs.js
      if (e.type === "wither") witherUpdate(this, e, t); // wither-boss-mobs.js
      // EntityZombie and EntitySkeleton.onLivingUpdate (yq.e, yl.e), before the AI: in daylight
      // a mob (a zombie only when adult) at brightness > 0.5 with rand.nextFloat() * 30 <
      // (brightness - 0.4) * 2 under open sky is set on fire for 8 s; burn() takes the damage,
      // water or rain puts it out. None wears a helmet here.
      if (((e.type === "zombie" && e.growingAge >= 0) || e.type === "skeleton") && this.day) {
        const bx = Math.floor(e.x), by = Math.floor(e.y + t.height * 0.66), bz = Math.floor(e.z),
          light = this.ai.brightness(bx, by, bz);
        if (light > 0.5 && f(entityRandom(e).nextFloat() * 30) < f(f(light - f(0.4)) * 2) && this.ai.deps.canSeeSky(bx, Math.floor(e.y), bz)) e.fire = Math.max(e.fire || 0, 160);
      }
      // EntityLiving.onLivingUpdate runs the AI (ai.js) between the motion snap and the
      // jump/move: tasks, navigator, move/look/jump helpers.
      if (e.type === "witch") this.witchUpdate(e, t);
      if (e.type === "pigman") pigmanTick(this, e, entityRandom(e));
      if (isSlimeLike(e)) this.slimeTick(e, t);
      else {
        if (e.type === "enderman") endermanTick(this, e, entityRandom(e));
        this.walk(e, t, 0, () => e.type === "horse" && e.rider ? horseRideThink(this, e) : isSpider(e.type) ? this.spiderThink(e) : e.type === "pigman" ? pigmanThink(this, e) : e.type === "silverfish" ? this.silverfishThink(e) : this.ai.think(e));
      }
      this.push(e, t);
      if (isSpider(e.type)) {
        e.climbing = e.collidedH;
      }
      if (e.type === "chicken") this.chickenUpdate(e);
      if (e.type === "wolf") this.wolfUpdate(e, t);
      if (e.type === "ocelot") { const b = this.ai.brain(e); if (b.attackTarget && !b.attackTarget.alive) b.attackTarget = null; }
      if (e.type === "snow_golem") this.snowGolemUpdate(e, e.inWater || !!this.wet?.(e, t.height));
      if (e.type === "horse") this.horseTick(e);
      if (e.leash) this.leashTick(e); // horse-gear-live.js: EntityLiving.updateLeashedState
      if (e.type === "wither") witherPost(this, e, t); // wither-boss-mobs.js: the side heads turn
      this.turnBody(e);
      this.swingLimbs(e);
    }
    // EntityPlayerMP.onLivingUpdate's collideWithNearbyEntities, in the network tick after the
    // world's entities: each mob beside the player is pushed away once more (the server's copy
    // of the player is pushed too, which the client never sees).
    const p = this.ai.player;
    if (p?.alive) {
      const box = pushBox(p, p.width, p.height), near = [box[0] - 0.2, box[1], box[2] - 0.2, box[3] + 0.2, box[4], box[5] + 0.2];
      for (const o of this.entities) if (pushable(o) && boxesMeet(near, pushBox(o, ...this.size(o)))) applyEntityCollision(o, p, true, false);
    }
    this.entities = this.entities.filter((e) => e.health > 0 || e.death < 20);
  }
  // A dying mob: onDeathUpdate, recentlyHit running down, then onLivingUpdate with its movement
  // blocked (sv.bh): it slides on its knockback, falls and is pushed, with no AI input.
  dying(e, t) {
    this.deathUpdate(e, t);
    if (e.recentlyHit > 0) e.recentlyHit--;
    e.jumping = false;
    this.walk(e, t, 0);
    this.push(e, t);
    if (e.type === "chicken") this.chickenUpdate(e);
    this.swingLimbs(e);
  }
  size(o) {
    const base = ENTITY_TYPES[o.type], s = mobScale(o);
    return [base.width * s, base.height * s];
  }
  // EntityLivingBase.collideWithNearbyEntities (sv.bo), the end of onLivingUpdate on the
  // server: every pushable entity (living mobs until setDead, and the player) whose box meets
  // this one's grown by 0.2 sideways runs applyEntityCollision against it.
  push(e, t) {
    const box = pushBox(e, t.width, t.height), near = [box[0] - 0.2, box[1], box[2] - 0.2, box[3] + 0.2, box[4], box[5] + 0.2];
    for (const o of this.entities)
      if (o !== e && pushable(o) && boxesMeet(near, pushBox(o, ...this.size(o)))) applyEntityCollision(o, e);
    const p = this.ai.player;
    if (p?.alive && boxesMeet(near, pushBox(p, p.width, p.height))) applyEntityCollision(p, e, false, true);
  }
  // Motion half of EntityLivingBase.onLivingUpdate (sv.e()): jump delay, motion
  // below 0.005 snapped to 0, EntityMoveHelper (tv.c) turning a move target into
  // aiMoveSpeed and moveForward (zeroed when idle), the jump (0.04 in water, else
  // jump() on the ground every 10 ticks), moveForward x 0.98, then
  // moveEntityWithHeading. `think` is the AI step (ai.js: tasks, navigator and the three
  // helpers, which set moveForward, aiMoveSpeed, the yaw and the jump); without it
  // `speed` is the setAIMoveSpeed value or 0.
  walk(e, t, speed, think) {
    if (e.jumpTicks > 0) e.jumpTicks--;
    if (Math.abs(e.vx) < 0.005) e.vx = 0;
    if (Math.abs(e.vy) < 0.005) e.vy = 0;
    if (Math.abs(e.vz) < 0.005) e.vz = 0;
    e.moveForward = 0;
    if (think) think();
    else if (speed > 0) e.aiMoveSpeed = e.moveForward = speed;
    if (e.jumping) {
      if (e.inWater || e.inLava) e.vy += 0.03999999910593033;
      else if (e.onGround && e.jumpTicks === 0) {
        jump(e);
        e.jumpTicks = 10;
      }
    } else e.jumpTicks = 0;
    e.moveForward = f(e.moveForward * f(0.98));
    if (e.moveStrafing) e.moveStrafing = f(e.moveStrafing * f(0.98)); // EntitySlime strafes (moveStrafing x 0.98)
    this.moveWith(e, t, e.moveForward);
  }
  // EntityLivingBase.moveEntityWithHeading(strafe, forward) with this engine's tails; walk() runs it once a tick and
  // EntityAIControlledByPlayer (ai.js, pig-saddle.js) once more from inside the AI.
  moveWith(e, t, forward) {
    // moveEntity's tail: cactus and fire (inFire) damage, webs, the fire counter and the rain fizz.
    const self = this, hooks = {
      living: true,
      hurt: (source, points) => this.hazard(e, points, source),
      get wet() { return e.inWater || !!self.wet?.(e, t.height); },
      fizz: () => this.events.push({ sound: "random.fizz", volume: 0.7, pitch: f(1.6 + f(f(this.random() - this.random()) * 0.4)), position: { x: e.x, y: e.y, z: e.z } }),
    };
    const from = { x: e.x, y: e.y, z: e.z };
    const landed = moveEntityWithHeading(this.world, e, t.width, t.height, forward, hooks);
    // moveEntity's step tail (mob-steps.js): every mob with canTriggerWalking plays its own step event.
    const rand = entityRandom(e);
    this.events.push(...mobStepEvents(this.world, e, from, { hostile: isEntityMob(e.type), random: () => rand.nextFloat() }));
    // The finite world's edge stops a mob like a wall.
    const edge = (axis, v) => {
      const c = Math.max((this.world[axis === "x" ? "minX" : "minZ"] ?? 0)+0.6, Math.min((this.world[axis === "x" ? "maxX" : "maxZ"] ?? SIZE)-0.6, e[axis]));
      if (c !== e[axis]) (e[axis] = c), (e[v] = 0);
    };
    edge("x", "vx");
    edge("z", "vz");
    if (landed > 0) this.onLand?.(e, landed);
    // EntityChicken.fall, EntityBat.fall, EntityOcelot.fall and EntityGolem.fall do nothing.
    if (landed > 0 && e.type !== "chicken" && e.type !== "bat" && e.type !== "ocelot" && e.type !== "snow_golem" && e.type !== "iron_golem" && e.type !== "magma_cube") this.fall(e, landed); // EntityMagmaCube.fall does nothing
  }
  // EntitySlime.onUpdate (ym.h): the squish before and after EntityLivingBase.onUpdate (walk), the landing particles
  // ("slime" is EntityBreakingFX with a slimeball) and sounds, then onCollideWithPlayer. slime.js holds the rules.
  slimeTick(e, t) {
    const rand = entityRandom(e);
    slimeSquishStart(e);
    this.walk(e, t, 0, () => this.slimeThink(e));
    e.slimeForward = e.moveForward;
    e.slimeStrafe = e.moveStrafing || 0;
    slimeSquishEnd(e, rand, (dx, dz) => this.fx?.spawn(isMagma(e) ? MAGMA.particle : "slime", e.x + dx, e.y, e.z + dz, 0, 0, 0), (sound, volume, pitch) => this.events.push({ sound, volume, pitch, position: { x: e.x, y: e.y, z: e.z } }));
    e.yaw = (-e.rotationYaw * Math.PI) / 180;
    // EntityPlayer.collideWithPlayer reaches mobs within the player's box grown 1 block sideways; b_ then needs size > 1,
    // line of sight and distance^2 < (0.6 * size)^2 (centre to centre), and hits for `size`.
    const p = this.ai.player, s = this.ai.survival;
    if (p?.alive && !s.creative && e.health > 0 && slimeTouches(e.size, (p.x - e.x) ** 2 + (p.y - e.y) ** 2 + (p.z - e.z) ** 2, this.ai.brain(e).canSee(p), isMagma(e) || undefined)) this.hitPlayer(e, s);
  }
  // updateEntityActionState (ym.bq): despawnEntity, the closest vulnerable player within 16 as the facing target, the jump timer.
  slimeThink(e) {
    const p = this.ai.player, s = this.ai.survival;
    this.ai.brain(e).despawnEntity();
    const target = this.ai.closestVulnerablePlayer(e, 16) ? { x: p.x, eyeY: p.y + 1.62, z: p.z } : null;
    e.moveForward = e.slimeForward;
    e.moveStrafing = e.slimeStrafe;
    e.aiMoveSpeed = SLIME.speed; // the fixed 0.1 land movement factor
    slimeActionState(e, entityRandom(e), target, (sound, volume, pitch) => this.events.push({ sound, volume, pitch, position: { x: e.x, y: e.y, z: e.z } }));
  }
  // EntitySlime.setDead (ym.B) at the end of the death animation: 2 to 4 children of half the size beside the corpse. The
  // 40 mob limit a save keeps still applies (slime.md Gaps).
  splitSlime(e, rand) {
    for (const k of slimeChildren(rand, e)) {
      if (this.entities.length >= 40) break;
      const child = this.create(e.type, k.x, k.y, k.z);
      Object.assign(child, slimeFields(k.size, this.random));
      for (const key of ["rotationYaw", "prevRotationYaw", "renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead", "bodyHeadYaw"]) child[key] = k.yaw;
      child.yaw = (-k.yaw * Math.PI) / 180;
      this.entities.push(child);
    }
  }
  // EntityPig.onStruckByLightning (wo.a(xh)): the pig is replaced by a zombie pigman (nether-melee-live.js).
  pigStruck(pig) { return pigStrike(this, pig); }
  // EntitySlime.getCanSpawnHere (slime.js) at a slime's position: biome, flat world type, block light, the native chunk and the world
  // seed; `base` is EntityLiving.getCanSpawnHere (collision, liquid) for the caller's world.
  slimeCanSpawn(e, rand, worldTime, base) {
    const world = this.world, x = Math.floor(e.x), y = Math.floor(e.y), z = Math.floor(e.z);
    return slimeCanSpawnHere(rand, e.size, e.y, {
      flat: world.worldType === "flat", difficulty: this.difficulty, biome: world.biomeAt?.(x, z)?.id, worldTime,
      blockLight: () => (this.lightAt ? this.lightAt(x, y, z) : 15), chunkX: (x + (world.originX || 0)) >> 4, chunkZ: (z + (world.originZ || 0)) >> 4, worldSeed: world.javaSeed, base,
    });
  }
  // Slimes: this build rolls EntitySlime.getCanSpawnHere (slime.js: the swamp rule and the slime chunk rule below y 40) for a spot
  // 16 to 32 blocks from the player every 300 ticks with at most 4 slimes alive; the original runs it in SpawnerAnimals'
  // weighted pass (slime.md Gaps). Legacy worlds have no biomes or Java seed: no swamp, no slime chunks.
  slimeSpawn(player, survival, hostile) {
    this.slimeClock = (this.slimeClock || 0) + 1;
    if (!hostile || survival.creative || this.slimeClock < 300 || this.entities.filter((e) => e.type === "slime").length >= SLIME.maxSpawnedInChunk) return;
    this.slimeClock = 0;
    const world = this.world, seed = world.javaSeed, height = world.height ?? HEIGHT, rand = new JavaRandom(Math.floor(Math.random() * 2 ** 48));
    for (let i = 0; i < 16; i++) {
      const a = hash(i + 400, survival.time, world.numericSeed) * Math.PI * 2, d = 16 + hash(i + 500, survival.time, world.numericSeed) * 16,
        x = Math.floor(player.x + Math.sin(a) * d), z = Math.floor(player.z + Math.cos(a) * d);
      if (world.streaming ? !world.isTicking(x, z) : x < 2 || z < 2 || x > SIZE - 2 || z > SIZE - 2) continue;
      // The surface cell, or (in a slime chunk, half the time) the lowest air above a floor in the cave band below y 40.
      let y = world.surface(x, z);
      const cx = (x + (world.originX || 0)) >> 4, cz = (z + (world.originZ || 0)) >> 4;
      if (seed !== undefined && isSlimeChunk(seed, cx, cz) && rand.nextInt(2) === 0) {
        for (let yy = Math.min(39, y - 1); yy > 5; yy--) if (!world.solid(x, yy, z) && !world.solid(x, yy + 1, z) && world.solid(x, yy - 1, z)) { y = yy; break; }
      }
      const e = this.create("slime", x + 0.5, y, z + 0.5), t = ENTITY_TYPES.slime, w = mobScale(e) * t.width, h = mobScale(e) * t.height;
      const ok = this.slimeCanSpawn(e, rand, survival.time, () => y >= 0 && y < height && world.solid(x, y - 1, z) && !isLiquid(world.get(x, y, z)) && !actorCollides(world, x + 0.5, y, z + 0.5, w, h));
      if (!ok) { this.nextId--; continue; }
      this.onSpawnWithEgg(e);
      this.entities.push(e);
      break;
    }
  }
  // Spider keeps EntityCreature's legacy aggression/leap rules. Navigation reuses
  // the existing bounded PathFinder; its refresh/wander timing remains adapted.
  spiderThink(e) {
    const m = this.ai.brain(e), p = this.ai.player, s = this.ai.survival;
    const height = ENTITY_TYPES[e.type].height, light = this.ai.brightness(Math.floor(e.x), Math.floor(e.y + height * 0.66), Math.floor(e.z));
    const distance = Math.sqrt(m.distSq(p));
    e.idle = (e.idle || 0) + 1 + (light > 0.5 ? 2 : 0);
    m.despawnEntity();
    m.senseCache.clear();
    if (!p.alive || s.creative) {
      if (e.spiderTarget) m.navigator.clearPathEntity();
      e.spiderTarget = false;
    } else if (e.revenge && e.revenge !== e.spiderRevenge) {
      e.spiderRevenge = e.revenge;
      e.spiderTarget = true;
    } else if (!e.spiderTarget && this.ai.closestVulnerablePlayer(e, 16) && spiderFindsPlayer(light)) e.spiderTarget = true;
    if (e.spiderTarget) {
      m.attackTarget = p;
      if (m.canSee(p)) {
        const result = spiderAttack(e, p, distance, light, this.random, height);
        if (result === "forget") { e.spiderTarget = false; m.navigator.clearPathEntity(); }
        else if (result === "hit") this.hitPlayer(e, s);
      }
      if (e.spiderTarget) {
        if (e.age % 10 === 0 || m.navigator.noPath()) m.navigator.tryMoveToEntityLiving(p, 1);
        m.lookHelper.setLookPositionWithEntity(p, 30, 30);
        // The legacy path cannot climb vertically; continue pushing toward the
        // target when a wall stops the path, which sets the spider's ladder flag.
        if (m.navigator.noPath() || e.climbing) m.moveHelper.setMoveTo(p.x, e.y, p.z, 1);
      }
    } else {
      m.attackTarget = null;
      if (e.age % 80 === 0) {
        const a = this.random() * Math.PI * 2;
        m.navigator.tryMoveToXYZ(e.x + Math.sin(a) * 6, e.y, e.z + Math.cos(a) * 6, 1);
      }
    }
    m.navigator.onUpdateNavigation();
    m.moveHelper.onUpdateMoveHelper();
    m.lookHelper.onUpdateLook();
    m.jumpHelper.doJump();
    e.yaw = -e.rotationYaw * Math.PI / 180;
  }
  // EntitySilverfish.attackEntityFrom (yk.a): an entity or magic source arms the 20 tick summon cooldown.
  silverfishHurt(e, source) {
    const name = source.name ?? "generic", entity = !!(source.player || source.attacker || name === "mob" || name === "thorns");
    e.summonCooldown = hurtSummon(e.summonCooldown ?? 0, { entity, type: name });
  }
  // The legacy AI fields of one silverfish (silverfish.js): kept off the saved record.
  silverfishState(e) {
    let st = this.fishStates.get(e);
    if (!st) this.fishStates.set(e, (st = { ...silverfishFields(), persistent: false }));
    return st;
  }
  // Adds a silverfish at the centre of a block cell (BlockSilverfish.onBlockDestroyedByPlayer /
  // dropBlockAsItemWithChance spawnEntityInWorld at x + 0.5, y, z + 0.5, yaw 0). The save keeps 40 mobs.
  spawnSilverfishAt(x, y, z) {
    if (this.entities.length >= 40) return null;
    const at = eggSpawn(x, y, z), e = this.create("silverfish", at.x, at.y, at.z);
    for (const k of ["rotationYaw", "prevRotationYaw", "renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead", "bodyHeadYaw"]) e[k] = at.yaw;
    e.yaw = 0;
    this.entities.push(e);
    return e;
  }
  // EntitySilverfish.updateEntityActionState through EntityCreature's legacy flow (silverfish.js), with the
  // live PathFinder, world, player and sound services. The fixed-seed ground truth is silverfish-reference.json.
  silverfishThink(e) {
    const m = this.ai.brain(e), p = this.ai.player, s = this.ai.survival, st = this.silverfishState(e), t = ENTITY_TYPES.silverfish;
    st.x = e.x; st.y = e.y; st.z = e.z; st.width = t.width; st.inWater = e.inWater; st.inLava = e.inLava;
    st.collidedH = e.collidedH; st.rotationYaw = e.rotationYaw; st.rotationPitch = e.rotationPitch || 0;
    st.summonCooldown = e.summonCooldown ?? 0; st.jumping = false;
    if (st.attackTime > 0) st.attackTime--;
    m.senseCache.clear();
    const world = this.world, rand = entityRandom(e), cell = (x, y, z) => { this.events.push({ blockEdit: [[x, y, z]] }); };
    const path = (make) => (m.navigator.spend() ? make(m.navigator.finder()) : null);
    const env = {
      rand, remote: false, get mobGriefing() { return gameRule("mobGriefing"); },
      closestPlayer: (me, range) => (p?.alive && (range < 0 || m.distSq(p) < range * range) ? p : null),
      findPlayerToAttack: (me) => this.ai.closestVulnerablePlayer(me, 8),
      isAlive: (x) => (x === p ? !!p.alive : true),
      isCreative: () => !!s.creative,
      eyeHeight: (x) => (x === st ? f(f(t.height) * f(0.85)) : 1.62),
      boxMidY: (x) => x.y,
      canSee: (me, target) => m.canSee(target),
      attackEntity: (me, target, d) => {
        if (attackReady({ y: me.y, attackTime: me.attackTime }, target.y, target.y + 1.8, d)) {
          me.attackTime = 20;
          this.hitPlayer(e, s);
        }
      },
      pathToEntity: (me, target, range) => path((fn) => fn.createEntityPathToEntity(m, target, range)),
      pathToBlock: (me, x, y, z, range) => path((fn) => fn.createEntityPathToBlock(m, x, y, z, range)),
      pathWeight: (me, x, y, z) => silverfishPathWeight(world.get(x, y - 1, z), this.ai.brightness(x, y, z)),
      getBlock: (x, y, z) => world.get(x, y, z),
      getMeta: (x, y, z) => world.getMeta(x, y, z),
      setBlock: (x, y, z, id, meta) => { world.set(x, y, z, id, true, meta); cell(x, y, z); },
      // World.func_147480_a(x, y, z, false): the block goes without drops, with its break effects (level event 2001).
      breakBlock: (x, y, z) => {
        const block = world.get(x, y, z);
        world.set(x, y, z, 0);
        this.events.push({ blockEdit: [[x, y, z]], blockBreak: { x, y, z, block } });
      },
      releaseEgg: (x, y, z) => { this.spawnSilverfishAt(x, y, z); },
      explosionParticle: () => {
        if (this.fx) burst(this.fx, "explode", 20, { x: e.x, y: e.y, z: e.z, width: t.width, height: t.height }, new JavaRandom(Math.floor(Math.random() * 2 ** 48)));
      },
      setDead: () => this.ai.despawn(e),
    };
    silverfishActionState(st, env);
    e.rotationYaw = st.rotationYaw; e.rotationPitch = st.rotationPitch;
    e.moveForward = st.moveForward; e.jumping = st.jumping; e.summonCooldown = st.summonCooldown;
    e.yaw = (-e.rotationYaw * Math.PI) / 180;
  }
  // The chicken half of EntityChicken.onLivingUpdate (wg.e()), run after the shared
  // movement: the previous wing values are kept, destPos moves 0.3 x (-1 on the
  // ground, else 4) within [0, 1], wingRotDelta (bt) snaps up to 1 in the air and
  // decays by 0.9, a falling chicken keeps 0.6 of its downward motion, and
  // wingRotation advances by twice wingRotDelta. An adult that is not a jockey counts
  // timeUntilNextEgg down and, at 0, plays mob.chicken.plop (volume 1, pitch
  // (rand - rand) * 0.2 + 1), drops one egg (entityDropItem(egg, 0)) and rolls
  // 6000 + rand.nextInt(6000) again.
  chickenUpdate(e) {
    e.oFlap = e.wingRotation;
    e.oFlapSpeed = e.destPos;
    e.destPos = f(e.destPos + (e.onGround ? -1 : 4) * 0.3);
    if (e.destPos < 0) e.destPos = 0;
    if (e.destPos > 1) e.destPos = 1;
    if (!e.onGround && e.wingRotDelta < 1) e.wingRotDelta = 1;
    e.wingRotDelta = f(e.wingRotDelta * 0.9);
    if (!e.onGround && e.vy < 0) e.vy *= 0.6;
    e.wingRotation = f(e.wingRotation + f(e.wingRotDelta * 2));
    if (e.growingAge >= 0 && --e.eggTimer <= 0) {
      const r = this.random, pitch = f(f(f(r() - r()) * f(0.2)) + 1);
      this.events.push({ sound: "mob.chicken.plop", volume: 1, pitch, position: { x: e.x, y: e.y, z: e.z } });
      this.events.push({ drop: EGG, count: 1, position: { x: e.x, y: e.y, z: e.z } });
      e.eggTimer = Math.floor(r() * 6000) + 6000;
    }
  }
  // EntityWolf.onUpdate and onLivingUpdate's wet shake (wolf.js updateWolf), then its effects: the shake sound
  // (0.4 volume, pitch (r - r) * 0.2 + 1) and the splash particles of the shaking fur.
  wolfUpdate(e, t) {
    const rand = entityRandom(e), brain = this.ai.brain(e);
    // The AI half of the wolf's tick: a target that died is dropped.
    if (brain.attackTarget && !brain.attackTarget.alive) brain.attackTarget = null;
    const out = updateWolf(e, { inWater: !!e.inWater, onGround: !!e.onGround, hasPath: !brain.navigator.noPath(), rand });
    if (out.shakeSound) this.events.push({ sound: WOLF_SOUNDS.shake, volume: WOLF_SOUNDS.volume, pitch: f(f(f(rand.nextFloat() - rand.nextFloat()) * f(0.2)) + 1), position: { x: e.x, y: e.y, z: e.z } });
    for (let i = 0; i < out.splashes; i++) {
      const dx = f(f(f(f(rand.nextFloat() * 2) - 1) * t.width) * f(0.5)), dz = f(f(f(f(rand.nextFloat() * 2) - 1) * t.width) * f(0.5));
      this.fx?.spawn("splash", e.x + dx, e.y + out.splashHeight, e.z + dz, e.vx, e.vy, e.vz);
    }
  }
  // EntityWolf.interact (wv.a(yz)) for the player holding `survival.held` (wolf.js interact): bones tame, meat heals or
  // breeds, dye recolours the collar, anything else lets the owner toggle sitting. Returns whether the click was used.
  wolfInteract(e, survival) {
    if (e.type !== "wolf" || e.health <= 0 || !this.entities.includes(e)) return false;
    const stack = survival.held, held = stack ? { id: stack.id, damage: stack.damage || 0, count: stack.count || 1 } : null;
    const creative = !!survival.creative, rand = entityRandom(e), box = { x: e.x, y: e.y, z: e.z, width: ENTITY_TYPES.wolf.width, height: ENTITY_TYPES.wolf.height };
    const out = wolfClick(e, held, wolfTamed(e), creative, rand), brain = this.ai.brain(e);
    const take = (n) => { if (n > 0 && !creative) survival.inventory.decr(survival.inventory.current, n); };
    take(out.consume);
    if (out.tamed || out.sitToggle) { brain.navigator.clearPathEntity(); brain.attackTarget = null; }
    // EntityTameable.func_70908_e: 7 hearts after taming (status 7) or 7 smoke after a failed bone (status 6).
    if (out.status && this.fx) burst(this.fx, out.status === 7 ? "heart" : "smoke", 7, box, rand, 0.5);
    if (out.love) {
      // EntityAnimal.interact: an adult not in love is put in love and the meat is used up; a puppy grows by a tenth
      // of its remaining time instead.
      if (e.growingAge === 0 && e.love <= 0) {
        e.love = 600;
        take(1);
        if (this.fx) burst(this.fx, "heart", 7, box, rand, 0.5);
      } else if (e.growingAge < 0) {
        take(1);
        e.growingAge = Math.min(0, e.growingAge + Math.trunc(f(f(-e.growingAge / 20) * f(0.1))) * 20);
      } else out.handled = false;
    }
    // The probe's recorded result is false for a sit toggle (the original returns true on a server); the click is used.
    return out.handled || !!out.sitToggle;
  }
  // EntityOcelot.interact (wn.a(yz)) for the player holding `survival.held` (ocelot.js interact): raw fish tame a tempted
  // wild ocelot (1 in 3), breed a cat, and the owner's other clicks sit it. Returns whether the click was used.
  ocelotInteract(e, survival) {
    if (e.type !== "ocelot" || e.health <= 0 || !this.entities.includes(e)) return false;
    const stack = survival.held, held = stack ? { id: stack.id, damage: stack.damage || 0, count: stack.count || 1 } : null;
    const creative = !!survival.creative, rand = entityRandom(e), box = { x: e.x, y: e.y, z: e.z, width: ENTITY_TYPES.ocelot.width, height: ENTITY_TYPES.ocelot.height };
    const brain = this.ai.brain(e), p = this.ai.player, worldRand = (this.worldRandom ??= new JavaRandom(Math.floor(Math.random() * 2 ** 48)));
    const out = ocelotClick(e, held, { isOwner: ocelotTamed(e), creative, tempting: !!brain.temptRunning?.(), distSq: brain.distSq(p), rand, worldRand });
    const take = (n) => { if (n > 0 && !creative) survival.inventory.decr(survival.inventory.current, n); };
    take(out.consume);
    if (out.tamed || out.sitToggle) { brain.navigator.clearPathEntity(); brain.attackTarget = null; }
    // EntityTameable.func_70908_e: 7 hearts after taming (status 7) or 7 smoke after a failed fish (status 6).
    if (out.status && this.fx) burst(this.fx, out.status === 7 ? "heart" : "smoke", 7, box, rand, 0.5);
    if (out.love) {
      // EntityAnimal.interact: an adult not in love is put in love and the fish is used up; a kitten gets nothing.
      if (e.growingAge === 0 && e.love <= 0) {
        e.love = 600;
        take(1);
        if (this.fx) burst(this.fx, "heart", 7, box, rand, 0.5);
      } else out.handled = false;
    }
    return out.handled || out.sitToggle;
  }
  // BlockChest.o: whether a sitting ocelot lies on the chest at (x, y, z) (chest.js openChest asks through World.ocelotOnChest).
  ocelotSitsOn(x, y, z) {
    const w = ENTITY_TYPES.ocelot.width / 2, h = ENTITY_TYPES.ocelot.height;
    return sitsOnChest(this.entities.filter((e) => e.type === "ocelot" && e.health > 0).map((e) => ({ sitting: e.sitting, minX: e.x - w, maxX: e.x + w, minY: e.y, maxY: e.y + h, minZ: e.z - w, maxZ: e.z + w })), x, y, z);
  }
  // EntityBodyHelper.func_75664_a (tr.a), reached through EntityLiving.func_110146_f
  // (sw.f) for AI-enabled mobs; the yaw wraps of EntityLivingBase.onUpdate (sv.h) follow.
  // rotationYaw is set by EntityMoveHelper and the head by EntityLookHelper (ai.js).
  turnBody(e) {
    const dx = e.x - e.px, dz = e.z - e.pz;
    if (dx * dx + dz * dz > 2.500000277905201e-7) {
      e.renderYawOffset = e.rotationYaw;
      e.rotationYawHead = clampYaw(e.renderYawOffset, e.rotationYawHead, 75);
      e.bodyHeadYaw = e.rotationYawHead;
      e.bodyTicks = 0;
    } else {
      let limit = 75;
      if (Math.abs(f(e.rotationYawHead - e.bodyHeadYaw)) > 15) {
        e.bodyTicks = 0;
        e.bodyHeadYaw = e.rotationYawHead;
      } else if (++e.bodyTicks > 10) limit = f(Math.max(f(1 - f(f(e.bodyTicks - 10) / 10)), 0) * 75);
      e.renderYawOffset = clampYaw(e.rotationYawHead, e.renderYawOffset, limit);
    }
    e.prevRotationYaw = nearAngle(e.prevRotationYaw, e.rotationYaw);
    e.prevRenderYawOffset = nearAngle(e.prevRenderYawOffset, e.renderYawOffset);
    e.prevRotationPitch = nearAngle(e.prevRotationPitch, e.rotationPitch);
    e.prevRotationYawHead = nearAngle(e.prevRotationYawHead, e.rotationYawHead);
  }
  // Tail of EntityLivingBase.moveEntityWithHeading (sv.e(FF)): limbSwingAmount
  // eases 0.4 of the way to four times this tick's horizontal travel (cap 1)
  // and limbSwing advances by it. Dying mobs keep running it.
  swingLimbs(e) {
    const dx = e.x - e.px, dz = e.z - e.pz,
      target = Math.min(f(f(Math.sqrt(dx * dx + dz * dz)) * 4), 1);
    e.limbSwingAmount = f(e.limbSwingAmount + f(f(target - e.limbSwingAmount) * f(0.4)));
    e.limbSwing = f(e.limbSwing + e.limbSwingAmount);
  }
  serialize() {
    return this.entities.filter((e) => e.health > 0 || e.type === "ender_dragon" && !e.dragonGone).map((e) => this.serializeOne(e));
  }
  // One saved record (also the record a mob travelling through a portal takes along, dimension-live.js).
  serializeOne(e) {
    const saved = { ...e };
    for (const key of INTERPOLATED) delete saved[key];
    return saved;
  }
  // The sounds each client plays for status 2 and 3 (EntityLivingBase.handleHealthUpdate), apart from the server's.
  drainClientSounds() {
    const sounds = this.clientSounds;
    this.clientSounds = [];
    return sounds;
  }
  drain() {
    const events = this.events;
    this.events = [];
    return events;
  }
}
installMooshroomGolem(EntityWorld); // mooshroom-golem-live.js: shears/bowl, golem construction, snow trail, snowballs
installHorse(EntityWorld); // horse-live.js: interact, ride, tame, rear
installHorseGear(EntityWorld); // horse-gear-live.js: leads, name tags, horse inventory drops
installPigSaddle(EntityWorld); // pig-saddle-live.js: saddles, the pig mount, carrot on a stick
installSquidBat(EntityWorld); // squid-bat-mobs.js: bat wake-up, squid entityAge and silent hurt, bat sound pitch
installDragonMobs(EntityWorld); // dragon-mobs.js: the Ender Dragon type, part damage, save/restore
installFireballMobs(EntityWorld); // blaze-ghast-mobs.js: blaze and ghast types, fire immunity, fireball pick/punch
installWither(EntityWorld); // wither-boss-mobs.js: the Wither type, spawnWither, skulls
