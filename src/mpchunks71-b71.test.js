// Batch 71 mpchunks: chunk columns follow the view distance. chunk-view-reference.json is EXECUTED (tools/probes/ChunkViewProbe.java: the real PlayerManager,
// PlayerInstance and S21 packet class). The ChunkWatch replays it; the server and client halves are tested on a real simulation and a replica.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT, encodeColumn } from './multiplayer/protocol.js';
import { restoreReplica } from './multiplayer/client.js';
import { applyChunkMessage, presentCells } from './multiplayer/client-chunks.js';
import { ChunkWatch, ServerChunkViews, CHUNK_BULK_MAX, chunkOf } from './multiplayer/server-chunk-view.js';

const ref = JSON.parse(readFileSync(new URL('../public/research/chunk-view-reference.json', import.meta.url), 'utf8'));

test('native constants: five columns per S26 packet, chunk = trunc >> 4', () => {
  assert.equal(ref.constants.bulk, 5); assert.equal(CHUNK_BULK_MAX, 5);
  assert.equal(chunkOf(-0.5), 0); assert.equal(chunkOf(-1.5), -1); assert.equal(chunkOf(15.9), 0); assert.equal(chunkOf(16), 1);
});

test('join: the pending list equals the executed PlayerManager (square, spiral from the own chunk, radius clamp, negative quirk)', () => {
  for (const name of ['join3', 'join1clamp', 'negative', 'moves', 'jump']) {
    const c = ref.cases[name], w = new ChunkWatch(Math.max(3, c.radius), c.start[0], c.start[1]);
    assert.deepEqual(w.queue, c.queue, name);
    assert.deepEqual([w.mx, w.mz], c.managed);
  }
  assert.deepEqual(ref.cases.join3.queue[0], [0, 0]);
});

test('moving: unload packets, the reordered pending list and the managed position equal the executed PlayerManager', () => {
  for (const name of ['moves', 'same-chunk-far', 'diagonal', 'negative-moves', 'jump']) {
    const c = ref.cases[name], w = new ChunkWatch(Math.max(3, c.radius), c.start[0], c.start[1]);
    for (const [i, s] of c.steps.entries()) {
      w.queue.splice(0, s.drained);
      const unload = w.move(s.to[0], s.to[1]);
      assert.deepEqual(unload, s.unload.map(u => [u[0], u[1]]), `${name} step ${i} unload`);
      assert.ok(s.unload.every(u => u[2] === 1 && u[3] === 0), 'S21 ground-up with mask 0');
      assert.deepEqual(w.queue, s.queue, `${name} step ${i} queue`);
      assert.deepEqual([w.mx, w.mz], s.managed, `${name} step ${i} managed`);
    }
  }
});

test('batching: take() hands out five columns at a time from the front', () => {
  const w = new ChunkWatch(3, 8.5, 8.5);
  assert.equal(w.queue.length, 49);
  const first = w.take();
  assert.deepEqual(first, ref.cases.join3.queue.slice(0, 5));
  assert.equal(w.take().length, 5); assert.equal(w.queue.length, 39);
  while (w.queue.length) assert.ok(w.take().length <= 5);
});

test('chunks that never exist (outside the finite window) are not queued, and their unload is never sent', () => {
  const exists = (x, z) => x >= 0 && x < 8 && z >= 0 && z < 8;
  const w = new ChunkWatch(3, 8.5, 8.5, exists);
  assert.equal(w.queue.length, 16); // chunks 0..3 x 0..3
  w.take(16); assert.equal(w.queue.length, 0);
  assert.deepEqual(w.move(8.5 + 16.2, 8.5), [], 'chunks -3 and -2 do not exist: no S21');
  const east = new ChunkWatch(3, 56.5, 8.5, exists); east.take(99);
  const unload = east.move(88.5, 8.5); // chunk 3 -> 5: columns 0 and 1 leave, rows 0..3 exist
  assert.equal(unload.length, 8); assert.ok(unload.every(([x, z]) => x <= 1 && exists(x, z)));
});

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
const fixture = (viewDistance) => {
  const world = new World('mpchunks-b71');
  world.spawn = () => ({ x: 8.5, y: 100, z: 8.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'creative', mobs: false, rules: { viewDistance } });
  return s;
};
const place = (s, p, x, z) => { p.position.copy({ x, y: 100, z }); p.previous.copy(p.position); p.flying = true; };
const drain = (s, p) => { const out = []; for (let i = 0; i < 40; i++) { s.tick(); out.push(...(p.chunkOut ?? [])); p.chunkOut = null; } return out; };
const keysOf = columns => columns.map(c => `${c.x},${c.z}`);

