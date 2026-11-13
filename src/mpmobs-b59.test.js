import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { RemoteMobs } from './multiplayer/remote-mobs.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
// A flat 90 x 90 stage (floor at y 9, stone), open air above; the world is the finite 128 x 128 of the dedicated server.
function fixture(gameMode = 'creative', saved = {}, options = {}) {
  const world = new World('mp-mobs-b59');
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation({ ...saved }, { world, gameMode, mobs: true, ...options });
}
const join = (s, id, n, x = 64.5, z = 64.5) => { const p = s.addPlayer(id, id + 'x', key(n)); p.position.copy({ x, y: 10, z }); p.previous.copy(p.position); s.input(id, input()); return p; };
const mob = (s, type, x, z) => { const m = s.mobs.mobs.create(type, x, 10, z); s.mobs.mobs.entities.push(m); return m; };
const quiet = s => { s.mobs.spawning = false; s.mobs.mobs.entities.length = 0; return s; };
const packets = p => { const out = p.mobPackets ?? []; p.mobPackets = null; return JSON.parse(JSON.stringify(out)); }; // as the wire carries them

test('a mob on the server world reaches the client as a copy that follows it (spawn packet, moves, round trip)', () => {
  const s = quiet(fixture()), a = join(s, 'a', 1), pig = mob(s, 'pig', 68.5, 64.5), remote = new RemoteMobs(s.world);
  for (let i = 0; i < 120; i++) { s.tick(); remote.apply(packets(a)); remote.tick(); }
  const copy = remote.copies.get(Number(pig.id.slice(4)));
  assert.ok(copy, 'the pig has a copy');
  assert.equal(copy.mob.type, 'pig');
  assert.ok(Math.hypot(copy.client.x - pig.x, copy.client.z - pig.z) < 1.5, `copy at ${copy.client.x},${copy.client.z} live ${pig.x},${pig.z}`);
  assert.equal(remote.list().length, 1);
  assert.ok(remote.clientOf(copy.mob) === copy.client);
});

test('a mob that leaves the world sends a destroy and the copy goes', () => {
  const s = quiet(fixture()), a = join(s, 'a', 1), cow = mob(s, 'cow', 66.5, 64.5), remote = new RemoteMobs(s.world);
  for (let i = 0; i < 5; i++) { s.tick(); remote.apply(packets(a)); remote.tick(); }
  assert.equal(remote.copies.size, 1);
  s.mobs.mobs.entities.splice(s.mobs.mobs.entities.indexOf(cow), 1);
  for (let i = 0; i < 3; i++) { s.tick(); remote.apply(packets(a)); remote.tick(); }
  assert.equal(remote.copies.size, 0);
});

test('state flags ride along: a sheep copy keeps its colour, a baby its size flag', () => {
  const s = quiet(fixture()), a = join(s, 'a', 1), sheep = mob(s, 'sheep', 66.5, 64.5), remote = new RemoteMobs(s.world);
  sheep.color = 5; sheep.growingAge = -24000;
  for (let i = 0; i < 3; i++) { s.tick(); remote.apply(packets(a)); }
  const c = remote.copies.get(Number(sheep.id.slice(4))).mob;
  assert.equal(c.color, 5);
  assert.ok(c.growingAge < 0);
  sheep.sheared = true; s.tick(); remote.apply(packets(a));
  assert.equal(c.sheared, true);
});

test('each mob takes the nearest player as its target', () => {
  const s = quiet(fixture('survival')), a = join(s, 'a', 1, 40.5, 64.5), b = join(s, 'b', 2, 90.5, 64.5);
  const near = mob(s, 'zombie', 88.5, 64.5), far = mob(s, 'zombie', 42.5, 64.5);
  s.mobs.target(near); assert.equal(s.mobs.mobs.ai.player, s.mobs.views.get('b').view);
  s.mobs.target(far); assert.equal(s.mobs.mobs.ai.player, s.mobs.views.get('a').view);
  assert.ok(a && b);
});

test('a player attack damages the mob with the held weapon; out of reach it does nothing', () => {
  const s = quiet(fixture()), a = join(s, 'a', 1), pig = mob(s, 'pig', 66.5, 64.5);
  s.tick();
  const before = pig.health;
  assert.ok(s.queueAttack('a', Number(pig.id.slice(4))));
  s.tick();
  assert.equal(pig.health, before - 1, 'bare hand: 1 damage');
  assert.ok(a.swing > 0);
  const far = mob(s, 'pig', 100.5, 100.5);
  s.queueAttack('a', Number(far.id.slice(4))); s.tick();
  assert.equal(far.health, 10);
  assert.equal(s.queueAttack('a', -1), false);
  assert.equal(s.queueAttack('nobody', 3), false);
});

