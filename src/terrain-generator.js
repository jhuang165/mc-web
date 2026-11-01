// GEN-02: unchanged 1.7.10 ChunkProviderGenerate up to (but excluding) MapGenCaves.
// Original numeric block IDs, air=0; index=(x*16+z)*256+y. Surfaces deliberately transpose x/z.
import { JavaRandom } from "./lighting.js";
import { WorldChunkManager } from "./biome-layers.js";
import { getBiome } from "./java-biomes.js";
import { NoiseGeneratorOctaves, NoiseGeneratorPerlin } from "./noise.js";
const f = Math.fround;
const swampNoise = new NoiseGeneratorPerlin(new JavaRandom(2345n), 1);
export const chunkSeed = (x, z) =>
  BigInt.asIntN(64, BigInt(x) * 341873128712n + BigInt(z) * 132897987541n);
export const terrainIndex = (x, y, z) => (x * 16 + z) * 256 + y;
export class BiomeTerrainState {
  constructor() {
    this.mesas = new Map();
  }
  mesa(slot, seed) {
    let m = this.mesas.get(slot);
    if (!m) {
      m = { seed: 0n };
      this.mesas.set(slot, m);
    }
    if (!m.bands || m.seed !== seed) {
      const r = new JavaRandom(seed);
      m.bands = new Uint8Array(64).fill(16);
      m.bandNoise = new NoiseGeneratorPerlin(r, 1);
      for (let i = 0; i < 64; i++) {
        i += r.nextInt(5) + 1;
        if (i < 64) m.bands[i] = 1;
      }
      for (const [colour, min] of [
        [4, 1],
        [12, 2],
        [14, 1],
      ]) {
        const count = r.nextInt(4) + 2;
        for (let i = 0; i < count; i++) {
          const len = r.nextInt(3) + min,
            start = r.nextInt(64);
          for (let j = 0; j < len && start + j < 64; j++)
            m.bands[start + j] = colour;
        }
      }
      const count = r.nextInt(3) + 3;
      let pos = 0;
      for (let i = 0; i < count; i++) {
        pos += r.nextInt(16) + 4;
        if (pos < 64) {
          m.bands[pos] = 0;
          if (pos > 1 && r.nextBoolean()) m.bands[pos - 1] = 8;
          if (pos < 63 && r.nextBoolean()) m.bands[pos + 1] = 8;
        }
      }
    }
    // ail.a(long) does not assign aD: Bryce noise on a seed change is built from the PREVIOUS seed.
    if (!m.pillar || !m.roof || m.seed !== seed) {
      const r = new JavaRandom(m.seed);
      m.pillar = new NoiseGeneratorPerlin(r, 4);
      m.roof = new NoiseGeneratorPerlin(r, 1);
    }
    m.seed = seed;
    return m;
  }
}
const sharedBiomeState = new BiomeTerrainState();
export class ChunkProviderGenerate {
  constructor(seed, type = "default", biomeState = sharedBiomeState) {
    this.seed = BigInt.asIntN(64, BigInt(seed));
    this.type = type;
    this.biomeState = biomeState;
    this.manager = new WorldChunkManager(this.seed, type);
    this.random = new JavaRandom(this.seed);
    const r = this.random;
    this.lower = new NoiseGeneratorOctaves(r, 16);
    this.upper = new NoiseGeneratorOctaves(r, 16);
    this.selector = new NoiseGeneratorOctaves(r, 8);
    this.surface = new NoiseGeneratorPerlin(r, 4);
    this.scale = new NoiseGeneratorOctaves(r, 10);
    this.depth = new NoiseGeneratorOctaves(r, 16);
    this.mob = new NoiseGeneratorOctaves(r, 8);
    this.parabolic = new Float32Array(25);
    for (let x = -2; x <= 2; x++)
      for (let z = -2; z <= 2; z++)
        this.parabolic[x + 2 + (z + 2) * 5] = f(
          10 / f(Math.sqrt(f(x * x + z * z + f(0.2)))),
        );
  }
  density(cx, cz) {
    const x = (cx * 4) | 0,
      z = (cz * 4) | 0,
      biomes = this.manager.biomesForGeneration(
        (x - 2) | 0,
        (z - 2) | 0,
        10,
        10,
      );
    const depth = this.depth.generate2D(x, z, 5, 5, 200, 200, 0.5);
    const selector = this.selector.generate(
      x,
      0,
      z,
      5,
      33,
      5,
      8.555150000000001,
      4.277575000000001,
      8.555150000000001,
    );
    const lo = this.lower.generate(
        x,
        0,
        z,
        5,
        33,
        5,
        684.412,
        684.412,
        684.412,
      ),
      hi = this.upper.generate(x, 0, z, 5, 33, 5, 684.412, 684.412, 684.412);
    const out = new Float64Array(825);
    let i = 0,
      j = 0;
    for (let ix = 0; ix < 5; ix++)
      for (let iz = 0; iz < 5; iz++) {
        let variation = 0,
          height = 0,
          weight = 0;
        const centre = biomes[ix + 2 + (iz + 2) * 10];
        for (let dx = -2; dx <= 2; dx++)
          for (let dz = -2; dz <= 2; dz++) {
            const b = biomes[ix + dx + 2 + (iz + dz + 2) * 10];
            let h = b.rootHeight,
              v = b.heightVariation;
            if (this.type === "amplified" && h > 0) {
              h = f(1 + f(h * 2));
              v = f(1 + f(v * 4));
            }
            let w = f(this.parabolic[dx + 2 + (dz + 2) * 5] / f(h + 2));
            if (b.rootHeight > centre.rootHeight) w = f(w / 2);
            variation = f(variation + f(v * w));
            height = f(height + f(h * w));
            weight = f(weight + w);
          }
        variation = f(variation / weight);
        height = f(height / weight);
        variation = f(f(variation * f(0.9)) + f(0.1));
        height = f(f(f(height * 4) - 1) / 8);
        let d = depth[j++] / 8000;
        if (d < 0) d = -d * 0.3;
        d = d * 3 - 2;
        if (d < 0) {
          d /= 2;
          if (d < -1) d = -1;
          d /= 1.4;
          d /= 2;
        } else {
          if (d > 1) d = 1;
          d /= 8;
        }
        const h = ((height + d * 0.2) * 8.5) / 8,
          mid = 8.5 + h * 4;
        for (let y = 0; y < 33; y++, i++) {
          let slope = ((y - mid) * 12 * 128) / 256 / variation;
          if (slope < 0) slope *= 4;
          const a = lo[i] / 512,
            b = hi[i] / 512,
            t = (selector[i] / 10 + 1) / 2;
          let value = (t < 0 ? a : t > 1 ? b : a + (b - a) * t) - slope;
          if (y > 29) {
            const fade = f((y - 29) / 3);
            value = value * (1 - fade) + -10 * fade;
          }
          out[i] = value;
        }
      }
    return out;
  }
  generateTerrain(cx, cz, blocks = new Uint16Array(65536)) {
    const q = this.density(cx, cz);
    this.densityField = q;
    for (let x = 0; x < 4; x++)
      for (let z = 0; z < 4; z++)
        for (let y = 0; y < 32; y++) {
          const a = (x * 5 + z) * 33 + y,
            b = a + 33,
            c = ((x + 1) * 5 + z) * 33 + y,
            d = c + 33;
          let A = q[a],
            B = q[b],
            C = q[c],
            D = q[d];
          const da = (q[a + 1] - A) * 0.125,
            db = (q[b + 1] - B) * 0.125,
            dc = (q[c + 1] - C) * 0.125,
            dd = (q[d + 1] - D) * 0.125;
          for (let iy = 0; iy < 8; iy++) {
            let L = A,
              R = B;
            const dl = (C - A) * 0.25,
              dr = (D - B) * 0.25;
            for (let ix = 0; ix < 4; ix++) {
              const step = (R - L) * 0.25;
              let value = L - step;
              for (let iz = 0; iz < 4; iz++) {
                value += step;
                const yy = y * 8 + iy;
                blocks[terrainIndex(x * 4 + ix, yy, z * 4 + iz)] =
                  value > 0 ? 1 : yy < 63 ? 9 : 0;
              }
              L += dl;
              R += dr;
            }
            A += da;
            B += db;
            C += dc;
            D += dd;
          }
        }
    return blocks;
  }
  replaceBlocksForBiome(
    cx,
    cz,
    blocks,
    metadata,
    biomes = this.manager.biomeArea(cx * 16, cz * 16, 16, 16, false),
  ) {
    const noise = this.surface.generate(
      (cx * 16) | 0,
      (cz * 16) | 0,
      16,
      16,
      0.0625,
      0.0625,
      1,
    );
    for (let x = 0; x < 16; x++)
      for (let z = 0; z < 16; z++)
        this.surfaceColumn(
          biomes[z + x * 16],
          blocks,
          metadata,
          (cx * 16 + x) | 0,
          (cz * 16 + z) | 0,
          noise[z + x * 16],
        );
    return biomes;
  }
  provideChunk(x, z) {
    x |= 0;
    z |= 0;
    this.random.setSeed(chunkSeed(x, z));
    const blocks = this.generateTerrain(x, z),
      metadata = new Uint8Array(65536);
    const biomes = this.replaceBlocksForBiome(x, z, blocks, metadata);
    return {
      x,
      z,
      blocks,
      metadata,
      biomes: Uint8Array.from(biomes, (b) => b.id),
    };
  }
  surfaceColumn(b, blocks, meta, x, z, noise, explicitAir = null) {
    // BiomeGenMutated delegates to its original biome, including Swamp's override.
    if (b.cls === "Mutated") b = getBiome(b.slot - 128);
    if (b.cls === "Mesa") return this.mesaColumn(b, blocks, meta, x, z, noise);
    let top = b.topBlock,
      topMeta = b.topMeta,
      filler = b.fillerBlock;
    if (b.cls === "Hills") {
      top = 2;
      topMeta = 0;
      filler = 3;
      if ((noise < -1 || noise > 2) && (b.slot === 131 || b.slot === 162))
        top = filler = 13;
      else if (noise > 1 && ![20, 34].includes(b.slot)) top = filler = 1;
    } else if (b.cls === "Taiga" && [32, 33, 160, 161].includes(b.slot)) {
      top = 2;
      topMeta = 0;
      filler = 3;
      if (noise > 1.75) {
        top = 3;
        topMeta = 1;
      } else if (noise > -0.95) {
        top = 3;
        topMeta = 2;
      }
    } else if (b.cls === "Savanna$Mutated") {
      top = 2;
      topMeta = 0;
      filler = 3;
      if (noise > 1.75) top = filler = 1;
      else if (noise > -0.5) {
        top = 3;
        topMeta = 1;
      }
    }
    const surfaceTop = top,
      surfaceMeta = topMeta,
      surfaceFiller = filler;
    // Biome surface code indexes (localZ*16+localX), opposite to ChunkProviderGenerate's terrain array.
    const base = ((z & 15) * 16 + (x & 15)) * 256,
      r = this.random;
    if (b.cls === "Swamp") {
      // aiv treats null as the stopping cell! Normal terrain's null air stops this scan at y=255.
      // Explicit Blocks.air above a supplied fixture can be distinguished with an optional mask (see below).
      const n = swampNoise.value(x * 0.25, z * 0.25);
      if (n > 0 && explicitAir)
        for (let y = 255; y >= 0; y--) {
          if (explicitAir[base + y]) continue;
          if (y === 62 && blocks[base + y] !== 9) {
            blocks[base + y] = 9;
            if (n < 0.12) blocks[base + y + 1] = 111;
          }
          break;
        }
    }
    let remaining = -1;
    const thickness = Math.trunc(noise / 3 + 3 + r.nextDouble() * 0.25);
    for (let y = 255; y >= 0; y--) {
      const i = base + y;
      if (y <= r.nextInt(5)) {
        blocks[i] = 7;
        continue;
      }
      if (blocks[i] === 0) {
        remaining = -1;
        continue;
      }
      if (blocks[i] !== 1) continue;
      if (remaining === -1) {
        if (thickness <= 0) {
          top = 0;
          topMeta = 0;
          filler = 1;
        } else if (y >= 59 && y <= 64) {
          top = surfaceTop;
          topMeta = surfaceMeta;
          filler = surfaceFiller;
        }
        if (y < 63 && top === 0) {
          top = b.temperature < f(0.15) ? 79 : 9;
          topMeta = 0;
        }
        remaining = thickness;
        if (y >= 62) {
          blocks[i] = top;
          meta[i] = topMeta;
        } else if (y < 56 - thickness) {
          top = 0;
          filler = 1;
          blocks[i] = 13;
        } else blocks[i] = filler;
      } else if (remaining > 0) {
        remaining--;
        blocks[i] = filler;
        if (remaining === 0 && filler === 12) {
          remaining = r.nextInt(4) + Math.max(0, y - 63);
          filler = 24;
        }
      }
    }
  }
  mesaColumn(b, blocks, meta, x, z, noise) {
    const m = this.biomeState.mesa(b.slot, this.seed),
      r = this.random,
      base = ((z & 15) * 16 + (x & 15)) * 256;
    let pillar = 0;
    if (b.slot === 165) {
      const xx = (x & -16) + (z & 15),
        zz = (z & -16) + (x & 15),
        n = Math.min(Math.abs(noise), m.pillar.value(xx * 0.25, zz * 0.25));
      if (n > 0) {
        const roof = Math.abs(m.roof.value(xx * 0.001953125, zz * 0.001953125));
        pillar = Math.min(n * n * 2.5, Math.ceil(roof * 50) + 14) + 64;
      }
    }
    let top = 159,
      filler = b.fillerBlock,
      remaining = -1,
      red = false;
    const thickness = Math.trunc(noise / 3 + 3 + r.nextDouble() * 0.25),
      plain = Math.cos((noise / 3) * Math.PI) > 0;
    // d(x,y,z) uses x for BOTH noise coordinates.
    const offset = Math.floor(m.bandNoise.value(x / 512, x / 512) * 2 + 0.5),
      band = (y) => m.bands[(y + offset + 64) % 64];
    for (let y = 255; y >= 0; y--) {
      const i = base + y;
      if (blocks[i] === 0 && y < Math.trunc(pillar)) blocks[i] = 1;
      if (y <= r.nextInt(5)) {
        blocks[i] = 7;
        continue;
      }
      if (blocks[i] === 0) {
        remaining = -1;
        continue;
      }
      if (blocks[i] !== 1) continue;
      if (remaining === -1) {
        red = false;
        if (thickness <= 0) {
          top = 0;
          filler = 1;
        } else if (y >= 59 && y <= 64) {
          top = 159;
          filler = b.fillerBlock;
        }
        if (y < 63 && top === 0) top = 9;
        remaining = thickness + Math.max(0, y - 63);
        if (y >= 62) {
          if ([38, 166].includes(b.slot) && y > 86 + thickness * 2) {
            blocks[i] = plain ? 3 : 2;
            if (plain) meta[i] = 1;
          } else if (y > 66 + thickness) {
            let colour = 16;
            if (y < 64 || y > 127) colour = 1;
            else if (!plain) colour = band(y);
            blocks[i] = colour < 16 ? 159 : 172;
            if (colour < 16) meta[i] = colour;
          } else {
            blocks[i] = b.topBlock;
            meta[i] = b.topMeta;
            red = true;
          }
        } else {
          blocks[i] = filler;
          if (filler === 159) meta[i] = 1;
        }
      } else if (remaining > 0) {
        remaining--;
        const colour = red ? 1 : band(y);
        blocks[i] = colour < 16 ? 159 : 172;
        if (colour < 16) meta[i] = colour;
      }
    }
  }
}
