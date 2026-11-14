// Batch 72 mpstream72: the first view-distance square streams through the tick loop (S26, five columns a tick), block changes go only to players that were sent the column,
// trackers need the column sent, an unloaded column drops the client's mob and vehicle copies, the legacy End window follows the view. Facts: .shared-memory/notes/mpstream72-b72-track.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { restoreReplica, DedicatedClient } from './multiplayer/client.js';
import { applyChunkMessage } from './multiplayer/client-chunks.js';
import { ServerChunkViews } from './multiplayer/server-chunk-view.js';
import { RemoteMobs } from './multiplayer/remote-mobs.js';
import { RemoteVehicles } from './multiplayer/remote-vehicles.js';
import { makeStack } from './inventory.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const fixture = (viewDistance, extra = {}) => {
  const world = new World('mpstream72-b72');
  world.spawn = () => ({ x: 8.5, y: 100, z: 8.5 });
  return new DedicatedSimulation({}, { world, gameMode: 'creative', mobs: false, rules: { viewDistance, ...extra } });
};
const place = (p, x, z) => { p.position.copy({ x, y: 100, z }); p.previous.copy(p.position); p.flying = true; };
const keysOf = columns => columns.map(c => `${c.x},${c.z}`);

test('join: the snapshot holds no columns; the square streams five per tick, own column first, until all 16 of view distance 3 are out', () => {
  const s = fixture(3), p = s.addPlayer('a', 'ax', key(1)); place(p, 8.5, 8.5);
  const snap = s.snapshot('a');
  assert.equal(snap.chunkView, true); assert.deepEqual(snap.columns, []);
  const replica = restoreReplica(snap);
  assert.equal(replica.absentColumns.size, 64, 'a blank world until the bulks arrive');
  const sizes = [], all = [];
  for (let i = 0; i < 8; i++) { s.tick(); for (const m of p.chunkOut ?? []) if (m.type === 'chunkBulk') { sizes.push(m.columns.length); all.push(...keysOf(m.columns)); applyChunkMessage(m, { world: replica, scene: null }); } p.chunkOut = null; }
  assert.deepEqual(sizes, [5, 5, 5, 1]);
  assert.deepEqual(all.slice(0, 3), ['0,0', '1,0', '1,1'], 'the player column first, then the spiral');
  assert.equal(new Set(all).size, 16);
  for (let x = 0; x < 4; x++) for (let z = 0; z < 4; z++) assert.deepEqual(replica.chunks.get(`${x},${z}`).blocks, s.world.chunks.get(`${x},${z}`).blocks);
  assert.equal(replica.absentColumns.size, 48);
});

test('rules.chunkStream = false keeps the square in the snapshot', () => {
  const s = fixture(3), p = s.addPlayer('a', 'ax', key(1)); s.rules.chunkStream = false; place(p, 8.5, 8.5);
  assert.equal(s.snapshot('a').columns.length, 16);
  assert.equal(s.chunkViews.sees('a', 0, 0), true); assert.equal(s.chunkViews.sees('a', 5, 5), false);
});

test('block changes, resent chunks and tile descriptions reach only players that were sent the column', () => {
  const s = fixture(3), a = s.addPlayer('a', 'ax', key(1)), b = s.addPlayer('b', 'bx', key(2));
  place(a, 8.5, 8.5); place(b, 100.5, 100.5);
  s.snapshot('a'); s.snapshot('b');
  const v = s.chunkViews; assert.equal(v.sees('a', 0, 0), false, 'nothing sent yet');
  for (let i = 0; i < 5; i++) s.tick();
  assert.equal(v.sees('a', 0, 0), true); assert.equal(v.sees('b', 0, 0), false); assert.equal(v.sees('b', 7, 7), true);
  const msg = { type: 'tick', changes: [[2, 70, 2, 1, 0], [100, 70, 100, 1, 0]], chunks: [{ x: 0, z: 0, mask: 1, runs: [] }, { x: 6, z: 6, mask: 1, runs: [] }], tiles: [{ kind: 'sign', x: 2, y: 70, z: 2 }, { kind: 'sign', x: 100, y: 70, z: 100 }] };
  const ma = v.messageFor('a', msg), mb = v.messageFor('b', msg);
  assert.deepEqual(ma.changes, [[2, 70, 2, 1, 0]]); assert.deepEqual(ma.chunks.map(c => c.x), [0]); assert.deepEqual(ma.tiles.map(t => t.x), [2]);
  assert.deepEqual(mb.changes, [[100, 70, 100, 1, 0]]); assert.deepEqual(mb.tiles.map(t => t.x), [100]);
  const none = v.messageFor('a', { type: 'tick', chunks: [{ x: 6, z: 6 }], changes: [] });
  assert.equal('chunks' in none, false, 'an empty resend list is removed');
  const same = { type: 'tick', changes: [[2, 70, 2, 1, 0]] };
  assert.equal(v.messageFor('a', same), same, 'nothing cut: the shared message object is reused');
  assert.equal(v.messageFor('nobody', msg), msg);
});

