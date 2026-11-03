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

// ---- live Silk Touch / Fortune (1.7.10 Block.harvestBlock) ----------------
const { fromOriginal } = await import('./block-registry.js');
const { itemFromOriginal } = await import('./region-import.js');
const enchantedPick = (id, lvl, tool = 257) => [{ ...makeStack(itemFromOriginal(tool, 0).id), enchantments: [{ id, lvl }] }];
const dropped = (state) => state.items.items.map((e) => [e.stack.id, e.stack.count, e.stack.damage || 0]);

test('Silk Touch keeps the block itself, draws no quantity or XP, and keeps ice from leaving water', () => {
  const stone = fromOriginal(1, 0).id, cobble = fromOriginal(4, 0).id;
  const plain = fixture(stone, { slots: enchantedPick(33, 1) });
  const r = run(plain, POS, { dropRandom: new JavaRandom(5) });
  assert.equal(r.result, true);
  assert.deepEqual(dropped(plain), [[stone, 1, 0]]);
  const normal = fixture(stone, { slots: [makeStack(itemFromOriginal(257, 0).id)] });
  run(normal);
  assert.deepEqual(dropped(normal), [[cobble, 1, 0]]);
  const ore = fromOriginal(56, 0).id, silkOre = fixture(ore, { slots: enchantedPick(33, 1) });
  run(silkOre, POS, { dropRandom: new JavaRandom(5) });
  assert.deepEqual(dropped(silkOre), [[ore, 1, 0]]);
  assert.equal(silkOre.xpOrbs.orbs.length, 0);
  const ice = fixture(ICE, { slots: enchantedPick(33, 1) });
  ice.world.set(POS[0], POS[1] - 1, POS[2], 3, false);
  run(ice, POS, { dropRandom: new JavaRandom(5) });
  assert.equal(ice.world.get(...POS), 0);
  assert.deepEqual(dropped(ice), [[ICE, 1, 0]]);
});

test('Fortune quantities follow BlockOre.quantityDroppedWithBonus on the supplied World.rand', () => {
  const ore = fromOriginal(56, 0).id, diamond = itemFromOriginal(264, 0).id;
  const counts = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const state = fixture(ore, { slots: enchantedPick(35, 3) });
    run(state, POS, { dropRandom: new JavaRandom(seed) });
    // nextInt(fortune + 2) - 1, floored at 0, plus the base count of one (bonus applies only above one).
    const expected = Math.max(1, Math.max(0, new JavaRandom(seed).nextInt(5) - 1) + 1);
    assert.equal(dropped(state).filter((d) => d[0] === diamond).length, expected, `seed ${seed}`);
    counts.add(expected);
    assert.ok(state.xpOrbs.orbs.length > 0, 'ore experience is still granted without Silk Touch');
  }
  assert.ok(counts.size > 1, 'Fortune III varies the count');
});

test('Creative breaks ignore Silk Touch and drop nothing', () => {
  const stone = fromOriginal(1, 0).id;
  const creative = fixture(stone, { mode: 'creative', slots: enchantedPick(33, 1) });
  run(creative, POS, { creative: true, dropRandom: new JavaRandom(5) });
  assert.deepEqual(dropped(creative), []);
});
