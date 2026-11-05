// Minecraft Java 1.7.10 Nether generation: ChunkProviderHell (terrain, surface, MapGenCavesHell) and its
// populate pass (WorldGenHellLava, WorldGenFire, GlowStone1/2, mushrooms, quartz and hidden lava), over
// gen-world.js. Original numeric block IDs. Replayed natively in nether.test.js against nether-reference.json.
//
// Chunk arrays are the native 128-high layout: Uint16Array(32768), index (x * 16 + z) * 128 + y, air 0.
// NOT ported: the nether fortress (MapGenNetherBridge). provideChunk never writes a fortress block (it only
// records structure starts); populate writes fortress pieces and, only where a fortress intersects the
// populated chunk, consumes hellRNG. Terrain, surface, caves and every populate step are exact for chunks
// whose populate has no fortress; where one intersects, hellRNG (hence all later populate output) diverges.
import { JavaRandom, mhSin, mhCos } from "./lighting.js";
import { NoiseGeneratorOctaves } from "./noise.js";
import { GenWorld, GenChunk, materialOf, FIRE, FLOWING_LAVA, LAVA, GRAVEL, OBSIDIAN } from "./gen-world.js";
import { WorldGenMinable, } from "./ore-generator.js";
import { WorldGenFlowers } from "./decoration-features.js";
import { randomLong } from "./mapgen.js";

const f = Math.fround, PI = f(Math.PI), HALF_PI = f(Math.PI / 2);
export const BEDROCK = 7, NETHERRACK = 87, SOUL_SAND = 88, GLOWSTONE = 89, QUARTZ_ORE = 153, BROWN_MUSHROOM = 39, RED_MUSHROOM = 40,
  GRASS = 2, DIRT = 3;
export const HEIGHT = 128, SEA_LEVEL = 32;
export const hellChunkSeed = (cx, cz) => BigInt.asIntN(64, BigInt(cx) * 341873128712n + BigInt(cz) * 132897987541n);

