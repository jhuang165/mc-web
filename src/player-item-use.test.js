import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Survival } from './survival.js';
import { makeStack } from './inventory.js';
import { finishDrinking, BUCKET, MILK_BUCKET } from './buckets.js';
import { BOW } from './bow.js';
import { POISON } from './status-effects.js';
import { tickPlayerItemUse } from './player-item-use.js';

const CHICKEN = 318;
const player = (id, mode = 'survival', effects = []) =>
  new Survival({ food: 10, slots: [makeStack(id)], effects }, mode);

test('food use runs all 32 ticks, six cadence effects, finish crumbs, then consumes', () => {
  const p = player(CHICKEN), effects = [], sounds = [];
  let use = { id: CHICKEN, ticks: 32 };
  for (let i = 0; i < 32; i++) {
    const result = tickPlayerItemUse(use, CHICKEN, p, {
      foodEffects: (id, n) => effects.push([id, n]), sound: (name) => sounds.push(name),
    });
    use = result.use;
    assert.equal(result.completed, i === 31);
    if (i < 31) assert.equal(use.ticks, 31 - i);
  }
  assert.equal(use, null);
  assert.deepEqual(effects, [...[24, 20, 16, 12, 8, 4].map(() => [CHICKEN, 5]), [CHICKEN, 16]]);
  assert.deepEqual(sounds, ['random.burp']);
  assert.equal(p.count(CHICKEN), 0);
  assert.equal(p.food, 12);
});

test('milk use uses pre-decrement cadence and finishes in Survival and Creative', () => {
  for (const mode of ['survival', 'creative']) {
    const p = player(MILK_BUCKET, mode, [{ id: POISON, duration: 90 }]);
    const sounds = [], order = [];
    let randomCalls = 0, renders = 0, dirty = 0;
    let use = { id: MILK_BUCKET, ticks: 32, drink: true };
    for (let i = 0; i < 32; i++) {
      const result = tickPlayerItemUse(use, MILK_BUCKET, p, {
        random: () => { randomCalls++; return 0.5; },
        sound: (...args) => { sounds.push(args); order.push('sound'); },
        finishDrinking: finishDrinking,
        renderHotbar: () => { renders++; order.push('render'); },
        markUnsaved: () => { dirty++; order.push('dirty'); },
      });
      use = result.use;
      assert.equal(result.completed, i === 31);
    }
    assert.equal(use, null);
    assert.equal(randomCalls, 7, 'six cadence pitches and the finish pitch');
    assert.equal(sounds.length, 7);
    assert.ok(sounds.every((s) => Math.abs(s[1].pitch - 0.95) < 1e-12));
    assert.deepEqual(order.slice(-3), ['sound', 'render', 'dirty']);
    assert.equal(renders, 1);
    assert.equal(dirty, 1);
    assert.equal(p.effects.has(POISON), false);
    assert.equal(p.inventory.held.id, mode === 'creative' ? MILK_BUCKET : BUCKET);
    assert.equal(p.inventory.held.count, 1);
  }
});

test('a changed held item cancels without ticking or effects', () => {
  const p = player(CHICKEN), calls = [];
  const result = tickPlayerItemUse({ id: CHICKEN, ticks: 4 }, 999, p, {
    foodEffects: () => calls.push('food'), sound: () => calls.push('sound'),
  });
  assert.deepEqual(result, { use: null, cancelled: true, completed: false });
  assert.deepEqual(calls, []);
  assert.equal(p.count(CHICKEN), 1);
});

test('failed milk finish still plays the finish sound but does not render or dirty', () => {
  const p = player(MILK_BUCKET), calls = [];
  const result = tickPlayerItemUse({ id: MILK_BUCKET, ticks: 1, drink: true }, MILK_BUCKET, p, {
    random: () => { calls.push('random'); return 0.25; },
    sound: (name) => calls.push(name),
    finishDrinking: () => { calls.push('finish'); return false; },
    renderHotbar: () => calls.push('render'), markUnsaved: () => calls.push('dirty'),
  });
  assert.equal(result.use, null);
  assert.deepEqual(calls, ['random', 'random.drink', 'finish']);
});

test('final food effects and chance roll happen before the burp and hotbar update', () => {
  const p = player(325), calls = [];
  p.effects.food = (id, random) => { calls.push(`chance:${id}`); assert.equal(random(), 0.75); };
  const result = tickPlayerItemUse({ id: 325, ticks: 1 }, 325, p, {
    foodEffects: (id, n) => calls.push(`crumbs:${id}:${n}`),
    random: () => { calls.push('random'); return 0.75; },
    sound: (name) => calls.push(name),
    renderHotbar: () => calls.push('render'),
  });
  assert.equal(result.use, null);
  assert.deepEqual(calls, ['crumbs:325:16', 'chance:325', 'random', 'random.burp', 'render']);
});

test('bow draw increments once per tick without invoking food or drink effects', () => {
  const p = player(BOW), calls = [];
  const result = tickPlayerItemUse({ id: BOW, ticks: 18, bow: true }, BOW, p, {
    foodEffects: () => calls.push('food'), sound: () => calls.push('sound'),
  });
  assert.deepEqual(result, { use: { id: BOW, ticks: 19, bow: true }, cancelled: false, completed: false });
  assert.deepEqual(calls, []);
});

test('failed food completion keeps the native effect timing but skips burp and render', () => {
  const p = player(CHICKEN), calls = [];
  p.food = 20;
  const result = tickPlayerItemUse({ id: CHICKEN, ticks: 1 }, CHICKEN, p, {
    foodEffects: (_id, n) => calls.push(`crumbs:${n}`),
    random: () => { calls.push('random'); return 0.5; },
    sound: (name) => calls.push(name), renderHotbar: () => calls.push('render'),
  });
  assert.equal(result.use, null);
  assert.deepEqual(calls, ['crumbs:16']);
  assert.equal(p.count(CHICKEN), 1);
});
