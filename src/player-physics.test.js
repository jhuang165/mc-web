import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { movePlayer } from './player-physics.js';
import { playerFixture, playerInputs, playerSnapshot } from './player-physics-fixture.js';
import { WATER } from './world.js';

const baseline = JSON.parse(readFileSync(new URL('../public/research/player-physics-baseline.json', import.meta.url)));

for (const name of ['land', 'water', 'lava', 'ladder', 'web', 'edge', 'ceiling']) test(`player movement replays pre-extraction ${name} trace`, () => {
  const state = playerFixture(name);
  // The extracted physics operates on plain coordinates, without Three.js vectors.
  for (const key of ['position', 'previous', 'velocity']) {
    const { x, y, z } = state[key];
    state[key] = { x, y, z };
  }
  const inputs = JSON.parse(JSON.stringify(playerInputs(name)));
  const steps = inputs.map(input => playerSnapshot(state, movePlayer(state, input, message => state.toasts.push(message))));
  assert.deepEqual(steps, baseline.cases[name]);
  if (name === 'land') {
    assert.ok(steps.some(step => step.collidedH), 'walked into a wall');
    assert.ok(steps.some(step => step.exhaustion > 0), 'jump caused exhaustion');
    assert.ok(steps.some(step => step.motion.sneaking), 'sneaking was exercised');
  }
  if (name === 'water') {
    assert.ok(steps.some(step => step.result.inWater), 'water movement was exercised');
    assert.ok(steps.some(step => step.flying), 'double-jump toggled creative flight');
  }
  if (name === 'lava') assert.ok(steps.some(step => step.result.inLavaNow), 'lava movement was exercised');
  if (name === 'ladder') assert.ok(steps.some(step => step.collidedH && step.velocity[1] > 0), 'wall collision climbed the ladder');
  if (name === 'web') assert.equal(steps[0].motion.inWeb, false, 'movement consumed web slowdown');
  if (name === 'edge') assert.ok(steps.every(step => step.position[0] >= 0.31), 'finite-world clamp held');
  if (name === 'ceiling') assert.equal(steps[0].toasts.length, 0); // reset without a message
});

// EntityLivingBase.updateFallState runs handleWaterMovement on the moved box before Entity's
// landing branch, so a fall that ends in 1-deep water deals no damage (before this, only the
// pre-move water test reset fallDistance, and a fast fall landed on the floor below it).
test('a long fall into 1-deep water lands with no fall distance', () => {
  for (const [deep, expectDamage] of [[1, false], [0, true]]) {
    const state = playerFixture('land');
    for (const key of ['position', 'previous', 'velocity']) { const { x, y, z } = state[key]; state[key] = { x, y, z }; }
    const { world } = state;
    for (let x = 62; x <= 66; x++) for (let z = 63; z <= 67; z++) { for (let y = 10; y <= 60; y++) world.put(x, y, z, 0, 0, false); if (deep) world.put(x, 10, z, WATER, 0, false); }
    Object.assign(state.position, { x: 64.5, y: 40, z: 65.5 });
    state.grounded = false;
    let landed = null;
    for (let i = 0; i < 80 && landed === null; i++) {
      movePlayer(state, { forward: 0, strafe: 0, sneak: false, sprint: false, jump: false });
      if (state.grounded) landed = state.landedFall;
    }
    assert.notEqual(landed, null, 'reached the floor');
    assert.equal(landed > 3, expectDamage, `deep=${deep} landedFall=${landed}`);
  }
});

// EntityPlayer.sleepInBedAt: the lying body is 0.2 wide and movement is blocked, so the standing box is never pushed off the bed.
test('a sleeping player stays on the bed beside a wall', () => {
  const state = playerFixture('land');
  for (const key of ['position', 'previous', 'velocity']) { const { x, y, z } = state[key]; state[key] = { x, y, z }; }
  const { world } = state, { x: px, y: py, z: pz } = state.position, bx = Math.floor(px), by = Math.floor(py), bz = Math.floor(pz);
  for (let y = by; y <= by + 2; y++) world.put(bx + 1, y, bz, 3, 0, false);
  Object.assign(state.position, { x: bx + 0.9, y: by + 0.5625, z: bz + 0.5 });
  Object.assign(state.velocity, { x: 0.1, y: -0.08, z: 0 });
  state.sleeping = true;
  for (let i = 0; i < 20; i++) movePlayer(state, { forward: 1, strafe: 0, sneak: false, sprint: false, jump: true });
  assert.deepEqual(state.position, { x: bx + 0.9, y: by + 0.5625, z: bz + 0.5 });
  assert.deepEqual(state.velocity, { x: 0, y: 0, z: 0 });
});
