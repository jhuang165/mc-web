import { PHYSICS, SIZE, slipperiness, fallingVelocity, collides } from './world.js';
import { webMove } from './webs.js';
import { moveEntity, pushOutOfBlocks } from './entities.js';
import { entityWaterBox, waterAcceleration, inLava, liquidInBox } from './fluids.js';
import { isOnLadder, ladderClamp, LADDER_CLIMB } from './ladders.js';
import { SNEAK_YSIZE, moveWeights, groundAccel, airAccel, LIQUID_ACCEL, JUMP_MOTION,
  jumpExhaustion, sprintJumpPush, FLY_SPEED, FLY_Y_DRAG, flyVertical } from './player-movement.js';

// One player movement step, excluding subsequent survival, world and visual work.
// Position and velocity are mutable {x,y,z}; motion and survival own their state.
export function movePlayer(state, controls, toast = () => {}) {
  const { world, position, previous, velocity, motion, survival, yaw, eating } = state;
  let { grounded, collidedH, flying, fallDistance, landedFall } = state;
  Object.assign(previous, { x: position.x, y: position.y, z: position.z });
  // EntityPlayer.sleepInBedAt shrinks the body to 0.2 x 0.2 on the mattress and isMovementBlocked holds it still,
  // so the standing 0.6-wide box is never pushed out of, or collided against, the walls round the bed.
  if (state.sleeping) {
    Object.assign(velocity, { x: 0, y: 0, z: 0 });
    return { inWater: false, inLavaNow: false, sneakOnGround: false, oldPosition: { x: position.x, y: position.y, z: position.z } };
  }
  // MovementInputFromOptions + EntityPlayerSP.onLivingUpdate: sneak scales input by 0.3 and
  // sprinting needs forward input >= 0.8, so sneaking ends a sprint (player-movement.js).
  const sneak = controls.sneak;
  const input = motion.update(
    {
      forward: controls.forward,
      strafe: controls.strafe,
      sneak,
    },
    {
      onGround: grounded,
      collidedH,
      canSprint: survival.creative || survival.food > 6,
      usingItem: !!eating,
      sprintKey: controls.sprint,
    },
  );
  const sprint = motion.sprinting;
  // Entity.moveEntity: a sneaking player on the ground takes no step sounds or walked distance.
  const sneakOnGround = sneak && grounded;
  const oldPosition = { x: position.x, y: position.y, z: position.z };
  const { strafe: dx, forward: dz } = moveWeights(input);
  // Entity.handleWaterMovement (sa.N): the box shrunk 0.4 vertically and 0.001 all round is
  // wet below a water cell's surface; running water pushes it unless flying
  // (EntityPlayer.isPushedByWater). Entity.onEntityUpdate runs it before onLivingUpdate.
  const waterBox = entityWaterBox([position.x - PHYSICS.width / 2, position.y, position.z - PHYSICS.width / 2, position.x + PHYSICS.width / 2, position.y + PHYSICS.height, position.z + PHYSICS.width / 2]),
    { wet: inWater, push: waterPush } = waterAcceleration(world, waterBox, !flying);
  velocity.x += waterPush[0];
  velocity.y += waterPush[1];
  velocity.z += waterPush[2];
  // Entity.handleLavaMovement (sa.P) on the player's box; EntityLivingBase.
  // moveEntityWithHeading only takes the lava branch outside water.
  const playerBox = (dy = 0) => {
    const r = PHYSICS.width / 2;
    return [position.x - r, position.y + dy, position.z - r, position.x + r, position.y + dy + PHYSICS.height, position.z + r];
  };
  const inLavaNow = inLava(world, playerBox()),
    lava = inLavaNow && !inWater && !flying;
  let slip = Math.fround(0.6);
  const jumpKey = controls.jump;
  // EntityPlayerSP.onLivingUpdate: a double tap of jump toggles Creative flight (tick-based).
  if (motion.toggleFlight(jumpKey, survival.creative)) {
    flying = !flying;
    toast(flying ? "Flight enabled · Space up · Shift down" : "Back to walking");
  }
  // ... then, flying, the sneak and jump keys move 0.15 a tick down and up.
  if (flying) velocity.y = flyVertical(velocity.y, { jump: jumpKey, sneak });
  // EntityPlayerSP.onLivingUpdate (after Entity.onEntityUpdate's water push): a corner of the
  // box in or under a normal cube sets motionX/Z to 0.1 towards the nearest open side.
  const pushed = { x: position.x, y: position.y, z: position.z, vx: velocity.x, vz: velocity.z };
  pushOutOfBlocks(world, pushed, PHYSICS.width);
  velocity.x = pushed.vx;
  velocity.z = pushed.vz;
  // EntityLivingBase.onLivingUpdate: with jump held, water or lava lift 0.04 a tick and the
  // ground jump waits for jumpTicks (10 between held jumps).
  const swimming = !flying && (inWater || lava);
  const jumpAction = motion.jump(jumpKey, { inLiquid: inWater || inLavaNow, onGround: grounded });
  if (jumpAction === "swim") velocity.y += 0.03999999910593033;
  else if (jumpAction === "jump") {
    velocity.y = JUMP_MOTION + (survival.effects?.jumpBoost?.() ?? 0); // Jump Boost: +0.1 per level
    if (sprint) {
      const push = sprintJumpPush(yaw);
      velocity.x += push.x;
      velocity.z += push.z;
    }
    survival.exhaust(jumpExhaustion(sprint));
    // jump() leaves onGround alone: this tick still moves with ground friction.
  }
  // EntityLivingBase.moveEntityWithHeading: water and lava use moveFlying(0.02F); on land the
  // friction is the slipperiness under the feet (read before the move), and the acceleration
  // is aiMoveSpeed * 0.16277136F / friction³ on the ground or jumpMovementFactor in the air.
  // Flying replaces jumpMovementFactor with flySpeed.
  slip = slipperiness(world.get(Math.floor(position.x), Math.floor(position.y) - 1, Math.floor(position.z)));
  const onGroundMove = grounded && !flying;
  const friction = onGroundMove ? Math.fround(slip * Math.fround(0.91)) : Math.fround(0.91);
  const accel = swimming
    ? LIQUID_ACCEL
    : flying
      ? FLY_SPEED
      : onGroundMove
        ? groundAccel(sprint, friction, survival.effects?.moveSpeedMultiplier?.() ?? 1)
        : airAccel(sprint);
  velocity.x += (Math.cos(yaw) * dx - Math.sin(yaw) * dz) * accel;
  velocity.z += (-Math.sin(yaw) * dx - Math.cos(yaw) * dz) * accel;
  if (!flying) {
    // moveEntityWithHeading's land branch on a ladder: motion clamped to 0.15, sneaking holds on.
    if (!inWater && !lava && isOnLadder(world, position.x, position.y, position.z)) {
      ladderClamp(velocity, sneak);
      fallDistance = 0;
    }
  }
  // EntityPlayer.moveEntityWithHeading keeps motionY from before the move when flying.
  const flyY = velocity.y;
  // Entity.moveEntity (entities.js, replayed against the original player class): y, x, z
  // against the block collision boxes, the 0.5 stepHeight retry and the sneak edge loop,
  // both shortening this tick's move (after the web slowdown), not the motion.
  const [mx, my, mz] = webMove(motion, velocity, ['x', 'y', 'z']);
  const body = {
    x: position.x, y: position.y, z: position.z, vx: velocity.x, vy: velocity.y, vz: velocity.z,
    onGround: grounded, sneaking: sneak, fallDistance: flying ? 0 : fallDistance, inWater, living: true,
    // onLivingUpdate's sneak raise; moveEntity applies the * 0.4 decay before its step test.
    ySize: sneak && motion.ySize < Math.fround(SNEAK_YSIZE) ? Math.fround(SNEAK_YSIZE) : motion.ySize,
  };
  // Entity.updateFallState runs inside moveEntity: on landing it passes the distance gathered
  // before this move (the landing move itself does not count), else a downward move adds to it.
  const landed = moveEntity(world, body, PHYSICS.width, PHYSICS.height, mx, my, mz);
  if (!flying) {
    landedFall = landed;
    fallDistance = body.fallDistance;
  }
  Object.assign(position, { x: body.x, y: body.y, z: body.z });
  Object.assign(velocity, { x: body.vx, y: body.vy, z: body.vz });
  collidedH = body.collidedH;
  // Stay inside resident terrain; streamed windows advance before movement.
  for (const axis of ["x", "z"]) {
    const held = Math.max((world[axis === "x" ? "minX" : "minZ"] ?? 0) + 0.31, Math.min((world[axis === "x" ? "maxX" : "maxZ"] ?? SIZE) - 0.31, position[axis]));
    if (held !== position[axis]) {
      position[axis] = held;
      velocity[axis] = 0;
      collidedH = true;
    }
  }
  grounded = body.onGround;
  // The moveEntity tail (webs, cactus, fire) runs in tickSurvival after Entity.onEntityUpdate's part.
  motion.endMove();
  // Pushing into a wall while on a ladder climbs at 0.2 a tick.
  if (!flying && !inWater && !lava && collidedH && isOnLadder(world, position.x, position.y, position.z)) velocity.y = LADDER_CLIMB;
  // Water: motion * 0.8, then motionY - 0.02; lava: * 0.5, then - 0.02; land and flight: gravity
  // 0.08 and drag 0.98 on motionY, friction on x/z (flight then sets motionY = before * 0.6).
  velocity.y = flying
    ? flyY * FLY_Y_DRAG
    : lava
      ? velocity.y * 0.5 - 0.02
      : inWater
        ? velocity.y * 0.800000011920929 - 0.02
        : fallingVelocity(velocity.y);
  const drag = lava ? 0.5 : inWater && !flying ? 0.800000011920929 : friction;
  velocity.x *= drag;
  velocity.z *= drag;
  if (Math.abs(velocity.x) < 0.005) velocity.x = 0;
  if (Math.abs(velocity.z) < 0.005) velocity.z = 0;
  if (swimming && collidedH) {
    // Step out of water or lava: pushed up 0.3 when blocked and the spot 0.6 higher is
    // clear of blocks and liquid (Entity.isOffsetPositionInLiquid).
    const dy = velocity.y + 0.6 - (position.y - oldPosition.y), moved = playerBox(dy);
    moved[0] += velocity.x; moved[3] += velocity.x; moved[2] += velocity.z; moved[5] += velocity.z;
    const clear = !collides(world, position.x + velocity.x, position.y + dy, position.z + velocity.z) && !liquidInBox(world, moved, 10) && !liquidInBox(world, moved, 42);
    if (clear) velocity.y = 0.30000001192092896;
  }
  // EntityPlayerSP.onLivingUpdate: touching the ground ends Creative flight.
  if (flying && grounded) {
    flying = false;
    toast("Back to walking");
  }
  // Below the floor is the void (Survival.tick's outOfWorld damage under y -64); only a player far
  // above the finite world is put back at spawn.
  if (position.y > world.height + 40) {
    const spawn = world.spawn();
    Object.assign(position, { x: spawn.x, y: spawn.y, z: spawn.z });
    Object.assign(previous, { x: position.x, y: position.y, z: position.z });
    Object.assign(velocity, { x: 0, y: 0, z: 0 });
    toast("Back on solid ground.");
  }
  Object.assign(state, { grounded, collidedH, flying, fallDistance, landedFall });
  return { inWater, inLavaNow, sneakOnGround, oldPosition };
}
