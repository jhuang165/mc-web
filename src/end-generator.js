// Minecraft Java 1.7.10 End terrain and population, ported from the unchanged original classes (see
// public/research/end.md, evidence in public/research/end-reference.json from tools/verify-end.mjs):
//   ChunkProviderEnd (ara)  density grid, trilinear fill of end stone, per-chunk reseed
//   BiomeEndDecorator (aiy) ores (random draws only), WorldGenSpikes at 1 in 5 chunks, the dragon at chunk 0,0
//   WorldGenSpikes (asl)    obsidian pillar, ender crystal on a bedrock cap
// Original numeric block IDs throughout (end stone 121, obsidian 49, bedrock 7); the live game maps them
// through block-registry.js. Pure: no DOM, no live dimension switching. The world is an adapter:
//   getBlock(x,y,z) -> original id        setBlock(x,y,z,id,meta,flags)
//   getTopSolidOrLiquidBlock(x,z)         spawnEntity({type,x,y,z,yaw,pitch})   (optional isAirBlock)
// EndWorld below is a self-contained adapter (lazy chunks) used by the tests and as a reference.
import { JavaRandom } from "./java-random.js";
import { NoiseGeneratorOctaves } from "./noise.js";
import { generateOres } from "./ore-generator.js";

export const END_STONE = 121, OBSIDIAN = 49, BEDROCK = 7, DRAGON_EGG = 122, END_PORTAL = 119, FIRE = 51;
export const END_BIOME_ID = 9; // BiomeGenEnd: "Sky", every column of the dimension
export const END_HEIGHT = 128; // ChunkProviderEnd arrays are 16 x 16 x 128
const f = Math.fround;
const long = (v) => BigInt.asIntN(64, BigInt(v));

// ChunkProviderEnd.<init>: five octave sets drawn from one Random in this order.
export class EndTerrain {
  constructor(seed) {
    this.seed = long(seed);
    this.random = new JavaRandom(this.seed);
    this.lower = new NoiseGeneratorOctaves(this.random, 16); // j
    this.upper = new NoiseGeneratorOctaves(this.random, 16); // k
    this.main = new NoiseGeneratorOctaves(this.random, 8); // l
    this.scale = new NoiseGeneratorOctaves(this.random, 10); // a
    this.depth = new NoiseGeneratorOctaves(this.random, 16); // b
  }

  // ChunkProviderEnd.a(double[],x,y,z,3,33,3): the 3 x 33 x 3 density grid, index (x * 3 + z) * 33 + y.
  density(chunkX, chunkZ) {
    const x0 = chunkX * 2, z0 = chunkZ * 2, sx = 3, sy = 33, sz = 3;
    const d8 = 684.412 * 2, d10 = 684.412;
    const sc = this.scale.generate2D(x0, z0, sx, sz, 1.121, 1.121, 0.5, new Float64Array(sx * sz));
    const dp = this.depth.generate2D(x0, z0, sx, sz, 200, 200, 0.5, new Float64Array(sx * sz));
    const n = sx * sy * sz;
    const main = this.main.generate(x0, 0, z0, sx, sy, sz, d8 / 80, d10 / 160, d8 / 80, new Float64Array(n));
    const lo = this.lower.generate(x0, 0, z0, sx, sy, sz, d8, d10, d8, new Float64Array(n));
    const hi = this.upper.generate(x0, 0, z0, sx, sy, sz, d8, d10, d8, new Float64Array(n));
    const out = new Float64Array(n);
    let i = 0, column = 0;
    for (let ix = 0; ix < sx; ix++) for (let iz = 0; iz < sz; iz++) {
      let d16 = (sc[column] + 256) / 512;
      if (d16 > 1) d16 = 1;
      // d18 (the 2D depth term) is computed and then zeroed by the original; only its draw from `dp` is dead.
      void dp[column];
      const fx = f(ix + x0), fz = f(iz + z0);
      let f22 = f(100 - f(f(Math.sqrt(f(f(fx * fx) + f(fz * fz)))) * 8));
      if (f22 > 80) f22 = 80;
      if (f22 < -100) f22 = -100;
      if (d16 < 0) d16 = 0;
      d16 += 0.5;
      column++;
      for (let iy = 0; iy < sy; iy++) {
        const d30 = lo[i] / 512, d32 = hi[i] / 512, t = (main[i] / 10 + 1) / 2;
        let d = t < 0 ? d30 : t > 1 ? d32 : d30 + (d32 - d30) * t;
        d = d - 8 + f22;
        if (iy > 16 - 2) { // top falloff over 64ths toward -3000
          let r = (iy - 14) / 64;
          if (r < 0) r = 0;
          if (r > 1) r = 1;
          d = d * (1 - r) + -3000 * r;
        }
        if (iy < 8) { // bottom falloff toward -30
          const r = f(f(8 - iy) / f(8 - 1));
          d = d * (1 - r) + -30 * r;
        }
        out[i++] = d;
      }
    }
    return out;
  }

