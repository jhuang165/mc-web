// Minecraft Java 1.7.10 WorldGenMinable and BiomeDecorator.generateOres.
// World adapter: getBlock(x,y,z) -> original numeric ID;
// setBlock(x,y,z,id,metadata,flags). It owns bounds and chunk access.
// This is an isolated population stage; callers supply the stream AFTER all
// preceding population features. Do not seed ores directly with populationSeed.
import { JavaRandom, mhSin, mhCos } from "./lighting.js";
const f = Math.fround, PI = f(Math.PI);
const long = (r) => BigInt.asIntN(64, (BigInt(r.nextInt()) << 32n) + BigInt(r.nextInt()));

// ChunkProviderGenerate.populate: Java long division truncates toward zero,
// so negative nextLong / 2 * 2 + 1 is intentionally NOT a bitwise OR with 1.
export function populationSeed(seed, chunkX, chunkZ) {
  seed = BigInt(seed);
  const r = new JavaRandom(seed),
    a = BigInt.asIntN(64, (long(r) / 2n) * 2n + 1n),
    b = BigInt.asIntN(64, (long(r) / 2n) * 2n + 1n);
  return BigInt.asIntN(64, (BigInt(chunkX) * a + BigInt(chunkZ) * b) ^ seed);
}

export class WorldGenMinable {
  constructor(block, size, target = 1) {
    this.block = block;
    this.size = size;
    this.target = target;
  }
  generate(world, random, x, y, z) {
    const n = this.size, angle = f(random.nextFloat() * PI),
      sx = f(f(mhSin(angle) * f(n)) / 8),
      sz = f(f(mhCos(angle) * f(n)) / 8),
      x0 = f(f((x + 8) | 0) + sx), x1 = f(f((x + 8) | 0) - sx),
      z0 = f(f((z + 8) | 0) + sz), z1 = f(f((z + 8) | 0) - sz),
      y0 = y + random.nextInt(3) - 2, y1 = y + random.nextInt(3) - 2;
    for (let i = 0; i <= n; i++) {
      const px = x0 + ((x1 - x0) * i) / n,
        py = y0 + ((y1 - y0) * i) / n,
        pz = z0 + ((z1 - z0) * i) / n,
        radiusNoise = (random.nextDouble() * n) / 16,
        diameter = f(mhSin(f(f(f(i) * PI) / f(n))) + 1) * radiusNoise + 1,
        radius = diameter / 2;
      const minX = Math.floor(px - radius), maxX = Math.floor(px + radius),
        minY = Math.floor(py - radius), maxY = Math.floor(py + radius),
        minZ = Math.floor(pz - radius), maxZ = Math.floor(pz + radius);
      for (let bx = minX; bx <= maxX; bx++) {
        const dx = (bx + 0.5 - px) / radius;
        if (dx * dx >= 1) continue;
        for (let by = minY; by <= maxY; by++) {
          const dy = (by + 0.5 - py) / radius;
          if (dx * dx + dy * dy >= 1) continue;
          for (let bz = minZ; bz <= maxZ; bz++) {
            const dz = (bz + 0.5 - pz) / radius;
            if (dx * dx + dy * dy + dz * dz < 1 && world.getBlock(bx, by, bz) === this.target)
              world.setBlock(bx, by, bz, this.block, 0, 2);
          }
        }
      }
    }
    return true; // Native returns true even when no cells can be replaced.
  }
}

// [distribution, attempts, original block ID, vein size, target ID, min/center, max/spread]
export const OVERWORLD_ORES = Object.freeze([
  ["uniform", 20, 3, 32, 1, 0, 256],
  ["uniform", 10, 13, 32, 1, 0, 256],
  ["uniform", 20, 16, 16, 1, 0, 128],
  ["uniform", 20, 15, 8, 1, 0, 64],
  ["uniform", 2, 14, 8, 1, 0, 32],
  ["uniform", 8, 73, 7, 1, 0, 16],
  ["uniform", 1, 56, 7, 1, 0, 16],
  ["triangle", 1, 21, 6, 1, 16, 16],
].map(Object.freeze));

// Base BiomeDecorator's ore phase only. Biome-specific additions (e.g. hills
// emeralds/monster eggs) belong to their later decoration hooks.
export function generateOres(world, random, blockX, blockZ, onAttempt = null) {
  for (const [mode, count, id, size, target, min, max] of OVERWORLD_ORES) {
    const gen = new WorldGenMinable(id, size, target);
    for (let i = 0; i < count; i++) {
      const x = blockX + random.nextInt(16),
        y = mode === "triangle"
          ? random.nextInt(max) + random.nextInt(max) + (min - max)
          : random.nextInt(max - min) + min,
        z = blockZ + random.nextInt(16);
      onAttempt?.(id, x, y, z);
      gen.generate(world, random, x, y, z);
    }
  }
}
