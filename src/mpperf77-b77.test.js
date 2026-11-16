// Batch 77 mpperf77: the exact speed-ups in mpperf77-fast.js agree with the old code (fuzz, then whole server scenes).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fastConfig, pushMeets, pushMeetsReference, stateDiffs, stateDiffsReference, nearbyLate } from './mpperf77-fast.js';
import { EntityWorld, pushBox, ENTITY_TYPES } from './entities.js';
import { buildPlayersScene, drain, lcg } from './mpperf77-scene.js';

const withMode = (mode, fn) => { const was = fastConfig.mode; fastConfig.mode = mode; try { return fn(); } finally { fastConfig.mode = was; } };

test('pushMeets equals the old box test for plain mobs, babies, slimes and vehicles', () => {
  const world = { size: EntityWorld.prototype.size, sizeInto: EntityWorld.prototype.sizeInto }, r = lcg(9), types = Object.keys(ENTITY_TYPES).filter(t => t !== 'ender_dragon');
  let hits = 0;
  for (let i = 0; i < 20000; i++) {
    const o = { type: types[Math.floor(r() * types.length)], x: 10 + r() * 6, y: 10 + r() * 2, z: 10 + r() * 6, health: 5, growingAge: r() < 0.2 ? -100 : 0 };
    if (o.type === 'slime' || o.type === 'magma_cube') o.size = [1, 2, 4][Math.floor(r() * 3)];
    if (r() < 0.05) { o.boat = true; }
    if (r() < 0.05) { o.slots = []; delete o.boat; }
    const e = { x: 10 + r() * 6, y: 10 + r() * 2, z: 10 + r() * 6 }, box = pushBox(e, 0.6 + r() * 0.5, 1.8), near = [box[0] - 0.2, box[1], box[2] - 0.2, box[3] + 0.2, box[4], box[5] + 0.2];
    const want = pushMeetsReference(near, o, world, pushBox);
    hits += want ? 1 : 0;
    assert.equal(withMode('on', () => pushMeets(near, o, world, pushBox)), want);
    assert.equal(withMode('verify', () => pushMeets(near, o, world, pushBox)), want);
  }
  assert.ok(hits > 200 && hits < 19000, `mixed outcomes (${hits})`);
});

test('stateDiffs equals the per-view scan, in entry order, and a shared watcher feeds both views', () => {
  const r = lcg(3), watchers = Array.from({ length: 12 }, (_, i) => ({ id: i })), views = watchers.map(w => ({ watcher: w, known: new Map() }));
  const entries = new Map(), ents = Array.from({ length: 60 }, (_, i) => ({ i }));
  for (const e of ents) entries.set(e, { entry: { set: new Set(watchers.filter(() => r() < 0.3)) } });
  const state = new Map(ents.map(e => [e, 's' + Math.floor(r() * 3)])), stateOf = e => state.get(e);
  for (const v of views) for (const e of ents) if (r() < 0.5) v.known.set(e, 's' + Math.floor(r() * 3));
  const ref = stateDiffsReference(views, entries, stateOf);
  for (const mode of ['on', 'verify']) {
    const got = withMode(mode, () => stateDiffs(views[Symbol.iterator](), entries, stateOf));
    assert.equal(got.size, ref.size);
    for (const [v, l] of ref) assert.deepEqual(got.get(v), l);
  }
  assert.ok(ref.size > 3);
  // two views sharing one watcher both get the diff
  views.push({ watcher: watchers[0], known: new Map() });
  assert.equal(withMode('verify', () => stateDiffs(views, entries, stateOf)).has(views[12]) || !watchers.length, true);
});

test('nearbyLate: same list as test-first, and the pure late test runs for boxed mobs only', () => {
  const list = Array.from({ length: 30 }, (_, i) => ({ i, near: i % 3 === 0, kind: i % 2 }));
  let lateCalls = 0;
  const args = [list, e => e.i === 5, e => e, b => b.kind === 1, b => { lateCalls++; return b.i % 5 !== 0; }, b => b.near];
  const ref = withMode('off', () => nearbyLate(...args)), refCalls = lateCalls;
  lateCalls = 0;
  const fast = withMode('on', () => nearbyLate(...args));
  assert.deepEqual(fast, ref);
  assert.ok(lateCalls < refCalls, `${lateCalls} < ${refCalls}`);
  assert.deepEqual(withMode('verify', () => nearbyLate(...args)), ref);
  assert.throws(() => withMode('verify', () => nearbyLate(list, () => false, e => e, () => true, b => b.i === 1, b => b.i !== 1 || (b.near = !b.near, b.near))), /mismatch/);
});

function runScene(mode, opts, ticks) {
  const real = Math.random, rs = lcg(777); Math.random = () => rs();
  try {
    return withMode(mode, () => {
      const s = buildPlayersScene(opts), h = createHash('sha256'), host = opts.dim === 1 ? s.dimensions.end.n.mobs : opts.dim ? s.dimensions.nether.mobs : s.mobs;
      for (let i = 0; i < ticks; i++) {
        const t = s.tick(); h.update(JSON.stringify(t)); h.update(JSON.stringify(drain(s)));
        for (const e of host.mobs.entities) h.update(`${e.type}|${e.x}|${e.y}|${e.z}|${e.health};`);
      }
      return h.digest('hex');
    });
  } finally { Math.random = real; }
}

test('a 6-player Overworld scene (villagers and zombies, 120 mobs) gives the same state in on, off and verify', () => {
  const o = { players: 6, layout: 'cluster', mobs: 120, seed: 5 }, off = runScene('off', o, 40);
  assert.equal(runScene('on', o, 40), off);
  assert.equal(runScene('verify', o, 40), off);
});

test('a Nether scene and an End scene give the same state in on, off and verify', { timeout: 120000 }, () => {
  for (const o of [{ players: 3, mobs: 60, dim: -1, seed: 2 }, { players: 3, mobs: 15, dim: 1, seed: 2 }]) {
    const off = runScene('off', o, 25);
    assert.equal(runScene('on', o, 25), off);
    assert.equal(runScene('verify', o, 25), off);
  }
});

test('the villager zombie-avoid test goes through nearbyLate', async () => {
  const { readFileSync } = await import('node:fs');
  assert.match(readFileSync(new URL('./villager.js', import.meta.url), 'utf8'), /m\.nearbyLate\(d, 3, d, \(b\) => b\.e\.type === "zombie" && b\.alive, \(b\) => m\.canSee\(b\)\)/);
});
