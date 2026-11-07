// Finite playable adapter for GEN-01..03. Original chunk coordinates and native arrays stay in the generator;
// the live world retains its internal block IDs and finite 128x128 horizontal bounds.
import {
  ChunkProviderGenerate,
  BiomeTerrainState,
} from "./terrain-generator.js";
import { MapGenCaves, MapGenRavine } from "./mapgen.js";
import { JavaRandom } from "./java-random.js";
import { BIOMES_TO_SPAWN_IN } from "./biome-layers.js";
import { stringHash } from "./java-long.js";
import { NoiseGeneratorPerlin } from "./noise.js";
import { generateLiveMineshafts } from "./mineshaft-world.js";
import { generateLivePopulation, populationBlockMapper } from './population-world.js';
import { FlatChunkProvider, parseFlatInfo } from './flat-world.js';
import { StreamingPopulation } from './streaming-population.js';
import { createSpawnPosition } from './world-spawn.js';
export const JAVA_TERRAIN_BLOCKS = Object.freeze({
  0: 0,
  1: 3,
  2: 1,
  3: 2,
  7: 11,
  8: 10,
  9: 10,
  10: 42,
  11: 42,
  12: 6,
  13: 25,
  24: 56,
  79: 47,
  80: 23,
  110: 57,
  111: 59,
  159: 58,
  172: 40,
});
const f = Math.fround,
  temperatureNoise = new NoiseGeneratorPerlin(new JavaRandom(1234n), 1);
export const JAVA_LANDSCAPES = Object.freeze({
  java: "default",
  javaAmplified: "amplified",
  javaLargeBiomes: "largeBiomes",
  javaStreamed: "default",
});
// WorldType of a streamed world: the 1.7.10 DEFAULT, FLAT, LARGE_BIOMES, AMPLIFIED or DEFAULT_1_1 generator (anything else is DEFAULT).
// DEFAULT_1_1 only comes from an imported level.dat (level-dat.js): ChunkProviderGenerate treats it as DEFAULT, its biome layers differ.
export const STREAMED_WORLD_TYPES = Object.freeze(['default', 'largeBiomes', 'amplified', 'flat', 'default_1_1']);
export const streamedWorldType = (type) => STREAMED_WORLD_TYPES.includes(type) ? type : 'default';
export const isJavaLandscape = (biome) => Object.hasOwn(JAVA_LANDSCAPES, biome);
export function javaSeed(value) {
  const text = String(value);
  if (/^[+-]?\d+$/.test(text)) {
    const n = BigInt(text);
    if (n >= -(1n << 63n) && n < 1n << 63n) return n;
  }
  return BigInt(stringHash(text));
}
export function javaTemperature(b, x, y, z) {
  if (y <= 64) return b.temperature;
  const n = f(f(temperatureNoise.value(x / 8, z / 8)) * 4);
  return f(b.temperature - f(f(f(f(n + f(y)) - 64) * f(0.05)) / 30));
}
// The generator of a streamed world: ChunkProviderFlat for WorldType.FLAT (its generatorOptions string), else ChunkProviderGenerate.
// Generation 16 compares mutated biomes by their base biome's class, as natively; older worlds keep the earlier biome map.
export const NATIVE_BIOME_CLASS_GENERATION = 16;
// No version (tools, tests) is the native rule.
// Generation 17: MapFeatures off, population without any structure generator (and the native biome rule of 16).
export const NO_MAP_FEATURES_GENERATION = 17;
// Generation 18 is 16 plus the native world spawn (world-spawn.js createSpawnPosition, which also moves the origin chunk); 19 is 17 plus it.
// Worlds saved at 12 to 17 keep the repository's findBiomePosition-only origin, since the origin decides where every block lies.
export const NATIVE_SPAWN_GENERATION = 18;
export const nativeSpawnGeneration = (generationVersion) => generationVersion >= NATIVE_SPAWN_GENERATION;
// MapFeatures is off at 17 and 19.
export const mapFeaturesOn = (generationVersion) => generationVersion !== NO_MAP_FEATURES_GENERATION && generationVersion !== NO_MAP_FEATURES_GENERATION + 2;
export const biomeLayerOptions = (generationVersion) => ({ legacyMutated: generationVersion !== undefined && generationVersion < NATIVE_BIOME_CLASS_GENERATION });
const newGenerator = (seed, worldType, generatorOptions, generationVersion) => worldType === 'flat'
  ? new FlatChunkProvider(parseFlatInfo(generatorOptions))
  : new ChunkProviderGenerate(seed, streamedWorldType(worldType), new BiomeTerrainState(), biomeLayerOptions(generationVersion));
