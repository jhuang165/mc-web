import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, BED } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { resetRainAndThunder } from './multiplayer/server-sleep.js';
import { remoteSleepPose, clientSleepTick, clientWake, sleepText, SLEEP_TYPES } from './multiplayer/client-sleep.js';
import { ENTITY_MOB, mobInBox, BedSleep, BED_TEXT, bedSpawnSpot } from './bed.js';
import { ENTITY_TYPES } from './entities.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const NIGHT = 14000;
function fixture() {
  const world = new World('mp-sleep-b66');
  for (let x = 20; x <= 110; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'survival' });
  s.time = NIGHT; s.gameRules.doMobSpawning = 'false'; // no night mob may refuse the bed or hit the sleeper
  return s;
}
// A bed with its foot at (x, 10, z) and its head one cell on (facing 0: +z).
function bedAt(s, x, z, facing = 0) {
  const [dx, dz] = [[0, 1], [-1, 0], [0, -1], [1, 0]][facing];
  s.world.put(x, 10, z, BED, facing, false); s.world.put(x + dx, 10, z + dz, BED, facing | 8, false);
  return [x + dx, 10, z + dz];
}
function player(s, id, name, n, at = { x: 64.5, y: 10, z: 63.5 }) {
  const p = s.addPlayer(id, name, key(n));
  p.position.copy(at); p.previous.copy(at); p.survival.protection = 0;
  return p;
}
const out = (p, type) => (p.itemsOut ?? []).filter(m => m.type === type);
const run = (s, n) => { for (let i = 0; i < n; i++) s.tick(); };

test('a night click on a bed lies the player down: occupied bit, sleepIn, presence pose', () => {
  const s = fixture(), head = bedAt(s, 64, 64), a = player(s, 'a', 'Alice', 1);
  assert.equal(s.sleep.use(a, ...head), true);
  assert.ok(a.sleeping);
  assert.equal(s.world.getMeta(...head) & 4, 4);
  assert.deepEqual(out(a, 'sleepIn'), [{ type: 'sleepIn', x: 64, y: 10, z: 65, facing: 0 }]);
  assert.equal(a.position.y, 10.5625);
  assert.deepEqual(s.presence().find(r => r.id === 'a').sleep, [64, 10, 65, 0]);
});

test('clicking the foot half works like the head; daytime answers tile.bed.noSleep and nothing happens', () => {
  const s = fixture(); bedAt(s, 64, 64); const a = player(s, 'a', 'Alice', 1);
  s.time = 2000; s.sleep.use(a, 64, 10, 64);
  assert.ok(!a.sleeping);
  assert.deepEqual(out(a, 'sleepMsg'), [{ type: 'sleepMsg', key: 'noSleep' }]);
  assert.equal(sleepText('noSleep'), BED_TEXT.noSleep);
  s.time = NIGHT; a.itemsOut = []; s.sleep.use(a, 64, 10, 64);
  assert.ok(a.sleeping);
});

test('an EntityMob within 8 x 5 x 8 refuses (tile.bed.notSafe); a slime or ghast does not', () => {
  const s = fixture(), head = bedAt(s, 64, 64), a = player(s, 'a', 'Alice', 1);
  const list = s.mobs.mobs.entities;
  list.push({ type: 'slime', x: 66.5, y: 10, z: 66.5, health: 16 }, { type: 'ghast', x: 66.5, y: 10, z: 66.5, health: 10 });
  s.sleep.use(a, ...head);
  assert.ok(a.sleeping, 'slime and ghast are not EntityMob');
  s.sleep.leave('a'); a.itemsOut = [];
  list.push({ type: 'zombie', x: 70.5, y: 10, z: 70.5, health: 20 });
  s.sleep.use(a, ...head);
  assert.ok(!a.sleeping);
  assert.deepEqual(out(a, 'sleepMsg'), [{ type: 'sleepMsg', key: 'notSafe' }]);
  assert.ok(ENTITY_MOB.has('blaze') && ENTITY_MOB.has('wither') && !ENTITY_MOB.has('slime') && !ENTITY_MOB.has('magma_cube') && !ENTITY_MOB.has('ghast'));
  assert.equal(mobInBox([{ type: 'zombie', x: 0, y: 0, z: 0, health: 0 }], [-1, -1, -1, 1, 1, 1], ENTITY_TYPES), false, 'a dead mob does not count');
});

test('a bed another player lies in answers tile.bed.occupied; too far away is silent', () => {
  const s = fixture(), head = bedAt(s, 64, 64), a = player(s, 'a', 'Alice', 1), b = player(s, 'b', 'Bob', 2);
  s.sleep.use(a, ...head);
  s.sleep.use(b, ...head);
  assert.ok(!b.sleeping);
  assert.deepEqual(out(b, 'sleepMsg'), [{ type: 'sleepMsg', key: 'occupied' }]);
  const c = player(s, 'c', 'Cara', 3, { x: 90.5, y: 10, z: 63.5 }), head2 = bedAt(s, 70, 80);
  s.sleep.use(c, ...head2);
  assert.ok(!c.sleeping); assert.equal(out(c, 'sleepMsg').length, 0);
});

