// Replays the browser port's movementTick as it existed before extraction.
// This is a regression baseline, not evidence from original Minecraft classes.
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { PHYSICS, SIZE, slipperiness, fallingVelocity, collides } from '../src/world.js';
import { webMove } from '../src/webs.js';
import { moveEntity, pushOutOfBlocks } from '../src/entities.js';
import { entityWaterBox, waterAcceleration, inLava, liquidInBox } from '../src/fluids.js';
import { isOnLadder, ladderClamp, LADDER_CLIMB } from '../src/ladders.js';
import { SNEAK_YSIZE, moveWeights, groundAccel, airAccel, LIQUID_ACCEL, JUMP_MOTION,
  jumpExhaustion, sprintJumpPush, FLY_SPEED, FLY_Y_DRAG, flyVertical } from '../src/player-movement.js';
import { playerFixture, playerInputs, playerSnapshot } from '../src/player-physics-fixture.js';

const repo = new URL('..', import.meta.url);
const source = execFileSync('git', ['show', '94471712be3e5dee342ccf67842a13dbd7d46967:src/main.js'], { cwd: repo, encoding: 'utf8' });
const prefix = 'function movementTick(controls) {';
const start = source.indexOf(prefix), end = source.indexOf('  $("#movement-label").textContent', start);
if (start < 0 || end < 0) throw new Error('Unable to find pre-extraction movement');
const body = source.slice(start + prefix.length, end);
// The pinned source body runs with the same globals as main.js, supplied by the fixture.
const step = new Function('state', 'controls', `with (state) { ${body}\n return { inWater, inLavaNow, sneakOnGround, oldPosition }; }`);
const dependencies = { THREE, PHYSICS, SIZE, slipperiness, fallingVelocity, collides, webMove, moveEntity,
  pushOutOfBlocks, entityWaterBox, waterAcceleration, inLava, liquidInBox, isOnLadder, ladderClamp,
  LADDER_CLIMB, SNEAK_YSIZE, moveWeights, groundAccel, airAccel, LIQUID_ACCEL, JUMP_MOTION,
  jumpExhaustion, sprintJumpPush, FLY_SPEED, FLY_Y_DRAG, flyVertical };
const cases = {};
for (const name of ['land', 'water', 'lava', 'ladder', 'web', 'edge', 'ceiling']) {
  const state = playerFixture(name);
  Object.assign(state, dependencies, { walkFrozen: false, toast: message => state.toasts.push(message) });
  cases[name] = playerInputs(name).map(input => playerSnapshot(state, step(state, input)));
}
await writeFile(new URL('../public/research/player-physics-baseline.json', import.meta.url), JSON.stringify({
  description: 'Pre-extraction browser port movementTick traces at 9447171; not original Java evidence', cases,
}));
