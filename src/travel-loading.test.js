import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from './dimensions.js';
import { TerrainPeek, DimensionWorld } from './dimension-world.js';
import { blankLoading, arrivalWarmer } from './travel-loading.js';
import { StreamPrefetch } from './streaming-generator.js';
import { runSteps, drain } from './steps.js';
import { World } from './world.js';
import { populationBlockMapperReady } from './population-world.js';
import { createStreamWorker } from './streaming-generator.js';

await populationBlockMapperReady;
const ORIGINAL = { air: 0, obsidian: 49, portal: 90, endPortal: 119, bedrock: 7 };
const floorWorld = () => ({ dimension: 0, javaSeed: 5n, generateTerrainChunk: () => { const blocks = new Uint8Array(16 * 16 * 256); for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) blocks.fill(1, (x * 16 + z) * 256, (x * 16 + z) * 256 + 61); return { blocks }; } });
const portalEdits = (list) => { const m = new Map(); for (const [x, y, z, id] of list) m.set(`${x},${y},${z}`, id); return m; };
const entity = () => ({ x: 100.5, y: 70, z: -100.5, vx: 1, vy: 0, vz: 0, yaw: 20, pitch: 5, teleportDirection: 0 });
const run = (edits, { shortcut, stepped }) => {
  const peek = new TerrainPeek(floorWorld(), new Map(edits));
  if (!shortcut) peek.portalColumns = undefined;
  const t = new D.Teleporter(peek, { ids: ORIGINAL, isSolid: (id) => id === 1 || id === 49 }), e = entity();
  let ok;
  if (stepped) { const g = t.placeInPortalSteps(e, 100.5, 70, -100.5, 20); let r, n = 0; while (!(r = g.next()).done) n++; ok = r.value; assert.ok(n > 0, 'yields'); } else ok = t.placeInPortal(e, 100.5, 70, -100.5, 20);
  return JSON.stringify({ ok, e, writes: peek.writes });
};

test('portalColumns lists only the box columns holding the block, in x then z order', () => {
  const peek = new TerrainPeek(floorWorld(), portalEdits([[5, 64, 9, 90], [5, 65, 9, 90], [3, 64, 20, 90], [3, 64, 2, 90], [4, 64, 4, 49], [500, 64, 0, 90]]));
  assert.deepEqual(peek.portalColumns(90, -10, 10, -10, 30), [[3, 2], [3, 20], [5, 9]]);
  assert.deepEqual(peek.portalColumns(90, 4, 10, 0, 10), [[5, 9]]);
  assert.deepEqual(new TerrainPeek(floorWorld()).portalColumns(90, -1e3, 1e3, -1e3, 1e3), []);
});

test('the Teleporter finds the same portal (or builds the same one) with the column shortcut, the full scan, and stepped or drained', () => {
  const frame = (x, z) => [[x, 64, z, 90], [x, 65, z, 90], [x - 1, 63, z, 49], [x + 1, 63, z, 49]];
  const cases = [
    [],
    [[104, 64, -99, 49], [100, 40, -100, 1]],
    [...frame(103, -98), ...frame(97, -103), [300, 64, 300, 90]],
    frame(110, -100),
    frame(210, -100), // outside the 128-block search box
  ];
  for (const edits of cases) {
    const results = new Set();
    for (const shortcut of [true, false]) for (const stepped of [true, false]) results.add(run(edits, { shortcut, stepped }));
    assert.equal(results.size, 1, JSON.stringify(edits));
  }
});

test('blankLoading is the empty frame the native respawn shows first', () => {
  const s = blankLoading();
  assert.equal(s.title ?? '', ''); assert.equal(s.message ?? s.working ?? '', '');
});

