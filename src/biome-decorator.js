// 1.7.10 BiomeDecorator.decorateChunk / genDecorations (aia), the base decorator driver: ores,
// sand/clay/gravel discs, biome trees, big mushrooms, biome flowers, grass, dead bushes, lilies,
// mushrooms, reeds, pumpkins, cacti and water/lava springs, in native draw order. Counts come
// from the decorator object of the given registry slot (decoration-features.js).
// BiomeDecoration.decorate adds BiomeGenBase.decorate and every 1.7.10 override on top: emerald
// ore and monster eggs, double plants, desert wells, the roofed-forest grid, ice spikes and
// paths, taiga boulders, jungle melons and vines, plains counts and mutated delegation.
// The world is a gen-world.js GenWorld (or any adapter with the same block, tick and height
// calls). Replayed natively in biome-decorator.test.js and biome-overrides.test.js.
import { JavaRandom } from "./java-random.js";
import { NoiseGeneratorPerlin } from "./noise.js";
import { generateOres, WorldGenMinable } from "./ore-generator.js";
import {
  decoratorCounts, WorldGenClay, WorldGenSand, WorldGenFlowers, WorldGenTallGrass, WorldGenDeadBush,
  WorldGenWaterlily, WorldGenReed, WorldGenPumpkin, WorldGenCactus,
  SAND, GRAVEL, TALL_GRASS, DEAD_BUSH, YELLOW_FLOWER, RED_FLOWER, BROWN_MUSHROOM, RED_MUSHROOM,
} from "./decoration-features.js";
import { pickTree, pickGrassMeta, WorldGenBigMushroom, BiomeTrees } from "./tree-generators.js";
import { WorldGenLiquids } from "./springs.js";
import {
  WorldGenDoublePlant, WorldGenDesertWells, WorldGenMelon, WorldGenVines, WorldGenIceSpike, WorldGenIcePath,
  WorldGenBlockBlob, STONE, EMERALD_ORE, MONSTER_EGG, MOSSY_COBBLESTONE,
} from "./biome-features.js";

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

// Biome classes with a decorate override, as [class, parameter] by registry slot: BiomeGenForest
// type, plains/ice sunflower or spike flag, taiga type, or the base slot of a mutated biome.
// Every other slot (and BiomeGenMesa, which only calls super) runs BiomeGenBase.decorate.
const CLASSES = {
  aip: [[1, 0], [129, 1]], aic: [[2], [17]], aid: [[3], [20], [34], [131], [162]],
  aif: [[4, 0], [18, 0], [27, 2], [28, 2], [29, 3], [132, 1]],
  aiw: [[5, 0], [19, 0], [30, 0], [31, 0], [32, 1], [33, 1], [160, 2], [161, 2]],
  aij: [[12, 0], [13, 0], [140, 1]], aik: [[21], [22], [23]], ais: [[35], [36]],
  ain: [[130, 2], [133, 5], [134, 6], [149, 21], [151, 23], [158, 30]],
  aig: [[155, 27], [156, 28]], aih: [[157, 29]], ait: [[163, 35], [164, 36]],
};
export const BIOME_DECORATE = new Map(Object.entries(CLASSES).flatMap(([cls, rows]) => rows.map(([slot, param = -1]) => [slot, [cls, param]])));

