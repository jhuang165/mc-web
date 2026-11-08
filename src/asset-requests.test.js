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

test('a transiently failing asset is retried with a fresh URL, then gives up', async () => {
  const { retryAsset, retryUrl } = await import('./asset-requests.js');
  const waits = [], urls = [];
  const flaky = attempt => { urls.push(retryUrl('/media/1.7.10/blocks/cake_side.png?r=2', attempt)); if (attempt < 2) throw new Error('503'); return 'ok'; };
  assert.equal(await retryAsset(flaky, { wait: async ms => { waits.push(ms); } }), 'ok');
  assert.deepEqual(waits, [500, 2000]);
  assert.deepEqual(urls, ['/media/1.7.10/blocks/cake_side.png?r=2', '/media/1.7.10/blocks/cake_side.png?r=2&retry=1', '/media/1.7.10/blocks/cake_side.png?r=2&retry=2']);
  assert.equal(retryUrl('/a.png', 1), '/a.png?retry=1');
  let tries = 0;
  await assert.rejects(retryAsset(() => { tries++; throw new Error('Texture missing: x'); }, { wait: async () => {} }), /Texture missing/);
  assert.equal(tries, 3, 'a texture that is really missing still fails after two retries');
});
