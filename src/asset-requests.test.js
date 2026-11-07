import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAssetQueue } from './asset-requests.js';

test('atlas request bursts stay bounded and drain in order despite rejected images', async () => {
  const queue = createAssetQueue(4), started = [], finish = [];
  let active = 0, peak = 0;
  const promises = Array.from({ length: 500 }, (_, i) => queue(() => {
    started.push(i); active++; peak = Math.max(peak, active);
    return new Promise((resolve, reject) => finish.push(() => { active--; i % 31 ? resolve(i) : reject(new Error('missing')); }));
  }));
  const settled = Promise.allSettled(promises);
  assert.equal(started.length, 4);
  while (finish.length) { finish.shift()(); await Promise.resolve(); }
  const results = await settled;
  assert.equal(peak, 4);
  assert.deepEqual(started, Array.from({ length: 500 }, (_, i) => i));
  assert.equal(results.filter(r => r.status === 'rejected').length, 17);
  assert.equal(await queue(() => 42), 42, 'later resource refresh can reuse the drained queue');
});

test('a synchronous asset-loader error frees capacity for the next asset', async () => {
  const queue = createAssetQueue(1);
  await assert.rejects(queue(() => { throw new Error('image constructor failed'); }), /constructor failed/);
  assert.equal(await queue(() => 'next'), 'next');
  assert.throws(() => createAssetQueue(0), RangeError);
});
