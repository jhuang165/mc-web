// Batch 79 mpperf79: the exact speed-ups equal the reference paths (MC_MPPERF79=verify throws on a difference).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fast79, blockBoxes, blockBoxesReference, nearestView, nearestReference, dropViewList, mobStateJson, sweepBox, sweepBoxReference } from './mpperf79-fast.js';
import { pushBox, EntityWorld } from './entities.js';
import { collisionBoxes as cellFn } from './world.js';
import { mobState } from './multiplayer/server-mobs.js';
import { buildPenScene } from './mpperf78-scene.js';
import { drain, lcg } from './mpperf77-scene.js';

const withMode = (mode, fn) => { const was = fast79.mode; fast79.mode = mode; try { return fn(); } finally { fast79.mode = was; } };

test('blockBoxes: random world, same boxes in the same order', () => {
  const r = lcg(7), cells = new Map();
  const world = { get: (x, y, z) => cells.get(`${x},${y},${z}`) ?? 0, solid: (x, y, z) => (cells.get(`${x},${y},${z}`) ?? 0) !== 0 };
  for (let i = 0; i < 400; i++) cells.set(`${Math.floor(r() * 12)},${Math.floor(r() * 6)},${Math.floor(r() * 12)}`, 1 + Math.floor(r() * 3));
  const cell = (w, x, y, z) => (w.solid(x, y, z) ? [[0, 0, 0, 1, 1, 1]] : []);
  for (let i = 0; i < 300; i++) {
    const x = r() * 12, y = r() * 6, z = r() * 12, b = [x, y, z, x + 0.3 + r() * 2, y + 0.5 + r() * 2, z + 0.3 + r() * 2];
    const ref = blockBoxesReference(world, b, [], cell);
    assert.deepEqual(withMode('verify', () => blockBoxes(world, b, [[9, 9, 9, 9, 9, 9]], cell)).slice(1), ref);
    assert.deepEqual(withMode('on', () => blockBoxes(world, b, [], cell)), ref);
    assert.deepEqual(withMode('off', () => blockBoxes(world, b, [], cell)), ref);
  }
  assert.equal(typeof cellFn, 'function');
});

test('nearestView: ties keep the first, a changed view set is seen, verify agrees', () => {
  const views = new Map(), mk = (id, x, z) => ({ id, player: { position: { x, y: 0, z } } });
  views.set('a', mk('a', 5, 0)); views.set('b', mk('b', -5, 0)); views.set('c', mk('c', 50, 0));
  const e = { x: 0, y: 0, z: 0 };
  withMode('verify', () => {
    assert.equal(nearestView(views, e).id, 'a');
    dropViewList(views); views.delete('a'); views.set('d', mk('d', 1, 1)); // ServerMobs.addPlayer / removePlayer drop the cached list
    assert.equal(nearestView(views, e).id, 'd');
    views.clear();
    assert.equal(nearestView(views, e), null);
  });
  assert.equal(nearestReference(new Map(), e), null);
});

test('mobStateJson: every flag combination of plain and special types', () => {
  for (const type of ['cow', 'pig', 'sheep', 'zombie', 'creeper', 'villager', 'wolf', 'skeleton', 'spider', 'chicken', 'ghast', 'slime'])
    for (let m = 0; m < 16; m++) {
      const e = { type, health: m & 1 ? 0 : 5, hurt: m & 2 ? 4 : 0, growingAge: m & 4 ? -100 : 0, burn: m & 8 ? 3 : 0, fire: 0, size: 2, owner: null };
      assert.equal(withMode('verify', () => mobStateJson(e, mobState)), JSON.stringify(mobState(e)));
    }
  const e = { type: 'cow', health: 5, fire: 2 };
  assert.equal(withMode('on', () => mobStateJson(e, mobState)), '{"burn":1}');
});

test('sweepBox: same box or null as the reference, mixed sizes', () => {
  const r = lcg(11), mobs = new EntityWorld(undefined, []);
  for (let i = 0; i < 400; i++) {
    const type = ['cow', 'ghast', 'zombie', 'chicken', 'giant', 'slime'][i % 6], e = { type, x: r() * 20, y: r() * 6, z: r() * 20, size: 1 + (i % 3), health: 5 };
    const x = r() * 20, y = r() * 6, z = r() * 20, q = [x - 1, y - 1, z - 1, x + 1 + r() * 3, y + 1 + r() * 3, z + 1 + r() * 3];
    const ref = sweepBoxReference(mobs, e, q, pushBox);
    assert.deepEqual(withMode('verify', () => sweepBox(mobs, e, q, pushBox)), ref);
    assert.deepEqual(withMode('off', () => sweepBox(mobs, e, q, pushBox)), ref);
  }
});

const pen = (mode, kind, mobs) => withMode(mode, () => {
  const was = Math.random, rs = lcg(12345); Math.random = () => rs();
  try {
    const s = buildPenScene({ mobs, pen: 10, kind }), h = createHash('sha256');
    for (let i = 0; i < 40; i++) { s.tick(); drain(s); }
    for (const e of s.mobs.mobs.entities) h.update(`${e.type}|${e.x}|${e.y}|${e.z}|${e.vx}|${e.vz}|${e.health};`);
    return h.digest('hex');
  } finally { Math.random = was; }
});

test('a pen scene hashes the same off, on and verify', () => {
  const kind = ['cow', 'zombie', 'villager', 'ghast'], off = pen('off', kind, 60);
  assert.equal(pen('on', kind, 60), off);
  assert.equal(pen('verify', kind, 60), off);
});
