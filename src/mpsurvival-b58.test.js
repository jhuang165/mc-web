import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT, PROTOCOL } from './multiplayer/protocol.js';
import { createDedicatedServer } from '../server/server.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const token = 'test-only-not-a-deployed-server-key', origin = 'http://localhost:5179';
const input = (hotbar = [{ id: 3 }]) => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: [...hotbar, ...Array(9 - hotbar.length).fill(null)] });
function fixture(gameMode = 'survival') {
  const world = new World('mp-survival-b58');
  for (let x = 20; x <= 110; x++) for (let z = 58; z <= 70; z++) for (let y = 9; y <= 22; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation({}, { world, gameMode });
}
// Alice at (64.5, 10, 64.5) looks along -z at the cell (64, 11, 61).
function setup(block, hotbar, gameMode) {
  const s = fixture(gameMode), a = s.addPlayer('a', 'Alice', key(1));
  a.position.copy({ x: 64.5, y: 10, z: 64.5 });
  s.input('a', input(hotbar));
  s.world.set(64, 11, 61, block);
  for (let i = 0; i < 3; i++) s.tick();
  return { s, a };
}
const breakIt = (s, a) => {
  s.queueDig('a', 0); s.tick(); s.queueDig('a', 2); s.tick();
  for (let n = 0; s.world.get(64, 11, 61) && n < 400; n++) s.tick();
};

test('a Survival break by hand drops the block as entity items (dirt); a Creative break drops nothing', () => {
  const { s } = setup(2, [], 'survival');
  assert.equal(s.itemList().length, 0);
  breakIt(s, s.players.get('a'));
  assert.equal(s.world.get(64, 11, 61), 0);
  const list = s.itemList();
  assert.equal(list.length, 1);
  assert.equal(list[0].stack.id, 2); assert.equal(list[0].stack.count, 1);
  assert.ok(list[0].x > 64 && list[0].x < 65 && list[0].z > 61 && list[0].z < 62, 'dropped inside the broken cell');
  const c = setup(2, [], 'creative');
  c.s.queueDig('a', 0); c.s.tick();
  assert.equal(c.s.world.get(64, 11, 61), 0);
  assert.equal(c.s.itemList().length, 0);
});

test('drops follow the single-player rules: stone needs a pickaxe, with one it gives item 12', () => {
  const hand = setup(3, [], 'survival');
  breakIt(hand.s, hand.a);
  assert.equal(hand.s.itemList().length, 0, 'stone by hand yields nothing');
  const pick = setup(3, [{ id: 100 }], 'survival'); // wooden pickaxe
  breakIt(pick.s, pick.a);
  assert.deepEqual(pick.s.itemList().map(i => [i.stack.id, i.stack.count]), [[12, 1]]);
});

test('items ride in the tick while they exist, once empty after, and in the snapshot', () => {
  const { s, a } = setup(2, [], 'survival');
  assert.equal(s.tick().items, undefined);
  breakIt(s, a);
  assert.equal(s.snapshot().gameMode, 'survival');
  assert.equal(s.snapshot().items.length, 1);
  const t = s.tick();
  assert.equal(t.items.length, 1);
  assert.ok(Number.isInteger(t.items[0].i) && t.items[0].i > 0);
  s.items.items[0].dead = true; s.items.reap();
  assert.deepEqual(s.tick().items, []);
  assert.equal(s.tick().items, undefined);
});

test('pickup: only after the 10 tick delay, only in reach, only for a Survival player, and the item leaves with a collect stack', () => {
  const { s, a } = setup(2, [], 'survival');
  breakIt(s, a);
  const eid = s.itemList()[0].i;
  a.position.copy({ x: 64.5, y: 10, z: 64.5 });
  s.items.items[0].delay = 5;
  s.pickup('a', [eid]);
  assert.equal(a.collectedOut, undefined, 'the pickup delay is not over');
  s.items.items[0].delay = 0;
  a.position.copy({ x: 100.5, y: 10, z: 64.5 });
  s.pickup('a', [eid]);
  assert.equal(a.collectedOut, undefined, 'out of reach');
  a.position.copy({ x: s.items.items[0].x, y: 10, z: s.items.items[0].z });
  assert.equal(s.pickup('a', [999]), false, 'an id that is not an item');
  s.pickup('a', [eid]);
  assert.deepEqual(a.collectedOut.map(t => [t.id, t.count]), [[2, 1]]);
  assert.equal(s.itemList().length, 0);
  s.pickup('a', [eid]);
  assert.equal(a.collectedOut.length, 1, 'a second request finds nothing');
  const cr = setup(3, [], 'creative'); cr.s.items.spawn({ id: 3, count: 1, damage: 0 }, 64.5, 10.2, 64.5);
  assert.equal(cr.s.pickup('a', [cr.s.items.items[0].eid]), false, 'Creative players collect through no packet');
});

test('items fall and settle on the server (EntityItem physics) and merge when they pile up', () => {
  const { s } = setup(3, [], 'survival');
  s.items.spawn({ id: 3, count: 1, damage: 0 }, 70.5, 14, 70.5, { motion: [0, 0, 0] });
  for (let i = 0; i < 40; i++) s.tick();
  const e = s.items.items.find(i => Math.abs(i.x - 70.5) < 1);
  assert.ok(e.onGround && Math.abs(e.y - 10) < 0.01, 'rests on the floor at y 10');
});

test('WebSocket path: dig messages break the block, the item shows in the tick, pickup returns a collect stack', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mc-web-mpsurvival-'));
  const sim = fixture('survival');
  sim.world.set(64, 11, 61, 2);
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
  assert.equal(welcome.world.gameMode, 'survival');
  const player = sim.players.get(welcome.id);
  player.position.copy({ x: 64.5, y: 10, z: 64.5 });
  ws.send(JSON.stringify(input([])));
  await new Promise(r => setTimeout(r, 100));
  ws.send(JSON.stringify({ type: 'dig', status: 0 }));
  await new Promise(r => setTimeout(r, 60));
  ws.send(JSON.stringify({ type: 'dig', status: 2 }));
  const withItem = await until(m => m.type === 'tick' && m.items?.length === 1, 'tick with an item');
  assert.equal(withItem.items[0].stack.id, 2);
  assert.equal(sim.world.get(64, 11, 61), 0);
  const item = sim.items.items[0];
  item.delay = 0; item.mx = item.mz = 0;
  player.position.copy({ x: item.x, y: 10, z: item.z });
  ws.send(JSON.stringify({ type: 'pickup', ids: [withItem.items[0].i] }));
  const collect = await until(m => m.type === 'collect', 'collect');
  assert.deepEqual([collect.stack.id, collect.stack.count], [2, 1]);
  ws.close();
});

