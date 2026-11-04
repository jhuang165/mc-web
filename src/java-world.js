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
import { generateLivePopulation } from './population-world.js';
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
// WorldType of a streamed world: the 1.7.10 DEFAULT, LARGE_BIOMES or AMPLIFIED generator (anything else is DEFAULT).
export const STREAMED_WORLD_TYPES = Object.freeze(['default', 'largeBiomes', 'amplified']);
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
// The streamed generator chain at local chunk coordinates (native chunk = local + origin / 16).
// Generation 12 is terrain, caves and ravines with live block ids; 13 populates per cell
// (streaming-population.js). `column(cx, cz)` returns { blocks, metadata } in WorldChunk order.
export function streamedSource({ seed, generationVersion, originX, originZ, worldType = 'default', gen = new ChunkProviderGenerate(seed, streamedWorldType(worldType), new BiomeTerrainState()) }) {
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
    gen = new ChunkProviderGenerate(seed, world.streaming ? world.worldType : JAVA_LANDSCAPES[world.biome], state),
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
    const source = streamedSource({ seed, gen, worldType: world.worldType, originX: world.originX, originZ: world.originZ, generationVersion: world.generationVersion });
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
