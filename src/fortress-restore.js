// Restores the Nether fortress starts of an imported Java save (data/Fortress.dat, kept in record.structureData.Fortress as
// base64 gzip by region-import.js) into a live Nether DimensionWorld: bounding boxes and pieces decide fortress spawn lists
// (blaze, wither skeleton, pig zombie), piece generation and the fence/brick checks. MapGenStructure.generate skips chunks
// whose start already exists, so an imported start replaces what the seed would generate there, as MapGenStructureData does.
import { decodeCompressedNbt } from "./nbt-compression.js";
import { decodeStructureDataDocument, startId, FORTRESS_DATA_NAME } from "./structure-nbt.js";

// Both ChunkProviderHell instances of a DimensionWorld (terrain search and population) own a bridge; each gets its own
// decoded copy because generation mutates the pieces. Returns the number of starts installed per bridge (0 when none).
export async function restoreImportedFortress(world, record) {
  const text = record?.structureData?.[FORTRESS_DATA_NAME];
  if (!text || !world?.isHell) return 0;
  let document;
  try { document = await decodeCompressedNbt(Uint8Array.from(atob(text), (c) => c.charCodeAt(0))); } catch { return 0; }
  let installed = 0;
  for (const provider of [world.provider, world.populator]) {
    const bridge = provider?.bridge;
    if (!bridge) continue;
    installed = 0;
    for (const start of decodeStructureDataDocument(document).starts) {
      if (startId(start) !== "Fortress") continue; // a corrupt file may hold other registered ids
      bridge.structureMap.set(start.chunkX, start.chunkZ, start);
      installed++;
    }
  }
  return installed;
}
