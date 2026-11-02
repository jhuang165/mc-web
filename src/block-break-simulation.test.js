import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, ICE, WATER, WOOL, RED_FLOWER, SNOW_LAYER } from './world.js';
import { Farming } from './farming.js';
import { Trees } from './trees.js';
import { Survival } from './survival.js';
import { ItemEntities } from './item-entities.js';
import { ExperienceOrbs } from './experience.js';
import { JavaRandom } from './java-random.js';
import { makeStack } from './inventory.js';
import { CHEST } from './chest.js';
import { breakPlayerBlock } from './block-break-simulation.js';

const POS = [44, 12, 47], key = POS.join(',');
function fixture(block, { meta = 0, slots = [], mode = 'survival', itemRandom = () => 0.5, treeRandom = new JavaRandom(9) } = {}) {
  const world = new World('block-break-simulation');
  world.set(...POS, block || 0, false, meta);
  const survival = new Survival({ slots }, mode), items = new ItemEntities(itemRandom), xpOrbs = new ExperienceOrbs([], () => 0.5),
    farming = new Farming(world), trees = new Trees(world, { random: treeRandom });
  return { world, survival, items, xpOrbs, farming, trees, heldTool: survival.inventory.held?.id ?? 0 };
}
function run(state, coords = POS, options = {}) {
  const order = [];
  const result = breakPlayerBlock(state, coords, {
    updateBlock: (...a) => order.push(['updateBlock', ...a]),
    renderHotbar: () => order.push(['hotbar']),
    playBlockSound: (...a) => order.push(['sound', ...a]),
    destroyParticles: (...a) => order.push(['destroy', ...a.slice(1)]),
    markUnsaved: () => order.push(['dirty']),
    ...options,
  });
  return { result, order };
}

test('air and Survival bedrock are guarded without RNG, world edits, or effects', () => {
  for (const block of [0, 11]) {
    const state = fixture(block), order = [];
    let randomCalls = 0;
    const result = breakPlayerBlock(state, POS, {
      random: () => { randomCalls++; return 0; }, leafRandom: { nextInt: () => { randomCalls++; return 0; } },
      updateBlock: () => order.push('update'), renderHotbar: () => order.push('hotbar'),
      playBlockSound: () => order.push('sound'), destroyParticles: () => order.push('particles'), markUnsaved: () => order.push('dirty'),
    });
    assert.equal(result, false);
    assert.deepEqual(order, []);
    assert.equal(randomCalls, 0);
    assert.equal(state.world.get(...POS), block);
    assert.equal(state.items.items.length, 0);
  }
});

test('Survival grass break orders drop, XP, exhaustion, wear, and browser observers', () => {
  const state = fixture(1), beforeExhaustion = state.survival.exhaustion, order = [];
  const result = breakPlayerBlock(state, POS, {
    updateBlock: (x, z, y) => order.push(['update', x, z, y]),
    renderHotbar: () => order.push(['hotbar']),
    playBlockSound: (place, block) => order.push(['sound', place, block]),
    destroyParticles: (_world, x, y, z, block, meta) => order.push(['particles', x, y, z, block, meta]),
    markUnsaved: () => order.push(['dirty']),
  });
  assert.equal(result, true);
  assert.equal(state.world.get(...POS), 0);
  assert.deepEqual(state.items.items.map((e) => e.stack), [makeStack(2)]);
  assert.ok(Math.abs(state.survival.exhaustion - (beforeExhaustion + 0.025)) < 1e-7);
  assert.equal(state.survival.held, null);
  assert.deepEqual(order, [
    ['update', POS[0], POS[2], POS[1]], ['hotbar'], ['sound', false, 1],
    ['particles', ...POS, 1, 0], ['dirty'],
  ]);
});

test('metadata-bearing block drops retain metadata; snow layers use metadata count', () => {
  const wool = fixture(WOOL, { meta: 11 }), result = run(wool);
  assert.equal(result.result, true);
  assert.equal(wool.items.items[0].stack.id, WOOL);
  assert.equal(wool.items.items[0].stack.damage, 11);

  const flower = fixture(RED_FLOWER, { meta: 5 });
  assert.equal(breakPlayerBlock(flower, POS), true);
  assert.equal(flower.items.items[0].stack.damage, 5);

  const snow = fixture(SNOW_LAYER, { meta: 5, slots: [{ id: 108, count: 1 }] }), snowResult = run(snow);
  assert.equal(snowResult.result, true);
  assert.deepEqual(snow.items.items.map((e) => e.stack.id), Array(6).fill(312));
});

test('gravel flint roll precedes normal drop routing and uses injected Math.random stream', () => {
  const state = fixture(25), calls = [];
  const result = breakPlayerBlock(state, POS, { random: () => { calls.push('roll'); return 0.05; } });
  assert.equal(result, true);
  assert.deepEqual(calls, ['roll']);
  assert.deepEqual(state.items.items.map((e) => e.stack.id), [313]);
});

