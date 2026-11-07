import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { LightVolume, lightEmission, drain } from './lighting.js';
import { StreamingLight } from './streaming-light.js';

// Batch 22 (loading3): the light volume build can be run as a generator in frame-sized slices. The slices only pause between
// statements of the unchanged flood, so every array must equal the synchronous build.
const emission = (x, y, z, b) => lightEmission(b);
const world = () => { const w = new World('17', 'javaStreamed', 12); w.blockLight = () => 0; return w; };
function decorate(w) {
  for (const [x, z] of [[-17, 40], [20, 50], [64, 64], [111, 40], [60, 127], [30, -1]]) {
    if (!w.isLoaded(x, z)) continue;
    w.set(x, 180, z, 20);
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) if (w.isLoaded(x + a, z + b)) w.set(x + a, 184, z + b, 1);
  }
}
const equal = (a, b, label) => {
  assert.ok(Buffer.from(a.sky).equals(Buffer.from(b.sky)), `${label}: sky`);
  assert.ok(Buffer.from(a.block).equals(Buffer.from(b.block)), `${label}: block`);
  assert.deepEqual([...a.heights], [...b.heights], `${label}: heights`);
};

test('a deferred StreamingLight built in single steps equals the synchronous build, and yields many times', () => {
  const w = world(); decorate(w);
  const fresh = new StreamingLight(w, emission), sliced = new StreamingLight(w, emission, { defer: true });
  assert.ok(sliced.inner.sky.every((v) => v === 0), 'nothing is built before the steps run');
  const steps = sliced.buildSteps();
  let n = 0;
  for (let r = steps.next(); !r.done; r = steps.next()) n++;
  assert.ok(n > 300, `a whole window build yields often (${n})`);
  equal(sliced.inner, fresh.inner, 'window');
});

test('relightSteps returns the same box and light as relight for a partial box', () => {
  const w = world(); decorate(w);
  const a = new StreamingLight(w, emission), b = new StreamingLight(w, emission);
  w.set(40, 100, 40, 20); w.set(41, 100, 40, 1);
  const boxA = a.inner.relight(20, 60, 20, 60), boxB = drain(b.inner.relightSteps(20, 60, 20, 60));
  assert.deepEqual(boxA, boxB);
  assert.ok(boxA, 'the edit changed light');
  equal(a.inner, b.inner, 'partial');
});

test('LightVolume over a plain world builds the same with and without defer', () => {
  const blocks = new Map();
  const mk = () => ({ height: 256, get: (x, y, z) => (y < 60 ? 1 : blocks.get(`${x},${y},${z}`) ?? 0) });
  blocks.set('10,70,10', 20); blocks.set('30,64,30', 89); blocks.set('31,64,30', 1);
  const a = new LightVolume(mk()), b = new LightVolume(mk(), undefined, { defer: true });
  drain(b.buildSteps());
  equal(a, b, 'plain');
});
