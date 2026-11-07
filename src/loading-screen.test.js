// Loading screens (loading-screen.js, bytecode-read from the unchanged 1.7.10 client) and the off-thread spawn walk (spawn-presolve.js).
// Reference strings: assets/minecraft/lang/en_US.lang in the jar (menu.loadingLevel, menu.generatingTerrain, multiplayer.downloadingTerrain).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LoadingState, SpawnAreaLog, loadingLayout, errorLayout, downloadLayout, workingLayout, workingLine, startLoading, setStage, STAGES, BAR, LOADING_THROTTLE_MS } from './loading-screen.js';
import { t, LANG } from './menu-screens.js';
import { presolveSpawn, presolveWorld, spawnRequest } from './spawn-presolve.js';
import { solveNativeSpawn, solveLegacySpawn, nativeSpawnGeneration, spawnKey, solveResidentCell, nativeWorldSpawn, presolvedSpawns, presolvedCells } from './java-world.js';
import { ChunkProviderGenerate, BiomeTerrainState } from './terrain-generator.js';
import { biomeLayerOptions } from './java-world.js';
import { World } from './world.js';
import { populationBlockMapperReady } from './population-world.js';
await populationBlockMapperReady;

const reference = JSON.parse(readFileSync(new URL('../public/research/spawn-reference.json', import.meta.url), 'utf8'));

test('layouts follow LoadingScreenRenderer, GuiErrorScreen, GuiDownloadTerrain and GuiScreenWorking', () => {
  // 427 x 240 GUI: title h/2 - 4 - 16, message h/2 - 4 + 8, bar 100 x 2 at (w/2 - 50, h/2 + 16).
  assert.deepEqual(loadingLayout(427, 240), { cx: 213, titleY: 100, messageY: 124, bar: { x: 163, y: 136, w: 100, h: 2 } });
  assert.deepEqual(loadingLayout(320, 241), { cx: 160, titleY: 100, messageY: 124, bar: { x: 110, y: 136, w: 100, h: 2 } });
  assert.deepEqual([BAR.track, BAR.fill, BAR.width, BAR.height], [0x808080, 0x80ff80, 100, 2]);
  assert.deepEqual(errorLayout(320, 240), { cx: 160, titleY: 90, messageY: 110, button: { x: 60, y: 140, w: 200, h: 20 } });
  assert.equal(errorLayout(320, 240, 5).button.y, 160);
  assert.deepEqual(downloadLayout(427, 240), { cx: 213, y: 70 });
  assert.deepEqual(workingLayout(427), { cx: 213, titleY: 70, lineY: 90 });
  assert.equal(workingLine('Converting world', 7), 'Converting world 7%');
});

test('the English strings are the en_US.lang values of the jar', () => {
  assert.equal(t('menu.loadingLevel'), 'Loading world');
  assert.equal(t('menu.generatingTerrain'), 'Building terrain');
  assert.equal(t('multiplayer.downloadingTerrain'), 'Downloading terrain');
  assert.equal(LANG['gui.cancel'], 'Cancel');
});

test('LoadingState: the native message sequence and the 100 ms progress throttle', () => {
  const s = startLoading();
  assert.deepEqual([s.title, s.message, s.progress], ['Loading world', 'Loading world', -1]);
  setStage(s, STAGES.terrain);
  assert.deepEqual([s.title, s.message, s.progress], ['Loading world', 'Building terrain', -1]);
  assert.equal(s.setLoadingProgress(10, 1000), true);
  assert.equal(s.setLoadingProgress(20, 1000 + LOADING_THROTTLE_MS - 1), false);
  assert.equal(s.progress, 10);
  assert.equal(s.setLoadingProgress(30, 1000 + LOADING_THROTTLE_MS), true);
  assert.equal(s.progress, 30);
  s.resetProgressAndWorkingMessage('x');
  assert.equal(s.progress, -1);
});

