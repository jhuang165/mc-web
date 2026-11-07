// Java save structure data (data/Mineshaft.dat, Village.dat, Stronghold.dat, Temple.dat) for generation
// versions 14 (finite) and 15 (streamed). A native server saves every start its four MapGenStructure
// range-8 searches created for the chunks it provided, so export reruns those searches over exactly the
// exported chunk set (x outer, z inner, the provider order) with the generators and biome manager generation
// uses (StructurePopulation: same seed, ChunkProviderGenerate manager of the world's landscape).
// Import keeps data/*.dat from a Java save as raw start compounds. Re-export merges them with native
// precedence: an imported start for the same "[x,z]" key wins, imported-only starts (including ids this port
// does not know, e.g. a later-version id) are kept unchanged, and regenerated starts for other keys are appended.
import { StructurePopulation } from "./structure-population.js";
import { STRUCTURE_DATA_NAMES, FORTRESS_DATA_NAME, featuresToNbt, compoundTag } from "./structure-nbt.js";
import { MapGenNetherBridge } from "./fortress.js";
import { ChunkProviderGenerate, BiomeTerrainState } from "./terrain-generator.js";
import { JAVA_LANDSCAPES, javaSeed, streamedWorldType } from "./java-world.js";
import { JavaRandom } from "./java-random.js";
import { FlatChunkManager, parseFlatInfo } from "./flat-world.js";
import { FlatStructureCache, flatStructurePopulation } from "./flat-structures.js";
import { NBT } from "./nbt.js";
import { encodeCompressedNbt, decodeCompressedNbt } from "./nbt-compression.js";

export const STRUCTURE_DATA_VERSIONS = Object.freeze([14, 15]);
export const STRUCTURE_FILE_NAMES = Object.freeze(Object.values(STRUCTURE_DATA_NAMES).map((n) => `data/${n}.dat`));
export const hasStructureData = (generationVersion) => STRUCTURE_DATA_VERSIONS.includes(generationVersion);

// Generators exactly as generation constructs them: world seed plus the landscape's biome manager.
export function structureGenerators({ seed, biome = "java", worldType, generatorOptions = "" }) {
  const numeric = javaSeed(seed), type = biome === "javaStreamed" ? streamedWorldType(worldType) : JAVA_LANDSCAPES[biome] ?? "default";
  if (type === "flat") {
    // ChunkProviderFlat's own list: only the preset's features, in its order (flat-structures.js).
    const info = parseFlatInfo(generatorOptions), manager = new FlatChunkManager(info.biome);
    return new (flatStructurePopulation(StructurePopulation))({ worldSeed: numeric, manager, world: { rand: new JavaRandom(0n) }, generators: new FlatStructureCache(numeric, manager, info).generators(), info });
  }
  const manager = new ChunkProviderGenerate(numeric, type, new BiomeTerrainState()).manager;
  return new StructurePopulation({ worldSeed: numeric, manager, world: { rand: new JavaRandom(0n) } });
}

// Run the four searches for native chunk coordinates [[cx,cz],...] in provider order.
export function searchStructureStarts({ seed, biome, worldType, generatorOptions, chunks }) {
  const population = structureGenerators({ seed, biome, worldType, generatorOptions });
  const ordered = [...chunks].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (const [cx, cz] of ordered) population.searchChunk(cx, cz);
  return population.generators;
}

// Features entries (key -> start compound tag) of a decoded raw document.
export function featureTags(document) {
  const data = document?.tag?.value?.get("data");
  const features = data?.type === NBT.COMPOUND ? data.value.get("Features") : undefined;
  return features?.type === NBT.COMPOUND ? features.value : new Map();
}
const dataDocument = (entries) => ({ name: "", tag: compoundTag([["data", compoundTag([["Features", compoundTag(entries)]])]]) });

