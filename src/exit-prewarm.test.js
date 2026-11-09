import test from 'node:test';
import assert from 'node:assert/strict';
import { ExitPrewarm } from './exit-prewarm.js';
import { World } from './world.js';
import { DimensionWorld } from './dimension-world.js';
import { createStreamWorker } from './streaming-generator.js';
import { populationBlockMapperReady } from './population-world.js';
import { arrivalWarmer } from './travel-loading.js';
import { transferTarget } from './dimensions.js';

await populationBlockMapperReady;
globalThis.Worker ??= function Worker() {};

// A worker port that answers like streaming-worker.js, in this thread (`answer(request)` -> message or null).
const portFactory = (build) => { const ports = []; const createWorker = () => {
  let handle = null, chain = Promise.resolve();
  const port = { requests: [], ended: false, postMessage(m) { chain = chain.then(async () => { if (m.type === 'init') { handle = await build(m); return; } port.requests.push(m); const { message, transfer } = handle(m); await new Promise((r) => setTimeout(r, 1)); if (!port.ended) port.onmessage?.({ data: structuredClone(message, { transfer }) }); }); }, terminate() { port.ended = true; } };
  ports.push(port); return port;
}; return { createWorker, ports }; };

const ROOT = { id: 'w1', seed: '17', biome: 'javaStreamed', generationVersion: 13, worldType: 'default' };

test('Overworld cells built during the portal wait are the cells the new world would build, and are adopted without a worker', async () => {
  const old = new World('17', 'javaStreamed', 13); // the world the player left: its origin is remembered
  const { createWorker, ports } = portFactory(createStreamWorker);
  const warm = new ExitPrewarm({ createWorker, maxWorkers: 2 });
  const tt = transferTarget(-1, 0, (old.originX + 8 * 16 + 40) / 8, 70, (old.originZ + 8 * 16 + 40) / 8, 0); // a Nether position that lands just past the first cell
  assert.equal(warm.start(ROOT, 0, tt), true);
  const fresh = new World('17', 'javaStreamed', 13), reference = new World('17', 'javaStreamed', 13);
  await warm.job; // the speculative cells too (a trip waits only for the target's own window)
  const moved = await warm.adopt(fresh, 'start');
  assert.ok(moved >= 1, `cells moved: ${moved}`);
  assert.ok(ports.every((p) => p.ended), 'workers are ended');
  const asked = ports.flatMap((p) => p.requests.filter((m) => m.type === 'cell').map((m) => `${m.x},${m.z}`));
  assert.ok(asked.length >= 1, 'asked for cells');
  let compared = 0;
  for (const k of asked) {
    const [cx, cz] = k.split(',').map(Number);
    assert.ok(fresh.population.hasCell(cx, cz), `cell ${k} adopted`);
    const got = fresh.population.cell(cx, cz), want = reference.population.cell(cx, cz);
    for (const [ck, col] of want.columns) {
      assert.deepEqual(Buffer.from(got.columns.get(ck).blocks), Buffer.from(col.blocks), `${k} ${ck} blocks`);
      assert.deepEqual(Buffer.from(got.columns.get(ck).metadata), Buffer.from(col.metadata), `${k} ${ck} metadata`);
      compared++;
    }
    assert.deepEqual(got.mineshafts, want.mineshafts); assert.equal(got.populates, want.populates);
  }
  assert.ok(compared >= 64);
  // The trip's own warmer then asks nothing and opens no worker for the held window.
  const tripPorts = portFactory(createStreamWorker);
  const trip = arrivalWarmer(fresh, { pause: async () => {}, createWorker: tripPorts.createWorker, maxWorkers: 3 });
  const cell = asked.map((k) => k.split(',').map(Number))[0];
  assert.equal(await trip.columns([[cell[0] * 128, cell[1] * 128]]), 0);
  assert.equal(tripPorts.ports.length, 0, 'no worker for a held unit');
  trip.dispose();
});

test('cells for another origin or another world are not adopted; an unknown world builds nothing', async () => {
  new World('17', 'javaStreamed', 13);
  const { createWorker, ports } = portFactory(createStreamWorker);
  const warm = new ExitPrewarm({ createWorker, maxWorkers: 1 });
  assert.equal(warm.start({ ...ROOT, seed: 'never-opened' }, 0, { x: 5, z: 5 }), false, 'origin unknown');
  assert.equal(warm.start({ ...ROOT, generationVersion: 12 }, 0, { x: 5, z: 5 }), false, 'no cells below generation 13');
  assert.equal(warm.start(ROOT, 1, { x: 0, z: 0 }), false, 'the End builds nothing');
  assert.equal(ports.length, 0);
  assert.equal(warm.start(ROOT, 0, { x: 5, z: 5 }), true);
  const other = new World('17', 'javaStreamed', 13); other.originX += 16;
  assert.equal(await warm.adopt(other, 'start'), 0, 'different origin');
  assert.equal(await warm.adopt(new World('17', 'javaStreamed', 13), 'start'), 0, 'request was ended');
});

test('Nether columns are held out of the Teleporter stage and moved into the trip world with their records afterwards', async () => {
  const build = async () => (req) => {
    const blocks = new Uint8Array(4).fill(req.x & 255), metadata = new Uint8Array(4).fill(req.z & 255);
    return { message: { type: 'column', x: req.x, z: req.z, column: { blocks, metadata }, records: req.x === 0 && req.z === 0 ? { chests: 1 } : null }, transfer: [blocks.buffer, metadata.buffer] };
  };
  const { createWorker, ports } = portFactory(build);
  const warm = new ExitPrewarm({ createWorker, maxWorkers: 2 });
  assert.equal(warm.start(ROOT, -1, { x: 64, z: 64 }), true);
  const nether = new DimensionWorld('17', -1);
  assert.equal(await warm.adopt(nether, 'start'), 0, 'Nether columns wait for the end of the arrival');
  assert.equal(nether.pregenerated.size, 0);
  const moved = await warm.adopt(nether, 'end');
  assert.equal(moved, 64);
  assert.equal(nether.pregenerated.size, 64);
  assert.deepEqual([...nether.pregenerated.get('0,0').blocks], [0, 0, 0, 0]);
  assert.deepEqual(nether.population.records.get('0,0'), { chests: 1 });
  assert.ok(ports.every((p) => p.ended));
});

test('a second target far from the first asks again, a near one does not, and dispose ends the workers', async () => {
  new World('17', 'javaStreamed', 13);
  const { createWorker, ports } = portFactory(createStreamWorker);
  const warm = new ExitPrewarm({ createWorker, maxWorkers: 1, setTimer: () => 0 });
  warm.start(ROOT, 0, { x: 40, z: 40 }); await warm.job;
  const n = ports.flatMap((p) => p.requests).length;
  warm.start(ROOT, 0, { x: 42, z: 41 }); await warm.job;
  assert.equal(ports.flatMap((p) => p.requests).length, n, 'near target: nothing new');
  warm.dispose();
  assert.ok(ports.every((p) => p.ended));
});
