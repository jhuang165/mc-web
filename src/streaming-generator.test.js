import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { populationBlockMapperReady } from './population-world.js';
import { StreamPrefetch, createStreamWorker, RING_IDLE_TICKS } from './streaming-generator.js';

await populationBlockMapperReady;
const silence = (w) => { w.blockLight = () => 0; return w; };
// The worker protocol in-process: messages are structured-cloned with their transfer lists, as
// postMessage does, and answered when the test flushes.
function port() {
  let handle = null;
  const p = {
    posted: [], onmessage: null, onerror: null, terminated: false,
    postMessage(message) { p.posted.push(structuredClone(message)); },
    terminate() { p.terminated = true; },
    async flush() {
      while (p.posted.length) {
        const m = p.posted.shift();
        if (m.type === 'init') { handle = await createStreamWorker(m); continue; }
        const { message, transfer } = handle(m);
        p.onmessage?.({ data: structuredClone(message, { transfer }) });
      }
    },
  };
  return p;
}
const resident = (w) => [...w.chunks.values()].map((c) => [c.x, c.z, Buffer.from(c.blocks).toString('base64'), Buffer.from(c.meta).toString('base64')]).sort();

test('worker-built population cells equal synchronous ones and spare the main thread', async () => {
  const w = silence(new World('17', 'javaStreamed', 13)), reference = silence(new World('17', 'javaStreamed', 13));
  const p = port(), prefetch = new StreamPrefetch(w, p, { margin: 0 });
  assert.equal(p.posted[0].type, 'init');
  assert.equal(prefetch.ready(64, 64), true, 'the first square is resident');
  assert.equal(prefetch.ready(128, 64), false, 'cell 1,0 is not built yet');
  prefetch.update(128, 64);
  assert.deepEqual(p.posted.slice(1), [{ type: 'cell', x: 1, z: 0 }]);
  prefetch.update(128, 64);
  assert.equal(p.posted.length, 2, 'a pending cell is requested once');
  await p.flush();
  assert.equal(prefetch.received, 1);
  assert.equal(prefetch.ready(128, 64), true);
  const generated = w.population.generated;
  assert.ok(w.streamAround(128, 64));
  assert.equal(w.population.generated, generated, 'no cell was generated on the main thread');
  assert.ok(reference.streamAround(128, 64));
  assert.deepEqual(resident(w), resident(reference), 'columns');
  assert.deepEqual(w.claimFreshColumns(), reference.claimFreshColumns(), 'population records');
  // A cell the page already built is not replaced by a late worker copy.
  const own = w.population.cell(1, 0);
  assert.equal(w.population.adopt({ ...own, columns: new Map() }), false);
  assert.equal(w.population.cell(1, 0), own);
  prefetch.dispose();
  assert.ok(p.terminated);
});

test('generation-12 columns come from the worker once and match synchronous terrain', async () => {
  const w = silence(new World('17', 'javaStreamed', 12)), reference = silence(new World('17', 'javaStreamed', 12));
  const p = port(), prefetch = new StreamPrefetch(w, p, { margin: 1, inFlight: 4 });
  // Margin 1 around the square for x = 80 (columns 1..8 x 0..7): 0..9 x -1..8, minus the resident 0..7 x 0..7.
  for (let i = 0; i < 40; i++) { prefetch.update(80, 64); await p.flush(); }
  assert.equal(w.pregenerated.size, 10 * 10 - 64);
  assert.equal(prefetch.ready(80, 64), true);
  assert.ok(w.streamAround(80, 64) && reference.streamAround(80, 64));
  assert.deepEqual(resident(w), resident(reference));
  assert.equal(w.pregenerated.has('8,0'), false, 'a used column leaves the cache');
  // Moving away trims columns that are no longer near the square.
  prefetch.update(-400, 64);
  assert.equal(w.pregenerated.size, 0);
});

test('a failed worker stops prefetching and never holds the world back', async () => {
  const w = silence(new World('17', 'javaStreamed', 12)), p = port(), prefetch = new StreamPrefetch(w, p);
  const errors = [], error = console.error;
  console.error = (m) => errors.push(m);
  try { p.onerror({ message: 'boom' }); } finally { console.error = error; }
  assert.equal(prefetch.failed, 'boom');
  assert.equal(errors.length, 1);
  assert.equal(prefetch.ready(400, 400), true);
  prefetch.update(400, 400);
  assert.equal(p.posted.length, 1, 'only the init message');
  // Error replies from the worker fail the same way.
  const q = port(), other = new StreamPrefetch(w, q);
  console.error = () => {};
  try { q.onmessage({ data: { type: 'error', message: 'bad cell' } }); } finally { console.error = error; }
  assert.equal(other.failed, 'bad cell');
});

// Batch 28: Nether/End columns and their ring come from workers.
import { DimensionWorld } from './dimension-world.js';
import { HeadlessColumns } from './headless-columns.js';

