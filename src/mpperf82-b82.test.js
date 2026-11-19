// Batch 82 mpperf82: the server allocation cuts (chunk key cache, reused AI size answer, moveMotion buffers, no-step answer, piston tiles walked in place,
// nearestView's pruned scan, isPlant without an array) give the reference results; MC_MPPERF82=verify throws on a difference.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fast82, chunkKeyOf, resetChunkKeys, mobSizeObject, motionEnter, motionRelease, motionOf, noSteps, NO_STEPS } from './mpperf82-fast.js';
import { nearestView, nearestReference } from './mpperf79-fast.js';
import { NETHER_WART } from './nether-wart.js';
import { isPlant, isCrop, isFlower, SAPLING, DOUBLE_PLANT, BROWN_MUSHROOM, RED_MUSHROOM, DEAD_BUSH, DEAD_SHRUB, FERN, REDSTONE_BLOCK } from './world.js';
import { PUMPKIN_STEM, MELON_STEM } from './stems-cake.js';
import { mobStepEvents } from './mob-steps.js';
import { RedstoneWorld, pistonTile } from './redstone.js';
import { installPistons } from './piston-live.js';
import { PISTON, STICKY_PISTON } from './dispenser-piston.js';
import { buildTerrainPen } from './mpperf81-scene.js';
import { buildPenScene } from './mpperf78-scene.js';
import { buildPlayersScene, drain, lcg } from './mpperf77-scene.js';

const withMode = (mode, fn) => { const was = fast82.mode; fast82.mode = mode; try { return fn(); } finally { fast82.mode = was; } };

test('chunkKeyOf: the world.js key string for any input, including slot collisions, fractions, NaN and values outside int32', () => {
  const key = (cx, cz) => `${cx},${cz}`, r = lcg(821);
  resetChunkKeys();
  const inputs = [];
  for (let n = 0; n < 20000; n++) inputs.push([Math.floor((r() - 0.5) * 4000), Math.floor((r() - 0.5) * 4000)]);
  inputs.push([0, 0], [-0, 0], [0, -0], [1.5, 2], [1, 2.5], [NaN, 0], [2 ** 31, 1], [2 ** 32 + 5, 5], [-(2 ** 31), 7], [1875000, -1875000], [5, 2 ** 32 + 5]);
  inputs.push([1, 2], [0, 7], [5, 5], [1.5, 2], [1, 2]); // the integer pair after its fraction (a stored truncated pair would answer "1.5,2")
  for (const mode of ['on', 'verify', 'on'])
    withMode(mode, () => { for (const [x, z] of inputs) assert.equal(chunkKeyOf(x, z, key), key(x, z), `${x} ${z}`); });
  withMode('off', () => assert.equal(chunkKeyOf(3, -4, key), '3,-4'));
});

test('mobSizeObject: on reuses one object, off and verify answer fresh ones; verify poisons the previous answer', () => {
  const a = withMode('on', () => mobSizeObject(0.9, 1.4)), b = withMode('on', () => mobSizeObject(0.6, 1.8));
  assert.equal(a, b); assert.deepEqual({ ...b }, { width: 0.6, height: 1.8 });
  const c = withMode('off', () => mobSizeObject(1, 2)), d = withMode('off', () => mobSizeObject(1, 2));
  assert.notEqual(c, d); assert.deepEqual({ ...c }, { width: 1, height: 2 });
  const e = withMode('verify', () => mobSizeObject(0.3, 0.7)), g = withMode('verify', () => mobSizeObject(1.4, 2.9));
  assert.ok(Number.isNaN(e.width) && Number.isNaN(e.height)); assert.deepEqual({ ...g }, { width: 1.4, height: 2.9 });
});