test('SpawnAreaLog prints "Preparing spawn area: N%" at most once a second with i * 100 / total truncated', () => {
  const lines = [], log = new SpawnAreaLog(625, (l) => lines.push(l));
  assert.equal(log.report(0, 5000), 'Preparing spawn area: 0%');
  assert.equal(log.report(300, 5500), null);
  assert.equal(log.report(300, 6000), null);
  assert.equal(log.report(313, 6001), 'Preparing spawn area: 50%');
  assert.equal(log.report(625, 6100, true), 'Preparing spawn area: 100%');
  assert.deepEqual(lines, ['Preparing spawn area: 0%', 'Preparing spawn area: 50%', 'Preparing spawn area: 100%']);
});

test('spawnRequest only covers streamed overworld records that populate (generation 13 up) and normalises like the World constructor', () => {
  assert.equal(spawnRequest({ biome: 'javaStreamed', seed: '1', generationVersion: 12 }), null);
  assert.equal(spawnRequest({ biome: 'javaStreamed', seed: '1' }), null);
  assert.equal(spawnRequest({ biome: 'javaStreamed', seed: '1', generationVersion: 14, worldType: 'flat' }), null, 'Superflat starts at 15');
  assert.equal(spawnRequest({ biome: 'javaStreamed', seed: '1', generationVersion: 17 }).generationVersion, 17);
  assert.equal(spawnRequest({ biome: 'java', seed: '1', generationVersion: 18 }), null);
  assert.equal(spawnRequest({ biome: 'javaStreamed', seed: '1', generationVersion: 18, dimension: 1 }), null);
  assert.deepEqual(spawnRequest({ biome: 'javaStreamed', seed: 12, generationVersion: 19, worldType: 'bogus', generatorOptions: 'x' }), { seed: '12', generationVersion: 19, worldType: 'default', generatorOptions: '' });
  const flat = spawnRequest({ biome: 'javaStreamed', seed: 'a', generationVersion: 18, worldType: 'flat', generatorOptions: '' });
  assert.equal(flat.worldType, 'flat');
  assert.equal(flat.generatorOptions, new World('a', 'javaStreamed', 18, 'flat', '').generatorOptions);
});

test('solveNativeSpawn equals nativeWorldSpawn (the probed function) on default, large biomes, amplified and Superflat records', () => {
  const picks = [...new Set(['default', 'largeBiomes', 'amplified', 'flat'])].flatMap((k) => reference.records.filter((r) => r.kind === k).slice(0, 3));
  assert.ok(picks.length >= 10);
  for (const r of picks) {
    const seed = BigInt(r.seed);
    const out = solveNativeSpawn({ seed: r.seed, generationVersion: 18, worldType: r.kind, generatorOptions: r.kind === 'flat' ? r.preset : '' });
    assert.deepEqual([out.x, out.y, out.z], r.spawn, `${r.kind} ${r.seed}`);
    void seed;
  }
});

test('a presolved spawn gives the World constructor the same spawn and origin as walking on the page thread', async () => {
  for (const seed of ['4', 'loading b20', '99999']) {
    presolvedSpawns.clear();
    const walked = new World(seed, 'javaStreamed', 18, 'default', '');
    const record = { biome: 'javaStreamed', seed, generationVersion: 18, worldType: 'default' };
    // A worker double that answers through the same function a real worker runs.
    const createWorker = () => {
      const w = { terminate() { this.ended = true; }, postMessage(data) { queueMicrotask(() => w.onmessage({ data: { id: data.id, spawn: solveNativeSpawn(data) } })); } };
      return w;
    };
    const solved = await presolveSpawn(record, { createWorker });
    assert.ok(solved);
    assert.equal(presolvedSpawns.size, 1);
    const fast = new World(seed, 'javaStreamed', 18, 'default', '');
    assert.equal(presolvedSpawns.size, 0, 'the entry is consumed');
    assert.deepEqual(fast.nativeSpawn, walked.nativeSpawn, seed);
    assert.deepEqual([fast.originX, fast.originZ], [walked.originX, walked.originZ], seed);
  }
});

