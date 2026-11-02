// Minecraft Java 1.7.10 BiomeDecorator counts and its simple feature generators:
// WorldGenClay, WorldGenSand (sand and gravel discs), WorldGenFlowers (flowers and
// mushrooms), WorldGenTallGrass, WorldGenDeadBush, WorldGenWaterlily,
// WorldGenReed, WorldGenPumpkin and WorldGenCactus, with the Block
// canBlockStay/canPlaceBlockAt rules they call. Original numeric IDs.
// World adapter: getBlock(x,y,z), getBlockMetadata(x,y,z), getLight(x,y,z)
// (getFullBlockLightValue), setBlock(x,y,z,id,meta,flags), hasNoSky, and block
// properties isSolid(id), isReplaceable(id), isOpaqueCube(id), solidTop(id, meta)
// (World.doesBlockHaveSolidTopSurface). isAirBlock is a block read of 0.
// Trees, big mushrooms, springs, the decorator driver and biome decorate
// overrides are not here.

export const AIR = 0, GRASS = 2, DIRT = 3, FLOWING_WATER = 8, WATER = 9, SAND = 12, GRAVEL = 13,
  LEAVES = 18, TALL_GRASS = 31, DEAD_BUSH = 32, YELLOW_FLOWER = 37, RED_FLOWER = 38,
  BROWN_MUSHROOM = 39, RED_MUSHROOM = 40, FARMLAND = 60, CACTUS = 81, CLAY = 82, REEDS = 83,
  PUMPKIN = 86, MYCELIUM = 110, LILY_PAD = 111, STAINED_CLAY = 159, LEAVES2 = 161, HARDENED_CLAY = 172;

// BiomeDecorator fields after each biome constructor, keyed by registry slot,
// in genDecorations order (see DECORATOR_FIELDS). Slots 130-167 hold
// BiomeGenMutated objects whose decorate delegates to the base biome's decorator.
export const DECORATOR_FIELDS = ["sand", "clay", "gravel", "trees", "bigMushrooms", "flowers", "grass", "deadBush", "waterlily", "mushrooms", "reeds", "cacti", "liquids"];
const D = [3,1,1,0,0,2,1,0,0,0,0,0,1], FOREST = [3,1,1,10,0,2,2,0,0,0,0,0,1], TAIGA = [3,1,1,10,0,2,1,0,0,1,0,0,1],
  MEGA_TAIGA = [3,1,1,10,0,2,7,1,0,3,0,0,1], DESERT = [3,1,1,-999,0,2,1,2,0,0,50,10,1], PLAINS = [3,1,1,-999,0,4,10,0,0,0,0,0,1],
  BARE = [3,1,1,-999,0,2,1,0,0,0,0,0,1], MUSHROOM = [3,1,1,-100,1,-100,-100,0,0,1,0,0,1], JUNGLE = [3,1,1,50,0,4,25,0,0,0,0,0,1],
  EXTREME = [3,1,1,3,0,2,1,0,0,0,0,0,1], SAVANNA = [3,1,1,1,0,4,20,0,0,0,0,0,1], MESA = [3,1,1,-999,0,0,1,20,0,0,3,5,1],
  MESA_TREES = [3,1,1,5,0,0,1,20,0,0,3,5,1], SAVANNA_M = [3,1,1,2,0,2,5,0,0,0,0,0,1];
export const DECORATOR_COUNTS = new Map([
  [0,D],[1,PLAINS],[2,DESERT],[3,D],[4,FOREST],[5,TAIGA],[6,[0,1,0,2,0,1,5,1,4,8,10,0,1]],[7,D],[8,D],[9,D],[10,D],[11,D],[12,D],[13,D],
  [14,MUSHROOM],[15,MUSHROOM],[16,BARE],[17,DESERT],[18,FOREST],[19,TAIGA],[20,EXTREME],[21,JUNGLE],[22,JUNGLE],[23,[3,1,1,2,0,4,25,0,0,0,0,0,1]],
  [24,D],[25,BARE],[26,BARE],[27,FOREST],[28,FOREST],[29,[3,1,1,-999,0,2,2,0,0,0,0,0,1]],[30,TAIGA],[31,TAIGA],[32,MEGA_TAIGA],[33,MEGA_TAIGA],
  [34,EXTREME],[35,SAVANNA],[36,SAVANNA],[37,MESA],[38,MESA_TREES],[39,MESA],
  [129,PLAINS],[130,D],[131,D],[132,[3,1,1,6,0,100,1,0,0,0,0,0,1]],[133,D],[134,D],[140,D],[149,D],[151,D],[155,D],[156,D],[157,D],[158,D],
  [160,MEGA_TAIGA],[161,MEGA_TAIGA],[162,D],[163,SAVANNA_M],[164,SAVANNA_M],[165,MESA],[166,MESA_TREES],[167,MESA],
]);
export const decoratorCounts = (slot) => Object.fromEntries(DECORATOR_FIELDS.map((k, i) => [k, DECORATOR_COUNTS.get(slot)[i]]));

