// Minecraft Java 1.7.10 scattered features: MapGenScatteredFeature (atx) with its Start (aty),
// ComponentScatteredFeaturePieces (atz) base Feature (aue), DesertPyramid (aub), JunglePyramid
// (auc) with its Stones selector (aud) and SwampHut (auf). Built on structure-framework.js; the
// placement predicate is structure-placement.js's templeCandidate (not re-ported).
//
// World adapter: structure-framework.js's (getBlock, setBlock(x,y,z,id,meta,flags), isAirBlock,
// getTileEntity, spawnEntity) plus
//   getTopSolidOrLiquidBlock(x, z)  World.func_72825_h: highest y+1 of a movement-blocking,
//                                   non-leaf block scanning down while y > 0, else -1;
//   getAverageGroundLevel()         WorldProvider.func_76557_i, optional: 64 (4 for superflat).
// Tiles: chest {size 27, setSlot} and dispenser {size 9, setSlot}. The witch is
// world.spawnEntity({type:"Witch", x, y, z, yaw:0, pitch:0}); redstone parts are raw id/meta.
// Start biomes come from world.getBiomeId(x, z) (BiomeGenBase registry slot); MapGen supplies
// that from its WorldChunkManager. Standalone: not wired into live generation, no NBT I/O
// (describe() lists every field the native piece would save).
import {
  StructureBoundingBox, StructureComponent, StructureStart, MapGenStructure,
  generateChestContents, DISPENSER, STICKY_PISTON, LEVER, TRIPWIRE_HOOK,
} from "./structure-framework.js";
import { dungeonEnchantedBook } from "./dungeon-generator.js";
import { templeCandidate } from "./structure-placement.js";

const AIR = 0, PLANKS = 5, LOG = 17, SANDSTONE = 24, WOOL = 35, STONE_SLAB = 44, TNT = 46,
  COBBLESTONE = 4, MOSSY_COBBLESTONE = 48, REDSTONE_WIRE = 55, WORKBENCH = 58, STONE_STAIRS = 67,
  OAK_STAIRS = 53, STONE_PRESSURE_PLATE = 70, FENCE = 85, UNPOWERED_REPEATER = 93, STONE_BRICK = 98,
  VINE = 106, SANDSTONE_STAIRS = 128, TRIPWIRE = 132, SPRUCE_STAIRS = 134, CAULDRON = 118,
  FLOWER_POT = 140;

// Biome registry slots (BiomeGenBase.ahu.n()): swampland, jungle, jungleHills.
export const SWAMP_SLOT = 6, JUNGLE_SLOTS = [21, 22];
// Direction.offsetX / offsetZ (p.a / p.b), used to place the four desert chests.
export const DIRECTION_OFFSET_X = [0, -1, 0, 1], DIRECTION_OFFSET_Z = [1, 0, -1, 0];
// BlockLever.invertMetadata (alv.b); -1 outside 0..5.
export const LEVER_INVERT = [0, 5, 4, 3, 2, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1];

// [stack, min, max, weight, maxStackSize], extracted by ScatteredFeatureProbe from aub.i, auc.l and auc.m.
export const DESERT_PYRAMID_LOOT = [[[264,1,0,[]],1,3,3,64],[[265,1,0,[]],1,5,10,64],[[266,1,0,[]],2,7,15,64],[[388,1,0,[]],1,3,2,64],[[352,1,0,[]],4,6,20,64],[[367,1,0,[]],3,7,16,64],[[329,1,0,[]],1,1,3,1],[[417,1,0,[]],1,1,1,1],[[418,1,0,[]],1,1,1,1],[[419,1,0,[]],1,1,1,1]];
export const JUNGLE_PYRAMID_LOOT = [[[264,1,0,[]],1,3,3,64],[[265,1,0,[]],1,5,10,64],[[266,1,0,[]],2,7,15,64],[[388,1,0,[]],1,3,2,64],[[352,1,0,[]],4,6,20,64],[[367,1,0,[]],3,7,16,64],[[329,1,0,[]],1,1,3,1],[[417,1,0,[]],1,1,1,1],[[418,1,0,[]],1,1,1,1],[[419,1,0,[]],1,1,1,1]];
export const JUNGLE_DISPENSER_LOOT = [[[262,1,0,[]],2,7,30,64]];
// MapGenScatteredFeature.func_82667_a: BiomeGenBase.SpawnListEntry(EntityWitch, weight 1, min 1, max 1).
export const SWAMP_HUT_SPAWN_LIST = [{ entity: "Witch", weight: 1, minGroup: 1, maxGroup: 1 }];

