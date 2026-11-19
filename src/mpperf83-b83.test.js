// Batch 83 mpperf83: the server tick cuts (java.util.Random on numbers, one frozen tickMobs type-size object, push's reused grown box, FineGrid's in-place
// sort, item pickup bounds in place, mobTargets without flatMap, one hidden class for player vectors) give the reference results; MC_MPPERF83=verify throws
// on a difference.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fast83, lcgNumber, lcgBig, typeSize, resetTypeSizes, pushNearBox, pushNearDone, fineSorted, pickupHits, sameTargets, mobTargetList, vectorOf } from './mpperf83-fast.js';
import { JavaRandom } from './java-random.js';
import { pushBox, ENTITY_TYPES } from './entities.js';
import { ItemEntities } from './item-entities.js';
import { mobTargets } from './projectiles.js';
import { buildTerrainPen } from './mpperf81-scene.js';
import { buildPenScene } from './mpperf78-scene.js';
import { buildPlayersScene, drain, lcg } from './mpperf77-scene.js';

const withMode = (mode, fn) => { const was = fast83.mode; fast83.mode = mode; try { return fn(); } finally { fast83.mode = was; } };

test('JavaRandom on numbers: every draw and the state match the BigInt step (all bit counts, negative and wide seeds, save/restore)', () => {
  const r = lcg(831), seeds = [0n, 1n, -1n, 42n, -123456789n, 0x5deece66dn, (1n << 48n) - 1n, 1n << 48n, (1n << 63n) - 1n, -(1n << 63n)];
  for (let k = 0; k < 40; k++) seeds.push(BigInt(Math.floor((r() - 0.5) * 2 ** 53)));
  for (const s of seeds) {
    const a = new JavaRandom(s), b = new JavaRandom(s);
    assert.equal(a.seed, b.seed);
    for (let n = 0; n < 400; n++) {
      const bits = n % 50 === 49 ? 48 : 1 + (n % 32);
      assert.equal(lcgNumber(a, bits), lcgBig(b, bits), `${s} draw ${n} bits ${bits}`);
      assert.equal(a.hi, b.hi); assert.equal(a.lo, b.lo);
    }
  }
  // The public methods in each mode agree, and verify (both steps compared on every draw) passes.
  const run = (mode) => withMode(mode, () => {
    const g = new JavaRandom(-987654321n), out = [];
    for (let n = 0; n < 3000; n++) out.push(g.nextInt(1 + (n % 977)), g.nextInt(16), g.nextFloat(), g.nextDouble(), g.nextBoolean(), g.nextInt(), n % 7 ? 0 : g.nextGaussian());
    return JSON.stringify([out, g.save()]);
  });
  const off = run('off');
  assert.equal(run('on'), off); assert.equal(run('verify'), off);
  // `seed` stays a BigInt field to readers and writers: a raw assignment draws as the BigInt step would, and save/restore round-trips.
  const q = new JavaRandom(0n); q.seed = -5n; const q2 = new JavaRandom(0n); q2.seed = (1n << 48n) - 5n;
  assert.equal(typeof q.seed, 'bigint'); assert.equal(q.seed, (1n << 48n) - 5n);
  for (let n = 0; n < 50; n++) assert.equal(q.next(31), q2.next(31));
  const saved = q.save(), back = new JavaRandom(7n);
  assert.ok(back.restore(saved)); assert.equal(back.seed, q.seed); assert.equal(back.nextInt(1000), q.nextInt(1000));
});

test('typeSize: one frozen { ...base, width, height } per (type, scale), field for field the spread; verify catches a stale entry', () => {
  resetTypeSizes();
  const spread = (base, s) => ({ ...base, width: base.width * s, height: base.height * s });
  for (const [type, base] of Object.entries(ENTITY_TYPES)) for (const s of [1, 0.5, 2, 4, 0.5 + 1 / 3]) {
    const t = typeSize(base, s);
    assert.ok(Object.isFrozen(t), type);
    assert.equal(typeSize(base, s), t, `${type} ${s} reused`);
    assert.deepEqual({ ...t }, spread(base, s), `${type} ${s}`);
    assert.deepEqual(Object.keys(t), Object.keys(spread(base, s)));
    assert.throws(() => { 'use strict'; t.width = 9; }, TypeError);
  }
  const base = { health: 10, width: 0.9, height: 1.4, ai: {} };
  assert.ok(Object.is(typeSize(base, -0).width, -0)); // -0 is built fresh (a cache keyed by 0 would answer +0)
  assert.notEqual(withMode('off', () => typeSize(base, 1)), withMode('off', () => typeSize(base, 1)));
  withMode('verify', () => typeSize(base, 1));
  base.health = 11; // a changed entry: the cached copy is stale and verify says so
  assert.throws(() => withMode('verify', () => typeSize(base, 1)), /mpperf83 typeSize mismatch/);
  for (let k = 0; k < 600; k++) typeSize(base, 0.5 + k / 1000); // a foal's growth scales: the per-entry cache is bounded and stays correct
  assert.equal(typeSize(base, 0.75).width, base.width * 0.75);
});

