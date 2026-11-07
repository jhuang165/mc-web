// The native spawn walk (world-spawn.md) takes 35 ms to 5 s per world, and the World constructor ran it synchronously. This solves it in a
// dedicated worker before the constructor runs and parks the result in java-world.js `presolvedSpawns`; generateJavaWorld takes it
// instead of walking. Same function, same inputs, so the result is identical. Without Worker support, or when the worker fails, nothing
// is parked and the constructor walks on the page thread as before.
import { presolvedSpawns, spawnKey, nativeSpawnGeneration, streamedWorldType } from './java-world.js';
import { normalizeFlatOptions } from './flat-world.js';

// The World constructor's normalisation of a record's generator inputs, or null when the record does not use the native spawn.
export function spawnRequest(record) {
  if (record?.biome !== 'javaStreamed' || record.dimension || !nativeSpawnGeneration(record.generationVersion ?? 0)) return null;
  const worldType = streamedWorldType(record.worldType ?? 'default'), seed = String(record.seed);
  return { seed, generationVersion: record.generationVersion, worldType, generatorOptions: worldType === 'flat' ? normalizeFlatOptions(record.generatorOptions ?? '') : '' };
}

export function presolveSpawn(record, { createWorker = () => new Worker(new URL('./spawn-worker.js', import.meta.url), { type: 'module' }), timeout = 60000 } = {}) {
  const request = spawnRequest(record);
  if (!request) return Promise.resolve(null);
  const key = spawnKey(request.seed, request.generationVersion, request.worldType, request.generatorOptions);
  if (presolvedSpawns.has(key)) return Promise.resolve(presolvedSpawns.get(key));
  let worker;
  try { worker = createWorker(); } catch (e) { console.warn(`spawn-presolve: no worker, walking on the page thread: ${e.message}`); return Promise.resolve(null); }
  return new Promise((resolve) => {
    const done = (spawn, why) => {
      clearTimeout(timer);
      worker.terminate?.();
      if (spawn) presolvedSpawns.set(key, spawn); else console.warn(`spawn-presolve: ${why}; walking on the page thread`);
      resolve(spawn);
    };
    const timer = setTimeout(() => done(null, 'timed out'), timeout);
    worker.onmessage = ({ data }) => (data.error ? done(null, data.error) : done(data.spawn));
    worker.onerror = (e) => done(null, e?.message ?? 'worker error');
    worker.postMessage({ id: 1, ...request });
  });
}