  // ChunkProviderEnd.a(x,z,blocks,biomes): trilinear fill, 4 x 8 x 8 cells per grid cell, end stone where
  // the interpolated density is positive. Index x << 11 | z << 7 | y, value END_STONE or 0 (air).
  // The surface pass (method b) only rewrites stone (id 1) and so is a no-op on this array.
  blocks(chunkX, chunkZ) {
    const n = this.density(chunkX, chunkZ), out = new Uint8Array(32768);
    const g = (x, z, y) => n[(x * 3 + z) * 33 + y];
    for (let gx = 0; gx < 2; gx++) for (let gz = 0; gz < 2; gz++) for (let gy = 0; gy < 32; gy++) {
      let d14 = g(gx, gz, gy), d16 = g(gx, gz + 1, gy), d18 = g(gx + 1, gz, gy), d20 = g(gx + 1, gz + 1, gy);
      const d22 = (g(gx, gz, gy + 1) - d14) * 0.25, d24 = (g(gx, gz + 1, gy + 1) - d16) * 0.25;
      const d26 = (g(gx + 1, gz, gy + 1) - d18) * 0.25, d28 = (g(gx + 1, gz + 1, gy + 1) - d20) * 0.25;
      for (let sy = 0; sy < 4; sy++) {
        let d33 = d14, d35 = d16;
        const d37 = (d18 - d14) * 0.125, d39 = (d20 - d16) * 0.125;
        for (let sx = 0; sx < 8; sx++) {
          let idx = (sx + gx * 8) << 11 | gz * 8 << 7 | (gy * 4 + sy), d46 = d33;
          const d48 = (d35 - d33) * 0.125;
          for (let sz = 0; sz < 8; sz++) {
            out[idx] = d46 > 0 ? END_STONE : 0;
            idx += 128;
            d46 += d48;
          }
          d33 += d37;
          d35 += d39;
        }
        d14 += d22; d16 += d24; d18 += d26; d20 += d28;
      }
    }
    return out;
  }
}

// The decimal "per chunk reseed" of ChunkProviderEnd.provideChunk; not needed by blocks() (the noise is
// already seeded) but kept for callers that mirror the original Random state.
export const chunkReseed = (chunkX, chunkZ) => long(BigInt(chunkX) * 341873128712n + BigInt(chunkZ) * 132897987541n);

const BLOCKS_MOVEMENT_FREE = new Set([0, 8, 9, 10, 11, 50, 51, 119]);
const isMovementBlocking = (id) => !BLOCKS_MOVEMENT_FREE.has(id);

// A self-contained 16 x 256 x 16 chunk store with lazily generated End terrain. Only what the End
// population touches: World.setBlock bounds and "unchanged" result, getBlock, getTopSolidOrLiquidBlock.
export class EndWorld {
  constructor(seed, random = new JavaRandom(0)) {
    this.terrain = new EndTerrain(seed);
    this.random = random;
    this.chunks = new Map();
    this.entities = [];
    this.onSet = null;
  }
  chunk(cx, cz) {
    const key = `${cx},${cz}`;
    let c = this.chunks.get(key);
    if (!c) {
      const ids = new Uint8Array(16 * 16 * 256), meta = new Uint8Array(16 * 16 * 256), base = this.terrain.blocks(cx, cz);
      for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 0; y < END_HEIGHT; y++) ids[x << 12 | z << 8 | y] = base[x << 11 | z << 7 | y];
      c = { cx, cz, ids, meta };
      this.chunks.set(key, c);
    }
    return c;
  }
  getBlock(x, y, z) {
    if (y < 0 || y >= 256) return 0;
    return this.chunk(x >> 4, z >> 4).ids[(x & 15) << 12 | (z & 15) << 8 | y];
  }
  getMeta(x, y, z) {
    if (y < 0 || y >= 256) return 0;
    return this.chunk(x >> 4, z >> 4).meta[(x & 15) << 12 | (z & 15) << 8 | y];
  }
  isAirBlock(x, y, z) { return this.getBlock(x, y, z) === 0; }
  // `onSet` sees every call (like the probe's call log), with the World.setBlock result as the last argument.
  setBlock(x, y, z, id, meta = 0, flags = 3) {
    let ok = false;
    if (x >= -30000000 && x < 30000000 && z >= -30000000 && z < 30000000 && y >= 0 && y < 256) {
      const c = this.chunk(x >> 4, z >> 4), i = (x & 15) << 12 | (z & 15) << 8 | y;
      if (c.ids[i] !== id || c.meta[i] !== meta) { c.ids[i] = id; c.meta[i] = meta; ok = true; }
    }
    this.onSet?.(x, y, z, id, meta, flags, ok);
    return ok;
  }
  // World.getTopSolidOrLiquidBlock (ahb.i): one above the highest movement-blocking, non-leaf block.
  getTopSolidOrLiquidBlock(x, z) {
    const c = this.chunk(x >> 4, z >> 4);
    for (let y = 255; y > 0; y--) if (isMovementBlocking(c.ids[(x & 15) << 12 | (z & 15) << 8 | y])) return y + 1;
    return -1;
  }
  spawnEntity(e) { this.entities.push(e); return true; }
  // Chunk bytes in ChunkProviderEnd's x << 11 | z << 7 | y order, heights 0..127 (what the evidence hashes).
  chunkBytes(cx, cz) {
    const c = this.chunk(cx, cz), out = new Uint8Array(32768);
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 0; y < END_HEIGHT; y++) out[x << 11 | z << 7 | y] = c.ids[x << 12 | z << 8 | y];
    return out;
  }
}