// BiomeGenBase.decorate and its overrides for one world: one decorator object per slot, the
// world's tree generators and the class-static WorldGenDoublePlant (BiomeGenBase.field_150610_ae).
export class BiomeDecoration {
  constructor(trees = new BiomeTrees()) {
    this.trees = trees;
    this.decorators = new BiomeDecorators();
    this.doublePlant = new WorldGenDoublePlant();
    this.monsterEgg = new WorldGenMinable(MONSTER_EGG, 8);
    this.boulder = new WorldGenBlockBlob(MOSSY_COBBLESTONE, 0);
    this.iceSpike = new WorldGenIceSpike();
    this.icePath = new WorldGenIcePath(4);
  }
  base(world, random, slot, c, d, decoratorSlot = slot) {
    this.decorators.get(decoratorSlot).decorate(world, random, slot, c, d, this.trees);
  }
  doublePlants(world, random, type, count, c, d) {
    this.doublePlant.setType(type);
    for (let i = 0; i < count; i++) {
      const x = c + random.nextInt(16) + 8, z = d + random.nextInt(16) + 8;
      this.doublePlant.generate(world, random, x, random.nextInt(world.getHeightValue(x, z) + 32), z);
    }
  }
  // BiomeGenBase.decorate(world, random, chunk block x, chunk block z) for the biome in `slot`.
  decorate(world, random, slot, c, d) {
    const [cls, param] = BIOME_DECORATE.get(slot) ?? ["ahu", -1];
    const at = () => [c + random.nextInt(16) + 8, d + random.nextInt(16) + 8];
    switch (cls) {
      case "aip": {
        const counts = this.decorators.get(slot).counts;
        if (noise().value((c + 8) / 200, (d + 8) / 200) < -0.8) { counts.flowers = 15; counts.grass = 5; }
        else { counts.flowers = 4; counts.grass = 10; this.doublePlants(world, random, 2, 7, c, d); }
        if (param) this.doublePlants(world, random, 0, 10, c, d);
        return this.base(world, random, slot, c, d);
      }
      case "aic": {
        this.base(world, random, slot, c, d);
        if (random.nextInt(1000) === 0) { const [x, z] = at(); new WorldGenDesertWells().generate(world, random, x, world.getHeightValue(x, z) + 1, z); }
        return;
      }
      case "aid": {
        this.base(world, random, slot, c, d);
        for (let i = 0, n = 3 + random.nextInt(6); i < n; i++) {
          const x = c + random.nextInt(16), y = random.nextInt(28) + 4, z = d + random.nextInt(16);
          if (world.getBlock(x, y, z) === STONE) world.setBlock(x, y, z, EMERALD_ORE, 0, 2);
        }
        for (let i = 0; i < 7; i++) {
          const x = c + random.nextInt(16), y = random.nextInt(64), z = d + random.nextInt(16);
          this.monsterEgg.generate(world, random, x, y, z);
        }
        return;
      }
      case "aif": {
        if (param === 3) {
          for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
            const x = c + i * 4 + 1 + 8 + random.nextInt(3), z = d + j * 4 + 1 + 8 + random.nextInt(3), y = world.getHeightValue(x, z);
            if (random.nextInt(20) === 0) { new WorldGenBigMushroom().generate(world, random, x, y, z); continue; }
            const tree = pickTree(slot, random, this.trees);
            tree.setScale(1, 1, 1);
            if (tree.generate(world, random, x, y, z)) tree.postGenerate(world, random, x, y, z);
          }
        }
        let n = random.nextInt(5) - 3;
        if (param === 1) n += 2;
        for (let i = 0; i < n; i++) {
          this.doublePlant.setType([1, 4, 5][random.nextInt(3)]);
          for (let k = 0; k < 5; k++) {
            const [x, z] = at();
            if (this.doublePlant.generate(world, random, x, random.nextInt(world.getHeightValue(x, z) + 32), z)) break;
          }
        }
        return this.base(world, random, slot, c, d);
      }
      case "aiw": {
        if (param === 1 || param === 2) {
          for (let i = 0, n = random.nextInt(3); i < n; i++) { const [x, z] = at(); this.boulder.generate(world, random, x, world.getHeightValue(x, z), z); }
        }
        this.doublePlants(world, random, 3, 7, c, d);
        return this.base(world, random, slot, c, d);
      }
      case "aij": {
        if (param) {
          for (let i = 0; i < 3; i++) { const [x, z] = at(); this.iceSpike.generate(world, random, x, world.getHeightValue(x, z), z); }
          for (let i = 0; i < 2; i++) { const [x, z] = at(); this.icePath.generate(world, random, x, world.getHeightValue(x, z), z); }
        }
        return this.base(world, random, slot, c, d);
      }
      case "aik": {
        this.base(world, random, slot, c, d);
        const [x, z] = at();
        new WorldGenMelon().generate(world, random, x, random.nextInt(world.getHeightValue(x, z) * 2), z);
        const vines = new WorldGenVines();
        for (let i = 0; i < 50; i++) { const [vx, vz] = at(); vines.generate(world, random, vx, 128, vz); }
        return;
      }
      case "ais":
        this.doublePlants(world, random, 2, 7, c, d);
        return this.base(world, random, slot, c, d);
      // BiomeGenMutated: the base biome's decorator object with the mutated biome.
      case "ain": case "aig": return this.base(world, random, slot, c, d, param);
      // Mutated roofed forest: the whole base biome decorate.
      case "aih": return this.decorate(world, random, param, c, d);
      default: return this.base(world, random, slot, c, d);
    }
  }
}
