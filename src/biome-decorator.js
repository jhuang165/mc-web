// 1.7.10 BiomeDecorator.decorateChunk / genDecorations (aia), the base decorator driver: ores,
// sand/clay/gravel discs, biome trees, big mushrooms, biome flowers, grass, dead bushes, lilies,
// mushrooms, reeds, pumpkins, cacti and water/lava springs, in native draw order. Counts come
// from the decorator object of the given registry slot (decoration-features.js). Biome decorate
// overrides (extra emeralds, double plants, mutated delegation, desert wells...) are not here.
// The world is a gen-world.js GenWorld (or any adapter with the same block, tick and height
// calls). Replayed natively in biome-decorator.test.js.
import { JavaRandom } from "./java-random.js";
import { NoiseGeneratorPerlin } from "./noise.js";
import { generateOres } from "./ore-generator.js";
import {
  decoratorCounts, WorldGenClay, WorldGenSand, WorldGenFlowers, WorldGenTallGrass, WorldGenDeadBush,
  WorldGenWaterlily, WorldGenReed, WorldGenPumpkin, WorldGenCactus,
  SAND, GRAVEL, TALL_GRASS, DEAD_BUSH, YELLOW_FLOWER, RED_FLOWER, BROWN_MUSHROOM, RED_MUSHROOM,
} from "./decoration-features.js";
import { pickTree, pickGrassMeta, WorldGenBigMushroom } from "./tree-generators.js";
import { WorldGenLiquids } from "./springs.js";

const FLOWING_WATER = 8, FLOWING_LAVA = 10;

// BiomeGenBase.field_150606_ad, a class-static NoiseGeneratorPerlin(new Random(2345), 1).
let flowerNoise;
const noise = () => (flowerNoise ??= new NoiseGeneratorPerlin(new JavaRandom(2345n), 1));

// Flower picker overrides (func_150572_a) by registry slot: plains classes, the flower forest
// (BiomeGenForest type 1) and the swamp. Everything else uses the BiomeGenBase picker.
const PLAINS_FLOWERS = new Set([1, 129]), FLOWER_FOREST = 132, SWAMP = 6;

// BiomeGenBase.func_150572_a and overrides as [block, metadata]. BlockFlower names map to
// yellow_flower (dandelion) or red_flower with the name's index as metadata.
export function pickFlower(slot, random, x, y, z) {
  if (PLAINS_FLOWERS.has(slot)) {
    if (noise().value(x / 200, z / 200) < -0.8) return [RED_FLOWER, 4 + random.nextInt(4)];
    if (random.nextInt(3) > 0) {
      const n = random.nextInt(3);
      return [RED_FLOWER, n === 0 ? 0 : n === 1 ? 3 : 8];
    }
    return [YELLOW_FLOWER, 0];
  }
  if (slot === FLOWER_FOREST) {
    const d = Math.min(Math.max((1 + noise().value(x / 48, z / 48)) / 2, 0), 0.9999);
    const n = Math.trunc(d * 9);
    return [RED_FLOWER, n === 1 ? 0 : n];
  }
  if (slot === SWAMP) return [RED_FLOWER, 1];
  return random.nextInt(3) > 0 ? [YELLOW_FLOWER, 0] : [RED_FLOWER, 0];
}