const air = (world, x, y, z) => (world.isAirBlock ? world.isAirBlock(x, y, z) : world.getBlock(x, y, z) === 0);

// WorldGenSpikes.generate. Returns false before any draw when the spot is not air on end stone, after the
// two draws (height 6..37, radius 1..4) when any cell under the disc is not end stone.
export function generateSpike(world, random, x, y, z) {
  if (!air(world, x, y, z) || world.getBlock(x, y - 1, z) !== END_STONE) return false;
  const height = random.nextInt(32) + 6, radius = random.nextInt(4) + 1;
  for (let i = x - radius; i <= x + radius; i++) for (let j = z - radius; j <= z + radius; j++) {
    const dx = i - x, dz = j - z;
    if (dx * dx + dz * dz <= radius * radius + 1 && world.getBlock(i, y - 1, j) !== END_STONE) return false;
  }
  for (let yy = y; yy < y + height && yy < 256; yy++) {
    for (let i = x - radius; i <= x + radius; i++) for (let j = z - radius; j <= z + radius; j++) {
      const dx = i - x, dz = j - z;
      if (dx * dx + dz * dz <= radius * radius + 1) world.setBlock(i, yy, j, OBSIDIAN, 0, 2);
    }
  }
  // EntityEnderCrystal.setLocationAndAngles: posY = y + yOffset (1.0), yaw from the same Random.
  const yaw = f(random.nextFloat() * 360);
  world.spawnEntity({ type: "ender_crystal", x: f(x + 0.5), y: y + height + 1, z: f(z + 0.5), yaw, pitch: 0, spike: { x, y: y + height, z, radius, height } });
  world.setBlock(x, y + height, z, BEDROCK, 0, 2);
  return true;
}

// BiomeEndDecorator.decorate for the chunk whose origin is (blockX, blockZ), on the world Random:
// ores (target stone, so only the draws survive), a spike with probability 1/5 at a random column of the
// (+8, +8) area, and the Ender Dragon spawn at chunk (0, 0). `ores` may be replaced by a no-op for callers
// that do not need the stream to stay aligned.
export function decorateEnd(world, random, blockX, blockZ, ores = generateOres) {
  ores(world, random, blockX, blockZ);
  if (random.nextInt(5) === 0) {
    const x = blockX + random.nextInt(16) + 8, z = blockZ + random.nextInt(16) + 8;
    generateSpike(world, random, x, world.getTopSolidOrLiquidBlock(x, z), z);
  }
  if (blockX === 0 && blockZ === 0) {
    world.spawnEntity({ type: "ender_dragon", x: 0, y: 128, z: 0, yaw: f(random.nextFloat() * 360), pitch: 0 });
  }
}

// ChunkProviderEnd.populate: fall-instantly mode brackets the decoration (irrelevant to End blocks, which
// never fall; the flag is reported for callers whose adapter runs falling blocks).
export function populateEndChunk(world, random, chunkX, chunkZ, ores = generateOres) {
  decorateEnd(world, random, chunkX * 16, chunkZ * 16, ores);
}
