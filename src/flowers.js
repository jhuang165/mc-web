// 1.7.10 flowers: BlockFlower/BlockBush survival rules, the biome flower choice
// (BiomeGenBase.func_150572_a, ahu.a(Random,III)), BiomeDecorator's flower loop
// with WorldGenFlowers (aro), and the grass branch of bone meal
// (BlockGrass.func_149853_b, alh.b). Evidence: public/research/dyes.md and
// public/research/dyes-reference.json (tools/probes/DyeProbe.java).
//
// This module deliberately imports nothing, so world.js can call it while it is
// still being evaluated; block ids arrive as `ids` ({yellow, red}).

const MASK = (1n << 48n) - 1n;
// java.util.Random.
export class JRandom {
  constructor(seed) { this.setSeed(seed); }
  setSeed(seed) { this.seed = (BigInt.asIntN(64, BigInt(seed)) ^ 0x5deece66dn) & MASK; }
  next(bits) {
    this.seed = (this.seed * 0x5deece66dn + 0xbn) & MASK;
    return Number(BigInt.asIntN(32, this.seed >> BigInt(48 - bits)));
  }
  nextInt(bound) {
    if ((bound & -bound) === bound) return Number((BigInt(bound) * BigInt(this.next(31))) >> 31n);
    let bits, val;
    do {
      bits = this.next(31);
      val = bits % bound;
    } while (bits - val + (bound - 1) > 2147483647);
    return val;
  }
  nextLong() { return BigInt.asIntN(64, (BigInt(this.next(32)) << 32n) + BigInt(this.next(32))); }
  nextDouble() { return (this.next(26) * 134217728 + this.next(27)) / 2 ** 53; }
}

// awo: NoiseGeneratorSimplex (2-D part) and awl: NoiseGeneratorPerlin.
const GRADIENTS = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0, 1], [0, -1]];
const SQRT3 = Math.sqrt(3);
const floorSimplex = (v) => (v > 0 ? Math.trunc(v) : Math.trunc(v) - 1);
export class SimplexNoise {
  constructor(random) {
    this.xo = random.nextDouble() * 256;
    this.yo = random.nextDouble() * 256;
    this.zo = random.nextDouble() * 256;
    const p = (this.p = new Int32Array(512));
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 0; i < 256; i++) {
      const j = random.nextInt(256 - i) + i, t = p[i];
      p[i] = p[j];
      p[j] = t;
      p[i + 256] = p[i];
    }
  }
  sample(x, y) {
    const p = this.p, skew = 0.5 * (SQRT3 - 1), s = (x + y) * skew;
    const i = floorSimplex(x + s), j = floorSimplex(y + s), unskew = (3 - SQRT3) / 6, t = (i + j) * unskew;
    const x0 = x - (i - t), y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + unskew, y1 = y0 - j1 + unskew, x2 = x0 - 1 + 2 * unskew, y2 = y0 - 1 + 2 * unskew;
    const ii = i & 255, jj = j & 255;
    const g0 = p[ii + p[jj]] % 12, g1 = p[ii + i1 + p[jj + j1]] % 12, g2 = p[ii + 1 + p[jj + 1]] % 12;
    const corner = (tt, g, dx, dy) => {
      if (tt < 0) return 0;
      tt *= tt;
      return tt * tt * (GRADIENTS[g][0] * dx + GRADIENTS[g][1] * dy);
    };
    return 70 * (corner(0.5 - x0 * x0 - y0 * y0, g0, x0, y0) + corner(0.5 - x1 * x1 - y1 * y1, g1, x1, y1) + corner(0.5 - x2 * x2 - y2 * y2, g2, x2, y2));
  }
}
export class PerlinNoise {
  constructor(random, octaves) { this.octaves = Array.from({ length: octaves }, () => new SimplexNoise(random)); }
  sample(x, z) {
    let total = 0, scale = 1;
    for (const o of this.octaves) { total += o.sample(x * scale, z * scale) / scale; scale /= 2; }
    return total;
  }
}
// BiomeGenBase.ad: new NoiseGeneratorPerlin(new Random(2345L), 1).
let plainsNoise = null;
export const plainsFlowerNoise = () => (plainsNoise ??= new PerlinNoise(new JRandom(2345), 1));

// alc.a / alc.b: the names func_150572_a returns, as [block kind, metadata].
const DANDELION = ['yellow', 0], POPPY = ['red', 0], BLUET = ['red', 3], OXEYE = ['red', 8];
const TULIP = (n) => ['red', 4 + n];
// BiomeGenBase.func_150572_a: dandelion two times in three, else poppy.
function baseChoice(random) { return random.nextInt(3) > 0 ? DANDELION : POPPY; }
// BiomeGenPlains.func_150572_a.
function plainsChoice(random, x, z) {
  if (plainsFlowerNoise().sample(x / 200, z / 200) < -0.8) return TULIP(random.nextInt(4));
  if (random.nextInt(3) > 0) {
    const n = random.nextInt(3);
    return n === 0 ? POPPY : n === 1 ? BLUET : OXEYE;
  }
  return DANDELION;
}
// This world's meadow stands in for plains; alpine and island use the default
// biome (see dyes.md for the deviation).
export const flowersPerChunk = (biome) => (biome === 'meadow' ? 4 : 2);
export function chooseFlower(biome, random, x, z) {
  return biome === 'meadow' ? plainsChoice(random, x, z) : baseChoice(random);
}