test('pushNearBox: pushBox grown by 0.2 sideways, in one reused array; a push inside a push gets its own', () => {
  const r = lcg(832);
  for (let n = 0; n < 5000; n++) {
    const e = { x: (r() - 0.5) * 6e4, y: r() * 256, z: (r() - 0.5) * 6e4 }, w = [0.6, 0.9, 1.4, 0.3, 2.04, 16, 0.25 * (1 + Math.floor(r() * 8))][n % 7], h = 0.3 + r() * 3;
    const box = pushBox(e, w, h), ref = [box[0] - 0.2, box[1], box[2] - 0.2, box[3] + 0.2, box[4], box[5] + 0.2];
    for (const mode of ['on', 'verify', 'off']) withMode(mode, () => { const near = pushNearBox(e, w, h, pushBox); assert.deepEqual([...near], ref); pushNearDone(near); });
  }
  const a = pushNearBox({ x: 1, y: 2, z: 3 }, 0.6, 1.8, pushBox), b = pushNearBox({ x: 9, y: 9, z: 9 }, 0.6, 1.8, pushBox);
  assert.notEqual(a, b); assert.equal(a[0], 1 - Math.fround(0.3) - 0.2); // the outer box is untouched by the inner one
  pushNearDone(b); pushNearDone(a);
  assert.equal(pushNearBox({ x: 0, y: 0, z: 0 }, 1, 1, pushBox), a); pushNearDone(a);
});

test('fineSorted: the same ascending index list as the typed array sort, short (in place) and long', () => {
  const r = lcg(833);
  for (let n = 0; n < 2000; n++) {
    const len = n % 120, pool = Array.from({ length: 400 }, (_, i) => i);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const buf = new Int32Array(256); buf.set(pool.slice(0, len));
    const want = Int32Array.from(pool.slice(0, len)).sort();
    for (const mode of ['on', 'verify']) withMode(mode, () => { const b = buf.slice(), got = fineSorted(b, len); for (let i = 0; i < len; i++) assert.equal(got[i], want[i]); });
  }
});

test('pickupHits: the pickupCandidates entries (dead, delayed and far items, box edges) and the same answer through ItemEntities in every mode', () => {
  const r = lcg(834), items = new ItemEntities(() => 0.5);
  for (let n = 0; n < 400; n++) {
    const e = items.spawn({ id: 1, count: 1, damage: 0 }, 10 + (r() - 0.5) * 6, 64 + (r() - 0.5) * 5, 10 + (r() - 0.5) * 6, { delay: n % 5 === 0 ? 10 : 0 });
    if (n % 11 === 0) e.dead = true;
    if (n % 13 === 0) { e.x = 10 + 1.3 + 0.125; } // on the edge of the grown box
  }
  for (const [feet, w, h] of [[{ x: 10, y: 64, z: 10 }, 0.6, 1.8], [{ x: 10.5, y: 63.2, z: 9.7 }, 0.6, 1.5], [{ x: 30, y: 64, z: 10 }, 0.6, 1.8]]) {
    const ref = withMode('off', () => items.pickupCandidates(feet, w, h));
    assert.ok(sameTargets(withMode('on', () => items.pickupCandidates(feet, w, h)), ref));
    assert.ok(sameTargets(withMode('verify', () => items.pickupCandidates(feet, w, h)), ref));
    assert.ok(sameTargets(pickupHits(items.items, feet, w, h, 0.125, 0.25, (e) => e.dead || e.delay > 0, 0.125), ref));
  }
  assert.ok(withMode('off', () => items.pickupCandidates({ x: 10, y: 64, z: 10 }, 0.6, 1.8)).length > 0);
});