// The worker's handler in-process: the spawn first, then the resident cell with a transfer list (as spawn-worker.js posts them).
const workerDouble = (calls = []) => () => {
  const w = { terminate() { this.ended = true; }, postMessage(data) {
    calls.push(data.terrain);
    queueMicrotask(() => {
      const spawn = nativeSpawnGeneration(data.generationVersion) ? solveNativeSpawn(data) : solveLegacySpawn(data);
      w.onmessage({ data: { id: data.id, spawn } });
      if (data.terrain) queueMicrotask(() => w.onmessage({ data: { id: data.id, resident: solveResidentCell(data, spawn) } }));
    });
  } };
  return w;
};
const snapshotOf = (w) => ({
  chunks: [...w.chunks.entries()].map(([k, c]) => [k, Buffer.from(c.blocks).toString('base64'), Buffer.from(c.meta).toString('base64')]),
  biomeIds: Buffer.from(w.biomeIds).toString('base64'),
});

test('a presolved resident cell gives the World constructor the same 64 columns, records and spawn without generating on the page thread', async () => {
  for (const [seed, type, options] of [['loading b20', 'default', ''], ['7', 'flat', '2;7,2x3,2;1;village']]) {
    presolvedSpawns.clear(); presolvedCells.clear();
    const walked = new World(seed, 'javaStreamed', 18, type, options);
    const record = { biome: 'javaStreamed', seed, generationVersion: 18, worldType: type, generatorOptions: options };
    const calls = [], start = presolveWorld(record, { createWorker: workerDouble(calls) });
    assert.ok(await start.spawn);
    assert.equal(await start.terrain, true);
    assert.deepEqual(calls, [true]);
    assert.equal(presolvedCells.size, 1);
    const fast = new World(seed, 'javaStreamed', 18, type, options);
    assert.equal(presolvedCells.size, 0, 'the entry is consumed');
    assert.equal(fast.population.generated, 0, 'the window cell was adopted, not generated here');
    assert.deepEqual(fast.nativeSpawn, walked.nativeSpawn, seed);
    assert.deepEqual([fast.originX, fast.originZ], [walked.originX, walked.originZ], seed);
    assert.deepEqual(snapshotOf(fast), snapshotOf(walked), seed);
    // the cell's records (chests, animals, spawners, structures) are the ones the constructor-built cell holds
    const records = (w) => JSON.stringify([...w.population.cell(0, 0).records.entries()]);
    assert.equal(records(fast), records(walked), seed);
    assert.equal(JSON.stringify(fast.claimFreshColumns()), JSON.stringify(walked.claimFreshColumns()), seed);
  }
});

test('presolveWorld: a spawn-only request builds no cell; a mismatched origin or a terrain failure falls back to the constructor', async () => {
  presolvedSpawns.clear(); presolvedCells.clear();
  const record = { biome: 'javaStreamed', seed: 'loading b20', generationVersion: 18, worldType: 'default' };
  const calls = [];
  assert.ok(await presolveSpawn(record, { createWorker: workerDouble(calls) }));
  assert.deepEqual(calls, [false]);
  assert.equal(presolvedCells.size, 0);
  // a cell for another origin is dropped, not adopted
  presolvedSpawns.clear();
  const walked = new World('loading b20', 'javaStreamed', 18, 'default', '');
  const bad = solveResidentCell({ seed: 'loading b20', generationVersion: 18, worldType: 'default', generatorOptions: '' }, { x: 0, z: 0 });
  presolvedCells.set(`${(await import('./java-world.js')).spawnKey('loading b20', 18, 'default', '')}`, bad);
  const fast = new World('loading b20', 'javaStreamed', 18, 'default', '');
  assert.deepEqual(snapshotOf(fast), snapshotOf(walked));
  assert.equal(presolvedCells.size, 0);
  // a worker that dies after the spawn: the spawn stays parked, the terrain promise settles false
  presolvedSpawns.clear();
  const warn = console.warn; console.warn = () => {};
  try {
    const half = () => { const w = { terminate() {}, postMessage(d) { queueMicrotask(() => { w.onmessage({ data: { id: d.id, spawn: solveNativeSpawn(d) } }); queueMicrotask(() => w.onerror({ message: 'crash' })); }); } }; return w; };
    const start = presolveWorld(record, { createWorker: half });
    assert.ok(await start.spawn);
    assert.equal(await start.terrain, false);
    assert.equal(presolvedSpawns.size, 1); assert.equal(presolvedCells.size, 0);
  } finally { console.warn = warn; }
  presolvedSpawns.clear();
});