// Light opacity (Block.getLightOpacity) of this build's blocks.
const CLEAR = new Set([0, 9, 20, 41]);
function opacity(b, ids) {
  if (CLEAR.has(b) || b === 39 || b === ids.yellow || b === ids.red || (b >= 31 && b <= 38)) return 0;
  if (b === 10) return 3;
  if (b === 5) return 1;
  return 15;
}
// Block.isNormalCube for this build's blocks (world.js normalCube).
const NOT_NORMAL = new Set([0, 5, 9, 10, 20, 29, 30, 39, 41]);
const normalCube = (b, ids) => !NOT_NORMAL.has(b) && b !== ids.yellow && b !== ids.red && !(b >= 31 && b <= 38);
// BlockBush.canPlaceBlockOn: grass, dirt, farmland.
export const flowerGround = (b) => b === 1 || b === 2 || b === 29 || b === 30;
// BlockBush.func_149718_j (ajr.j) in 1.7.10 is only canPlaceBlockOn(block below): grass, dirt or farmland. There is no light term
// (javap of ajr.j; replayed against block-sweep3-reference.json, every sky/block light and skylightSubtracted); the light rules of this
// family are the mushroom's (plant-light.js) and the growth conditions of saplings and crops.
export function flowerCanStay(world, ids, x, y, z) {
  return flowerGround(world.get(x, y - 1, z));
}
// Chunk heightMap value: one above the highest light-blocking block.
export function heightValue(world, ids, x, z) {
  for (let y = 63; y > 0; y--) if (opacity(world.get(x, y, z), ids) > 0) return y + 1;
  return 0;
}

// WorldGenFlowers.generate: 64 scattered attempts around (x, y, z).
function generateFlowers(world, ids, random, kind, meta, x, y, z) {
  const id = ids[kind];
  for (let i = 0; i < 64; i++) {
    const px = x + random.nextInt(8) - random.nextInt(8), py = y + random.nextInt(4) - random.nextInt(4), pz = z + random.nextInt(8) - random.nextInt(8);
    if (py < 255 && world.get(px, py, pz) === 0 && world.inside(px, py, pz) && flowerCanStay(world, ids, px, py, pz)) world.set(px, py, pz, id, false, meta);
  }
}
// ChunkProviderGenerate.populate's seed: both multipliers are odd longs drawn
// from the world seed.
export function populateSeed(worldSeed, cx, cz) {
  const r = new JRandom(worldSeed), a = (r.nextLong() / 2n) * 2n + 1n, b = (r.nextLong() / 2n) * 2n + 1n;
  return BigInt.asIntN(64, BigInt(cx) * a + BigInt(cz) * b) ^ BigInt(worldSeed);
}
// BiomeDecorator.func_150513_a flower loop, for every 16x16 chunk whose
// decoration area (offset by 8) touches the world.
export function decorateFlowers(world, { yellow, red, biome, size }) {
  const ids = { yellow, red };
  for (let cx = -1; cx * 16 < size; cx++)
    for (let cz = -1; cz * 16 < size; cz++) {
      const random = new JRandom(populateSeed(world.numericSeed, cx, cz));
      for (let n = 0; n < flowersPerChunk(biome); n++) {
        const x = cx * 16 + random.nextInt(16) + 8, z = cz * 16 + random.nextInt(16) + 8;
        const y = random.nextInt(heightValue(world, ids, x, z) + 32);
        const [kind, meta] = chooseFlower(biome, random, x, z);
        generateFlowers(world, ids, random, kind, meta, x, y, z);
      }
    }
}

// BlockGrass.func_149853_b (bone meal on grass): up to 128 random walks from the
// block above; each lands on air above grass and plants tall grass (7 in 8) or
// the biome's flower. Returns the placements for the caller to render.
export function growGrass(world, ids, random, biome, x, y, z) {
  const placed = [];
  for (let l = 0; l < 128; l++) {
    let px = x, py = y + 1, pz = z, steps = 0;
    for (; steps < Math.floor(l / 16); steps++) {
      px += random.nextInt(3) - 1;
      py += Math.trunc(((random.nextInt(3) - 1) * random.nextInt(3)) / 2);
      pz += random.nextInt(3) - 1;
      if (world.get(px, py - 1, pz) !== 1 || normalCube(world.get(px, py, pz), ids)) break;
    }
    if (steps !== Math.floor(l / 16) || world.get(px, py, pz) !== 0 || !world.inside(px, py, pz)) continue;
    if (random.nextInt(8) !== 0) {
      if (flowerCanStay(world, ids, px, py, pz) && world.set(px, py, pz, 39, true)) placed.push([px, py, pz]);
    } else {
      const [kind, meta] = chooseFlower(biome, random, px, pz);
      if (flowerCanStay(world, ids, px, py, pz) && world.set(px, py, pz, ids[kind], true, meta)) placed.push([px, py, pz]);
    }
  }
  return placed;
}
