import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { World } from './world.js';
import { IDLE_INPUT, PROTOCOL, splitChanges, chunkPacketCells } from './multiplayer/protocol.js';
import { expandChunks } from './multiplayer/client.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { createDedicatedServer } from '../server/server.js';

const token = 'test-only-not-a-deployed-server-key', origin = 'http://localhost:5179';
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: -Math.PI / 2, current: 0, hotbar: [{ id: 3 }, ...Array(8).fill(null)] });
function inbox(ws) {
  const seen = [], waiting = [];
  ws.on('message', data => {
    const m = JSON.parse(data), i = waiting.findIndex(w => w.predicate(m));
    if (i < 0) seen.push(m); else { const [w] = waiting.splice(i, 1); clearTimeout(w.timer); w.resolve(m); }
  });
  const next = predicate => {
    const i = seen.findIndex(predicate);
    if (i >= 0) return Promise.resolve(seen.splice(i, 1)[0]);
    return new Promise((resolve, reject) => waiting.push({ predicate, resolve, timer: setTimeout(() => reject(new Error('Timed out waiting for server packet')), 5000) }));
  };
  next.seen = seen;
  return next;
}

test('a live WebSocket placement refused for the build height gets the native chat line and both cells resent to the clicker only', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mc-web-refusal-'));
  const simulation = new DedicatedSimulation({ seed: 'refusal-test', biome: 'java', generationVersion: 9 });
  assert.equal(simulation.world.height, 256);
  const app = await createDedicatedServer({ port: 0, token, dataFile: path.join(dir, 'world.json'), simulation, tickMs: 10, saveMs: 60000 });
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const connect = async name => {
    const { session } = await app.accounts.register({ invite: token, name, password: 'correct horse' }, token);
    const ws = new WebSocket(`ws://127.0.0.1:${app.port}/multiplayer`, { origin }), next = inbox(ws);
    await once(ws, 'open');
    ws.send(JSON.stringify({ type: 'join', protocol: PROTOCOL, session }));
    return { ws, next, welcome: await next(m => m.type === 'welcome') };
  };
  const alice = await connect('Alice'), bob = await connect('Bob');
  const world = simulation.world;
  world.put(64, 255, 64, 3, 0, false);
  const pose = (id, y) => { const p = simulation.players.get(id); p.position.copy({ x: 64.5, y, z: 64.5 }); p.previous.copy(p.position); p.flying = true; p.pitch = -Math.PI / 2; };

  // C08 without a first position (hasMoved false): refused with no chat line, both cells resent.
  pose(alice.welcome.id, 257);
  alice.ws.send(JSON.stringify({ type: 'edit', place: true }));
  const first = await alice.next(m => m.type === 'blocks');
  assert.deepEqual(first.changes, [[64, 255, 64, 3, 0], [64, 256, 64, 0, 0]]);
  assert.equal(world.get(64, 256, 64), 0);

  // C08 on the top face of y 255: "Height limit for building is 256 blocks", then the same two cells.
  alice.ws.send(JSON.stringify(input()));
  await alice.next(m => m.type === 'tick');
  pose(alice.welcome.id, 257);
  alice.ws.send(JSON.stringify({ type: 'edit', place: true }));
  const chat = await alice.next(m => m.type === 'chat' && m.text.startsWith('Height'));
  assert.deepEqual([chat.name, chat.text], ['', 'Height limit for building is 256 blocks']);
  const second = await alice.next(m => m.type === 'blocks');
  assert.deepEqual(second.changes, [[64, 255, 64, 3, 0], [64, 256, 64, 0, 0]]);
  assert.equal(world.get(64, 256, 64), 0, 'nothing was placed');
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(bob.next.seen.some(m => m.type === 'blocks' || (m.type === 'chat' && m.text.startsWith('Height'))), false, 'the other player gets neither');
  // The dig of the same block (C07, within 6 blocks and below 256) is accepted; a refused dig is silent natively (no chat, no resend).
  pose(alice.welcome.id, 257);
  alice.ws.send(JSON.stringify({ type: 'edit', place: false }));
  await bob.next(m => m.type === 'tick' && m.changes.some(c => c[0] === 64 && c[1] === 255 && c[2] === 64 && c[3] === 0));
  alice.ws.close(); bob.ws.close();
});

