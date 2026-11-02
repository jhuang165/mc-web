import {readRegion, decodeRegionChunk} from './region-file.js';
import {chunkFromNbt} from './chunk-nbt.js';
import {fromOriginal, isRegistered} from './block-registry.js';

export const REGION_LIMIT = 64 * 1024 * 1024;

export async function inspectRegion(filename, bytes, {hasSky = true} = {}) {
  const match = /^r\.(-?\d+)\.(-?\d+)\.mca$/.exec(filename);
  if (!match || match[0] !== filename) throw new Error('Expected r.<regionX>.<regionZ>.mca');
  const [rx, rz] = match.slice(1).map(Number);
  for (const value of [rx, rz]) {
    if (!Number.isInteger(value) || value < -67108864 || value > 67108863) throw new Error('Region address exceeds signed chunk coordinates');
  }
  const chunks = [], counts = new Map();
  let inflatedBytes = 0;
  for (const [slot, entry] of readRegion(bytes)) {
    try {
      const remaining = 256 * 1024 * 1024 - inflatedBytes;
      if (!remaining) throw new Error('Region expansion budget exhausted');
      const doc = await decodeRegionChunk(entry, {maxBytes: Math.min(16 * 1024 * 1024, remaining)});
      inflatedBytes += doc.bytesRead;
      const {chunk, entities, tileEntities, tileTicks} = chunkFromNbt(doc, {hasSky});
      const x = rx * 32 + entry.x, z = rz * 32 + entry.z;
      if (chunk.x !== x || chunk.z !== z) throw new Error(`expected chunk (${x}, ${z}), found (${chunk.x}, ${chunk.z})`);
      for (const section of chunk.sections) {
        if (!section) continue;
        for (let i = 0; i < section.lsb.length; i++) {
          const shift = (i & 1) * 4;
          const high = ((section.msb?.data[i >> 1] ?? 0) >> shift) & 15;
          const id = (high << 8) | section.lsb[i];
          const meta = (section.metadata.data[i >> 1] >> shift) & 15;
          const key = id * 16 + meta;
          if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
      chunks.push({slot, x, z, entities: entities.length, tileEntities: tileEntities.length, scheduledTicks: tileTicks?.length ?? 0});
    } catch (cause) {
      throw new Error(`${filename} slot ${slot}: ${cause.message}`, {cause});
    }
  }
  const states = [...counts].sort(([a], [b]) => a - b).map(([key, cells]) => {
    const id = key >> 4, meta = key & 15, mapped = fromOriginal(id, meta);
    let mapping = 'unmapped';
    if (!isRegistered(id)) mapping = 'unregistered';
    else if (mapped) mapping = mapped.exact ? 'exact' : 'inexact';
    return {id, meta, cells, mapping};
  });
  return {filename, regionX: rx, regionZ: rz, inflatedBytes, chunks, states};
}
