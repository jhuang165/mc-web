// Batch 84 mpperf84: the server tick cuts (cached mob target boxes, aiMoveSpeed without modifier arrays, stepBlock in a scratch object, indexed collision loops)
// give the reference results; MC_MPPERF84=verify throws on a difference.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fast84, boxStore, mobBoxAt, moveSpeedQuick } from './mpperf84-fast.js';
import { mobTargets } from './projectiles.js';
import { aiMoveSpeed, ENTITY_TYPES } from './entities.js';
import { stepBlock, stepBlockInto } from './step-block.js';
import { buildPenScene } from './mpperf78-scene.js';
import { buildPlayersScene, drain, lcg } from './mpperf77-scene.js';

const withMode = (mode, fn) => { const was = fast84.mode; fast84.mode = mode; try { return fn(); } finally { fast84.mode = was; } };
const plain = (t) => JSON.stringify(t.map((x) => ({ ...x, ref: undefined, r: x.ref?.id ?? x.ref?.type, box: x.box.map((v) => (Object.is(v, -0) ? '-0' : v)) })));

test('mobTargets: cached boxes equal fresh boxes through moves, -0, NaN, a growing calf and a shifted list; a handed-out box is never rewritten', () => {
  const mk = (type, x, y, z) => ({ type, x, y, z, growingAge: 0, health: 10 });
  for (const mode of ['on', 'verify']) withMode(mode, () => {
    const ents = [mk('cow', 1, 64, 1), mk('zombie', 5, 64, 5), mk('pig', -0, 64, 2), mk('sheep', NaN, 64, 0), mk('chicken', 2, 64, 2)];
    const handed = [];
    for (let step = 0; step < 6; step++) {
      const got = mobTargets(ents, null), want = withMode('off', () => mobTargets(ents, null));
      assert.equal(plain(got), plain(want));
      handed.push(got.map((t) => [...t.box]), got.map((t) => t.box));
      if (step === 1) ents[0].x += 0.25;
      if (step === 2) { ents[2].x = 0; ents[1].growingAge = -24000; }
      if (step === 3) ents.splice(1, 1);
      if (step === 4) ents.push(mk('cow', 9, 70, 9));
    }
    for (let i = 0; i < handed.length; i += 2) handed[i + 1].forEach((box, k) => assert.deepEqual(box.map((v) => (Object.is(v, -0) ? '-0' : v)), handed[i][k].map((v) => (Object.is(v, -0) ? '-0' : v))));
  });
});

test('mobBoxAt: a store is per list and a different list does not reuse it', () => {
  withMode('on', () => {
    const a = [{ x: 1, y: 2, z: 3 }], b = [{ x: 1, y: 2, z: 3 }];
    assert.equal(boxStore(a), boxStore(a));
    assert.notEqual(boxStore(a), boxStore(b));
    const first = mobBoxAt(boxStore(a), 0, a[0], 0.3, 1.8);
    assert.equal(mobBoxAt(boxStore(a), 0, a[0], 0.3, 1.8), first);
    assert.notEqual(mobBoxAt(boxStore(a), 0, a[0], 0.3, 1.9), first);
  });
  withMode('off', () => assert.equal(boxStore([]), null));
});

test('aiMoveSpeed: the quick path and the reference agree for plain and modified mobs', () => {
  const base = (type, extra = {}) => ({ type, growingAge: 0, ...extra });
  const mods = [{ attribute: 'generic.movementSpeed', amount: 0.1, operation: 1, uuid: 'x', name: 'm' }];
  const cases = [];
  for (const type of Object.keys(ENTITY_TYPES)) {
    cases.push(base(type), base(type, { growingAge: -1 }), base(type, { effects: [{ id: 1, amplifier: 1, duration: 100 }] }), base(type, { modifiers: mods }), base(type, { attributeBases: { 'generic.movementSpeed': 0.4 } }),
      base(type, { speedBoost: true, pigTarget: {}, drinking: true, sprinting: true }), base(type, { horse: { speed: 0.3375 } }), base(type, { modifiers: [] }), base(type, { effects: [] }), base(type, { attributeBases: { 'generic.movementSpeed': -1 } }));
  }
  for (const e of cases) for (const m of [1, 0.5, 1.33]) {
    const want = withMode('off', () => aiMoveSpeed(e, m));
    assert.ok(Object.is(withMode('on', () => aiMoveSpeed(e, m)), want), e.type);
    assert.ok(Object.is(withMode('verify', () => aiMoveSpeed(e, m)), want), e.type);
  }
  assert.equal(moveSpeedQuick({ type: 'cow', effects: [{}] }, () => 1, 9), undefined);
  assert.equal(moveSpeedQuick({ type: 'zombie', growingAge: -1 }, () => 1, 9), undefined);
  assert.equal(moveSpeedQuick({ type: 'cow' }, () => 0.2, 9), 0.2);
});

test('stepBlockInto: the scratch answer equals stepBlock (fence below, ladder, plain, air)', () => {
  const FENCE = 85, LADDER = 65;
  const worlds = [(x, y, z) => (y === 4 ? LADDER : y === 3 ? 1 : 0), (x, y, z) => (y === 3 ? FENCE : y === 4 ? 1 : 0), () => 0, (x, y, z) => (y <= 4 ? 1 : 0)];
  for (const get of worlds) for (const mode of ['on', 'verify']) withMode(mode, () => {
    const out = { x: 9, y: 9, z: 9, id: 9, replaced: true, ladder: true };
    for (const [px, y, pz] of [[0.5, 5.1, 0.5], [-3.2, 4.0, 7.9], [10, 4.3, -0.01]]) {
      const got = stepBlockInto({ get }, px, y, pz, out), want = withMode('off', () => stepBlock({ get }, px, y, pz));
      assert.deepEqual({ ...got }, { ...want });
    }
  });
});

test('seeded scenes: state hashes are equal in off, on and verify', () => {
  const run = (mode) => withMode(mode, () => {
    const rs = lcg(12345), was = Math.random; Math.random = () => rs();
    try {
      const s = buildPlayersScene({ players: 4, layout: 'spread', mobs: 60, seed: 3 }), pen = buildPenScene({ mobs: 40, pen: 10, kind: ['cow', 'zombie'], seed: 2 });
      const h = createHash('sha256');
      for (let i = 0; i < 40; i++) { h.update(JSON.stringify(s.tick())); h.update(JSON.stringify(drain(s))); h.update(JSON.stringify(pen.tick())); }
      return h.digest('hex');
    } finally { Math.random = was; }
  });
  const off = run('off');
  assert.equal(run('on'), off);
  assert.equal(run('verify'), off);
});
