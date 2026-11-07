// Worker for spawn-presolve.js: runs WorldServer.createSpawnPosition (java-world.js solveNativeSpawn) off the page thread, then (when asked) builds the
// resident window's population cell (solveResidentCell) and hands its buffers over.
import { solveNativeSpawn, solveResidentCell } from './java-world.js';
import { populationBlockMapperReady } from './population-world.js';

self.onmessage = async ({ data }) => {
  try {
    await populationBlockMapperReady;
    const spawn = solveNativeSpawn(data);
    self.postMessage({ id: data.id, spawn });
    if (!data.terrain) return;
    const resident = solveResidentCell(data, spawn), transfer = [];
    for (const c of resident.cell.columns.values()) transfer.push(c.blocks.buffer, c.metadata.buffer);
    self.postMessage({ id: data.id, resident }, transfer);
  } catch (error) {
    self.postMessage({ id: data.id, error: String(error?.message ?? error) });
  }
};