// MapGenCavesHell (aqy) over MapGenBase (aqx): range 8, 128-high arrays, lava veto, carves netherrack/dirt/grass.
export class MapGenCavesHell {
  constructor(seed) { this.seed = BigInt(seed); this.range = 8; this.random = new JavaRandom(0); }
  generate(cx, cz, blocks) {
    const r = this.random;
    r.setSeed(this.seed);
    const a = randomLong(r), b = randomLong(r);
    for (let x = cx - this.range; x <= cx + this.range; x++)
      for (let z = cz - this.range; z <= cz + this.range; z++) {
        r.setSeed(BigInt.asIntN(64, BigInt(x) * a) ^ BigInt.asIntN(64, BigInt(z) * b) ^ this.seed);
        this.recursiveGenerate(x, z, cx, cz, blocks);
      }
    return blocks;
  }
  recursiveGenerate(x, z, cx, cz, blocks) {
    const r = this.random;
    let n = r.nextInt(r.nextInt(r.nextInt(10) + 1) + 1);
    if (r.nextInt(5) !== 0) n = 0;
    for (let i = 0; i < n; i++) {
      const px = x * 16 + r.nextInt(16), py = r.nextInt(128), pz = z * 16 + r.nextInt(16);
      let count = 1;
      if (r.nextInt(4) === 0) {
        // The room: width 1 + nextFloat * 6 (not doubled), yaw/pitch 0, vertical scale 0.5.
        this.tunnel(randomLong(r), cx, cz, blocks, px, py, pz, f(1 + f(r.nextFloat() * 6)), 0, 0, -1, -1, 0.5);
        count += r.nextInt(4);
      }
      for (let j = 0; j < count; j++) {
        const yaw = f(f(r.nextFloat() * PI) * 2), pitch = f(f(f(r.nextFloat() - f(0.5)) * 2) / 8);
        const width = f(f(r.nextFloat() * 2) + r.nextFloat());
        this.tunnel(randomLong(r), cx, cz, blocks, px, py, pz, f(width * 2), yaw, pitch, 0, 0, 0.5);
      }
    }
  }
  tunnel(seed, cx, cz, blocks, x, y, z, width, yaw, pitch, start, end, verticalScale) {
    const r = new JavaRandom(seed), centreX = cx * 16 + 8, centreZ = cz * 16 + 8;
    let yawDrift = 0, pitchDrift = 0;
    if (end <= 0) { const n = this.range * 16 - 16; end = n - r.nextInt(Math.trunc(n / 4)); }
    let room = false;
    if (start === -1) { start = Math.trunc(end / 2); room = true; }
    const branch = r.nextInt(Math.trunc(end / 2)) + Math.trunc(end / 4), gentle = r.nextInt(6) === 0;
    for (let i = start; i < end; i++) {
      const radius = 1.5 + f(f(mhSin(f(f(i * PI) / end)) * width) * 1), vertical = radius * verticalScale;
      const cosPitch = mhCos(pitch);
      x += f(mhCos(yaw) * cosPitch);
      y += mhSin(pitch);
      z += f(mhSin(yaw) * cosPitch);
      pitch = f(pitch * f(gentle ? 0.92 : 0.7));
      pitch = f(pitch + f(pitchDrift * f(0.1)));
      yaw = f(yaw + f(yawDrift * f(0.1)));
      pitchDrift = f(pitchDrift * f(0.9));
      yawDrift = f(yawDrift * f(0.75));
      pitchDrift = f(pitchDrift + f(f(f(r.nextFloat() - r.nextFloat()) * r.nextFloat()) * 2));
      yawDrift = f(yawDrift + f(f(f(r.nextFloat() - r.nextFloat()) * r.nextFloat()) * 4));
      if (!room && i === branch && width > 1) {
        this.tunnel(randomLong(r), cx, cz, blocks, x, y, z, f(f(r.nextFloat() * f(0.5)) + f(0.5)), f(yaw - HALF_PI), f(pitch / 3), i, end, 1);
        this.tunnel(randomLong(r), cx, cz, blocks, x, y, z, f(f(r.nextFloat() * f(0.5)) + f(0.5)), f(yaw + HALF_PI), f(pitch / 3), i, end, 1);
        return;
      }
      if (!room && r.nextInt(4) === 0) continue;
      const dx = x - centreX, dz = z - centreZ, left = end - i, reach = f(f(width + 2) + 16);
      if (dx * dx + dz * dz - left * left > reach * reach) return;
      if (x < centreX - 16 - radius * 2 || z < centreZ - 16 - radius * 2 || x > centreX + 16 + radius * 2 || z > centreZ + 16 + radius * 2) continue;
      const carved = this.carve(blocks, cx, cz, x, y, z, radius, vertical);
      if (room && carved) break;
    }
  }
  carve(blocks, cx, cz, x, y, z, rx, ry) {
    const minX = Math.max(0, Math.floor(x - rx) - cx * 16 - 1), maxX = Math.min(16, Math.floor(x + rx) - cx * 16 + 1);
    const minY = Math.max(1, Math.floor(y - ry) - 1), maxY = Math.min(120, Math.floor(y + ry) + 1);
    const minZ = Math.max(0, Math.floor(z - rx) - cz * 16 - 1), maxZ = Math.min(16, Math.floor(z + rx) - cz * 16 + 1);
    // Lava (flowing or still) anywhere on the walls, floor or ceiling vetoes the whole carve.
    for (let ix = minX; ix < maxX; ix++)
      for (let iz = minZ; iz < maxZ; iz++)
        for (let iy = maxY + 1; iy >= minY - 1; iy--) {
          if (iy >= 0 && iy < 128) {
            const b = blocks[(ix * 16 + iz) * 128 + iy];
            if (b === FLOWING_LAVA || b === LAVA) return false;
            if (iy !== minY - 1 && ix !== minX && ix !== maxX - 1 && iz !== minZ && iz !== maxZ - 1) iy = minY;
          }
        }
    for (let ix = minX; ix < maxX; ix++) {
      const dx = (ix + cx * 16 + 0.5 - x) / rx;
      for (let iz = minZ; iz < maxZ; iz++) {
        const dz = (iz + cz * 16 + 0.5 - z) / rx;
        let index = (ix * 16 + iz) * 128 + maxY;
        // The native index starts at maxY while the geometric Y starts at maxY - 1; it steps down every row.
        for (let iy = maxY - 1; iy >= minY; iy--, index--) {
          const dy = (iy + 0.5 - y) / ry;
          if (dy > -0.7 && dx * dx + dy * dy + dz * dz < 1) {
            const b = blocks[index];
            if (b === NETHERRACK || b === DIRT || b === GRASS) blocks[index] = 0;
          }
        }
      }
    }
    return true;
  }
}

