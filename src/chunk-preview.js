import {World} from './world.js';
import {originalState, mapOriginalState} from './region-import.js';
import {regionAddress, regionSlot, readRegion, decodeRegionChunk} from './region-file.js';
import {chunkFromNbt} from './chunk-nbt.js';

// Rebase one Java column into a fresh version-9 world using ordinary saved edits.
// For whole areas, tile contents and a detailed loss report see region-import.js (WORLD-03g).
export async function previewJavaChunk(filename, bytes, x, z) {
  const address = regionAddress(x, z);
  const expected = `r.${address.regionX}.${address.regionZ}.mca`;
  if (filename !== expected) throw new Error(`Chunk (${x}, ${z}) belongs in ${expected}`);
  const entry = readRegion(bytes).get(regionSlot(address.x, address.z));
  if (!entry) throw new Error('Selected chunk is absent');
  const {chunk, entities, tileEntities, tileTicks} = chunkFromNbt(await decodeRegionChunk(entry));
  if (chunk.x !== x || chunk.z !== z) throw new Error(`Selected slot contains chunk (${chunk.x}, ${chunk.z})`);

  const seed = '1710', world = new World(seed, 'java', 9), edits = [];
  const report = {source: {x,z}, destination: {x:64,z:64}, omittedBlocks:0, approximatedBlocks:0,
    entities:entities.length, tileEntities:tileEntities.length, scheduledTicks:tileTicks?.length ?? 0};
  for (let y = 0; y < 256; y++) {
    const section = chunk.sections[y >> 4];
    for (let dz = 0; dz < 16; dz++) for (let dx = 0; dx < 16; dx++) {
      const mapped = mapOriginalState(originalState(section, dx, y, dz));
      if (!mapped) report.omittedBlocks++;
      else if (!mapped.exact || mapped.state) report.approximatedBlocks++;
      const block = mapped?.id ?? 0, meta = mapped?.meta ?? 0;
      if (world.get(64+dx,y,64+dz) !== block || world.getMeta(64+dx,y,64+dz) !== meta)
        edits.push([`${64+dx},${y},${64+dz}`, block | (meta << 8)]);
    }
  }
  let spawnY = 255;
  while (spawnY > 0 && !world.get(72,spawnY,81)) spawnY--;
  const record = {format:'blockworld', version:1, generationVersion:9, seed, biome:'java', mode:'creative',
    name:`Chunk ${x}, ${z} preview`, edits, position:{x:72.5,y:spawnY+1.01,z:81.5,yaw:0,pitch:0}};
  return {record, report};
}