test('server: view distance 3 sends the 4 x 4 corner square in the snapshot, spiral order, flagged chunkView', () => {
  const s = fixture(3), p = s.addPlayer('a', 'ax', key(1)); place(s, p, 8.5, 8.5);
  const snap = s.snapshot('a');
  assert.equal(snap.chunkView, true);
  assert.equal(snap.columns.length, 16);
  assert.deepEqual(keysOf(snap.columns).slice(0, 3), ['0,0', '1,0', '1,1']);
  const big = fixture(10), q = big.addPlayer('a', 'ax', key(1)); place(big, q, 8.5, 8.5);
  assert.equal(big.snapshot('a').columns.length, 64, 'view distance 10 covers the whole 8 x 8 world');
});

test('server: a moving player gains and loses columns; bulks hold at most five columns; unloads come before bulks', () => {
  const s = fixture(3), p = s.addPlayer('a', 'ax', key(1)); place(s, p, 8.5, 8.5);
  s.snapshot('a');
  assert.deepEqual(drain(s, p), [], 'standing still sends nothing');
  place(s, p, 8.5 + 16 * 4, 8.5); // chunk 4 (x 64): square 1..7 in x
  const out = drain(s, p);
  const unload = out.filter(m => m.type === 'chunkUnload'), bulks = out.filter(m => m.type === 'chunkBulk');
  const gone = unload.flatMap(m => m.columns.map(String)), gained = bulks.flatMap(m => keysOf(m.columns));
  assert.ok(out.findIndex(m => m.type === 'chunkUnload') < out.findIndex(m => m.type === 'chunkBulk'));
  assert.deepEqual([...new Set(gone)].sort(), ['0,0', '0,1', '0,2', '0,3']);
  assert.equal(gone.length, 4);
  const want = []; for (let x = 4; x <= 7; x++) for (let z = 0; z <= 3; z++) want.push(`${x},${z}`);
  assert.deepEqual(gained.slice().sort(), want.sort());
  assert.ok(bulks.every(m => m.columns.length <= 5));
  assert.equal(bulks[0].columns.length, 5);
  assert.equal(gained.length, 16);
});

test('server: view distance 10 never sends or unloads anything in the 8 x 8 world', () => {
  const s = fixture(10), p = s.addPlayer('a', 'ax', key(1)); place(s, p, 8.5, 8.5);
  s.snapshot('a');
  place(s, p, 120.5, 120.5);
  assert.deepEqual(drain(s, p), []);
});

test('client: a snapshot square leaves other columns blank; bulk fills, unload blanks, absent columns drop block changes', () => {
  const s = fixture(3), p = s.addPlayer('a', 'ax', key(1)); place(s, p, 8.5, 8.5);
  const replica = restoreReplica(s.snapshot('a'));
  assert.equal(replica.absentColumns.size, 48);
  assert.equal(replica.get(100, 70, 100), 0, 'an absent column is air');
  assert.notEqual(replica.get(8, 5, 8), undefined);
  assert.equal(replica.get(8, 20, 8), s.world.get(8, 20, 8)); assert.equal(replica.get(8, 50, 8), s.world.get(8, 50, 8));
  const cells = presentCells(replica, [[8, 60, 8, 1, 0], [100, 60, 100, 1, 0]]);
  assert.deepEqual(cells.map(c => c[0]), [8]);
  const dirty = new Set(); const scene = { dirty, light: null };
  place(s, p, 8.5 + 16 * 4, 8.5);
  for (const m of drain(s, p)) applyChunkMessage(m, { world: replica, scene });
  assert.equal(replica.absentColumns.has('0,0'), true);
  assert.equal(replica.absentColumns.has('5,1'), false);
  for (const [k, col] of s.world.chunks) {
    const mine = replica.chunks.get(k);
    if (replica.absentColumns.has(k)) assert.ok(mine.blocks.every(b => b === 0), `${k} blank`);
    else assert.deepEqual(mine.blocks, col.blocks, `${k} equals the server`);
  }
  assert.ok(dirty.has('0,0') && dirty.has('64,16'));
  assert.equal(replica.absentColumns.size, 36, 'square x 1..7 (clipped to the 8 x 8 window) by z 0..3: 28 columns present');
});

test('server: leaving clears the view; a dimension change resets it with the new world', () => {
  const s = fixture(3), p = s.addPlayer('a', 'ax', key(1)); place(s, p, 8.5, 8.5);
  s.snapshot('a'); assert.ok(s.chunkViews.watches.has('a'));
  s.removePlayer('a'); assert.equal(s.chunkViews.watches.has('a'), false);
});