test('a sword kills a pig in the server world and its meat drops as an item', () => {
  const s = quiet(fixture()), a = join(s, 'a', 1), pig = mob(s, 'pig', 66.5, 64.5);
  a.survival.inventory.main[0] = { id: 115, count: 1, damage: 0 }; a.survival.inventory.current = 0; // diamond sword
  s.tick();
  for (let i = 0; i < 4 && pig.health > 0; i++) { s.queueAttack('a', Number(pig.id.slice(4))); s.tick(); for (let k = 0; k < 12; k++) s.tick(); }
  assert.ok(pig.health <= 0, 'pig died');
  for (let i = 0; i < 40; i++) s.tick();
  assert.ok(!s.mobs.mobs.entities.includes(pig));
  assert.ok(s.itemList().length > 0, 'the pig dropped an item');
});

test('a mob hit on a Survival player goes through damagePlayer(player, amount, source)', () => {
  const s = quiet(fixture('survival')), a = join(s, 'a', 1), calls = [];
  s.damagePlayer = (player, amount, source) => { calls.push({ player, amount, source }); return true; };
  mob(s, 'zombie', 65.5, 64.5);
  for (let i = 0; i < 200 && !calls.length; i++) s.tick();
  assert.ok(calls.length, 'the zombie hit the player');
  assert.equal(calls[0].player, a);
  assert.ok(calls[0].amount > 0);
  assert.match(String(calls[0].source.name), /zombie/);
});

test('lead fix: a zombie hit lowers the server health (mpstate) through the real Survival.scaledDamage, and enough hits kill with a slain-by message', () => {
  const s = quiet(fixture('survival', {}, { difficulty: 2 })), a = join(s, 'a', 1);
  assert.equal(s.damagePlayer({}, 3, {}), false, 'no Survival: nothing lands');
  mob(s, 'zombie', 65.5, 64.5);
  let hurtAt = -1;
  for (let i = 0; i < 200 && hurtAt < 0; i++) { s.tick(); a.position.copy({ x: 64.5, y: 10, z: 64.5 }); if (a.survival.health < 20) hurtAt = i; }
  assert.ok(hurtAt >= 0, 'the zombie hit the player');
  assert.ok(a.survival.health <= 17, 'Normal: the zombie does its 3 (scaled) damage, health ' + a.survival.health);
  a.survival.health = 1; s.events = [];
  for (let i = 0; i < 200 && !a.dead; i++) { s.tick(); a.position.copy({ x: 64.5, y: 10, z: 64.5 }); }
  assert.ok(a.dead, 'the player died');
  const death = (s.events ?? []).find(e => e.type === 'death' && e.id === 'a');
  assert.ok(death, 'a death event');
  assert.match(JSON.stringify(death.component), /death\.attack\.mob/);
});

test('natural spawning fills the world around a player, and the saved mobs return after a restart', () => {
  const s = fixture('creative'); join(s, 'a', 1);
  s.mobs.mobs.entities.length = 0;
  s.time = 18000;
  for (let i = 0; i < 900; i++) s.tick();
  const n = s.mobs.mobs.entities.length;
  assert.ok(n > 0, 'something spawned');
  assert.ok(s.mobs.mobs.entities.every(e => ['pig', 'cow', 'sheep', 'chicken', 'zombie', 'skeleton', 'creeper', 'spider'].includes(e.type)));
  const saved = s.save();
  assert.equal(saved.mobs.length, n);
  const again = fixture('creative', JSON.parse(JSON.stringify(saved)));
  assert.equal(again.mobs.mobs.entities.length, n);
});

test('the mob tick stays well under 50 ms with 40 mobs and two players', () => {
  const s = quiet(fixture('survival')); join(s, 'a', 1, 60.5, 64.5); join(s, 'b', 2, 70.5, 64.5);
  s.mobs.spawning = true;
  const types = ['pig', 'cow', 'sheep', 'chicken', 'zombie', 'skeleton', 'creeper', 'spider'];
  for (let i = 0; i < 40; i++) mob(s, types[i % 8], 50 + (i % 10) * 3 + 0.5, 56 + Math.floor(i / 10) * 4 + 0.5);
  s.damagePlayer = () => false;
  for (let i = 0; i < 20; i++) s.tick(); // warm up
  const times = [];
  for (let i = 0; i < 100; i++) { const t = performance.now(); s.mobs.tick(); times.push(performance.now() - t); s.tick(); for (const p of s.players.values()) p.mobPackets = null; }
  times.sort((x, y) => x - y);
  const mean = times.reduce((x, y) => x + y, 0) / times.length;
  console.log(`mob tick: mean ${mean.toFixed(2)} ms, p95 ${times[94].toFixed(2)} ms, max ${times[99].toFixed(2)} ms, ${s.mobs.mobs.entities.length} mobs`);
  assert.ok(mean < 10, `mean ${mean} ms`);
  assert.ok(times[94] < 25, `p95 ${times[94]} ms`);
});
