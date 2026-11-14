// Batch 65 mpuse2: a connected client's own use animation when the server refuses, the server's player drops against the executed EntityFlightProbe record, wither level-event cells.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World } from './world.js';
import { makeStack } from './inventory.js';
import { JavaRandom } from './lighting.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { tickPlayerItemUse } from './player-item-use.js';
import { predictUse, slotReplacesUse } from './multiplayer/client-use-predict.js';
import { levelEvent } from './wither-boss-mobs.js';
import { ITEMS } from './survival.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const food = Object.keys(ITEMS).map(Number).find(id => ITEMS[id].food && !ITEMS[id].alwaysEdible);
const fake = (over = {}) => ({ creative: false, food: 10, usable: () => true, eat: () => { throw new Error('predicted eat applied'); }, ...over });

// ---- 1: a refused use ----
test('a predicted eat or drink never finishes on the client: the count runs below zero with the 5-crumb / drink cadence, no final burst and no end', () => {
  let use = predictUse({ id: food }, fake());
  const crumbs = [];
  for (let i = 0; i < 80; i++) { use = tickPlayerItemUse(use, food, fake(), { predicted: true, foodEffects: (id, n) => crumbs.push(n) }).use; assert.ok(use, `still in use after ${i + 1} ticks`); }
  assert.ok(!crumbs.includes(16), 'updateItemUse(16) belongs to onItemUseFinish, which runs on the server only');
  // counts 24, 20, ..., 0, -4, ..., -44 (80 ticks from 32: counts 32 down to -47)
  assert.equal(crumbs.length, 6 + 1 + 11);
  let drink = { id: 343, ticks: 32, drink: true }; const sounds = [];
  for (let i = 0; i < 60; i++) drink = tickPlayerItemUse(drink, 343, fake(), { predicted: true, finishDrinking: () => assert.fail('applied'), sound: n => sounds.push(n) }).use;
  assert.ok(drink && drink.ticks < 0);
  assert.equal(sounds.length, 6 + 1 + 6, '24..0 then every 4th negative count');
});

test('the single-player eat still finishes at zero', () => {
  let use = { id: food, ticks: 32 }, eaten = 0, last;
  for (let i = 0; i < 40 && use; i++) { last = tickPlayerItemUse(use, food, { eat: () => { eaten++; return true; } }, {}); use = last.use; }
  assert.equal(eaten, 1);
  assert.equal(use, null);
});

test('an item change or a set-slot message for the held slot ends the use (EntityPlayer.onUpdate compares the stack object); other slots do not', () => {
  assert.equal(tickPlayerItemUse({ id: food, ticks: 5 }, food + 1, fake(), { predicted: true }).cancelled, true);
  assert.equal(slotReplacesUse({ type: 'slot', slots: [{ slot: 3, stack: null }, { slot: 2, stack: null }] }, 2), true);
  assert.equal(slotReplacesUse({ type: 'slot', slots: [{ slot: 3, stack: null }] }, 2), false);
  assert.equal(slotReplacesUse({ type: 'slot' }, 0), false);
});

// ---- 3: the server's player drops equal the executed record ----
const flight = JSON.parse(readFileSync(new URL('../public/research/entity-flight-reference.json', import.meta.url))).cases.filter(c => !c.wall);
const browserYaw = deg => Math.PI - (deg * Math.PI) / 180;
function joined() {
  const world = new World('mp-use2-b65');
  for (let x = 0; x <= 40; x++) for (let z = 0; z <= 40; z++) for (let y = 0; y <= 20; y++) world.put(x, y, z, 0, 0, false);
  world.spawn = () => ({ x: 20.5, y: 10, z: 20.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'survival' });
  const p = s.addPlayer('p0', 'Thrower', key(1));
  s.input('p0', { type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
  return { s, p };
}
const close = (a, b) => Math.abs(a - b) <= 1e-9 + 1e-9 * Math.abs(b);
function place(s, p, c) {
  const [x, y, z, yawDeg, pitchDeg] = c.from, rng = new JavaRandom(c.seed);
  s.items.random = () => rng.nextFloat();
  p.position.copy({ x, y, z }); p.yaw = browserYaw(yawDeg); p.pitch = (-pitchDeg * Math.PI) / 180;
}
function same(e, c) {
  const got = [e.x, e.y + 0.125, e.z, e.mx, e.my, e.mz];
  got.forEach((g, i) => assert.ok(close(g, c.spawn[i]), `${c.name} field ${i}: server ${g} native ${c.spawn[i]}`));
  assert.equal(e.delay, c.spawn[9]);
}
for (const c of flight.filter(r => !r.scatter)) {
  test(`server Q drop ${c.name} equals the executed EntityPlayer.func_146097_a`, () => {
    const { s, p } = joined(); place(s, p, c);
    p.survival.inventory.main[0] = makeStack(1, c.count, 0); p.survival.inventory.current = 0;
    const e = s.dropHeld('p0', true);
    assert.ok(e); same(e, c);
  });
  test(`server window close with a cursor stack ${c.name} throws like func_146097_a (not scattered)`, () => {
    const { s, p } = joined(); place(s, p, c);
    s.serverItems.inv.win(p); p.survival.inventory.cursor = makeStack(1, c.count, 0);
    const before = s.items.items.length;
    s.invClose('p0');
    assert.equal(s.items.items.length, before + 1);
    same(s.items.items.at(-1), c);
  });
}
for (const c of flight.filter(r => r.scatter)) {
  test(`server Creative drop ${c.name} scatters like dropPlayerItemWithRandomChoice(stack, true)`, () => {
    const { s, p } = joined(); place(s, p, c); Object.defineProperty(p.survival, "creative", { get: () => true });
    assert.equal(s.invCreative('p0', { slot: -1, item: { id: 1, count: c.count, damage: 0 } }), true);
    const e = s.items.items.at(-1);
    same(e, c);
  });
}

// ---- 4: level events truncate toward zero ----
test('wither level events 1012 / 1014 use (int) casts: negative positions round toward zero', () => {
  const m = { events: [], worldRandom: new JavaRandom(5) };
  levelEvent(m, 1014, -0.5, 64.9, -10.5);
  levelEvent(m, 1012, 3.7, -0.2, -3.0);
  assert.deepEqual(m.events.map(e => [e.aux.id, e.aux.x, e.aux.y, e.aux.z]), [[1014, 0, 64, -10], [1012, 3, 0, -3]]);
  assert.deepEqual(m.events[0].position, { x: 0.5, y: 64.5, z: -9.5 });
  assert.ok(m.events.every(e => e.aux.local && e.volume === 2));
});
