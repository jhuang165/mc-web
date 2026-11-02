import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Effects, HUNGER, POISON } from './status-effects.js';
import { Survival } from './survival.js';
import { finishDrinking, MILK_BUCKET } from './buckets.js';
import { makeStack } from './inventory.js';

const { rows } = JSON.parse(readFileSync(new URL('../public/research/effects-reference.json', import.meta.url)));
const itemIds = { 375: 326, 365: 318, 367: 206, 394: 325, 391: 322, 335: MILK_BUCKET, 325: 340 };

test('food effect chances and durations replay original ItemFood at threshold boundaries', () => {
  for (const row of rows.filter((r) => r.case === 'food')) {
    const player = new Survival({ food: 10, slots: [makeStack(itemIds[row.item], 2)] });
    assert.equal(player.eat(itemIds[row.item], () => row.roll), true);
    const effects = player.effects.serialize();
    assert.deepEqual(effects.map((e) => [e.id, e.duration, e.amplifier]), row.effect ? [row.effect] : [], JSON.stringify(row));
    assert.equal(player.held.count, 1);
  }
});

test('Poison/Hunger tick cadence, expiry and Java float exhaustion replay Potion/PotionEffect', () => {
  for (const row of rows.filter((r) => r.case === 'ticks')) {
    const effects = new Effects([{ id: row.id, duration: row.duration, amplifier: row.amplifier }]);
    let tick = 0;
    const hits = [], player = {
      health: 20, exhaustion: 0,
      exhaust(n) { this.exhaustion = Math.fround(this.exhaustion + n); },
      damage(n) { this.health -= n; hits.push(tick); },
    };
    for (; tick < row.duration; tick++) effects.tick(player);
    assert.equal(player.health, row.health, JSON.stringify(row));
    assert.equal(player.exhaustion, Math.fround(row.exhaustion), JSON.stringify(row));
    assert.deepEqual(hits, row.hits, JSON.stringify(row));
    assert.deepEqual(effects.serialize(), []);
  }
});

test('same-effect refresh and stronger/weaker combinations replay PotionEffect.combine', () => {
  for (const row of rows.filter((r) => r.case === 'combine')) {
    const effects = new Effects([{ id: POISON, duration: 100, amplifier: row.oldAmplifier }]);
    effects.add({ id: POISON, duration: row.duration, amplifier: row.newAmplifier });
    const effect = effects.get(POISON);
    assert.deepEqual([effect.duration, effect.amplifier], row.after, JSON.stringify(row));
  }
});

test('milk clears every supported effect and matches original bucket consumption in both modes', () => {
  for (const row of rows.filter((r) => r.case === 'milk')) {
    const player = new Survival({ slots: [makeStack(MILK_BUCKET)], effects: [{ id: POISON, duration: 100 }, { id: HUNGER, duration: 600 }] }, row.creative ? 'creative' : 'survival');
    assert.equal(finishDrinking(player), true);
    assert.equal(player.effects.active.size === 0, row.cleared);
    assert.deepEqual(player.held, makeStack(itemIds[row.item], row.count));
  }
  const player = new Survival({ effects: [{ id: POISON, duration: 100 }] });
  assert.equal(finishDrinking(player), false);
  assert.equal(player.effects.has(POISON), true);
});

test('Poison bypasses armor, respects the existing hurt window and stops at one health', () => {
  const player = new Survival({ food: 10, armor: [makeStack(419)], effects: [{ id: POISON, duration: 100 }] });
  assert.equal(player.armorValue, 3);
  const armor = player.inventory.serializeArmor();
  player.tick();
  assert.equal(player.health, 19);
  assert.deepEqual(player.inventory.serializeArmor(), armor);
  player.damage(4, 'a zombie', true); // poison's 1 opened the hurt window: only the armoured difference of 3 lands
  assert.equal(player.health, Math.fround(19 - 3 * (1 - 3 / 25)));
  for (let i = 0; i < 99; i++) player.tick();
  assert.ok(player.health < 16.36 && player.health > 12);
  assert.equal(player.effects.has(POISON), false);
  const weak = new Survival({ health: 1, food: 10, effects: [{ id: POISON, duration: 100 }] });
  for (let i = 0; i < 100; i++) weak.tick();
  assert.equal(weak.health, 1);
  const hurt = new Survival({ food: 10, effects: [{ id: POISON, duration: 100 }] });
  hurt.damage(3, 'a fall');
  hurt.tick();
  assert.equal(hurt.health, 17);
  assert.equal(hurt.effects.get(POISON).duration, 99);
});

test('Hunger drains FoodStats; Creative takes no effect damage or exhaustion while durations expire', () => {
  const player = new Survival({ food: 10, saturation: 0, effects: [{ id: HUNGER, duration: 600 }] });
  for (let i = 0; i < 600; i++) player.tick();
  assert.equal(player.food, 7);
  assert.ok(player.exhaustion > 2.9 && player.exhaustion < 3.1);
  const creative = new Survival({ effects: [{ id: POISON, duration: 100 }, { id: HUNGER, duration: 100 }] }, 'creative');
  for (let i = 0; i < 100; i++) creative.tick();
  assert.equal(creative.health, 20);
  assert.equal(creative.exhaustion, 0);
  assert.deepEqual(creative.effects.serialize(), []);
});

test('saved effects resume their remaining tick cadence, isolate snapshots and reject invalid saves', () => {
  const player = new Survival({ food: 10, effects: [{ id: POISON, duration: 100 }, { id: HUNGER, duration: 600 }] });
  for (let i = 0; i < 12; i++) player.tick();
  const saved = player.serialize(), loaded = new Survival(saved);
  for (let i = 0; i < 100; i++) { player.tick(); loaded.tick(); }
  assert.deepEqual(loaded.serialize(), player.serialize());
  assert.equal(saved.effects[0].duration, 88);
  assert.deepEqual(new Effects([null, {}, { id: 1, duration: 100 }, { id: POISON, duration: NaN }, { id: HUNGER, duration: 0 }]).serialize(), []);
  assert.deepEqual(new Survival().effects.serialize(), []);
});

test('failed eating applies no effects and consumes no random draw', () => {
  const player = new Survival({ slots: [makeStack(325)] });
  const random = () => { throw new Error('Unexpected roll'); };
  assert.equal(player.eat(325, random), false);
  player.food = 10;
  assert.equal(player.eat(318, random), false);
  assert.deepEqual(player.effects.serialize(), []);
});