// ChunkProviderHell (aqv). hellRNG is reseeded by every provideChunk and then continues, un-reseeded, into
// populate; generation order is therefore part of the result.
export class ChunkProviderHell {
  constructor(seed) {
    this.seed = BigInt(seed);
    this.hellRNG = new JavaRandom(this.seed);
    const r = this.hellRNG;
    this.noise1 = new NoiseGeneratorOctaves(r, 16);
    this.noise2 = new NoiseGeneratorOctaves(r, 16);
    this.noise3 = new NoiseGeneratorOctaves(r, 8);
    this.slowsandGravel = new NoiseGeneratorOctaves(r, 4);
    this.exclusivity = new NoiseGeneratorOctaves(r, 4);
    this.noise6 = new NoiseGeneratorOctaves(r, 10);
    this.noise7 = new NoiseGeneratorOctaves(r, 16);
    this.caves = new MapGenCavesHell(this.seed);
    this.noiseField = null;
  }
  reseed(cx, cz) { this.hellRNG.setSeed(hellChunkSeed(cx, cz)); }
  // provideChunk: terrain, surface, caves. Returns { blocks } (128-high native layout).
  generateChunk(cx, cz) {
    this.reseed(cx, cz);
    const blocks = new Uint16Array(32768);
    this.terrain(cx, cz, blocks);
    this.surface(cx, cz, blocks);
    this.caves.generate(cx, cz, blocks);
    return { blocks, x: cx, z: cz };
  }
  // initializeNoiseField: 5 x 17 x 5 density samples, indexed (x * 5 + z) * 17 + y.
  initializeNoiseField(x0, y0, z0, sx, sy, sz) {
    const d0 = 684.412, d1 = 2053.236, out = new Float64Array(sx * sy * sz);
    const lowerN = this.noise1.generate(x0, y0, z0, sx, sy, sz, d0, d1, d0);
    const upperN = this.noise2.generate(x0, y0, z0, sx, sy, sz, d0, d1, d0);
    const selectN = this.noise3.generate(x0, y0, z0, sx, sy, sz, d0 / 80, d1 / 60, d0 / 80);
    // noise6 / noise7 are sampled by the original into values it never reads (a dead continental term, and
    // `(double) k < 0`), and noise generation consumes no random numbers: they are constructed, not sampled.
    const profile = new Float64Array(sy);
    for (let i = 0; i < sy; i++) {
      profile[i] = Math.cos(i * Math.PI * 6 / sy) * 2;
      let d = i;
      if (i > Math.trunc(sy / 2)) d = sy - 1 - i;
      if (d < 4) { d = 4 - d; profile[i] -= d * d * d * 10; }
    }
    let k = 0;
    for (let i = 0; i < sx; i++)
      for (let j = 0; j < sz; j++)
        for (let y = 0; y < sy; y++) {
          const lower = lowerN[k] / 512, upper = upperN[k] / 512, t = (selectN[k] / 10 + 1) / 2;
          let d = t < 0 ? lower : t > 1 ? upper : lower + (upper - lower) * t;
          d -= profile[y];
          if (y > sy - 4) { const e = f((y - (sy - 4)) / 3); d = d * (1 - e) + -10 * e; }
          out[k++] = d;
        }
    return out;
  }
  // func_147419_a: trilinear fill; netherrack where density > 0, lava below y 32.
  terrain(cx, cz, blocks) {
    const n = 4, sea = SEA_LEVEL, w = n + 1, h = 17;
    const field = this.noiseField = this.initializeNoiseField(cx * n, 0, cz * n, w, h, w);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        for (let k = 0; k < 16; k++) {
          let d1 = field[(i * w + j) * h + k], d2 = field[(i * w + j + 1) * h + k],
            d3 = field[((i + 1) * w + j) * h + k], d4 = field[((i + 1) * w + j + 1) * h + k];
          const d5 = (field[(i * w + j) * h + k + 1] - d1) * 0.125, d6 = (field[(i * w + j + 1) * h + k + 1] - d2) * 0.125,
            d7 = (field[((i + 1) * w + j) * h + k + 1] - d3) * 0.125, d8 = (field[((i + 1) * w + j + 1) * h + k + 1] - d4) * 0.125;
          for (let l = 0; l < 8; l++) {
            let d10 = d1, d11 = d2;
            const d12 = (d3 - d1) * 0.25, d13 = (d4 - d2) * 0.25;
            for (let m = 0; m < 4; m++) {
              let index = (m + i * 4) << 11 | (0 + j * 4) << 7 | (k * 8 + l), d15 = d10;
              const d16 = (d11 - d10) * 0.25;
              for (let q = 0; q < 4; q++) {
                let id = 0;
                if (k * 8 + l < sea) id = LAVA;
                if (d15 > 0) id = NETHERRACK;
                blocks[index] = id;
                index += 128;
                d15 += d16;
              }
              d10 += d12; d11 += d13;
            }
            d1 += d5; d2 += d6; d3 += d7; d4 += d8;
          }
        }
    return blocks;
  }
  // func_147418_b: gravel / soul sand / netherrack skin, bedrock floor and ceiling. The column index is
  // (l * 16 + k) * 128 + y with the noise read at k + l * 16, exactly as the original (k is the outer loop).
  surface(cx, cz, blocks) {
    const r = this.hellRNG, b0 = 64, d0 = 0.03125;
    const slowsand = this.slowsandGravel.generate(cx * 16, cz * 16, 0, 16, 16, 1, d0, d0, 1);
    const gravel = this.slowsandGravel.generate(cx * 16, 109, cz * 16, 16, 1, 16, d0, 1, d0);
    const excl = this.exclusivity.generate(cx * 16, cz * 16, 0, 16, 16, 1, d0 * 2, d0 * 2, d0 * 2);
    for (let k = 0; k < 16; k++)
      for (let l = 0; l < 16; l++) {
        const sand = slowsand[k + l * 16] + r.nextDouble() * 0.2 > 0;
        const grav = gravel[k + l * 16] + r.nextDouble() * 0.2 > 0;
        const depth = Math.trunc(excl[k + l * 16] / 3 + 3 + r.nextDouble() * 0.25);
        let run = -1, top = NETHERRACK, filler = NETHERRACK;
        for (let y = 127; y >= 0; y--) {
          const index = (l * 16 + k) * 128 + y;
          if (y < 127 - r.nextInt(5) && y > 0 + r.nextInt(5)) {
            const id = blocks[index];
            if (id === 0) run = -1;
            else if (id === NETHERRACK) {
              if (run === -1) {
                if (depth <= 0) { top = 0; filler = NETHERRACK; }
                else if (y >= b0 - 4 && y <= b0 + 1) {
                  top = NETHERRACK; filler = NETHERRACK;
                  if (grav) { top = GRAVEL; filler = NETHERRACK; }
                  if (sand) { top = SOUL_SAND; filler = SOUL_SAND; }
                }
                if (y < b0 && top === 0) top = LAVA;
                run = depth;
                blocks[index] = y >= b0 - 1 ? top : filler;
              } else if (run > 0) { run--; blocks[index] = filler; }
            }
          } else blocks[index] = BEDROCK;
        }
      }
    return blocks;
  }

