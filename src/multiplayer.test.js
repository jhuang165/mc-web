import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { World, WorldChunk, WATER } from './world.js';
import { tickWorldSystems } from './world-tick.js';
import { encodeColumn, decodeColumn, cleanInput, cleanLook, serverUrl, IDLE_INPUT, PROTOCOL } from './multiplayer/protocol.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { createDedicatedServer } from '../server/server.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const token = 'test-only-not-a-deployed-server-key';
const origin = 'http://localhost:5179';
const input = (extra = {}) => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0,
  hotbar: [{ id: 3 }, ...Array(8).fill(null)], ...extra });
function fixture() {
  const world = new World('dedicated-test');
  for (let x = 58; x <= 70; x++) for (let z = 58; z <= 70; z++)
    for (let y = 9; y <= 22; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation({}, { world });
}
function inbox(ws) {
  const messages = [], waiting = [];
  ws.on('message', data => {
    const m = JSON.parse(data);
    const index = waiting.findIndex(w => w.predicate(m));
    if (index < 0) messages.push(m);
    else { const [w] = waiting.splice(index, 1); clearTimeout(w.timer); w.resolve(m); }
  });
  return predicate => {
    const index = messages.findIndex(predicate);
    if (index >= 0) return Promise.resolve(messages.splice(index, 1)[0]);
    return new Promise((resolve, reject) => {
      const w = { predicate, resolve, timer: setTimeout(() => reject(new Error('Timed out waiting for server packet')), 5000) };
      waiting.push(w);
    });
  };
}
test('column codec preserves every id/metadata cell and rejects corrupt runs', () => {
  const column = new WorldChunk(1, 2, 64), decoded = new WorldChunk(1, 2, 64);
  for (let i = 0; i < column.blocks.length; i++) { column.blocks[i] = i % 179; column.meta[i] = (i >> 4) % 16; }
  decodeColumn(encodeColumn(column), decoded); assert.deepEqual(decoded.blocks, column.blocks); assert.deepEqual(decoded.meta, column.meta);
  for (const runs of [[1], [1, -1], [4096, 3], [1, 1], [1, column.blocks.length + 1]])
    assert.throws(() => decodeColumn({ runs }, decoded));
  assert.equal(cleanInput({ ...IDLE_INPUT, forward: Infinity }), null);
  assert.equal(cleanLook(NaN, 0), null);
  assert.equal(cleanLook(0, 100).pitch, Math.PI / 2);
  assert.throws(() => serverUrl('ws://localhost:8089', 'https:'));
  assert.throws(() => serverUrl('https://example.com', 'http:'));
});
test('shared world segment preserves block, hopper, brewing, redstone order', () => {
  const seen = [], tick = name => ({ tick: () => { seen.push(name); return []; } });
  tickWorldSystems({ farming: tick('farm'), fluids: tick('fluid'), fire: tick('fire'), hoppers: tick('hopper'), brewing: () => seen.push('brew'), redstone: tick('redstone') },
    { time: 1, daylight: 1, x: 0, z: 0 }, { farming: () => seen.push('observe farm'), fluids: () => seen.push('observe fluid'), fire: () => seen.push('observe fire') });
  assert.deepEqual(seen, ['farm', 'observe farm', 'fluid', 'observe fluid', 'fire', 'observe fire', 'hopper', 'brew', 'redstone']);
});
test('dedicated authority moves players, validates edits against its own ray, stops stale input, ticks without players', () => {
  const s = fixture(), p = s.addPlayer('alice', 'Alice', key(1)), q = s.addPlayer('bob', 'Bob', key(2));
  q.position.x += 4;
  assert.throws(() => s.addPlayer('dup', 'alice', key(3)));
  assert.throws(() => s.addPlayer('dup', 'Other', key(1)));
  assert.equal(s.input('alice', input({ controls: { ...IDLE_INPUT, strafe: 1 } })), true);
  const start = p.position.x;
  for (let i = 0; i < 8; i++) s.tick();
  assert.ok(p.position.x > start);
  for (let i = 0; i < 40; i++) s.tick();
  const stopped = p.position.x;
  for (let i = 0; i < 10; i++) s.tick();
  assert.equal(p.position.x, stopped);
  assert.equal(s.input('alice', input({ current: 99 })), false);
  p.position.copy({ x: 64.5, y: 10, z: 64.5 });
  s.world.set(64, 11, 61, 3);
  s.input('alice', input());
  s.queueEdit('alice', { place: true, target: [1, 1, 1] });
  const placed = s.tick();
  assert.equal(s.world.get(64, 11, 62), 3, 'normal placement path follows the server ray');
  assert.ok(placed.changes.some(c => c[0] === 64 && c[1] === 11 && c[2] === 62 && c[3] === 3));
  s.queueEdit('alice', { place: false }); s.tick();
  assert.equal(s.world.get(64, 11, 62), 0);
  s.world.put(63, 12, 63, WATER, 0, false);
  assert.ok(s.tick().changes.some(c => c[0] === 63 && c[1] === 12 && c[2] === 63 && c[3] === WATER), 'untracked writes are broadcast');
  s.removePlayer('alice'); s.removePlayer('bob');
  const time = s.time; for (let i = 0; i < 20; i++) s.tick();
  assert.equal(s.time, time + 20);
  const rejoined = s.addPlayer('new-id', 'Alice', key(1)); assert.equal(rejoined.position.x, p.position.x);
});
test('two WebSocket clients share authority, chat and departure; saves survive closing every tab and a restart', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mc-web-dedicated-')), dataFile = path.join(dir, 'world.json');
  const app = await createDedicatedServer({ port: 0, token, dataFile, simulation: fixture(), tickMs: 10, saveMs: 60000 });
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const connect = async (name, n, override = {}) => {
    const ws = new WebSocket(`ws://127.0.0.1:${app.port}/multiplayer`, { origin });
    const next = inbox(ws); await once(ws, 'open');
    ws.send(JSON.stringify({ type: 'join', protocol: PROTOCOL, token, name, resumeKey: key(n), ...override }));
    return { ws, next };
  };
  const bad = await connect('Rejected', 9, { token: 'wrong' });
  const [badCode] = await once(bad.ws, 'close'); assert.equal(badCode, 1008);
  const alice = await connect('Alice', 1), bob = await connect('Bob', 2);
  const a = await alice.next(m => m.type === 'welcome'), b = await bob.next(m => m.type === 'welcome');
  assert.equal(a.world.columns.length, 64); assert.equal(b.world.players.length, 2);
  alice.ws.send(JSON.stringify({ type: 'chat', text: 'hello Bob' }));
  assert.equal((await bob.next(m => m.type === 'chat' && m.text === 'hello Bob')).name, 'Alice');
  app.simulation.world.set(64, 11, 61, 3);
  alice.ws.send(JSON.stringify(input())); alice.ws.send(JSON.stringify({ type: 'edit', place: true }));
  const update = await bob.next(m => m.type === 'tick' && m.changes.some(c => c[0] === 64 && c[1] === 11 && c[2] === 62 && c[3] === 3));
  assert.ok(update.players.some(p => p.id === a.id));
  alice.ws.close(); await once(alice.ws, 'close');
  await bob.next(m => m.type === 'chat' && m.text === 'Alice left the game');
  bob.ws.close(); await once(bob.ws, 'close');
  await app.save();
  const saved = JSON.parse(await readFile(dataFile, 'utf8'));
  const restored = new DedicatedSimulation(saved);
  assert.equal(restored.world.get(64, 11, 62), 3);
  assert.equal(restored.time, saved.time);
  assert.equal(restored.savedPlayers.size, 2);
  const tick = app.simulation.ticks;
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.ok(app.simulation.ticks > tick, 'the last browser leaving does not stop the world');
  const forbidden = new WebSocket(`ws://127.0.0.1:${app.port}/multiplayer`, { origin: 'https://untrusted.example' });
  const error = await once(forbidden, 'error'); assert.match(error[0].message, /403/);
});