// Superflat: no caves, ravines or noise; every column is the preset's layers. Generation 15 or later (its population runs
// ChunkProviderFlat's structure list and populate, flat-structures.js).
function flatSource({ seed, generationVersion, originX, originZ, gen }) {
  if (generationVersion < 15) throw new Error('Superflat worlds need streamed generation version 15');
  let live = null;
  const liveColumn = () => {
    const mapBlock = populationBlockMapper();
    if (!mapBlock) throw new Error('original block mapper not ready');
    const blocks = new Uint8Array(256), metadata = new Uint8Array(256);
    for (let y = 0; y < 256; y++) {
      if (!gen.column[y] && !gen.columnMeta[y]) continue;
      const m = mapBlock(gen.column[y], gen.columnMeta[y]);
      if (!m?.exact || m.id > 255) throw new Error(`Unmapped Superflat block ${gen.column[y]}:${gen.columnMeta[y]}`);
      blocks[y] = m.id; metadata[y] = m.meta;
    }
    return { blocks, metadata };
  };
  const terrain = () => {
    const col = (live ??= liveColumn()), blocks = new Uint8Array(65536), metadata = new Uint8Array(65536);
    for (let c = 0; c < 256; c++) { blocks.set(col.blocks, c * 256); metadata.set(col.metadata, c * 256); }
    return { blocks, metadata };
  };
  const population = new StreamingPopulation({
    seed, originX, originZ, terrainOnly: terrain, terrain: (x, z) => gen.provideChunk(x, z), biomeAt: (x, z) => gen.manager.biomeAt(x, z),
    manager: gen.manager, flat: gen.info, mapFeatures: mapFeaturesOn(generationVersion),
  });
  return { gen, population, column: (cx, cz) => population.column(cx, cz) };
}
// The streamed generator chain at local chunk coordinates (native chunk = local + origin / 16).
// Generation 12 is terrain, caves and ravines with live block ids; 13 populates per cell
// (streaming-population.js). `column(cx, cz)` returns { blocks, metadata } in WorldChunk order.
export function streamedSource({ seed, generationVersion, originX, originZ, worldType = 'default', generatorOptions = '', gen = newGenerator(seed, worldType, generatorOptions, generationVersion) }) {
  if (gen instanceof FlatChunkProvider) return flatSource({ seed, generationVersion, originX, originZ, gen });
  const manager = gen.manager, topAt = (x, z) => gen.biomeState.topBlock(manager.biomeAt(x, z)),
    caves = new MapGenCaves(seed, manager, topAt),
    ravines = new MapGenRavine(seed, manager, topAt);
  const original = (x, z) => {
    const chunk = gen.provideChunk(x, z);
    caves.generate(x, z, chunk.blocks); ravines.generate(x, z, chunk.blocks);
    return chunk;
  };
  const terrain = (cx, cz) => {
    const chunk = original(cx + originX / 16, cz + originZ / 16);
    for (let i = 0; i < chunk.blocks.length; i++) {
      const id = JAVA_TERRAIN_BLOCKS[chunk.blocks[i]];
      if (id === undefined) throw new Error(`Unmapped Java terrain block ${chunk.blocks[i]}`);
      chunk.blocks[i] = id;
    }
    return chunk;
  };
  if (generationVersion < 13) return { gen, population: null, column: terrain };
  const population = new StreamingPopulation({
    seed, originX, originZ, terrainOnly: terrain, terrain: original, biomeAt: (x, z) => manager.biomeAt(x, z),
    manager: generationVersion >= 15 ? manager : null, mapFeatures: mapFeaturesOn(generationVersion),
  });
  return { gen, population, column: (cx, cz) => population.column(cx, cz) };
}
// WorldServer.createSpawnPosition over the generator's own columns (terrain, caves and ravines; no population, as natively the walk
// loads isolated chunks). Superflat has one column everywhere.
export function nativeWorldSpawn(gen, seed, state, worldType) {
  if (gen instanceof FlatChunkProvider) {
    const blockAt = (x, y, z) => y < 0 || y >= 256 ? 0 : gen.column[y];
    return { ...createSpawnPosition({ seed, manager: gen.manager, blockAt, averageGroundLevel: 4 }), blockAt };
  }
  const manager = gen.manager, topAt = (x, z) => state.topBlock(manager.biomeAt(x, z)),
    caves = new MapGenCaves(seed, manager, topAt), ravines = new MapGenRavine(seed, manager, topAt), raw = new Map(), carved = new Map();
  const rawChunk = (cx, cz) => {
    const key = cx * 4294967296 + cz;
    let chunk = raw.get(key);
    if (!chunk) raw.set(key, chunk = gen.provideChunk(cx, cz));
    return chunk;
  };
  const blockAt = (x, y, z) => {
    if (y < 0 || y >= 256) return 0;
    const cx = x >> 4, cz = z >> 4, key = cx * 4294967296 + cz;
    let chunk = carved.get(key);
    if (!chunk) {
      chunk = { blocks: Uint8Array.from(rawChunk(cx, cz).blocks) };
      caves.generate(cx, cz, chunk.blocks); ravines.generate(cx, cz, chunk.blocks);
      carved.set(key, chunk);
    }
    return chunk.blocks[((x & 15) * 16 + (z & 15)) * 256 + y];
  };
  // Caves and ravines only remove blocks, and grass is only ever the top of a generated column, so a column that is not grass-topped
  // before carving cannot become a spawn column after it: the check runs on the uncarved chunk first, exactly.
  const mayBeSpawn = (x, z) => {
    const blocks = rawChunk(x >> 4, z >> 4).blocks, base = ((x & 15) * 16 + (z & 15)) * 256;
    let k = 63;
    while (blocks[base + k + 1] !== 0 && k < 254) k++;
    return k === 254 ? true : blocks[base + k] === 2;
  };
  return { ...createSpawnPosition({ seed, manager, blockAt, mayBeSpawn, averageGroundLevel: 64 }), blockAt };
}
// A spawn solved ahead of the World constructor (spawn-presolve.js runs this in a worker). The key is the world's inputs; the result is the
// same function of them, so using it changes nothing but when the work happens.
export const presolvedSpawns = new Map();
export const spawnKey = (seed, generationVersion, worldType, generatorOptions) => `${javaSeed(seed)}|${generationVersion}|${worldType}|${generatorOptions}`;
export function solveNativeSpawn({ seed, generationVersion, worldType, generatorOptions }) {
  const s = javaSeed(seed), gen = newGenerator(s, worldType, generatorOptions, generationVersion);
  const { x, y, z, foundBiome, steps } = nativeWorldSpawn(gen, s, gen.biomeState ?? new BiomeTerrainState(), worldType);
  return { x, y, z, foundBiome, steps };
}
export function generateJavaWorld(world) {
  const seed = javaSeed(world.seed),
    state = new BiomeTerrainState(),
    gen = world.streaming && world.worldType === 'flat'
      ? new FlatChunkProvider(parseFlatInfo(world.generatorOptions))
      : new ChunkProviderGenerate(seed, world.streaming ? world.worldType : JAVA_LANDSCAPES[world.biome], state, biomeLayerOptions(world.generationVersion)),
    manager = gen.manager;
  let spawn = null;
  if (world.streaming && nativeSpawnGeneration(world.generationVersion)) {
    const key = spawnKey(world.seed, world.generationVersion, world.worldType, world.generatorOptions);
    const native = presolvedSpawns.get(key) ?? nativeWorldSpawn(gen, seed, state, world.worldType);
    presolvedSpawns.delete(key);
    world.nativeSpawn = [native.x, native.y, native.z];
    spawn = [native.x, 0, native.z];
  } else spawn = manager.findBiomePosition(
    0,
    0,
    256,
    BIOMES_TO_SPAWN_IN,
    new JavaRandom(seed),
  );
  world.originX = ((spawn ? spawn[0] >> 4 : 0) - 4) * 16;
  world.originZ = ((spawn ? spawn[2] >> 4 : 0) - 4) * 16;
  world.javaSeed = seed;
  world.javaGenerator = gen;
  world.biomeIds = new Uint8Array(128 * 128);
  world.biomeAt = (x, z) =>
    manager.biomeAt(x + world.originX, z + world.originZ);
  world.temperatureAt = (x, y, z) =>
    javaTemperature(
      world.biomeAt(x, z),
      x + world.originX,
      y,
      z + world.originZ,
    );
  const topAt = (x, z) => state.topBlock(manager.biomeAt(x, z)),
    caves = new MapGenCaves(seed, manager, topAt),
    ravines = new MapGenRavine(seed, manager, topAt);
  // Streamed worlds regenerate columns from the seed. Columns the worker (streaming-generator.js)
  // built ahead of the player wait in `pregenerated` and are used once; it runs the same chain.
  if (world.streaming) {
    const source = streamedSource({ seed, gen, worldType: world.worldType, generatorOptions: world.generatorOptions, originX: world.originX, originZ: world.originZ, generationVersion: world.generationVersion });
    if (source.population) world.population = source.population;
    world.pregenerated = new Map();
    world.generateTerrainChunk = (cx, cz) => {
      const k = `${cx},${cz}`, hit = world.pregenerated.get(k);
      if (!hit) return source.column(cx, cz);
      world.pregenerated.delete(k);
      return hit;
    };
    if (source.population) {
      for (let cx = 0; cx < 8; cx++) for (let cz = 0; cz < 8; cz++) {
        const column = source.population.column(cx, cz), live = world.chunkAt(cx, cz);
        live.blocks.set(column.blocks); live.meta.set(column.metadata);
      }
      return;
    }
  }
  // Generation version 10 adds mineshafts (mineshaft-world.js), which need the original-ID chunks.
  const originals = world.generationVersion >= 10 ? new Map() : null;
  for (let cx = 0; cx < 8; cx++)
    for (let cz = 0; cz < 8; cz++) {
      const chunk = gen.provideChunk(
        cx + world.originX / 16,
        cz + world.originZ / 16,
      );
      caves.generate(chunk.x, chunk.z, chunk.blocks);
      ravines.generate(chunk.x, chunk.z, chunk.blocks);
      originals?.set(`${chunk.x},${chunk.z}`, chunk);
      const live = world.chunkAt(cx, cz);
      for (let i = 0; i < 65536; i++) {
        const id = JAVA_TERRAIN_BLOCKS[chunk.blocks[i]];
        if (id === undefined)
          throw new Error(`Unmapped Java terrain block ${chunk.blocks[i]}`);
        live.blocks[i] = id;
        live.meta[i] = chunk.metadata[i];
      }
      for (let x = 0; x < 16; x++)
        for (let z = 0; z < 16; z++)
          world.biomeIds[(cx * 16 + x) * 128 + cz * 16 + z] =
            chunk.biomes[x + z * 16];
    }
  if (world.streaming) return;
  if (world.generationVersion >= 11)
    generateLivePopulation(world, {seed, originals, ringTerrain: (x,z) => {
      const chunk=gen.provideChunk(x,z); caves.generate(x,z,chunk.blocks); ravines.generate(x,z,chunk.blocks); return chunk;
    }});
  else if (originals)
    generateLiveMineshafts(world, {
      seed,
      originals,
      ringTerrain: (x, z) => {
        const chunk = gen.provideChunk(x, z);
        caves.generate(chunk.x, chunk.z, chunk.blocks);
        ravines.generate(chunk.x, chunk.z, chunk.blocks);
        return chunk;
      },
    });
}