  // populate(): hellRNG continues from the last provideChunk (no reseed). `world` is a NetherGenWorld.
  populate(world, cx, cz) {
    const r = this.hellRNG, bx = cx * 16, bz = cz * 16;
    for (let i = 0; i < 8; i++)
      new WorldGenHellLava(FLOWING_LAVA, false).generate(world, r, bx + r.nextInt(16) + 8, r.nextInt(120) + 4, bz + r.nextInt(16) + 8);
    let n = r.nextInt(r.nextInt(10) + 1) + 1;
    for (let i = 0; i < n; i++) {
      const x = bx + r.nextInt(16) + 8, y = r.nextInt(120) + 4, z = bz + r.nextInt(16) + 8;
      new WorldGenFire().generate(world, r, x, y, z);
    }
    n = r.nextInt(r.nextInt(10) + 1);
    for (let i = 0; i < n; i++) {
      const x = bx + r.nextInt(16) + 8, y = r.nextInt(120) + 4, z = bz + r.nextInt(16) + 8;
      new WorldGenGlowStone().generate(world, r, x, y, z); // GlowStone1 (ary)
    }
    for (let i = 0; i < 10; i++) {
      const x = bx + r.nextInt(16) + 8, y = r.nextInt(128), z = bz + r.nextInt(16) + 8;
      new WorldGenGlowStone().generate(world, r, x, y, z); // GlowStone2 (arr): bytecode-identical to GlowStone1
    }
    for (const mushroom of [BROWN_MUSHROOM, RED_MUSHROOM])
      if (r.nextInt(1) === 0) {
        const x = bx + r.nextInt(16) + 8, y = r.nextInt(128), z = bz + r.nextInt(16) + 8;
        new WorldGenFlowers(mushroom).generate(world, r, x, y, z);
      }
    const quartz = new WorldGenMinable(QUARTZ_ORE, 13, NETHERRACK);
    for (let i = 0; i < 16; i++) {
      const x = bx + r.nextInt(16), y = r.nextInt(108) + 10, z = bz + r.nextInt(16);
      quartz.generate(world, r, x, y, z);
    }
    for (let i = 0; i < 16; i++) {
      const x = bx + r.nextInt(16), y = r.nextInt(108) + 10, z = bz + r.nextInt(16);
      new WorldGenHellLava(FLOWING_LAVA, true).generate(world, r, x, y, z);
    }
  }
}

