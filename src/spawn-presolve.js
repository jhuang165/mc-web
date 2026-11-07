// The native spawn walk (world-spawn.md) takes 35 ms to 5 s per world, and the World constructor ran it synchronously. This solves it in a
// dedicated worker before the constructor runs and parks the result in java-world.js `presolvedSpawns`; generateJavaWorld takes it
// instead of walking. Same function, same inputs, so the result is identical. Without Worker support, or when the worker fails, nothing
// is parked and the constructor walks on the page thread as before.
import { presolvedSpawns, presolvedCells, spawnKey, streamedWorldType } from './java-world.js';
// Generations 13 to 17 (findBiomePosition origin, solveLegacySpawn) and 18 up (native spawn) both populate; 12 and earlier have no cell to presolve.
const LEGACY_POPULATION_GENERATION = 13;
import { normalizeFlatOptions } from './flat-world.js';

// The World constructor's normalisation of a record's generator inputs, or null when the record does not use the native spawn.
export function spawnRequest(record) {
  if (record?.biome !== 'javaStreamed' || record.dimension || (record.generationVersion ?? 0) < LEGACY_POPULATION_GENERATION) return null;
  const worldType = streamedWorldType(record.worldType ?? 'default'), seed = String(record.seed);
  if (worldType === 'flat' && record.generationVersion < 15) return null; // the constructor throws for these; leave that to it
  return { seed, generationVersion: record.generationVersion, worldType, generatorOptions: worldType === 'flat' ? normalizeFlatOptions(record.generatorOptions ?? '') : '' };
}

// One worker per world start. `spawn` settles with the walk's result (null on failure) and `terrain` after the resident cell is parked (false when it was not).
// A failure at either step parks nothing for that step and the World constructor does the work itself.
export function presolveWorld(record, { createWorker = () => new Worker(new URL('./spawn-worker.js', import.meta.url), { type: 'module' }), timeout = 60000, terrain = true } = {}) {
  const request = spawnRequest(record), none = { spawn: Promise.resolve(null), terrain: Promise.resolve(false) };
  if (!request) return none;
  const key = spawnKey(request.seed, request.generationVersion, request.worldType, request.generatorOptions);
  if (presolvedSpawns.has(key) && (!terrain || presolvedCells.has(key))) return { spawn: Promise.resolve(presolvedSpawns.get(key)), terrain: Promise.resolve(presolvedCells.has(key)) };
  let worker;
  try { worker = createWorker(); } catch (e) { console.warn(`spawn-presolve: no worker, working on the page thread: ${e.message}`); return none; }
  let spawnDone, terrainDone, finished = false, parked = null;
  const spawn = new Promise((r) => { spawnDone = r; }), terrainPromise = new Promise((r) => { terrainDone = r; });
  const end = (spawnValue, cell, why) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    worker.terminate?.();
    if (why) console.warn(`spawn-presolve: ${why}; working on the page thread`);
    spawnDone(spawnValue); terrainDone(cell);
  };
  const timer = setTimeout(() => end(parked, false, 'timed out'), timeout);
  worker.onmessage = ({ data }) => {
    if (data.error) { end(parked, false, data.error); return; }
    if (data.spawn) {
      presolvedSpawns.set(key, parked = data.spawn); spawnDone(parked);
      if (!terrain) end(parked, false);
    } else if (data.resident) { presolvedCells.set(key, data.resident); end(parked, true); }
  };
  worker.onerror = (e) => end(parked, false, e?.message ?? 'worker error');
  worker.postMessage({ id: 1, terrain, ...request });
  return { spawn, terrain: terrainPromise };
}
// The spawn walk alone (the original entry point).
export const presolveSpawn = (record, options = {}) => presolveWorld(record, { ...options, terrain: false }).spawn;
