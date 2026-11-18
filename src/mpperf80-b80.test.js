// Batch 80 mpperf80: the path search and move speed-ups equal the reference paths (MC_MPPERF80=verify throws on a difference).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fast80, pathCell, edgeClamp, edgeClampReference, originalIdOf } from './mpperf80-fast.js';
import { PathFinder, PathPoint, getVerticalOffset } from './pathfinding.js';
import { World, WOODEN_DOOR, IRON_DOOR, WEB, LADDER, REEDS, FENCE, TORCH, SIZE } from './world.js';
import { FENCE_GATE, TRAPDOOR, COBBLE_WALL } from './shaped-blocks.js';
import { NETHER_FENCE } from './nether-blocks.js';
import { toOriginal } from './block-registry.js';
import { isFenceLike, stepBlock } from './step-block.js';
import { buildPlayersScene, drain, lcg } from './mpperf77-scene.js';

const withMode = (mode, fn) => { const was = fast80.mode; fast80.mode = mode; try { return fn(); } finally { fast80.mode = was; } };
// Every id the path classifier treats differently, metadata-dependent ones included, plus a spread of others.
const PALETTE = [0, 0, 0, 0, 1, 3, 4, 10, 10, 42, TORCH, WEB, LADDER, REEDS, 39, FENCE, NETHER_FENCE, COBBLE_WALL, FENCE_GATE, TRAPDOOR, WOODEN_DOOR, IRON_DOOR, 12, 60, 150, 151];
function randomCells(r, n, span, height) {
  const cells = [];
  for (let i = 0; i < n; i++) cells.push([Math.floor(r() * span), Math.floor(r() * height), Math.floor(r() * span), PALETTE[Math.floor(r() * PALETTE.length)], Math.floor(r() * 16)]);
  return cells;
}
// A plain-object world (no World.get, so the fast path reads through world.get) and a real World with the same cells (direct column reads).
function worlds(r) {
  const cells = randomCells(r, 900, 24, 8), map = new Map();
  const real = new World('mpperf80-test');
  for (let x = 0; x < 24; x++) for (let z = 0; z < 24; z++) { real.put(x, 0, z, 1, 0, false); map.set(`${x},0,${z}`, [1, 0]); }
  for (const [x, y, z, id, meta] of cells) { if (y === 0) continue; real.put(x, y, z, id, meta, false); map.set(`${x},${y},${z}`, [id, meta]); }
  const plain = { get: (x, y, z) => map.get(`${x},${y},${z}`)?.[0] ?? 0, getMeta: (x, y, z) => map.get(`${x},${y},${z}`)?.[1] ?? 0 };
  return [plain, real];
}

test('pathCell: the kind table and the direct column read give the reference answer for every cell, size and flag set', () => {
  const r = lcg(80);
  for (const world of worlds(r)) {
    const finder = new PathFinder(world, true, false, false, false);
    for (let n = 0; n < 4000; n++) {
      const size = new PathPoint(1 + Math.floor(r() * 3), 1 + Math.floor(r() * 3), 1 + Math.floor(r() * 3));
      const entity = { x: r() * 24, y: 1 + r() * 4, z: r() * 24, inLava: r() < 0.3 };
      const x = Math.floor(r() * 26) - 1, y = Math.floor(r() * 9) - 1, z = Math.floor(r() * 26) - 1, aw = r() < 0.5, bd = r() < 0.3, od = r() < 0.7;
      const ref = getVerticalOffset(entity, x, y, z, size, aw, bd, od, world);
      assert.equal(withMode('on', () => pathCell(entity, x, y, z, size, aw, bd, od, world, finder.classify, finder.classify, getVerticalOffset)), ref);
      assert.equal(withMode('verify', () => pathCell(entity, x, y, z, size, aw, bd, od, world, finder.classify, finder.classify, getVerticalOffset)), ref);
    }
  }
});

test('PathFinder: off, on and verify return the same points, point counts and expansions on random block soups', () => {
  const r = lcg(81);
  for (const world of worlds(r)) {
    for (let n = 0; n < 120; n++) {
      const flags = [r() < 0.7, r() < 0.3, r() < 0.5, r() < 0.3], tries = Math.floor(r() * 4);
      const e = { x: 2 + r() * 20, y: 1, z: 2 + r() * 20, width: Math.fround([0.6, 0.9, 1.4, 0.3][n % 4]), height: Math.fround([1.8, 0.9, 2.9, 0.7][n % 4]), inWater: false, inLava: false, maxSafePointTries: () => tries };
      const t = [1 + r() * 22, 1 + Math.floor(r() * 4), 1 + r() * 22, Math.fround(8 + r() * 30)];
      const run = (mode) => withMode(mode, () => {
        const pf = new PathFinder(world, ...flags), p = pf.createEntityPathTo(e, ...t);
        return JSON.stringify([p && p.points.map((q) => [q.x, q.y, q.z, q.cost, q.heuristic, q.total]), pf.pointCount, pf.expanded]);
      });
      const ref = run('off');
      assert.equal(run('on'), ref);
      assert.equal(run('verify'), ref);
    }
  }
});