test('a chunk with 63 changed cells goes as cells, 64 or more as one chunk packet (PlayerInstance.sendChunkUpdate)', () => {
  const world = new World('chunk-resend', 'java', 9), column = (cx, cz) => world.chunks.get(`${cx},${cz}`);
  const line = n => Array.from({ length: n }, (_, i) => [i % 16, 70 + (i >> 4), 5, 3, 0]); // distinct cells: 16 per row, rows rise
  for (const [n, chunkPackets] of [[1, 0], [2, 0], [63, 0], [64, 1], [65, 1]]) {
    const changes = line(n);
    for (const [x, y, z, id] of changes) world.put(x, y, z, id, 0, false);
    const out = splitChanges(changes, column);
    assert.equal(out.chunks.length, chunkPackets, `${n} changes`);
    assert.equal(out.changes.length, chunkPackets ? 0 : n);
    if (chunkPackets) {
      const [packet] = out.chunks;
      assert.deepEqual([packet.x, packet.z], [0, 0]);
      const mask = changes.reduce((m, c) => m | 1 << (c[1] >> 4), 0);
      assert.equal(packet.mask, mask);
      const resent = chunkPacketCells(packet);
      assert.ok(resent.length >= n && resent.every(c => packet.mask >> (c[1] >> 4) & 1), 'only the changed sections');
      for (const c of changes) assert.ok(resent.some(r => r.join() === c.join()), 'every change is in the chunk');
      assert.deepEqual(expandChunks({ changes: [], chunks: out.chunks }).changes, resent);
    }
    for (const [x, y, z] of changes) world.put(x, y, z, 0, 0, false);
  }
});

test('the 64 count is per chunk and per distinct cell: 40 + 40 in two chunks, or the same cell twice, stay as cells', () => {
  const world = new World('chunk-resend2', 'java', 9), column = (cx, cz) => world.chunks.get(`${cx},${cz}`);
  const row = (ox, n) => Array.from({ length: n }, (_, i) => [ox + (i % 16), 70 + (i >> 4), 5, 3, 0]);
  const two = splitChanges([...row(0, 40), ...row(16, 40)], column);
  assert.deepEqual([two.chunks.length, two.changes.length], [0, 80]);
  const repeated = splitChanges([...row(0, 63), ...row(0, 63)], column);
  assert.deepEqual([repeated.chunks.length, repeated.changes.length], [0, 63]);
  const mixed = splitChanges([...row(0, 64), ...row(16, 5)], column);
  assert.deepEqual([mixed.chunks.length, mixed.changes.length], [1, 5]);
});

test('a dedicated tick with 64 changes in one chunk sends the chunk packet and the replica ends identical', () => {
  const s = new DedicatedSimulation({ seed: 'chunk-tick', biome: 'java', generationVersion: 9 });
  const w = s.world;
  for (let i = 0; i < 64; i++) w.put(i % 16, 100 + (i >> 4), 3, 3, 0);
  const tick = s.tick();
  assert.equal(tick.chunks.length, 1);
  assert.equal(tick.changes.filter(c => c[0] < 16 && c[2] < 16).length, 0);
  const cells = expandChunks(tick).changes;
  assert.ok(cells.some(c => c[0] === 5 && c[1] === 101 && c[2] === 3 && c[3] === 3));
  for (let i = 0; i < 63; i++) w.put(i % 16, 120 + (i >> 4), 3, 3, 0);
  const small = s.tick();
  assert.equal(small.chunks, undefined);
  assert.equal(small.changes.length, 63);
});
