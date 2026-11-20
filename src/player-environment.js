import { landingEffects, JUMP_BOOST } from "./damage-fx.js";
import { PHYSICS } from './world.js';
import { eyeInWater } from './fluids.js';
import { isOnLadder } from './ladders.js';
import { movementExhaustion, TELEPORT_SQUARED } from './movement-stat.js';
import { entityBox, isWet } from './weather.js';
import { insideOpaqueBlock, PLAYER_EYE } from './suffocation.js';
import { blockCollisions, PLAYER_FIRE_RESISTANCE } from './block-collisions.js';

// Entity.onEntityUpdate and the block-collision tail, in the live tick's order.
// The hooks run synchronously: weather between the eye test and wetness test,
// particles between the survival update and collision tail, and fizz at contact.
export function tickPlayerEnvironment({ world, weather, position, survival, motion, flying, sleeping = false },
  { inWater, inLavaNow }, { tickWeather, afterSurvival = () => {}, fizz = () => {}, slow = () => {} }) {
  const underwater = eyeInWater(world, position.x, position.y + Math.fround(PHYSICS.eye), position.z);
  tickWeather();
  const wet = isWet(weather, world, { x: position.x, y: position.y, z: position.z, inWater }, PHYSICS.height);
  // EntityPlayer.isEntityInsideOpaqueBlock: never while sleeping (the lying body is beside the bed's walls).
  const inWall = !sleeping && insideOpaqueBlock(world, position.x, position.y, position.z, PHYSICS.width, PLAYER_EYE);
  survival.tick({ underwater, inWater, inLava: inLavaNow, inWall, outOfWorld: position.y < -64 });
  afterSurvival();
  const tail = { fire: survival.fire || 0, inWeb: motion.inWeb, fallDistance: 0 }, fireBefore = tail.fire;
  blockCollisions(world, entityBox(position, PHYSICS.width, PHYSICS.height), tail, {
    hurt: playerHurt(survival), wet, flying, resistance: PLAYER_FIRE_RESISTANCE, fizz, slow,
  });
  finishPlayerFire(survival, fireBefore, tail.fire);
  motion.inWeb = tail.inWeb;
  return { underwater, wet, inWall };
}

// Block.onEntityCollidedWithBlock (cactus) and dealFireDamage on the player: attackEntityFrom, which the hurt timer gates.
const playerHurt = (survival) => (source, n) => survival.health > 0 && survival.damage(n, source === 'cactus' ? 'a cactus' : 'fire', true);
// blockCollisions catches fire with setFire(8): 160 ticks, which Fire Protection shortens (Entity.setFire).
function finishPlayerFire(survival, before, after) {
  if (before < 0 && after === 160 && survival.setFire) { survival.fire = 0; survival.setFire(8); }
  else survival.fire = after;
}

// The tail of the player's Entity.moveEntity for a move outside its own tick (a piston push, piston-push.js pushPlayer):
// doBlockCollisions (cactus, webs, soul sand on the body's motion) and the burning-box test with the player's fire counter and
// fire resistance 20. isWet is read after the move (inWater from the last water update, rain at the moved body). Returns
// { fire, hooks, finish(body) } for moveEntity's hooks; finish writes the fire counter back (setFire(8) as above).
export function playerMoveTail({ world, weather, survival, flying, inWater }, body, { fizz = () => {} } = {}) {
  const fire = survival.fire || 0;
  return {
    fire,
    hooks: { hurt: playerHurt(survival), get wet() { return isWet(weather, world, { x: body.x, y: body.y, z: body.z, inWater }, PHYSICS.height); }, flying, resistance: PLAYER_FIRE_RESISTANCE, fizz },
    finish: (moved) => finishPlayerFire(survival, fire, moved.fire),
  };
}