// The client side: main.js drives tickPlayerMining (the single-player mining rules) and sends status 0 at the start, 2 when its progress reaches 1, 1 on an abort.
// This replays that loop against the server timer with the client's per-tick rate (the same playerMiningState), then 5 ticks of hit delay.
import { tickPlayerMining } from './player-mining.js';
import { playerMiningState } from './enchantment-effects.js';
test('a client held click: progress per tick, status 2 at progress 1, the server breaks, 5 tick delay, then the next block starts', () => {
  const { s, a } = setup(2, [{ id: 100 }], 'survival');
  const cell = [64, 11, 61], state = { playing: true, mineHeld: true, target: { block: cell, adjacent: [64, 11, 62] }, aimedEntity: false, mining: null, cooldown: 0,
    survival: a.survival, heldTool: 100, grounded: true };
  const sent = [];
  const hooks = {
    getBlock: (x, y, z) => s.world.get(x, y, z),
    edit: () => { s.queueDig('a', 0); sent.push(0); const m = { block: [...cell], type: 2, progress: 0, tool: 100, auto: false }; return { mining: m, cooldown: 0 }; },
    breakBlock: () => { s.queueDig('a', 2); sent.push(2); },
  };
  let brokeAt = -1, ticks = 0;
  for (; ticks < 100 && brokeAt < 0; ticks++) {
    tickPlayerMining(state, hooks);
    s.tick();
    if (!s.world.get(...cell)) brokeAt = ticks;
  }
  const rate = playerMiningState(a.survival, 2, 100, false, true).progress;
  assert.ok(brokeAt >= 0, 'the block broke');
  assert.deepEqual(sent, [0, 2]);
  assert.ok(brokeAt >= Math.ceil(0.7 / rate) - 2 && brokeAt <= Math.ceil(1 / rate) + 2, 'broke between the 0.7 line and damage 1');
  assert.equal(state.cooldown, 5, 'PlayerControllerMP sets blockHitDelay 5 after the break');
});

test('main.js: the multiplayer branch of movementTick still ticks a Survival dig (lead fix; it returned before tickMining)', async () => {
  const src = await readFile(new URL('./main.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('function movementTick('), src.indexOf('\n}\n', src.indexOf('function movementTick(')));
  const branch = body.split('\n').find(l => /^\s*if \(multiplayer\) \{ sendMultiplayerInput/.test(l));
  assert.ok(branch, 'the multiplayer branch exists');
  assert.match(branch, /if \(!survival\.creative\) tickMining\(\); return;/);
});