test('ripe crop drops use injected random in the existing seed-roll order', () => {
  const state = fixture(38), values = [0.1, 0.9, 0.4], calls = [];
  const result = breakPlayerBlock(state, POS, { random: () => { calls.push('crop'); return values.shift(); } });
  assert.equal(result, true);
  assert.deepEqual(calls, ['crop', 'crop', 'crop']);
  assert.deepEqual(state.items.items.map((e) => e.stack), [makeStack(305), makeStack(309), makeStack(309)]);
});

test('leaf chance uses Trees.random, while shears route the original metadata path', () => {
  const values = [], leafRandom = {
    nextInt(n) { values.push(`int:${n}`); return 0; },
    nextFloat() { values.push('float'); return 0.5; },
  };
  const leaves = fixture(5, { meta: 2, treeRandom: leafRandom });
  assert.equal(breakPlayerBlock(leaves, POS, { random: () => { throw new Error('leaf branch must not use Math.random'); } }), true);
  assert.deepEqual(values, ['int:20', 'float', 'float', 'float']);
  assert.deepEqual(leaves.items.items.map((e) => e.stack), [makeStack(48, 1, 2)]);

  const sheared = fixture(5, { meta: 2, slots: [{ id: 125, count: 1 }] });
  sheared.heldTool = 125;
  assert.equal(breakPlayerBlock(sheared, POS), true);
  assert.deepEqual(sheared.items.items.map((e) => e.stack), [makeStack(5,1,2)]);
});

test('Survival ice leaves water over a solid floor and observes the final cell', () => {
  const state = fixture(ICE);
  state.world.set(POS[0], POS[1] - 1, POS[2], 3, false);
  const seen = [];
  const result = breakPlayerBlock(state, POS, {
    updateBlock: (x, z, y) => seen.push(['update', state.world.get(x, y, z)]),
    destroyParticles: (_world, x, y, z) => seen.push(['particles', state.world.get(x, y, z)]),
  });
  assert.equal(result, true);
  assert.equal(state.world.get(...POS), WATER);
  assert.deepEqual(seen, [['update', WATER], ['particles', WATER]]);
});

test('furnace and chest contents spill and records are deleted in both modes', () => {
  for (const mode of ['survival', 'creative']) {
    const block = mode === 'survival' ? 14 : CHEST, state = fixture(block, { mode });
    const contents = [{ id: 302, count: 2, damage: 0 }];
    if (block === 14) state.survival.furnaces[key] = { items: contents };
    else state.survival.chests[key] = { items: contents };
    const result = breakPlayerBlock(state, POS, { creative: mode === 'creative' });
    assert.equal(result, true);
    assert.equal(state.items.items.length, 1);
    assert.deepEqual(state.items.items[0].stack, makeStack(302, 2));
    assert.equal(block === 14 ? state.survival.furnaces[key] : state.survival.chests[key], undefined);
  }
});

test('Creative can break bedrock but skips normal drop, XP, exhaustion, and wear', () => {
  const state = fixture(11, { mode: 'creative', slots: [{ id: 108, count: 1, damage: 0 }] });
  const before = state.survival.exhaustion, order = [];
  const result = breakPlayerBlock(state, POS, {
    creative: true,
    updateBlock: () => order.push('update'), renderHotbar: () => order.push('hotbar'),
    playBlockSound: () => order.push('sound'), destroyParticles: () => order.push('particles'), markUnsaved: () => order.push('dirty'),
  });
  assert.equal(result, true);
  assert.equal(state.world.get(...POS), 0);
  assert.equal(state.items.items.length, 0);
  assert.equal(state.xpOrbs.orbs.length, 0);
  assert.equal(state.survival.exhaustion, before);
  assert.equal(state.survival.held.damage, 0);
  assert.deepEqual(order, ['update', 'hotbar', 'sound', 'particles', 'dirty']);
});

test('failed world removal consumes earlier gravel randomness but runs no post-edit hooks', () => {
  const state = fixture(25), order = [];
  const set = state.world.set.bind(state.world);
  state.world.set = (...args) => args[3] === 0 ? false : set(...args);
  let draws = 0;
  const result = breakPlayerBlock(state, POS, {
    random: () => { draws++; return 0.5; },
    updateBlock: () => order.push('update'), renderHotbar: () => order.push('hotbar'),
    playBlockSound: () => order.push('sound'), destroyParticles: () => order.push('particles'), markUnsaved: () => order.push('dirty'),
  });
  assert.equal(result, false);
  assert.equal(draws, 1);
  assert.deepEqual(order, []);
  assert.equal(state.world.get(...POS), 25);
});
