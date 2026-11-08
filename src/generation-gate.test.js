// Generation version gating of the population's neighbour callbacks: worlds before 20 keep the quiet callbacks (saves regenerate as they did).
import test from 'node:test';
import assert from 'node:assert/strict';
import { neighborsOn, mapFeaturesOn, NEIGHBOR_GENERATION } from './java-world.js';

test('neighbour callbacks start at generation 20 only', () => {
  for (const v of [13, 14, 15, 16, 17, 18, 19]) assert.equal(neighborsOn(v), false, `v${v}`);
  assert.equal(NEIGHBOR_GENERATION, 20);
  assert.equal(neighborsOn(20), true);
  assert.equal(neighborsOn(21), true);
});

test('MapFeatures stays off at 17, 19 and 21 and on elsewhere', () => {
  for (const v of [15, 16, 18, 20]) assert.equal(mapFeaturesOn(v), true, `v${v}`);
  for (const v of [17, 19, 21]) assert.equal(mapFeaturesOn(v), false, `v${v}`);
});