test('arrivalWarmer builds a Nether-style world window into pregenerated one column at a time, pausing between slices', async () => {
  const built = [];
  const world = { streaming: true, noPrefetch: true, chunks: new Map(), pregenerated: new Map(), windowAt: () => ({ minX: 0, minZ: 0 }), generateTerrainChunk: (cx, cz) => { built.push(`${cx},${cz}`); return { cx, cz }; } };
  let pauses = 0, clock = 0;
  const warm = arrivalWarmer(world, { pause: async () => { pauses++; }, now: () => (clock += 5), budgetMs: 12 });
  assert.equal(await warm.window(0, 0), 64);
  assert.equal(world.pregenerated.size, 64); assert.ok(pauses > 5);
  assert.equal(await warm.window(0, 0), 0, 'nothing left to build');
  assert.equal(await warm.columns([[0, 0], [1000, 0]]), 1, 'one new column');
  warm.dispose();
});

test('whenHas and arrivalWarmer wait for exactly the worker cells they need, and finish when the worker fails', async () => {
  const w = new World('17', 'javaStreamed', 13); w.blockLight = () => 0;
  const reference = new World('17', 'javaStreamed', 13);
  let handle = null, posted = [];
  const port = { postMessage(m) { posted.push(structuredClone(m)); }, terminate() { port.ended = true; } };
  const pump = async () => { while (posted.length) { const m = posted.shift(); if (m.type === 'init') { handle = await createStreamWorker(m); continue; } const { message, transfer } = handle(m); port.onmessage({ data: structuredClone(message, { transfer }) }); } };
  const pf = new StreamPrefetch(w, port, { margin: 0 });
  assert.equal(await pf.whenHas([[0, 0]]), undefined, 'a held unit resolves at once');
  let done = false; const p = pf.whenHas([[1, 0]]).then(() => { done = true; });
  await Promise.resolve(); assert.equal(done, false);
  assert.ok(posted.some((m) => m.type === 'cell' && m.x === 1 && m.z === 0), 'asked for cell 1,0');
  await pump(); await p;
  assert.equal(done, true); assert.ok(w.population.hasCell(1, 0));
  assert.deepEqual(Buffer.from(w.population.column(8, 0).blocks), Buffer.from(reference.population.column(8, 0).blocks), 'the worker cell equals the synchronous one');
  // a failing worker releases waiters
  const q = pf.whenHas([[2, 0]]); pf.fail('boom');
  const err = console.error; console.error = () => {};
  try { await q; } finally { console.error = err; }
  assert.equal(pf.failed, 'boom');
});

test('endCrystalSteps yields between chunk rows and returns exactly the crystals endCrystals does', async () => {
  const w = new DimensionWorld('12345', 1), g = w.endCrystalSteps(2);
  let n = 0, r; while (!(r = g.next()).done) n++;
  assert.equal(n, 25);
  assert.deepEqual(r.value, w.endCrystals(2));
  assert.deepEqual(await runSteps(w.endCrystalSteps(2), async () => {}), w.endCrystals(2));
  assert.deepEqual(drain(new DimensionWorld('12345', -1).endCrystalSteps()), []);
});

test('arrivalWarmer shares a large worker request over several lanes and disposes them all', async () => {
  const ports = [];
  const world = { streaming: true, generationVersion: 13, population: { cells: { max: 1 }, hasCell: () => false }, chunks: new Map(), pregenerated: new Map(), windowAt: () => ({ minX: 0, minZ: 0 }), baseColumns: new Map(), javaSeed: 1n };
  const createWorker = () => { const p = { posted: [], postMessage(m) { p.posted.push(m); }, terminate() { p.ended = true; } }; ports.push(p); return p; };
  const had = globalThis.Worker; globalThis.Worker = function Worker() {};
  const warm = arrivalWarmer(world, { pause: async () => {}, createWorker, maxWorkers: 3, timeoutMs: 30 });
  const done = warm.columns([[0, 0], [200, 0], [400, 0], [600, 0]]);
  await Promise.resolve();
  const asked = ports.map((p) => p.posted.filter((m) => m.type === 'cell').map((m) => m.x));
  assert.equal(ports.length, 3, 'three lanes');
  assert.deepEqual(asked.map((a) => a.length), [2, 1, 1], 'units dealt round-robin');
  warm.dispose();
  assert.ok(ports.every((p) => p.ended));
  await done; globalThis.Worker = had;
});