const withBook = (rows, random) => [...rows, [dungeonEnchantedBook(random), 1, 1, 1, 1]];

// Feature.func_74935_a averages the terrain over the columns of the piece that lie in the clip box.
export class ScatteredFeature extends StructureComponent {
  // aue(Random, x, y, z, width, height, depth): random draws the orientation first.
  constructor(random, x, y, z, width, height, depth) {
    super(0);
    this.hPos = -1;
    this.sizeX = width; this.sizeY = height; this.sizeZ = depth;
    this.coordBaseMode = random.nextInt(4);
    this.boundingBox = this.coordBaseMode === 0 || this.coordBaseMode === 2
      ? new StructureBoundingBox(x, y, z, x + width - 1, y + height - 1, z + depth - 1)
      : new StructureBoundingBox(x, y, z, x + depth - 1, y + height - 1, z + width - 1);
  }
  adjustToAverageHeight(world, bb, yOffset) {
    if (this.hPos >= 0) return true;
    let sum = 0, count = 0;
    const b = this.boundingBox, ground = world.getAverageGroundLevel ? world.getAverageGroundLevel() : 64;
    for (let z = b.minZ; z <= b.maxZ; z++) for (let x = b.minX; x <= b.maxX; x++) {
      if (bb.isVecInside(x, 64, z)) { sum = (sum + Math.max(world.getTopSolidOrLiquidBlock(x, z), ground)) | 0; count++; }
    }
    if (count === 0) return false;
    this.hPos = Math.trunc(sum / count);
    b.offset(0, this.hPos - b.minY + yOffset, 0);
    return true;
  }
  // StructureComponent.func_74869_a: dispenser block (metadata offset by orientation) plus loot.
  generateStructureDispenserContents(world, bb, random, x, y, z, meta, rows, count) {
    const wx = this.getXWithOffset(x, z), wy = this.getYWithOffset(y), wz = this.getZWithOffset(x, z);
    if (bb.isVecInside(wx, wy, wz) && world.getBlock(wx, wy, wz) !== DISPENSER) {
      world.setBlock(wx, wy, wz, DISPENSER, this.getMetadataWithOffset(DISPENSER, meta), 2);
      const tile = world.getTileEntity(wx, wy, wz);
      if (tile) generateChestContents(random, rows, tile, count);
      return true;
    }
    return false;
  }
  base() { return [this.constructor.saveId, this.coordBaseMode, this.componentType, ...this.boundingBox.toArray(), this.sizeX, this.sizeY, this.sizeZ, this.hPos]; }
}

