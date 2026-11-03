import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { populationBlockMapperReady } from './population-world.js';
import { StreamPrefetch, createStreamWorker } from './streaming-generator.js';

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
