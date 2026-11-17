// Batch 78 mpperf78: the tight push grid (push-grid.js FineGrid / pushNear) returns exactly the pushes of the full scan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { FineGrid, fineConfig, pushNear, beginPushGrid, endPushGrid, markMoved } from './push-grid.js';
import { pushHalf, pushBox, ENTITY_TYPES } from './entities.js';
import { buildPenScene } from './mpperf78-scene.js';
import { drain, lcg } from './mpperf77-scene.js';

const mk = (type, x, z, extra = {}) => ({ type, x, y: 10, z, health: 5, ...extra });
const nearOf = (o) => { const w = Math.fround(ENTITY_TYPES[o.type].width) / 2, h = ENTITY_TYPES[o.type].height; return [o.x - w - 0.2, o.y, o.z - w - 0.2, o.x + w + 0.2, o.y + h, o.z + w + 0.2]; };
const meets = (near, o) => { const b = pushBox(o, ...[ENTITY_TYPES[o.type].width, ENTITY_TYPES[o.type].height]); return b[3] > near[0] && b[0] < near[3] && b[4] > near[1] && b[1] < near[4] && b[5] > near[2] && b[2] < near[5]; };

test('every table width is bounded by pushHalf', () => {
  for (const [type, t] of Object.entries(ENTITY_TYPES)) assert.ok(pushHalf({ type, size: 1 }) >= Math.fround(t.width) / 2, type);
  assert.equal(pushHalf({ type: 'slime', size: 4 }), ENTITY_TYPES.slime.width * 2);
  assert.equal(pushHalf({ type: 'nonsense' }), Infinity);
});

test('candidates hold every entity whose box meets, in list order (random mixed list)', () => {
  const r = lcg(3), kinds = ['cow', 'pig', 'zombie', 'ghast', 'giant', 'spider', 'chicken'], list = [];
  for (let i = 0; i < 300; i++) list.push(mk(kinds[Math.floor(r() * kinds.length)], 20 + r() * 25, 20 + r() * 25));
  const g = new FineGrid(list, pushHalf);
  for (const self of list.slice(0, 120)) {
    const near = nearOf(self), got = g.query(near), want = list.filter((o) => meets(near, o));
    assert.deepEqual(got.filter((o) => meets(near, o)), want);
    for (let i = 1; i < got.length; i++) assert.ok(list.indexOf(got[i]) > list.indexOf(got[i - 1]));
    assert.ok(got.length < list.length / 2 || self.type === 'giant' || self.type === 'ghast');
  }
});

test('touch re-files a moved entity; a changed list falls back (null)', () => {
  const list = [mk('cow', 5, 5), mk('cow', 50, 50), mk('cow', 90, 90)], g = new FineGrid(list, pushHalf), near = nearOf(list[0]);
  assert.deepEqual(g.query(near), [list[0]]);
  list[2].x = 5.3; list[2].z = 5.2; // moved without a touch: the stale cell hides it (why the loop touches after every turn)
  assert.deepEqual(g.query(near), [list[0]]);
  g.touch(list[2]);
  assert.deepEqual(g.query(near), [list[0], list[2]]);
  list.push(mk('cow', 1, 1));
  assert.equal(g.query(near), null);
});

test('huge slimes and unknown types are always candidates', () => {
  const list = [mk('cow', 5, 5), mk('slime', 100, 100, { size: 20 }), mk('cow', 60, 60)], g = new FineGrid(list, pushHalf);
  assert.deepEqual(g.query(nearOf(list[0])), [list[0], list[1]]);
});

test('pushNear is off outside the mob loop, below the minimum and when disabled', () => {
  const list = Array.from({ length: 80 }, (_, i) => mk('cow', i, 0)), near = nearOf(list[0]), was = { ...fineConfig };
  try {
    fineConfig.mode = 'on'; fineConfig.min = 60;
    assert.equal(pushNear(list, list[0], near, pushHalf, () => true), null); // no loop running
    beginPushGrid();
    assert.ok(Array.isArray(pushNear(list, list[0], near, pushHalf, () => true)));
    markMoved(list[3]);
    fineConfig.min = 100; assert.equal(pushNear(list, list[0], near, pushHalf, () => true), null);
    fineConfig.min = 60; fineConfig.mode = 'off'; assert.equal(pushNear(list, list[0], near, pushHalf, () => true), null);
    fineConfig.mode = 'verify'; assert.ok(Array.isArray(pushNear(list, list[0], near, pushHalf, (o) => meets(near, o))));
  } finally { endPushGrid(); Object.assign(fineConfig, was); }
});

const stateOf = (opts, mode, ticks) => {
  const was = { ...fineConfig }, realRandom = Math.random, rs = lcg(12345);
  Math.random = () => rs(); fineConfig.mode = mode;
  try {
    const s = buildPenScene(opts), h = createHash('sha256');
    for (let i = 0; i < ticks; i++) { s.tick(); h.update(JSON.stringify(drain(s))); }
    for (const e of s.mobs.mobs.entities) h.update(`${e.type}|${e.x}|${e.y}|${e.z}|${e.vx}|${e.vz}|${e.health};`);
    return h.digest('hex');
  } finally { Math.random = realRandom; Object.assign(fineConfig, was); }
};

test('seeded pens: off, on and verify give the same state (cows, mixed kinds)', () => {
  for (const opts of [{ mobs: 100, pen: 8, kind: 'cow' }, { mobs: 90, pen: 8, kind: ['pig', 'sheep', 'zombie', 'spider', 'villager', 'horse', 'ghast', 'iron_golem'] }]) {
    const off = stateOf(opts, 'off', 40);
    assert.equal(stateOf(opts, 'on', 40), off);
    assert.equal(stateOf(opts, 'verify', 40), off); // verify throws on the first difference
  }
});