export class DesertPyramid extends ScatteredFeature {
  static saveId = "TeDP";
  constructor(random, x, z) {
    super(random, x, 64, z, 21, 15, 21);
    this.hasPlacedChest = [false, false, false, false];
  }
  addComponentParts(world, random, bb) {
    const W = this.sizeX, D = this.sizeZ;
    const fill = (x0, y0, z0, x1, y1, z1, edge, inside, em = 0, im = 0) => this.fillWithBlocks(world, bb, x0, y0, z0, x1, y1, z1, edge, inside, false, em, im);
    const put = (id, meta, x, y, z) => this.placeBlockAtCurrentPosition(world, id, meta, x, y, z, bb);
    fill(0, -4, 0, W - 1, 0, D - 1, SANDSTONE, SANDSTONE);
    for (let i = 1; i <= 9; i++) {
      fill(i, i, i, W - 1 - i, i, D - 1 - i, SANDSTONE, SANDSTONE);
      fill(i + 1, i, i + 1, W - 2 - i, i, D - 2 - i, AIR, AIR);
    }
    for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) this.fillCurrentPositionBlocksDownwards(world, SANDSTONE, 0, x, -5, z, bb);
    const s3 = this.getMetadataWithOffset(SANDSTONE_STAIRS, 3), s2 = this.getMetadataWithOffset(SANDSTONE_STAIRS, 2),
      s0 = this.getMetadataWithOffset(SANDSTONE_STAIRS, 0), s1 = this.getMetadataWithOffset(SANDSTONE_STAIRS, 1);
    const orange = 1, blue = 11;
    fill(0, 0, 0, 4, 9, 4, SANDSTONE, AIR);
    fill(1, 10, 1, 3, 10, 3, SANDSTONE, SANDSTONE);
    put(SANDSTONE_STAIRS, s3, 2, 10, 0); put(SANDSTONE_STAIRS, s2, 2, 10, 4);
    put(SANDSTONE_STAIRS, s0, 0, 10, 2); put(SANDSTONE_STAIRS, s1, 4, 10, 2);
    fill(W - 5, 0, 0, W - 1, 9, 4, SANDSTONE, AIR);
    fill(W - 4, 10, 1, W - 2, 10, 3, SANDSTONE, SANDSTONE);
    put(SANDSTONE_STAIRS, s3, W - 3, 10, 0); put(SANDSTONE_STAIRS, s2, W - 3, 10, 4);
    put(SANDSTONE_STAIRS, s0, W - 5, 10, 2); put(SANDSTONE_STAIRS, s1, W - 1, 10, 2);
    fill(8, 0, 0, 12, 4, 4, SANDSTONE, AIR);
    fill(9, 1, 0, 11, 3, 4, AIR, AIR);
    put(SANDSTONE, 2, 9, 1, 1); put(SANDSTONE, 2, 9, 2, 1); put(SANDSTONE, 2, 9, 3, 1);
    put(SANDSTONE, 2, 10, 3, 1); put(SANDSTONE, 2, 11, 3, 1); put(SANDSTONE, 2, 11, 2, 1); put(SANDSTONE, 2, 11, 1, 1);
    fill(4, 1, 1, 8, 3, 3, SANDSTONE, AIR);
    fill(4, 1, 2, 8, 2, 2, AIR, AIR);
    fill(12, 1, 1, 16, 3, 3, SANDSTONE, AIR);
    fill(12, 1, 2, 16, 2, 2, AIR, AIR);
    fill(5, 4, 5, W - 6, 4, D - 6, SANDSTONE, SANDSTONE);
    fill(9, 4, 9, 11, 4, 11, AIR, AIR);
    fill(8, 1, 8, 8, 3, 8, SANDSTONE, SANDSTONE, 2, 2);
    fill(12, 1, 8, 12, 3, 8, SANDSTONE, SANDSTONE, 2, 2);
    fill(8, 1, 12, 8, 3, 12, SANDSTONE, SANDSTONE, 2, 2);
    fill(12, 1, 12, 12, 3, 12, SANDSTONE, SANDSTONE, 2, 2);
    fill(1, 1, 5, 4, 4, 11, SANDSTONE, SANDSTONE);
    fill(W - 5, 1, 5, W - 2, 4, 11, SANDSTONE, SANDSTONE);
    fill(6, 7, 9, 6, 7, 11, SANDSTONE, SANDSTONE);
    fill(W - 7, 7, 9, W - 7, 7, 11, SANDSTONE, SANDSTONE);
    fill(5, 5, 9, 5, 7, 11, SANDSTONE, SANDSTONE, 2, 2);
    fill(W - 6, 5, 9, W - 6, 7, 11, SANDSTONE, SANDSTONE, 2, 2);
    put(AIR, 0, 5, 5, 10); put(AIR, 0, 5, 6, 10); put(AIR, 0, 6, 6, 10);
    put(AIR, 0, W - 6, 5, 10); put(AIR, 0, W - 6, 6, 10); put(AIR, 0, W - 7, 6, 10);
    fill(2, 4, 4, 2, 6, 4, AIR, AIR);
    fill(W - 3, 4, 4, W - 3, 6, 4, AIR, AIR);
    put(SANDSTONE_STAIRS, s3, 2, 4, 5); put(SANDSTONE_STAIRS, s3, 2, 3, 4);
    put(SANDSTONE_STAIRS, s3, W - 3, 4, 5); put(SANDSTONE_STAIRS, s3, W - 3, 3, 4);
    fill(1, 1, 3, 2, 2, 3, SANDSTONE, SANDSTONE);
    fill(W - 3, 1, 3, W - 2, 2, 3, SANDSTONE, SANDSTONE);
    put(SANDSTONE_STAIRS, 0, 1, 1, 2); put(SANDSTONE_STAIRS, 0, W - 2, 1, 2);
    put(STONE_SLAB, 1, 1, 2, 2); put(STONE_SLAB, 1, W - 2, 2, 2);
    put(SANDSTONE_STAIRS, s1, 2, 1, 2); put(SANDSTONE_STAIRS, s0, W - 3, 1, 2);
    fill(4, 3, 5, 4, 3, 18, SANDSTONE, SANDSTONE);
    fill(W - 5, 3, 5, W - 5, 3, 17, SANDSTONE, SANDSTONE);
    fill(3, 1, 5, 4, 2, 16, AIR, AIR);
    fill(W - 6, 1, 5, W - 5, 2, 16, AIR, AIR);
    for (let z = 5; z <= 17; z += 2) {
      put(SANDSTONE, 2, 4, 1, z); put(SANDSTONE, 1, 4, 2, z);
      put(SANDSTONE, 2, W - 5, 1, z); put(SANDSTONE, 1, W - 5, 2, z);
    }
    for (const [x, y, z] of [[10, 0, 7], [10, 0, 8], [9, 0, 9], [11, 0, 9], [8, 0, 10], [12, 0, 10], [7, 0, 10], [13, 0, 10], [9, 0, 11], [11, 0, 11], [10, 0, 12], [10, 0, 13]])
      put(WOOL, orange, x, y, z);
    put(WOOL, blue, 10, 0, 10);
    for (let x = 0; x <= W - 1; x += W - 1) {
      put(SANDSTONE, 2, x, 2, 1); put(WOOL, orange, x, 2, 2); put(SANDSTONE, 2, x, 2, 3);
      put(SANDSTONE, 2, x, 3, 1); put(WOOL, orange, x, 3, 2); put(SANDSTONE, 2, x, 3, 3);
      put(WOOL, orange, x, 4, 1); put(SANDSTONE, 1, x, 4, 2); put(WOOL, orange, x, 4, 3);
      put(SANDSTONE, 2, x, 5, 1); put(WOOL, orange, x, 5, 2); put(SANDSTONE, 2, x, 5, 3);
      put(WOOL, orange, x, 6, 1); put(SANDSTONE, 1, x, 6, 2); put(WOOL, orange, x, 6, 3);
      put(WOOL, orange, x, 7, 1); put(WOOL, orange, x, 7, 2); put(WOOL, orange, x, 7, 3);
      put(SANDSTONE, 2, x, 8, 1); put(SANDSTONE, 2, x, 8, 2); put(SANDSTONE, 2, x, 8, 3);
    }
    for (let x = 2; x <= W - 3; x += W - 3 - 2) {
      put(SANDSTONE, 2, x - 1, 2, 0); put(WOOL, orange, x, 2, 0); put(SANDSTONE, 2, x + 1, 2, 0);
      put(SANDSTONE, 2, x - 1, 3, 0); put(WOOL, orange, x, 3, 0); put(SANDSTONE, 2, x + 1, 3, 0);
      put(WOOL, orange, x - 1, 4, 0); put(SANDSTONE, 1, x, 4, 0); put(WOOL, orange, x + 1, 4, 0);
      put(SANDSTONE, 2, x - 1, 5, 0); put(WOOL, orange, x, 5, 0); put(SANDSTONE, 2, x + 1, 5, 0);
      put(WOOL, orange, x - 1, 6, 0); put(SANDSTONE, 1, x, 6, 0); put(WOOL, orange, x + 1, 6, 0);
      put(WOOL, orange, x - 1, 7, 0); put(WOOL, orange, x, 7, 0); put(WOOL, orange, x + 1, 7, 0);
      put(SANDSTONE, 2, x - 1, 8, 0); put(SANDSTONE, 2, x, 8, 0); put(SANDSTONE, 2, x + 1, 8, 0);
    }
    fill(8, 4, 0, 12, 6, 0, SANDSTONE, SANDSTONE, 2, 2);
    put(AIR, 0, 8, 6, 0); put(AIR, 0, 12, 6, 0);
    put(WOOL, orange, 9, 5, 0); put(SANDSTONE, 1, 10, 5, 0); put(WOOL, orange, 11, 5, 0);
    fill(8, -14, 8, 12, -11, 12, SANDSTONE, SANDSTONE, 2, 2);
    fill(8, -10, 8, 12, -10, 12, SANDSTONE, SANDSTONE, 1, 1);
    fill(8, -9, 8, 12, -9, 12, SANDSTONE, SANDSTONE, 2, 2);
    fill(8, -8, 8, 12, -1, 12, SANDSTONE, SANDSTONE);
    fill(9, -11, 9, 11, -1, 11, AIR, AIR);
    put(STONE_PRESSURE_PLATE, 0, 10, -11, 10);
    fill(9, -13, 9, 11, -13, 11, TNT, AIR);
    put(AIR, 0, 8, -11, 10); put(AIR, 0, 8, -10, 10);
    put(SANDSTONE, 1, 7, -10, 10); put(SANDSTONE, 2, 7, -11, 10);
    put(AIR, 0, 12, -11, 10); put(AIR, 0, 12, -10, 10);
    put(SANDSTONE, 1, 13, -10, 10); put(SANDSTONE, 2, 13, -11, 10);
    put(AIR, 0, 10, -11, 8); put(AIR, 0, 10, -10, 8);
    put(SANDSTONE, 1, 10, -10, 7); put(SANDSTONE, 2, 10, -11, 7);
    put(AIR, 0, 10, -11, 12); put(AIR, 0, 10, -10, 12);
    put(SANDSTONE, 1, 10, -10, 13); put(SANDSTONE, 2, 10, -11, 13);
    for (let n = 0; n < 4; n++) {
      if (this.hasPlacedChest[n]) continue;
      const dx = DIRECTION_OFFSET_X[n] * 2, dz = DIRECTION_OFFSET_Z[n] * 2;
      this.hasPlacedChest[n] = this.generateStructureChestContents(world, bb, random, 10 + dx, -11, 10 + dz, withBook(DESERT_PYRAMID_LOOT, random), 2 + random.nextInt(5));
    }
    return true;
  }
  describe() { return [...this.base(), [...this.hasPlacedChest]]; }
}