test('moveMotion buffers: one per nesting depth, a fresh array without one or when off', () => {
  withMode('on', () => {
    const a = motionEnter(), b = motionEnter();
    assert.notEqual(a, b);
    assert.deepEqual(motionOf(b, 1, 2, 3), [1, 2, 3]); assert.equal(motionOf(b, 4, 5, 6), b);
    motionRelease(b);
    assert.equal(motionEnter(), b); motionRelease(b); motionRelease(a);
    assert.equal(motionEnter(), a); motionRelease(a);
    const x = motionOf(null, 1, 2, 3); assert.deepEqual(x, [1, 2, 3]); assert.notEqual(motionOf(null, 1, 2, 3), x);
  });
  withMode('off', () => { assert.equal(motionEnter(), null); motionRelease(null); });
});

test('mobStepEvents: the frozen empty answer when on, a fresh [] when off; events unchanged', () => {
  const world = { get: (x, y, z) => (y === 9 ? 1 : 0), getMeta: () => 0 };
  const run = () => {
    const out = [];
    const e = { type: 'cow', x: 0.5, y: 10, z: 0.5, stepDistance: 0 };
    for (let i = 0; i < 30; i++) { const from = { x: e.x, y: e.y, z: e.z }; e.x += 0.3; out.push(mobStepEvents(world, e, from, { random: () => 0.5 })); }
    out.push(mobStepEvents(world, { type: 'silverfish', x: 0, y: 10, z: 0 }, { x: 0, y: 10, z: 0 }));
    return out;
  };
  const on = withMode('on', run), off = withMode('off', run);
  assert.deepEqual(on, off);
  assert.ok(on.some((x) => x === NO_STEPS) && on.some((x) => x.length));
  assert.ok(off.every((x) => x !== NO_STEPS && !Object.isFrozen(x)));
  assert.ok(Object.isFrozen(withMode('on', noSteps)));
});

test('nearestView: the pruned scan picks the same view as the plain loop (ties, NaN, Infinity, far and near players)', () => {
  const r = lcg(822);
  for (let n = 0; n < 400; n++) {
    const views = new Map(), count = 1 + Math.floor(r() * 20);
    for (let i = 0; i < count; i++) {
      const q = r(), coord = () => (q < 0.05 ? NaN : q < 0.08 ? Infinity : q < 0.2 ? Math.floor(r() * 4) : (r() - 0.5) * 200);
      views.set('v' + i, { player: { position: { x: coord(), y: coord(), z: coord() } } });
    }
    for (let k = 0; k < 20; k++) {
      const e = { x: k % 7 === 0 ? 1 : (r() - 0.5) * 200, y: k % 5 === 0 ? 2 : (r() - 0.5) * 50, z: (r() - 0.5) * 200 };
      const ref = nearestReference(views, e);
      for (const mode of ['on', 'verify', 'off']) assert.equal(withMode(mode, () => nearestView(views, e)), ref);
    }
  }
});

test('isPlant without the array literal: the same answer for every id', () => {
  const old = (b) => isCrop(b) || b === NETHER_WART || b === PUMPKIN_STEM || b === MELON_STEM || b === 39 || isFlower(b) || b === SAPLING || [DOUBLE_PLANT, BROWN_MUSHROOM, RED_MUSHROOM, DEAD_BUSH, DEAD_SHRUB, FERN].includes(b);
  for (let b = -2; b < 4200; b++) assert.equal(isPlant(b), old(b), `id ${b}`);
  for (const b of [NaN, 0.5, -0, undefined, null, '69']) assert.equal(isPlant(b), old(b));
});