const waterMaterial = (id) => id === FLOWING_WATER || id === WATER;
const leavesMaterial = (id) => id === LEAVES || id === LEAVES2;
const isAir = (world, x, y, z) => world.getBlock(x, y, z) === AIR;
const spread = (random, bound) => random.nextInt(bound) - random.nextInt(bound);

// BlockBush.canPlaceBlockOn and its overrides.
function canPlaceOn(block, below) {
  if (block === DEAD_BUSH) return below === SAND || below === HARDENED_CLAY || below === STAINED_CLAY || below === DIRT;
  if (block === LILY_PAD) return below === WATER;
  return below === GRASS || below === DIRT || below === FARMLAND;
}

// Block.canBlockStay for the blocks these generators place.
export function canBlockStay(world, block, x, y, z) {
  if (block === BROWN_MUSHROOM || block === RED_MUSHROOM) {
    if (y < 0 || y >= 256) return false;
    const below = world.getBlock(x, y - 1, z);
    return below === MYCELIUM || (below === DIRT && world.getBlockMetadata(x, y - 1, z) === 2) ||
      (world.getLight(x, y, z) < 13 && world.isOpaqueCube(below));
  }
  if (block === REEDS) {
    const below = world.getBlock(x, y - 1, z);
    if (below === REEDS) return true;
    if (below !== GRASS && below !== DIRT && below !== SAND) return false;
    return waterMaterial(world.getBlock(x - 1, y - 1, z)) || waterMaterial(world.getBlock(x + 1, y - 1, z)) ||
      waterMaterial(world.getBlock(x, y - 1, z - 1)) || waterMaterial(world.getBlock(x, y - 1, z + 1));
  }
  if (block === CACTUS) {
    if (world.isSolid(world.getBlock(x - 1, y, z)) || world.isSolid(world.getBlock(x + 1, y, z)) ||
      world.isSolid(world.getBlock(x, y, z - 1)) || world.isSolid(world.getBlock(x, y, z + 1))) return false;
    const below = world.getBlock(x, y - 1, z);
    return below === CACTUS || below === SAND;
  }
  if (block === LILY_PAD) {
    if (y < 0 || y >= 256) return false;
    return waterMaterial(world.getBlock(x, y - 1, z)) && world.getBlockMetadata(x, y - 1, z) === 0;
  }
  return canPlaceOn(block, world.getBlock(x, y - 1, z));
}

// Block.canPlaceBlockAt as called by WorldGenWaterlily (BlockBush) and WorldGenPumpkin.
export function canPlaceBlockAt(world, block, x, y, z) {
  if (block === PUMPKIN) {
    if (!world.isReplaceable(world.getBlock(x, y, z))) return false;
    const below = world.getBlock(x, y - 1, z);
    return world.solidTop(below, world.getBlockMetadata(x, y - 1, z));
  }
  return world.isReplaceable(world.getBlock(x, y, z)) && canPlaceOn(block, world.getBlock(x, y - 1, z));
}

// WorldGenClay (clay over dirt/clay, one block up and down) and WorldGenSand
// (block over dirt/grass, two up and down). Both need water material at the origin.
class DiscGenerator {
  constructor(block, radius, height, replaces) { this.block = block; this.radius = radius; this.height = height; this.replaces = replaces; }
  generate(world, random, x, y, z) {
    if (!waterMaterial(world.getBlock(x, y, z))) return false;
    const r = random.nextInt(this.radius - 2) + 2;
    for (let i = x - r; i <= x + r; i++)
      for (let k = z - r; k <= z + r; k++) {
        const dx = i - x, dz = k - z;
        if (dx * dx + dz * dz > r * r) continue;
        for (let j = y - this.height; j <= y + this.height; j++)
          if (this.replaces.includes(world.getBlock(i, j, k))) world.setBlock(i, j, k, this.block, 0, 2);
      }
    return true;
  }
}
export class WorldGenClay extends DiscGenerator { constructor(radius) { super(CLAY, radius, 1, [DIRT, CLAY]); } }
export class WorldGenSand extends DiscGenerator { constructor(block, radius) { super(block, radius, 2, [DIRT, GRASS]); } }

