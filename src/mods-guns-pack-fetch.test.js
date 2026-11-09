import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchPackText } from './mods/guns/pack-fetch.js';
import { createAssetQueue } from './asset-requests.js';

test('pack files recover transient HTTP and network errors with distinct retry URLs', async () => {
  const urls = [], waits = [];
  const value = await fetchPackText('/mods/cs2/model.json', { fetch: async url => {
    urls.push(url);
    if (urls.length === 1) return { status: 502, ok: false };
    if (urls.length === 2) throw Error('connection reset');
    return { status: 200, ok: true, text: async () => 'complete model' };
  }, retry: { wait: async ms => waits.push(ms) } });
  assert.equal(value, 'complete model');
  assert.deepEqual(urls, ['/mods/cs2/model.json', '/mods/cs2/model.json?retry=1', '/mods/cs2/model.json?retry=2']);
  assert.deepEqual(waits, [500, 2000]);
});

test('optional missing packs do not retry; exhausted failures release the queue for other assets', async () => {
  let calls = 0;
  assert.equal(await fetchPackText('/mods/cs2/index.json', { fetch: async () => { calls++; return { status: 404, ok: false }; } }), null);
  assert.equal(calls, 1);
  const queue = createAssetQueue(1), urls = [];
  const fetch = async url => { urls.push(url); return url.startsWith('bad') ? { status: 503, ok: false } : { status: 200, ok: true, text: async () => 'ok' }; };
  assert.deepEqual(await Promise.all(['bad', 'good'].map(url => fetchPackText(url, { fetch, queue, retry: { wait: async () => {} } }))), [null, 'ok']);
  assert.equal(urls.filter(url => url.startsWith('bad')).length, 3);
});
