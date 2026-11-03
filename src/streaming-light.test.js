import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { lightEmission } from './lighting.js';
import { StreamingLight } from './streaming-light.js';

const emission = (x, y, z, b) => lightEmission(b);
const world = () => { const w = new World('17', 'javaStreamed', 12); w.blockLight = () => 0; return w; };
// Torches and an opaque roof on both sides of every seam a shift crosses, so kept, relit and new
// cells all carry block light and sky shadows. Unloaded columns replay theirs when they load.
function decorate(w) {
  const put = (x, y, z, b) => (w.isLoaded(x, z) ? w.set(x, y, z, b) : w.rememberEdit(x, y, z, b));
  for (const [x, z] of [[-17, 40], [-33, 50], [-49, 64], [-1, 40], [0, 70], [15, 9], [16, 100], [111, 40], [112, 60], [127, 5], [128, 64], [143, 64], [144, 30], [60, -1], [60, -16], [60, 127], [60, 128], [60, 143], [-20, 150], [-40, 159]]) {
    put(x, 180, z, 20);
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) put(x + a, 184, z + b, 1);
  }
}
const same = (shifted, w, label) => {
  const fresh = new StreamingLight(w, emission);
  assert.equal(shifted.x, fresh.x, label); assert.equal(shifted.z, fresh.z, label);
  assert.ok(Buffer.from(shifted.inner.sky).equals(Buffer.from(fresh.inner.sky)), `${label}: sky light`);
  assert.ok(Buffer.from(shifted.inner.block).equals(Buffer.from(fresh.inner.block)), `${label}: block light`);
  assert.deepEqual([...shifted.inner.heights], [...fresh.inner.heights], `${label}: heights`);
};

test('shifted streamed light equals a freshly built volume along each axis', () => {
  const w = world(); decorate(w);
  const light = new StreamingLight(w, emission);
  for (const [x, z, label] of [[64 + 16, 64, '+x'], [64 + 16, 64 + 16, '+z'], [64, 64 + 16, '-x'], [64, 64, '-z'], [64 - 48, 64, '-3x'], [64 - 48, 64 + 32, '+2z']]) {
    assert.ok(w.streamAround(x, z), label);
    const boxes = light.shift();
    assert.ok(Array.isArray(boxes), `${label}: incremental`);
    for (const b of boxes) assert.ok(b.x0 >= w.minX && b.x1 < w.maxX && b.z0 >= w.minZ && b.z1 < w.maxZ, `${label}: box inside the square`);
    same(light, w, label);
  }
});

test('diagonal and long shifts rebuild the whole volume', () => {
  const w = world();
  const light = new StreamingLight(w, emission);
  assert.deepEqual(light.shift(), []);
  w.streamAround(64 + 16, 64 + 16);
  assert.equal(light.shift(), null);
  same(light, w, 'diagonal');
  w.streamAround(64 + 16 + 96, 64 + 16);
  assert.equal(light.shift(), null);
  same(light, w, 'long');
});
