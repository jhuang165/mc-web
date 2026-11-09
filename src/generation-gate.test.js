// Generation version gating of the population's neighbour callbacks: worlds before 20 keep the quiet callbacks (saves regenerate as they did).
import test from 'node:test';
import assert from 'node:assert/strict';
import { neighborsOn, mapFeaturesOn, nativeSpawnGeneration, NEIGHBOR_GENERATION } from './java-world.js';
import { World } from './world.js';

test('neighbour callbacks start at generation 20 only', () => {
  for (const v of [13, 14, 15, 16, 17, 18, 19]) assert.equal(neighborsOn(v), false, `v${v}`);
  assert.equal(NEIGHBOR_GENERATION, 20);
  assert.equal(neighborsOn(20), true);
  for (const v of [21, 22, 23]) assert.equal(neighborsOn(v), true, `v${v}`);
});

test('MapFeatures stays off at 17, 19 and 21 and on elsewhere', () => {
  for (const v of [15, 16, 18, 20, 22]) assert.equal(mapFeaturesOn(v), true, `v${v}`);
  for (const v of [17, 19, 21, 23]) assert.equal(mapFeaturesOn(v), false, `v${v}`);
});

test('level.dat import generations 22 and 23 add the neighbour callbacks to 16 and 17 and keep the import origin', () => {
  for (const v of [22, 23]) assert.equal(nativeSpawnGeneration(v), false, `v${v}`);
  for (const v of [18, 19, 20, 21]) assert.equal(nativeSpawnGeneration(v), true, `v${v}`);
  // Same origin as the generation they extend; the saved 16 / 17 worlds are untouched.
  for (const [old, next] of [[16, 22], [17, 23]]) {
    const a = new World('671', 'javaStreamed', old, 'default'), b = new World('671', 'javaStreamed', next, 'default');
    assert.deepEqual([b.originX, b.originZ], [a.originX, a.originZ]);
    assert.equal(b.nativeSpawn, undefined);
  }
});
