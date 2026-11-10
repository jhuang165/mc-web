import test from 'node:test';
import assert from 'node:assert/strict';
import { ExitPrewarm, savedPortalFor } from './exit-prewarm.js';
import { World } from './world.js';
import { DimensionWorld, TerrainPeek } from './dimension-world.js';
import * as D from './dimensions.js';
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
  const moved = await warm.adopt(fresh, 'start', { timeoutMs: 120000 });
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
  assert.equal(await warm.adopt(other, 'start', { timeoutMs: 120000 }), 0, 'different origin');
  assert.equal(await warm.adopt(new World('17', 'javaStreamed', 13), 'start', { timeoutMs: 120000 }), 0, 'request was ended');
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
  assert.equal(await warm.adopt(nether, 'start', { timeoutMs: 120000 }), 0, 'Nether columns wait for the end of the arrival');
  assert.equal(nether.pregenerated.size, 0);
  const moved = await warm.adopt(nether, 'end', { timeoutMs: 120000 });
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

test('savedPortalFor picks the nearest saved portal within 128 blocks of the target, the first in x-then-z order on a tie', () => {
  const tt = { x: 100.5, z: 100.5 };
  assert.equal(savedPortalFor([], tt), null);
  assert.equal(savedPortalFor([[300, 100]], tt), null, 'beyond the search box');
  assert.deepEqual(savedPortalFor([[-20, 100], [210, 100], [300, 100]], tt), [210.5, 100.5], '(210, 100) is 110 away, (-20, 100) 120');
  assert.deepEqual(savedPortalFor([[90, 100], [110, 100]], tt), [90.5, 100.5], 'tie: the earlier column');
  assert.deepEqual(savedPortalFor([[228, 100]], tt), [228.5, 100.5], 'the box edge (128 from floor(x)) counts');
  assert.equal(savedPortalFor([[229, 100]], tt), null);
});

test('a saved portal in reach moves the asked windows from the target to the portal; the cells are the same pure output', async () => {
  const old = new World('17', 'javaStreamed', 13);
  const target = { x: old.originX + 70, z: old.originZ + 70 }, portal = [target.x + 120, target.z + 3];
  const build = async (portals) => {
    const { createWorker } = portFactory(createStreamWorker);
    const warm = new ExitPrewarm({ createWorker, maxWorkers: 2, setTimer: () => 0 });
    warm.start(ROOT, 0, target, portals); await warm.need;
    const fresh = new World('17', 'javaStreamed', 13);
    await warm.adopt(fresh, 'start', { timeoutMs: 120000 });
    return fresh;
  };
  const windowCells = (w, x, z) => { // the population cells the portal's window needs (World.streamAround)
    const { minX, minZ } = w.windowAt(x, z), cells = new Set();
    for (let cx = minX / 16; cx < minX / 16 + 8; cx++) for (let cz = minZ / 16; cz < minZ / 16 + 8; cz++) cells.add(`${Math.floor(cx / 8)},${Math.floor(cz / 8)}`);
    return [...cells].map((k) => k.split(',').map(Number));
  };
  const plain = await build(null), saved = await build([portal]);
  const need = windowCells(saved, portal[0] + 0.5, portal[1] + 0.5);
  assert.ok(need.every(([x, z]) => saved.population.hasCell(x, z)), 'the portal window is held');
  assert.ok(need.some(([x, z]) => !plain.population.hasCell(x, z)), 'a target-only request leaves some of it to be fetched after the trip starts');
  const reference = new World('17', 'javaStreamed', 13);
  for (const [x, z] of need) {
    const got = saved.population.cell(x, z), want = reference.population.cell(x, z);
    for (const [ck, col] of want.columns) {
      assert.deepEqual(Buffer.from(got.columns.get(ck).blocks), Buffer.from(col.blocks), `${x},${z} ${ck} blocks`);
      assert.deepEqual(Buffer.from(got.columns.get(ck).metadata), Buffer.from(col.metadata), `${x},${z} ${ck} metadata`);
    }
  }
});