test('the click reaches the bed through the server ray (sim.edit)', () => {
  const s = fixture(); bedAt(s, 64, 64); const a = player(s, 'a', 'Alice', 1);
  a.moved = true; a.yaw = Math.PI; a.pitch = -0.4475;
  s.edit(a, true);
  assert.ok(a.sleeping);
});

test('Nether and End: the bed vanishes in a power 5 flaming blast and nobody sleeps', () => {
  const s = fixture(), head = bedAt(s, 64, 64), a = player(s, 'a', 'Alice', 1);
  s.world.dimension = -1;
  assert.equal(s.sleep.use(a, ...head), true);
  assert.ok(!a.sleeping);
  assert.equal(s.world.get(...head), 0); assert.equal(s.world.get(64, 10, 64), 0);
  assert.ok(s.dispense.fx.some(f => f.k === 'explode' && f.size === 5));
});

test('every Overworld player asleep for 100 ticks: morning, rain and thunder cleared, all woken with the spawn set', () => {
  const s = fixture(), h1 = bedAt(s, 64, 64), h2 = bedAt(s, 68, 64), a = player(s, 'a', 'Alice', 1), b = player(s, 'b', 'Bob', 2, { x: 68.5, y: 10, z: 63.5 });
  Object.assign(s.weather, { raining: true, thundering: true, rainTime: 5000, thunderTime: 4000 });
  s.sleep.use(a, ...h1);
  run(s, 120);
  assert.ok(a.sleeping && s.time >= NIGHT, 'one sleeper alone cannot skip: Bob is awake');
  s.sleep.use(b, ...h2);
  run(s, 97);
  assert.ok(a.sleeping && b.sleeping && s.time < 24000, 'not yet: Bob has lain 97 ticks');
  for (let i = 0; i < 6 && a.sleeping; i++) run(s, 1);
  assert.ok(!a.sleeping && !b.sleeping);
  assert.equal(s.time, 24001, 'WorldServer sets the whole day, then the tick adds one');
  assert.deepEqual([s.weather.raining, s.weather.thundering, s.weather.rainTime, s.weather.thunderTime], [false, false, 0, 0]);
  assert.deepEqual(a.spawnpoint, h1); assert.equal(a.spawnForced, false);
  assert.deepEqual(b.spawnpoint, h2);
  assert.equal(out(a, 'sleepWake').length, 1);
  assert.equal(s.world.getMeta(...h1) & 4, 0, 'the occupied bit is cleared');
});

test('doDaylightCycle false keeps the clock but still wakes everyone', () => {
  const s = fixture(), h = bedAt(s, 64, 64), a = player(s, 'a', 'Alice', 1);
  s.gameRules.doDaylightCycle = 'false';
  s.sleep.use(a, ...h);
  run(s, 103);
  assert.ok(!a.sleeping); assert.equal(s.time, NIGHT);
});

test('damage wakes a sleeper without setting the spawn; a leave-bed packet does set it', () => {
  const s = fixture(), h = bedAt(s, 64, 64), a = player(s, 'a', 'Alice', 1);
  s.sleep.use(a, ...h);
  a.survival.damage(2, 'a fall');
  assert.ok(!a.sleeping); assert.equal(a.spawnpoint, null);
  assert.equal(out(a, 'sleepWake').length, 1);
  s.sleep.use(a, ...h); run(s, 3);
  assert.equal(s.sleep.leave('a'), true);
  assert.ok(!a.sleeping); assert.deepEqual(a.spawnpoint, h);
  assert.equal(s.sleep.leave('a'), false, 'not sleeping: nothing to do');
});

test('creative players and spawn protection are not woken by damage; a PvP-off hit is refused', () => {
  const s = fixture(), h = bedAt(s, 64, 64), a = player(s, 'a', 'Alice', 1);
  s.sleep.use(a, ...h);
  a.survival.protection = 60; assert.equal(s.sleep.attacked(a, 'thrown'), false); assert.ok(a.sleeping);
  a.survival.protection = 0; a.survival.mode = 'creative'; assert.equal(s.sleep.attacked(a, 'thrown'), false); assert.ok(a.sleeping);
  assert.equal(s.sleep.attacked(a, 'the void'), true);
});

test('a fishing bobber (zero damage, never hooks) wakes a sleeping player and sees the lying box', () => {
  const s = fixture(), h = bedAt(s, 64, 64), a = player(s, 'a', 'Alice', 1), b = player(s, 'b', 'Bob', 2);
  s.sleep.use(a, ...h);
  const targets = s.sleep.fishTargets(b);
  assert.equal(targets.length, 1);
  assert.equal(+(targets[0].box[4] - targets[0].box[1]).toFixed(2), 0.2);
  assert.equal(s.sleep.fishHit(b, targets[0].ref.playerTarget), false);
  assert.ok(!a.sleeping);
  assert.ok(s.fishing.host(b).targets().some(t => t.ref.playerTarget === a), 'the host lists the other player');
});