// gzip .dat bytes per file name. `imported` is record.structureData ({Name: base64 gzip}) or undefined.
export async function structureDataFiles({ record, seed, chunks, generationVersion }) {
  const files = new Map(), imported = record?.structureData ?? {};
  const generated = hasStructureData(generationVersion) ? searchStructureStarts({ seed, biome: record.biome, worldType: record.worldType, generatorOptions: record.generatorOptions, chunks }) : null;
  const report = { generated: 0, imported: 0, kept: 0, files: [] };
  for (const [name, dataName] of Object.entries(STRUCTURE_DATA_NAMES)) {
    const entries = new Map();
    if (imported[dataName]) {
      const document = await decodeCompressedNbt(Uint8Array.from(atob(imported[dataName]), (c) => c.charCodeAt(0)));
      for (const [key, tag] of featureTags(document)) { entries.set(key, tag); report.imported++; }
    }
    if (generated) {
      const features = featuresToNbt([...generated[name].structureMap.entries.map((e) => e.value)]).value;
      for (const [key, tag] of features) if (!entries.has(key)) { entries.set(key, tag); report.generated++; }
    }
    if (!generated && !imported[dataName]) continue;
    files.set(`data/${dataName}.dat`, await encodeCompressedNbt(dataDocument([...entries])));
    report.files.push({ name: `data/${dataName}.dat`, starts: entries.size });
  }
  return { files, report };
}

// data/Fortress.dat (MapGenNetherBridge "Fortress"). The Nether provider searches every chunk it provides, so export reruns the
// range-8 fortress search over the exported Nether chunks (native coordinates, no origin shift: the Nether is not offset).
// MapStorage is shared by the three dimensions in 1.7.10 (WorldServerMulti reuses the overworld's), so the file sits in the
// root data/ directory. Starts are written in their created state (pieces keep the flags a fresh generation has); imported
// starts for the same key win, imported-only ones are kept unchanged. Returns the gzip bytes or null.
export async function fortressDataFile({ record, seed, chunks, generationVersion }) {
  const imported = record?.structureData?.[FORTRESS_DATA_NAME], entries = new Map(), report = { generated: 0, imported: 0, starts: 0 };
  if (imported) {
    const document = await decodeCompressedNbt(Uint8Array.from(atob(imported), (c) => c.charCodeAt(0)));
    for (const [key, tag] of featureTags(document)) { entries.set(key, tag); report.imported++; }
  }
  if (hasStructureData(generationVersion) && chunks.length) {
    const bridge = new MapGenNetherBridge(javaSeed(seed));
    for (const [cx, cz] of [...chunks].sort((a, b) => a[0] - b[0] || a[1] - b[1])) bridge.generate(cx, cz);
    for (const [key, tag] of featuresToNbt(bridge.structureMap.entries.map((e) => e.value)).value) if (!entries.has(key)) { entries.set(key, tag); report.generated++; }
  }
  if (!imported && !report.generated) return null;
  report.starts = entries.size;
  return { name: `data/${FORTRESS_DATA_NAME}.dat`, bytes: await encodeCompressedNbt(dataDocument([...entries])), report };
}

// Import side: parse data/*.dat. Keeps the gzip bytes (base64) and counts starts and ids; never throws on unknown ids.
export async function parseStructureDataFiles(inputs) {
  const structureData = {}, report = { files: [], starts: 0, unknownIds: {}, invalid: [] };
  const known = new Set(["Mineshaft", "Village", "Stronghold", "Temple", "Fortress"]);
  for (const { filename, bytes } of inputs) {
    const m = /^(?:.*\/)?([A-Za-z]+)\.dat$/.exec(filename);
    if (!m) continue;
    try {
      const document = await decodeCompressedNbt(bytes);
      const features = featureTags(document), counts = {};
      for (const [, tag] of features) {
        if (tag.type !== NBT.COMPOUND) continue;
        const id = tag.value.get("id")?.value ?? "";
        counts[id] = (counts[id] ?? 0) + 1; report.starts++;
        if (!known.has(id)) report.unknownIds[id] = (report.unknownIds[id] ?? 0) + 1;
      }
      let bin = ""; for (const b of bytes) bin += String.fromCharCode(b);
      structureData[m[1]] = btoa(bin);
      report.files.push({ name: filename, starts: features.size, ids: counts });
    } catch (error) { report.invalid.push({ name: filename, error: String(error?.message ?? error) }); }
  }
  return { structureData, report };
}