test('Nether prewarm also holds the columns of the windows an exit up to 18 blocks away would use, equal to the world\'s own columns', async () => {
  const { createWorker, ports } = portFactory(createStreamWorker);
  const warm = new ExitPrewarm({ createWorker, maxWorkers: 3, setTimer: () => 0 });
  const tt = { x: 200.3, z: -77.6 };
  assert.equal(warm.start(ROOT, -1, tt), true);
  await warm.job;
  const asked = ports.flatMap((p) => p.requests.filter((m) => m.type === 'column' || m.type === 'columns' || m.x !== undefined).map((m) => `${m.x},${m.z}`));
  const nether = new DimensionWorld('17', -1), mirror = new DimensionWorld('17', -1);
  const moved = await warm.adopt(nether, 'end', { timeoutMs: 120000 });
  assert.ok(moved > 64 && moved <= 64 + 40, `columns held: ${moved}`);
  assert.ok(asked.length >= moved);
  // The window of an exit 8 blocks east of the target is entirely held.
  const { minX, minZ } = mirror.windowAt(tt.x + 8, tt.z);
  let held = 0;
  for (let cx = minX / 16; cx < minX / 16 + 8; cx++) for (let cz = minZ / 16; cz < minZ / 16 + 8; cz++) if (nether.pregenerated.has(`${cx},${cz}`)) held++;
  assert.equal(held, 64, 'no second fetch for a window shifted by the portal offset');
  for (const k of ['0,0', '12,-5', '13,-4'].filter((k) => nether.pregenerated.has(k))) {
    const [cx, cz] = k.split(',').map(Number), want = mirror.generateTerrainChunk(cx, cz), got = nether.pregenerated.get(k);
    assert.deepEqual(Buffer.from(got.blocks), Buffer.from(want.blocks), `${k} blocks`);
    assert.deepEqual(Buffer.from(got.metadata), Buffer.from(want.metadata), `${k} metadata`);
  }
  assert.ok(nether.pregenerated.size > 0);
});

test('savedPortalFor weighs height like Teleporter.placeInExistingPortal: stacks, ties, and random worlds against the real search', () => {
  const tt = { x: 100.5, y: 70, z: 100.5 };
  // one 30 blocks above the target height, one 5 below: the lower-distance one wins although it is later in x order
  assert.deepEqual(savedPortalFor([[90, 100, [100]], [105, 100, [65, 66]]], tt), [105.5, 100.5], 'height decides');
  assert.deepEqual(savedPortalFor([[90, 100, [70]], [110, 100, [70]]], tt), [90.5, 100.5], 'equal 3D distance: the earlier column');
  assert.deepEqual(savedPortalFor([[90, 100, [70]], [105, 100, [40]]], tt), [90.5, 100.5], 'a farther column at a better height can still lose');
  assert.deepEqual(savedPortalFor([[95, 100, [30, 31, 32, 80, 81]]], tt), [95.5, 100.5]);
  // a stack counts at its bottom block: column (100, 100) holds a stack 60-63, which is 9.5 below the target at its bottom (6.5 at its top)
  assert.deepEqual(savedPortalFor([[100, 100, [60, 61, 62, 63]], [100, 106, [75]]], tt), [100.5, 106.5], 'bottom 90.25 vs top 42.25: (100,106,75) at 66.25 wins only if the bottom counts');
  const rnd = (() => { let a = 12345; return () => (a = (a * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
  for (let trial = 0; trial < 60; trial++) {
    const edits = new Map(), at = { x: Math.floor(rnd() * 80) - 40 + 0.5, y: 20 + Math.floor(rnd() * 100), z: Math.floor(rnd() * 80) - 40 + 0.5 };
    const n = 1 + Math.floor(rnd() * 8);
    for (let i = 0; i < n; i++) { // portals spread over about 300 blocks (some beyond the 128 box), stacks of 1-4, sometimes two stacks in a column; shared distances are common on the 4-block grid
      const x = Math.floor((rnd() * 75) - 37) * 4, z = Math.floor((rnd() * 75) - 37) * 4, y = 4 + Math.floor(rnd() * 120);
      for (let h = 0; h < 1 + Math.floor(rnd() * 4); h++) edits.set(`${x},${y + h},${z}`, 90);
    }
    const peek = new TerrainPeek({ dimension: 0, javaSeed: 5n, generateTerrainChunk: () => ({ blocks: new Uint8Array(65536) }) }, edits);
    const list = peek.portalColumns(90, Math.floor(at.x) - 160, Math.floor(at.x) + 160, Math.floor(at.z) - 160, Math.floor(at.z) + 160);
    const t = new D.Teleporter(peek, { ids: { air: 0, obsidian: 49, portal: 90, endPortal: 119, bedrock: 7 }, isSolid: (id) => id === 1 || id === 49 });
    const e = { x: at.x, y: at.y, z: at.z, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, teleportDirection: 0 };
    const found = t.placeInExistingPortal(e, at.x, at.y, at.z, 0), hit = t.cache.get(`${Math.floor(at.x)},${Math.floor(at.z)}`), mine = savedPortalFor(list, at);
    if (!found) { assert.equal(mine, null, `trial ${trial}: no portal inside the box`); continue; }
    assert.deepEqual(mine, [hit.x + 0.5, hit.z + 0.5], `trial ${trial}`);
  }
});

test("a Teleporter cache entry is the pick whatever the saved portals say (batch 36)", () => {
  const tt = { x: 100.5, y: 70, z: 100.5 };
  assert.deepEqual(savedPortalFor([[90, 100, [70]]], tt, { x: 300, y: 60, z: 40 }), [300.5, 40.5]);
  assert.deepEqual(savedPortalFor([], tt, { x: 300, y: 60, z: 40 }), [300.5, 40.5], "a broken portal is still the cached exit");
  assert.deepEqual(savedPortalFor([[90, 100, [70]]], tt, null), [90.5, 100.5]);
});