// WorldGenHellLava (ars): a lava pocket in a netherrack ceiling; `hidden` skips the one-open-side rule.
export class WorldGenHellLava {
  constructor(block, hidden) { this.block = block; this.hidden = hidden; }
  generate(world, random, x, y, z) {
    if (world.getBlock(x, y + 1, z) !== NETHERRACK) return false;
    if (materialOf(world.getBlock(x, y, z)) !== "a" && world.getBlock(x, y, z) !== NETHERRACK) return false;
    let rock = 0;
    if (world.getBlock(x - 1, y, z) === NETHERRACK) rock++;
    if (world.getBlock(x + 1, y, z) === NETHERRACK) rock++;
    if (world.getBlock(x, y, z - 1) === NETHERRACK) rock++;
    if (world.getBlock(x, y, z + 1) === NETHERRACK) rock++;
    if (world.getBlock(x, y - 1, z) === NETHERRACK) rock++;
    let air = 0;
    if (world.isAirBlock(x - 1, y, z)) air++;
    if (world.isAirBlock(x + 1, y, z)) air++;
    if (world.isAirBlock(x, y, z - 1)) air++;
    if (world.isAirBlock(x, y, z + 1)) air++;
    if (world.isAirBlock(x, y - 1, z)) air++;
    if ((!this.hidden && rock === 4 && air === 1) || rock === 5) {
      world.setBlock(x, y, z, this.block, 0, 2);
      // World.scheduledUpdatesAreImmediate: the new lava ticks at once with this stream (BlockDynamicLiquid).
      world.immediate = true;
      world.updateTick(this.block, x, y, z, random);
      world.immediate = false;
    }
    return true;
  }
}