test('safeTries: asked once per search, and verify notices tries that change during a search', () => {
  const world = { get: (x, y, z) => (y < 0 ? 1 : x > 3 && x < 8 && y < 6 ? 0 : y < 6 ? 1 : 0) }; // a 6-deep pit between x 4 and 7: the fall loop asks for the tries
  let calls = 0, tries = 3;
  const e = { x: 1.5, y: 6, z: 0.5, width: Math.fround(0.6), height: Math.fround(1.8), inWater: false, inLava: false, maxSafePointTries: () => (calls++, tries) };
  const find = () => new PathFinder(world, true, false, false, false).createEntityPathToBlock(e, 10, 6, 0, 16);
  const ref = withMode('off', find), offCalls = calls;
  assert.ok(offCalls > 1);
  calls = 0;
  assert.deepEqual(withMode('on', find).points.map((p) => [p.x, p.y, p.z]), ref.points.map((p) => [p.x, p.y, p.z]));
  assert.equal(calls, 1);
  e.maxSafePointTries = () => (calls++ === 0 ? 3 : 5);
  calls = 0;
  assert.throws(() => withMode('verify', find), /mpperf80 safeTries mismatch/);
});

test('edgeClamp: finite, streamed, NaN-windowed and limitless worlds clamp like the old closures', () => {
  const r = lcg(82);
  const ws = [{ minX: 0, maxX: 128, minZ: 0, maxZ: 128 }, { streaming: true, originX: 29999990, originZ: -29999990 }, { streaming: true }, { minX: NaN, maxX: NaN, minZ: NaN, maxZ: NaN }, {}, { minX: -16, maxX: 48, minZ: 5, maxZ: 6 }];
  for (const w of ws) for (let n = 0; n < 500; n++) {
    const e = { x: (r() - 0.3) * 200, z: (r() - 0.3) * 200, vx: r() - 0.5, vz: r() - 0.5 };
    if (n % 50 === 0) e.x = 0.6; if (n % 51 === 0) e.z = 127.4;
    const a = { ...e }, b = { ...e }, c = { ...e };
    edgeClampReference(w, a, SIZE);
    withMode('on', () => edgeClamp(w, b, SIZE));
    withMode('verify', () => edgeClamp(w, c, SIZE));
    for (const k of ['x', 'z', 'vx', 'vz']) { assert.ok(Object.is(a[k], b[k]), `${k}`); assert.ok(Object.is(a[k], c[k]), `${k}`); }
  }
});

test('originalIdOf: the per-id table equals toOriginal(id, 0)[0] for every id; step blocks unchanged', () => {
  for (let id = -2; id < 4100; id++) {
    const ref = toOriginal(id, 0)?.[0];
    assert.equal(withMode('on', () => originalIdOf(id, toOriginal)), ref);
    assert.equal(withMode('verify', () => originalIdOf(id, toOriginal)), ref);
  }
  assert.equal(withMode('on', () => originalIdOf(1.5, toOriginal)), toOriginal(1.5, 0)?.[0]);
  for (const id of [FENCE, NETHER_FENCE, COBBLE_WALL, FENCE_GATE]) assert.equal(isFenceLike(id), true);
  assert.equal(isFenceLike(LADDER), false);
  const w = { get: (x, y, z) => (y === 4 ? LADDER : y === 3 ? 1 : 0) };
  assert.deepEqual(withMode('on', () => stepBlock(w, 0.5, 5.1, 0.5)), withMode('off', () => stepBlock(w, 0.5, 5.1, 0.5)));
});

test('a pillar scene (players out of reach, every search floods its range) runs the same under off and verify', () => {
  const hash = (mode) => withMode(mode, () => {
    const rs = lcg(4242), was = Math.random; Math.random = () => rs();
    try {
      const s = buildPlayersScene({ players: 2, layout: 'spread', mobs: 0, seed: 3, size: 96 }), host = s.mobs.mobs, rnd = lcg(5), kinds = ['zombie', 'skeleton', 'creeper', 'spider'];
      for (const p of s.players.values()) { const x = Math.floor(p.position.x), z = Math.floor(p.position.z); s.world.put(x, 10, z, 1, 0, false); s.world.put(x, 11, z, 1, 0, false); p.position.y = 12; p.previous.copy(p.position); }
      const list = [...s.players.values()];
      for (let i = 0; i < 24; i++) { const c = list[i % 2].position, m = host.create(kinds[i % 4], c.x + (rnd() - 0.5) * 30, 10, c.z + (rnd() - 0.5) * 30); m.persistent = true; host.entities.push(m); }
      const h = createHash('sha256');
      for (let i = 0; i < 60; i++) { s.tick(); h.update(JSON.stringify(drain(s))); }
      for (const e of host.entities) h.update(`${e.type}|${e.x}|${e.y}|${e.z}|${e.vx}|${e.vz}|${e.rotationYaw}|${e.health};`);
      return h.digest('hex');
    } finally { Math.random = was; }
  });
  const off = hash('off');
  assert.equal(hash('verify'), off);
  assert.equal(hash('on'), off);
});
