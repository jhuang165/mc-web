import { trackSections } from "./saved-order.js";
import { steerHorseCopy, newHorseAnim, stepHorseCopy } from "./horse-copy.js";
import { EntityIds } from "./entity-ids.js";
import { entityActive } from './streaming-ticks.js';
import { dimensionSpawnList } from "./dimension-spawning.js";
import { findChunksForSpawning, eligibleChunkOrder, ELIGIBLE_CHUNKS } from "./spawner-animals.js";
import { wrapRingEnv } from "./headless-env.js";
import { spawnList, ENTITY_TYPE_OF, maxSpawnedInChunk, creatureTypeOf, WITCH_HUT_MONSTERS } from "./spawn-lists.js";
import { solidTopSurface } from "./doors-panes.js";
import { fleeceColor } from "./population-tail.js";
import { MapGenScatteredFeature } from "./scattered-feature-generator.js";
import { canDespawn, livingEyeHeight } from "./ai.js";
import { gameRule } from "./game-rules.js";
import { spiderDrops, STRING, SPIDER_EYE, isSpider, soundType, caveSpiderPoisonTicks } from "./spider.js";
import { countsAs, boxesIntersect, monsterCanSpawnHere, mobBox, anchoredShrunkBox, SPAWN_BRIGHTNESS, spawnerType } from "./mob-spawner.js";
import { ENDERMAN_HEALTH, ENDERMAN_WIDTH, ENDERMAN_HEIGHT, ENDERMAN_SPEED, ENDERMAN_ATTACK, SPEED_BOOST as ENDERMAN_BOOST, endermanFields, endermanFieldsFrom, SOUNDS as ENDERMAN_SOUNDS, livingSound as endermanLiving } from "./enderman.js";
import { endermanTick, endermanThink, endermanHurt, ENDERMAN_TRANSIENT } from "./enderman-live.js";
import { GIANT, GIANT_SOUNDS, giantPathWeight, giantAttackReady } from "./giant.js";
import { creatureActionState, SILVERFISH, SILVERFISH_SOUNDS, silverfishActionState, legacyFields as silverfishFields, silverfishCanSpawnHere, hurtSummon, attackReady, pathWeight as silverfishPathWeight, eggSpawn } from "./silverfish.js";
import { POISON } from "./status-effects.js";
import { WITHER_SKELETON_STATS, witherHitEffect } from "./wither-skeleton.js";
import {CARROT,zombieRareDrop} from './crops.js';
import { creeperFields, creeperSavedFields, creeperTick, creeperFall, creeperDrops, GUNPOWDER } from "./creeper.js";
import { SIZE, HEIGHT, hash, slipperiness, collisionBoxes as cellCollisionBoxes, normalCube, WOOL, isLiquid, DYE, BLOCKS, PUMPKIN, WATER, LEAVES2 } from "./world.js";
import { isOnLadder, ladderClamp, LADDER_CLIMB } from "./ladders.js";
import { mobStepEvents, isEntityMob } from "./mob-steps.js";
import { setMovingBoxes, movingBoxes } from "./moving-boxes.js";
import { ITEMS } from "./survival.js";
import { weaponEnchantments, arthropodSlowness, javaLikeRandom } from "./enchantment-effects.js";
import { insideOpaqueBlock } from "./suffocation.js";
import { mhSin, mhCos, JavaRandom, skylightSubtracted, celestialAngle } from "./lighting.js";
import { mobKnockbackKick, golemLift } from "./player-knockback.js";
import { enterWater, burst, drownBubbles } from "./fx.js";
import { waterAcceleration, entityWaterBox, inLava, eyeInWater } from "./fluids.js";
import { sheepColor, childColor } from "./sheep.js";
import { sneakEdge, criticalDamage } from "./player-movement.js";
import { MobAI } from "./ai.js";
import { VILLAGER_TYPE, VILLAGER_SOUNDS, villagerFields } from "./villager.js";
import { visualRandom } from "./village-ai.js";
import { IRON_GOLEM_TYPE, IRON_GOLEM_SOUNDS, ironGolemFields, ironGolemShape, golemCollideRetargets, golemTail } from "./iron-golem.js";
import { createVillages, PLAYER_NAME, villageAttacker } from "./village-host.js";
import { SLIME, mobScale, slimeDamage, slimeTouches, slimeFields, slimeFieldsFrom, slimeRestore, slimeWidth, slimeSoundName, slimeVolume, slimeSquishStart, slimeSquishEnd, slimeActionState, slimeChildren, slimeCanSpawnHere, SLIMEBALL } from "./slime.js";
import { isSlimeLike } from "./slime.js";
import { PIGMAN, MAGMA, isPigman, isMagma, magmaDamage, magmaJumpMotion, pigmanEquipment } from "./nether-melee.js";
import { pigmanFields, pigmanFieldsFrom, pigmanHurt, pigmanTick, pigStrike } from "./nether-melee-live.js";
import { isLegacyCreature, legacyThink } from "./legacy-creature.js";
import { SQUID, BAT, squidCanSpawn, batCanSpawn, legacyBodyTurn, squidWet, squidLivingUpdate } from "./squid-bat.js";
import { ENDER_CRYSTAL_TYPE, crystalUpdate, crystalAttack } from "./ender-crystal-mobs.js";
import { installMooshroomGolem } from "./mooshroom-golem-live.js";
import { installHorseGear, gearFieldsFrom } from "./horse-gear-live.js";
import { installPigSaddle } from "./pig-saddle-live.js";
import { HORSE_ENTITY, horseRideThink, horseCanMate, horseSpawn, horseFields, horseFieldsFrom, horseChildFields, installHorse } from "./horse-live.js";
import { hurtSoundName as horseHurtSoundName } from "./horse.js";
import { dragonUpdate, dragonHit, installDragonMobs } from "./dragon-mobs.js";
import { blazeUpdate, blazeThink, ghastUpdate, fireballMobTalk, installFireballMobs } from "./blaze-ghast-mobs.js";
import { witherUpdate, witherPost, witherTalk, witherRanged, installWither } from "./wither-boss-mobs.js";
import { squidBatUpdate, squidBatTalk, installSquidBat } from "./squid-bat-mobs.js";
import { WITCH, WITCH_SOUNDS, witchDrink, witchDamage, ITEM_POTION, potionEffects } from "./witch.js";
import { webMove } from './webs.js';
import { blockCollisions } from "./block-collisions.js";
import { isVehicle, vehicleSize } from "./vehicle-seat.js";
import { newUuid } from "./entity-uuid.js";
import { ownerPresent } from "./owner-links.js";
import { cleanModifiers, modifiedValue, liveAttribute, hasStoredBabyBoost, spawnBonusModifier } from "./mob-attributes.js";
import { mountEntity, releaseDead, freeRider, ridingOrder, beginRidden, endRidden, ridingId, linkRiders, setLocationAndAngles, freeChickenNear, maxHealthOf, OWN_MAX_HEALTH } from "./mob-riding.js";
import { NORMAL, PEACEFUL, attributeValue, spawnBonus, spiderSpawnRolls, zombieSpawnRolls, skeletonSpawnRolls, reinforcementBase, reinforcementChance, REINFORCEMENT_CHARGE, zombieReinforcement, zombieFireOnHit } from "./difficulty.js";
import { readMobEffects, addMobEffect, tickMobEffects, speedModifiers, attackDamage, mobEffect, RESISTANCE, setMaxHealthHook } from "./mob-effects.js";
import { NAUSEA, CURE_NAUSEA_TICKS, AUX_INFECT, AUX_CURE, killConverts, startConversionTicks, conversionBoost, canCure, startConversion, remedySound, auxSound, readZombieVillager } from "./zombie-villager.js";
import { landingEffects, JUMP_BOOST, statusPitchRandom } from "./damage-fx.js";
import { WOLF_WIDTH, WOLF_HEIGHT, WOLF_SPEED, WILD_MAX_HEALTH, TAMED_MAX_HEALTH, WOLF_SOUNDS, wolfFields, wolfFieldsFrom, isTamed as wolfTamed, maxHealth as wolfMaxHealth, tailAngle, interestedAngle, shakeAngle, wetShade, wolfSay, hurtAmount as wolfHurtAmount, attackStrength as wolfAttack, puppyFields, interact as wolfClick, updateWolf } from "./wolf.js";
import { noteRevenge, revengeOf, sourceEntity } from "./revenge-target.js";
import { summonedMobRecord, importedMobType } from "./java-mobs.js";
import { mountMobOnVehicle } from "./vehicle-riders.js";
import { OCELOT_WIDTH, OCELOT_HEIGHT, OCELOT_SPEED, OCELOT_HEALTH, OCELOT_SOUNDS, ocelotFields, ocelotFieldsFrom, isTamed as ocelotTamed, ocelotSay, kittenFields, kittenLitter, interact as ocelotClick, sitsOnChest, canSpawnHere as ocelotCanSpawnHere } from "./ocelot.js";
import { NETHER, providerOf, lightBrightnessTable } from "./dimensions.js";
import { cloneStack, attackBonus, meleeEffects, fallingBlockHelmet, brokenItemDraws, breakSoundPitch } from "./mob-equipment.js";
import { MobTracker } from "./entity-tracker.js";
import { GEAR_TYPES, defaultGear, gearFieldsFrom as mobGearFieldsFrom, toLiveStack, pickUpLoot } from "./mob-equipment-live.js";
import { enchantedDamage, isAbsolute, setMobFire } from "./armor-enchantments.js";
import { mobThornsOnPlayerHit, NO_THORNS_ATTACKER } from "./thorns-live.js";
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
// The client copy's particle draws (feeding hearts); the server stream stays untouched.
const FX_RANDOM = new JavaRandom(Math.floor(Math.random() * 2 ** 48));
export const setEntityRandom = (e, rand) => RANDOMS.set(e, rand);
const TRANSIENT = [...ENDERMAN_TRANSIENT, "inWeb", "onGround", "collidedH", "inWater", "fallDistance", "moveForward", "moveMotion", "aiMoveSpeed", "jumping", "jumpTicks", "lastDamage", "inLava", "anchorBox", "fire", "idle", "revenge", "recentlyHit"];
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
  skeleton: { health: 20, width: 0.6, height: 1.8, movement: 0.25, ai: { wander: 1 }, damage: 2, drop: 0 },
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
  // EntityGiantZombie (ye): an EntityMob 6x the zombie's box, 100 health, speed 0.5, attack 50; legacy AI (giant.js), no drops.
  giant: { health: GIANT.health, width: GIANT.width, height: GIANT.height, movement: GIANT.movement, ai: {}, damage: GIANT.attackDamage, drop: 0 },
  // EntityWitch (yp): 0.6 x 1.8, 26 health, speed 0.25; the potion attack (witch.js, witch-potions.js) replaces melee. Drops in combat.js.
  witch: { health: WITCH.health, width: WITCH.width, height: WITCH.height, movement: WITCH.movement, ai: { wander: 1 }, damage: WITCH.attackDamage, drop: 0 },
  // EntitySlime (ym): 0.6 x 0.6 at size 1, scaled by `size` (mobScale); health and damage are size-based (slime.js), drops in combat.js.
  slime: { health: 1, width: 0.6, height: 0.6, movement: SLIME.speed, ai: {}, damage: 1, drop: 0 },
  // EntityMagmaCube (yf): a slime with its own numbers (nether-melee.js); health, damage and armour follow the size.
  magma_cube: { health: 1, width: 0.6, height: 0.6, movement: f(0.2), ai: {}, damage: 3, drop: 0 },
  // EntityPigZombie (yh): 0.6 x 1.8, 20 health, speed 0.5 (+0.45 while it has a target), attack 5, armour 2; legacy AI (nether-melee-live.js).
  pigman: { health: PIGMAN.health, width: PIGMAN.width, height: PIGMAN.height, movement: PIGMAN.movement, ai: { wander: 1 }, damage: PIGMAN.attackDamage, drop: 0 },
  // EntitySquid (ws) 0.95 x 0.95, 10 health; EntityBat (we) 0.5 x 0.9, 6 health. Legacy motion, no AI tasks (squid-bat.js, squid-bat-mobs.js).
  // EntityEnderCrystal (wz) 2 x 2, 5 health: not a living mob (ender-crystal-mobs.js).
  ender_crystal: ENDER_CRYSTAL_TYPE,
  squid: { health: SQUID.health, width: SQUID.width, height: SQUID.height, movement: 0.10000000149011612, ai: {}, drop: 0 },
  bat: { health: BAT.health, width: BAT.width, height: BAT.height, movement: 0.699999988079071, ai: {}, drop: 0 },
};
// The slime's own sound names and volume depend on its size.
const hurtOf = (e) => (isSlimeLike(e) ? slimeSoundName(e.size) : isPigman(e) ? PIGMAN.sounds.hurt : e.type === "horse" ? horseHurtSoundName(e.horse?.type) : hurtSound(e.type));
const deathOf = (e) => (isSlimeLike(e) ? slimeSoundName(e.size) : isPigman(e) ? PIGMAN.sounds.death : deathSound(e.type));
const volumeOf = (e) => (isSlimeLike(e) ? slimeVolume(e.size) : soundVolume(e.type));
// Fire-immune mobs (Entity.isImmuneToFire): the magma cube and the pigman.
// EntityMob subclasses on EntityCreature.updateEntityActionState (td.bq), whose entityToAttack the port keeps in silverfishState(e).target.
const TARGETS_ATTACKER = new Set(["spider", "cave_spider", "pigman", "silverfish", "blaze", "giant"]);
const fireproof = (e) => e.type === "magma_cube" || e.type === "pigman" || e.type === "wither_skeleton" || e.type === "wither"; // Entity.isImmuneToFire (sa.ae): yl.a(1) sets it for the wither skeleton, the wither's constructor (xc) too
const fireImmune = fireproof;
// EntityMob subclasses: no panic counter, 5 experience, despawning, 0.5 - brightness path weights.
// Classes whose onSpawnWithEgg rolls draw the follow-range spawn bonus themselves (difficulty.js, horse.js) or, for the cave spider, never.
const OWN_SPAWN_BONUS = new Set(["spider", "cave_spider", "zombie", "pigman", "skeleton", "wither_skeleton", "horse", "ender_crystal"]); // the crystal is no EntityLiving
// generic.followRange bases above EntityLiving's 16 (mob-attribute-list.js: Zombie, PigZombie, WitherBoss 40).
const FOLLOW_BASE = new Set(["zombie", "pigman", "wither"]);
export const HOSTILE = new Set(["zombie", "skeleton", "spider", "cave_spider", "creeper", "silverfish", "witch", "slime", "enderman", "magma_cube", "pigman", "wither_skeleton", "giant"]);
// EntityMoveHelper.onUpdateMoveHelper (tv.c) hands EntityLiving.setAIMoveSpeed
// (sw.i) `(float)(speed * movementSpeed)`; sw.i also sets moveForward to it. The
// zombie's "Baby speed boost" (yq.br) is operation 1: base * (1 + 0.5); a Speed effect
// (mob-effects.js) is operation 2.
export function aiMoveSpeed(e, multiplier) {
  // The baby boost counts once, from the child flag or a saved copy (an imported adult keeps it: mob-attributes.js hasStoredBabyBoost).
  // EntityPigZombie inherits EntityZombie.setChild, so a baby pigman carries the boost too (probed interchange `babyBoost`).
  const baby = ((e.type === "zombie" || e.type === "pigman") && e.growingAge < 0) || hasStoredBabyBoost(e) ? [[0.5, 1]] : [];
  const boost = e.type === "enderman" && e.speedBoost ? [[ENDERMAN_BOOST, 0]] : e.type === "pigman" && e.pigTarget ? [[PIGMAN.boost, 0]] : [];
  // EntityWitch: the "Drinking speed penalty" modifier (-0.25, operation 0) while a potion is being drunk.
  const drink = e.type === "witch" && e.drinking ? [[-0.25, 0]] : [];
  // EntityOcelot.updateAITick (wn.bp) calls setSprinting(true) at move speed 1.33; EntityLivingBase.setSprinting adds "Sprinting speed boost" 0.3, operation 2.
  const sprint = e.type === "ocelot" && e.sprinting ? [[0.3, 2]] : [];
  // Saved movementSpeed base and modifiers (an imported Attributes list) apply as well (liveAttribute).
  return f(multiplier * liveAttribute(e, "generic.movementSpeed", e.horse?.speed ?? ENTITY_TYPES[e.type].movement, [...drink, ...baby, ...boost, ...sprint, ...speedModifiers(e)]));
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
const hurtSound = (type) => (type = soundType(type), type === "giant" ? GIANT_SOUNDS.hurt : type === "squid" || type === "snow_golem" ? null : type === "ocelot" ? OCELOT_SOUNDS.hit : type === "enderman" ? ENDERMAN_SOUNDS.hit : type === "silverfish" ? SILVERFISH_SOUNDS.hurt : type === "witch" ? WITCH_SOUNDS.hurt : type === "villager" ? VILLAGER_SOUNDS.hit : type === "iron_golem" ? IRON_GOLEM_SOUNDS.hit : type === "pig" ? "mob.pig.say" : (type === "sheep" || type === "spider" || type === "creeper") ? "mob." + type + ".say" : "mob." + type + ".hurt");
// EntityChicken's death sound is its hurt sound as well.
const deathSound = (type) => (type = soundType(type), type === "giant" ? GIANT_SOUNDS.death : type === "squid" || type === "snow_golem" ? null : type === "ocelot" ? OCELOT_SOUNDS.hit : type === "enderman" ? ENDERMAN_SOUNDS.death : type === "silverfish" ? SILVERFISH_SOUNDS.death : type === "witch" ? WITCH_SOUNDS.death : type === "villager" ? VILLAGER_SOUNDS.death : type === "iron_golem" ? IRON_GOLEM_SOUNDS.death : type === "sheep" ? "mob.sheep.say" : "mob." + type + (type === "cow" || type === "chicken" ? ".hurt" : ".death"));
// Entity.setPosition's box (half width and height in floats) and Entity.canBePushed:
// living entities until setDead (deathTime 20, or removal).
export const pushBox = (o, width, height) => {
  const w = f(f(width) / 2), h = f(height);
  return [o.x - w, o.y, o.z - w, o.x + w, o.y + h, o.z + w];
};
// EntityList names of the spawn eggs whose class is assignable from each ageable mob (ItemMonsterPlacer entity ids).
const AGEABLE_EGG_TYPES = { Pig: ["pig"], Sheep: ["sheep"], Cow: ["cow", "mooshroom"], MushroomCow: ["mooshroom"], Chicken: ["chicken"], Wolf: ["wolf"], Ozelot: ["ocelot"], EntityHorse: ["horse"], Villager: ["villager"] };
const AGEABLE_TYPES = new Set(Object.values(AGEABLE_EGG_TYPES).flat());
export const isAgeable = (type) => AGEABLE_TYPES.has(type);
// Entity.applyEntityCollision(self = mob o, other = the player's server copy, `at` its box position): the mob and the player's motion move apart. `mob` pushes (the
// mob's own collideWithNearbyEntities, the pair self = player, other = mob) when `playerCollides` is false.
function pushServerPlayer(p, o, at = p, playerCollides = false) {
  const m = p.motion, copy = { x: at.x, z: at.z, vx: m.x, vz: m.z };
  if (playerCollides) applyEntityCollision(o, copy); // player.collideWithEntity(o) -> o.applyEntityCollision(player): o is self, the player is other
  else applyEntityCollision(copy, o); // o.collideWithEntity(player) -> player.applyEntityCollision(o): the player is self, o is other
  m.x = copy.vx;
  m.z = copy.vz;
}
export const pushable = (o) => o.type !== "bat" && o.type !== "ender_crystal" && o.type !== "ender_dragon" && (o.health > 0 || (o.death ?? 0) < 20); // EntityBat.canBePushed is false
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
// World.getCollidingBoundingBoxes also gathers entity boxes (Entity.getBoundingBox of EntityBoat). entity-collision.js installs the
// provider; it is only asked for a moving entity `e`, never for the spawn checks.
let entityBoxes = null;
export const setEntityBoxes = (fn) => { entityBoxes = fn; };
// BlockPistonMoving.getCollisionBoundingBoxFromPool boxes (moving-boxes.js, piston-live.js collisionBoxes), set by redstone-runtime.js.
export { setMovingBoxes };
function collisionBoxes(world, b, e) {
  const out = entityBoxes && e ? entityBoxes(b, e) : [];
  out.push(...movingBoxes(b));
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
// Entity.boundingBox persists between ticks natively and moveEntity offsets it, so each tick's posX = (minX + maxX) / 2 carries the box's accumulated
// rounding (a rebuilt x - w/2, x + w/2 box loses it: a 1-ulp x difference per push, amplified to 1e-3 over 300 ticks). The last box is kept per entity
// and reused only while it still sits on the entity's position and size (any teleport or setPosition builds a fresh box, as natively).
const boxes = new WeakMap();
function keptBox(e, w, h) {
  const k = boxes.get(e);
  if (!k || k[1] !== w || k[2] !== h) return null;
  const b = k[0];
  return e.x === (b[0] + b[3]) / 2 && e.y === b[1] && e.z === (b[2] + b[5]) / 2 ? b.slice() : null;
}
// A baby zombie's setSize (EntityZombie.setChild in onSpawnWithEgg) keeps the box's minimum corner, so the first Entity.moveEntity (posX = box centre) moves the
// entity half the size difference towards -x and -z (found in the batch 33 villagefight5 conversion records: a villager converted to a baby zombie moved -0.15 on both axes).
function takeAnchorBox(e) {
  const b = e.anchorBox;
  if (!b) return null;
  delete e.anchorBox;
  return b.slice();
}
// Entity.setSize on a box the entity keeps: the minimum corner stays, and a wider box is nudged back by the growth (moveEntity(oldWidth - width, 0, oldWidth - width); its collisions are not modelled),
// so the centre ends half the growth towards -x and -z. The move has dy 0, so onGround is false until the next real move. EntityHorse resizes its foal this way every tick (horse-live.js).
export function resizeBox(e, w0, h0, w1, h1, world = null) {
  w0 = f(w0); h0 = f(h0); w1 = f(w1); h1 = f(h1);
  const bb = takeAnchorBox(e) ?? keptBox(e, w0, h0) ?? [e.x - w0 / 2, e.y, e.z - w0 / 2, e.x + w0 / 2, e.y + h0, e.z + w0 / 2];
  bb[3] = bb[0] + w1; bb[4] = bb[1] + h1; bb[5] = bb[2] + w1;
  if (w1 > w0) {
    let dx = w0 - w1, dz = dx;
    // With a world the move runs the collision code (b47h foal-wall records, executed): Entity.moveEntity sweeps y (dy 0), then x, then z, each stopped flush by a block box in the way
    // (the step-up attempt of a blocked move on the ground finds a wall too high). Without one the nudge is free.
    if (world) {
      const near = collisionBoxes(world, [bb[0] + dx, bb[1], bb[2] + dz, bb[3], bb[4], bb[5]], e);
      for (const b of near) if (b[4] > bb[1] && b[1] < bb[4] && b[5] > bb[2] && b[2] < bb[5] && b[3] <= bb[0] + 1e-9 && b[3] - bb[0] > dx) dx = b[3] - bb[0];
      bb[0] += dx; bb[3] += dx;
      for (const b of near) if (b[4] > bb[1] && b[1] < bb[4] && b[3] > bb[0] && b[0] < bb[3] && b[5] <= bb[2] + 1e-9 && b[5] - bb[2] > dz) dz = b[5] - bb[2];
      bb[2] += dz; bb[5] += dz;
    } else { bb[0] += dx; bb[3] += dx; bb[2] += dz; bb[5] += dz; }
    e.x = (bb[0] + bb[3]) / 2; e.z = (bb[2] + bb[5]) / 2; e.onGround = false;
  }
  boxes.set(e, [bb, w1, h1]);
}
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
    [dx, dz] = sneakEdge(dx, dz, (ox, oz) => !collisionBoxes(world, [e.x - w / 2 + ox, e.y - 1, e.z - w / 2 + oz, e.x + w / 2 + ox, e.y - 1 + h, e.z + w / 2 + oz], e).length);
  const odx = dx, ody = dy, odz = dz, half = w / 2,
    // An entity that keeps its bounding box (`e.bb`, as Entity.boundingBox) moves that
    // box itself, so its centre carries the same rounding as the original.
    bb = e.bb ? e.bb.slice() : takeAnchorBox(e) ?? keptBox(e, w, h) ?? [e.x - half, e.y, e.z - half, e.x + half, e.y + h, e.z + half],
    start = bb.slice(),
    grow = (box, gx, gy, gz) => [gx < 0 ? box[0] + gx : box[0], gy < 0 ? box[1] + gy : box[1], gz < 0 ? box[2] + gz : box[2], gx > 0 ? box[3] + gx : box[3], gy > 0 ? box[4] + gy : box[4], gz > 0 ? box[5] + gz : box[5]];
  let list = collisionBoxes(world, grow(bb, dx, dy, dz), e);
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
    list = collisionBoxes(world, grow(bb, odx, step, odz), e);
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
  else boxes.set(e, [bb.slice(), w, h]);
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
// EntityBodyHelper.func_75664_a (tr.a) and the angle wraps at the end of EntityLivingBase.onUpdate, on any entity with x, z, px, pz and the
// yaw fields: the live mob (turnBody) and the client's copy (clientBodyTurn).
export function bodyTurn(e) {
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
// The client entity's body turn: EntityLiving.func_110146_f is the body helper for an AI-enabled mob (LEGACY_MOVE lists the others, which use the
// walking-direction turn of EntityLivingBase.func_110146_f), then the same prev-angle wraps.
const CLIENT_LEGACY_TURN = new Set(["ghast", "squid", "ender_dragon"]);
export function clientBodyTurn(c) {
  if (!LEGACY_MOVE.has(c.type) && !CLIENT_LEGACY_TURN.has(c.type)) return bodyTurn(c);
  legacyBodyTurn(c, c.x - c.px, c.z - c.pz);
  c.prevRotationYaw = nearAngle(c.prevRotationYaw, c.rotationYaw);
  c.prevRenderYawOffset = nearAngle(c.prevRenderYawOffset, c.renderYawOffset);
  c.prevRotationPitch = nearAngle(c.prevRotationPitch, c.rotationPitch);
  c.prevRotationYawHead = nearAngle(c.prevRotationYawHead, c.rotationYawHead);
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
// The air part of EntityLivingBase.onEntityUpdate (sv.C): with the eye (posY + getEyeHeight: height * 0.85F, a wolf's 0.8F)
// inside water the air supply drops by 1 (no Respiration, so no draw); at -20 it is set to 0
// and 8 "bubble" from Entity.rand go up around posY. Out of water it is back to 300. Returns
// true when attackEntityFrom(drown, 2) follows.
export function breathe(world, e, height, rand, fx) {
  if (!eyeInWater(world, e.x, e.y + livingEyeHeight(e.type, height), e.z)) {
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
// MathHelper.sin / cos (qh.a / qh.b): the 65536-entry float table, indexed by (int)(f * 10430.378F) (cos: + 16384F) & 65535.
let SIN_TABLE;
const sinTable = () => SIN_TABLE ??= Float32Array.from({ length: 65536 }, (_, i) => Math.sin((i * Math.PI * 2) / 65536));
const mathHelperSin = (r) => sinTable()[Math.trunc(f(r * f(10430.378))) & 65535];
const mathHelperCos = (r) => sinTable()[Math.trunc(f(f(r * f(10430.378)) + 16384)) & 65535];
// EntityLivingBase.jump (sv.bj): 0.42 upward plus (amplifier + 1) * 0.1F with Jump Boost (the magma cube's own bj ignores it); a sprinting mob (only the ocelot at move speed 1.33) also gets 0.2 along its yaw.
export function jump(e) {
  e.vy = e.type === "magma_cube" ? magmaJumpMotion(e.size) : 0.41999998688697815; // yf.bj: 0.42 + size * 0.1
  const boost = e.type === "magma_cube" ? null : e.effects?.find?.((x) => x.id === JUMP_BOOST);
  if (boost) e.vy += f(f(boost.amplifier + 1) * f(0.1));
  if (e.sprinting && e.rotationYaw !== undefined) { const r = f(f(e.rotationYaw) * f(0.017453292)); e.vx -= f(mathHelperSin(r) * f(0.2)); e.vz += f(mathHelperCos(r) * f(0.2)); }
}
// EntityLivingBase.moveEntityWithHeading (sv.e(FF)), without strafe. AI mobs
// accelerate at 0.04 in water (legacy spiders 0.02); drag is 0.8. Lava uses
// acceleration 0.02 and drag 0.5; gravity is 0.02 in either liquid. On land,
// friction is 0.91 * block slipperiness. Acceleration is aiMoveSpeed (spiders:
// fixed 0.1) * 0.16277136 / friction^3; 0.02 in the air. Spiders can climb.
// Gravity is 0.08 with 0.98 vertical drag. Returns the landing fall distance.
// isAIEnabled false (probed attributes2 `aiEnabled`): getAIMoveSpeed is 0.1 and the water acceleration 0.02; EntityCreature.updateEntityActionState
// puts the movementSpeed attribute in moveForward. The ghast, squid and dragon move by their own code.
// Mobs whose body yaw follows EntityLivingBase.func_110146_f instead of EntityBodyHelper (not isAIEnabled in 1.7.10): only the enderman so far, the one with native yaw records.
export const LEGACY_BODY = new Set(["enderman", "spider", "cave_spider", "slime", "magma_cube", "silverfish", "giant", "pigman", "blaze", "ghast"]); // EntityLiving.isAIEnabled (sw.bk) is false unless overridden. Bytecode-read over every class extending sw: the overrides that return true are bat, chicken, cow, horse, ocelot, pig, sheep, snow golem, iron golem, wolf, wither, creeper, skeleton, witch, zombie and villager; PigZombie (yh) overrides it back to false, and enderman, spider, slime, silverfish, giant, blaze, ghast, squid and the dragon never override. The squid has its own legacyBodyTurn and the dragon sets its own yaws. b49po (spider, slime) and b50lb (silverfish, giant, pigman, blaze, ghast; witch and creeper as controls) executed
export const LEGACY_MOVE = new Set(["spider", "cave_spider", "silverfish", "giant", "pigman", "enderman", "slime", "magma_cube", "blaze"]);
export function moveEntityWithHeading(world, e, w, h, forward, hooks) {
  let landed;
  if (e.inWater) {
    const y0 = e.y;
    moveFlying(e, e.moveStrafing || 0, forward, f(LEGACY_MOVE.has(e.type) ? 0.02 : 0.04));
    landed = moveEntity(world, e, w, h, e.vx, e.vy, e.vz, e.type === "enderman" ? 1 : e.stepHeight ?? STEP_HEIGHT, hooks);
    e.moveMotion = [e.vx, e.vy, e.vz]; // Entity.moveEntity reads the motion before the water drag below for its swim sound volume
    e.vx *= 0.800000011920929;
    e.vy *= 0.800000011920929;
    e.vz *= 0.800000011920929;
    e.vy -= 0.02;
    if (e.collidedH && offsetInLiquid(world, e, w, h, e.vx, e.vy + 0.6 - e.y + y0, e.vz)) e.vy = 0.30000001192092896;
  } else if (e.inLava) {
    const y0 = e.y;
    moveFlying(e, e.moveStrafing || 0, forward, f(0.02));
    landed = moveEntity(world, e, w, h, e.vx, e.vy, e.vz, e.type === "enderman" ? 1 : e.stepHeight ?? STEP_HEIGHT, hooks);
    e.moveMotion = [e.vx, e.vy, e.vz];
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
    moveFlying(e, e.moveStrafing || 0, forward, e.onGround ? f((LEGACY_MOVE.has(e.type) ? f(0.1) : e.aiMoveSpeed) * accel) : e.jumpFactor ?? JUMP_MOVEMENT_FACTOR);
    friction = slip();
    // isOnLadder: EntitySpider's override is its wall flag; others test the ladder cell (ladders.js).
    const climbable = () => (isSpider(e.type) ? e.climbing : isOnLadder(world, e.x, e.y, e.z));
    if (climbable()) {
      ladderClamp(e, e.player && e.sneaking, ["vx", "vy", "vz"]);
      e.fallDistance = 0;
    }
    landed = moveEntity(world, e, w, h, e.vx, e.vy, e.vz, e.type === "enderman" ? 1 : e.stepHeight ?? STEP_HEIGHT, hooks);
    e.moveMotion = [e.vx, e.vy, e.vz];
    if (e.collidedH && climbable()) e.vy = LADDER_CLIMB;
    // A client entity whose chunk is not loaded hovers instead (World.isRemote and the chunk's isChunkLoaded, entity-tracker.js ClientEntity).
    if (e.clientUnloaded) e.vy = e.y > 0 ? -0.1 : 0;
    else e.vy -= 0.08;
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
  e.velocityChanged = true; // EntityLivingBase.attackEntityFrom sets it; EntityTrackerEntry sends the motion (entity-tracker.js)
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
// The amount of EntityMob.attackEntityAsMob (the attackDamage attribute with the held weapon's modifier and Strength) or, for the classes whose own
// attack ignores the attribute, the fixed one: a wolf's 2 (4 tamed) and an ocelot's 3 are plain floats, a slime's is its size (getAttackStrength) and an iron
// golem rolls 7 + nextInt(15). None reads Strength or a saved attackDamage entry (probed attributes3 `attack` and `strength`, 339 records).
const FIXED_ATTACK = new Set(["wolf", "ocelot", "slime", "magma_cube"]);
export function mobHitAmount(e) {
  if (e.type === "wolf") return wolfAttack(e);
  if (e.type === "slime") return slimeDamage(e.size);
  if (e.type === "magma_cube") return magmaDamage(e.size);
  if (FIXED_ATTACK.has(e.type)) return ENTITY_TYPES[e.type].damage;
  const worn = e.attackEquipment ?? e.equipment; // the attribute map's view (EntityLivingBase.onUpdate syncs it each update)
  return attackDamage(e, ENTITY_TYPES[e.type].damage, worn ? attackBonus(worn) : 0);
}
// The player's attackDamage attribute with the held item's modifier (1 bare-handed): swords
// 5 + tier (gold 5), axes 4, pickaxes 3 and shovels 2 + tier, only for an item actually held.
export function heldAttackDamage(tool, survival) {
  const item = ITEMS[tool];
  if (!(survival.creative || survival.count(tool) > 0) || !["sword", "axe", "pickaxe", "shovel"].includes(item?.kind)) return survival.effects?.attackDamage ? survival.effects.attackDamage(1) : 1;
  const base = item.kind === "sword" ? 5 + (item.name.startsWith("Golden") ? 0 : item.tier) : item.kind === "axe" ? 4 + item.tier : item.kind === "pickaxe" ? 3 + item.tier : 2 + item.tier;
  return survival.effects?.attackDamage ? survival.effects.attackDamage(base) : base;
}
// The Attributes a saved mob keeps: its modifiers (mob-attributes.js; every mob since batch 24, e.g. the follow-range spawn bonus) and a max health
// other than its type's (the zombie leader bonus or an imported modifier or base: the modifier list decides when it is present; a bare `maxHealth`
// is an older save's). Wolves, slimes and horses derive their maximum elsewhere (OWN_MAX_HEALTH), so they keep none.
function savedAttributeFields(e, base) {
  const modifiers = cleanModifiers(e.modifiers);
  if (OWN_MAX_HEALTH.has(e.type)) return { modifiers, maxHealth: undefined };
  const own = Number.isFinite(e.attributeBases?.["generic.maxHealth"]) ? e.attributeBases["generic.maxHealth"] : undefined;
  const fromModifiers = modifiers?.some((m) => m.attribute === "generic.maxHealth") || own !== undefined ? modifiedValue({ modifiers }, "generic.maxHealth", own ?? base, 0, Number.MAX_VALUE) : undefined;
  const max = fromModifiers ?? (Number.isFinite(e.maxHealth) && e.maxHealth > 0 ? e.maxHealth : undefined);
  return { modifiers, maxHealth: max !== undefined && max !== base ? max : undefined };
}
// A mob the player can sit on from a save (level.dat Player.Riding, `playerRides`): EntityList.createEntityFromNBT + mountEntity accept any entity. Left
// out are the chicken (its own seat maths, mob-riding.js seatPosition), the Ender Dragon, the Wither and the End crystal (no mount seat here).
export const playerMountable = (e) => !!e && e.type !== "chicken" && e.type !== "ender_dragon" && e.type !== "wither" && e.type !== "ender_crystal" && (e.growingAge ?? 0) >= 0;
// The slot of a held stack whose size fell to 0 or below is cleared (the native `setInventorySlotContents(currentItem, null)` after a use).
function clearSpentStack(survival) {
  const inv = survival.inventory, held = inv.held;
  if (held && held.count <= 0) inv.main[inv.current] = null;
}
export class EntityWorld {
  // `ids` is the shared Entity.nextEntityID (entity-ids.js): main.js and the away run hand every dimension's list the same one.
  constructor(world, saved, random = Math.random, ids = new EntityIds()) {
    this.world = world;
    setMaxHealthHook((e) => maxHealthOf(e, ENTITY_TYPES[e.type]?.health)); // a health boost changing on a mob clamps its health to the live maximum
    this.ids = ids;
    this.random = random;
    // The client Fx (main.js) the death puffs, splashes and feeding hearts spawn into.
    this.fx = null;
    this.events = [];
    this.clientSounds = [];
    this.entities = [];
    // EnumDifficulty id (difficulty.js); main.js sets it from the settings. `worldRandom` is
    // World.rand and `localDifficulty(x, y, z)` World.func_147462_b, both hooked in by main.js.
    this.difficulty = NORMAL;
    this.worldRandom = null;
    this.fishStates = new WeakMap(); // silverfish.js legacy AI state, never saved
    this.localDifficulty = null;
    // WorldServer.tick's SpawnerAnimals pass (naturalSpawn). main.js turns it on for the played world; headless worlds in tests
    // and tools leave it off unless they exercise spawning.
    this.naturalSpawning = false;
    if (Array.isArray(saved)) {
      // Entity.nextEntityID is one counter that never repeats: a record without an id (a mob that travelled here through a portal, dimension-live deliver) gets
      // one above every saved id, not the next free number counted from 1 (that repeated a saved id when the saved list had gaps).
      this.nextId = Math.max(this.nextId, ...saved.slice(0, 256).map((e) => (/^mob-\d+$/.test(e?.id) ? Number(e.id.slice(4)) + 1 : 1)));
      const used = new Set();
      for (const e of saved.slice(0, 256)) {
        const m = this.restore(e);
        if (!m) continue;
        if (used.has(m.id)) m.id = "mob-" + this.ids.take();
        used.add(m.id);
        this.entities.push(m);
        this.ids.reserve(m.id); // a record without an id took the next number (restore); a shared counter does not burn one per mob
      }
      linkRiders(this.entities, (m) => this.size(m)[1]); // mob-riding.js: `riding` ids back to mounts
      this.nextId = Math.max(
        this.nextId,
        ...this.entities
          .map((e) => Number(String(e.id).replace("mob-", "")) + 1)
          .filter(Number.isFinite),
      );
    } else if (!world.dimension) this.seedAnimals();
  }
  get nextId() { return this.ids.next; }
  set nextId(v) { this.ids.next = v; }
  // A saved mob record (a browser save, java-mobs.js import or /summon's data tag) back to a live mob, or null when it
  // is unusable. The caller adds it and advances nextId.
  restore(e, { summoned = false } = {}) {
    const world = this.world;
    const t = ENTITY_TYPES[e.type];
    if (
      !t ||
      ![e.x, e.y, e.z, e.health].every(Number.isFinite) ||
      (world.streaming ? !world.inside(Math.floor(e.x),0,Math.floor(e.z)) : e.x < 0 || e.x >= SIZE || e.z < 0 || e.z >= SIZE) ||
      e.y < -64 || // b54so: no upper bound: AnvilChunkLoader files a record above 256 in section 15 (Chunk.addEntity clamps) and loads it; only the void (y < -64) removes
      (e.health <= 0 && !summoned && !(e.type === "ender_dragon" && e.dragonSave?.deathTicks >= 0 && e.dragonSave.deathTicks < 200))
    )
      return null;
    const fresh = this.create(e.type, e.x, e.y, e.z);
    this.nextId--; // restore callers advance once after accepting the mob
    return syncInterpolation({
      ...fresh,
      ...e,
      id: /^mob-\d+$/.test(e.id) ? e.id : fresh.id,
      // Clamped to the live maximum (mob-riding.js maxHealthOf); a slime is healed to its full one below (slimeRestore).
      health: Math.max(0, Math.min(maxHealthOf(e, t.health), e.health)),
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
      ...(e.type === "chicken" ? { eggTimer: fresh.eggTimer, chickenJockey: e.chickenJockey === true } : {}), // IsChickenJockey (mob-riding.md)
      playerRides: playerMountable(e) && e.playerRides === true ? true : undefined, // consumed by restorePlayerVehicle
      riding: typeof e.riding === "string" && /^(mob|boat|cart)-\d+$/.test(e.riding) ? e.riding : undefined, // the mount's id, linked by linkRiders
      ...savedAttributeFields(e, t.health),
      ...(e.type === "zombie" ? { canBreakDoors: e.canBreakDoors === true } : { canBreakDoors: e.type === "pigman" ? e.canBreakDoors === true : undefined }), // a pigman only saves the flag: EntityPigZombie.isAIEnabled is false, so the task never runs (mob-riding.md)
      // EntityBat.readEntityFromNBT: BatFlags bit 1 is the hanging state (datawatcher 16).
      ...(e.type === "bat" ? { batHanging: e.batHanging === true } : {}),
      ...(isSpider(e.type) ? { climbing: false, spiderTarget: false, spiderRevenge: 0, stepDistance: 0, nextStep: 1 } : {}),
      // EntitySilverfish has no NBT of its own: the summon cooldown starts over.
      ...(e.type === "silverfish" ? { summonCooldown: 0 } : {}),
      // EntitySlime.readEntityFromNBT: Size (size - 1); health is clamped to size * size, the jump and squish start over.
      ...(isSlimeLike(e) ? { ...slimeRestore(e, fresh), health: maxHealthOf({ ...e, size: slimeFieldsFrom(e).size }, t.health) } : {}), // full, modifiers included
      ...(e.type === "pigman" ? pigmanFieldsFrom(e) : {}),
      ...(GEAR_TYPES.has(e.type) ? mobGearFieldsFrom(e) : {}),
      ...(e.type === "enderman" ? endermanFieldsFrom(e) : {}),
      // EntityWitch keeps its held potion (Equipment) but not the drinking state (datawatcher 21, the penalty modifier).
      ...(e.type === "witch" ? { drinking: false, drinkTimer: 0, held: e.held && e.held.id === ITEM_POTION && potionEffects(e.held.damage).length ? { id: ITEM_POTION, damage: e.held.damage, count: 1 } : null } : {}),
      // EntityCreeper.readEntityFromNBT: "powered" and "ignited" are saved, the swell
      // state (datawatcher 16) and timeSinceIgnited start over.
      ...(e.type === "creeper" ? { ...creeperFields(), ...creeperSavedFields(e), powered: e.powered === true, ignited: e.ignited === true } : {}),
      // NBT ActiveEffects and the Attributes the spawn rolls modified.
      effects: readMobEffects(e.effects),
      absorption: e.absorption > 0 ? f(e.absorption) : undefined, // EntityLivingBase.readEntityFromNBT: AbsorptionAmount (setAbsorptionAmount floors at 0)
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
      uuid: newUuid(), // Entity.writeToNBT's UUIDMost/UUIDLeast (entity-uuid.js); kept by serialize and restore
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
      ...(GEAR_TYPES.has(type) ? defaultGear(type) : {}), // Equipment, DropChances, CanPickUpLoot (mob-equipment.md)
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
    this.tickOrder?.push(chick); // World.spawnEntityInWorld: appended to the list being walked (an egg's chick updates in the pass it hatched)
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
      // EntityRenderer.getMouseOver tests the client world's entity boxes: a tracked mob is aimed at where its client entity stands (and is drawn),
      // not its live server position (entity-tracker.js). The dragon's parts stay live (dragon-mobs.js).
      const c = e.type === "ender_dragon" ? null : this.clientPosition(e);
      const box = c ? Object.assign(Object.create(e), { x: c.x, y: c.y, z: c.z }) : e;
      const distance = entityHit(origin, dir, box, Math.min(reach, wallDistance));
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
    e.idle = 0; // EntityLivingBase.attackEntityFrom: entityAge = 0 (the despawn age EntityAIWander reads) before the health check
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
    // Potion.fireResistance: fire damage is refused. Entity.isImmuneToFire is no part of attackEntityFrom (hazard / dealFireDamage checks it); executed: mob-victims-reference.json (b51mv).
    if ((name === "onFire" || name === "inFire" || name === "lava") && e.effects?.some((x) => x.id === 12)) return false;
    // An anvil or falling block wears the helmet slot's stack (a broken one stays at size 0) and deals 0.75 (mob-equipment.js fallingBlockHelmet).
    if ((name === "anvil" || name === "fallingBlock") && e.equipment) amount = fallingBlockHelmet(e.equipment, amount, rand, () => { this.events.push({ sound: "random.break", volume: 0.8, pitch: breakSoundPitch((this.worldRandom ??= new JavaRandom(Math.floor(Math.random() * 2 ** 48)))), position: { x: e.x, y: e.y, z: e.z } }); brokenItemDraws(rand); });
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
    // EntityLivingBase.attackEntityFrom: a living source entity (player, mob melee, an arrow's shooter) becomes the revenge target (revenge-target.js).
    const by = sourceEntity(this, e, source);
    if (by) { e.revenge = (e.age || 0) + 1; noteRevenge(e, by); }
    if (source.player) e.recentlyHit = 100;
    else if (source.attacker?.type === "wolf" && wolfTamed(source.attacker)) e.recentlyHit = 100; // EntityLivingBase.attackEntityFrom: a tamed wolf's hit counts as a player hit for drops (no attackingPlayer)
    if (e.type === "villager") this.villagerHurtBy(e, source);
    if (fresh) {
      if (name !== "drown") rand.nextDouble();
      // `mathRandom`: a replay's recorded java.lang.Math.random values (village-fight-b39-reference.json)
      if (source.from) knockBack(e, source.from.x, source.from.z, () => rand.nextDouble(), this.mathRandom ?? Math.random);
      else (this.mathRandom ?? Math.random)(); // no attacker entity: attackedAtYaw = (int)(Math.random() * 2) * 180 (sv.a(ro, F), bytecode-read; the value is not used by the port)
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
    } else if (fresh) {
      if (e.type === "horse" && rand.nextInt(3) === 0) this.horseRear(e); // EntityHorse.getHurtSound (wi.aT, bytecode-read): nextInt(3) first, 0 makes it rear (no sound of its own)
      this.events.push({ sound: hurtOf(e), ...sound, pitch: soundPitch(rand, child) });
    }
    if (e.type === "zombie" || e.type === "pigman") this.callReinforcement(e, sourceEntity(this, e, source)); // EntityPigZombie.attackEntityFrom ends in EntityZombie's (spawnReinforcements 0: the Hard roll still draws)
    // EntityMob.attackEntityFrom (yg.a), every legacy-action-state EntityMob (spider, pigman, silverfish, blaze, giant; fireballs-replay.js, fireballs-reference.json
    // "fb-hurt-mobs"): any living attacker that is not this mob, its rider or its mount becomes entityToAttack. A source without an entity (a rider/mount null
    // equals the null entity) changes nothing. The AI-task mobs (zombie, skeleton ...) keep entityToAttack unused in 1.7.10 (bytecode-read).
    if (TARGETS_ATTACKER.has(e.type) && by && by !== e && by !== e.ridingEntity && by !== e.riddenBy) this.silverfishState(e).target = by === "player" ? this.ai.player : this.ai.brain(by);
    // A source whose entity is no creature (the shooterless fireball): the dead entity becomes entityToAttack and the next td.bq clears it (isEntityAlive false).
    else if (TARGETS_ATTACKER.has(e.type) && !by && source.entity) this.silverfishState(e).target = { alive: false, x: source.entity.x, y: source.entity.y, z: source.entity.z, height: 0, eyeHeight: 0 };
    return true;
  }
  // EntityLivingBase.damageEntity (sv.d): armour (damageArmor, sv.h, is empty for a mob: its gear never wears down), then applyPotionDamageCalculations
  // (sv.c: an absolute source returns first, Resistance 20 % per level for every source but outOfWorld, nothing left returns 0, then the enchantments of the worn
  // gear), then the absorption amount (sv.bs / sv.m), then setHealth (a float, clamped at 0). Executed: mob-resist-reference.json (b50mr).
  damageEntity(e, amount, name, source = null) {
    amount = armorReduced(e.type, amount, name, e.size, e.equipment);
    const resistance = mobEffect(e, RESISTANCE);
    if (resistance && name !== "outOfWorld" && !isAbsolute(name)) amount = f(f(amount * (25 - (resistance.amplifier + 1) * 5)) / 25);
    // EnchantmentHelper.getEnchantmentModifierDamage over the worn stacks (the generic protection code of the player's armour).
    if (e.equipment) amount = enchantedDamage(e.equipment, name, amount);
    // EntityWitch.applyPotionDamageCalculations: its own damage is ignored, magic damage is cut to 15 %.
    if (e.type === "witch") amount = witchDamage(amount, { isMagic: name === "magic" || name === "indirectMagic", byWitch: source?.attacker === e });
    if (e.absorption > 0) { const left = Math.max(f(amount - e.absorption), 0); e.absorption = f(e.absorption - f(amount - left)); amount = left; }
    if (amount !== 0) e.health = Math.max(0, f(e.health - amount));
  }
  // EntityZombie.attackEntityFrom (yq.a(ro, F)) once the hit counts, even a killing one. The
  // target is the attack target, else the revenge target, else the attacker; only the player
  // is a target here, so a hit by a skeleton's arrow on a zombie with no target calls no one.
  // The new zombie stands at the integer corner of its block, as setPosition puts it.
  callReinforcement(e, by) {
    const player = this.ai.player, brain = this.ai.brain(e);
    // yq.a: the attack target, else the revenge target (the legacy entityToAttack stands in), else the hit's living source entity.
    const target = brain.attackTarget ?? brain.revengeTarget ?? (by === "player" ? player : by ? this.ai.brain(by) : null);
    if (!target || this.entities.length >= 40) return null;
    const t = ENTITY_TYPES.zombie, w = t.width / 2;
    const spot = zombieReinforcement(entityRandom(e), this.difficulty, e.reinforcement ?? 0, e.x, e.y, e.z, {
      solidTop: (x, y, z) => y < (this.world.height ?? HEIGHT) && normalCube(this.world.get(x, y, z)),
      light: (x, y, z) => (this.lightAt ? this.lightAt(x, y, z) : 0),
      fits: (x, y, z) => {
        // Batch 34: no chunk test here. The native site test (yq.a) only reads blocks and boxes; the chunk check is World.spawnEntityInWorld's (chunkExists), after the site is chosen (below).
        if (y < 0 || y + t.height > (this.world.height ?? HEIGHT)) return false;
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
    // World.spawnEntityInWorld (ahb.d) returns false for a non-player entity whose chunk is not loaded; yq.a ignores that: the target is set on the unspawned zombie, both charges apply
    // and the search stops at this site (bytecode-read; the b34 unloaded-chunk records). A site in a chunk that is not loaded is therefore a lost reinforcement, not a retry.
    const loaded = this.chunkLoaded ? this.chunkLoaded(spot.x, spot.z) : this.world.streaming ? this.world.isTicking(spot.x, spot.z) : !(spot.x < 1 || spot.z < 1 || spot.x >= SIZE - 1 || spot.z >= SIZE - 1);
    if (!loaded) {
      // yq.a still runs onSpawnWithEgg on the refused zombie: its rolls draw the world's Random (child, villager, jockey), which later spawns share (b34 reinforce-unloaded records).
      this.onSpawnWithEgg(this.create("zombie", spot.x, spot.y, spot.z), { ghost: true });
      e.reinforcement = reinforcementChance(e.reinforcement + REINFORCEMENT_CHARGE);
      return null;
    }
    const z = this.spawnNatural("zombie", spot.x, spot.y, spot.z, "reinforce");
    this.tickOrder?.push(z); // World.spawnEntityInWorld: appended to the list being walked, so it updates in this pass
    this.ai.brain(z).attackTarget = target;
    e.reinforcement = reinforcementChance(e.reinforcement + REINFORCEMENT_CHARGE);
    z.reinforcement = reinforcementChance(z.reinforcement + REINFORCEMENT_CHARGE);
    return z;
  }
  // A mob from SpawnerAnimals (or a reinforcement), with EntityLiving.onSpawnWithEgg's rolls
  // (difficulty.js): the spider's Hard potion effect; the zombie's knockback, follow range and
  // leader bonus, and the equipment of zombies, pigmen and skeletons (mob-equipment.md). Rolls this build has no use for (jockeys,
  // door breaking, the leader's health) are drawn and dropped.
  spawnNatural(type, x, y, z, kind = "spawn") {
    const e = this.create(type, x, y, z);
    // EntityLivingBase's constructor rolls rotationYaw = (float)(Math.random() * 3.1415927 * 2.0) (degrees, so 0 to 6.28) and sets rotationYawHead to it (bytecode-read); a reinforcement
    // zombie gets no setLocationAndAngles, so that is its heading (the mob's other yaw fields stay 0). Unseedable natively; a replay overrides it from the record in entitySeed.
    if (kind === "reinforce") { const yaw = Math.fround(Math.random() * 3.1415927410125732 * 2.0); e.rotationYaw = e.rotationYawHead = yaw; e.yaw = (-yaw * Math.PI) / 180; }
    this.entitySeed?.(e, kind); // replay hook (village-fight-replay.js): the new mob's Entity.rand
    // SpawnerAnimals and EntityZombie.attackEntityFrom call World.spawnEntityInWorld before onSpawnWithEgg, so a rider's mount (a chicken jockey's chicken, a spider jockey's skeleton)
    // joins the list after it and updates after it.
    this.entities.push(e);
    this.onSpawnWithEgg(e);
    return e;
  }
  // EntityLiving.onLivingUpdate's pickup loop (gamerule mobGriefing) for each live equipment mob with canPickUpLoot:
  // `lootItems` is the world's ItemEntities (living-simulation.js sets it). A replaced stack leaves as a drop event.
  // EntityLiving.onLivingUpdate (sw.e): the pickup loop runs per mob after EntityLivingBase.onLivingUpdate (AI, movement, push), so a picked-up bow changes
  // the combat task (setCurrentItemOrArmor -> setCombatTask, at once) for the mob's next tick, not the same one.
  lootPickup() { for (const e of this.entities) this.lootPickupOne(e); }
  lootPickupOne(e) {
    const items = this.lootItems;
    if (!items?.items?.length || !gameRule("mobGriefing")) return;
    if (!e.canPickUpLoot || !(e.health > 0) || !GEAR_TYPES.has(e.type)) return;
    const [w, h] = this.size(e), box = [e.x - w / 2, e.y, e.z - w / 2, e.x + w / 2, e.y + h, e.z + w / 2];
    const held = e.equipment?.[0];
    for (const stack of pickUpLoot(e, items.items, box, (item) => items.box(item), entityRandom(e))) {
      const live = toLiveStack(stack);
      if (live) this.events.push({ drop: live.id, count: 1, ...(live.damage ? { damage: live.damage } : {}), ...(live.enchantments ? { enchantments: live.enchantments } : {}), position: { x: e.x, y: e.y, z: e.z } });
    }
    this.ai.brains?.get?.(e)?.syncCombatTask?.(e.equipment?.[0] !== held); // setCurrentItemOrArmor(0) re-runs setCombatTask even for another sword
  }
  // The rolled equipment, drop chances and pickup flag of a spawn (mob-equipment.js); the stacks are native.
  applyGear(e, r) {
    e.equipment = r.stacks.map((s) => (s ? cloneStack(s) : null));
    e.dropChances = r.dropChances.slice();
    e.canPickUpLoot = !!r.loot;
  }
  // The followRange "Random spawn bonus" (operation 1) as a stored modifier (saved and exported with a random UUID, as natively) and its value.
  addSpawnBonus(e, amount) {
    e.modifiers = cleanModifiers([...(e.modifiers ?? []), spawnBonusModifier(amount)]);
    e.followRange = modifiedValue(e, "generic.followRange", FOLLOW_BASE.has(e.type) ? 40 : 16, 0, 2048);
  }
  // EntityLiving.onSpawnWithEgg(data) and its overrides. EntityCaveSpider's (xy.a(sy)) returns
  // its argument without calling super: no follow-range roll, no jockey, no effect. `opts.group` is the
  // IEntityLivingData SpawnerAnimals threads through one group (null for a spawn egg or a single spawn);
  // the spider's and zombie's GroupData are rolled only when it is null and are left in opts.group.
  onSpawnWithEgg(e, opts = {}) {
    const free = !!opts.free;
    const type = e.type, x = e.x, y = e.y, z = e.z, rand = entityRandom(e);
    const world = (this.worldRandom ??= new JavaRandom(Math.floor(Math.random() * 2 ** 48)));
    const local = this.localDifficulty ? this.localDifficulty(Math.floor(x), Math.floor(y), Math.floor(z)) : 0;
    // EntityLiving.onSpawnWithEgg's followRange "Random spawn bonus" is the first Entity.rand draw of every class but the cave spider (probed:
    // interchange-spawn-reference.json); the spider, zombie, pigman, skeleton and horse rolls draw it themselves.
    if (!OWN_SPAWN_BONUS.has(type)) this.addSpawnBonus(e, spawnBonus(rand)[0]);
    if (type === "spider") {
      const r = spiderSpawnRolls(rand, world, this.difficulty, local, opts.group?.spider);
      opts.group = { spider: r.group };
      this.addSpawnBonus(e, r.followBonus);
      // EntitySpider.onSpawnWithEgg (yn.a): one spawn in a hundred seats a skeleton on the spider (its own onSpawnWithEgg first,
      // then spawnEntityInWorld and mountEntity), before the Hard potion effect.
      if (r.jockey) this.spawnSpiderJockey(e);
      if (r.effect) addMobEffect(e, r.effect);
    } else if (type === "zombie" || type === "pigman") {
      // EntityPigZombie.onSpawnWithEgg returns its argument, so a pigman group rolls GroupData for every member.
      const now = this.currentDate?.() ?? new Date(), r = zombieSpawnRolls(rand, world, this.difficulty, local, { month: now.getMonth() + 1, day: now.getDate() }, type === "pigman", type === "zombie" ? opts.group?.zombie : null);
      if (type === "zombie") opts.group = { zombie: r.group };
      // EntityZombie.GroupData: a child (isChild never ages out for a zombie) and a zombie villager. EntityPigZombie.onSpawnWithEgg
      // (yh.a) runs EntityZombie's rolls with bC giving only the golden sword, then setVillager(false): a pigman can be a child (and so a
      // chicken jockey), never a villager (tools/probes/PigmanJockeyProbe.java, pigman-jockey-reference.json).
      if (r.child) e.growingAge = -1;
      if (r.child) { const t = ENTITY_TYPES[type], k = mobScale(e); e.spawnBox = anchoredShrunkBox(e, t.width, t.height, t.width * k, t.height * k); e.spawnBoxTick = this.worldTicks; e.anchorBox = e.spawnBox.slice(); }
      if (type === "zombie" && r.villager) e.villager = true;
      this.applyGear(e, r);
      e.knockbackResistance = r.knockback;
      e.followRange = r.followRange;
      // A zombie World.spawnEntityInWorld refused (`ghost`, an unloaded chunk) still runs the whole child roll: a chicken found is flagged and carries it, a new one is built and rolled but not spawned.
      if (r.child) this.chickenJockeyRolls(e, r, !!opts.ghost);
      // The rolls as saved AttributeModifiers (mob-attributes.js, probed in interchange-reference.json); the leader's max-health bonus is one of them.
      e.modifiers = cleanModifiers(r.modifiers);
      if (r.leader && r.maxHealth > ENTITY_TYPES.zombie.health) e.maxHealth = r.maxHealth;
      if (type === "pigman") e.canBreakDoors = !!(r.doors || r.leader); // yh.a(sy) runs yq.a(sy): the same roll, stored but never run
      if (type === "zombie") {
        e.reinforcement = reinforcementChance(e.reinforcement + r.reinforcementBonus);
        // EntityZombie.a(sy): the child's chicken (5 %: the first free chicken in a 5 x 3 x 5 box, and nothing else when
        // there is none; else 5 %: a new chicken jockey), then setBreakDoorsAItask(roll < local * 0.1) and the leader's
        // max-health bonus (the health itself stays), which also breaks doors (mob-riding.md).
        e.canBreakDoors = !!(r.doors || r.leader);
      }
    } else if (type === "skeleton" || type === "wither_skeleton") {
      // EntitySkeleton.onSpawnWithEgg: armour, bow and enchantments (or the wither's stone sword), the pickup roll and the Halloween head.
      // A skeleton seated on a spider (free) takes the Nether roll for its type; a spawner's has chosen it already.
      const now = this.currentDate?.() ?? new Date(), r = skeletonSpawnRolls(rand, this.difficulty, local, { month: now.getMonth() + 1, day: now.getDate() }, this.world.dimension === NETHER, free ? null : type === "wither_skeleton");
      if (free && r.wither) { e.type = "wither_skeleton"; e.health = ENTITY_TYPES.wither_skeleton.health; }
      this.applyGear(e, r);
      this.addSpawnBonus(e, r.followBonus);
    } else if (type === "sheep") {
      // EntitySheep.onSpawnWithEgg (wp.a(sy)): setFleeceColor(getRandomFleeceColor(worldObj.rand)).
      e.color = fleeceColor(world);
    } else if (type === "horse") {
      // EntityHorse.onSpawnWithEgg (wi.a(sy)) on Entity.rand: the follow-range gaussian, a herd's type and variant (GroupData, passed on
      // to the next horse of the group) or the 1-in-10 donkey and the colour and marking, the foal roll, then health, speed and jump.
      const r = horseSpawn(rand, opts.group?.horse ?? null);
      opts.group = { horse: r.group };
      Object.assign(e, r.fields);
      this.addSpawnBonus(e, r.followBonus);
      if (e.growingAge < 0) { const t = ENTITY_TYPES.horse, k = mobScale(e); e.spawnBox = anchoredShrunkBox(e, t.width, t.height, t.width * k, t.height * k); e.spawnBoxTick = this.worldTicks; e.anchorBox = e.spawnBox.slice(); /* setSize keeps minX/minZ: the foal's centre moves on its first step (b45 records) */ }
    } else if (type === "villager") {
      // EntityVillager.onSpawnWithEgg (yv.a(sy), bytecode-read and executed in away-dispense-reference.json): the EntityAgeable roll, then setProfession(worldObj.rand.nextInt(5)).
      e.profession = world.nextInt(5);
    } else if (type === "ocelot") {
      // EntityOcelot.onSpawnWithEgg: one chance in seven of two kittens (age -24000, CatType 0) at the same spot.
      for (let i = kittenLitter(world); i > 0 && this.entities.length < (opts.limit ?? 40); i--) {
        const kit = this.create("ocelot", x, y, z);
        setLocationAndAngles(kit, x, y, z, e.rotationYaw ?? 0, 0);
        kit.growingAge = -24000;
        this.entities.push(kit);
      }
    }
    return e;
  }
  // The AI of a rider's onLivingUpdate (Entity.updateRidden zeroes its motion, runs the whole onUpdate, then the mount's updateRiderPosition seats it): the tasks,
  // navigator and helpers run here and the caller's walk() then moves and pushes it from the place the seat left it at (b37 records: the rider's own move and
  // push are part of the tick, the seat overrides the result). A zombie on a chicken with a target hands its path to the chicken at speed 1.5 first (EntityZombie.onLivingUpdate, yq.e).
  ridden(e) {
    const m = e.ridingEntity;
    if (e.type === "zombie" && m?.type === "chicken" && this.ai.brain(e).attackTarget) this.ai.brain(m).navigator.setPath(this.ai.brain(e).navigator.getPath(), 1.5);
    this.ai.think(e);
  }
  // EntitySpider.onSpawnWithEgg's rider: a skeleton at the spider's place and yaw (pitch 0), its own rolls, then mounted.
  spawnSpiderJockey(spider) {
    const sk = this.create("skeleton", spider.x, spider.y, spider.z);
    setLocationAndAngles(sk, spider.x, spider.y, spider.z, spider.rotationYaw ?? 0, 0);
    this.entitySeed?.(sk, "jockey-skeleton"); // replay hook: the skeleton's Entity.rand
    this.onSpawnWithEgg(sk, { free: true });
    this.entities.push(sk);
    mountEntity(sk, spider, (m) => this.size(m)[1]);
    return sk;
  }
  // EntityZombie.onSpawnWithEgg for a child: `r` holds the rolls already drawn (zombieSpawnRolls). A chicken found is made a
  // jockey and mounted; a new one is created at the zombie's place and yaw, rolled, flagged, spawned and mounted.
  chickenJockeyRolls(zombie, r, ghost = false) {
    const heightOf = (m) => this.size(m)[1];
    if (ghost) zombie.unspawned = true; // never in the world list, never dead: the mount keeps it as its rider (World.updateEntityWithOptionalForce only frees a dead rider)
    if (r.nearbyChicken) {
      const c = freeChickenNear(zombie, this.entities, (o) => this.size(o));
      if (c) { c.chickenJockey = true; mountEntity(zombie, c, heightOf); }
    } else if (r.newChicken) {
      const c = this.create("chicken", zombie.x, zombie.y, zombie.z);
      setLocationAndAngles(c, zombie.x, zombie.y, zombie.z, zombie.rotationYaw ?? 0, 0);
      if (!ghost) this.entitySeed?.(c, "jockey-chicken"); // replay hook: the new chicken's Entity.rand
      this.onSpawnWithEgg(c);
      c.chickenJockey = true;
      if (!ghost) this.entities.push(c); // World.spawnEntityInWorld (ahb.d) refuses it in a chunk that is not loaded, yet the zombie still mounts it
      mountEntity(zombie, c, heightOf);
    }
  }
  // The mob-spawner.js context hooks for this world (MobSpawnerBaseLogic.updateSpawner). `env`
  // supplies the light: skyLight(x, y, z) (the saved sky value), lightValue(x, y, z)
  // (World.getBlockLightValue), thundering() and thunderLightValue(x, y, z) (skylightSubtracted
  // 10); `extraCollision(box)` adds boats/minecarts (preventEntitySpawning and their boxes).
  // fullLight(x, y, z) is World.getFullBlockLightValue (EntityAnimal), brightness the provider's
  // lightBrightnessTable (EntityCreature.getBlockPathWeight) and date() World.getCurrentDate (bats).
  // A spawn beyond the 40 mobs a save keeps is refused after its rolls (createMob null).
  spawnerHooks(env = {}) {
    const height = this.world.height ?? HEIGHT;
    // A foal rolled by onSpawnWithEgg shrinks its box with Entity.setSize after placement, which keeps the box's minimum corner (not recentred
    // until the entity's first move), so it stays anchored for the rest of that tick (anchoredShrunkBox, probed by spawn-replay3).
    const sized = (o) => { if (o.spawnBox && o.spawnBoxTick === this.worldTicks) return o.spawnBox; const s = this.size(o); return mobBox(o.x, o.y, o.z, s[0], s[1]); };
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
      // preventEntitySpawning is set by EntityLivingBase (bats included, though they are not pushable); probed natively.
      for (const o of this.entities) if ((o.type === "bat" || pushable(o)) && boxesIntersect(box, sized(o))) return true;
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
        const sb = mobBox(e.x, e.y, e.z, box.width, box.height), brightness = env.brightness ?? SPAWN_BRIGHTNESS;
        const living = () => !blocked(sb) && !collisionBoxes(this.world, sb).length && !liquid(sb); // EntityLiving.getCanSpawnHere
        const fx = Math.floor(e.x), fy = Math.floor(e.y), fz = Math.floor(e.z);
        // Pig zombies and magma cubes use only the space checks. Ghasts also
        // roll 1 in 20; blazes override EntityMob.isValidLightLevel, keeping EntityCreature's 0.5 - brightness path weight.
        if (["pigman", "magma_cube", "ghast", "blaze"].includes(e.type)) {
          if (e.type === "ghast" && entityRandom(e).nextInt(20) !== 0) return false;
          if (this.difficulty === PEACEFUL || !living()) return false;
          return e.type !== "blaze" || f(f(0.5) - brightness[lightEnv.lightValue(fx, fy, fz)]) >= 0;
        }
        // EntityOcelot.getCanSpawnHere (ocelot.js): World.rand.nextInt(3) first, then the space checks, y >= 63 and grass or leaves below.
        if (e.type === "ocelot") {
          const below = this.world.get(fx, fy - 1, fz);
          return ocelotCanSpawnHere({ rand: (this.worldRandom ??= new JavaRandom(Math.floor(Math.random() * 2 ** 48))), collides: blocked(sb) || collisionBoxes(this.world, sb).length > 0, liquid: liquid(sb), y: fy, below: below === 1 || below === 5 || below === LEAVES2 });
        }
        // EntitySquid: 45 < posY < 63 and EntityWaterMob's entity-only check.
        if (e.type === "squid") return squidCanSpawn(e.y, !blocked(sb));
        // EntityBat: below y 63, the light roll (4, or 7 around Halloween after a coin flip), then EntityLiving's checks.
        if (e.type === "bat") {
          const now = env.date?.() ?? this.currentDate?.() ?? new Date();
          return batCanSpawn({ boxMinY: e.y, light: lightEnv.lightValue(fx, fy, fz), date: { month: now.getMonth() + 1, day: now.getDate() }, rand: entityRandom(e), superOk: living() });
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
          return monsterCanSpawnHere(box, { difficulty: this.difficulty, thundering: !!env.thundering?.(), ...lightEnv, brightness, entityCollision: blocked, blockCollision: (b) => collisionBoxes(this.world, b).length > 0, liquid }, entityRandom(e));
        // EntityAnimal.getCanSpawnHere: grass (internal id 1) below and full light above 8, then EntityLiving's checks.
        const x = Math.floor(e.x), y = Math.floor(e.y), z = Math.floor(e.z), b = mobBox(e.x, e.y, e.z, t.width, t.height);
        return this.world.get(x, y - 1, z) === 1 && (env.fullLight ?? lightEnv.lightValue)(x, y, z) > 8 && !blocked(b) && !collisionBoxes(this.world, b).length && !liquid(b);
      },
      initMob: (e) => this.onSpawnWithEgg(e),
      // SpawnData (spawner-data.js): the Properties read over the written entity like /summon's data tag, so its Pos moves it.
      applyProperties: (e, props) => {
        const parsed = summonedMobRecord(e.type, props), pos = props.get("Pos")?.value?.items;
        const r = parsed && this.restore({ ...parsed.record, x: pos?.[0] ?? e.x, y: pos?.[1] ?? e.y, z: pos?.[2] ?? e.z }, { summoned: true });
        // The written entity's Rotation (the rolled yaw) is read back unless the Properties carry their own (Entity.readFromNBT); a Riding mount is placed at it.
        const turn = Object.fromEntries(["yaw", "rotationYaw", "prevRotationYaw", "renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead", "bodyHeadYaw", "rotationPitch", "prevRotationPitch"].map((k) => [k, e[k]]));
        if (r) Object.assign(e, r, { id: e.id }, props.has("Rotation") ? {} : turn);
        const rot = props.get("Rotation")?.value?.items;
        if (r && rot?.length >= 2) { e.rotationYaw = e.prevRotationYaw = Math.fround(rot[0]); e.rotationPitch = e.prevRotationPitch = Math.fround(rot[1]); }
      },
      addMob: (e) => this.entities.push(e),
      // MobSpawnerBaseLogic.a(sa)'s Riding loop (spawner-riding.js): one mount of a SpawnData chain.
      spawnMount: (id, tag, rider) => this.spawnerMount(id, tag, rider, env),
      // EntityLiving.spawnExplosionParticle (entity status 20 on the client): 20 explode puffs.
      explosionParticles: (e) => {
        const t = ENTITY_TYPES[e.type];
        if (this.fx) burst(this.fx, "explode", 20, { x: e.x, y: e.y, z: e.z, width: t.width, height: t.height }, entityRandom(e));
      },
    };
  }
  // One step of agq.a(sa)'s Riding loop for a rider that is a mob: the mount made from its compound, placed at the rider with its position and angles
  // (Properties' Pos and Rotation are overwritten by setLocationAndAngles), spawned and mounted. A boat or minecart comes from env.spawnVehicle
  // (structure-simulation.js); a mob riding a vehicle can carry nothing further (a vehicle cannot ride here). Null when this build cannot keep it.
  spawnerMount(id, tag, rider, env = {}) {
    if (typeof rider?.type !== "string") return null;
    const heightOf = (m) => this.size(m)[1], type = importedMobType(id) ?? spawnerType(id);
    if (!type) {
      const vehicle = env.spawnVehicle?.(id, tag, rider);
      return vehicle && mountMobOnVehicle(vehicle, rider, heightOf) ? vehicle : null;
    }
    const parsed = summonedMobRecord(type, tag);
    if (!parsed || this.entities.length >= (env.limit ?? 40)) return null;
    const mount = this.restore({ ...parsed.record, x: rider.x, y: rider.y, z: rider.z }, { summoned: true });
    if (!mount) return null;
    setLocationAndAngles(mount, rider.x, rider.y, rider.z, rider.rotationYaw ?? 0, rider.rotationPitch ?? 0);
    for (const k of ["renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead", "bodyHeadYaw"]) mount[k] = rider.rotationYaw ?? 0;
    this.entities.push(mount);
    this.nextId++;
    mountEntity(rider, mount, heightOf);
    return mount;
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
    // EntityMob.attackEntityAsMob: the attribute (the held weapon's modifier included) plus Sharpness (getEnchantmentModifierLiving), Fire Aspect after.
    const melee = e.equipment ? meleeEffects(e.equipment[0]) : null;
    const hit = survival.scaledDamage(f(mobHitAmount(e) + (melee ? melee.damage : 0)), "a " + e.type, { attacker: NO_THORNS_ATTACKER.has(e.type) ? undefined : thorns, from: e });
    // EntityMob.attackEntityAsMob: Knockback on the held item pushes the player along the mob's facing and slows the mob (player-knockback.js).
    if (hit && melee?.knockback > 0) mobKnockbackKick(survival, e, melee.knockback);
    if (hit && melee?.fire > 0) survival.setFire(melee.fire);
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
    // EntityPlayer.attackTargetEntityWithCurrentItem: `if (f > 0 || f1 > 0)`. Weakness II on an empty hand (1 - 1.0) or worse does nothing at all.
    if (!(damage > 0 || weapon.damage > 0)) return false;
    if (critical) damage = criticalDamage(damage);
    damage = f(damage + weapon.damage);
    const knockback = extraKnockback + weapon.knockback, ignite = weapon.fireAspect > 0 && !(e.fire > 0);
    if (ignite) setMobFire(e, 1); // EntityPlayer.attackTargetEntityWithCurrentItem: setFire(1) on a target not yet burning
    const landed = !(e.hurt > 0 && damage <= e.lastDamage) && this.damage(e, damage, player.x, player.z, true, null, { looting: weapon.looting });
    if (landed) {
      this.ai.playerHit(e); // EntityLivingBase.setLastAttacker: the owner's wolves join in (EntityAIOwnerHurtTarget)
      // EnchantmentHelper.func_151384_a(target, player): a mob wearing Thorns hurts the player back (thorns-live.js, DamageSource.causeThornsDamage).
      mobThornsOnPlayerHit(e, entityRandom(e), {
        hurt: (n) => survival.damage(n, "thorns", true, "thorns", e),
        sound: () => this.events.push({ sound: "damage.thorns", volume: 0.5, pitch: 1, position: { x: player.x, y: player.y ?? e.y, z: player.z } }),
        breakSound: () => this.events.push({ sound: "random.break", volume: 0.8, pitch: breakSoundPitch((this.worldRandom ??= new JavaRandom(Math.floor(Math.random() * 2 ** 48)))), position: { x: e.x, y: e.y, z: e.z } }),
      });
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
    if (weapon.fireAspect > 0 && landed) setMobFire(e, weapon.fireAspect * 4);
    else if (ignite) e.fire = 0;
    return landed;
  }
  // EntityLivingBase.onDeath: a mob that is not a child drops its items (combat.js
  // mobDrops) on Entity.rand; the experience waits for deathTime 20 (deathUpdate). The death
  // counter starts on the next onEntityUpdate, or in this one for fire and drowning.
  onDeath(e, source = {}) {
    if (e.type === "villager") this.villagerDied(e, source);
    // EntityIronGolem.onDeath (wt.a(ro)): a village golem (not player-created) killed while a player is its attackingPlayer costs that player 5.
    else if (e.type === "iron_golem" && !e.playerCreated && e.recentlyHit > 0) this.ai.brain(e).village?.changeReputation(source.playerName ?? PLAYER_NAME, -5);
    this.gearDeath(e); // horse-gear-live.js: the horse inventory (the lead stays on the corpse)
    // EntityLivingBase.onDeath (sv.a(ro), bytecode-read): Entity.onKillEntity of the attacker (a zombie's villager rule) runs BEFORE dropFewItems, so the converted zombie joins the list ahead of the loot.
    if (e.type === "villager" && source.attacker?.type === "zombie") this.zombieKilledVillager(source.attacker, e);
    // ... and only while gamerule doMobLoot is true (dropFewItems, dropEquipment and the rare drop alike); each item joins the list now (emitLoot).
    if ((e.growingAge >= 0 || e.type === "zombie" || e.type === "pigman") && gameRule("doMobLoot")) {
      const at = { x: e.x, y: e.y, z: e.z };
      for (const [drop, damage, enchantments] of mobDrops(e, { playerHit: e.recentlyHit > 0, burning: e.fire > 0, bySkeleton: source.attacker === "skeleton", looting: source.player ? source.looting || 0 : 0, toLive: toLiveStack }, entityRandom(e)))
        this.emitLoot({ drop, count: 1, ...(damage ? { damage } : {}), ...(enchantments ? { enchantments } : {}), position: at });
    }
    e.death = 0;
    if (e.eatTimer) e.eatTimer = 0;
  }
  // /kill and the tests' kill: attackEntityFrom(DamageSource.outOfWorld, Float.MAX_VALUE) with no attacker, so no recentlyHit (no xp, no player-only drops)
  // unless a player hit it within the last 100 ticks. The 1.7.10 client jar has no command classes; Entity has no onKillCommand there (bytecode-read), and the
  // port's /kill only kills the sender player.
  kill(e, source = {}) {
    if (e.health <= 0) return;
    this.attackEntityFrom(e, 3.4028234663852886e38, { ...source, name: "outOfWorld" });
  }
  // EntityLivingBase.onDeathUpdate (sv.aF): at deathTime 20 a mob a player hit within the
  // last 100 ticks, not a child, leaves its experience (split into orbs by xpOrbs.spawn),
  // then is setDead with 20 "explode" puffs drawn on Entity.rand.
  deathUpdate(e, t) {
    e.death = (e.death || 0) + 1;
    if (e.death !== 20) return;
    freeRider(e); // onDeathUpdate's setDead at deathTime 20: the rider updating right after finds its mount dead and is let go within the same tick (b39 jockey kills)
    const rand = entityRandom(e);
    if (e.recentlyHit > 0 && (e.growingAge >= 0 || e.type === "zombie" || e.type === "pigman") && gameRule("doMobLoot")) {
      const world = (this.worldRandom ??= new JavaRandom(Math.floor(Math.random() * 2 ** 48)));
      this.emitLoot({ xp: experiencePoints(e, rand, world), position: { x: e.x, y: e.y, z: e.z } }); // onDeathUpdate spawns the orbs before setDead splits a slime
    }
    if (isSlimeLike(e)) this.splitSlime(e, rand);
    burst(this.fx, "explode", 20, { x: e.x, y: e.y, z: e.z, width: t.width, height: t.height }, rand); // draws g g g f f f x 20 on Entity.rand even without a client (onDeathUpdate's spawnParticle arguments)
  }
  // EntityLivingBase.fall (sv.b(F)): ceil(distance - 3) points of fall damage
  // (no jump boost), through attackEntityFrom without an attacker, so no knockback.
  fall(e, distance) {
    // Entity.fall: the rider falls with its mount (EntityPig calls super.fall; EntityHorse has its own fall).
    // The player's fall plays through the mount's event queue (EntityLivingBase.fall's sounds); a mob rider (the skeleton on a spider) falls as a mob.
    if (e.type === "pig") e.rider?.fall?.(distance, { sound: (s) => this.events.push({ sound: s.name, volume: s.volume, pitch: s.pitch, position: { x: e.x, y: e.y, z: e.z } }) });
    if (e.riddenBy && e.riddenBy !== e && this.entities.includes(e.riddenBy)) this.fall(e.riddenBy, distance);
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
    if ((name === "onFire" || name === "inFire" || name === "lava") && fireImmune(e)) return false; // Entity.dealFireDamage / setOnFireFromLava: nothing when isImmuneToFire
    return this.attackEntityFrom(e, points, { name });
  }
  // EntityLivingBase.onEntityUpdate after the fire (Entity.onEntityUpdate) and before the air: a mob
  // that is still alive and has a corner of its eye box (suffocation.js) inside a normal cube takes
  // attackEntityFrom(inWall, 1): armour is bypassed, the hurt window applies, no knockback.
  suffocate(e, t) {
    if (e.health > 0 && insideOpaqueBlock(this.world, e.x, e.y, e.z, t.width, livingEyeHeight(e.type, t.height))) this.hazard(e, 1, "inWall");
  }
  // EntityWitch.onLivingUpdate (yp.e), the server half before EntityLiving's: the drinking countdown and the rolls that start a drink
  // (witch.js witchDrink), on Entity.rand, then the effects of a finished potion are added.
  witchUpdate(e, t) {
    const m = this.ai.brain(e), target = m.attackTarget, w = { drinking: !!e.drinking, timer: e.drinkTimer || 0, held: e.held ?? null };
    const hasEffect = (id) => !!e.effects?.some((x) => x.id === id);
    const r = witchDrink(w, {
      rand: entityRandom(e), inWater: eyeInWater(this.world, e.x, e.y + livingEyeHeight(e.type, t.height), e.z), burning: e.fire > 0, health: e.health, maxHealth: t.health,
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
    // The same block ends with `if (isRiding() && ridingEntity instanceof EntityLivingBase) mountEntity(null)` (sv.C offset 278): a rider whose
    // head is in water steps off a living mount (every mob mount here is one), onto the mount's top.
    if (e.ridingEntity && !isVehicle(e.ridingEntity) && e.health > 0 && eyeInWater(this.world, e.x, e.y + livingEyeHeight(e.type, t.height), e.z)) mountEntity(e, null, (m) => this.size(m)[1]);
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
    if (!livingSoundRoll(e, rand, HOSTILE.has(e.type) || e.type === "villager" ? 80 : 120)) return;
    // EntityGolem.getLivingSound is "none" (wl.t): the sound is silent but r() still evaluates getSoundVolume and getSoundPitch (two nextFloat)
    // (village-fight-reference.json: the golem draws "f", "f" after a successful roll).
    if (e.type === "iron_golem" || e.type === "snow_golem") { rand.nextFloat(); rand.nextFloat(); return; }
    if (e.type === "creeper" || e.type === "giant" || isSlimeLike(e)) return; // EntityGiantZombie has no living sound (the roll still runs)
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
    // Entity.isImmuneToFire: no onFire damage, lava neither burns nor hurts (setOnFireFromLava does nothing). Entity.onEntityUpdate runs a positive counter
    // down by 4, but EntityLivingBase.onEntityUpdate (sv.C, `if (isImmuneToFire() || isRemote) extinguish()`) then zeroes it, so every tick leaves 0 (executed,
    // b53ft firetick): the move tail afterwards rests it at -1, or raises it to 1 inside a fire block, which therefore never ignites an immune mob.
    // EntityMagmaCube.handleLavaMovement (yf.P) is false: it ignores lava altogether.
    if (fireproof(e)) {
      e.fire = 0;
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
      setMobFire(e, 15); // setOnFireFromLava: setFire(15), shortened by Fire Protection
      e.fallDistance *= 0.5;
    }
    // Fire blocks and cactus act in moveEntity's tail (walk, block-collisions.js).
    e.burn = e.fire > 0 ? 1 : 0;
  }
  // EntityAnimal.interact (leads2-reference.json sizes): the check is the held stack itself, whatever its size (a stack of size <= 0 still feeds);
  // `--stackSize` and the emptying of a slot left at size <= 0 run outside Creative only.
  feed(e,id,survival){
    if(!this.entities.includes(e)||e.health<=0||!BREED_ITEM[e.type]||id!==BREED_ITEM[e.type]||(survival.inventory.held?.id!==id&&!survival.count(id)))return false;
    if(e.growingAge!==0||e.love>0)return false;e.love=600;
    if(!survival.creative){if(survival.inventory.held?.id===id)survival.inventory.decr(survival.inventory.current,1);else survival.take(id);}
    // EntityAnimal.func_146082_f: World.setEntityState(18), which the client shows as 7 hearts.
    // The client's handleHealthUpdate(18) draws these on its own copy's Entity.rand, never on the server's: a separate stream here.
    if(this.fx){const t=ENTITY_TYPES[e.type];burst(this.fx,'heart',7,{x:e.x,y:e.y,z:e.z,width:t.width,height:t.height},FX_RANDOM,0.5);}
    return true;
  }
  // EntityAIMate.spawnBaby (ua.g): the child of two animals in love (growingAge -24000,
  // at the mother's position, a sheep's colour from the parents' dyes), both parents'
  // age set to 6000 and love cleared, and 1 to 7 experience (its hearts are a server
  // spawnParticle, which singleplayer never shows). A full world
  // (40 mobs) keeps them waiting. Returns whether the baby was born.
  spawnBaby(a,b){
    if(this.entities.length>=40)return false;
    const baby=this.makeBaby(a,b);
    this.entities.push(baby);a.growingAge=b.growingAge=6000;a.love=b.love=0;a.mateTicks=b.mateTicks=0;
    // The breeding experience needs gamerule doMobLoot.
    // EntityAIMate.spawnBaby draws on the mother's Entity.rand: 7 "heart" spawnParticle argument sets (a server no-op, arguments still evaluated), then the orb's nextInt(7) + 1.
    const rand=entityRandom(a);burst(null,'heart',7,{x:a.x,y:a.y,z:a.z,width:ENTITY_TYPES[a.type].width,height:ENTITY_TYPES[a.type].height},rand,0.5);
    if(gameRule("doMobLoot"))this.emitLoot({xp:1+rand.nextInt(7),position:{x:a.x,y:a.y,z:a.z}});
    return true;
  }
  // The createChild half of the above (EntityAgeable.createChild of `a` with partner `b`): the unspawned baby.
  makeBaby(a,b){
    const baby=this.create(a.type,a.x,a.y,a.z);baby.growingAge=-24000;
    // EntityWolf.createChild (wv.b): the puppy of a tamed wolf is tamed to the same owner.
    if(a.type==='wolf')Object.assign(baby,puppyFields(a));
    // EntityOcelot.createChild (wn.b): a tamed parent's kitten has its owner and CatType.
    if(a.type==='ocelot')Object.assign(baby,kittenFields(a));
    // EntitySheep.createChild (wp.b(rx)): the lamb's colour is the parents' dye mix.
    if(a.type==='sheep')baby.color=childColor(a.color,b.color,this.random);
    if(a.type==='horse')Object.assign(baby,horseChildFields(a,b,entityRandom(a)));
    return baby;
  }
  // EntityAgeable.interact (rx.a): a spawn egg in hand on a living ageable mob. The click is consumed whatever the egg;
  // when the egg's class is assignable from the mob's (Cow also takes a mooshroom) the mob's createChild(itself) is spawned
  // as a baby (growing age -24000) at its position and one egg is used up outside Creative. `egg` is the SPAWN_EGGS row.
  spawnEggBaby(e, survival, egg) {
    if (!egg || !AGEABLE_EGG_TYPES[egg.entity]?.includes(e.type) || e.health <= 0) return false;
    let baby;
    if (e.type === "villager") baby = this.spawnVillagerChild(e);
    else this.entities.push(baby = this.makeBaby(e, e));
    if (!survival.creative) survival.take(survival.held.id);
    return baby;
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
    const melee = e.equipment ? meleeEffects(e.equipment[0]) : null;
    const hit = this.attackEntityFrom(target, f(mobHitAmount(e) + (melee ? melee.damage : 0)), { from: { x: e.x, z: e.z }, attacker: e, name: "mob", player: false });
    if (hit && melee) {
      // Knockback (EntityLivingBase.getKnockbackModifier): Entity.addVelocity along the mob's facing; Fire Aspect: setFire(level * 4).
      if (melee.knockback > 0) {
        const dx = target.x - e.x, dz = target.z - e.z, d = Math.hypot(dx, dz) || 1;
        addVelocity(target, f(f((dx / d) * melee.knockback) * 0.5), 0.1, f(f((dz / d) * melee.knockback) * 0.5));
      }
      if (melee.fire > 0) setMobFire(target, melee.fire);
    }
    if (hit && e.type === "zombie") {
      const ticks = zombieFireOnHit(entityRandom(e), this.difficulty, e.burn > 0 || e.fire > 0);
      if (ticks) setMobFire(target, ticks / 20);
    }
    // EntityCaveSpider.attackEntityAsMob: Poison (amplifier 0) on any living target.
    if (hit && e.type === "cave_spider") {
      const ticks = caveSpiderPoisonTicks(this.difficulty);
      if (ticks > 0) addMobEffect(target, 19, ticks, 0);
    }
    return hit;
  }
  // EntityZombie.onKillEntity (yq.a(sv)): on Normal (half the time) and Hard the villager is replaced by a zombie
  // villager: copyLocationAndAngles, EntityZombie.onSpawnWithEgg(null) (its rolls may add a child), isVillager, a child
  // villager makes a child zombie, then world event 1016 (mob.zombie.infect).
  zombieKilledVillager(zombie, villager) {
    if (!killConverts(this.difficulty, entityRandom(zombie))) return;
    const z = this.create("zombie", villager.x, villager.y, villager.z);
    this.entitySeed?.(z, "convert"); // replay hook (village-fight-replay.js): the new zombie's Entity.rand
    for (const k of ["yaw", "rotationYaw", "prevRotationYaw", "renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead", "rotationPitch", "prevRotationPitch"]) if (villager[k] !== undefined) z[k] = villager[k];
    this.onSpawnWithEgg(z);
    z.villager = true;
    if (villager.growingAge < 0) z.growingAge = -1;
    this.entities.push(syncInterpolation(z));
    this.tickOrder?.push(z);
    // The villager is removed at once (World.removeEntity), without a death animation or experience.
    villager.death = 20;
    villager.recentlyHit = 0;
    // World.removeEntity is setDead at once: the villager leaves the list now (a hit before the tick must not tick the corpse once more).
    villager.removedNow = true;
    const at = this.entities.indexOf(villager);
    if (at >= 0) this.entities.splice(at, 1);
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
    this.addSpawnBonus(v, spawnBonus(entityRandom(v))[0]);
    v.profession = (this.worldRandom ??= new JavaRandom(Math.floor(Math.random() * 2 ** 48))).nextInt(5);
    v.defaultReputation = true;
    if (e.growingAge < 0) v.growingAge = -24000;
    addMobEffect(v, NAUSEA, CURE_NAUSEA_TICKS, 0);
    this.entities.push(syncInterpolation(v));
    e.removedHealth = e.health; // setDead keeps the zombie's health (b53so)
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
    const hit = survival.scaledDamage(damage, "an Iron Golem", { attacker: null, from: e });
    if (hit) golemLift(survival); // EntityIronGolem.attackEntityAsMob: target.motionY += 0.4
    return hit;
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
    const brain = this.ai.brain(e), village = brain.village;
    if (!village) return;
    // Any living attacker is an aggressor (the player, a mob's melee, a shooter's arrow); only a player costs reputation.
    const attacker = source.player ? this.ai.player : villageAttacker(this, e, source.shooter ?? source.attacker);
    if (!attacker) return;
    village.addOrRenewAggressor(attacker);
    if (!source.player) return;
    village.changeReputation(source.playerName ?? PLAYER_NAME, e.growingAge < 0 ? -3 : -1);
    // status 13 is drawn by the client entity's Random (village-ai.js visualRandom), at the entity's real size
    if (e.health > 0) this.villageBurst("angryVillager", e, { width: brain.width, height: brain.height }, visualRandom(e));
  }
  // EntityVillager.onDeath (yv.a(ro)): killed by a player -2 reputation; by a monster the village ends its mating
  // season; with no known attacker, a player within 16 blocks ends it too.
  villagerDied(e, source) {
    const village = this.ai.brain(e).village;
    if (!village) return;
    if (source.player) village.changeReputation(source.playerName ?? PLAYER_NAME, -2);
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
      this.emitLoot({drop:WOOL,count:1,damage:e.color,offsetY:1,kick:[mx,my,mz],position:{x:e.x,y:e.y,z:e.z}});}
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
      horseCanMate,
      horseRunAround:(e)=>this.horseRunAround(e),
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
      despawn:(e)=>{e.despawnedHealth=e.removedHealth=e.health;e.health=0;e.death=20;freeRider(e);}, // setDead leaves the native health; the rest of that update (its path search's fall tries) still reads it (ai.js maxSafePointTries)
    });
  }
  // The mob tick reads blocks through the headless ring's view (resident column first, then the ring's), so mobs outside the resident
  // window move, path and take hazards against real terrain (headless-columns.js, natural-spawning.md "Round 5").
  tick(player, survival, heldItem=0) {
    const real = this.world;
    if (this.ring) this.world = this.ring.view;
    try { return this.tickMobs(player, survival, heldItem); } finally { this.world = real; }
  }
  // EntityLiving updates when its surroundings are loaded (World.updateEntityWithOptionalForce, ahb.a(sa, boolean)): the resident ticking
  // window, or any entity whose chunk and the two chunks around it are resident or held by the ring.
  isActive(e) { return entityActive(this.world, e) || !!this.ring?.active(e.x, e.z); }
  // Batch 48: World.spawnEntityInWorld runs inside the hurt call (EntityLivingBase.onDeath drops the loot, bytecode-read) and inside the dying mob's own onDeathUpdate (the orbs at
  // deathTime 20), appending to loadedEntityList while World.updateEntities walks it by index: the item or orb is first ticked later in the same pass. `spawnLoot` (a host hook: main.js
  // and the away run) turns the queued `drop` and `xp` events into entities at once, between two entries of the walk; without it they stay queued for the usual drain.
  // A bottle's orbs (`bottle`) are spawned by the potion walker. Scans only what was queued since the last call.
  flushLoot() {
    const spawn = this.spawnLoot, ev = this.events;
    if (!spawn) return;
    const from = Math.min(this.lootScan ?? 0, ev.length);
    let n = from, out = null;
    for (let i = from; i < ev.length; i++) { const x = ev[i]; if ((x.drop || x.xp) && !x.bottle) (out ??= []).push(x); else ev[n++] = x; }
    ev.length = n;
    this.lootScan = n;
    if (out) spawn(out);
  }
  // Batch 49: a drop or orb is spawned where the native call spawns it, not at the end of the entry's step. EntityLivingBase.onDeath -> dropFewItems/dropEquipment -> entityDropItem
  // runs inside the hurt call (bytecode-read), so the item joins loadedEntityList then, ahead of whatever the same call or step spawns next and for a hurt outside the walk
  // (a player's hit, /kill, a blast) at that moment, not after the tick. A host without `spawnLoot` keeps the event queued for drain().
  emitLoot(ev) {
    if (this.spawnLoot) this.spawnLoot([ev]);
    else this.events.push(ev);
  }
  // Events of a mob that ticked outside the resident ticking window are kept (natural-spawning.md "Round 6"): its drops and
  // experience become item entities and orbs that tick in the ring (streaming-ticks.js ringEntityActive), its explosions and block
  // edits apply there, and its positioned sounds go through the S29 range filter (sound-origin.js) like any other. A sound without a
  // position would play at the listener, so one of those is dropped.
  dropFarEvents(from) {
    let n = Math.min(from, this.events.length); // never extend the list with holes
    if (this.lootScan > from) this.lootScan = from;
    for (let i = from; i < this.events.length; i++) { const ev = this.events[i]; if (!ev.sound || ev.position) this.events[n++] = ev; }
    this.events.length = n;
  }
  // The client entity's EntityLivingBase.moveEntityWithHeading(0, 0) (entity-tracker.js): the same movement code on the same world. The water
  // and lava flags are the client entity's own (clientEnvironment); a chunk the streaming world has not loaded hovers.
  moveClient(c, m) {
    if (c.steered) { steerHorseCopy(c, this.riderLook?.()); return; } // wi.e(FF), the saddled horse the player rides: only the angles follow the rider; the motion is the server's (horse-copy.js)
    const [w, h] = this.size(m);
    c.stepHeight = m.stepHeight; c.aiMoveSpeed = 0;
    c.clientUnloaded = this.world.isLoaded ? !this.world.isLoaded(c.x, c.z) : false;
    // EntityFlying.moveEntityWithHeading (the ghast, no forward or strafe): moveEntity, then 0.8 in water, else 0.91 (0.546 on the ground); EntitySquid's
    // override is moveEntity alone: its gravity and swimming are the server's (isRemote guards them), so the client squid only coasts on packets
    if (m.type === "squid") {
      moveEntity(this.world, c, w, h, c.vx, c.vy, c.vz);
      // updateFallState inside moveEntity asks handleWaterMovement again for the box it moved to: a squid sinking into water splashes there
      if (c.inWater === false && inWater(this.world, c, w, h)) { c.inWater = true; enterWater(null, { x: c.x, z: c.z, minY: c.y, width: w, mx: c.vx, my: c.vy, mz: c.vz }, c.rand); }
    }
    else if (m.type === "ghast") {
      moveEntity(this.world, c, w, h, c.vx, c.vy, c.vz);
      const friction = c.inWater ? 0.8 : c.onGround ? f(f(0.6) * f(0.91)) : f(0.91);
      c.vx *= friction; c.vy *= friction; c.vz *= friction;
    } else moveEntityWithHeading(this.world, c, w, h, 0);
  }
  // Entity.onEntityUpdate on the client entity: handleWaterMovement (which pushes a living entity along the flow) and handleLavaMovement at the
  // client entity's own box. EntityMagmaCube.handleLavaMovement is false.
  clientEnvironment(c, m) {
    const [w, h] = this.size(m), r = w / 2;
    const wasInWater = c.inWater;
    c.inWater = inWater(this.world, c, w, h);
    c.inLava = m.type === "magma_cube" ? false : inLava(this.world, [c.x - r, c.y, c.z - r, c.x + r, c.y + h, c.z + r]);
    // the start of onLivingUpdate that runs on both sides: EntityBlaze (airborne and falling) and EntityWither damp the vertical motion by 0.6
    if (m.type === "blaze" && !c.onGround && c.vy < 0) c.vy *= 0.6;
    else if (m.type === "wither") c.vy *= 0.6000000238418579;
    else if (m.type === "squid") {
      // Entity.rand of the client copy is drawn by the splash (not on the entity's first update) and EntityLiving.onEntityUpdate's living-sound roll
      // each tick, before the rotation re-roll reads it; then EntityWaterMob.onEntityUpdate's ws.M() call (its flow push)
      if (c.inWater && wasInWater === false) enterWater(null, { x: c.x, z: c.z, minY: c.y, width: w, mx: c.vx, my: c.vy, mz: c.vz }, c.rand);
      livingSoundRoll(c, c.rand, SQUID.talkInterval);
      c.clientAir(this.clientSquidWet(c)); // EntityWaterMob.onEntityUpdate: ws.M() decides the air
    }
  }
  // ws.M() on the client entity: the water in its shrunk box pushes it along the flow (swimSquid record). Returns whether it is wet.
  clientSquidWet(c) {
    const r = squidWet(this.world, c);
    c.vx += r.push[0]; c.vy += r.push[1]; c.vz += r.push[2];
    return r.wet;
  }
  // The end of EntityLivingBase.onUpdate and what follows it in the client classes: the body turn, then EntityBat.onUpdate's tail (a hanging bat has
  // no motion and sits at floor(y) + 1 - height, a flying one damps its vertical motion by 0.6).
  clientAfterMove(c, m) {
    // wi.h()'s animation half on the client copy: its own counters from the watcher-16 flags it holds (the copy's own watcher 16, S0F / S1C through the tracker, entity-tracker.js, not the live horse's), and the tail roll on the copy's own Random (horse-copy.js stepHorseCopy)
    if (m.type === "horse") stepHorseCopy(c, c.horseFlags ?? 0);
    // EntitySquid.onLivingUpdate's second half on the client (isRemote: the swim motion is the server's): rotation, tentacles, body yaw
    if (m.type === "squid" && c.squid) squidLivingUpdate(c.squid, c, { rand: c.rand, wet: this.clientSquidWet(c), remote: true });
    clientBodyTurn(c);
    if (m.type !== "bat") return;
    if (c.batHanging) { c.vx = c.vy = c.vz = 0; c.y = Math.floor(c.y) + 1 - f(c.height); } else c.vy *= 0.6000000238418579;
  }
  /** The client entity's position for drawing: previous and current client positions (RenderManager's partial tick), or null when the
   *  client has no entity for it (a mount the player rides is driven by the client: its client position is the live one, entity-tracker.js followLive). A mob that rides another is drawn where its
   *  mount's updateRiderPosition put the client rider. */
  clientPosition(e) {
    return this.tracker?.clientIfTracked(e) ?? null;
  }
  /** The mob list the leash and nameplate renderer reads (horse-gear-renderer.js uses e.x, e.y, e.z): a mob with a leash or a name is
   *  replaced by a view that delegates every field to the live mob and overrides the position with its client entity's. The views persist,
   *  so renderers may key maps on them. */
  gearViews() {
    this.views ??= new WeakMap();
    // a mob that holds a leash is drawn at its client position too: the rope runs between client positions
    const holders = new Set();
    for (const e of this.entities) if (e.leash?.holder === "mob" && e.leash.holderUuid) holders.add(e.leash.holderUuid);
    return this.entities.map((e) => {
      if (!e.leash && !e.customName && !holders.has(e.uuid)) return e;
      const c = this.clientPosition(e);
      if (!c) return e;
      let v = this.views.get(e);
      if (!v) { v = Object.create(e); this.views.set(e, v); }
      v.x = c.x; v.y = c.y; v.z = c.z;
      v.leash = !e.leash || c.leash || e.leash.lost ? e.leash : undefined; // the rope shows once the client has the holder (S1B(1) resolved)
      return v;
    });
  }
  gearViewOf(e) { return (e && this.views?.get(e)) ?? e; } // the view gearViews() made of `e` (the aimed mob is compared by identity)
  // EntityPlayerMP.onUpdate (the S13 flush) runs at the player's place in loadedEntityList: an entity removed before that place flushes in the same pass (entity-tracker.js `beforePlayer`)
  beforePlayer(e) { const s = this.orderSeqs?.get(e); return s !== undefined && s < (this.orderSeqs.get(this.playerKey) ?? this.playerStamp ?? 0); }
  // Batch 53: the player joins loadedEntityList at a definite place. At login the world's own entities (loaded with its chunks) are in the list first and the player is appended
  // (ServerConfigurationManager.initializeConnectionToPlayer -> spawnEntityInWorld); what spawns or loads later stands after it. A dimension change keeps the player and its id
  // (the new world's list gets it at its first tick), a respawn is a new EntityPlayerMP: `fresh` takes a new entity id and the player moves to the end of the list again.
  // Bytecode-read. The player's stamp is in `orderSeqs` under `playerKey`, its id in `ids.playerId` (the tracker's set holds its entry, `MobTracker.joinPlayer`).
  playerJoined(fresh = false) {
    this.withBalls?.(this.entities.slice()); // every entity the world holds gets its place first (restored items, arrows and orbs after the mobs known so far)
    this.playerKey ??= { player: true };
    this.playerStamp = this.orderStamp();
    this.orderSeqs.set(this.playerKey, this.playerStamp);
    const ids = this.ids;
    if (ids && (fresh || ids.playerId === undefined)) ids.playerId = ids.take();
    if (ids && this.tracker) this.tracker.joinPlayer(ids.playerId);
  }
  leaveWorld(others = []) { this.tracker?.leaveWorld(others); } // a dimension change: the player leaves this world's tracker (entity-tracker.js leaveWorld)
  takeId(e) { if (e && typeof e === "object" && e.entityId === undefined && e.id === undefined && !Object.isFrozen(e)) e.entityId = this.ids.take(); }
  // World.loadedEntityList order: a stamp for every mob and ball, taken when it is first seen (balls at launch, mobs at the next launch or tick, in list order).
  orderStamp() {
    this.orderSeqs ??= new WeakMap();
    for (const e of this.entities) if (!this.orderSeqs.has(e)) this.orderSeqs.set(e, (this.orderCount = (this.orderCount ?? 0) + 1));
    return (this.orderCount = (this.orderCount ?? 0) + 1);
  }
  // `order` (the mobs in walking order) with the live fireballs placed among them by stamp: a ball launched before a mob joined updates before it, as it does natively.
  // `this.walks` (entity-simulation.js entityWalkers) adds arrows, thrown entities, items, orbs, TNT and falling blocks to that list: each has a stamp from
  // `joined` when it spawned, or is placed after the mobs known so far when it has none (a saved one, or a spawn site that does not report).
  joined(e, kind) {
    EntityWorld.prototype.takeId.call(this, e); // Entity.<init>: nextEntityID++ (an item, arrow, thrown entity, TNT, falling block or rocket takes its number at its creation)
    const w = this.walks?.get(kind);
    if (!w) return;
    this.orderSeqs ??= new WeakMap();
    this.orderSeqs.set(e, this.orderStamp()); // World.spawnEntityInWorld: appended at the end of loadedEntityList
    if (this.spawnsEarly()) (this.earlySpawns ??= new WeakSet()).add(e); // its spawn packet precedes the flush (entity-tracker.js jointUpdate); see spawnsEarly
    if (this.tickOrder) { (this.walkOf ??= new WeakMap()).set(e, w); this.tickOrder.push(e); } // spawned in the pass: it updates in this pass
  }
  // Batch 56 (executed: tracker-joint-reference.json mobSpawn cases). Where a spawn made now sends its packets against the player's destroy flush (EntityPlayerMP.onUpdate at its slot): a spawn
  // sends at once (World.spawnEntityInWorld -> addEntityToTracker -> updatePlayerList), so it is EARLY (before the flush) when made in the update of an entity before the player's slot, and
  // before the loop (SpawnerAnimals in WorldServer.tick) or in the network phase between ticks (a spawn egg, a thrown item, a drop from a dug block); LATE after the player's slot and in the
  // tile entity pass (a mob spawner; `tilePass`, main.js). A world that has no player yet (its opening population) is not early.
  spawnsEarly() {
    if (this.playerStamp === undefined) return false;
    if (this.tickOrder && this.slot) return this.beforePlayer(this.slot);
    return !this.tilePass;
  }
  // Mobs have no spawn hook: a mob not seen before is a spawn made since the last call, early or late as `early` says. `spawnLen` makes the in-pass check one comparison.
  noteMobSpawns(early) {
    const seen = (this.spawnSeen ??= new WeakSet());
    for (const e of this.entities) if (!seen.has(e)) { seen.add(e); if (early && this.playerStamp !== undefined) (this.earlySpawns ??= new WeakSet()).add(e); }
    this.spawnLen = this.entities.length;
  }
  endTilePass() { this.tilePass = false; this.noteMobSpawns(false); }
  withBalls(order) {
    const balls = this._fireballs?.list, others = [];
    if (this.walks?.size) {
      this.walkOf ??= new WeakMap();
      for (const w of this.walks.values()) for (const e of w.list()) if (!e.dead) { others.push(e); this.walkOf.set(e, w); }
    }
    if (!balls?.length && !others.length) return order;
    const next = this.orderStamp();
    for (const b of balls ?? []) if (!this.orderSeqs.has(b)) this.orderSeqs.set(b, next - 0.5); // a restored ball: after the mobs known so far
    for (const o of others) if (!this.orderSeqs.has(o)) { this.orderSeqs.set(o, next - 0.5); this.takeId(o); } // a restored item, arrow or orb: Entity.<init> numbered it when its chunk loaded, so it has its id before the tracker sees it
    for (const b of balls ?? []) if (!b.dead) others.push(b);
    // stamps looked up once per entity (the walk runs every tick over every item, orb and arrow), then a numeric sort of the pairs
    const seqs = this.orderSeqs, keyed = others.map((e) => [seqs.get(e) ?? 0, e]), out = [];
    keyed.sort((a, b) => a[0] - b[0]);
    let i = 0;
    for (const m of order) {
      const sm = seqs.get(m) ?? 0;
      while (i < keyed.length && keyed[i][0] < sm) out.push(keyed[i++][1]);
      out.push(m);
    }
    while (i < keyed.length) out.push(keyed[i++][1]);
    return this.seatRiders(out);
  }
  // World.updateEntities skips an entity riding a live mount and updateEntityWithOptionalForce updates the rider right after the mount's own update
  // (the rider's updateRidden, then the seat): a mob riding a walked cart or boat goes where its mount stands in the list, whatever its own stamp.
  seatRiders(out) {
    const mounts = this.walkOf;
    if (!mounts || !out.some((e) => e.ridingEntity && mounts.has(e.ridingEntity))) return out;
    const listed = new Set(out), res = [];
    for (const e of out) {
      const m = e.ridingEntity;
      if (m && mounts.has(m) && listed.has(m)) continue;
      res.push(e);
      const rider = mounts.has(e) ? e.passenger : null;
      if (rider && rider.ridingEntity === e && listed.has(rider)) res.push(rider);
    }
    return res;
  }
  // The explosion events a walked entity queued during its own update (a wither skull's), taken out of the queue so they run where the entity
  // stands in the list, as World.newExplosion does natively; every other event keeps its place for the usual drain.
  takeExplosions() {
    const taken = [];
    for (let i = this.events.length - 1; i >= 0; i--) if (this.events[i].explode) taken.unshift(...this.events.splice(i, 1));
    this.lootScan = 0;
    return taken;
  }
  tickMobs(player, survival, heldItem=0) {
    const night = !this.world.dimension &&
      survival.time % 24000 > 13000 && survival.time % 24000 < 23000;
    // World.isDaytime (skylightSubtracted < 4); main.js hooks the real light level in.
    this.day = this.isDaytime ? this.isDaytime() : !night;
    this.ai.beginTick(player, survival, heldItem);
    this.watching = player; // drainClientSounds: the one client (entity-tracker.js)
    // EntityTracker.updateTrackedEntities for the previous tick's end state: tracking list, encoded positions, the client's entities.
    this.tracker ??= new MobTracker(this.viewChunks);
    this.tracker.beforePlayer ??= (e) => this.beforePlayer(e);
    this.tracker.crystalFire ??= (c) => this.crystalFire?.(c); // client block layer hook (main.js, crystal-fire-layer.js)
    this.tracker.spawnEarly ??= (e) => !!this.earlySpawns?.has(e);
    this.noteMobSpawns(this.playerStamp !== undefined); // mobs made since the last tick's tile pass: the network phase (the spawner pass reports its own through noteMobSpawns(false))
    if (this.playerStamp === undefined) this.playerJoined(); // the player joins the list after what the world held when it opened
    if (this.viewChunks) this.tracker.viewChunks = this.viewChunks;
    const joint = this.walks?.size ? this.jointTracking?.() ?? null : null; // batch 51: the object tracker's entries walk in this one loop (main.js sets `jointTracking`)
    this.tracker.update(this.entities, player, (m) => this.size(m), this.clientPhysics ??= Object.assign((c, m) => this.moveClient(c, m), { turn: (c, m) => this.clientAfterMove(c, m), pre: (c, m) => this.clientEnvironment(c, m) }), joint);
    joint?.after?.(); this.jointRan = !!joint;
    // What the client copies did: the dragon's wing flap sound and its death puffs (the server's own particle accessor is a no-op)
    for (const x of this.tracker.takeFx()) {
      if (x.particle) this.fx?.spawn(x.particle, x.x, x.y, x.z, 0, 0, 0);
      else if (x.sound && !x.silent) this.clientSounds.push({ sound: x.sound, volume: x.volume, pitch: x.pitch, position: { x: x.x, y: x.y, z: x.z }, clientOnly: true });
    }
    // World.tick: villageCollectionObj.tick() before the entities.
    this.villages.tick();
    // Leash knots, witch potions, wither skulls and snow golem snowballs tick in the walk below when `walks` holds their kind (entity-simulation.js entityWalkers).
    if (!this.walks?.has("knot")) this.knotTick(); // horse-gear-live.js: EntityLeashKnot.onUpdate (fence check every 101st tick)
    if (!this.walks?.has("potion")) this.potions?.tick(player, survival); // witch-potions.js; main.js attaches it
    if (!this.walks?.has("skull")) this._skulls?.tick(); // wither skulls (wither-boss-mobs.js)
    if (!this.walks?.has("golemBall")) this._golemBalls?.tick(); // snow golem snowballs (mooshroom-golem-live.js)
    // WorldServer.tick: SpawnerAnimals.findChunksForSpawning (spawner-animals.js) while gamerule doMobSpawning is true, before the
    // entities update. worldTicks stands in for WorldInfo.getWorldTotalTime (animals every 400 ticks).
    this.worldTicks = (this.worldTicks ?? -1) + 1;
    if (this.worldTicks % 20 === 0) this.sweepFrozen(player);
    if (this.naturalSpawning && gameRule("doMobSpawning")) this.naturalSpawn(player, survival);
    // A mob spawned during the loop (a baby) joins the next tick's updates, as World.spawnEntityInWorld queues it.
    releaseDead(this.entities);
    const peacefulGone = [];
    // Entity.updateRidden ends with updateRiderPosition: the seat is taken right after the rider's own update, before the next mob of the list moves (b36 records: a mob after the mount pushes the rider at its new seat).
    let rider = null;
    const seat = () => { if (rider?.ridingEntity) endRidden(rider, (m) => this.size(m)[1]); rider = null; };
    let farMark = -1; // index of the first event of the unticked-window mob being updated
    // World.spawnEntityInWorld adds to loadedEntityList at once and updateEntities walks it by index: a zombie that a kill converts a villager into updates in this same pass.
    this.noteMobSpawns(true); // a spawn before the loop (natural spawning in WorldServer.tick) sends before the flush
    const order = this.tickOrder = this.withBalls(ridingOrder(this.entities.slice())); // fireballs interleave with the mobs by when each joined the list (fireballs-b42-reference.json)
    trackSections(this, order, true); // b53so: where each entity is filed when the pass starts (saved-order.js)
    if (this.lateEntity) order.push(this.lateEntity); // replay hook: a stand-in for the arrows at the end of the list, so a zombie one of them hurts into a reinforcement joins after it and ticks in this pass
    // The step flushes the entry's death loot (flushLoot) even after a `continue`, before the length is read again: an item or orb appended in this entry's turn is walked in this pass.
    let prevEntity = null; // b54so: World.updateEntityWithOptionalForce's chunk/section check runs right after each entity's own update (and its rider's seat): done at the next turn's start
    const sections = () => { if (prevEntity) trackSections(this, [prevEntity]); prevEntity = null; };
    for (let oi = 0; oi < order.length; oi++, this.flushLoot()) {
      if (this.entities.length !== this.spawnLen) this.noteMobSpawns(!!this.slot && this.beforePlayer(this.slot)); // b56tm: a mob the entity before this one spawned
      const e = this.slot = order[oi]; // b55dt: whose update this is (a spawn made now is early or late against the player's flush, `joined`)
      seat();
      sections();
      if (e.lateHook) { e.lateHook(); continue; }
      if (farMark >= 0) { this.dropFarEvents(farMark); farMark = -1; }
      const walk = this.walkOf?.get(e);
      // A rider that sat down during this pass (a cow taken aboard by a cart's push): World.updateEntities skips an entity riding a live mount at its own place; the rider's
      // update follows the mount's (below). One already seated at the start of the pass was put right after its mount by seatRiders.
      const mount = e.ridingEntity;
      if (mount && !walk && order[oi - 1] !== mount && !mount.dead && mount.passenger === e && this.walkOf?.has(mount)) continue;
      prevEntity = e; // a rider skipped at its own place gets no check here (updateEntities `continue`s before updateEntity); its check follows its update after the mount's
      if (walk) { // an arrow, item, orb, thrown entity, TNT or falling block (entity-simulation.js)
        walk.tick(e);
        // updateEntityWithOptionalForce updates the rider of the mount it just ticked: one that sat down in this pass (before or after the mount's place in the list) goes now
        const r = walk.pushMob ? e.passenger : null;
        if (r && r.ridingEntity === e && !e.dead && order[oi + 1] !== r && this.entities.includes(r)) order.splice(oi + 1, 0, r);
        continue;
      }
      if (e.type === "fireball") { this._fireballs.tickOne(e); continue; } // a ball (fireballs.js) updates where it stands in the list
      if (e.removedNow || !this.isActive(e)) continue;
      // Loot queued before this entry (a kill outside the tick: a horse's saddle at onDeath) is flushed first, so the far mob's flushLoot cannot shrink the list below the mark (holes in events)
      if (this.ring && !this.world.isTicking(e.x, e.z)) { this.flushLoot(); farMark = this.events.length; }
      if (e.ridingEntity) { rider = e; beginRidden(e); }
      // World.updateEntityWithOptionalForce and EntityLivingBase.onEntityUpdate
      // keep last tick's state for RenderManager and RendererLivingEntity.
      e.px = e.x;
      e.py = e.y;
      e.pz = e.z;
      e.prevRotationYaw = e.rotationYaw;
      if (e.type === "silverfish") e.renderYawOffset = e.rotationYaw; // EntitySilverfish.onUpdate (yk.h): renderYawOffset = rotationYaw before the living update (b50lb executed)
      e.prevRenderYawOffset = e.renderYawOffset;
      e.prevRotationYawHead = e.rotationYawHead;
      e.prevRotationPitch = e.rotationPitch;
      e.prevLimbSwingAmount = e.limbSwingAmount;
      const base=ENTITY_TYPES[e.type],scale=mobScale(e),t={...base,width:base.width*scale,height:base.height*scale};
      if (e.type === "ender_dragon") { dragonUpdate(this, e, player, survival); continue; } // EntityDragon (dragon-mobs.js)
      if (e.type === "ender_crystal") { if (e.health > 0) crystalUpdate(this, e); continue; } // EntityEnderCrystal.onUpdate: fire in the End, nothing else
      // EntityMob.onUpdate (yg.h): super.onUpdate() runs in full (movement, AI and their draws, a corpse's death tick) and then, on Peaceful, the mob is setDead
      // with no death or drops: removed at the end of this tick (below).
      if (HOSTILE.has(e.type) && this.difficulty === PEACEFUL) peacefulGone.push(e);
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
          e.removedHealth = e.health; // setDead keeps the health the creeper had (creeperwitch-b45 records); the corpse state below is the port's removal
          e.health = 0;
          e.death = 20;
          // EntityCreeper.func_146077_cc calls World.createExplosion inside the creeper's own update: the blast hurts and pushes the mobs listed after it before they move
          // in this same pass (creeperwitch-b45 bystander records). The host queues it otherwise, and the drain runs it after the pass.
          if (this.explodeInline) for (const ev of this.takeExplosions()) this.explodeInline(ev);
          continue;
        }
      }
      // EntityPigZombie.onUpdate (yh.h) runs its angry sound before EntityZombie.onUpdate and so before the ambient say roll (b38 records: f f, then i1000).
      if (e.type === "pigman") pigmanTick(this, e, entityRandom(e));
      // EntityZombie.onUpdate (yq.h): a converting zombie counts its timer down before EntityLivingBase.onUpdate.
      if (e.conversionTime !== undefined && this.tickConversion(e)) continue;
      e.age++;
      e.attack = Math.max(0, e.attack - 1);
      e.flee = Math.max(0, e.flee - 1);
      // EntityLivingBase.onEntityUpdate: the revenge target lapses after 100 ticks.
      if (e.revenge && (e.age + 1 - e.revenge > 100 || (revengeOf(e) !== "player" && !(revengeOf(e)?.health > 0 && this.entities.includes(revengeOf(e)))))) e.revenge = 0;
      // Entity.onEntityUpdate (sa.C, bytecode-read): a sprinting mob out of water spawns the block-crack sprint particle over a non-air block below; the server's spawnParticle
      // is a no-op but its two nextFloat offsets (x, z) are drawn on Entity.rand first. Only the ocelot sprints (move speed 1.33).
      if (e.sprinting && !e.inWater && this.world.get(Math.floor(e.x), Math.floor(e.y - 0.2), Math.floor(e.z)) !== 0) { const r = entityRandom(e); r.nextFloat(); r.nextFloat(); }
      const wasInWater = e.inWater;
      if (e.inWater = inWater(this.world, e, t.width, t.height)) e.fallDistance = 0;
      // Entity.handleWaterMovement: entering water (not on the entity's first update, when
      // inWater is still unset) splashes. EntityMob plays the hostile sound.
      if (e.inWater && wasInWater === false) this.splash(e, t);
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
      tickMobEffects(e, t, () => maxHealthOf(e, base.health), entityRandom(e), this.fx, (m, n, name) => this.attackEntityFrom(m, n, { name })); // Potion.wither / instant damage: DamageSource.wither / magic (both bypass armour)
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
        if (light > 0.5 && f(entityRandom(e).nextFloat() * 30) < f(f(light - f(0.4)) * 2) && this.ai.deps.canSeeSky(bx, Math.floor(e.y), bz)) setMobFire(e, 8);
      }
      // EntityLivingBase.onUpdate's equipment block (before onLivingUpdate, so before the AI): when a slot differs from the last update's, the old stack's attribute modifiers leave the
      // attribute map and the new one's join it. A sword given after a mob's own update (loot pickup, another mob's hit) therefore adds its damage from the NEXT update (b36 records).
      if (e.equipment) e.attackEquipment = e.equipment.map((s) => (s ? { id: s.id } : null));
      // EntityLiving.onLivingUpdate runs the AI (ai.js) between the motion snap and the
      // jump/move: tasks, navigator, move/look/jump helpers.
      if (e.type === "witch") this.witchUpdate(e, t);
      if (e.type === "horse" && entityRandom(e).nextInt(200) === 0) (e.horseAnim ??= newHorseAnim()).tail = 1; // EntityHorse.onLivingUpdate (wi.e): the tail roll (wi.cR starts bp) comes before EntityAnimal.onLivingUpdate (the AI); horseTick steps it
      if (e.ridingEntity) this.walk(e, t, 0, () => this.ridden(e)); // mob-riding.js: a rider runs its whole update (AI, then its own move from the seat it was left at), then the seat takes it
      else if (isSlimeLike(e)) this.slimeTick(e, t);
      else {
        if (e.type === "enderman") endermanTick(this, e, entityRandom(e));
        this.walk(e, t, 0, () => e.type === "horse" && e.rider && e.horse.saddled ? horseRideThink(this, e) : e.type === "horse" && (e.rearing || e.horse?.eating) ? (e.aiSkipped = (e.aiSkipped || 0) + 1, e.jumping = false, e.moveStrafing = 0, e.moveForward = 0) : /* EntityHorse.isMovementBlocked (rearing or eating): sv.e skips the AI and zeroes the input */ isLegacyCreature(e) ? legacyThink(this, e, t, aiMoveSpeed, entityRandom) : e.type === "enderman" ? endermanThink(this, e, t, aiMoveSpeed, entityRandom, legacyThink) : e.type === "silverfish" ? this.silverfishThink(e) : e.type === "giant" ? this.giantThink(e) : e.type === "blaze" ? blazeThink(this, e, t, aiMoveSpeed) : this.ai.think(e));
      }
      this.push(e, t);
      this.lootPickupOne(e);
      // EntityAgeable.onLivingUpdate (rx.e) ages after EntityLiving's (AI, move, push, loot), then EntityAnimal.onLivingUpdate (wf.e, bytecode-read): a mob that is not an adult loses its love,
      // otherwise inLove counts down and every 10th tick draws the heart particle's arguments on Entity.rand (3 gaussians, then 3 floats; the server's spawnParticle is a no-op).
      const wasAge = e.growingAge;
      if (e.growingAge < 0 && e.type !== 'zombie') e.growingAge++; else if (e.growingAge > 0) e.growingAge--;
      if (e.type === "horse" && wasAge < 0) this.horseGrowSize(e, wasAge); // EntityHorse.setScaleForAge: the foal's box widens every tick
      if (ANIMALS.has(e.type)) {
        if (e.growingAge !== 0) e.love = 0;
        if (e.love > 0 && --e.love % 10 === 0) burst(null, "heart", 1, { x: e.x, y: e.y, z: e.z, width: t.width, height: t.height }, entityRandom(e), 0.5);
      }
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
    if (farMark >= 0) this.dropFarEvents(farMark);
    // Entity.updateRidden's tail for each rider: updateRiderPosition, then the rider turns with its mount.
    seat();
    sections(); // b53so / b54so: an entity that changed chunk or section joins the end of its new list right after its own update (saved-order.js)
    for (const w of this.walks?.values() ?? []) w.reap();
    this._fireballs?.reap(); // the balls updated in the walk above; World.updateEntities drops the setDead ones
    if (this.entities.length !== this.spawnLen) this.noteMobSpawns(!!this.slot && this.beforePlayer(this.slot));
    this.tickOrder = null; this.slot = null;
    // EntityPlayerMP.onUpdateEntity (mw.i), in the network tick after the world's entities: EntityLivingBase.onLivingUpdate on the server's copy of the player (its motion
    // is only what mobs, hits and explosions gave it: snapped below 0.005, moved, then slowed by the ground friction) and, at its end, collideWithNearbyEntities: every mob beside
    // the moved box is pushed by (and pushes) the player (b46mp records).
    this.tilePass = true; // b56tm: until the hook's network part (main.js tickServerDig -> endTilePass) a spawn is a tile entity pass spawn: late against the flush
    try { this.afterEntities?.(); } finally { this.tilePass = false; } // World.updateEntities' tile entity pass (moving piston blocks push mobs and the copy: b48pp records), after every entity and before the network tick
    const p = this.ai.player;
    if (p?.alive && !p.unticked) { // `unticked`: the village-fight replay's player, which the native probe never ticks
      this.serverPlayerUpdate(p);
    }
    for (const e of peacefulGone) { e.removedHealth = e.health; e.health = 0; e.death = 20; }
    this.entities = this.entities.filter((e) => e.health > 0 || e.death < 20);
  }
  // The tick of the server's copy of the player (see tick): EntityPlayerMP.onUpdateEntity (mw.i). Entity.onEntityUpdate's handleWaterMovement (the flow push) and lava flag, then
  // EntityLivingBase.onLivingUpdate: the motion snap below 0.005 (y too), moveEntityWithHeading with no input (the copy is a plain EntityPlayerMP: stepHeight 0, its own sneak flag
  // and the sneak edge, water 0.8 / lava 0.5 drag, ladder clamp, web, the ground or 0.91 friction, and a flying player's motionY * 0.6) with Entity.moveEntity's block collisions on
  // its own motion, then collideWithNearbyEntities against the moved box. NetHandlerPlayServer.processPlayer puts the copy's position back right after the update
  // (setPositionAndRotation at the position it had), so only the motion, the web flag and the pushes keep what the move did (b47sp records).
  serverPlayerUpdate(p) {
    const m = p.motion, w = p.width, h = p.height, world = this.world;
    // EntityLivingBase.onEntityUpdate: the revenge target (getAITarget) is dropped once it is dead or more than 100 ticks old.
    const hb = p.hurtBy;
    if (hb && typeof hb.health === "number" && (!(hb.health > 0) || !this.entities.includes(hb) || this.ai.clock - p.hurtByTime > 100)) p.hurtBy = null;
    const e = { x: p.x, y: p.y, z: p.z, vx: m.x, vy: m.y, vz: m.z, onGround: p.onGround, inWater: false, inLava: false, sneaking: !!p.sneaking, player: true, living: true, inWeb: p.inWeb, fallDistance: 0, stepHeight: 0, moveStrafing: 0, aiMoveSpeed: 0, rotationYaw: 0 };
    e.inWater = inWater(world, e, w, h); // Entity.handleWaterMovement (the flow adds to the motion)
    e.inLava = inLava(world, [e.x - w / 2, e.y, e.z - w / 2, e.x + w / 2, e.y + h, e.z + w / 2]);
    if (Math.abs(e.vx) < 0.005) e.vx = 0; // EntityLivingBase.onLivingUpdate
    if (Math.abs(e.vy) < 0.005) e.vy = 0;
    if (Math.abs(e.vz) < 0.005) e.vz = 0;
    const vy = e.vy;
    moveEntityWithHeading(world, e, w, h, 0);
    if (p.flying && !p.riding) e.vy = vy * 0.6; // EntityPlayer.moveEntityWithHeading (yz.e(FF)): a flying player keeps 0.6 of the vertical motion it had
    m.x = e.vx; m.y = e.vy; m.z = e.vz;
    p.inWeb = !!e.inWeb;
    p.onGround = e.onGround; // Entity.moveEntity wrote it on the copy: the next piston push (World.updateEntities' tile loop) moves a sneaking copy with the edge guard only if this stayed true (b48pp)
    const at = { x: e.x, y: e.y, z: e.z, width: w, height: h };
    const box = pushBox(at, w, h), near = [box[0] - 0.2, box[1], box[2] - 0.2, box[3] + 0.2, box[4], box[5] + 0.2];
    for (const o of this.entities) {
      if (Math.abs(o.x - at.x) <= 12 && Math.abs(o.z - at.z) <= 12 && Math.abs(o.y - at.y) <= 12 && !o.rider?.player && pushable(o) && boxesMeet(near, pushBox(o, ...this.size(o)))) {
        pushServerPlayer(p, o, at, true); // o.applyEntityCollision(player): the mob and the player both move
      }
    }
  }
  // A dying mob: onDeathUpdate, recentlyHit running down, then onLivingUpdate with its movement
  // blocked (sv.bh): it slides on its knockback, falls and is pushed, with no AI input.
  dying(e, t) {
    // EntitySlime.onUpdate (ym.h) wraps a corpse's update too: the squish before and after, and its blocked movement zeroes moveForward and moveStrafing.
    const slime = isSlimeLike(e);
    if (slime) slimeSquishStart(e);
    this.deathUpdate(e, t);
    if (e.recentlyHit > 0) e.recentlyHit--;
    e.jumping = false;
    if (e.type === "blaze") blazeUpdate(this, e, t, true); // EntityBlaze.onLivingUpdate runs for a corpse too (its hover push, the 0.6 fall damping and its draws), before EntityLivingBase's blocked movement
    if (e.type === "witch") this.witchUpdate(e, t); // EntityWitch.onLivingUpdate (yp.e) runs for a corpse too: the drink roll draws and can still start a drink (creeperwitch-b45 records)
    e.moveStrafing = 0; // EntityLivingBase.onLivingUpdate: isMovementBlocked (health <= 0) zeroes strafing, forward (walk) and randomYawVelocity for every corpse, so a blaze's last strafe no longer pushes it
    if (slime) e.moveForward = 0;
    this.walk(e, t, 0);
    if (slime) this.slimeSquishFinish(e, entityRandom(e));
    this.push(e, t);
    if (e.type === "chicken") this.chickenUpdate(e);
    this.swingLimbs(e);
    if (e.leash) this.leashTick(e); // EntityLiving.onUpdate -> updateLeashedState also runs for a corpse (horse-gear-live.js)
  }
  size(o) {
    if (isVehicle(o)) return vehicleSize(o); // a boat or minecart a rider asks the height of (vehicle-seat.js)
    const base = ENTITY_TYPES[o.type], s = mobScale(o);
    return [base.width * s, base.height * s];
  }
  // EntityLivingBase.collideWithNearbyEntities (sv.bo), the end of onLivingUpdate on the
  // server: every pushable entity (living mobs until setDead, and the player) whose box meets
  // this one's grown by 0.2 sideways runs applyEntityCollision against it.
  push(e, t) {
    const box = pushBox(e, t.width, t.height), near = [box[0] - 0.2, box[1], box[2] - 0.2, box[3] + 0.2, box[4], box[5] + 0.2];
    // Cheap reject: the largest boxes (dragon 16 wide, giant 10.8 tall) reach under 12 blocks from their origin, so beyond 12 in x, z or y
    // no box can meet and the pair is skipped without changing the result (the O(n^2) scan is the ring-mob cost).
    for (const o of this.entities)
      if (o !== e && Math.abs(o.x - e.x) <= 12 && Math.abs(o.z - e.z) <= 12 && Math.abs(o.y - e.y) <= 12 && o.ridingEntity !== e && e.ridingEntity !== o && pushable(o) && boxesMeet(near, pushBox(o, ...this.size(o)))) {
        if (e.type === "iron_golem" && golemCollideRetargets(entityRandom(e), o.type)) this.ai.brain(e).attackTarget = this.ai.brain(o); // EntityIronGolem.collideWithEntity
        applyEntityCollision(o, e); // Entity.applyEntityCollision: not a mount and its rider
      }
    // The carts and boats beside it push it (their applyEntityCollision) in its own update, when the loaded-entity walk holds them (entity-simulation.js `pushMob`).
    this.walks?.get("cart")?.pushMob?.(e);
    this.walks?.get("boat")?.pushMob?.(e);
    const p = this.ai.player;
    if (p?.alive && !e.rider?.player && boxesMeet(near, pushBox(p, p.width, p.height))) pushServerPlayer(p, e); // e.applyEntityCollision on the player: both move (the server's copy of the player gets the motion)
    if (e.type === "iron_golem") this.golemTailTick(e);
  }
  // The end of EntityIronGolem.onLivingUpdate: the attack/rose counters and the walking dust (iron-golem.js golemTail).
  golemTailTick(e) {
    const w = this.world, spec = golemTail(e, entityRandom(e), (x, y, z) => { const id = w.get(x, y, z); return id ? { id, meta: w.getMeta?.(x, y, z) ?? 0 } : null; });
    if (spec) this.blockParticle?.(spec.id, spec.meta, spec.x, spec.y, spec.z, spec.vx, spec.vy, spec.vz);
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
  // moveEntity's tail: cactus and fire (inFire) damage, webs, the fire counter and the rain fizz.
  moveHooks(e, t) {
    const self = this;
    return {
      living: true,
      armor: e.equipment,
      hurt: (source, points) => this.hazard(e, points, source),
      get wet() { return e.inWater || !!self.wet?.(e, t.height); },
      fizz: () => this.events.push({ sound: "random.fizz", volume: 0.7, pitch: f(1.6 + f(f(this.random() - this.random()) * 0.4)), position: { x: e.x, y: e.y, z: e.z } }),
    };
  }
  // Entity.handleWaterMovement's splash on entering water: the sound, then the bubble and splash particles (draws on Entity.rand).
  splash(e, t, motion = [e.vx, e.vy, e.vz]) {
    const s = enterWater(this.fx, { x: e.x, z: e.z, minY: e.y, width: t.width, mx: motion[0], my: motion[1], mz: motion[2] }, entityRandom(e));
    this.events.push({ sound: HOSTILE.has(e.type) ? "game.hostile.swim.splash" : "game.neutral.swim.splash", volume: s.volume, pitch: s.pitch, position: { x: e.x, y: e.y, z: e.z } });
  }
  // EntityLivingBase.updateFallState (inside moveEntity, after the move): a mob not yet in water asks handleWaterMovement again with the box it
  // just moved to, so a mob that sinks into water splashes during that tick's move, not at the start of the next.
  waterAfterMove(e, t) {
    if (e.inWater !== false || !inWater(this.world, e, t.width, t.height)) return;
    e.inWater = true;
    e.fallDistance = 0;
    this.splash(e, t, e.moveMotion ?? undefined); // sv.a(DZ) runs inside moveEntity: the motion is the move's, before the drag after it
  }
  // moveEntity's step tail (mob-steps.js): every mob with canTriggerWalking plays its own step event.
  moveSteps(e, from) {
    const rand = entityRandom(e);
    this.events.push(...mobStepEvents(this.world, e, from, { hostile: isEntityMob(e.type), random: () => rand.nextFloat(), nextInt: (n) => rand.nextInt(n), onWalk: (x, y, z) => this.onEntityWalking?.(x, y, z, e) }));
  }
  // The landing of a move (EntityLivingBase.fall).
  moveLanding(e, landed) {
    if (landed > 0) this.onLand?.(e, landed);
    // EntityLivingBase.updateFallState (sv.a(DZ)): over 3 blocks of fall onto a solid block, level event 2006 (the landing dust) with ceil(fall - 3), for every living mob (legacy-ai records)
    if (landed > 3) {
      const x = Math.floor(e.x), y = Math.floor(e.y - 0.20000000298023224), z = Math.floor(e.z);
      if (this.world.get(x, y, z)) this.landingDust?.(e, x, y, z, Math.ceil(f(landed - 3)));
    }
    // EntityChicken.fall, EntityBat.fall, EntityOcelot.fall and EntityGolem.fall do nothing.
    if (landed > 0 && e.type !== "chicken" && e.type !== "bat" && e.type !== "ocelot" && e.type !== "snow_golem" && e.type !== "iron_golem" && e.type !== "magma_cube") this.fall(e, landed); // EntityMagmaCube.fall does nothing
  }
  // TileEntityPiston.func_145863_a moves a mob with Entity.moveEntity (no living class overrides it): the same move, tails,
  // step events and landing as moveWith's for the piston's delta, stepHeight 0.5 (enderman 1). Returns the landing distance.
  pushMove(e, dx, dy, dz) {
    const base = ENTITY_TYPES[e.type];
    if (!base) return 0;
    const s = mobScale(e), t = { ...base, width: base.width * s, height: base.height * s }, from = { x: e.x, y: e.y, z: e.z };
    const landed = moveEntity(this.world, e, t.width, t.height, dx, dy, dz, e.type === "enderman" ? 1 : e.stepHeight ?? STEP_HEIGHT, this.moveHooks(e, t));
    // Entity.moveEntity (sa.d) is one method for the piston's push and a mob's own walk: updateFallState's landing comes before the step sound (the executed walking records of enderman-wolf-b44).
    this.moveLanding(e, landed);
    this.moveSteps(e, from);
    return landed;
  }
  // EntityLivingBase.moveEntityWithHeading(strafe, forward) with this engine's tails; walk() runs it once a tick and
  // EntityAIControlledByPlayer (ai.js, pig-saddle.js) once more from inside the AI.
  moveWith(e, t, forward) {
    const from = { x: e.x, y: e.y, z: e.z };
    const landed = moveEntityWithHeading(this.world, e, t.width, t.height, forward, this.moveHooks(e, t));
    this.waterAfterMove(e, t);
    // Entity.moveEntity (sa.d, bytecode-read): updateFallState (the landing's hurt-fall and step sounds) runs before the step sound at the end.
    this.moveLanding(e, landed);
    this.moveSteps(e, from);
    e.moveMotion = null;
    // The finite world's edge stops a mob like a wall.
    // A streamed world's edge is its border (the 30,000,000 limit), not the resident window: mobs walk into the ring beyond it.
    const w = this.world, lim = (axis, hi) => w.streaming ? (hi ? 30000000 : -30000000) - (axis === "x" ? w.originX || 0 : w.originZ || 0) : w[(hi ? "max" : "min") + axis.toUpperCase()];
    const edge = (axis, v) => {
      const c = Math.max((lim(axis, false) ?? 0)+0.6, Math.min((lim(axis, true) ?? SIZE)-0.6, e[axis]));
      if (c !== e[axis]) (e[axis] = c), (e[v] = 0);
    };
    edge("x", "vx");
    edge("z", "vz");
  }
  // EntitySlime.onUpdate (ym.h): the squish before and after EntityLivingBase.onUpdate (walk), the landing particles
  // ("slime" is EntityBreakingFX with a slimeball) and sounds, then onCollideWithPlayer. slime.js holds the rules.
  slimeTick(e, t) {
    const rand = entityRandom(e);
    slimeSquishStart(e);
    this.walk(e, t, 0, () => this.slimeThink(e));
    e.slimeForward = e.moveForward;
    e.slimeStrafe = e.moveStrafing || 0;
    this.slimeSquishFinish(e, rand);
    e.yaw = (-e.rotationYaw * Math.PI) / 180;
    // EntityPlayer.collideWithPlayer reaches mobs within the player's box grown 1 block sideways; b_ then needs size > 1,
    // line of sight and distance^2 < (0.6 * size)^2 (centre to centre), and hits for `size`.
    const p = this.ai.player, s = this.ai.survival;
    if (p?.alive && !s.creative && e.health > 0 && slimeTouches(e.size, (p.x - e.x) ** 2 + (p.y - e.y) ** 2 + (p.z - e.z) ** 2, this.ai.brain(e).canSee(p), isMagma(e) || undefined)) {
      // EntitySlime.func_175451_e (ym.b_): a landed hit plays mob.attack at volume 1, pitch (rand - rand) * 0.2 + 1, both draws on the slime's Entity.rand
      if (this.hitPlayer(e, s)) { const rand = entityRandom(e); this.events.push({ sound: "mob.attack", volume: 1, pitch: f(f(f(rand.nextFloat() - rand.nextFloat()) * f(0.2)) + 1), position: { x: e.x, y: e.y, z: e.z } }); }
    }
  }
  slimeSquishFinish(e, rand) {
    slimeSquishEnd(e, rand, (dx, dz) => this.fx?.spawn(isMagma(e) ? MAGMA.particle : "slime", e.x + dx, e.y, e.z + dz, 0, 0, 0), (sound, volume, pitch) => this.events.push({ sound, volume, pitch, position: { x: e.x, y: e.y, z: e.z } }));
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
      this.entitySeed?.(child, "slime-split"); // the replays seed the child's Entity.rand (its constructor's draws and first jump delay)
      for (const key of ["rotationYaw", "prevRotationYaw", "renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead", "bodyHeadYaw"]) child[key] = k.yaw;
      child.yaw = (-k.yaw * Math.PI) / 180;
      this.entities.push(child);
      this.tickOrder?.push(child); // World.spawnEntityInWorld appends to the list being walked: the child updates in this pass (legacy-ai records)
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
  // SpawnerAnimals.findChunksForSpawning(world, spawnHostileMobs, spawnPeacefulMobs, totalTime % 400 == 0) for the one player
  // (spawner-animals.js, natural-spawning.md). The integrated server spawns hostile mobs unless the difficulty is Peaceful and
  // peaceful ones always; creative players count like any other. Lists come from the chunk provider: the biome (World.getBiomeGenForCoords
  // reads the stored biomeID), the witch hut in a swamp, the Nether's fortress list or the End's. Chunks the browser does not simulate
  // (outside the ticking window) are skipped without draws and left out of the cap. Hooks main.js sets: lightAt (getBlockLightValue),
  // skyLightAt (the saved sky value), thunderLightAt (skylightSubtracted 10), fullLightAt (subtracted 0), isThundering, spawnPoint.
  // The context, hooks and chunk order are built once and reused, so a tick allocates nothing unless a mob is created.
  naturalSpawn(player, survival, animals = (this.worldTicks ?? 0) % 400 === 0) {
    const world = this.world, s = (this._spawner ??= this.spawnerState());
    const ox = Math.floor((world.originX || 0) / 16), oz = Math.floor((world.originZ || 0) / 16);
    const pcx = Math.floor(player.x / 16), pcz = Math.floor(player.z / 16);
    this.ring?.update(pcx, pcz); // headless columns beyond the resident window (headless-columns.js)
    if (s.pcx !== pcx || s.pcz !== pcz || s.ox !== ox || s.oz !== oz) {
      Object.assign(s, { pcx, pcz, ox, oz });
      s.ctx.order = eligibleChunkOrder(pcx + ox, pcz + oz).map(([dx, dz, edge]) => [pcx + dx, pcz + dz, edge]);
    }
    const { ctx, tops } = s, order = ctx.order;
    let simulated = 0;
    for (let i = 0; i < order.length; i++) if ((tops[i] = this.spawnChunkTop(order[i][0], order[i][1])) >= 0) simulated++;
    if (!simulated) return 0;
    s.env.time = survival.time ?? 0;
    s.sub = skylightSubtracted(celestialAngle(s.env.time));
    s.player = player;
    ctx.capChunks = ELIGIBLE_CHUNKS; // eligibleChunksForSpawning.size(): always the 17x17 window of the one player
    ctx.rand = (this.worldRandom ??= new JavaRandom(Math.floor(Math.random() * 2 ** 48)));
    ctx.spawn = this.spawnPoint ? this.spawnPoint() : null;
    if (!this.spawnPoint && !world.dimension && world.spawn) {
      const p = (this.cachedSpawnPoint ??= world.spawn());
      ctx.spawn = { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) };
    }
    // Headless columns: the spawn pass reads blocks through the ring's view (resident column first), as natively every chunk is loaded.
    const real = this.world;
    if (this.ring) this.world = this.ring.view;
    try { return findChunksForSpawning(ctx, this.difficulty !== PEACEFUL, true, animals); } finally { this.world = real; }
  }
  // The reusable SpawnerAnimals context for this EntityWorld (its world and dimension are fixed).
  spawnerState() {
    const world = this.world, dim = world.dimension ?? 0, s = { pcx: NaN, pcz: NaN, ox: 0, oz: 0, tops: new Int16Array(289), sub: 0, player: null };
    const sky = (x, y, z) => (openSky(world, x, y, z) ? 15 : 0), blockLight = (x, y, z) => (this.dimensionBlockLight ? this.dimensionBlockLight(x, y, z) : 0);
    s.env = dim ? { skyLight: () => 0, lightValue: blockLight, thunderLightValue: blockLight, fullLight: blockLight } : {
      skyLight: (x, y, z) => (this.skyLightAt ? this.skyLightAt(x, y, z) : sky(x, y, z)),
      lightValue: (x, y, z) => (this.lightAt ? this.lightAt(x, y, z) : Math.max(0, sky(x, y, z) - s.sub)),
      thunderLightValue: (x, y, z) => (this.thunderLightAt ? this.thunderLightAt(x, y, z) : Math.max(0, sky(x, y, z) - 10)),
      fullLight: (x, y, z) => (this.fullLightAt ? this.fullLightAt(x, y, z) : sky(x, y, z)),
    };
    Object.assign(s.env, { thundering: () => !!this.isThundering?.(), time: 0, limit: 256, brightness: dim ? lightBrightnessTable(providerOf(dim).ambient) : SPAWN_BRIGHTNESS });
    wrapRingEnv(s.env, () => this.ring, dim, () => this.lightSubtracted?.() ?? s.sub);
    const hooks = this.spawnerHooks(s.env);
    // Test doubles without metadata read meta 0.
    const metaWorld = world.getMeta ? world : { get: (a, b, c) => world.get(a, b, c), getMeta: () => 0 };
    s.ctx = {
      rand: null, order: [], capChunks: 0, spawn: null,
      count: (name) => {
        let n = 0;
        // World.countEntities walks every loaded entity (ticking or not), so mobs frozen outside the ticking window count too.
        for (const e of this.entities) if (!e.persistent && creatureTypeOf(e.type) === name) n++;
        return n;
      },
      chunkTop: (_cx, _cz, i) => (s.tops[i] >= 0 ? s.tops[i] : null),
      block: (x, y, z) => this.world.get(x, y, z), normalCube, liquid: isLiquid, bedrock: 11, // internal id of Blocks.bedrock
      solidTop: (x, y, z) => solidTopSurface(this.world === world ? metaWorld : this.world, x, y, z),
      isMaterial: (type, id) => (type.material === "water" ? id === WATER : id === 0), // Material.water / Material.air
      playerWithin: (x, y, z) => { const p = s.player; return (p.x - x) ** 2 + (p.y - y) ** 2 + (p.z - z) ** 2 < 576; },
      possibleCreatures: (type, x, y, z) => {
        if (dim) return type.name === "monster" ? dimensionSpawnList(this.world, x, y, z) : spawnList(dim === NETHER ? 8 : 9, type.name);
        const slot = world.biomeAt ? world.biomeAt(x, z)?.id ?? 1 : 1;
        // ChunkProviderGenerate.getPossibleCreatures: the hut's box decides, whatever biome the block's slot holds.
        if (type.name === "monster" && this.swampHutAt(x, y, z)) return WITCH_HUT_MONSTERS;
        return spawnList(slot, type.name);
      },
      create: (name, x, y, z, yaw) => {
        const e = ENTITY_TYPE_OF[name] ? hooks.createMob(ENTITY_TYPE_OF[name], x, y, z, yaw) : null;
        if (!e) return e;
        // Entity.rand is a fresh unseeded Random (`entitySeed(World.rand)` lets tests seed it from the World.rand state as
        // tools/probes/SpawnReplay2Probe.java does). EntitySlime's constructor draws the size and the jump delay from it first.
        const r = new JavaRandom(this.entitySeed ? this.entitySeed(s.ctx.rand) : Math.floor(Math.random() * 2 ** 48));
        setEntityRandom(e, r);
        if (e.type === "slime" || e.type === "magma_cube") {
          const size = 1 << r.nextInt(3);
          Object.assign(e, slimeFields(size, () => 0), { jumpDelay: r.nextInt(20) + 10 });
        }
        return e;
      },
      canSpawnHere: (e) => hooks.canSpawnHere(e),
      add: (e) => this.entities.push(e),
      // A natural skeleton rolls EntitySkeleton's Nether wither roll itself (free).
      // An ocelot's kittens have no entity cap natively (limit Infinity; a spawn egg keeps the 40).
      onSpawn: (e, data, name) => { const opts = { group: data, free: name === "Skeleton", limit: Infinity }; this.onSpawnWithEgg(e, opts); return opts.group ?? null; },
      maxInChunk: maxSpawnedInChunk,
    };
    return s;
  }
  // Chunk.getTopFilledSegment for a chunk SpawnerAnimals may use, or -1 when the browser does not simulate it (outside the
  // ticking window or the finite world). The highest section holding a block, from the live blocks (native keeps a storage that
  // was emptied until the chunk reloads); cached per chunk for 400 ticks.
  spawnChunkTop(cx, cz) {
    const world = this.world, x0 = cx * 16, z0 = cz * 16;
    // Natively every one of the 225 non-edge chunks is eligible (provideChunk loads or generates it). Here every chunk whose column is
    // resident counts, ticking or not; a streamed world holds only 8 x 8 columns, so the chunks beyond are skipped (natural-spawning.md).
    // Finite doubles that report a ticking window but no columns keep that window.
    if (!world.chunkAt && world.isTicking && !(world.isTicking(x0, z0) && world.isTicking(x0 + 15, z0 + 15))) return -1;
    if (!world.streaming && world.inside && !(world.inside(x0, 0, z0) && world.inside(x0 + 15, 0, z0 + 15))) return -1;
    if (!world.chunkAt) {
      if (world.chunkTop) return world.chunkTop(cx, cz) ?? -1;
      return Math.max(0, (world.surface?.(x0 + 8, z0 + 8) ?? 0) - 1) & ~15;
    }
    const chunk = world.chunkAt(cx, cz);
    if (!chunk) return this.ring ? this.ring.top(cx, cz) : -1;
    const tick = this.worldTicks ?? 0, hit = (this.chunkTops ??= new WeakMap()).get(chunk);
    if (hit && tick - hit.tick < 400 && tick >= hit.tick) return hit.top;
    // A column's 16 cells of a section are four aligned 32-bit words (height is a multiple of 16).
    const h = chunk.height, b = chunk.blocks, words = new Uint32Array(b.buffer, b.byteOffset, b.length >> 2), stride = h >> 2;
    let top = 0;
    scan: for (let sec = (h >> 4) - 1; sec > 0; sec--) for (let w = sec * 4; w < words.length; w += stride) {
      if (words[w] | words[w + 1] | words[w + 2] | words[w + 3]) { top = sec * 16; break scan; }
    }
    if (hit) { hit.top = top; hit.tick = tick; } else this.chunkTops.set(chunk, { top, tick });
    return top;
  }
  // ChunkProviderGenerate.getPossibleCreatures' MapGenScatteredFeature.func_143030_a: is (x, y, z) inside a swamp hut? The
  // generator is this world's own, its starts built around each queried chunk once (streamed Java worlds with structures only).
  swampHutAt(x, y, z) {
    const world = this.world, cache = world.population?.structureCache;
    if (!cache?.manager || world.worldType === "flat" || world.flat) return false;
    const huts = (this.huts ??= { gen: new MapGenScatteredFeature(cache.seed, cache.manager), done: new Set() });
    const nx = x + (world.originX || 0), nz = z + (world.originZ || 0), cx = nx >> 4, cz = nz >> 4, key = `${cx},${cz}`;
    if (!huts.done.has(key)) { huts.gen.generate(cx, cz); huts.done.add(key); }
    return huts.gen.isSwampHut(nx, y, nz);
  }
  // WorldInfo.getWorldTotalTime as the spawner sees it (read before WorldServer.tick adds 1): worldTicks is that value for the
  // current tick. The saved record keeps the value after the tick (level.dat Time); main.js loads and saves it.
  loadTotalTime(t) { this.worldTicks = (Number.isSafeInteger(t) && t >= 0 ? t : 0) - 1; }
  saveTotalTime() { return this.worldTicks === undefined ? undefined : this.worldTicks + 1; }
  // BlockPortal.updateTick's ItemMonsterPlacer.spawnCreature(world, 57, x, y, z): setLocationAndAngles with wrap(nextFloat() * 360),
  // onSpawnWithEgg, then timeUntilPortal = getPortalCooldown (300). `rand` is World.rand.
  spawnPortalPigman([x, y, z], rand) {
    const e = this.create("pigman", x, y, z), yaw = wrapDegrees(Math.fround(Math.fround(rand.nextFloat()) * 360));
    for (const k of ["rotationYaw", "prevRotationYaw", "renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead", "bodyHeadYaw"]) e[k] = yaw;
    e.yaw = (-yaw * Math.PI) / 180;
    this.onSpawnWithEgg(e);
    e.portalCooldown = 300;
    this.entities.push(e);
    return e;
  }
  // Entities outside the ticking window never update, so EntityLiving.despawnEntity never removes them. Natively the chunks out
  // to the view distance keep updating, so a mob that may despawn and is beyond its 128-block range would be gone on its next
  // update; such a frozen mob is dropped here. Mobs in the ticking window despawn through their own update.
  sweepFrozen(player) {
    const world = this.world;
    if (!world.streaming) return;
    // A despawnable mob frozen outside the ticking window stands in for a native mob that keeps updating: EntityLiving.despawnEntity
    // runs every tick there (entityAge + 1; beyond 128 blocks at once; beyond 32 with a 1 in 800 roll once entityAge passes 600;
    // within 32 the age resets). This runs every 20 ticks, so the roll is made once with the chance of 20 ticks, and the age is
    // kept in `idle` as for the ticking mobs. Without it the spawner's outer chunks would fill the cap with mobs that never leave.
    const hit = 1 - (799 / 800) ** 20;
    this.entities = this.entities.filter((e) => {
      if (this.isActive(e) || !canDespawn(e) || e.ridingEntity || e.riddenByEntity) return true;
      const d = (player.x - e.x) ** 2 + (player.y - e.y) ** 2 + (player.z - e.z) ** 2;
      if (d > 128 ** 2) return false;
      if (d < 32 ** 2) { e.idle = 0; return true; }
      e.idle = (e.idle || 0) + 20;
      return !(e.idle > 600 && entityRandom(e).nextDouble() < hit);
    });
  }
  // The spider's, cave spider's and pigman's legacy AI (EntityCreature.updateEntityActionState) lives in legacy-creature.js.
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
    st.summonCooldown = e.summonCooldown ?? 0; st.jumping = !!e.jumping; st.speed = aiMoveSpeed(e, 1); // isJumping (bc) is not reset here: td.bq clears it only on its path-following branch (legacyThink)
    st.moveForward = f(f(st.moveForward || 0) * f(0.98)); // EntityLivingBase.moveForward is one field: the previous tick's x 0.98 decay carries over when the action state leaves it unset (a path with no waypoint beyond width x 2; legacy-creature.js, giantThink)
    st.entityAge = e.idle || 0; // the port's idle counter is EntityLiving.entityAge (a hit resets it)
    if (st.attackTime > 0) st.attackTime--;
    if (this.ai.brightness(Math.floor(e.x), Math.floor(e.y + f(t.height * 0.66)), Math.floor(e.z)) > 0.5) st.entityAge += 2; // EntityMob.onLivingUpdate: bright light ages it (EntityAIWander's and the wander roll's entityAge < 100 gate)
    m.senseCache.clear();
    const world = this.world, rand = entityRandom(e), cell = (x, y, z) => { this.events.push({ blockEdit: [[x, y, z]] }); };
    const path = (make) => (m.navigator.spend() ? make(m.navigator.finder()) : null);
    const env = {
      rand, remote: false, get mobGriefing() { return gameRule("mobGriefing"); },
      closestPlayer: (me, range) => (p?.alive && (range < 0 || m.distSq(p) < range * range) ? p : null),
      findPlayerToAttack: (me) => this.ai.closestVulnerablePlayer(me, 8),
      isAlive: (x) => (x === p ? !!p.alive : x.alive !== false),
      isCreative: (x) => x === p && !!s.creative,
      eyeHeight: (x) => (x === st ? f(f(t.height) * f(0.85)) : x === p || x.isPlayer ? 1.62 : x.eyeHeight),
      boxMidY: (x) => x.y,
      canSee: (me, target) => m.canSee(target),
      attackEntity: (me, target, d) => {
        if (attackReady({ y: me.y, attackTime: me.attackTime }, target.y, target.y + (target.height ?? 1.8), d)) {
          me.attackTime = 20;
          if (target === p) this.hitPlayer(e, s);
          else if (target.e) this.hitMob(e, target.e); // a mob that hurt it (EntityMob.attackEntityFrom)
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
    st.randomYaw = f(f(st.randomYaw || 0) * f(0.9)); // EntityLivingBase.onLivingUpdate: randomYawVelocity *= 0.9F after the action state
    e.idle = st.entityAge;
    e.rotationYaw = st.rotationYaw; e.rotationPitch = st.rotationPitch;
    e.rotationYawHead = e.rotationYaw; // EntityLiving.onLivingUpdate without AI (sw.e): rotationYawHead = rotationYaw after the action state (b50lb executed)
    e.moveForward = st.moveForward; e.jumping = st.jumping; e.summonCooldown = st.summonCooldown;
    e.yaw = (-e.rotationYaw * Math.PI) / 180;
  }
  // EntityGiantZombie (ye) through EntityCreature's legacy action state (td.bq, creatureActionState): EntityMob.findPlayerToAttack
  // (the closest vulnerable player within 16 that it can see), EntityMob.attackEntity (< 2.0 blocks, 20 tick cooldown), no wander
  // bias beyond getBlockPathWeight = brightness - 0.5. EntityMob.onLivingUpdate adds 2 to entityAge in light above 0.5.
  giantThink(e) {
    const m = this.ai.brain(e), p = this.ai.player, s = this.ai.survival, st = this.silverfishState(e), t = ENTITY_TYPES.giant;
    st.x = e.x; st.y = e.y; st.z = e.z; st.width = t.width; st.inWater = e.inWater; st.inLava = e.inLava;
    st.collidedH = e.collidedH; st.rotationYaw = e.rotationYaw; st.rotationPitch = e.rotationPitch || 0;
    st.speed = aiMoveSpeed(e, 1); st.jumping = !!e.jumping; // td.be: the movementSpeed attribute, saved modifiers included. isJumping (bc) persists like the spider's (td.bq clears it only on its path-following branch)
    // EntityLivingBase.moveForward is one field: the previous tick's x 0.98 decay (walk) carries over when the
    // legacy action state leaves it unset (no waypoint beyond width x 2).
    st.moveForward = f(f(st.moveForward || 0) * f(0.98));
    if (st.attackTime > 0) st.attackTime--;
    if (this.ai.brightness(Math.floor(e.x), Math.floor(e.y + f(t.height * 0.66)), Math.floor(e.z)) > 0.5) st.entityAge += 2;
    m.senseCache.clear();
    const world = this.world, rand = entityRandom(e), path = (make) => (m.navigator.spend() ? make(m.navigator.finder()) : null);
    const env = {
      rand, remote: false,
      closestPlayer: (me, range) => (p?.alive && (range < 0 || m.distSq(p) < range * range) ? p : null),
      findPlayerToAttack: (me) => { const c = this.ai.closestVulnerablePlayer(me, GIANT.range); return c && m.canSee(c) ? c : null; },
      isAlive: (x) => (x === p ? !!p.alive : x.alive !== false),
      isCreative: (x) => x === p && !!s.creative,
      eyeHeight: (x) => (x === st ? f(f(t.height) * f(0.85)) : x === p || x.isPlayer ? 1.62 : x.eyeHeight),
      boxMidY: (x) => x.y,
      canSee: (me, target) => m.canSee(target),
      attackEntity: (me, target, d) => {
        if (giantAttackReady({ y: e.y, attackTime: me.attackTime }, target.y, target.y + (target.height ?? 1.8), d)) {
          me.attackTime = 20;
          if (target === p) this.hitPlayer(e, s);
          else if (target.e) this.hitMob(e, target.e); // a mob that hurt it (EntityMob.attackEntityFrom)
        }
      },
      pathToEntity: (me, target, range) => path((fn) => fn.createEntityPathToEntity(m, target, range)),
      pathToBlock: (me, x, y, z, range) => path((fn) => fn.createEntityPathToBlock(m, x, y, z, range)),
      pathWeight: (me, x, y, z) => giantPathWeight(this.ai.brightness(x, y, z)),
      setDead: () => this.ai.despawn(e),
    };
    creatureActionState(st, env);
    st.randomYaw = f(f(st.randomYaw || 0) * f(0.9)); // EntityLivingBase.onLivingUpdate: randomYawVelocity *= 0.9F after the action state
    e.rotationYaw = st.rotationYaw; e.rotationPitch = st.rotationPitch;
    e.rotationYawHead = e.rotationYaw; // as the silverfish (sw.e)
    e.moveForward = st.moveForward; e.jumping = st.jumping;
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
    if (e.growingAge >= 0 && !e.chickenJockey && --e.eggTimer <= 0) {
      const rand = entityRandom(e), pitch = f(f(f(rand.nextFloat() - rand.nextFloat()) * f(0.2)) + 1); // EntityChicken draws on its own Entity.rand: two floats for the pitch, then nextInt(6000)
      this.events.push({ sound: "mob.chicken.plop", volume: 1, pitch, position: { x: e.x, y: e.y, z: e.z } });
      this.emitLoot({ drop: EGG, count: 1, position: { x: e.x, y: e.y, z: e.z } });
      e.eggTimer = rand.nextInt(6000) + 6000;
    }
  }
  // EntityWolf.onUpdate and onLivingUpdate's wet shake (wolf.js updateWolf), then its effects: the shake sound
  // (0.4 volume, pitch (r - r) * 0.2 + 1) and the splash particles of the shaking fur.
  wolfUpdate(e, t) {
    const rand = entityRandom(e), brain = this.ai.brain(e);
    // No target check here: a dead target ends through EntityAITarget.continueExecuting/resetTask in the 3-tick task update, as in 1.7.10.
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
    const out = wolfClick(e, held, ownerPresent(e), creative, rand), brain = this.ai.brain(e);
    const take = (n, spend = false) => { if (n > 0 && !creative) survival.inventory.decr(survival.inventory.current, n); if (spend && n > 0) clearSpentStack(survival); };
    take(out.consume, true); // wolf and ocelot: `if (size <= 0) setInventorySlotContents(null)` follows the use in every mode (love's EntityAnimal path does not)
    if (out.heal > 0 || out.status > 0) clearSpentStack(survival); // meat that heals, a bone that tames or fails: the emptied slot is cleared in Creative too (leads2-reference.json sizes)
    if (out.tamed || out.sitToggle) { brain.navigator.clearPathEntity(); brain.attackTarget = null; }
    // EntityTameable.func_70908_e: 7 hearts after taming (status 7) or 7 smoke after a failed bone (status 6).
    if (out.status) burst(this.fx, out.status === 7 ? "heart" : "smoke", 7, box, rand, 0.5);
    if (out.love) {
      // EntityAnimal.interact: an adult not in love is put in love and the meat is used up; a puppy grows by a tenth
      // of its remaining time instead.
      if (e.growingAge === 0 && e.love <= 0) {
        e.love = 600;
        take(1);
        if (this.fx) burst(this.fx, "heart", 7, box, FX_RANDOM, 0.5); // client copy's draws (setEntityState 18), not the server Entity.rand
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
    const out = ocelotClick(e, held, { isOwner: ownerPresent(e), creative, tempting: !!brain.temptRunning?.(), distSq: brain.distSq(p), rand, worldRand });
    const take = (n, spend = false) => { if (n > 0 && !creative) survival.inventory.decr(survival.inventory.current, n); if (spend && n > 0) clearSpentStack(survival); };
    take(out.consume, true); // wolf and ocelot: `if (size <= 0) setInventorySlotContents(null)` follows the use in every mode (love's EntityAnimal path does not)
    if (out.status > 0) clearSpentStack(survival); // a fish that tames or fails: the emptied slot is cleared in Creative too (leads2-reference.json sizes)
    if (out.tamed || out.sitToggle) { brain.navigator.clearPathEntity(); brain.attackTarget = null; }
    // EntityTameable.func_70908_e: 7 hearts after taming (status 7) or 7 smoke after a failed fish (status 6).
    if (out.status) burst(this.fx, out.status === 7 ? "heart" : "smoke", 7, box, rand, 0.5);
    if (out.love) {
      // EntityAnimal.interact: an adult not in love is put in love and the fish is used up; a kitten gets nothing.
      if (e.growingAge === 0 && e.love <= 0) {
        e.love = 600;
        take(1);
        if (this.fx) burst(this.fx, "heart", 7, box, FX_RANDOM, 0.5); // client copy's draws (setEntityState 18), not the server Entity.rand
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
    if (!LEGACY_BODY.has(e.type)) return bodyTurn(e); // the body helper (shared with the client copy, clientBodyTurn)
    // EntityLivingBase.onUpdate's tail with EntityLivingBase.func_110146_f (sv.f(FF), bytecode-read): a mob that is not isAIEnabled (sw.f only delegates to the body helper when bk()) eases
    // renderYawOffset 0.3 of the way to the movement direction (while it moved more than 0.0025 squared), then holds it within 75 degrees of rotationYaw; the head follows rotationYaw (legacy-creature.js).
    const dx = e.x - e.px, dz = e.z - e.pz, sq = f(dx * dx + dz * dz);
    let want = e.renderYawOffset;
    if (sq > f(0.0025000002)) want = f(f(f(f(Math.atan2(dz, dx)) * f(180)) / f(Math.PI)) - 90);
    e.renderYawOffset = f(e.renderYawOffset + f(wrapDegrees(f(want - e.renderYawOffset)) * f(0.3)));
    let d = wrapDegrees(f(e.rotationYaw - e.renderYawOffset));
    if (d < -75) d = -75;
    if (d >= 75) d = 75;
    e.renderYawOffset = f(e.rotationYaw - d);
    if (d * d > 2500) e.renderYawOffset = f(e.renderYawOffset + f(d * f(0.2)));
    e.bodyHeadYaw = e.rotationYawHead; e.bodyTicks = 0;
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
    const riding = ridingId(e);
    if (riding) saved.riding = riding;
    else delete saved.riding;
    // The mob the local player rides (horse-live.js seat): vehicle-simulation.js restorePlayerVehicle seats the player on it again.
    if (e.rider && e.rider.vehicle?.entity === e && !e.rider.dead) saved.playerRides = true;
    else delete saved.playerRides;
    return saved;
  }
  // The sounds each client plays for status 2 and 3 (EntityLivingBase.handleHealthUpdate), apart from the server's, and the client-only
  // ones of a client entity (the dragon's wings). Status 2 and 3 are sent to the clients in the entity's tracking list when the mob is
  // hurt; the sound then plays at the client entity's position, the tracker's encoded and interpolated one (entity-tracker.js,
  // natural-spawning.md "Batch 40"). A client-only sound needs the client entity to exist (it outlives the tracking list by a tick).
  drainClientSounds() {
    const sounds = this.clientSounds;
    this.clientSounds = [];
    if (!this.watching) return sounds;
    const tracker = (this.tracker ??= new MobTracker(this.viewChunks));
    tracker.crystalFire ??= (c) => this.crystalFire?.(c);
    tracker.attach(this.watching);
    const out = [];
    for (const s of sounds) {
      const m = s.position;
      if (!m?.type) { out.push(s); continue; }
      const en = tracker.entryOf(m, this.size(m)[0], this.size(m)[1]); // a mob that spawned this tick enters the tracker now (addEntityToTracker)
      if ( !en.client.present || (!s.clientOnly && !en.entry.tracked)) continue;
      const o = s.offset ?? 0; // EntityBlaze.onLivingUpdate plays its crackle at posX + 0.5, posY + 0.5, posZ + 0.5 of the client entity (bytecode-read)
      out.push({ ...s, position: { x: en.client.x + o, y: en.client.y + o, z: en.client.z + o } });
    }
    return out;
  }
  drain() {
    const events = this.events;
    this.events = [];
    this.lootScan = 0;
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