// One BiomeDecorator object (its generator fields and counts) for a biome slot.
export class BiomeDecorator {
  constructor(slot) {
    this.slot = slot;
    this.counts = decoratorCounts(slot);
    this.world = null;
    this.clay = new WorldGenClay(4);
    this.sand = new WorldGenSand(SAND, 7);
    this.gravel = new WorldGenSand(GRAVEL, 6);
    this.flowers = new WorldGenFlowers(YELLOW_FLOWER);
    this.brownMushroom = new WorldGenFlowers(BROWN_MUSHROOM);
    this.redMushroom = new WorldGenFlowers(RED_MUSHROOM);
    this.bigMushroom = new WorldGenBigMushroom();
    this.reeds = new WorldGenReed();
    this.cactus = new WorldGenCactus();
    this.waterlily = new WorldGenWaterlily();
  }
  // decorateChunk (func_150512_a). `trees` is the world's tree-generators.js BiomeTrees.
  decorate(world, random, slot, chunkX, chunkZ, trees) {
    if (this.world) throw new Error("Already decorating!!");
    this.world = world;
    try { this.genDecorations(world, random, slot, chunkX, chunkZ, trees); } finally { this.world = null; }
  }
  genDecorations(world, random, slot, c, d, trees) {
    const k = this.counts, at = () => [c + random.nextInt(16) + 8, d + random.nextInt(16) + 8];
    const twice = (gen) => { const [x, z] = at(); gen.generate(world, random, x, random.nextInt(world.getHeightValue(x, z) * 2), z); };
    generateOres(world, random, c, d);
    for (const [count, gen] of [[k.sand, this.sand], [k.clay, this.clay], [k.gravel, this.gravel]])
      for (let i = 0; i < count; i++) { const [x, z] = at(); gen.generate(world, random, x, world.getTopSolidOrLiquidBlock(x, z), z); }
    let treeCount = k.trees;
    if (random.nextInt(10) === 0) treeCount++;
    for (let i = 0; i < treeCount; i++) {
      const [x, z] = at(), y = world.getHeightValue(x, z), tree = pickTree(slot, random, trees);
      tree.setScale(1, 1, 1);
      if (tree.generate(world, random, x, y, z)) tree.postGenerate(world, random, x, y, z);
    }
    for (let i = 0; i < k.bigMushrooms; i++) { const [x, z] = at(); this.bigMushroom.generate(world, random, x, world.getHeightValue(x, z), z); }
    for (let i = 0; i < k.flowers; i++) {
      const [x, z] = at(), y = random.nextInt(world.getHeightValue(x, z) + 32), [block, meta] = pickFlower(slot, random, x, y, z);
      this.flowers.setBlock(block, meta);
      this.flowers.generate(world, random, x, y, z);
    }
    for (let i = 0; i < k.grass; i++) {
      const [x, z] = at(), y = random.nextInt(world.getHeightValue(x, z) * 2);
      new WorldGenTallGrass(TALL_GRASS, pickGrassMeta(slot, random)).generate(world, random, x, y, z);
    }
    for (let i = 0; i < k.deadBush; i++) twice(new WorldGenDeadBush(DEAD_BUSH));
    for (let i = 0; i < k.waterlily; i++) {
      const [x, z] = at();
      let y = random.nextInt(world.getHeightValue(x, z) * 2);
      while (y > 0 && world.isAirBlock(x, y - 1, z)) y--;
      this.waterlily.generate(world, random, x, y, z);
    }
    for (let i = 0; i < k.mushrooms; i++) {
      if (random.nextInt(4) === 0) { const [x, z] = at(); this.brownMushroom.generate(world, random, x, world.getHeightValue(x, z), z); }
      if (random.nextInt(8) === 0) twice(this.redMushroom);
    }
    if (random.nextInt(4) === 0) twice(this.brownMushroom);
    if (random.nextInt(8) === 0) twice(this.redMushroom);
    for (let i = 0; i < k.reeds + 10; i++) twice(this.reeds);
    if (random.nextInt(32) === 0) twice(new WorldGenPumpkin());
    for (let i = 0; i < k.cacti; i++) twice(this.cactus);
    if (k.liquids) {
      for (let i = 0; i < 50; i++) {
        const x = c + random.nextInt(16) + 8, y = random.nextInt(random.nextInt(248) + 8), z = d + random.nextInt(16) + 8;
        new WorldGenLiquids(FLOWING_WATER).generate(world, random, x, y, z);
      }
      for (let i = 0; i < 20; i++) {
        const x = c + random.nextInt(16) + 8, y = random.nextInt(random.nextInt(random.nextInt(240) + 8) + 8), z = d + random.nextInt(16) + 8;
        new WorldGenLiquids(FLOWING_LAVA).generate(world, random, x, y, z);
      }
    }
  }
}

// The decorator objects of one world, one per biome slot, as BiomeGenBase.theBiomeDecorator.
export class BiomeDecorators {
  constructor() { this.bySlot = new Map(); }
  get(slot) {
    let d = this.bySlot.get(slot);
    if (!d) this.bySlot.set(slot, (d = new BiomeDecorator(slot)));
    return d;
  }
}