test('a column that is unloaded stops getting block changes at once', () => {
  const s = fixture(3), p = s.addPlayer('a', 'ax', key(1)); place(p, 8.5, 8.5);
  s.snapshot('a'); for (let i = 0; i < 5; i++) s.tick();
  assert.equal(s.chunkViews.sees('a', 0, 0), true);
  place(p, 8.5 + 16 * 4, 8.5); s.tick();
  assert.equal(s.chunkViews.sees('a', 0, 0), false);
  assert.deepEqual(s.chunkViews.messageFor('a', { type: 'tick', changes: [[2, 70, 2, 1, 0]] }).changes, []);
});

test('trackers: an item in a column not yet sent is not tracked; once the column is out it is listed without the player moving', () => {
  const s = fixture(4), p = s.addPlayer('a', 'ax', key(1)); place(p, 8.5, 8.5); // view 4: tracker limit 48, a 5 x 5 square streamed in five ticks
  s.snapshot('a');
  const item = s.items.spawn(makeStack(3, 1, 0), 40.5, 70.5, 40.5, { delay: 0, motion: [0, 0, 0] }); // column 2,2, 45 blocks from the player: in range
  const seen = [], sees = [];
  for (let i = 0; i < 7; i++) { const m = s.tick(); sees.push(s.chunkViews.sees('a', 2, 2)); seen.push(!!s.objectTracker.messageFor('a', m, 0).items?.some(r => r.i === item.eid)); }
  assert.equal(seen[0], false, 'first tick: the column is not out');
  assert.deepEqual(seen, sees, 'listed exactly while the column is sent');
  assert.equal(seen.at(-1), true);
});

test('trackers: a vehicle in an unsent column is not in the player vehicle packets until the column is out', () => {
  const s = fixture(4), p = s.addPlayer('a', 'ax', key(1)); place(p, 8.5, 8.5);
  s.snapshot('a');
  s.vehicles.carts.spawnCart(0, { x: 40.5, y: 70, z: 40.5, items: [] });
  const listed = [], sees = [];
  for (let i = 0; i < 7; i++) { s.tick(); sees.push(s.chunkViews.sees('a', 2, 2)); listed.push((p.vehPackets?.set?.length ?? 0) > 0 || (listed.at(-1) ?? false)); p.vehPackets = null; }
  assert.equal(listed[0], false); assert.equal(sees[0], false);
  assert.equal(listed.at(-1), true);
  assert.ok(listed.findIndex(Boolean) >= sees.findIndex(Boolean), 'never before the column was sent');
});

test('client: an unloaded column removes the mob and vehicle copies standing in it (Chunk.onChunkUnload), others stay', () => {
  const mobs = Object.create(RemoteMobs.prototype); mobs.copies = new Map([[1, { client: { x: 3, z: 3 } }], [2, { client: { x: 40, z: 3 } }]]);
  const vehicles = Object.create(RemoteVehicles.prototype); const applied = [];
  vehicles.copies = new Map([['c1', { v: { x: 5, z: 5 } }], ['b2', { v: { x: 70, z: 70 } }]]); vehicles.apply = m => applied.push(m);
  const world = { chunks: new Map([['0,0', { blocks: new Uint8Array(4), meta: new Uint8Array(4) }]]) };
  applyChunkMessage({ type: 'chunkUnload', columns: [[0, 0]] }, { world, scene: null, entities: cols => { mobs.dropColumns(cols); vehicles.dropColumns(cols); } });
  assert.deepEqual([...mobs.copies.keys()], [2]); assert.deepEqual(applied, [{ del: ['c1'] }]);
});

