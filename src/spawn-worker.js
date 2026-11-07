// Worker for spawn-presolve.js: runs WorldServer.createSpawnPosition (java-world.js solveNativeSpawn) off the page thread.
import { solveNativeSpawn } from './java-world.js';
import { populationBlockMapperReady } from './population-world.js';

self.onmessage = async ({ data }) => {
  try {
    await populationBlockMapperReady;
    self.postMessage({ id: data.id, spawn: solveNativeSpawn(data) });
  } catch (error) {
    self.postMessage({ id: data.id, error: String(error?.message ?? error) });
  }
};
