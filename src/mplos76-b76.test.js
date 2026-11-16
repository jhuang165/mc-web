// Batch 76 mplos76: the line-of-sight walk (rayTraceBlocks) is bit-identical to the pre-b76 walk (rayTraceBlocksReference), and EntitySenses caches per tick.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { rayTraceBlocks, rayTraceBlocksReference, rayTraceConfig } from './projectiles.js';
import { buildScene, randomRays } from './mplos76-scene.js';

const same = (g, w) => { assert.equal(JSON.stringify(g), JSON.stringify(w)); if (g) for (let i = 0; i < 3; i++) assert.ok(Object.is(g.vec[i], w.vec[i])); };

for (const [kind, level] of [['flat', false], ['flat', true], ['mixed', false]]) {
  test(`fast walk equals the reference on ${kind}${level ? ' (level rays)' : ''} scene`, () => {
    const world = buildScene(World, kind), rays = randomRays(6000, 17, kind === 'mixed' ? 30 : 60, 2, 66, level);
    rayTraceConfig.mode = 'on';
    let hits = 0;
    for (const [a, b, h] of rays) { const g = rayTraceBlocks(world, a, b, h); same(g, rayTraceBlocksReference(world, a, b, h)); if (g) hits++; }
    assert.ok(hits > 100 && hits < rays.length, `a mix of hits and misses (${hits})`);
  });
}

test('edge rays: NaN, out of the world, below y 0, 200-step limit, start inside a block, mutated input untouched', () => {
  const world = buildScene(World, 'mixed');
  const cases = [[[NaN, 12, 12], [20, 12, 20]], [[12, 12, 12], [20, NaN, 20]], [[-5, 12, 5], [300, 12, 5]], [[10, -4, 10], [30, 30, 30]], [[10.5, 40, 10.5], [10.5, -40, 10.5]],
    [[5, 11.5, 5], [5 + 400, 11.5, 5]], [[5, 11.5, 5], [5, 11.5, 5]], [[12.5, 12.5, 12.5], [12.5, 12.5, 12.5001]], [[1e9, 12, 1e9], [-1e9, 12, -1e9]]];
  for (const [a, b] of cases) for (const hasBox of [false, true]) {
    const a0 = [...a], b0 = [...b];
    same(rayTraceBlocks(world, a, b, hasBox), rayTraceBlocksReference(world, a, b, hasBox));
    assert.deepEqual(a, a0); assert.deepEqual(b, b0);
  }
});

test('a world with its own get (floorBelow double, dimension override) takes the plain path and agrees', () => {
  const cells = new Map([['3,5,3', 1], ['4,-2,4', 1]]);
  const w = { floorBelow: true, get: (x, y, z) => cells.get(`${x},${y},${z}`) ?? (y < 0 ? 1 : 0), solid: () => true, getMeta: () => 0 };
  for (const [a, b] of [[[0.5, 5.5, 3.5], [8.5, 5.5, 3.5]], [[4.5, 3, 4.5], [4.5, -9, 4.5]], [[0, 9, 0], [9, -1, 9]]]) same(rayTraceBlocks(w, a, b), rayTraceBlocksReference(w, a, b));
});

test('verify mode checks every call and "off" uses the reference', () => {
  const world = buildScene(World, 'mixed'), rays = randomRays(500, 3, 30, 5, 60);
  for (const mode of ['verify', 'off', 'on']) { rayTraceConfig.mode = mode; for (const [a, b, h] of rays) same(rayTraceBlocks(world, a, b, h), rayTraceBlocksReference(world, a, b, h)); }
  rayTraceConfig.mode = 'on';
});

test('EntitySenses.canSee caches per target and the cache is cleared at the next AI tick (source read, as native EntitySenses)', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('./ai.js', import.meta.url), 'utf8');
  assert.match(src, /if \(this\.senseCache\.has\(t\)\) return this\.senseCache\.get\(t\)/);
  assert.match(src, /this\.despawnEntity\(\);\n\s+this\.senseCache\.clear\(\);/);
});
