// Batch 67 mpsleep2: sleeper box and target size, movement refusal, the weather re-roll order after resetRainAndThunder.
// Bytecode-read (1.7.10 jar): ahb.o (updateWeather) re-rolls a zero rain/thunder time in the SAME call that finds it zero, without a decrement; mt.b runs ahb.b (which calls ahb.o)
// before the all-asleep skip, so after the reset the NEXT tick re-rolls. The port does the same (weather.js updateWeather); the b66 follow-up "native waits one tick" was wrong.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, BED } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { Weather } from './weather.js';
import { JavaRandom } from './java-random.js';
import { BedSleep } from './bed.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
function fixture() {
  const world = new World('mp-sleep2-b67');
  for (let x = 20; x <= 110; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'survival' });
  s.time = 14000; s.gameRules.doMobSpawning = 'false';
  world.put(64, 10, 64, BED, 0, false); world.put(64, 10, 65, BED, 8, false);
  return s;
}
function player(s, id, n) {
  const p = s.addPlayer(id, id, key(n)); const at = { x: 64.5, y: 10, z: 63.5 };
  p.position.copy(at); p.previous.copy(at); p.survival.protection = 0;
  return p;
}

test('the lying box sits at posY - yOffset = bed y + 0.7375 (0.2 x 0.2)', () => {
  const b = new BedSleep();
  b.pos = { x: 1, y: Math.fround(10.9375), z: 1 };
  assert.ok(Math.abs(b.boxY - 10.7375) < 1e-6);
  const s = fixture(), a = player(s, 'a', 1);
  s.sleep.use(a, 64, 10, 65);
  assert.ok(a.sleeping);
  assert.ok(Math.abs(a.position.y - 10.7375) < 1e-6);
});

test('a sleeping server player ignores movement input (isMovementBlocked, C03 reset)', () => {
  const s = fixture(), a = player(s, 'a', 1);
  s.sleep.use(a, 64, 10, 65);
  const at = { x: a.position.x, y: a.position.y, z: a.position.z };
  a.input = { ...IDLE_INPUT, forward: 1, jump: true, sneak: false }; a.lastInput = s.ticks + 5;
  for (let i = 0; i < 5; i++) { a.lastInput = s.ticks; s.tick(); }
  assert.deepEqual({ x: a.position.x, y: a.position.y, z: a.position.z }, at);
  assert.ok(a.sleeping);
});

test('the mobs see a lying player as a 0.2 x 0.2 target, a standing one as 0.6 x 1.8', () => {
  const s = fixture(), a = player(s, 'a', 1);
  s.tick();
  const view = s.mobs.views.get('a').view;
  assert.equal(view.width, Math.fround(0.6)); assert.equal(view.height, Math.fround(1.8));
  s.sleep.use(a, 64, 10, 65);
  s.tick();
  assert.equal(view.sleeping, true);
  assert.equal(view.width, Math.fround(0.2)); assert.equal(view.height, Math.fround(0.2));
  s.sleep.leave('a'); s.tick();
  assert.equal(view.width, Math.fround(0.6));
});

test('after the reset the first weather update re-rolls the zero times, the second counts down', () => {
  const w = new Weather({ random: new JavaRandom(7) });
  w.rainTime = 5000; w.thunderTime = 4000; w.raining = true; w.thundering = true; w.rain = 1; w.thunder = 1;
  w.rainTime = 0; w.thunderTime = 0; w.raining = false; w.thundering = false; // World.resetRainAndThunder (strengths stay)
  w.updateWeather();
  assert.ok(w.thunderTime >= 12000 && w.thunderTime < 180000, 'thunder time re-rolled (not thundering: nextInt(168000) + 12000)');
  assert.ok(w.rainTime >= 12000 && w.rainTime < 180000);
  assert.equal(w.raining, false); assert.equal(w.thundering, false);
  const [r, t] = [w.rainTime, w.thunderTime];
  w.updateWeather();
  assert.equal(w.rainTime, r - 1); assert.equal(w.thunderTime, t - 1);
  assert.ok(Math.abs(w.rain - 0.98) < 1e-6, 'the strength ramps down 0.01 a tick from 1');
});

test('the server night skip: times are zero straight after the skip, re-rolled on the next tick', () => {
  const s = fixture(), a = player(s, 'a', 1);
  Object.assign(s.weather, { rainTime: 5000, thunderTime: 4000, raining: true, thundering: true });
  s.sleep.use(a, 64, 10, 65);
  for (let i = 0; i < 99; i++) s.tick();
  assert.ok(a.sleeping);
  s.tick();
  assert.ok(!a.sleeping, 'woken by the skip');
  assert.equal(s.weather.rainTime, 0); assert.equal(s.weather.thunderTime, 0);
  assert.equal(s.weather.raining, false); assert.equal(s.weather.thundering, false);
  s.tick();
  assert.ok(s.weather.rainTime >= 12000 && s.weather.thunderTime >= 12000);
});
