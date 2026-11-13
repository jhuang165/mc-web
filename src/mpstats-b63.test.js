// Batch 63 (mpstats): per-player statistics on the dedicated server (server-stats.js), S37 on request, the client merge (client-stats.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { applyStatsMessage } from './multiplayer/client-stats.js';
import { makeStack } from './inventory.js';
import { Stats, STAT } from './stats.js';

const WHEAT = 305;
const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = (controls = {}) => ({ type: 'input', controls: { ...IDLE_INPUT, ...controls }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture(saved = {}, mobs = false, gameMode = 'survival') {
  const world = new World('mp-stats-b63');
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation(saved, { world, gameMode, mobs });
  if (mobs) { s.mobs.spawning = false; s.mobs.mobs.entities.length = 0; }
  return s;
}
const join = (s, id = 'a', n = 1) => { const p = s.addPlayer(id, id + 'x', key(n)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position); s.input(id, input()); return p; };

test('play time and walking distance count per player and save in the player record', () => {
  const s = fixture(), p = join(s);
  for (let i = 0; i < 40; i++) { s.input('a', input({ forward: 1 })); s.tick(); }
  assert.equal(p.stats.get(STAT.playOneMinute), 40);
  assert.ok(p.stats.get(STAT.walk) > 100, 'walked some cm');
  const rec = s.savePlayer(p);
  assert.equal(rec.stats[STAT.playOneMinute], 40);
  s.removePlayer('a');
  const again = join(s, 'a', 1);
  assert.equal(again.stats.get(STAT.playOneMinute), 40);
  assert.equal(again.stats.get(STAT.leaveGame), 1);
});

test('stats.add is the hook for other tracks; unknown ids and bad counts are ignored', () => {
  const s = fixture(), p = join(s);
  s.stats.add(p, STAT.playerKills); s.stats.add(p, STAT.playerKills, 2); s.stats.add(p, 'stat.nope'); s.stats.add(p, STAT.deaths, -1);
  assert.equal(p.stats.get(STAT.playerKills), 3);
  assert.equal(p.stats.get(STAT.deaths), 0);
});

test('a jump and damage taken count; a death counts deaths', () => {
  const s = fixture(), p = join(s);
  p.grounded = true; s.input('a', input({ jump: true })); s.tick();
  assert.equal(p.stats.get(STAT.jump), 1);
  p.survival.protection = 0; p.survival.hurtTicks = 0; p.survival.damage(3, 'test', true);
  assert.equal(p.stats.get(STAT.damageTaken), 30);
  p.survival.health = 0; s.tick();
  assert.equal(p.stats.get(STAT.deaths), 1);
});

test('S37: the first request is full, a second inside 300 ticks is empty, a later one has the changes only', () => {
  const s = fixture(), p = join(s);
  s.stats.add(p, STAT.jump, 5);
  s.ticks = 5;
  const a = s.stats.request(p);
  assert.equal(a.type, 'stats'); assert.equal(a.full, true); assert.equal(a.stats[STAT.jump], 5);
  s.stats.add(p, STAT.drop);
  s.ticks += 10;
  assert.deepEqual(s.stats.request(p), { type: 'stats', stats: {}, full: false });
  s.ticks += 400;
  const c = s.stats.request(p);
  assert.deepEqual(c.stats, { [STAT.drop]: 1 }); assert.equal(c.full, false);
  assert.equal(s.stats.request(null), null);
});

test('client merge: full replaces, later messages overwrite the named stats, junk is skipped', () => {
  const st = new Stats({ [STAT.jump]: 9, [STAT.drop]: 4 });
  applyStatsMessage(st, { stats: { [STAT.jump]: 2, 'stat.nope': 5, [STAT.deaths]: -3 }, full: true });
  assert.equal(st.get(STAT.jump), 2); assert.equal(st.get(STAT.drop), 0); assert.equal(st.get(STAT.deaths), 0);
  applyStatsMessage(st, { stats: { [STAT.drop]: 7 }, full: false });
  assert.equal(st.get(STAT.jump), 2); assert.equal(st.get(STAT.drop), 7);
  assert.equal(applyStatsMessage(st, null), 0);
});

test('breeding two cows credits animalsBred (and breedCow) to the player who fed them', () => {
  const s = fixture({}, true), p = join(s);
  const mk = x => { const m = s.mobs.mobs.create('cow', x, 10, 64.5); s.mobs.mobs.entities.push(m); return m; };
  const a = mk(66.5), b = mk(67.5); s.tick();
  p.survival.inventory.main[0] = makeStack(WHEAT, 4); p.survival.inventory.current = 0;
  for (const m of [a, b]) { s.queueAnimUse(p.id, Number(m.id.slice(4)), false); s.tick(); }
  let born = null;
  for (let i = 0; i < 400 && !born; i++) { s.tick(); born = s.mobs.mobs.entities.find(e => e.type === 'cow' && e.growingAge < 0); }
  assert.ok(born);
  assert.equal(p.stats.get(STAT.animalsBred), 1);
});

test('killing a mob with a sword counts mob kills, damage dealt, the entity kill stat', () => {
  const s = fixture({}, true), p = join(s);
  const z = s.mobs.mobs.create('zombie', 65.5, 10, 64.5); z.health = 0.5; s.mobs.mobs.entities.push(z); s.tick();
  s.queueAttack(p.id, Number(z.id.slice(4))); s.tick();
  assert.equal(p.stats.get(STAT.mobKills), 1);
  assert.ok(p.stats.get(STAT.damageDealt) > 0);
  assert.equal(p.stats.get('stat.killEntity.Zombie'), 1);
});
