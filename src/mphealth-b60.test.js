import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { Survival } from './survival.js';
import { Experience } from './experience.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { applyHealthMessage } from './multiplayer/server-survival.js';
import { applyHurtMessage, applyEffectMessage, applyEffectEnd, tickClientHealth } from './multiplayer/client-health.js';
import { stepRemoteDeath } from './multiplayer/remote-death.js';
import { heartsBlink } from './damage-hud.js';
import { hurtCameraRoll } from './damage-fx.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
const seed = (s, id, message) => { s.serverItems.adopt(s.players.get(id), message, true); return s.input(id, message); }; // b61: a Survival server ignores the client's hotbar mirror; tests seed the inventory

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const MILK = 343, SPIDER_EYE = 326, POISON = 19;
const input = (hotbar = []) => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: [...hotbar, ...Array(9 - hotbar.length).fill(null)] });
function fixture(opts = {}) {
  const world = new World('mp-health-b60');
  for (let x = 20; x <= 110; x++) for (let z = 58; z <= 70; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation({}, { world, gameMode: 'survival', ...opts });
}
function joined(opts, hotbar = []) {
  const s = fixture(opts), a = s.addPlayer('a', 'Alice', key(1));
  a.position.copy({ x: 64.5, y: 10, z: 64.5 });
  seed(s, 'a', input(hotbar));
  for (let i = 0; i < 3; i++) s.tick();
  a.survival.protection = 0;
  return { s, a };
}
const run = (s, n) => { for (let i = 0; i < n; i++) s.tick(); };
const kinds = ms => ms.map(m => m.type);

test('server: a fresh hit sends one healthHurt (S19 status 2) and the next call sends none', () => {
  const { s, a } = joined();
  s.serverSurvival.outgoing(a);
  assert.ok(s.damagePlayer(a, 4, undefined));
  const first = s.serverSurvival.outgoing(a);
  assert.deepEqual(first, [{ type: 'healthHurt', hurt: true }]);
  assert.deepEqual(s.serverSurvival.outgoing(a), []);
  // a hit inside the 10 tick window that is not larger opens no new status 2
  assert.equal(s.damagePlayer(a, 2, undefined), false);
  assert.deepEqual(s.serverSurvival.outgoing(a), []);
});

test('server: damage taken during the tick (a fall) is not lost when the tick clears the sounds', () => {
  const { s, a } = joined();
  s.serverSurvival.outgoing(a);
  a.position.copy({ x: 64.5, y: 25, z: 64.5 });
  run(s, 60);
  assert.ok(a.survival.health < 20);
  assert.ok(kinds(s.serverSurvival.outgoing(a)).includes('healthHurt'));
});

test('client: S06 drops start hurtTime 10 and hurtResistantTime 20; a rise sets 10; the first update only sets', () => {
  const c = new Survival({}, 'survival');
  applyHealthMessage(c, { health: 10, food: 20, saturation: 5 }); // the first update
  assert.deepEqual([c.health, c.hurtTime, c.clientResist], [10, 0, 0]);
  applyHealthMessage(c, { health: 6, food: 20, saturation: 5 });
  assert.deepEqual([c.health, c.hurtTime, c.clientResist], [6, 10, 20]);
  tickClientHealth(c); tickClientHealth(c); tickClientHealth(c);
  assert.deepEqual([c.hurtTime, c.clientResist], [7, 17]);
  assert.ok(heartsBlink(c.clientResist), 'blinking above 10 on the third steps');
  for (let i = 0; i < 20; i++) tickClientHealth(c);
  assert.deepEqual([c.hurtTime, c.clientResist], [0, 0]);
  applyHealthMessage(c, { health: 8, food: 20, saturation: 5 });
  assert.deepEqual([c.health, c.hurtTime, c.clientResist], [8, 0, 10]);
});

test('client: the camera tilt follows hurtTime (damage-fx hurtCameraRoll) after a health drop', () => {
  const c = new Survival({}, 'survival');
  applyHealthMessage(c, { health: 20, food: 20, saturation: 5 });
  applyHealthMessage(c, { health: 15, food: 20, saturation: 5 });
  const roll = hurtCameraRoll({ hurtTime: c.hurtTime, health: c.health }, 0);
  assert.notEqual(roll, 0);
});

test('client: Absorption and Resistance reduce the drop again, as the client damageEntity does (bytecode-read bjk.n)', () => {
  const c = new Survival({}, 'survival');
  applyHealthMessage(c, { health: 20, food: 20, saturation: 5 });
  c.absorption = 4;
  applyHealthMessage(c, { health: 16, food: 20, saturation: 5 }); // f = 4, all taken by Absorption
  assert.equal(c.health, 20);
  assert.equal(c.absorption, 0);
  assert.equal(c.clientResist, 20);
});

test('client: healthHurt gives the hurt and death sounds; a death without keepInventory empties the client copy and its XP', () => {
  const c = new Survival({}, 'survival'), xp = new Experience(); xp.add(100);
  c.inventory.main[0] = { id: 1, count: 5, damage: 0 };
  assert.deepEqual(applyHurtMessage(c, xp, { hurt: true }), ['game.player.hurt']);
  assert.deepEqual([c.hurtTime, c.clientResist], [10, 20]);
  assert.deepEqual(applyHurtMessage(c, xp, { die: true, keep: true }), ['game.player.die']);
  assert.ok(c.inventory.main[0]);
  assert.deepEqual(applyHurtMessage(c, xp, { hurt: true, die: true, keep: false }), ['game.player.hurt', 'game.player.die']);
  assert.equal(c.inventory.main[0], null);
  assert.equal(xp.total, 0);
});

test('death drops the inventory as world items and sends the die message (keepInventory false)', () => {
  const { s, a } = joined({}, [{ id: 1, count: 12 }]);
  a.survival.inventory.main[1] = { id: 260, count: 3, damage: 0 };
  s.serverSurvival.outgoing(a);
  s.damagePlayer(a, 100, undefined);
  run(s, 1);
  assert.ok(a.dead);
  assert.ok(a.survival.inventory.main.every(x => !x));
  const dropped = {}; for (const e of s.items.items) dropped[e.stack.id] = (dropped[e.stack.id] ?? 0) + e.stack.count;
  assert.equal(dropped[260], 3);
  assert.ok(dropped[1] >= 1);
  const out = s.serverSurvival.outgoing(a);
  assert.deepEqual(out[0], { type: 'healthHurt', hurt: true, die: true, keep: false });
  assert.deepEqual(s.serverSurvival.outgoing(a), [], 'once');
});

test('keepInventory true keeps the inventory and drops nothing', () => {
  const { s, a } = joined({}, [{ id: 1, count: 12 }]);
  s.gameRules.keepInventory = 'true';
  a.experience.add(200);
  s.damagePlayer(a, 100, undefined);
  run(s, 30);
  assert.ok(a.dead);
  assert.equal(a.survival.inventory.main[0].count, 12);
  assert.equal(s.items.items.length, 0);
  assert.equal(s.serverItems.xp.orbs.length, 0);
  assert.equal(s.serverSurvival.outgoing(a)[0].keep, true);
});

test('XP: min(level * 7, 100) orbs appear at deathTime 20 at the death position; the player is reset', () => {
  const { s, a } = joined();
  a.experience.add(500);
  const level = a.experience.level, expected = Math.min(level * 7, 100);
  assert.ok(expected > 0);
  s.damagePlayer(a, 100, undefined);
  run(s, 1);
  assert.equal(s.serverItems.xp.orbs.length, 0, 'not yet');
  run(s, 18);
  assert.equal(s.serverItems.xp.orbs.length, 0, 'tick 19');
  run(s, 2);
  const total = s.serverItems.xp.orbs.reduce((n, o) => n + o.value, 0);
  assert.equal(total, expected);
  assert.equal(a.experience.total, 0);
});

test('doMobLoot false drops no orbs, and a respawn before tick 20 drops none (the entity is replaced)', () => {
  const x = joined();
  x.s.gameRules.doMobLoot = 'false'; x.a.experience.add(500);
  x.s.damagePlayer(x.a, 100, undefined); run(x.s, 30);
  assert.equal(x.s.serverItems.xp.orbs.length, 0);
  const y = joined();
  y.a.experience.add(500);
  y.s.damagePlayer(y.a, 100, undefined); run(y.s, 5);
  assert.ok(y.s.serverSurvival.respawn(y.a));
  run(y.s, 30);
  assert.equal(y.s.serverItems.xp.orbs.length, 0);
  assert.equal(y.a.experience.total, 0);
});

test('a dead player collects no XP orbs and cannot pick up items', () => {
  const { s, a } = joined();
  a.experience.add(500);
  s.damagePlayer(a, 100, undefined);
  run(s, 25);
  const before = a.experience.total;
  assert.ok(s.serverItems.xp.orbs.length > 0);
  run(s, 60);
  assert.equal(a.experience.total, before);
  assert.equal(s.pickup('a', [1], [64]), false);
});

test('a player named Notch drops an apple on death even under keepInventory', () => {
  const s = fixture(), a = s.addPlayer('a', 'Notch', key(2));
  a.position.copy({ x: 64.5, y: 10, z: 64.5 }); seed(s, 'a', input()); run(s, 3);
  s.gameRules.keepInventory = 'true'; a.survival.protection = 0;
  s.damagePlayer(a, 100, undefined); run(s, 1);
  assert.deepEqual(s.items.items.map(e => [e.stack.id, e.stack.count]), [[260, 1]]);
});

test('effects: eating a spider eye sends healthEffect, the timer needs no resend, the end sends healthEffectEnd', () => {
  const { s, a } = joined({}, [{ id: SPIDER_EYE, count: 2 }]);
  s.serverSurvival.outgoing(a);
  a.survival.food = 10;
  s.serverSurvival.finishEating(a, SPIDER_EYE);
  const first = s.serverSurvival.outgoing(a);
  assert.deepEqual(first.filter(m => m.type === 'healthEffect').map(m => [m.id, m.amplifier, m.duration]), [[POISON, 0, 100]]);
  run(s, 3);
  assert.deepEqual(kinds(s.serverSurvival.outgoing(a)).filter(k => k === 'healthEffect'), [], 'counting down is not a change');
  run(s, 100);
  assert.deepEqual(s.serverSurvival.outgoing(a).filter(m => m.type === 'healthEffectEnd'), [{ type: 'healthEffectEnd', id: POISON }]);
});

test('effects: a stronger or longer re-add is sent again; the client applies, counts down and removes', () => {
  const { s, a } = joined();
  s.serverSurvival.outgoing(a);
  a.survival.effects.add({ id: 1, duration: 300, amplifier: 0 });
  const [m1] = s.serverSurvival.outgoing(a);
  run(s, 2);
  s.serverSurvival.outgoing(a);
  a.survival.effects.add({ id: 1, duration: 900, amplifier: 1 });
  const [m2] = s.serverSurvival.outgoing(a);
  assert.deepEqual([m2.type, m2.amplifier, m2.duration], ['healthEffect', 1, 900]);
  const c = new Survival({}, 'survival');
  assert.ok(applyEffectMessage(c, m1));
  assert.equal(c.effects.get(1).duration, 300);
  tickClientHealth(c); tickClientHealth(c);
  assert.equal(c.effects.get(1).duration, 298);
  assert.ok(applyEffectMessage(c, m2));
  assert.deepEqual([c.effects.get(1).amplifier, c.effects.get(1).duration], [1, 900]);
  assert.ok(applyEffectEnd(c, { id: 1 }));
  assert.equal(c.effects.has(1), false);
  assert.equal(applyEffectMessage(c, { id: 1, amplifier: 0, duration: NaN }), false);
});

test('effects: milk uses a bucket and clears every effect (ItemBucketMilk.onEaten); the client is told', () => {
  const { s, a } = joined({}, [{ id: MILK, count: 2 }]);
  a.survival.effects.add({ id: POISON, duration: 500, amplifier: 0 });
  a.survival.effects.add({ id: 1, duration: 500, amplifier: 0 });
  s.serverSurvival.outgoing(a);
  s.queueUse('a', true);
  run(s, 40);
  assert.equal(a.survival.effects.active.size, 0);
  assert.equal(a.survival.inventory.main[0].count, 1);
  const out = s.serverSurvival.outgoing(a).filter(m => m.type === 'healthEffectEnd').map(m => m.id).sort((x, y) => x - y);
  assert.deepEqual(out, [1, POISON]);
});

test('beacon-style grants and /effect reach the client by the same diff; Creative players are included', () => {
  const { s, a } = joined();
  a.survival.mode = 'creative';
  s.serverSurvival.outgoing(a);
  a.survival.effects.add({ id: 1, duration: 200, amplifier: 0, ambient: true });
  const [m] = s.serverSurvival.outgoing(a);
  assert.deepEqual(m, { type: 'healthEffect', id: 1, amplifier: 0, duration: 200, ambient: true });
});

test('presence marks a dead player (it stays in the player list: S38 is login driven); the viewing copy tilts 20 ticks, poofs and hides until the respawn', () => {
  const { s, a } = joined();
  assert.equal(s.presence()[0].dead, undefined);
  s.damagePlayer(a, 100, undefined); run(s, 2);
  assert.equal(s.presence().length, 1, 'still listed');
  assert.equal(s.presence()[0].dead, true);
  const e = {}, steps = [];
  for (let i = 0; i < 22; i++) steps.push(stepRemoteDeath(e, true));
  assert.equal(steps.findIndex(x => x.burst), 19, 'the poof is on the 20th tick');
  assert.deepEqual(steps.slice(0, 19).map(x => x.hidden), Array(19).fill(false));
  assert.equal(steps[21].hidden, true);
  assert.equal(steps.filter(x => x.burst).length, 1);
  assert.deepEqual(stepRemoteDeath(e, false), { burst: false, hidden: false });
  assert.equal(e.deathTime, 0);
  s.serverSurvival.respawn(a);
  assert.equal(s.presence()[0].dead, undefined);
});

test('respawn after death: full vitals, no effects, a new experience when keepInventory is off', () => {
  const { s, a } = joined();
  a.survival.effects.add({ id: POISON, duration: 500, amplifier: 0 });
  s.serverSurvival.outgoing(a);
  a.experience.add(50);
  s.damagePlayer(a, 100, undefined); run(s, 2);
  s.serverSurvival.outgoing(a);
  assert.ok(s.serverSurvival.respawn(a));
  assert.equal(a.survival.health, 20);
  assert.equal(a.survival.effects.active.size, 0);
  assert.deepEqual(s.serverSurvival.outgoing(a).filter(m => m.type === 'healthEffectEnd'), [{ type: 'healthEffectEnd', id: POISON }]);
});
