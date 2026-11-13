import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { World } from './world.js';
import { Survival } from './survival.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { applyHealthMessage } from './multiplayer/server-survival.js';
import { IDLE_INPUT, PROTOCOL } from './multiplayer/protocol.js';
import { ServerSocial } from './server-broadcast.js';
import { serializeComponent } from './chat-component.js';
import { createDedicatedServer } from '../server/server.js';
const seed = (s, id, message) => { s.serverItems.adopt(s.players.get(id), message, true); return s.input(id, message); }; // b61: a Survival server ignores the client's hotbar mirror; tests seed the inventory

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const token = 'test-only-not-a-deployed-server-key', origin = 'http://localhost:5179';
const input = (hotbar = []) => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: [...hotbar, ...Array(9 - hotbar.length).fill(null)] });
function fixture(opts = {}) {
  const world = new World('mp-state-b59');
  for (let x = 20; x <= 110; x++) for (let z = 58; z <= 70; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation({}, { world, gameMode: 'survival', ...opts });
}
function joined(opts, hotbar = []) {
  const s = fixture(opts), a = s.addPlayer('a', 'Alice', key(1));
  a.position.copy({ x: 64.5, y: 10, z: 64.5 });
  seed(s, 'a', input(hotbar));
  for (let i = 0; i < 3; i++) s.tick();
  return { s, a };
}
const run = (s, n) => { for (let i = 0; i < n; i++) s.tick(); };

test('a fall from 15 blocks costs ceil(15 - 3) = 12 hearts points, from the server own fallDistance', () => {
  const { s, a } = joined();
  a.survival.protection = 0;
  a.position.copy({ x: 64.5, y: 25, z: 64.5 });
  run(s, 60);
  assert.ok(a.grounded);
  assert.equal(a.survival.health, 8);
  assert.equal(a.survival.lastDamage, 'a fall');
});

test('a short fall of 3 blocks costs nothing; a Creative player takes no fall damage', () => {
  const { s, a } = joined();
  a.survival.protection = 0;
  a.position.copy({ x: 64.5, y: 13, z: 64.5 });
  run(s, 40);
  assert.equal(a.survival.health, 20);
  const c = joined({ }); c.a.survival.mode = 'creative'; c.a.position.copy({ x: 64.5, y: 30, z: 64.5 }); run(c.s, 60);
  assert.equal(c.a.survival.health, 20);
});

test('the void: 4 damage per hurt window below y -64, then the death broadcast names outOfWorld; the dead player is held and may respawn', () => {
  const { s, a } = joined();
  a.survival.protection = 0;
  a.position.copy({ x: 30.5, y: -66, z: 64.5 }); // outside the floor
  const sent = [];
  const social = new ServerSocial({ simulation: s, deliver: (id, m) => sent.push([id, m]) });
  run(s, 80);
  assert.equal(a.survival.health, 0);
  assert.ok(a.dead);
  assert.equal(social.drain(), 1);
  const death = sent.find(([, m]) => m.type === 'chat');
  assert.match(death[1].json, /death\.attack\.outOfWorld/);
  assert.match(death[1].json, /Alice/);
  // dead players ignore actions and do not heal
  run(s, 200);
  assert.equal(a.survival.health, 0);
  const status = s.serverSurvival.status(a);
  assert.equal(status.health, 0);
  assert.equal(s.serverSurvival.respawn(a), true);
  assert.equal(a.survival.health, 20); assert.equal(a.survival.food, 20); assert.equal(a.dead, false);
  assert.deepEqual([a.position.x, a.position.y, a.position.z], [64.5, 10, 64.5]);
  assert.equal(s.serverSurvival.status(a).health, 20);
  assert.equal(s.serverSurvival.respawn(a), false);
});

test('a fall that kills uses the CombatTracker fall message', () => {
  const { s, a } = joined();
  a.survival.protection = 0; a.survival.health = 5;
  a.position.copy({ x: 64.5, y: 35, z: 64.5 });
  run(s, 80);
  assert.equal(a.survival.health, 0);
  const e = s.events.find(x => x.type === 'death');
  assert.match(serializeComponent(e.component), /death\.fell\.accident|death\.attack\.fall/);
});

test('natural regeneration: food 18+ heals 1 every 80 ticks and adds 3 exhaustion', () => {
  const { s, a } = joined();
  a.survival.protection = 0; a.survival.health = 10; a.survival.exhaustion = 0; a.survival.timer = 0;
  run(s, 79); assert.equal(a.survival.health, 10);
  run(s, 1); assert.equal(a.survival.health, 11);
  assert.ok(a.survival.exhaustion >= 3 - 1e-6);
});

test('starvation at food 0 by difficulty: Easy stops at 10, Normal at 1, Hard kills; Peaceful never loses food', () => {
  const end = difficulty => {
    const { s, a } = joined({ difficulty });
    a.survival.protection = 0; a.survival.food = 0; a.survival.saturation = 0; a.survival.health = 12; a.survival.timer = 0;
    run(s, 80 * 14);
    return a.survival.health;
  };
  assert.equal(end(1), 10);
  assert.equal(end(2), 1);
  assert.equal(end(3), 0);
  const peace = joined({ difficulty: 0 });
  Object.assign(peace.a.survival, { protection: 0, saturation: 0, exhaustion: 20, health: 12 });
  run(peace.s, 20);
  assert.equal(peace.a.survival.food, 20, 'Peaceful: exhaustion drains saturation but never food');
  assert.equal(peace.a.survival.health, 13, 'Peaceful heals 1 every 20 ticks');
});

test('exhaustion from walking takes saturation then food (FoodStats.onUpdate)', () => {
  const { s, a } = joined();
  a.survival.protection = 0; a.survival.saturation = 0; a.survival.exhaustion = 4.5; a.survival.food = 20;
  run(s, 1);
  assert.equal(a.survival.food, 19);
  assert.ok(Math.abs(a.survival.exhaustion - 0.5) < 1e-5);
});

test('eating an apple to the end adds 4 food and 4 * 0.3 * 2 saturation and reports it', () => {
  const { s, a } = joined({}, [{ id: 200 }]);
  a.survival.food = 10; a.survival.saturation = 0; a.survival.exhaustion = 0;
  s.status?.(a);
  s.serverSurvival.status(a); // drain the first message
  s.queueUse('a', true);
  run(s, 40);
  assert.equal(a.survival.food, 14);
  assert.ok(Math.abs(a.survival.saturation - 2.4) < 1e-5);
  assert.equal(a.itemInUse, null);
  const m = s.serverSurvival.status(a);
  assert.deepEqual([m.type, m.food, m.ate], ['health', 14, undefined]);
  // lead fix (b59 merge with mpitems): the server's inventory spent the apple and corrects the client's slot; the S06 message carries no eaten item
  assert.ok(a.itemsOut.some(o => o.type === 'slot' && o.slots.some(x => x.slot === 0 && (x.stack?.count ?? 0) === (a.survival.inventory.main[0]?.count ?? 0))));
  assert.equal(s.serverSurvival.status(a), null, 'sent once');
});

test('a full stomach does not start eating; a Creative player never eats', () => {
  const { s, a } = joined({}, [{ id: 200 }]);
  s.queueUse('a', true); run(s, 3);
  assert.equal(a.itemInUse, null);
});

test('vitals are saved and restored with the player record', () => {
  const { s, a } = joined();
  a.survival.health = 7; a.survival.food = 9; a.survival.saturation = 1.5;
  const saved = s.savePlayer(a);
  assert.equal(saved.player.health, 7);
  const back = new Survival(saved.player, 'survival');
  assert.deepEqual([back.health, back.food, back.saturation], [7, 9, 1.5]);
});

test('the client applies an S06 message to its Survival and reports a death (lead fix: no eaten item)', () => {
  const sv = new Survival({}, 'survival');
  sv.inventory.main[0] = { id: 200, count: 3, damage: 0 }; sv.inventory.current = 0;
  assert.deepEqual(applyHealthMessage(sv, { health: 6.5, food: 11, saturation: 3, ate: 200 }), { died: false, hotbar: false });
  assert.deepEqual([sv.health, sv.food, sv.saturation, sv.inventory.main[0].count], [6.5, 11, 3, 3], 'the client takes nothing: the slot correction does');
  assert.equal(applyHealthMessage(sv, { health: 0, food: 11, saturation: 3 }).died, true);
  assert.deepEqual(applyHealthMessage(sv, { health: NaN, food: 1, saturation: 1 }), { died: false, hotbar: false });
  assert.equal(sv.health, 0);
});

test('WebSocket path: the client gets S06 on join and after a fall, and a respawn message revives it', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mc-web-mpstate-'));
  const sim = fixture();
  const app = await createDedicatedServer({ port: 0, token, dataFile: path.join(dir, 'world.json'), simulation: sim, tickMs: 10, saveMs: 60000 });
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const session = (await app.accounts.register({ invite: token, name: 'Alice', password: 'correct horse' }, token)).session;
  const ws = new WebSocket(`ws://127.0.0.1:${app.port}/multiplayer`, { origin });
  const seen = [];
  ws.on('message', d => seen.push(JSON.parse(d)));
  await once(ws, 'open');
  ws.send(JSON.stringify({ type: 'join', protocol: PROTOCOL, session }));
  const until = async (pred, label) => { for (let i = 0; i < 500; i++) { const m = seen.find(pred); if (m) return m; await new Promise(r => setTimeout(r, 10)); } throw new Error('timeout: ' + label); };
  const welcome = await until(m => m.type === 'welcome', 'welcome');
  const first = await until(m => m.type === 'health', 'first health');
  assert.deepEqual([first.health, first.food], [20, 20]);
  const p = sim.players.get(welcome.id);
  ws.send(JSON.stringify(input()));
  await new Promise(r => setTimeout(r, 60));
  p.survival.protection = 0;
  p.position.copy({ x: 64.5, y: 25, z: 64.5 });
  const hurt = await until(m => m.type === 'health' && m.health < 20, 'health after the fall');
  assert.equal(hurt.health, 8);
  p.survival.damage(100, 'a fall'); p.survival.hurtTicks = 0; p.survival.damage(100, 'a fall');
  await until(m => m.type === 'health' && m.health === 0, 'death health');
  await until(m => m.type === 'chat' && m.json?.includes('death.'), 'death chat');
  ws.send(JSON.stringify({ type: 'respawn' }));
  await until(m => m.type === 'health' && m.health === 20 && seen.indexOf(m) > seen.findIndex(x => x.health === 0), 'respawned');
  ws.close();
});