test('piston collisionBoxes: walking loadedTiles in place gives the pistonTiles() answer (other kinds between, invalid tiles, a custom pistonTiles)', () => {
  const r = lcg(823), w = new RedstoneWorld({ seed: 1 }), p = installPistons({ redstone: w });
  for (let i = 0; i < 60; i++) {
    if (i % 4 === 1) { w.loadedTiles.push({ kind: 'chest', x: i, y: 5, z: 0 }); continue; }
    const t = pistonTile([1, 4, 44, 85, 107, 139, 33][i % 7], i % 3 ? 0 : 8, i % 6, i % 2 === 0, i % 5 === 0);
    Object.assign(t, { x: Math.floor(r() * 12), y: Math.floor(r() * 6), z: Math.floor(r() * 12), progress: r(), lastProgress: r(), world: true, invalid: i % 11 === 0 });
    w.loadedTiles.push(t);
  }
  let met = 0;
  for (let n = 0; n < 2000; n++) {
    const x = r() * 12, y = r() * 6, z = r() * 12, b = [x, y, z, x + r() * 3, y + r() * 3, z + r() * 3];
    const ref = withMode('off', () => p.collisionBoxes(b));
    met += ref.length;
    assert.deepEqual(withMode('on', () => p.collisionBoxes(b)), ref);
    assert.deepEqual(withMode('verify', () => p.collisionBoxes(b)), ref);
  }
  assert.ok(met > 100, `${met}`);
  const own = Object.assign(Object.create(w), { pistonTiles: () => w.loadedTiles.filter((t) => t.kind === 'piston' && t.y > 2) }), q = installPistons({ redstone: own });
  const b = [0, 0, 0, 12, 8, 12];
  assert.deepEqual(withMode('on', () => q.collisionBoxes(b)), withMode('off', () => q.collisionBoxes(b)));
  assert.ok(withMode('on', () => q.collisionBoxes(b)).length < withMode('on', () => p.collisionBoxes(b)).length); // the custom list is used, not loadedTiles
});

// A pen of mobs over a row of upward pistons that a redstone block switches every few ticks: the mobs stand on, and are lifted by, moving tiles.
function pistonPen(seed) {
  const s = buildPenScene({ mobs: 40, pen: 8, kind: ['cow', 'zombie', 'pig', 'spider', 'sheep'], seed });
  const c = s.players.values().next().value.position, x0 = Math.floor(c.x) + 4, z0 = Math.floor(c.z) + 4;
  const cells = [];
  for (let k = 0; k < 6; k++) { const x = x0 + k, z = z0 + (k % 2) * 2; s.world.put(x, 9, z, k % 2 ? STICKY_PISTON : PISTON, 1, false); cells.push([x, 8, z]); }
  const tick = s.tick.bind(s);
  let n = 0;
  s.tick = () => {
    if (n % 6 === 0) for (const [x, y, z] of cells) { s.world.put(x, y, z, REDSTONE_BLOCK, 0, false); s.redstone.placed?.(x, y, z); s.redstone.notifyBlocksOfNeighborChange?.(x, y, z, 0); }
    if (n % 6 === 3) for (const [x, y, z] of cells) { s.world.put(x, y, z, 0, 0, false); s.redstone.notifyBlocksOfNeighborChange?.(x, y, z, REDSTONE_BLOCK); }
    n++;
    return tick();
  };
  return s;
}

// Seeded whole-tick state, as mpperf81-b81.test.js: Math.random replaced, the packets and every mob's state hashed.
const stateOf = (build, mode, ticks) => withMode(mode, () => {
  const realRandom = Math.random, rs = lcg(12345);
  Math.random = () => rs();
  try {
    const s = build(), h = createHash('sha256');
    for (let i = 0; i < ticks; i++) { h.update(JSON.stringify(s.tick())); h.update(JSON.stringify(drain(s))); }
    for (const e of s.mobs.mobs.entities) h.update(`${e.type}|${e.x}|${e.y}|${e.z}|${e.vx}|${e.vy}|${e.vz}|${e.health}|${e.onGround}|${e.collidedH}|${e.fallDistance}|${e.fire}|${e.stepDistance};`);
    return h.digest('hex');
  } finally { Math.random = realRandom; }
});

test('seeded scenes: off, on and verify give the same state, twice in one process (mixed terrain pen, players field, piston pen)', () => {
  const scenes = [() => buildTerrainPen({ mobs: 70, pen: 10, seed: 3 }), () => buildPlayersScene({ players: 6, mobs: 60, seed: 2 }), () => pistonPen(4)];
  for (let round = 0; round < 2; round++)
    for (const build of scenes) {
      const off = stateOf(build, 'off', 40);
      assert.equal(stateOf(build, 'on', 40), off);
      assert.equal(stateOf(build, 'verify', 40), off); // verify throws on the first difference
      assert.equal(stateOf(build, 'on', 40), off);
    }
});