test('client: chunk messages of the old world are dropped when a dimRespawn arrives while loading', () => {
  const c = new DedicatedClient();
  c.buffer({ type: 'chunkBulk', columns: [] }); c.buffer({ type: 'chat', text: 'x' }); c.buffer({ type: 'dimRespawn', world: {} }); c.buffer({ type: 'chunkBulk', columns: [{ x: 1 }] });
  assert.deepEqual(c.messages.map(m => m.type), ['chat', 'dimRespawn', 'chunkBulk']);
});

test('legacy End window (origin -25 / -96) follows the view on its local grid', () => {
  const chunks = new Map(); for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) chunks.set(`${x},${z}`, { blocks: new Uint8Array(1), meta: new Uint8Array(1) });
  const world = { originX: -25, originZ: -96, chunks };
  assert.deepEqual(ServerChunkViews.limits(world), { ox: 0, oz: 0 });
  const p = { position: { x: 8, y: 50, z: 8 }, dimension: 1 };
  const sim = { rules: { chunkRadius: 3 }, players: new Map([['a', p]]), dimensions: { state: () => ({ world, tileEntities: {} }) } };
  const v = new ServerChunkViews(sim);
  assert.deepEqual(v.columnsFor('a', world), []); // streaming: nothing in the snapshot
  assert.equal(v.watches.get('a').watch.queue.length, 16, 'the 4 x 4 corner square of the local grid, not all 64');
  assert.deepEqual(v.watches.get('a').watch.queue[0], [0, 0]);
});

test('real socket join: the welcome holds no columns and the square arrives as chunkBulk messages of at most five columns', async (t) => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const os = await import('node:os'), path = await import('node:path'), { once } = await import('node:events');
  const { WebSocket } = await import('ws');
  const { createDedicatedServer } = await import('../server/server.js');
  const { PROTOCOL } = await import('./multiplayer/protocol.js');
  const token = 'test-only-not-a-deployed-server-key', origin = 'http://localhost:5179';
  const sim = fixture(3);
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mc-web-stream-'));
  const app = await createDedicatedServer({ port: 0, token, dataFile: path.join(dir, 'world.json'), simulation: sim, tickMs: 10, saveMs: 60000 });
  let ws;
  t.after(async () => { try { ws?.close(); } catch {} await app.close(); await rm(dir, { recursive: true, force: true }); });
  const session = (await app.accounts.register({ invite: token, name: 'Streamer', password: 'correct horse' }, token)).session;
  ws = new WebSocket(`ws://127.0.0.1:${app.port}/multiplayer`, { origin }); const seen = [];
  ws.on('message', d => seen.push(JSON.parse(d)));
  await once(ws, 'open'); ws.send(JSON.stringify({ type: 'join', protocol: PROTOCOL, chunks: true, session }));
  const until = async pred => { for (let i = 0; i < 600; i++) { if (pred()) return; await new Promise(r => setTimeout(r, 10)); } throw new Error('timeout'); };
  await until(() => seen.some(m => m.type === 'welcome'));
  const welcome = seen.find(m => m.type === 'welcome');
  assert.deepEqual(welcome.world.columns, []); assert.equal(welcome.world.chunkView, true);
  const bulks = () => seen.filter(m => m.type === 'chunkBulk');
  await until(() => bulks().reduce((n, m) => n + m.columns.length, 0) >= 16);
  assert.ok(bulks().every(m => m.columns.length <= 5));
  assert.equal(bulks().reduce((n, m) => n + m.columns.length, 0), 16);
  const replica = restoreReplica(welcome.world);
  for (const m of bulks()) applyChunkMessage(m, { world: replica, scene: null });
  assert.equal(replica.absentColumns.size, 48);
  assert.deepEqual(replica.chunks.get('0,0').blocks, sim.world.chunks.get('0,0').blocks);
});