// WorldGenFire (arq): 64 tries of fire on netherrack in an 8 / 4 / 8 spread.
export class WorldGenFire {
  generate(world, random, x, y, z) {
    for (let i = 0; i < 64; i++) {
      const px = x + random.nextInt(8) - random.nextInt(8), py = y + random.nextInt(4) - random.nextInt(4), pz = z + random.nextInt(8) - random.nextInt(8);
      if (!world.isAirBlock(px, py, pz)) continue;
      if (world.getBlock(px, py - 1, pz) !== NETHERRACK) continue;
      world.setBlock(px, py, pz, FIRE, 0, 2);
    }
    return true;
  }
}

// GlowStone1 (ary) and GlowStone2 (arr) share this body: seed a glowstone under netherrack, then 1500 tries
// that add glowstone to air cells with exactly one glowstone neighbour (read order: -x, +x, -y, +y, -z, +z).
export class WorldGenGlowStone {
  generate(world, random, x, y, z) {
    if (!world.isAirBlock(x, y, z)) return false;
    if (world.getBlock(x, y + 1, z) !== NETHERRACK) return false;
    world.setBlock(x, y, z, GLOWSTONE, 0, 2);
    for (let i = 0; i < 1500; i++) {
      const px = x + random.nextInt(8) - random.nextInt(8), py = y - random.nextInt(12), pz = z + random.nextInt(8) - random.nextInt(8);
      if (materialOf(world.getBlock(px, py, pz)) !== "a") continue;
      let count = 0;
      for (let l = 0; l < 6; l++) {
        let id = null;
        if (l === 0) id = world.getBlock(px - 1, py, pz);
        if (l === 1) id = world.getBlock(px + 1, py, pz);
        if (l === 2) id = world.getBlock(px, py - 1, pz);
        if (l === 3) id = world.getBlock(px, py + 1, pz);
        if (l === 4) id = world.getBlock(px, py, pz - 1);
        if (l === 5) id = world.getBlock(px, py, pz + 1);
        if (id === GLOWSTONE) count++;
      }
      if (count === 1) world.setBlock(px, py, pz, GLOWSTONE, 0, 2);
    }
    return true;
  }
}

// Direction.offsetX / offsetZ and BlockPortal.field_150001_a for BlockPortal.Size's two axes.
const OFFSET_X = [0, -1, 0, 1], OFFSET_Z = [1, 0, -1, 0], SIZE_AXES = [null, [3, 1], [2, 0]];

