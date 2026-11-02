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
});
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
export function generateJavaWorld(world) {
  const seed = javaSeed(world.seed),
    state = new BiomeTerrainState(),
    gen = new ChunkProviderGenerate(seed, JAVA_LANDSCAPES[world.biome], state),
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
  if (originals)
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
