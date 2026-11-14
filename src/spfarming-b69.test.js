// Batch 69 spfarming: single player's farming rides the shared random ticks over the integrated server's active chunks.
// EXECUTED: active-chunks-reference.json sp2 / sp5 / sp16 (real agu in a real HashSet, one walking player, radius = render distance option). BYTECODE-READ: bsx.u sets the view
// distance to the render distance option unclamped; mt.p() = oi.s(); ahb.C uses it as r. BlockCocoa.updateTick (ajz.a) read for cocoaTick. The seeded replay below is the port's own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World } from './world.js';
import { Farming } from './farming.js';
import { Weather } from './weather.js';
import { JavaRandom } from './java-random.js';
import { spActiveChunkSource } from './sp-active-chunks.js';

const ref = JSON.parse(readFileSync(new URL('../public/research/active-chunks-reference.json', import.meta.url), 'utf8'));
const pairs = flat => { const o = []; for (let i = 0; i < flat.length; i += 2) o.push([flat[i], flat[i + 1]]); return o; };

test('the single-player source returns the executed HashSet order for the render distance, walking over chunk borders', () => {
  for (const name of ['sp2', 'sp5', 'sp16']) {
    const c = ref[name], radius = c.radius, world = { size: 4096, streaming: false, originX: -640, originZ: -640 }; // native = local - 640: the executed (negative) chunks sit inside the grid with their real hashes
    const at = { x: 0, z: 0 }, src = spActiveChunkSource(() => at, () => radius);
    for (const t of c.ticks) {
      const [cx, cz] = t.players[0];
      at.x = cx * 16 + 5; at.z = cz * 16 + 9;
      at.x += 640; at.z += 640; // local position
      const got = src(world).map(([x, z]) => [x - 40, z - 40]);
      assert.deepEqual(got, pairs(t.order), `${name} at ${cx},${cz}`);
    }
  }
});

test('the radius is the option: a smaller render distance ticks fewer chunks', () => {
  const world = { size: 4096, streaming: false }, at = { x: 40 * 16, z: 40 * 16 };
  let r = 10;
  const src = spActiveChunkSource(() => at, () => r);
  assert.equal(src(world).length, 21 * 21);
  r = 3; assert.equal(src(world).length, 7 * 7);
  r = 16; assert.equal(src(world).length, 33 * 33);
});

function farmField(ox) {
  const world = new World('spfarming-farm'), farming = new Farming(world);
  farming.sharedRandomTicks = true; farming.lightLevel = () => 15; farming.rained = () => false;
  for (const x of [ox, ox + 40]) {
    world.set(x, 30, 9, 29); world.set(x, 31, 9, 31);
    farming.observe(x, 30, 9);
  }
  return { world, farming };
}

test('seeded replay: crops grow and farmland dries only in the player chunks, through the shared random ticks', () => {
  const { world, farming } = farmField(9); // fields at x = 9 (chunk 0) and x = 49 (chunk 3)
  for (const x of [13, 53]) { world.set(x, 30, 9, 29); farming.observe(x, 30, 9); } // bare farmland: dries to dirt when it has no crop and no water
  const weather = new Weather(); weather.random = new JavaRandom(1234n); weather.lcg = 99991;
  farming.random = farming.stemRandom = weather.random;
  weather.blockTick = (x, y, z, b) => farming.randomTick(x, y, z, b);
  const at = { x: 8, z: 8 };
  weather.activeChunkSource = spActiveChunkSource(() => at, () => 2); // radius 2: chunks 0..2, so x = 49 (chunk 3) is outside
  for (let t = 0; t < 60000; t++) { weather.tickChunks(world, weather.activeChunkSource(world)); farming.tick(t, 1); }
  assert.equal(world.get(13, 30, 9), 2, 'the near bare farmland dried to dirt');
  assert.equal(world.get(53, 30, 9), 29, 'the far bare farmland never ticked');
  assert.equal(world.get(9, 30, 9), 29, 'farmland under a crop stays (dry)');
  assert.ok(world.get(9, 31, 9) > 31 || world.getMeta(9, 31, 9) > 0, 'the near wheat grew');
  assert.equal(world.get(49, 31, 9), 31, 'the far wheat never grew');
});

test('seeded replay: wheat next to water reaches maturity near the player and stays young far away', () => {
  const { world, farming } = farmField(9);
  for (const x of [9, 49]) world.set(x + 2, 30, 9, 10);
  const weather = new Weather(); weather.random = new JavaRandom(77n); weather.lcg = 5;
  farming.random = farming.stemRandom = weather.random;
  weather.blockTick = (x, y, z, b) => farming.randomTick(x, y, z, b);
  const at = { x: 8, z: 8 };
  weather.activeChunkSource = spActiveChunkSource(() => at, () => 2);
  let first = -1;
  for (let t = 0; t < 120000 && first < 0; t++) { weather.tickChunks(world, weather.activeChunkSource(world)); if (world.get(9, 31, 9) === 38) first = t; }
  assert.ok(first > 0, 'the near wheat ripened (block 38 = age 7)');
  assert.equal(world.get(49, 31, 9), 31, 'the far wheat is still age 0');
  assert.equal(world.get(9, 30, 9), 30, 'hydrated farmland stays wet');
});

test('cocoa: ages by one on nextInt(5) == 0 up to 2, and a pod without its jungle log drops and goes (BlockCocoa.updateTick)', () => {
  const world = new World('spfarming-cocoa'), farming = new Farming(world), drops = [];
  farming.drop = (x, y, z, s) => drops.push([x, y, z, s]);
  world.set(10, 40, 10, 4, true, 3); // jungle log
  world.set(10, 40, 11, 73, true, 0); // dir 0 reads z + 1 ... the log is at z - 1 for dir 2
  world.set(10, 41, 10, 4, true, 3);
  world.set(10, 41, 9, 73, true, 0); // pod at z = 9 with dir 0 -> support at z = 10
  assert.equal(farming.randomTick(10, 41, 9, 73, { nextInt: n => { assert.equal(n, 5); return 1; } }), true);
  assert.equal(world.getMeta(10, 41, 9), 0, 'nextInt 1: unchanged');
  farming.randomTick(10, 41, 9, 73, { nextInt: () => 0 });
  assert.equal(world.getMeta(10, 41, 9), 4);
  farming.randomTick(10, 41, 9, 73, { nextInt: () => 0 });
  assert.equal(world.getMeta(10, 41, 9), 8);
  farming.randomTick(10, 41, 9, 73, { nextInt: () => 0 });
  assert.equal(world.getMeta(10, 41, 9), 8, 'age 2 stays');
  world.set(10, 41, 10, 0);
  farming.randomTick(10, 41, 9, 73, { nextInt: () => 0 });
  assert.equal(world.get(10, 41, 9), 0, 'unsupported: removed');
  assert.deepEqual(drops[0].slice(0, 3), [10, 41, 9]);
  assert.deepEqual(drops[0][3], [{ id: 351, count: 3, damage: 3 }], 'a ripe pod drops three beans');
});