test('presolveSpawn falls back (null, nothing parked) when the worker throws, errors or fails to start', async () => {
  presolvedSpawns.clear();
  const record = { biome: 'javaStreamed', seed: '5', generationVersion: 18, worldType: 'default' };
  const warn = console.warn; console.warn = () => {};
  try {
    assert.equal(await presolveSpawn(record, { createWorker: () => { throw new Error('no Worker'); } }), null);
    const failing = () => ({ terminate() {}, postMessage(d) { queueMicrotask(() => this.onmessage({ data: { id: d.id, error: 'boom' } })); } });
    assert.equal(await presolveSpawn(record, { createWorker: failing }), null);
    const dying = () => ({ terminate() {}, postMessage() { queueMicrotask(() => this.onerror({ message: 'crash' })); } });
    assert.equal(await presolveSpawn(record, { createWorker: dying }), null);
    assert.equal(await presolveSpawn({ ...record, generationVersion: 16 }), null);
  } finally { console.warn = warn; }
  assert.equal(presolvedSpawns.size, 0);
});

test('nativeWorldSpawn keeps matching a fresh provider (guards the shared biome state)', () => {
  const r = reference.records.find((x) => x.kind === 'default');
  const seed = BigInt(r.seed), state = new BiomeTerrainState(), gen = new ChunkProviderGenerate(seed, 'default', state, biomeLayerOptions(18));
  const out = nativeWorldSpawn(gen, seed, state, 'default');
  assert.deepEqual([out.x, out.y, out.z], r.spawn);
});

test('generation 13 to 17 saves: the worker presolve (findBiomePosition origin plus resident cell) gives the constructor identical columns, origin and records', async () => {
  for (const [seed, gv, type, options] of [['loading b22', 13, 'default', ''], ['loading b22', 17, 'default', ''], ['12', 16, 'amplified', ''], ['7', 15, 'flat', '2;7,2x3,2;1;village']]) {
    presolvedSpawns.clear(); presolvedCells.clear();
    const walked = new World(seed, 'javaStreamed', gv, type, options);
    assert.equal(walked.nativeSpawn ?? null, null, 'legacy origin, no native spawn');
    const record = { biome: 'javaStreamed', seed, generationVersion: gv, worldType: type, generatorOptions: options };
    const calls = [], start = presolveWorld(record, { createWorker: workerDouble(calls) });
    const spawn = await start.spawn;
    assert.equal(spawn.legacy, true);
    assert.equal(await start.terrain, true);
    assert.deepEqual(calls, [true]);
    const fast = new World(seed, 'javaStreamed', gv, type, options);
    assert.equal(presolvedCells.size, 0, 'the cell is consumed');
    assert.equal(presolvedSpawns.size, 0, 'the legacy origin is not left parked');
    assert.equal(fast.population.generated, 0, 'the window cell was adopted, not generated here');
    assert.deepEqual([fast.originX, fast.originZ], [walked.originX, walked.originZ], `${seed} ${gv}`);
    assert.deepEqual([fast.originX, fast.originZ], [((spawn.x >> 4) - 4) * 16, ((spawn.z >> 4) - 4) * 16]);
    assert.deepEqual(snapshotOf(fast), snapshotOf(walked), `${seed} ${gv}`);
    const records = (w) => JSON.stringify([...w.population.cell(0, 0).records.entries()]);
    assert.equal(records(fast), records(walked));
    assert.equal(JSON.stringify(fast.claimFreshColumns()), JSON.stringify(walked.claimFreshColumns()));
  }
  // a cell for another origin is dropped for a legacy save too
  presolvedCells.clear();
  const walked = new World('loading b22', 'javaStreamed', 16, 'default', '');
  presolvedCells.set(spawnKey('loading b22', 16, 'default', ''), solveResidentCell({ seed: 'loading b22', generationVersion: 16, worldType: 'default', generatorOptions: '' }, { x: 5000, z: 5000 }));
  assert.deepEqual(snapshotOf(new World('loading b22', 'javaStreamed', 16, 'default', '')), snapshotOf(walked));
  assert.equal(presolvedCells.size, 0);
});