// JunglePyramid.Stones (aud): cobblestone with probability 0.4, otherwise mossy cobblestone.
export const jungleStones = {
  select(random) { return [random.nextFloat() < Math.fround(0.4) ? COBBLESTONE : MOSSY_COBBLESTONE, 0]; },
};

export class JunglePyramid extends ScatteredFeature {
  static saveId = "TeJP";
  constructor(random, x, z) {
    super(random, x, 64, z, 12, 10, 15);
    this.placedMainChest = false; this.placedHiddenChest = false; this.placedTrap1 = false; this.placedTrap2 = false;
  }
  addComponentParts(world, random, bb) {
    if (!this.adjustToAverageHeight(world, bb, 0)) return false;
    const W = this.sizeX, D = this.sizeZ;
    const m = (id, meta) => this.getMetadataWithOffset(id, meta);
    const st3 = m(STONE_STAIRS, 3), st2 = m(STONE_STAIRS, 2), st0 = m(STONE_STAIRS, 0), st1 = m(STONE_STAIRS, 1);
    const rand = (x0, y0, z0, x1, y1, z1) => this.fillWithRandomizedBlocks(world, bb, x0, y0, z0, x1, y1, z1, false, random, jungleStones);
    const air = (x0, y0, z0, x1, y1, z1) => this.fillWithAir(world, bb, x0, y0, z0, x1, y1, z1);
    const put = (id, meta, x, y, z) => this.placeBlockAtCurrentPosition(world, id, meta, x, y, z, bb);
    rand(0, -4, 0, W - 1, 0, D - 1);
    rand(2, 1, 2, 9, 2, 2); rand(2, 1, 12, 9, 2, 12); rand(2, 1, 3, 2, 2, 11); rand(9, 1, 3, 9, 2, 11);
    rand(1, 3, 1, 10, 6, 1); rand(1, 3, 13, 10, 6, 13); rand(1, 3, 2, 1, 6, 12); rand(10, 3, 2, 10, 6, 12);
    rand(2, 3, 2, 9, 3, 12); rand(2, 6, 2, 9, 6, 12); rand(3, 7, 3, 8, 7, 11); rand(4, 8, 4, 7, 8, 10);
    air(3, 1, 3, 8, 2, 11); air(4, 3, 6, 7, 3, 9); air(2, 4, 2, 9, 5, 12); air(4, 6, 5, 7, 6, 9); air(5, 7, 6, 6, 7, 8);
    air(5, 1, 2, 6, 2, 2); air(5, 2, 12, 6, 2, 12); air(5, 5, 1, 6, 5, 1); air(5, 5, 13, 6, 5, 13);
    put(AIR, 0, 1, 5, 5); put(AIR, 0, 10, 5, 5); put(AIR, 0, 1, 5, 9); put(AIR, 0, 10, 5, 9);
    for (let z = 0; z <= 14; z += 14) {
      rand(2, 4, z, 2, 5, z); rand(4, 4, z, 4, 5, z); rand(7, 4, z, 7, 5, z); rand(9, 4, z, 9, 5, z);
    }
    rand(5, 6, 0, 6, 6, 0);
    for (let x = 0; x <= 11; x += 11) {
      for (let z = 2; z <= 12; z += 2) rand(x, 4, z, x, 5, z);
      rand(x, 6, 5, x, 6, 5); rand(x, 6, 9, x, 6, 9);
    }
    rand(2, 7, 2, 2, 9, 2); rand(9, 7, 2, 9, 9, 2); rand(2, 7, 12, 2, 9, 12); rand(9, 7, 12, 9, 9, 12);
    rand(4, 9, 4, 4, 9, 4); rand(7, 9, 4, 7, 9, 4); rand(4, 9, 10, 4, 9, 10); rand(7, 9, 10, 7, 9, 10);
    rand(5, 9, 7, 6, 9, 7);
    put(STONE_STAIRS, st3, 5, 9, 6); put(STONE_STAIRS, st3, 6, 9, 6);
    put(STONE_STAIRS, st2, 5, 9, 8); put(STONE_STAIRS, st2, 6, 9, 8);
    put(STONE_STAIRS, st3, 4, 0, 0); put(STONE_STAIRS, st3, 5, 0, 0); put(STONE_STAIRS, st3, 6, 0, 0); put(STONE_STAIRS, st3, 7, 0, 0);
    put(STONE_STAIRS, st3, 4, 1, 8); put(STONE_STAIRS, st3, 4, 2, 9); put(STONE_STAIRS, st3, 4, 3, 10);
    put(STONE_STAIRS, st3, 7, 1, 8); put(STONE_STAIRS, st3, 7, 2, 9); put(STONE_STAIRS, st3, 7, 3, 10);
    rand(4, 1, 9, 4, 1, 9); rand(7, 1, 9, 7, 1, 9); rand(4, 1, 10, 7, 2, 10); rand(5, 4, 5, 6, 4, 5);
    put(STONE_STAIRS, st0, 4, 4, 5); put(STONE_STAIRS, st1, 7, 4, 5);
    for (let n = 0; n < 4; n++) {
      put(STONE_STAIRS, st2, 5, 0 - n, 6 + n); put(STONE_STAIRS, st2, 6, 0 - n, 6 + n);
      air(5, 0 - n, 7 + n, 6, 0 - n, 9 + n);
    }
    air(1, -3, 12, 10, -1, 13); air(1, -3, 1, 3, -1, 13); air(1, -3, 1, 9, -1, 5);
    for (let z = 1; z <= 13; z += 2) rand(1, -3, z, 1, -2, z);
    for (let z = 2; z <= 12; z += 2) rand(1, -1, z, 3, -1, z);
    rand(2, -2, 1, 5, -2, 1); rand(7, -2, 1, 9, -2, 1); rand(6, -3, 1, 6, -3, 1); rand(6, -1, 1, 6, -1, 1);
    put(TRIPWIRE_HOOK, m(TRIPWIRE_HOOK, 3) | 4, 1, -3, 8); put(TRIPWIRE_HOOK, m(TRIPWIRE_HOOK, 1) | 4, 4, -3, 8);
    put(TRIPWIRE, 4, 2, -3, 8); put(TRIPWIRE, 4, 3, -3, 8);
    for (const z of [7, 6, 5, 4, 3, 2, 1]) put(REDSTONE_WIRE, 0, 5, -3, z);
    put(REDSTONE_WIRE, 0, 4, -3, 1);
    put(MOSSY_COBBLESTONE, 0, 3, -3, 1);
    if (!this.placedTrap1) this.placedTrap1 = this.generateStructureDispenserContents(world, bb, random, 3, -2, 1, 2, JUNGLE_DISPENSER_LOOT, 2);
    put(VINE, 15, 3, -2, 2);
    put(TRIPWIRE_HOOK, m(TRIPWIRE_HOOK, 2) | 4, 7, -3, 1); put(TRIPWIRE_HOOK, m(TRIPWIRE_HOOK, 0) | 4, 7, -3, 5);
    put(TRIPWIRE, 4, 7, -3, 2); put(TRIPWIRE, 4, 7, -3, 3); put(TRIPWIRE, 4, 7, -3, 4);
    put(REDSTONE_WIRE, 0, 8, -3, 6); put(REDSTONE_WIRE, 0, 9, -3, 6); put(REDSTONE_WIRE, 0, 9, -3, 5);
    put(MOSSY_COBBLESTONE, 0, 9, -3, 4); put(REDSTONE_WIRE, 0, 9, -2, 4);
    if (!this.placedTrap2) this.placedTrap2 = this.generateStructureDispenserContents(world, bb, random, 9, -2, 3, 4, JUNGLE_DISPENSER_LOOT, 2);
    put(VINE, 15, 8, -1, 3); put(VINE, 15, 8, -2, 3);
    if (!this.placedMainChest) this.placedMainChest = this.generateStructureChestContents(world, bb, random, 8, -3, 3, withBook(JUNGLE_PYRAMID_LOOT, random), 2 + random.nextInt(5));
    put(MOSSY_COBBLESTONE, 0, 9, -3, 2); put(MOSSY_COBBLESTONE, 0, 8, -3, 1); put(MOSSY_COBBLESTONE, 0, 4, -3, 5);
    put(MOSSY_COBBLESTONE, 0, 5, -2, 5); put(MOSSY_COBBLESTONE, 0, 5, -1, 5); put(MOSSY_COBBLESTONE, 0, 6, -3, 5);
    put(MOSSY_COBBLESTONE, 0, 7, -2, 5); put(MOSSY_COBBLESTONE, 0, 7, -1, 5); put(MOSSY_COBBLESTONE, 0, 8, -3, 5);
    rand(9, -1, 1, 9, -1, 5);
    air(8, -3, 8, 10, -1, 10);
    put(STONE_BRICK, 3, 8, -2, 11); put(STONE_BRICK, 3, 9, -2, 11); put(STONE_BRICK, 3, 10, -2, 11);
    for (const x of [8, 9, 10]) put(LEVER, LEVER_INVERT[m(LEVER, 2)], x, -2, 12);
    rand(8, -3, 8, 8, -3, 10); rand(10, -3, 8, 10, -3, 10);
    put(MOSSY_COBBLESTONE, 0, 10, -2, 9);
    put(REDSTONE_WIRE, 0, 8, -2, 9); put(REDSTONE_WIRE, 0, 8, -2, 10); put(REDSTONE_WIRE, 0, 10, -1, 9);
    put(STICKY_PISTON, 1, 9, -2, 8);
    put(STICKY_PISTON, m(STICKY_PISTON, 4), 10, -2, 8); put(STICKY_PISTON, m(STICKY_PISTON, 4), 10, -1, 8);
    put(UNPOWERED_REPEATER, m(UNPOWERED_REPEATER, 2), 10, -2, 10);
    if (!this.placedHiddenChest) this.placedHiddenChest = this.generateStructureChestContents(world, bb, random, 9, -3, 10, withBook(JUNGLE_PYRAMID_LOOT, random), 2 + random.nextInt(5));
    return true;
  }
  describe() { return [...this.base(), [this.placedMainChest, this.placedHiddenChest, this.placedTrap1, this.placedTrap2]]; }
}