test('dimension workers build the same Nether and End columns as the page, with the fortress records', async () => {
  for (const dim of [-1, 1]) {
    const page = new DimensionWorld('28', dim), p = port(), prefetch = new StreamPrefetch(page, p, { margin: 0 });
    assert.equal(p.posted[0].dimension, dim);
    const reference = new DimensionWorld('28', dim);
    prefetch.update(8, 8);
    assert.deepEqual(p.posted.slice(1), [{ type: 'column', x: 0, z: 0 }].slice(0, 1), 'the window is requested one column at a time');
    await p.flush();
    assert.ok(page.pregenerated.has('0,0'));
    const want = reference.generateTerrainChunk(0, 0), got = page.pregenerated.get('0,0');
    assert.deepEqual(Buffer.from(got.blocks), Buffer.from(want.blocks), `dimension ${dim} blocks`);
    assert.deepEqual(Buffer.from(got.metadata), Buffer.from(want.metadata));
    assert.deepEqual([...page.population?.records ?? []], [...reference.population?.records ?? []], 'chest/spawner records ride along');
  }
});

test('ring workers take ring columns while the main worker keeps the window, and never get a NaN centre', async () => {
  const w = new DimensionWorld('28', -1), main = port(), spare = port();
  const ring = new HeadlessColumns(w);
  const prefetch = new StreamPrefetch(w, main, { margin: 0, ringPorts: [spare] });
  prefetch.ring = ring;
  assert.deepEqual(ring.units(), [], 'an uncentred ring asks for nothing');
  prefetch.update(8, 8);
  assert.equal(spare.posted.length, 1, 'only init: no ring request before the ring is centred');
  ring.update(0, 0);
  prefetch.update(8, 8);
  const ringRequests = (p) => p.posted.filter((m) => m.type === 'ring');
  assert.equal(ringRequests(spare).length, 1, 'the spare worker takes a ring column at once');
  assert.equal(main.posted.filter((m) => m.type === 'column').length, 1, 'the window column is not blocked by ring requests');
  prefetch.update(8, 8);
  assert.equal(ringRequests(spare).length, 1, 'a busy ring worker gets no second request');
  await spare.flush(); await main.flush();
  assert.ok(ring.cols.size >= 1, 'the ring received its column');
  ring.update(0, 0);
  prefetch.update(8, 8);
  assert.equal(ringRequests(spare).length, 1, 'an idle ring worker takes the next one (flush consumed the first)');
  assert.equal(main.posted.filter((m) => m.type === 'column').length, 1, 'the main worker is busy with the next window column, so it takes no ring column');
  prefetch.dispose();
  assert.ok(spare.terminated && main.terminated);
});

test('ring workers: made up front, ended after RING_IDLE_TICKS once the ring is full, made again when units stay unserved', async () => {
  const w = new DimensionWorld('29', -1), main = port(), made = [];
  const ring = new HeadlessColumns(w);
  const prefetch = new StreamPrefetch(w, main, { margin: 0, ringSpawn: () => { const p = port(); made.push(p); return p; }, ringMax: 2 });
  prefetch.ring = ring;
  assert.equal(made.length, 2, 'ringMax workers start with the prefetch, while the loading screen finishes');
  assert.ok(made.every((p) => p.posted.some((m) => m.type === 'init')));
  ring.update(0, 0);
  prefetch.update(8, 8);
  assert.ok(made.every((p) => p.posted.some((m) => m.type === 'ring')), 'both take ring columns');
  // The ring completes: every column is held.
  for (let us = ring.units(); us.length; us = ring.units()) for (const u of us) { prefetch.pending.delete(`r${u.join(',')}`); ring.receive([[u[0], u[1], { blocks: new Uint8Array(0), meta: new Uint8Array(0) }]]); }
  assert.deepEqual(ring.units(), []);
  for (const r of prefetch.ringPorts) r.busy = null;
  prefetch.mainRing = null;
  for (let i = 0; i < RING_IDLE_TICKS - 1; i++) prefetch.update(8, 8);
  assert.equal(prefetch.ringPorts.length, 2, 'not before the idle limit');
  prefetch.update(8, 8);
  assert.equal(prefetch.ringPorts.length, 0, 'ended once idle for RING_IDLE_TICKS updates');
  assert.ok(made.every((p) => p.terminated));
  ring.update(80, 80);
  for (let i = 0; i < 4; i++) { prefetch.update(8, 8); if (prefetch.mainRing) prefetch.pending.delete(prefetch.mainRing), prefetch.mainRing = null; }
  assert.ok(made.length > 2, 'a shift that leaves units unserved makes workers again');
  prefetch.dispose();
});

test('ringMax 0 (low-core machines) makes no ring workers; the main worker takes ring columns when idle', () => {
  const w = new DimensionWorld('29', -1), main = port(), ring = new HeadlessColumns(w);
  let made = 0;
  const prefetch = new StreamPrefetch(w, main, { margin: 0, ringSpawn: () => { made++; return port(); }, ringMax: 0 });
  prefetch.ring = ring; ring.update(0, 0);
  prefetch.update(8, 8);
  assert.equal(made, 0);
  assert.ok(main.posted.some((m) => m.type === 'ring' || m.type === 'column'));
  prefetch.dispose();
});