test('mobTargetList: mobTargets builds the flatMap list (holes, many targets per entity, the thrower box last)', () => {
  const mobs = [{ type: 'cow', x: 1, y: 2, z: 3 }, { type: 'zombie', x: -4, y: 70, z: 8, growingAge: -1 }, { type: 'pig', x: 0.5, y: 0, z: 0.25 }];
  const ref = withMode('off', () => mobTargets(mobs, { x: 1, y: 2, z: 3 }));
  for (const mode of ['on', 'verify']) assert.deepEqual(withMode(mode, () => mobTargets(mobs, { x: 1, y: 2, z: 3 })), ref);
  const holey = [1, , 2, 3]; // eslint-disable-line no-sparse-arrays
  const one = (v) => (v === 2 ? [] : v === 3 ? [{ ref: 'a', box: [0] }, { ref: 'b', box: [1] }] : [{ ref: v, box: [v] }]);
  assert.deepEqual(withMode('on', () => mobTargetList(holey, one)), holey.flatMap(one));
  withMode('verify', () => mobTargetList(holey, one));
});

test('vectorOf: a plain {x, y, z} record becomes the spread\'s keys and values with a working copy; anything else keeps the spread', () => {
  const spread = (p) => ({ ...p, copy(v) { Object.assign(this, { x: v.x, y: v.y, z: v.z }); return this; } });
  for (const p of [{ x: 8.5, y: 64, z: -3.25 }, { x: 0, y: -0, z: NaN }]) {
    const v = vectorOf(p, spread), ref = spread(p);
    assert.deepEqual(Object.keys(v), Object.keys(ref));
    for (const k of ['x', 'y', 'z']) assert.ok(Object.is(v[k], ref[k]));
    const w = vectorOf(v, spread); // `previous: vector(position)` copies a vector
    assert.deepEqual(Object.keys(w), ['x', 'y', 'z', 'copy']);
    assert.equal(w.copy({ x: 1, y: 2, z: 3, extra: 4 }), w); assert.deepEqual({ x: w.x, y: w.y, z: w.z, extra: w.extra }, { x: 1, y: 2, z: 3, extra: undefined });
    withMode('verify', () => vectorOf(p, spread));
  }
  let used = 0;
  const counting = (p) => { used++; return spread(p); };
  for (const p of [{ x: 1, y: 2, z: 3, dim: 0 }, { y: 2, x: 1, z: 3 }, Object.defineProperty({ x: 1, y: 2 }, 'z', { get: () => 3, enumerable: true }), new (class { constructor() { this.x = 1; this.y = 2; this.z = 3; } })()]) {
    const v = vectorOf(p, counting);
    assert.deepEqual(Object.keys(v), Object.keys(spread(p)));
  }
  assert.equal(used, 4);
});

// Seeded whole-tick state, as mpperf82-b82.test.js: Math.random replaced, the packets and every mob's state hashed.
const stateOf = (build, mode, ticks) => withMode(mode, () => {
  const realRandom = Math.random, rs = lcg(12345);
  Math.random = () => rs();
  try {
    const s = build(), h = createHash('sha256');
    for (let i = 0; i < ticks; i++) { h.update(JSON.stringify(s.tick())); h.update(JSON.stringify(drain(s))); }
    for (const e of s.mobs.mobs.entities) h.update(`${e.type}|${e.x}|${e.y}|${e.z}|${e.vx}|${e.vy}|${e.vz}|${e.health}|${e.onGround}|${e.collidedH}|${e.fallDistance}|${e.fire}|${e.stepDistance};`);
    for (const p of s.players.values()) h.update(`${p.id}|${p.position.x}|${p.position.y}|${p.position.z}|${p.survival?.health};`);
    return h.digest('hex');
  } finally { Math.random = realRandom; }
});

test('seeded scenes: off, on and verify give the same state, twice in one process (cow pen, mixed terrain pen, players field)', () => {
  const scenes = [() => buildPenScene({ mobs: 80, pen: 9, kind: ['cow'], seed: 4 }), () => buildTerrainPen({ mobs: 70, pen: 10, seed: 3 }), () => buildPlayersScene({ players: 6, mobs: 60, seed: 2 })];
  for (let round = 0; round < 2; round++)
    for (const build of scenes) {
      const off = stateOf(build, 'off', 40);
      assert.equal(stateOf(build, 'on', 40), off);
      assert.equal(stateOf(build, 'verify', 40), off); // verify throws on the first difference
    }
});