export class SwampHut extends ScatteredFeature {
  static saveId = "TeSH";
  constructor(random, x, z) {
    super(random, x, 64, z, 7, 5, 9);
    this.hasWitch = false;
  }
  addComponentParts(world, random, bb) {
    if (!this.adjustToAverageHeight(world, bb, 0)) return false;
    const fill = (x0, y0, z0, x1, y1, z1, edge, inside, em = 0, im = 0) => this.fillWithBlocks(world, bb, x0, y0, z0, x1, y1, z1, edge, inside, false, em, im);
    const put = (id, meta, x, y, z) => this.placeBlockAtCurrentPosition(world, id, meta, x, y, z, bb);
    fill(1, 1, 1, 5, 1, 7, PLANKS, PLANKS, 1, 1);
    fill(1, 4, 2, 5, 4, 7, PLANKS, PLANKS, 1, 1);
    fill(2, 1, 0, 4, 1, 0, PLANKS, PLANKS, 1, 1);
    fill(2, 2, 2, 3, 3, 2, PLANKS, PLANKS, 1, 1);
    fill(1, 2, 3, 1, 3, 6, PLANKS, PLANKS, 1, 1);
    fill(5, 2, 3, 5, 3, 6, PLANKS, PLANKS, 1, 1);
    fill(2, 2, 7, 4, 3, 7, PLANKS, PLANKS, 1, 1);
    fill(1, 0, 2, 1, 3, 2, LOG, LOG);
    fill(5, 0, 2, 5, 3, 2, LOG, LOG);
    fill(1, 0, 7, 1, 3, 7, LOG, LOG);
    fill(5, 0, 7, 5, 3, 7, LOG, LOG);
    put(FENCE, 0, 2, 3, 2); put(FENCE, 0, 3, 3, 7);
    put(AIR, 0, 1, 3, 4); put(AIR, 0, 5, 3, 4); put(AIR, 0, 5, 3, 5);
    put(FLOWER_POT, 7, 1, 3, 5);
    put(WORKBENCH, 0, 3, 2, 6);
    put(CAULDRON, 0, 4, 2, 6);
    put(FENCE, 0, 1, 2, 1); put(FENCE, 0, 5, 2, 1);
    const s3 = this.getMetadataWithOffset(OAK_STAIRS, 3), s1 = this.getMetadataWithOffset(OAK_STAIRS, 1),
      s0 = this.getMetadataWithOffset(OAK_STAIRS, 0), s2 = this.getMetadataWithOffset(OAK_STAIRS, 2);
    fill(0, 4, 1, 6, 4, 1, SPRUCE_STAIRS, SPRUCE_STAIRS, s3, s3);
    fill(0, 4, 2, 0, 4, 7, SPRUCE_STAIRS, SPRUCE_STAIRS, s0, s0);
    fill(6, 4, 2, 6, 4, 7, SPRUCE_STAIRS, SPRUCE_STAIRS, s1, s1);
    fill(0, 4, 8, 6, 4, 8, SPRUCE_STAIRS, SPRUCE_STAIRS, s2, s2);
    for (let z = 2; z <= 7; z += 5) for (let x = 1; x <= 5; x += 4) this.fillCurrentPositionBlocksDownwards(world, LOG, 0, x, -1, z, bb);
    if (!this.hasWitch) {
      const x = this.getXWithOffset(2, 5), y = this.getYWithOffset(2), z = this.getZWithOffset(2, 5);
      if (bb.isVecInside(x, y, z)) {
        this.hasWitch = true;
        world.spawnEntity({ type: "Witch", x: x + 0.5, y, z: z + 0.5, yaw: 0, pitch: 0 });
      }
    }
    return true;
  }
  describe() { return [...this.base(), [this.hasWitch]]; }
}

