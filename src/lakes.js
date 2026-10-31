// Lakes and liquid springs, ported from the 1.7.10 JAR (see public/research/buckets.md):
// ChunkProviderGenerate.populate (aqz.a(ahv, II)V) for the per-chunk random and the water
// and lava lake rolls, WorldGenLakes (arx.a(ahb, Random, III)Z) for the blob and
// WorldGenLiquids (asm.a(ahb, Random, III)Z) with the BiomeDecorator (aia) counts for springs.
// Everything is written as settled blocks (World.put without tracking, the "flag 2" path:
// no neighbour updates, nothing saved, no fluid ticks on load), and `generationVersion` 5
// switches it on, so older saves keep their terrain.
import { SIZE, HEIGHT, SEA, WATER, LAVA } from "./world.js";

const STONE = 3, DIRT = 2, GRASS = 1;
const MASK = (1n << 48n) - 1n, MULT = 0x5deece66dn;

// java.util.Random (the 48-bit LCG), including setSeed and nextLong, which the shared
// JavaRandom in lighting.js does not have.
export class JRandom {
  constructor(seed) { this.setSeed(seed); }
  setSeed(seed) { this.s = (BigInt(seed) ^ MULT) & MASK; }
  next(bits) {
    this.s = (this.s * MULT + 0xbn) & MASK;
    return Number(BigInt.asIntN(32, this.s >> BigInt(48 - bits)));
  }
  nextInt(n) {
    if ((n & -n) === n) return this.next(31) >> Math.clz32(n);
    let bits, val;
    do { bits = this.next(31); val = bits % n; } while (bits - val + (n - 1) > 0x7fffffff);
    return val;
  }
  nextLong() { return BigInt.asIntN(64, (BigInt(this.next(32)) << 32n) + BigInt(this.next(32))); }
  nextDouble() { return (this.next(26) * 134217728 + this.next(27)) / 9007199254740992; }
}

// Vanilla sea level is 63 and lava lakes below it never roll the extra 1-in-10 (`y < 63 ||
// nextInt(10) == 0`). This world's sea level is SEA, so that is the cut used here.
// (Read lazily: world.js imports this module, so nothing from it can be used at load time.)
export const lavaLakeLevel = () => SEA;
const isLiquid = (b) => b === 10 || b === 42;

// WorldGenLakes.generate for a liquid block. (x, y, z) is the decorator's position: the lake
// is a 16 x 8 x 16 box whose corner is (x - 8, y - 4, z - 8) after the downward scan.
export function generateLake(world, rand, x, y, z, liquid) {
  x -= 8; z -= 8;
  while (y > 5 && world.get(x, y, z) === 0) y--;
  if (y <= 4) return false;
  y -= 4;
  const blob = new Uint8Array(2048), at = (i, j, k) => blob[(i * 16 + j) * 8 + k];
  for (let n = rand.nextInt(4) + 4; n > 0; n--) {
    const d0 = rand.nextDouble() * 6 + 3, d1 = rand.nextDouble() * 4 + 2, d2 = rand.nextDouble() * 6 + 3,
      d3 = rand.nextDouble() * (16 - d0 - 2) + 1 + d0 / 2,
      d4 = rand.nextDouble() * (8 - d1 - 4) + 2 + d1 / 2,
      d5 = rand.nextDouble() * (16 - d2 - 2) + 1 + d2 / 2;
    for (let i = 1; i < 15; i++)
      for (let j = 1; j < 15; j++)
        for (let k = 1; k < 7; k++) {
          const a = (i - d3) / (d0 / 2), b = (k - d4) / (d1 / 2), c = (j - d5) / (d2 / 2);
          if (a * a + b * b + c * c < 1) blob[(i * 16 + j) * 8 + k] = 1;
        }
  }
  // The cells next to the blob (not in it), which have to hold the water in.
  const rim = (i, j, k) =>
    !at(i, j, k) &&
    ((i < 15 && at(i + 1, j, k)) || (i > 0 && at(i - 1, j, k)) ||
      (j < 15 && at(i, j + 1, k)) || (j > 0 && at(i, j - 1, k)) ||
      (k < 7 && at(i, j, k + 1)) || (k > 0 && at(i, j, k - 1)));
  for (let i = 0; i < 16; i++)
    for (let j = 0; j < 16; j++)
      for (let k = 0; k < 8; k++)
        if (rim(i, j, k)) {
          const b = world.get(x + i, y + k, z + j);
          if (k >= 4 && isLiquid(b)) return false;
          if (k < 4 && !world.solid(x + i, y + k, z + j) && b !== liquid) return false;
        }
  // This world is only 64 high; a lake that does not fit is dropped like a blocked one.
  if (y + 8 > HEIGHT) return false;
  for (let i = 0; i < 16; i++)
    for (let j = 0; j < 16; j++)
      for (let k = 0; k < 8; k++) if (at(i, j, k)) world.put(x + i, y + k, z + j, k >= 4 ? 0 : liquid, 0, false);
  // Dirt that was under the roof of the carved hollow and sees the sky turns to grass
  // (no mycelium: there are no biomes; the sky test is "nothing solid above").
  for (let i = 0; i < 16; i++)
    for (let j = 0; j < 16; j++)
      for (let k = 4; k < 8; k++)
        if (at(i, j, k) && world.get(x + i, y + k - 1, z + j) === DIRT) {
          let open = true;
          for (let h = y + k; h < HEIGHT && open; h++) if (world.solid(x + i, h, z + j)) open = false;
          if (open) world.put(x + i, y + k - 1, z + j, GRASS, 0, false);
        }
  // A lava lake is walled with stone: every solid rim cell below the surface line, and half
  // of the ones above it.
  if (liquid === LAVA)
    for (let i = 0; i < 16; i++)
      for (let j = 0; j < 16; j++)
        for (let k = 0; k < 8; k++)
          if (rim(i, j, k) && (k < 4 || rand.nextInt(2) !== 0) && world.solid(x + i, y + k, z + j))
            world.put(x + i, y + k, z + j, STONE, 0, false);
  return true;
}