// A World for the Nether: WorldProviderHell flags (hasNoSky, isHellWorld, dimension -1), every chunk reachable
// (a lazily generated unpopulated halo from `halo`, a second provider with its own hellRNG), and BlockFire.
// Fire is the only block placed by population whose onBlockAdded GenWorld does not already model.
export class NetherGenWorld extends GenWorld {
  constructor({ rand, halo = null, ...rest } = {}) {
    super({ rand, hasNoSky: true, hellWorld: true, ...rest });
    this.dimension = -1; this.halo = halo;
  }
  chunkExists() { return true; }
  chunk(x, z) {
    const c = this.chunks.get(`${x},${z}`);
    if (c) return c;
    if (!this.halo) throw new Error(`nether-generator: unloaded chunk ${x},${z}`);
    return this.addNetherChunk(this.halo.generateChunk(x, z));
  }
  // Native 128-high blocks into gen-world's 256-stride chunk storage (no metadata).
  addNetherChunk({ blocks, x, z }) {
    const wide = new Uint16Array(65536);
    for (let i = 0; i < 32768; i++) wide[(i >> 7) * 256 + (i & 127)] = blocks[i];
    return this.addChunk(x, z, wide, new Uint8Array(65536));
  }
  blockAdded(id, x, y, z) {
    if (id !== FIRE) return super.blockAdded(id, x, y, z);
    // BlockFire.onBlockAdded: dimension > 0 skips the portal check; otherwise a lit frame turns it into a portal.
    if (this.dimension > 0 || !this.tryToCreatePortal(x, y, z)) {
      if (!this.hasSolidTopSurface(x, y - 1, z) && !this.canNeighborBurn(x, y, z)) this.setBlockToAir(x, y, z);
      else this.scheduleBlockUpdate(x, y, z, FIRE, 30 + this.rand.nextInt(10));
    }
  }
  // BlockPortal.func_150000_e: two BlockPortal.Size scans (x axis, z axis). Their reads are reproduced; a lit
  // frame (a scan that finds obsidian) is handed to `createPortal(x, y, z, axis)`, which the portal code owns.
  tryToCreatePortal(x, y, z) {
    const scans = [1, 2].map((axis) => this.portalSizeScan(x, y, z, axis));
    for (const s of scans) if (s.frame && this.createPortal?.(x, y, z, s.axis)) return true;
    return false;
  }
  portalSizeScan(x, y, z, axis) {
    const d = SIZE_AXES[axis][0], limit = y;
    while (y > limit - 21 && y > 0 && this.portalSizeBlock(this.getBlock(x, y - 1, z))) y--;
    let i = 0;
    for (; i < 22; i++) {
      const px = x + OFFSET_X[d] * i, pz = z + OFFSET_Z[d] * i;
      if (!this.portalSizeBlock(this.getBlock(px, y, pz))) break;
      if (this.getBlock(px, y - 1, pz) !== OBSIDIAN) break;
    }
    const found = this.getBlock(x + OFFSET_X[d] * i, y, z + OFFSET_Z[d] * i) === OBSIDIAN ? i : 0;
    return { axis, frame: found > 0 };
  }
  portalSizeBlock(id) { return materialOf(id) === "a" || id === FIRE || id === 90; }
  // World.doesBlockHaveSolidTopSurface for the blocks fire is placed on (opaque cubes).
  hasSolidTopSurface(x, y, z) {
    const id = this.getBlock(x, y, z);
    this.getBlockMetadata(x, y, z); // read unconditionally, before any block test
    if (this.isOpaqueCube(id)) return true;
    throw new Error(`nether-generator: unported solid-top test for block ${id}`);
  }
  canNeighborBurn() { throw new Error("nether-generator: unported BlockFire.canNeighborBurn"); }
}

// Generate a size x size block of chunks (x outer, z inner), then populate the first `populated` x `populated`
// of them (x outer, z inner), continuing one hellRNG. `halo` chunks beyond the generated area are produced on
// demand by a second provider and are never populated.
export class NetherArea {
  constructor({ seed, chunkX = 0, chunkZ = 0, size = 4, populated = size - 1, worldRandSeed = 0n } = {}) {
    this.seed = BigInt(seed); this.chunkX = chunkX; this.chunkZ = chunkZ; this.size = size; this.populated = populated;
    this.provider = new ChunkProviderHell(this.seed);
    this.world = new NetherGenWorld({ rand: new JavaRandom(worldRandSeed), halo: new ChunkProviderHell(this.seed) });
  }
  generateChunk(x, z) { return this.world.addNetherChunk(this.provider.generateChunk(x, z)); }
  populateChunk(x, z) { this.provider.populate(this.world, x, z); }
  run(hooks = {}) {
    const { chunkX: cx, chunkZ: cz, size, populated } = this;
    for (let x = cx; x < cx + size; x++) for (let z = cz; z < cz + size; z++) { const chunk = this.generateChunk(x, z); hooks.afterGenerate?.(x, z, chunk); }
    for (let x = cx; x < cx + populated; x++) for (let z = cz; z < cz + populated; z++) {
      hooks.beforePopulate?.(x, z);
      this.populateChunk(x, z);
      hooks.afterPopulate?.(x, z, this.provider.hellRNG);
    }
    return this;
  }
}
export { GenChunk };