// MapGenScatteredFeature.Start (aty): the biome at the chunk's centre block picks the piece.
export class StructureScatteredFeatureStart extends StructureStart {
  constructor(world, random, chunkX, chunkZ) {
    super(chunkX, chunkZ);
    const slot = world.getBiomeId(chunkX * 16 + 8, chunkZ * 16 + 8);
    const x = chunkX * 16, z = chunkZ * 16;
    const piece = JUNGLE_SLOTS.includes(slot) ? new JunglePyramid(random, x, z)
      : slot === SWAMP_SLOT ? new SwampHut(random, x, z) : new DesertPyramid(random, x, z);
    this.components.push(piece);
    this.updateBoundingBox();
  }
}

// MapGenScatteredFeature (atx). manager: WorldChunkManager (biomeAt(x,z).slot).
export class MapGenScatteredFeature extends MapGenStructure {
  constructor(worldSeed, manager, { distance = 32 } = {}) {
    super(worldSeed);
    this.manager = manager; this.distance = distance;
    this.world = { getBiomeId: (x, z) => manager.biomeAt(x, z).slot };
  }
  get structureName() { return "Temple"; }
  canSpawnStructureAtCoords(x, z) { return templeCandidate(this.worldSeed, this.manager, x, z, { distance: this.distance }); }
  getStructureStart(x, z) { return new StructureScatteredFeatureStart(this.world, this.random, x, z); }
  // func_143030_a: is the structure covering this block a swamp hut?
  isSwampHut(x, y, z) {
    const start = this.getStructureAt(x, y, z);
    if (!(start instanceof StructureScatteredFeatureStart) || start.components.length === 0) return false;
    return start.components[0] instanceof SwampHut;
  }
  // func_82667_a: the creature list for swamp huts (witches).
  getScatteredFeatureSpawnList() { return SWAMP_HUT_SPAWN_LIST; }
}