// WorldGenLiquids.generate: a spring is stone with stone above and below, and exactly three
// stone and one air neighbour around it; it becomes a source of the liquid. (Vanilla ticks
// it straight away so that it starts flowing; here it stays a settled source until
// something next to it changes.)
export function generateSpring(world, x, y, z, liquid) {
  if (!world.inside(x, y, z) || world.get(x, y + 1, z) !== STONE || world.get(x, y - 1, z) !== STONE) return false;
  const here = world.get(x, y, z);
  if (here !== 0 && here !== STONE) return false;
  let stone = 0, air = 0;
  for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const b = world.get(x + dx, y, z + dz);
    if (b === STONE) stone++;
    if (b === 0 && world.inside(x + dx, y, z + dz)) air++;
  }
  if (stone === 3 && air === 1) world.put(x, y, z, liquid, 0, false);
  return true;
}

// Chunks (cx, cz) from 0 to 6 are populated: a chunk is only populated once its east, south
// and south-east neighbours exist, and the world ends at chunk 7. Each has its own random,
// seeded as in aqz.a(ahv, II)V from the world seed.
const chunkCount = () => SIZE / 16 - 1;

// Water and lava lakes, per chunk. Returns the chunk randoms so the springs continue each
// chunk's sequence.
export function generateLakes(world) {
  const seed = BigInt(world.numericSeed), rand = new JRandom(seed), chunks = [];
  for (let cx = 0; cx < chunkCount(); cx++)
    for (let cz = 0; cz < chunkCount(); cz++) {
      rand.setSeed(seed);
      const xm = (rand.nextLong() / 2n) * 2n + 1n, zm = (rand.nextLong() / 2n) * 2n + 1n,
        r = new JRandom(BigInt.asIntN(64, BigInt(cx) * xm + BigInt(cz) * zm) ^ seed);
      if (r.nextInt(4) === 0) {
        const x = cx * 16 + r.nextInt(16) + 8, y = r.nextInt(256), z = cz * 16 + r.nextInt(16) + 8;
        generateLake(world, r, x, y, z, WATER);
      }
      if (r.nextInt(8) === 0) {
        const x = cx * 16 + r.nextInt(16) + 8, y = r.nextInt(r.nextInt(248) + 8), z = cz * 16 + r.nextInt(16) + 8;
        if (y < lavaLakeLevel() || r.nextInt(10) === 0) generateLake(world, r, x, y, z, LAVA);
      }
      chunks.push({ cx, cz, r });
    }
  return chunks;
}

// BiomeDecorator.decorate: 50 water springs and 20 lava springs per chunk, at the
// vanilla heights (the world is only 64 high, so the ones above it are lost, as in vanilla
// where they land in air).
export function generateSprings(world, chunks) {
  for (const { cx, cz, r } of chunks) {
    for (let n = 0; n < 50; n++) {
      const x = cx * 16 + r.nextInt(16) + 8, y = r.nextInt(r.nextInt(248) + 8), z = cz * 16 + r.nextInt(16) + 8;
      generateSpring(world, x, y, z, WATER);
    }
    for (let n = 0; n < 20; n++) {
      const x = cx * 16 + r.nextInt(16) + 8, y = r.nextInt(r.nextInt(r.nextInt(240) + 8) + 8),
        z = cz * 16 + r.nextInt(16) + 8;
      generateSpring(world, x, y, z, LAVA);
    }
  }
}
