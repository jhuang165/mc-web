import { landingEffects, JUMP_BOOST } from "./damage-fx.js";
import { PHYSICS } from './world.js';
import { eyeInWater } from './fluids.js';
import { entityBox, isWet } from './weather.js';
import { insideOpaqueBlock, PLAYER_EYE } from './suffocation.js';
import { blockCollisions, PLAYER_FIRE_RESISTANCE } from './block-collisions.js';

// Entity.onEntityUpdate and the block-collision tail, in the live tick's order.
// The hooks run synchronously: weather between the eye test and wetness test,
// particles between the survival update and collision tail, and fizz at contact.
export function tickPlayerEnvironment({ world, weather, position, survival, motion, flying },
  { inWater, inLavaNow }, { tickWeather, afterSurvival = () => {}, fizz = () => {}, slow = () => {} }) {
  const underwater = eyeInWater(world, position.x, position.y + Math.fround(PHYSICS.eye), position.z);
  tickWeather();
  const wet = isWet(weather, world, { x: position.x, y: position.y, z: position.z, inWater }, PHYSICS.height);
  const inWall = insideOpaqueBlock(world, position.x, position.y, position.z, PHYSICS.width, PLAYER_EYE);
  survival.tick({ underwater, inWater, inLava: inLavaNow, inWall, outOfWorld: position.y < -64 });
  afterSurvival();
  const tail = { fire: survival.fire || 0, inWeb: motion.inWeb, fallDistance: 0 }, fireBefore = tail.fire;
  blockCollisions(world, entityBox(position, PHYSICS.width, PHYSICS.height), tail, {
    hurt: (source, n) => survival.health > 0 && survival.damage(n, source === 'cactus' ? 'a cactus' : 'fire', true),
    wet, flying, resistance: PLAYER_FIRE_RESISTANCE, fizz, slow,
  });
  // blockCollisions catches fire with setFire(8): 160 ticks, which Fire Protection shortens (Entity.setFire).
  if (fireBefore < 0 && tail.fire === 160 && survival.setFire) { survival.fire = 0; survival.setFire(8); }
  else survival.fire = tail.fire;
  motion.inWeb = tail.inWeb;
  return { underwater, wet, inWall };
}

// This remains a separate step because falling blocks and client display ticks
// occur between the environment step and landing handling in the live game.
export function finishPlayerMovement(state, { inWater, inLavaNow, oldPosition },
  { trample = () => {}, landingDust = () => {}, fallSound = () => {} } = {}) {
  const { world, position, survival, motion, grounded } = state;
  let { fallDistance, landedFall } = state;
  if (inLavaNow) fallDistance *= 0.5;
  if (!survival.creative) {
    const distance = Math.hypot(position.x - oldPosition.x, position.z - oldPosition.z);
    survival.exhaust(distance * (inWater ? 0.015 : motion.sprinting ? 0.1 : 0.01));
  }
  if (grounded) {
    const distance = landedFall;
    landedFall = 0;
    if (distance > 0) trample(position, distance);
    if (distance > 3) {
      const bx = Math.floor(position.x), by = Math.floor(position.y - 0.20000000298023224), bz = Math.floor(position.z);
      if (world.get(bx, by, bz)) landingDust(bx, by, bz, Math.ceil(Math.fround(distance - 3)));
    }
    // EntityPlayer.fall skips Creative flight; EntityLivingBase.fall: ceil(distance - 3 - jump boost level), the fall sound
    // (EntityPlayerSP plays it itself), the block's step sound, then the damage (damage-fx.js).
    if (!survival.creative && distance > 0) {
      const jump = survival.effects?.get?.(JUMP_BOOST), by = Math.floor(position.y - 0.20000000298023224),
        fall = landingEffects(distance, { kind: "player", amplifier: jump ? jump.amplifier : -1, blockUnder: world.get(Math.floor(position.x), by, Math.floor(position.z)) });
      for (const sound of fall.sounds) fallSound(sound);
      if (fall.points > 0) survival.damage(fall.points, 'a fall');
    }
    fallDistance = 0;
  }
  if (inWater || motion.inWeb) fallDistance = 0;
  Object.assign(state, { fallDistance, landedFall });
}