test('respawn: a bed spawn is used at (x + 0.5, y + 0.1, z + 0.5); a broken bed gives tile.bed.notValid, the world spawn and no spawn point', () => {
  const s = fixture(), h = bedAt(s, 64, 64), a = player(s, 'a', 'Alice', 1);
  a.spawnpoint = h; a.spawnForced = false;
  let at = s.sleep.respawnPoint(a);
  const [cx, cy, cz] = bedSpawnSpot(s.world, ...h);
  assert.deepEqual([at.x, at.z], [cx + 0.5, cz + 0.5]); assert.equal(at.y, Math.fround(cy + 0.1));
  s.world.put(...h, 0, 0, false);
  at = s.sleep.respawnPoint(a);
  assert.deepEqual([at.x, at.y, at.z], [64.5, 10, 64.5]);
  assert.equal(a.spawnpoint, null);
  assert.deepEqual(out(a, 'sleepMsg').at(-1), { type: 'sleepMsg', key: 'notValid' });
});

test('a forced /spawnpoint survives without a bed; the death respawn goes through it', () => {
  const s = fixture(), a = player(s, 'a', 'Alice', 1);
  a.spawnpoint = [70, 10, 70]; a.spawnForced = true;
  const at = s.sleep.respawnPoint(a);
  assert.equal(at.x, 70.5); assert.equal(Math.fround(at.y), Math.fround(10.1));
  assert.deepEqual(a.spawnpoint, [70, 10, 70]);
  a.dead = true; s.serverSurvival.respawn(a);
  assert.equal(a.position.x, 70.5);
});

test('leaving the server while asleep wakes at the bed; the saved player keeps the spawn flags', () => {
  const s = fixture(), h = bedAt(s, 64, 64), a = player(s, 'a', 'Alice', 1);
  a.spawnpoint = [70, 10, 70]; a.spawnForced = true;
  s.sleep.use(a, ...h);
  s.removePlayer('a');
  assert.equal(s.world.getMeta(...h) & 4, 0);
  const saved = s.savedPlayers.get(key(1));
  assert.ok(saved.position.y < 11 && saved.position.y > 9.9);
  assert.equal(saved.spawnForced, true);
  const b = s.addPlayer('a', 'Alice', key(1));
  assert.deepEqual(b.spawnpoint, [70, 10, 70]); assert.equal(b.spawnForced, true); assert.ok(!b.sleeping);
});

test('a sleeper cannot be moved by its input; the Overworld rule ignores a player in another dimension', () => {
  const s = fixture(), h = bedAt(s, 64, 64), a = player(s, 'a', 'Alice', 1);
  s.sleep.use(a, ...h);
  const before = { ...a.position };
  a.input = { ...IDLE_INPUT, forward: true }; a.lastInput = s.ticks;
  run(s, 5);
  assert.equal(a.position.x, before.x); assert.equal(a.position.z, before.z);
  const b = player(s, 'b', 'Bob', 2); b.dimension = -1;
  assert.equal(s.sleep.overworld().length, 1);
});

test('resetRainAndThunder clears the four WorldInfo fields only; a weather owner hook is preferred', () => {
  const w = { raining: true, thundering: true, rainTime: 9, thunderTime: 9, rain: 1, thunder: 1 };
  resetRainAndThunder(w);
  assert.deepEqual(w, { raining: false, thundering: false, rainTime: 0, thunderTime: 0, rain: 1, thunder: 1 });
  let called = 0; resetRainAndThunder({ resetRainAndThunder() { called++; } }); assert.equal(called, 1);
});

test('client half: pose from the presence field, the 100 + 10 tick counter, the wake keeps the fade', () => {
  const pose = remoteSleepPose([64, 10, 65, 0]);
  const ref = new BedSleep(); ref.begin({ getMeta: () => 0 }, 64, 10, 65, { player: { x: 64, y: 10, z: 65, alive: true }, daytime: false });
  assert.deepEqual(pose, { pos: ref.pos, offset: ref.offset, facing: 0 });
  assert.equal(remoteSleepPose(null), null); assert.equal(remoteSleepPose([1, 2, 3]), null);
  assert.ok(SLEEP_TYPES.has('sleepIn') && SLEEP_TYPES.has('sleepWake') && SLEEP_TYPES.has('sleepMsg'));
  const c = new BedSleep(); c.sleeping = true;
  for (let i = 0; i < 130; i++) clientSleepTick(c);
  assert.equal(c.timer, 100);
  assert.equal(clientWake(c), true); assert.equal(c.timer, 100);
  for (let i = 0; i < 9; i++) clientSleepTick(c);
  assert.ok(c.overlay > 0);
  clientSleepTick(c); assert.equal(c.timer, 0);
  assert.equal(sleepText('nope'), null);
});
