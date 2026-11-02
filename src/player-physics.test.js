import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { movePlayer } from './player-physics.js';
import { playerFixture, playerInputs, playerSnapshot } from './player-physics-fixture.js';

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
  if (name === 'ceiling') assert.ok(steps[0].toasts.includes('Back on solid ground.'));
});
