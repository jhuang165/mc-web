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
const newGenerator = (seed, worldType, generatorOptions) => worldType === 'flat'
  ? new FlatChunkProvider(parseFlatInfo(generatorOptions))
  : new ChunkProviderGenerate(seed, streamedWorldType(worldType), new BiomeTerrainState());
// Superflat: no caves, ravines or noise; every column is the preset's layers. Generation 15 only (its population runs
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
    manager: gen.manager, flat: gen.info,
  });
  return { gen, population, column: (cx, cz) => population.column(cx, cz) };
}
// The streamed generator chain at local chunk coordinates (native chunk = local + origin / 16).
// Generation 12 is terrain, caves and ravines with live block ids; 13 populates per cell
// (streaming-population.js). `column(cx, cz)` returns { blocks, metadata } in WorldChunk order.
export function streamedSource({ seed, generationVersion, originX, originZ, worldType = 'default', generatorOptions = '', gen = newGenerator(seed, worldType, generatorOptions) }) {
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
    manager: generationVersion >= 15 ? manager : null,
  });
  return { gen, population, column: (cx, cz) => population.column(cx, cz) };
}
export function generateJavaWorld(world) {
  const seed = javaSeed(world.seed),
    state = new BiomeTerrainState(),
    gen = world.streaming && world.worldType === 'flat'
      ? new FlatChunkProvider(parseFlatInfo(world.generatorOptions))
      : new ChunkProviderGenerate(seed, world.streaming ? world.worldType : JAVA_LANDSCAPES[world.biome], state),
    manager = gen.manager;
  const spawn = manager.findBiomePosition(
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