// WorldGenFlowers: 64 tries in an 8/4/8 spread. setBlock is func_150550_a.
export class WorldGenFlowers {
  constructor(block, meta = 0) { this.block = block; this.meta = meta; }
  setBlock(block, meta) { this.block = block; this.meta = meta; }
  generate(world, random, x, y, z) {
    for (let i = 0; i < 64; i++) {
      const px = x + spread(random, 8), py = y + spread(random, 4), pz = z + spread(random, 8);
      if (isAir(world, px, py, pz) && (!world.hasNoSky || py < 255) && canBlockStay(world, this.block, px, py, pz))
        world.setBlock(px, py, pz, this.block, this.meta, 2);
    }
    return true;
  }
}

// WorldGenTallGrass and WorldGenDeadBush: descend through air and leaves, then
// 128 or 4 tries.
class GroundPlantGenerator {
  constructor(block, meta, tries) { this.block = block; this.meta = meta; this.tries = tries; }
  generate(world, random, x, y, z) {
    for (let b; ((b = world.getBlock(x, y, z)) === AIR || leavesMaterial(b)) && y > 0; ) y--;
    for (let i = 0; i < this.tries; i++) {
      const px = x + spread(random, 8), py = y + spread(random, 4), pz = z + spread(random, 8);
      if (isAir(world, px, py, pz) && canBlockStay(world, this.block, px, py, pz))
        world.setBlock(px, py, pz, this.block, this.meta, 2);
    }
    return true;
  }
}
export class WorldGenTallGrass extends GroundPlantGenerator { constructor(block, meta) { super(block, meta, 128); } }
export class WorldGenDeadBush extends GroundPlantGenerator { constructor(block) { super(block, 0, 4); } }

export class WorldGenWaterlily {
  generate(world, random, x, y, z) {
    for (let i = 0; i < 10; i++) {
      const px = x + spread(random, 8), py = y + spread(random, 4), pz = z + spread(random, 8);
      if (isAir(world, px, py, pz) && canPlaceBlockAt(world, LILY_PAD, px, py, pz)) world.setBlock(px, py, pz, LILY_PAD, 0, 2);
    }
    return true;
  }
}

export class WorldGenReed {
  generate(world, random, x, y, z) {
    for (let i = 0; i < 20; i++) {
      const px = x + spread(random, 4), pz = z + spread(random, 4);
      if (!isAir(world, px, y, pz)) continue;
      if (!waterMaterial(world.getBlock(px - 1, y - 1, pz)) && !waterMaterial(world.getBlock(px + 1, y - 1, pz)) &&
        !waterMaterial(world.getBlock(px, y - 1, pz - 1)) && !waterMaterial(world.getBlock(px, y - 1, pz + 1))) continue;
      const height = 2 + random.nextInt(random.nextInt(3) + 1);
      for (let k = 0; k < height; k++)
        if (canBlockStay(world, REEDS, px, y + k, pz)) world.setBlock(px, y + k, pz, REEDS, 0, 2);
    }
    return true;
  }
}

export class WorldGenPumpkin {
  generate(world, random, x, y, z) {
    for (let i = 0; i < 64; i++) {
      const px = x + spread(random, 8), py = y + spread(random, 4), pz = z + spread(random, 8);
      if (isAir(world, px, py, pz) && world.getBlock(px, py - 1, pz) === GRASS && canPlaceBlockAt(world, PUMPKIN, px, py, pz))
        world.setBlock(px, py, pz, PUMPKIN, random.nextInt(4), 2);
    }
    return true;
  }
}

export class WorldGenCactus {
  generate(world, random, x, y, z) {
    for (let i = 0; i < 10; i++) {
      const px = x + spread(random, 8), py = y + spread(random, 4), pz = z + spread(random, 8);
      if (!isAir(world, px, py, pz)) continue;
      const height = 1 + random.nextInt(random.nextInt(3) + 1);
      for (let k = 0; k < height; k++)
        if (canBlockStay(world, CACTUS, px, py + k, pz)) world.setBlock(px, py + k, pz, CACTUS, 0, 2);
    }
    return true;
  }
}