// EntityPlayer.fall / EntityLivingBase.fall for a landing of `distance` blocks (Entity.updateFallState on the ground): farmland
// trampling, landing dust over 3 blocks, the fall sound and damage. The live tick calls it from finishPlayerMovement; a piston push
// that lands the player calls it at once (the port has one player; the integrated server's EntityPlayerMP takes the same landing
// from the client's movement packets through handleFalling).
export function landPlayer({ world, position, survival, inWater }, distance, { trample = () => {}, landingDust = () => {}, fallSound = () => {} } = {}) {
  // b88 spcopy88: with the integrated server's copy ticking (fallOwner), the trample (BlockFarmland.onFallenUpon: `!isRemote`) and the 2006 dust (sv.a(DZ): `!isRemote`) are the copy's
  // handleFalling (server-process-player.js); the client's own updateFallState does neither.
  const owner = !!survival.serverPlayer?.fallOwner;
  if (distance > 0 && !owner) trample(position, distance);
  if (distance > 3 && !owner) {
    const bx = Math.floor(position.x), by = Math.floor(position.y - 0.20000000298023224), bz = Math.floor(position.z);
    if (world.get(bx, by, bz)) landingDust(bx, by, bz, Math.ceil(Math.fround(distance - 3)));
  }
  // EntityPlayer.fall skips Creative flight; EntityLivingBase.fall: ceil(distance - 3 - jump boost level), the fall sound
  // (EntityPlayerSP plays it itself), the block's step sound, then the damage (damage-fx.js).
  if (!survival.creative && distance > 0) {
    const jump = survival.effects?.get?.(JUMP_BOOST), by = Math.floor(position.y - 0.20000000298023224),
      fall = landingEffects(distance, { kind: "player", amplifier: jump ? jump.amplifier : -1, blockUnder: world.get(Math.floor(position.x), by, Math.floor(position.z)) });
    for (const sound of fall.sounds) fallSound(sound);
    // b87 spcopy87: with the integrated server's copy ticking (ai.js PlayerView fallOwner), the damage is the copy's handleFalling (server-process-player.js), as the client's
    // EntityClientPlayerMP.attackEntityFrom takes none; the sounds, the dust and the trample stay here.
    if (fall.points > 0 && !survival.serverPlayer?.fallOwner) {
      // CombatTracker's fall description and Entity.fallDistance, sampled for the entry (combat-tracker.js).
      const cell = world.get(Math.floor(position.x), Math.floor(position.y), Math.floor(position.z));
      survival.combatSite = cell === 65 ? "ladder" : cell === 72 ? "vines" : inWater ? "water" : null;
      survival.combatFall = distance;
      survival.damage(fall.points, 'a fall');
    }
  }
}

// This remains a separate step because falling blocks and client display ticks
// occur between the environment step and landing handling in the live game.
// b81 exhaust81: the movement exhaustion is EntityPlayer.addMovementStat's (movement-stat.js; executed in movement-stats-reference.json): whole
// centimetres, 0.015F under water (3-D with the eye in water, else horizontal), 0.01F walking and 0.099999994F sprinting on the ground, nothing on a
// ladder, in the air or riding (`riding`), and no charge for a teleport-sized move (TELEPORT_SQUARED, as the stats). `eyeInWater` and `onLadder`
// default to the world's cells at the player (sa.a(awt.h) at the 1.62 eye, sv.h_ at floor(minY)).
export function finishPlayerMovement(state, { inWater, inLavaNow, oldPosition, eyeInWater: eye, onLadder, riding = false },
  { trample = () => {}, landingDust = () => {}, fallSound = () => {} } = {}) {
  const { world, position, survival, motion, grounded } = state;
  let { fallDistance, landedFall } = state;
  if (inLavaNow) fallDistance *= 0.5;
  const dx = position.x - oldPosition.x, dy = position.y - oldPosition.y, dz = position.z - oldPosition.z;
  if (!survival.creative && !riding && dx * dx + dy * dy + dz * dz <= TELEPORT_SQUARED) {
    survival.exhaust(movementExhaustion({
      dx, dy, dz, swim: !!inWater, ground: !!grounded, sprinting: !!motion?.sprinting,
      dive: eye ?? eyeInWater(world, position.x, position.y + PHYSICS.eye, position.z),
      ladder: onLadder ?? isOnLadder(world, position.x, position.y, position.z),
    }));
  }
  if (grounded) {
    const distance = landedFall;
    landedFall = 0;
    landPlayer({ world, position, survival, inWater }, distance, { trample, landingDust, fallSound });
    fallDistance = 0;
  }
  if (inWater || motion.inWeb) fallDistance = 0;
  Object.assign(state, { fallDistance, landedFall });
}
