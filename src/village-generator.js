// Minecraft Java 1.7.10 village generation: MapGenVillage (avn), MapGenVillage.Start (avo) and
// StructureVillagePieces (avp) with the Start well (awa/awf), Path (awb), Torch (avt), House1 (avq),
// Church (avy), House4Garden (avw), WoodHut (avx), Hall (avv), Field1 (avr), Field2 (avs), the Blacksmith
// (avz, chest loot) and the Library (awc), over the village base class awd (desert block substitution,
// getAverageGroundLevel, spawnVillagers, ItemDoor.func_150924_a door placement).
// Built on structure-framework.js, which is not edited; the village-specific helpers live in this module.
// Placement reuses villageCandidate from structure-placement.js.
//
// World adapter, on top of the structure-framework adapter (getBlock, setBlock, isAirBlock, getTileEntity,
// spawnEntity):
//   getTopSolidOrLiquid(x, z)   World.func_72825_h: first block under the world top that blocks movement and is
//                               not leaves, as y + 1 (-1 when none)
//   getAverageGroundLevel()     WorldProvider.getAverageGroundLevel: 64, or 4 on a flat world
//   notifyBlocksOfNeighborChange?(x, y, z, id)   optional; door placement calls it for both halves
// Villager spawn records are passed to spawnEntity as {type:"Villager", x, y, z, profession}; there is no AI.
// Standalone: not wired into ChunkProviderGenerate/java-world.js, no NBT save/load, no MapGenStructureData.
import {
  StructureBoundingBox, StructureComponent, StructureStart, MapGenStructure, isAirMaterial,
} from "./structure-framework.js";
import { villageCandidate, VILLAGE_BIOMES } from "./structure-placement.js";

// ajn block ids (VillageProbe checks every one of these against the unchanged Blocks class).
export const B = {
  AIR: 0, DIRT: 3, COBBLESTONE: 4, PLANKS: 5, SAPLING: 6, FLOWING_WATER: 8, WATER: 9, FLOWING_LAVA: 10, GRAVEL: 13,
  LOG: 17, LOG2: 162, SANDSTONE: 24, WOOL: 35, DOUBLE_STONE_SLAB: 43, STONE_SLAB: 44, BOOKSHELF: 47, OBSIDIAN: 49,
  FENCE: 85, IRON_BARS: 101, GLASS_PANE: 102, TORCH: 50, OAK_STAIRS: 53, CHEST: 54, CRAFTING_TABLE: 58,
  WHEAT: 59, FARMLAND: 60, FURNACE: 61, WOODEN_DOOR: 64, LADDER: 65, STONE_STAIRS: 67, WOODEN_PRESSURE_PLATE: 72,
  CARROTS: 141, POTATOES: 142, SANDSTONE_STAIRS: 128,
};

// Block.func_149721_r (isNormalCube) for IDs 0..255, extracted by VillageProbe; the door facing reads it.
export const NORMAL_CUBES = new Set([1,2,3,4,5,7,12,13,14,15,16,17,19,21,22,23,24,25,35,41,42,43,45,47,48,49,52,56,57,58,61,62,73,74,80,82,84,86,87,88,91,97,98,99,100,103,110,112,120,121,123,124,125,129,133,137,153,155,158,159,162,170,172,173,174]);

// awa.b: desert (2) and desert hills (17); the Start's own awd-level flag stays false (it passes a null start).
export const DESERT_BIOMES = [2, 17];
export const BLACKSMITH_LOOT = [[[264,1,0,[]],1,3,3,64],[[265,1,0,[]],1,5,10,64],[[266,1,0,[]],1,3,5,64],[[297,1,0,[]],1,3,15,64],[[260,1,0,[]],1,3,15,64],[[257,1,0,[]],1,1,5,1],[[267,1,0,[]],1,1,5,1],[[307,1,0,[]],1,1,5,1],[[306,1,0,[]],1,1,5,1],[[308,1,0,[]],1,1,5,1],[[309,1,0,[]],1,1,5,1],[[49,1,0,[]],3,7,5,64],[[6,1,0,[]],3,7,5,64],[[329,1,0,[]],1,1,3,1],[[417,1,0,[]],1,1,1,1],[[418,1,0,[]],1,1,1,1],[[419,1,0,[]],1,1,1,1]];

// qh.a(Random, min, max)
const randomIntInRange = (random, min, max) => (min >= max ? min : random.nextInt(max - min + 1) + min);
// qh.a(String, default, min): Integer.parseInt or the default, then clamped up to min.
const parseOption = (value, fallback, min) => {
  let n = fallback;
  if (typeof value === "number" && Number.isInteger(value)) n = value | 0;
  else if (typeof value === "string" && /^[+-]?\d+$/.test(value) && Number(value) >= -2147483648 && Number(value) <= 2147483647) n = Number(value);
  return n < min ? min : n;
};
const javaDiv = (a, b) => Math.trunc(a / b);

// awd.b(aji, int) / awd.c(aji, int): desert substitution. Metadata is kept for gravel and stairs.
const DESERT_BLOCK = new Map([[B.LOG, B.SANDSTONE], [B.LOG2, B.SANDSTONE], [B.COBBLESTONE, B.SANDSTONE], [B.PLANKS, B.SANDSTONE], [B.OAK_STAIRS, B.SANDSTONE_STAIRS], [B.STONE_STAIRS, B.SANDSTONE_STAIRS], [B.GRAVEL, B.SANDSTONE]]);
const DESERT_META = new Map([[B.LOG, 0], [B.LOG2, 0], [B.COBBLESTONE, 0], [B.PLANKS, 2]]);
export const desertBlock = (id) => DESERT_BLOCK.get(id) ?? id;
export const desertMeta = (id, meta) => DESERT_META.get(id) ?? meta;

// ItemDoor.func_150924_a: facing from the neighbouring solid blocks and a hinge side, then both halves and the
// neighbour notifications. `door` is the placed door block (64 for villages).
export function placeDoor(world, x, y, z, facing, door = B.WOODEN_DOOR) {
  let dx = 0, dz = 0;
  if (facing === 0) dz = 1;
  if (facing === 1) dx = -1;
  if (facing === 2) dz = -1;
  if (facing === 3) dx = 1;
  const solid = (px, py, pz) => (NORMAL_CUBES.has(world.getBlock(px, py, pz)) ? 1 : 0);
  const left = solid(x - dx, y, z - dz) + solid(x - dx, y + 1, z - dz);
  const right = solid(x + dx, y, z + dz) + solid(x + dx, y + 1, z + dz);
  const doorLeft = world.getBlock(x - dx, y, z - dz) === door || world.getBlock(x - dx, y + 1, z - dz) === door;
  const doorRight = world.getBlock(x + dx, y, z + dz) === door || world.getBlock(x + dx, y + 1, z + dz) === door;
  let hinge = false;
  if (doorLeft && !doorRight) hinge = true;
  else if (right > left) hinge = true;
  world.setBlock(x, y, z, door, facing, 2);
  world.setBlock(x, y + 1, z, door, 8 | (hinge ? 1 : 0), 2);
  world.notifyBlocksOfNeighborChange?.(x, y, z, door);
  world.notifyBlocksOfNeighborChange?.(x, y + 1, z, door);
}

// awd: the village piece base class.
export class VillagePiece extends StructureComponent {
  constructor(start, depth) {
    super(depth);
    this.hpos = -1; // HPos
    this.villagerCount = 0; // VCount
    this.desert = start ? start.desertBiome : false; // Desert (awa.b of the Start)
  }
  profession(_i) { return 0; }
  extras() { return []; }
  // [saveId, mode, depth, bb x6, HPos, VCount, Desert, ...piece fields], the VillageProbe description.
  describe() {
    return [this.constructor.saveId, this.coordBaseMode, this.componentType, ...this.boundingBox.toArray(), this.hpos, this.villagerCount, this.desert, ...this.extras()];
  }
  // getNextComponentNN / PP: sideways branches at offset n along the piece (n2 up the side).
  getNextComponentNN(start, list, random, n, n2) {
    const b = this.boundingBox;
    switch (this.coordBaseMode) {
      case 2: case 0: return getNextVillageComponent(start, list, random, b.minX - 1, b.minY + n, b.minZ + n2, 1, this.componentType);
      case 1: case 3: return getNextVillageComponent(start, list, random, b.minX + n2, b.minY + n, b.minZ - 1, 2, this.componentType);
      default: return null;
    }
  }
  getNextComponentPP(start, list, random, n, n2) {
    const b = this.boundingBox;
    switch (this.coordBaseMode) {
      case 2: case 0: return getNextVillageComponent(start, list, random, b.maxX + 1, b.minY + n, b.minZ + n2, 3, this.componentType);
      case 1: case 3: return getNextVillageComponent(start, list, random, b.minX + n2, b.minY + n, b.maxZ + 1, 0, this.componentType);
      default: return null;
    }
  }
  // awd.b(World, bb): mean of max(top solid/liquid, provider level) over the columns inside the population box.
  getAverageGroundLevel(world, bb) {
    let sum = 0, count = 0;
    const b = this.boundingBox;
    for (let z = b.minZ; z <= b.maxZ; z++) for (let x = b.minX; x <= b.maxX; x++) {
      if (!bb.isVecInside(x, 64, z)) continue;
      sum += Math.max(world.getTopSolidOrLiquid(x, z), world.getAverageGroundLevel());
      count++;
    }
    return count === 0 ? -1 : javaDiv(sum, count);
  }
  static canVillageGoDeeper(bb) { return bb !== null && bb.minY > 10; }
  // awd.a(World, bb, x, y, z, count): villager spawn records at the piece's own coordinates.
  spawnVillagers(world, bb, x, y, z, count) {
    if (this.villagerCount >= count) return;
    for (let i = this.villagerCount; i < count; i++) {
      const wx = this.getXWithOffset(x + i, z), wy = this.getYWithOffset(y), wz = this.getZWithOffset(x + i, z);
      if (!bb.isVecInside(wx, wy, wz)) break;
      this.villagerCount++;
      world.spawnEntity({ type: "Villager", x: wx + 0.5, y: wy, z: wz + 0.5, profession: this.profession(i) });
    }
  }
  placeBlockAtCurrentPosition(world, id, meta, x, y, z, bb) {
    super.placeBlockAtCurrentPosition(world, this.desert ? desertBlock(id) : id, this.desert ? desertMeta(id, meta) : meta, x, y, z, bb);
  }
  fillWithBlocks(world, bb, x0, y0, z0, x1, y1, z1, edge, inside, skipAir) {
    const d = this.desert;
    super.fillWithBlocks(world, bb, x0, y0, z0, x1, y1, z1, d ? desertBlock(edge) : edge, d ? desertBlock(inside) : inside, skipAir, d ? desertMeta(edge, 0) : 0, d ? desertMeta(inside, 0) : 0);
  }
  fillCurrentPositionBlocksDownwards(world, id, meta, x, y, z, bb) {
    super.fillCurrentPositionBlocksDownwards(world, this.desert ? desertBlock(id) : id, this.desert ? desertMeta(id, meta) : meta, x, y, z, bb);
  }
  // avk.a(World, bb, Random, x, y, z, facing): the door goes in only when its position is inside bb.
  placeDoorAtCurrentPosition(world, bb, _random, x, y, z, facing) {
    const wx = this.getXWithOffset(x, z), wy = this.getYWithOffset(y), wz = this.getZWithOffset(x, z);
    if (bb.isVecInside(wx, wy, wz)) placeDoor(world, wx, wy, wz, facing);
  }
}

// avu: one weighted entry of the Start's piece list.
class PieceWeight {
  constructor(cls, weight, max) { this.cls = cls; this.weight = weight; this.count = 0; this.max = max; }
  canSpawn() { return this.max === 0 || this.count < this.max; }
}

// avp.a(List): the weight total, or -1 when no entry can still spawn.
function totalWeight(list) {
  let any = false, total = 0;
  for (const w of list) {
    if (w.max > 0 && w.count < w.max) any = true;
    total += w.weight;
  }
  return any ? total : -1;
}

// avp.c: weighted pick over the Start's list (five attempts), then the Torch fallback.
function pickPiece(start, list, random, x, y, z, mode, depth) {
  const total = totalWeight(start.pieceWeights);
  if (total <= 0) return null;
  let tries = 0;
  attempt: while (tries < 5) {
    tries++;
    let k = random.nextInt(total);
    for (const w of start.pieceWeights) {
      k -= w.weight;
      if (k >= 0) continue;
      if (!w.canSpawn() || (w === start.lastPiece && start.pieceWeights.length > 1)) continue attempt;
      const piece = w.cls.create(start, list, random, x, y, z, mode, depth);
      if (piece === null) continue;
      w.count++;
      start.lastPiece = w;
      if (!w.canSpawn()) start.pieceWeights.splice(start.pieceWeights.indexOf(w), 1);
      return piece;
    }
  }
  const bb = VillageTorch.findValidPlacement(list, x, y, z, mode);
  return bb ? new VillageTorch(start, depth, random, bb, mode) : null;
}

// avp.a(Random, size): the weighted list; random draws happen in this order. Zero-count entries are dropped.
export function getStructureVillageWeightedPieceList(random, n) {
  const list = [
    new PieceWeight(VillageHouse4Garden, 4, randomIntInRange(random, 2 + n, 4 + n * 2)),
    new PieceWeight(VillageChurch, 20, randomIntInRange(random, 0 + n, 1 + n)),
    new PieceWeight(VillageHouse1, 20, randomIntInRange(random, 0 + n, 2 + n)),
    new PieceWeight(VillageWoodHut, 3, randomIntInRange(random, 2 + n, 5 + n * 3)),
    new PieceWeight(VillageHall, 15, randomIntInRange(random, 0 + n, 2 + n)),
    new PieceWeight(VillageField1, 3, randomIntInRange(random, 1 + n, 4 + n)),
    new PieceWeight(VillageField2, 3, randomIntInRange(random, 2 + n, 4 + n * 2)),
    new PieceWeight(VillageBlacksmith, 15, randomIntInRange(random, 0, 1 + n)),
    new PieceWeight(VillageLibrary, 8, randomIntInRange(random, 0 + n, 3 + n * 2)),
  ];
  return list.filter((w) => w.max !== 0);
}

// The biome viability test both avp.d and avp.e apply to a new piece's box.
const biomeViable = (start, piece) => {
  const b = piece.boundingBox;
  const size = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
  return start.manager.areBiomesViable(javaDiv(b.minX + b.maxX, 2), javaDiv(b.minZ + b.maxZ, 2), javaDiv(size, 2) + 4, VILLAGE_BIOMES);
};

// avp.d: a house (or the Torch fallback) beside a road or the well, queued in the Start's house list.
export function getNextVillageComponent(start, list, random, x, y, z, mode, depth) {
  if (depth > 50) return null;
  if (Math.abs(x - start.boundingBox.minX) > 112 || Math.abs(z - start.boundingBox.minZ) > 112) return null;
  const piece = pickPiece(start, list, random, x, y, z, mode, depth + 1);
  if (piece !== null && biomeViable(start, piece)) {
    list.push(piece);
    start.pendingHouses.push(piece);
    return piece;
  }
  return null;
}

// avp.e: a road continuation, queued in the Start's road list.
export function getNextVillagePath(start, list, random, x, y, z, mode, depth) {
  if (depth > 3 + start.size) return null;
  if (Math.abs(x - start.boundingBox.minX) > 112 || Math.abs(z - start.boundingBox.minZ) > 112) return null;
  const bb = VillagePath.findValidPlacement(list, random, x, y, z, mode);
  if (bb !== null && bb.minY > 10) {
    const path = new VillagePath(start, depth, random, bb, mode);
    if (biomeViable(start, path)) {
      list.push(path);
      start.pendingRoads.push(path);
      return path;
    }
  }
  return null;
}

// Each piece's static a(...): box from the anchor, canVillageGoDeeper (not House4Garden), no overlap.
const createChecked = (Cls, w, h, d, deeper) => (start, list, random, x, y, z, mode, depth) => {
  const bb = StructureBoundingBox.componentBox(x, y, z, 0, 0, 0, w, h, d, mode);
  if ((deeper && !VillagePiece.canVillageGoDeeper(bb)) || StructureComponent.findIntersecting(list, bb) !== null) return null;
  return new Cls(start, depth, random, bb, mode);
};

class VillageBoxPiece extends VillagePiece {
  constructor(start, depth, _random, bb, mode) {
    super(start, depth);
    this.coordBaseMode = mode;
    this.boundingBox = bb;
  }
}

// awf: the well, also the base of the Start piece.
export class VillageWell extends VillagePiece {
  static saveId = "ViW";
  constructor(start, depth, random, x, z) {
    super(start, depth);
    this.coordBaseMode = random.nextInt(4);
    this.boundingBox = new StructureBoundingBox(x, 64, z, x + 5, 78, z + 5);
  }
  buildComponent(start, list, random) {
    const b = this.boundingBox;
    getNextVillagePath(start, list, random, b.minX - 1, b.maxY - 4, b.minZ + 1, 1, this.componentType);
    getNextVillagePath(start, list, random, b.maxX + 1, b.maxY - 4, b.minZ + 1, 3, this.componentType);
    getNextVillagePath(start, list, random, b.minX + 1, b.maxY - 4, b.minZ - 1, 2, this.componentType);
    getNextVillagePath(start, list, random, b.minX + 1, b.maxY - 4, b.maxZ + 1, 0, this.componentType);
  }
  addComponentParts(world, random, bb) {
    if (this.hpos < 0) {
      this.hpos = this.getAverageGroundLevel(world, bb);
      if (this.hpos < 0) {
        return true;
      }
      this.boundingBox.offset(0, this.hpos - this.boundingBox.maxY + 3, 0);
    }
    this.fillWithBlocks(world, bb, 1, 0, 1, 4, 12, 4, B.COBBLESTONE, B.FLOWING_WATER, false);
    this.placeBlockAtCurrentPosition(world, B.AIR, 0, 2, 12, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.AIR, 0, 3, 12, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.AIR, 0, 2, 12, 3, bb);
    this.placeBlockAtCurrentPosition(world, B.AIR, 0, 3, 12, 3, bb);
    this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 1, 13, 1, bb);
    this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 1, 14, 1, bb);
    this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 4, 13, 1, bb);
    this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 4, 14, 1, bb);
    this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 1, 13, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 1, 14, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 4, 13, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 4, 14, 4, bb);
    this.fillWithBlocks(world, bb, 1, 15, 1, 4, 15, 4, B.COBBLESTONE, B.COBBLESTONE, false);
    for (let i = 0; i <= 5; i++) {
      for (let j = 0; j <= 5; j++) {
        if (j != 0 && j != 5 && i != 0 && i != 5) continue;
        this.placeBlockAtCurrentPosition(world, B.GRAVEL, 0, j, 11, i, bb);
        this.clearCurrentPositionBlocksUpwards(world, j, 12, i, bb);
      }
    }
    return true;
  }
}

// awa: the Start piece, a well that owns the piece list, the pending queues and the biome flag.
export class VillageStartPiece extends VillageWell {
  static saveId = "ViStart";
  constructor(manager, depth, random, x, z, pieceWeights, size) {
    super(null, 0, random, x, z);
    this.manager = manager;
    this.pieceWeights = pieceWeights;
    this.size = size;
    this.lastPiece = null;
    this.pendingHouses = [];
    this.pendingRoads = [];
    this.desertBiome = DESERT_BIOMES.includes(manager.biomeAt(x, z).slot);
  }
  extras() { return [this.desertBiome, this.size]; }
}

// awb: a gravel (sandstone in deserts) road along the ground.
export class VillagePath extends VillagePiece {
  static saveId = "ViSR";
  constructor(start, depth, _random, bb, mode) {
    super(start, depth);
    this.coordBaseMode = mode;
    this.boundingBox = bb;
    this.length = Math.max(bb.xSize, bb.zSize);
  }
  extras() { return [this.length]; }
  buildComponent(start, list, random) {
    let found = false, n;
    for (n = random.nextInt(5); n < this.length - 8; n += 2 + random.nextInt(5)) {
      const piece = this.getNextComponentNN(start, list, random, 0, n);
      if (piece === null) continue;
      n += Math.max(piece.boundingBox.xSize, piece.boundingBox.zSize);
      found = true;
    }
    for (n = random.nextInt(5); n < this.length - 8; n += 2 + random.nextInt(5)) {
      const piece = this.getNextComponentPP(start, list, random, 0, n);
      if (piece === null) continue;
      n += Math.max(piece.boundingBox.xSize, piece.boundingBox.zSize);
      found = true;
    }
    const b = this.boundingBox, d = this.componentType;
    if (found && random.nextInt(3) > 0) {
      switch (this.coordBaseMode) {
        case 2: getNextVillagePath(start, list, random, b.minX - 1, b.minY, b.minZ, 1, d); break;
        case 0: getNextVillagePath(start, list, random, b.minX - 1, b.minY, b.maxZ - 2, 1, d); break;
        case 3: getNextVillagePath(start, list, random, b.maxX - 2, b.minY, b.minZ - 1, 2, d); break;
        case 1: getNextVillagePath(start, list, random, b.minX, b.minY, b.minZ - 1, 2, d); break;
        default: break;
      }
    }
    if (found && random.nextInt(3) > 0) {
      switch (this.coordBaseMode) {
        case 2: getNextVillagePath(start, list, random, b.maxX + 1, b.minY, b.minZ, 3, d); break;
        case 0: getNextVillagePath(start, list, random, b.maxX + 1, b.minY, b.maxZ - 2, 3, d); break;
        case 3: getNextVillagePath(start, list, random, b.maxX - 2, b.minY, b.maxZ + 1, 0, d); break;
        case 1: getNextVillagePath(start, list, random, b.minX, b.minY, b.maxZ + 1, 0, d); break;
        default: break;
      }
    }
  }
  // awb.a(...): lengths of 21, 14 or 7 blocks tried from longest to shortest.
  static findValidPlacement(list, random, x, y, z, mode) {
    for (let i = 7 * randomIntInRange(random, 3, 5); i >= 7; i -= 7) {
      const bb = StructureBoundingBox.componentBox(x, y, z, 0, 0, 0, 3, 3, i, mode);
      if (StructureComponent.findIntersecting(list, bb) !== null) continue;
      return bb;
    }
    return null;
  }
  addComponentParts(world, _random, bb) {
    const id = this.desert ? desertBlock(B.GRAVEL) : B.GRAVEL;
    const b = this.boundingBox;
    for (let x = b.minX; x <= b.maxX; x++) for (let z = b.minZ; z <= b.maxZ; z++) {
      if (!bb.isVecInside(x, 64, z)) continue;
      world.setBlock(x, world.getTopSolidOrLiquid(x, z) - 1, z, id, 0, 2);
    }
    return true;
  }
}

// avt: the lamp post used when no house fits.
export class VillageTorch extends VillageBoxPiece {
  static saveId = "ViL";
  static findValidPlacement(list, x, y, z, mode) {
    const bb = StructureBoundingBox.componentBox(x, y, z, 0, 0, 0, 3, 4, 2, mode);
    return StructureComponent.findIntersecting(list, bb) !== null ? null : bb;
  }
  addComponentParts(world, random, bb) {
    if (this.hpos < 0) {
      this.hpos = this.getAverageGroundLevel(world, bb);
      if (this.hpos < 0) {
        return true;
      }
      this.boundingBox.offset(0, this.hpos - this.boundingBox.maxY + 4 - 1, 0);
    }
    this.fillWithBlocks(world, bb, 0, 0, 0, 2, 3, 1, B.AIR, B.AIR, false);
    this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 1, 0, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 1, 1, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 1, 2, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.WOOL, 15, 1, 3, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.TORCH, 0, 0, 3, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.TORCH, 0, 1, 3, 1, bb);
    this.placeBlockAtCurrentPosition(world, B.TORCH, 0, 2, 3, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.TORCH, 0, 1, 3, -1, bb);
    return true;
  }
}

// avq: House1 (9 x 9 x 6, stepped roof, a librarian's house).
export class VillageHouse1 extends VillageBoxPiece {
  static saveId = "ViBH";
  static create = createChecked(VillageHouse1, 9, 9, 6, true);
  profession(_i) { return 1; }
  addComponentParts(world, random, bb) {
    let n;
    let n2;
    if (this.hpos < 0) {
      this.hpos = this.getAverageGroundLevel(world, bb);
      if (this.hpos < 0) {
        return true;
      }
      this.boundingBox.offset(0, this.hpos - this.boundingBox.maxY + 9 - 1, 0);
    }
    this.fillWithBlocks(world, bb, 1, 1, 1, 7, 5, 4, B.AIR, B.AIR, false);
    this.fillWithBlocks(world, bb, 0, 0, 0, 8, 0, 5, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 0, 5, 0, 8, 5, 5, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 0, 6, 1, 8, 6, 4, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 0, 7, 2, 8, 7, 3, B.COBBLESTONE, B.COBBLESTONE, false);
    let n3 = this.getMetadataWithOffset(B.OAK_STAIRS, 3);
    let n4 = this.getMetadataWithOffset(B.OAK_STAIRS, 2);
    for (n2 = -1; n2 <= 2; n2++) {
      for (n = 0; n <= 8; n++) {
        this.placeBlockAtCurrentPosition(world, B.OAK_STAIRS, n3, n, 6 + n2, n2, bb);
        this.placeBlockAtCurrentPosition(world, B.OAK_STAIRS, n4, n, 6 + n2, 5 - n2, bb);
      }
    }
    this.fillWithBlocks(world, bb, 0, 1, 0, 0, 1, 5, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 1, 1, 5, 8, 1, 5, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 8, 1, 0, 8, 1, 4, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 2, 1, 0, 7, 1, 0, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 0, 2, 0, 0, 4, 0, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 0, 2, 5, 0, 4, 5, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 8, 2, 5, 8, 4, 5, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 8, 2, 0, 8, 4, 0, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 0, 2, 1, 0, 4, 4, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 1, 2, 5, 7, 4, 5, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 8, 2, 1, 8, 4, 4, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 1, 2, 0, 7, 4, 0, B.PLANKS, B.PLANKS, false);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 4, 2, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 5, 2, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 6, 2, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 4, 3, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 5, 3, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 6, 3, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 0, 2, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 0, 2, 3, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 0, 3, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 0, 3, 3, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 8, 2, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 8, 2, 3, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 8, 3, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 8, 3, 3, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 2, 2, 5, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 3, 2, 5, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 5, 2, 5, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 6, 2, 5, bb);
    this.fillWithBlocks(world, bb, 1, 4, 1, 7, 4, 1, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 1, 4, 4, 7, 4, 4, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 1, 3, 4, 7, 3, 4, B.BOOKSHELF, B.BOOKSHELF, false);
    this.placeBlockAtCurrentPosition(world, B.PLANKS, 0, 7, 1, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.OAK_STAIRS, this.getMetadataWithOffset(B.OAK_STAIRS, 0), 7, 1, 3, bb);
    n2 = this.getMetadataWithOffset(B.OAK_STAIRS, 3);
    this.placeBlockAtCurrentPosition(world, B.OAK_STAIRS, n2, 6, 1, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.OAK_STAIRS, n2, 5, 1, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.OAK_STAIRS, n2, 4, 1, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.OAK_STAIRS, n2, 3, 1, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 6, 1, 3, bb);
    this.placeBlockAtCurrentPosition(world, B.WOODEN_PRESSURE_PLATE, 0, 6, 2, 3, bb);
    this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 4, 1, 3, bb);
    this.placeBlockAtCurrentPosition(world, B.WOODEN_PRESSURE_PLATE, 0, 4, 2, 3, bb);
    this.placeBlockAtCurrentPosition(world, B.CRAFTING_TABLE, 0, 7, 1, 1, bb);
    this.placeBlockAtCurrentPosition(world, B.AIR, 0, 1, 1, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.AIR, 0, 1, 2, 0, bb);
    this.placeDoorAtCurrentPosition(world, bb, random, 1, 1, 0, this.getMetadataWithOffset(B.WOODEN_DOOR, 1));
    if (isAirMaterial(this.getBlockAtCurrentPosition(world, 1, 0, -1, bb)) && !isAirMaterial(this.getBlockAtCurrentPosition(world, 1, -1, -1, bb))) {
      this.placeBlockAtCurrentPosition(world, B.STONE_STAIRS, this.getMetadataWithOffset(B.STONE_STAIRS, 3), 1, 0, -1, bb);
    }
    for (n = 0; n < 6; n++) {
      for (let i = 0; i < 9; i++) {
        this.clearCurrentPositionBlocksUpwards(world, i, 9, n, bb);
        this.fillCurrentPositionBlocksDownwards(world, B.COBBLESTONE, 0, i, -1, n, bb);
      }
    }
    this.spawnVillagers(world, bb, 2, 1, 2, 1);
    return true;
  }
}

// avy: Church (5 x 12 x 9).
export class VillageChurch extends VillageBoxPiece {
  static saveId = "ViST";
  static create = createChecked(VillageChurch, 5, 12, 9, true);
  profession(_i) { return 2; }
  addComponentParts(world, random, bb) {
    let n;
    if (this.hpos < 0) {
      this.hpos = this.getAverageGroundLevel(world, bb);
      if (this.hpos < 0) {
        return true;
      }
      this.boundingBox.offset(0, this.hpos - this.boundingBox.maxY + 12 - 1, 0);
    }
    this.fillWithBlocks(world, bb, 1, 1, 1, 3, 3, 7, B.AIR, B.AIR, false);
    this.fillWithBlocks(world, bb, 1, 5, 1, 3, 9, 3, B.AIR, B.AIR, false);
    this.fillWithBlocks(world, bb, 1, 0, 0, 3, 0, 8, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 1, 1, 0, 3, 10, 0, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 0, 1, 1, 0, 10, 3, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 4, 1, 1, 4, 10, 3, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 0, 0, 4, 0, 4, 7, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 4, 0, 4, 4, 4, 7, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 1, 1, 8, 3, 4, 8, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 1, 5, 4, 3, 10, 4, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 1, 5, 5, 3, 5, 7, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 0, 9, 0, 4, 9, 4, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 0, 4, 0, 4, 4, 4, B.COBBLESTONE, B.COBBLESTONE, false);
    this.placeBlockAtCurrentPosition(world, B.COBBLESTONE, 0, 0, 11, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.COBBLESTONE, 0, 4, 11, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.COBBLESTONE, 0, 2, 11, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.COBBLESTONE, 0, 2, 11, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.COBBLESTONE, 0, 1, 1, 6, bb);
    this.placeBlockAtCurrentPosition(world, B.COBBLESTONE, 0, 1, 1, 7, bb);
    this.placeBlockAtCurrentPosition(world, B.COBBLESTONE, 0, 2, 1, 7, bb);
    this.placeBlockAtCurrentPosition(world, B.COBBLESTONE, 0, 3, 1, 6, bb);
    this.placeBlockAtCurrentPosition(world, B.COBBLESTONE, 0, 3, 1, 7, bb);
    this.placeBlockAtCurrentPosition(world, B.STONE_STAIRS, this.getMetadataWithOffset(B.STONE_STAIRS, 3), 1, 1, 5, bb);
    this.placeBlockAtCurrentPosition(world, B.STONE_STAIRS, this.getMetadataWithOffset(B.STONE_STAIRS, 3), 2, 1, 6, bb);
    this.placeBlockAtCurrentPosition(world, B.STONE_STAIRS, this.getMetadataWithOffset(B.STONE_STAIRS, 3), 3, 1, 5, bb);
    this.placeBlockAtCurrentPosition(world, B.STONE_STAIRS, this.getMetadataWithOffset(B.STONE_STAIRS, 1), 1, 2, 7, bb);
    this.placeBlockAtCurrentPosition(world, B.STONE_STAIRS, this.getMetadataWithOffset(B.STONE_STAIRS, 0), 3, 2, 7, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 0, 2, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 0, 3, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 4, 2, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 4, 3, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 0, 6, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 0, 7, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 4, 6, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 4, 7, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 2, 6, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 2, 7, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 2, 6, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 2, 7, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 0, 3, 6, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 4, 3, 6, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 2, 3, 8, bb);
    this.placeBlockAtCurrentPosition(world, B.TORCH, 0, 2, 4, 7, bb);
    this.placeBlockAtCurrentPosition(world, B.TORCH, 0, 1, 4, 6, bb);
    this.placeBlockAtCurrentPosition(world, B.TORCH, 0, 3, 4, 6, bb);
    this.placeBlockAtCurrentPosition(world, B.TORCH, 0, 2, 4, 5, bb);
    let n2 = this.getMetadataWithOffset(B.LADDER, 4);
    for (n = 1; n <= 9; n++) {
      this.placeBlockAtCurrentPosition(world, B.LADDER, n2, 3, n, 3, bb);
    }
    this.placeBlockAtCurrentPosition(world, B.AIR, 0, 2, 1, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.AIR, 0, 2, 2, 0, bb);
    this.placeDoorAtCurrentPosition(world, bb, random, 2, 1, 0, this.getMetadataWithOffset(B.WOODEN_DOOR, 1));
    if (isAirMaterial(this.getBlockAtCurrentPosition(world, 2, 0, -1, bb)) && !isAirMaterial(this.getBlockAtCurrentPosition(world, 2, -1, -1, bb))) {
      this.placeBlockAtCurrentPosition(world, B.STONE_STAIRS, this.getMetadataWithOffset(B.STONE_STAIRS, 3), 2, 0, -1, bb);
    }
    for (n = 0; n < 9; n++) {
      for (let i = 0; i < 5; i++) {
        this.clearCurrentPositionBlocksUpwards(world, i, 12, n, bb);
        this.fillCurrentPositionBlocksDownwards(world, B.COBBLESTONE, 0, i, -1, n, bb);
      }
    }
    this.spawnVillagers(world, bb, 2, 1, 2, 1);
    return true;
  }
}

// avw: House4Garden (5 x 6 x 5); no canVillageGoDeeper check.
export class VillageHouse4Garden extends VillageBoxPiece {
  static saveId = "ViSH";
  static create = createChecked(VillageHouse4Garden, 5, 6, 5, false);
  constructor(start, depth, random, bb, mode) {
    super(start, depth, random, bb, mode);
    this.terrace = random.nextBoolean();
  }
  extras() { return [this.terrace]; }
  addComponentParts(world, random, bb) {
    let n;
    if (this.hpos < 0) {
      this.hpos = this.getAverageGroundLevel(world, bb);
      if (this.hpos < 0) {
        return true;
      }
      this.boundingBox.offset(0, this.hpos - this.boundingBox.maxY + 6 - 1, 0);
    }
    this.fillWithBlocks(world, bb, 0, 0, 0, 4, 0, 4, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 0, 4, 0, 4, 4, 4, B.LOG, B.LOG, false);
    this.fillWithBlocks(world, bb, 1, 4, 1, 3, 4, 3, B.PLANKS, B.PLANKS, false);
    this.placeBlockAtCurrentPosition(world, B.COBBLESTONE, 0, 0, 1, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.COBBLESTONE, 0, 0, 2, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.COBBLESTONE, 0, 0, 3, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.COBBLESTONE, 0, 4, 1, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.COBBLESTONE, 0, 4, 2, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.COBBLESTONE, 0, 4, 3, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.COBBLESTONE, 0, 0, 1, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.COBBLESTONE, 0, 0, 2, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.COBBLESTONE, 0, 0, 3, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.COBBLESTONE, 0, 4, 1, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.COBBLESTONE, 0, 4, 2, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.COBBLESTONE, 0, 4, 3, 4, bb);
    this.fillWithBlocks(world, bb, 0, 1, 1, 0, 3, 3, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 4, 1, 1, 4, 3, 3, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 1, 1, 4, 3, 3, 4, B.PLANKS, B.PLANKS, false);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 0, 2, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 2, 2, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 4, 2, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.PLANKS, 0, 1, 1, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.PLANKS, 0, 1, 2, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.PLANKS, 0, 1, 3, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.PLANKS, 0, 2, 3, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.PLANKS, 0, 3, 3, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.PLANKS, 0, 3, 2, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.PLANKS, 0, 3, 1, 0, bb);
    if (isAirMaterial(this.getBlockAtCurrentPosition(world, 2, 0, -1, bb)) && !isAirMaterial(this.getBlockAtCurrentPosition(world, 2, -1, -1, bb))) {
      this.placeBlockAtCurrentPosition(world, B.STONE_STAIRS, this.getMetadataWithOffset(B.STONE_STAIRS, 3), 2, 0, -1, bb);
    }
    this.fillWithBlocks(world, bb, 1, 1, 1, 3, 3, 3, B.AIR, B.AIR, false);
    if (this.terrace) {
      this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 0, 5, 0, bb);
      this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 1, 5, 0, bb);
      this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 2, 5, 0, bb);
      this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 3, 5, 0, bb);
      this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 4, 5, 0, bb);
      this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 0, 5, 4, bb);
      this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 1, 5, 4, bb);
      this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 2, 5, 4, bb);
      this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 3, 5, 4, bb);
      this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 4, 5, 4, bb);
      this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 4, 5, 1, bb);
      this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 4, 5, 2, bb);
      this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 4, 5, 3, bb);
      this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 0, 5, 1, bb);
      this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 0, 5, 2, bb);
      this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 0, 5, 3, bb);
    }
    if (this.terrace) {
      n = this.getMetadataWithOffset(B.LADDER, 3);
      this.placeBlockAtCurrentPosition(world, B.LADDER, n, 3, 1, 3, bb);
      this.placeBlockAtCurrentPosition(world, B.LADDER, n, 3, 2, 3, bb);
      this.placeBlockAtCurrentPosition(world, B.LADDER, n, 3, 3, 3, bb);
      this.placeBlockAtCurrentPosition(world, B.LADDER, n, 3, 4, 3, bb);
    }
    this.placeBlockAtCurrentPosition(world, B.TORCH, 0, 2, 3, 1, bb);
    for (n = 0; n < 5; n++) {
      for (let i = 0; i < 5; i++) {
        this.clearCurrentPositionBlocksUpwards(world, i, 6, n, bb);
        this.fillCurrentPositionBlocksDownwards(world, B.COBBLESTONE, 0, i, -1, n, bb);
      }
    }
    this.spawnVillagers(world, bb, 1, 1, 2, 1);
    return true;
  }
}

// avx: WoodHut (4 x 6 x 5).
export class VillageWoodHut extends VillageBoxPiece {
  static saveId = "ViSmH";
  static create = createChecked(VillageWoodHut, 4, 6, 5, true);
  constructor(start, depth, random, bb, mode) {
    super(start, depth, random, bb, mode);
    this.isTall = random.nextBoolean();
    this.tablePosition = random.nextInt(3);
  }
  extras() { return [this.isTall, this.tablePosition]; }
  addComponentParts(world, random, bb) {
    if (this.hpos < 0) {
      this.hpos = this.getAverageGroundLevel(world, bb);
      if (this.hpos < 0) {
        return true;
      }
      this.boundingBox.offset(0, this.hpos - this.boundingBox.maxY + 6 - 1, 0);
    }
    this.fillWithBlocks(world, bb, 1, 1, 1, 3, 5, 4, B.AIR, B.AIR, false);
    this.fillWithBlocks(world, bb, 0, 0, 0, 3, 0, 4, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 1, 0, 1, 2, 0, 3, B.DIRT, B.DIRT, false);
    if (this.isTall) {
      this.fillWithBlocks(world, bb, 1, 4, 1, 2, 4, 3, B.LOG, B.LOG, false);
    } else {
      this.fillWithBlocks(world, bb, 1, 5, 1, 2, 5, 3, B.LOG, B.LOG, false);
    }
    this.placeBlockAtCurrentPosition(world, B.LOG, 0, 1, 4, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.LOG, 0, 2, 4, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.LOG, 0, 1, 4, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.LOG, 0, 2, 4, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.LOG, 0, 0, 4, 1, bb);
    this.placeBlockAtCurrentPosition(world, B.LOG, 0, 0, 4, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.LOG, 0, 0, 4, 3, bb);
    this.placeBlockAtCurrentPosition(world, B.LOG, 0, 3, 4, 1, bb);
    this.placeBlockAtCurrentPosition(world, B.LOG, 0, 3, 4, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.LOG, 0, 3, 4, 3, bb);
    this.fillWithBlocks(world, bb, 0, 1, 0, 0, 3, 0, B.LOG, B.LOG, false);
    this.fillWithBlocks(world, bb, 3, 1, 0, 3, 3, 0, B.LOG, B.LOG, false);
    this.fillWithBlocks(world, bb, 0, 1, 4, 0, 3, 4, B.LOG, B.LOG, false);
    this.fillWithBlocks(world, bb, 3, 1, 4, 3, 3, 4, B.LOG, B.LOG, false);
    this.fillWithBlocks(world, bb, 0, 1, 1, 0, 3, 3, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 3, 1, 1, 3, 3, 3, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 1, 1, 0, 2, 3, 0, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 1, 1, 4, 2, 3, 4, B.PLANKS, B.PLANKS, false);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 0, 2, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 3, 2, 2, bb);
    if (this.tablePosition > 0) {
      this.placeBlockAtCurrentPosition(world, B.FENCE, 0, this.tablePosition, 1, 3, bb);
      this.placeBlockAtCurrentPosition(world, B.WOODEN_PRESSURE_PLATE, 0, this.tablePosition, 2, 3, bb);
    }
    this.placeBlockAtCurrentPosition(world, B.AIR, 0, 1, 1, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.AIR, 0, 1, 2, 0, bb);
    this.placeDoorAtCurrentPosition(world, bb, random, 1, 1, 0, this.getMetadataWithOffset(B.WOODEN_DOOR, 1));
    if (isAirMaterial(this.getBlockAtCurrentPosition(world, 1, 0, -1, bb)) && !isAirMaterial(this.getBlockAtCurrentPosition(world, 1, -1, -1, bb))) {
      this.placeBlockAtCurrentPosition(world, B.STONE_STAIRS, this.getMetadataWithOffset(B.STONE_STAIRS, 3), 1, 0, -1, bb);
    }
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 4; j++) {
        this.clearCurrentPositionBlocksUpwards(world, j, 6, i, bb);
        this.fillCurrentPositionBlocksDownwards(world, B.COBBLESTONE, 0, j, -1, i, bb);
      }
    }
    this.spawnVillagers(world, bb, 1, 1, 2, 1);
    return true;
  }
}

// avv: Hall (9 x 7 x 11); the first villager is a butcher.
export class VillageHall extends VillageBoxPiece {
  static saveId = "ViPH";
  static create = createChecked(VillageHall, 9, 7, 11, true);
  profession(i) { return i === 0 ? 4 : 0; }
  addComponentParts(world, random, bb) {
    let n;
    let n2;
    if (this.hpos < 0) {
      this.hpos = this.getAverageGroundLevel(world, bb);
      if (this.hpos < 0) {
        return true;
      }
      this.boundingBox.offset(0, this.hpos - this.boundingBox.maxY + 7 - 1, 0);
    }
    this.fillWithBlocks(world, bb, 1, 1, 1, 7, 4, 4, B.AIR, B.AIR, false);
    this.fillWithBlocks(world, bb, 2, 1, 6, 8, 4, 10, B.AIR, B.AIR, false);
    this.fillWithBlocks(world, bb, 2, 0, 6, 8, 0, 10, B.DIRT, B.DIRT, false);
    this.placeBlockAtCurrentPosition(world, B.COBBLESTONE, 0, 6, 0, 6, bb);
    this.fillWithBlocks(world, bb, 2, 1, 6, 2, 1, 10, B.FENCE, B.FENCE, false);
    this.fillWithBlocks(world, bb, 8, 1, 6, 8, 1, 10, B.FENCE, B.FENCE, false);
    this.fillWithBlocks(world, bb, 3, 1, 10, 7, 1, 10, B.FENCE, B.FENCE, false);
    this.fillWithBlocks(world, bb, 1, 0, 1, 7, 0, 4, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 0, 0, 0, 0, 3, 5, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 8, 0, 0, 8, 3, 5, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 1, 0, 0, 7, 1, 0, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 1, 0, 5, 7, 1, 5, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 1, 2, 0, 7, 3, 0, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 1, 2, 5, 7, 3, 5, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 0, 4, 1, 8, 4, 1, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 0, 4, 4, 8, 4, 4, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 0, 5, 2, 8, 5, 3, B.PLANKS, B.PLANKS, false);
    this.placeBlockAtCurrentPosition(world, B.PLANKS, 0, 0, 4, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.PLANKS, 0, 0, 4, 3, bb);
    this.placeBlockAtCurrentPosition(world, B.PLANKS, 0, 8, 4, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.PLANKS, 0, 8, 4, 3, bb);
    let n3 = this.getMetadataWithOffset(B.OAK_STAIRS, 3);
    let n4 = this.getMetadataWithOffset(B.OAK_STAIRS, 2);
    for (n2 = -1; n2 <= 2; n2++) {
      for (n = 0; n <= 8; n++) {
        this.placeBlockAtCurrentPosition(world, B.OAK_STAIRS, n3, n, 4 + n2, n2, bb);
        this.placeBlockAtCurrentPosition(world, B.OAK_STAIRS, n4, n, 4 + n2, 5 - n2, bb);
      }
    }
    this.placeBlockAtCurrentPosition(world, B.LOG, 0, 0, 2, 1, bb);
    this.placeBlockAtCurrentPosition(world, B.LOG, 0, 0, 2, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.LOG, 0, 8, 2, 1, bb);
    this.placeBlockAtCurrentPosition(world, B.LOG, 0, 8, 2, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 0, 2, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 0, 2, 3, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 8, 2, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 8, 2, 3, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 2, 2, 5, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 3, 2, 5, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 5, 2, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 6, 2, 5, bb);
    this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 2, 1, 3, bb);
    this.placeBlockAtCurrentPosition(world, B.WOODEN_PRESSURE_PLATE, 0, 2, 2, 3, bb);
    this.placeBlockAtCurrentPosition(world, B.PLANKS, 0, 1, 1, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.OAK_STAIRS, this.getMetadataWithOffset(B.OAK_STAIRS, 3), 2, 1, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.OAK_STAIRS, this.getMetadataWithOffset(B.OAK_STAIRS, 1), 1, 1, 3, bb);
    this.fillWithBlocks(world, bb, 5, 0, 1, 7, 0, 3, B.DOUBLE_STONE_SLAB, B.DOUBLE_STONE_SLAB, false);
    this.placeBlockAtCurrentPosition(world, B.DOUBLE_STONE_SLAB, 0, 6, 1, 1, bb);
    this.placeBlockAtCurrentPosition(world, B.DOUBLE_STONE_SLAB, 0, 6, 1, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.AIR, 0, 2, 1, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.AIR, 0, 2, 2, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.TORCH, 0, 2, 3, 1, bb);
    this.placeDoorAtCurrentPosition(world, bb, random, 2, 1, 0, this.getMetadataWithOffset(B.WOODEN_DOOR, 1));
    if (isAirMaterial(this.getBlockAtCurrentPosition(world, 2, 0, -1, bb)) && !isAirMaterial(this.getBlockAtCurrentPosition(world, 2, -1, -1, bb))) {
      this.placeBlockAtCurrentPosition(world, B.STONE_STAIRS, this.getMetadataWithOffset(B.STONE_STAIRS, 3), 2, 0, -1, bb);
    }
    this.placeBlockAtCurrentPosition(world, B.AIR, 0, 6, 1, 5, bb);
    this.placeBlockAtCurrentPosition(world, B.AIR, 0, 6, 2, 5, bb);
    this.placeBlockAtCurrentPosition(world, B.TORCH, 0, 6, 3, 4, bb);
    this.placeDoorAtCurrentPosition(world, bb, random, 6, 1, 5, this.getMetadataWithOffset(B.WOODEN_DOOR, 1));
    for (n2 = 0; n2 < 5; n2++) {
      for (n = 0; n < 9; n++) {
        this.clearCurrentPositionBlocksUpwards(world, n, 7, n2, bb);
        this.fillCurrentPositionBlocksDownwards(world, B.COBBLESTONE, 0, n, -1, n2, bb);
      }
    }
    this.spawnVillagers(world, bb, 4, 1, 2, 2);
    return true;
  }
}

// avr / avs crop choice: carrots, potatoes or wheat.
const fieldCrop = (random) => {
  switch (random.nextInt(5)) {
    case 0: return B.CARROTS;
    case 1: return B.POTATOES;
    default: return B.WHEAT;
  }
};

// avr: Field1 (13 x 4 x 9), four crop rows.
export class VillageField1 extends VillageBoxPiece {
  static saveId = "ViDF";
  static create = createChecked(VillageField1, 13, 4, 9, true);
  constructor(start, depth, random, bb, mode) {
    super(start, depth, random, bb, mode);
    this.cropA = fieldCrop(random);
    this.cropB = fieldCrop(random);
    this.cropC = fieldCrop(random);
    this.cropD = fieldCrop(random);
  }
  extras() { return [this.cropA, this.cropB, this.cropC, this.cropD]; }
  addComponentParts(world, random, bb) {
    let n;
    if (this.hpos < 0) {
      this.hpos = this.getAverageGroundLevel(world, bb);
      if (this.hpos < 0) {
        return true;
      }
      this.boundingBox.offset(0, this.hpos - this.boundingBox.maxY + 4 - 1, 0);
    }
    this.fillWithBlocks(world, bb, 0, 1, 0, 12, 4, 8, B.AIR, B.AIR, false);
    this.fillWithBlocks(world, bb, 1, 0, 1, 2, 0, 7, B.FARMLAND, B.FARMLAND, false);
    this.fillWithBlocks(world, bb, 4, 0, 1, 5, 0, 7, B.FARMLAND, B.FARMLAND, false);
    this.fillWithBlocks(world, bb, 7, 0, 1, 8, 0, 7, B.FARMLAND, B.FARMLAND, false);
    this.fillWithBlocks(world, bb, 10, 0, 1, 11, 0, 7, B.FARMLAND, B.FARMLAND, false);
    this.fillWithBlocks(world, bb, 0, 0, 0, 0, 0, 8, B.LOG, B.LOG, false);
    this.fillWithBlocks(world, bb, 6, 0, 0, 6, 0, 8, B.LOG, B.LOG, false);
    this.fillWithBlocks(world, bb, 12, 0, 0, 12, 0, 8, B.LOG, B.LOG, false);
    this.fillWithBlocks(world, bb, 1, 0, 0, 11, 0, 0, B.LOG, B.LOG, false);
    this.fillWithBlocks(world, bb, 1, 0, 8, 11, 0, 8, B.LOG, B.LOG, false);
    this.fillWithBlocks(world, bb, 3, 0, 1, 3, 0, 7, B.WATER, B.WATER, false);
    this.fillWithBlocks(world, bb, 9, 0, 1, 9, 0, 7, B.WATER, B.WATER, false);
    for (n = 1; n <= 7; n++) {
      this.placeBlockAtCurrentPosition(world, this.cropA, randomIntInRange(random, 2, 7), 1, 1, n, bb);
      this.placeBlockAtCurrentPosition(world, this.cropA, randomIntInRange(random, 2, 7), 2, 1, n, bb);
      this.placeBlockAtCurrentPosition(world, this.cropB, randomIntInRange(random, 2, 7), 4, 1, n, bb);
      this.placeBlockAtCurrentPosition(world, this.cropB, randomIntInRange(random, 2, 7), 5, 1, n, bb);
      this.placeBlockAtCurrentPosition(world, this.cropC, randomIntInRange(random, 2, 7), 7, 1, n, bb);
      this.placeBlockAtCurrentPosition(world, this.cropC, randomIntInRange(random, 2, 7), 8, 1, n, bb);
      this.placeBlockAtCurrentPosition(world, this.cropD, randomIntInRange(random, 2, 7), 10, 1, n, bb);
      this.placeBlockAtCurrentPosition(world, this.cropD, randomIntInRange(random, 2, 7), 11, 1, n, bb);
    }
    for (n = 0; n < 9; n++) {
      for (let i = 0; i < 13; i++) {
        this.clearCurrentPositionBlocksUpwards(world, i, 4, n, bb);
        this.fillCurrentPositionBlocksDownwards(world, B.DIRT, 0, i, -1, n, bb);
      }
    }
    return true;
  }
}

// avs: Field2 (7 x 4 x 9), two crop rows.
export class VillageField2 extends VillageBoxPiece {
  static saveId = "ViF";
  static create = createChecked(VillageField2, 7, 4, 9, true);
  constructor(start, depth, random, bb, mode) {
    super(start, depth, random, bb, mode);
    this.cropA = fieldCrop(random);
    this.cropB = fieldCrop(random);
  }
  extras() { return [this.cropA, this.cropB]; }
  addComponentParts(world, random, bb) {
    let n;
    if (this.hpos < 0) {
      this.hpos = this.getAverageGroundLevel(world, bb);
      if (this.hpos < 0) {
        return true;
      }
      this.boundingBox.offset(0, this.hpos - this.boundingBox.maxY + 4 - 1, 0);
    }
    this.fillWithBlocks(world, bb, 0, 1, 0, 6, 4, 8, B.AIR, B.AIR, false);
    this.fillWithBlocks(world, bb, 1, 0, 1, 2, 0, 7, B.FARMLAND, B.FARMLAND, false);
    this.fillWithBlocks(world, bb, 4, 0, 1, 5, 0, 7, B.FARMLAND, B.FARMLAND, false);
    this.fillWithBlocks(world, bb, 0, 0, 0, 0, 0, 8, B.LOG, B.LOG, false);
    this.fillWithBlocks(world, bb, 6, 0, 0, 6, 0, 8, B.LOG, B.LOG, false);
    this.fillWithBlocks(world, bb, 1, 0, 0, 5, 0, 0, B.LOG, B.LOG, false);
    this.fillWithBlocks(world, bb, 1, 0, 8, 5, 0, 8, B.LOG, B.LOG, false);
    this.fillWithBlocks(world, bb, 3, 0, 1, 3, 0, 7, B.WATER, B.WATER, false);
    for (n = 1; n <= 7; n++) {
      this.placeBlockAtCurrentPosition(world, this.cropA, randomIntInRange(random, 2, 7), 1, 1, n, bb);
      this.placeBlockAtCurrentPosition(world, this.cropA, randomIntInRange(random, 2, 7), 2, 1, n, bb);
      this.placeBlockAtCurrentPosition(world, this.cropB, randomIntInRange(random, 2, 7), 4, 1, n, bb);
      this.placeBlockAtCurrentPosition(world, this.cropB, randomIntInRange(random, 2, 7), 5, 1, n, bb);
    }
    for (n = 0; n < 9; n++) {
      for (let i = 0; i < 7; i++) {
        this.clearCurrentPositionBlocksUpwards(world, i, 4, n, bb);
        this.fillCurrentPositionBlocksDownwards(world, B.DIRT, 0, i, -1, n, bb);
      }
    }
    return true;
  }
}

// avz: the Blacksmith (10 x 6 x 7) with its loot chest.
export class VillageBlacksmith extends VillageBoxPiece {
  static saveId = "ViS";
  static create = createChecked(VillageBlacksmith, 10, 6, 7, true);
  hasMadeChest = false;
  profession(_i) { return 3; }
  extras() { return [this.hasMadeChest]; }
  addComponentParts(world, random, bb) {
    let n;
    let n2;
    if (this.hpos < 0) {
      this.hpos = this.getAverageGroundLevel(world, bb);
      if (this.hpos < 0) {
        return true;
      }
      this.boundingBox.offset(0, this.hpos - this.boundingBox.maxY + 6 - 1, 0);
    }
    this.fillWithBlocks(world, bb, 0, 1, 0, 9, 4, 6, B.AIR, B.AIR, false);
    this.fillWithBlocks(world, bb, 0, 0, 0, 9, 0, 6, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 0, 4, 0, 9, 4, 6, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 0, 5, 0, 9, 5, 6, B.STONE_SLAB, B.STONE_SLAB, false);
    this.fillWithBlocks(world, bb, 1, 5, 1, 8, 5, 5, B.AIR, B.AIR, false);
    this.fillWithBlocks(world, bb, 1, 1, 0, 2, 3, 0, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 0, 1, 0, 0, 4, 0, B.LOG, B.LOG, false);
    this.fillWithBlocks(world, bb, 3, 1, 0, 3, 4, 0, B.LOG, B.LOG, false);
    this.fillWithBlocks(world, bb, 0, 1, 6, 0, 4, 6, B.LOG, B.LOG, false);
    this.placeBlockAtCurrentPosition(world, B.PLANKS, 0, 3, 3, 1, bb);
    this.fillWithBlocks(world, bb, 3, 1, 2, 3, 3, 2, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 4, 1, 3, 5, 3, 3, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 0, 1, 1, 0, 3, 5, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 1, 1, 6, 5, 3, 6, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 5, 1, 0, 5, 3, 0, B.FENCE, B.FENCE, false);
    this.fillWithBlocks(world, bb, 9, 1, 0, 9, 3, 0, B.FENCE, B.FENCE, false);
    this.fillWithBlocks(world, bb, 6, 1, 4, 9, 4, 6, B.COBBLESTONE, B.COBBLESTONE, false);
    this.placeBlockAtCurrentPosition(world, B.FLOWING_LAVA, 0, 7, 1, 5, bb);
    this.placeBlockAtCurrentPosition(world, B.FLOWING_LAVA, 0, 8, 1, 5, bb);
    this.placeBlockAtCurrentPosition(world, B.IRON_BARS, 0, 9, 2, 5, bb);
    this.placeBlockAtCurrentPosition(world, B.IRON_BARS, 0, 9, 2, 4, bb);
    this.fillWithBlocks(world, bb, 7, 2, 4, 8, 2, 5, B.AIR, B.AIR, false);
    this.placeBlockAtCurrentPosition(world, B.COBBLESTONE, 0, 6, 1, 3, bb);
    this.placeBlockAtCurrentPosition(world, B.FURNACE, 0, 6, 2, 3, bb);
    this.placeBlockAtCurrentPosition(world, B.FURNACE, 0, 6, 3, 3, bb);
    this.placeBlockAtCurrentPosition(world, B.DOUBLE_STONE_SLAB, 0, 8, 1, 1, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 0, 2, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 0, 2, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 2, 2, 6, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 4, 2, 6, bb);
    this.placeBlockAtCurrentPosition(world, B.FENCE, 0, 2, 1, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.WOODEN_PRESSURE_PLATE, 0, 2, 2, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.PLANKS, 0, 1, 1, 5, bb);
    this.placeBlockAtCurrentPosition(world, B.OAK_STAIRS, this.getMetadataWithOffset(B.OAK_STAIRS, 3), 2, 1, 5, bb);
    this.placeBlockAtCurrentPosition(world, B.OAK_STAIRS, this.getMetadataWithOffset(B.OAK_STAIRS, 1), 1, 1, 4, bb);
    if (!this.hasMadeChest) {
      let n3;
      n2 = this.getYWithOffset(1);
      n = this.getXWithOffset(5, 5);
      if (bb.isVecInside(n, n2, n3 = this.getZWithOffset(5, 5))) {
        this.hasMadeChest = true;
        this.generateStructureChestContents(world, bb, random, 5, 1, 5, BLACKSMITH_LOOT, 3 + random.nextInt(6));
      }
    }
    for (n2 = 6; n2 <= 8; n2++) {
      if (!isAirMaterial(this.getBlockAtCurrentPosition(world, n2, 0, -1, bb)) || isAirMaterial(this.getBlockAtCurrentPosition(world, n2, -1, -1, bb))) continue;
      this.placeBlockAtCurrentPosition(world, B.STONE_STAIRS, this.getMetadataWithOffset(B.STONE_STAIRS, 3), n2, 0, -1, bb);
    }
    for (n2 = 0; n2 < 7; n2++) {
      for (n = 0; n < 10; n++) {
        this.clearCurrentPositionBlocksUpwards(world, n, 6, n2, bb);
        this.fillCurrentPositionBlocksDownwards(world, B.COBBLESTONE, 0, n, -1, n2, bb);
      }
    }
    this.spawnVillagers(world, bb, 7, 1, 1, 1);
    return true;
  }
}

// awc: the Library (9 x 7 x 12).
export class VillageLibrary extends VillageBoxPiece {
  static saveId = "ViTRH";
  static create = createChecked(VillageLibrary, 9, 7, 12, true);
  addComponentParts(world, random, bb) {
    let n;
    let n2;
    let n3;
    let n4;
    if (this.hpos < 0) {
      this.hpos = this.getAverageGroundLevel(world, bb);
      if (this.hpos < 0) {
        return true;
      }
      this.boundingBox.offset(0, this.hpos - this.boundingBox.maxY + 7 - 1, 0);
    }
    this.fillWithBlocks(world, bb, 1, 1, 1, 7, 4, 4, B.AIR, B.AIR, false);
    this.fillWithBlocks(world, bb, 2, 1, 6, 8, 4, 10, B.AIR, B.AIR, false);
    this.fillWithBlocks(world, bb, 2, 0, 5, 8, 0, 10, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 1, 0, 1, 7, 0, 4, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 0, 0, 0, 0, 3, 5, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 8, 0, 0, 8, 3, 10, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 1, 0, 0, 7, 2, 0, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 1, 0, 5, 2, 1, 5, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 2, 0, 6, 2, 3, 10, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 3, 0, 10, 7, 3, 10, B.COBBLESTONE, B.COBBLESTONE, false);
    this.fillWithBlocks(world, bb, 1, 2, 0, 7, 3, 0, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 1, 2, 5, 2, 3, 5, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 0, 4, 1, 8, 4, 1, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 0, 4, 4, 3, 4, 4, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 0, 5, 2, 8, 5, 3, B.PLANKS, B.PLANKS, false);
    this.placeBlockAtCurrentPosition(world, B.PLANKS, 0, 0, 4, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.PLANKS, 0, 0, 4, 3, bb);
    this.placeBlockAtCurrentPosition(world, B.PLANKS, 0, 8, 4, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.PLANKS, 0, 8, 4, 3, bb);
    this.placeBlockAtCurrentPosition(world, B.PLANKS, 0, 8, 4, 4, bb);
    let n5 = this.getMetadataWithOffset(B.OAK_STAIRS, 3);
    let n6 = this.getMetadataWithOffset(B.OAK_STAIRS, 2);
    for (n4 = -1; n4 <= 2; n4++) {
      for (n3 = 0; n3 <= 8; n3++) {
        this.placeBlockAtCurrentPosition(world, B.OAK_STAIRS, n5, n3, 4 + n4, n4, bb);
        if (n4 <= -1 && n3 > 1 || n4 <= 0 && n3 > 3 || n4 <= 1 && n3 > 4 && n3 < 6) continue;
        this.placeBlockAtCurrentPosition(world, B.OAK_STAIRS, n6, n3, 4 + n4, 5 - n4, bb);
      }
    }
    this.fillWithBlocks(world, bb, 3, 4, 5, 3, 4, 10, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 7, 4, 2, 7, 4, 10, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 4, 5, 4, 4, 5, 10, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 6, 5, 4, 6, 5, 10, B.PLANKS, B.PLANKS, false);
    this.fillWithBlocks(world, bb, 5, 6, 3, 5, 6, 10, B.PLANKS, B.PLANKS, false);
    n4 = this.getMetadataWithOffset(B.OAK_STAIRS, 0);
    for (n3 = 4; n3 >= 1; n3--) {
      this.placeBlockAtCurrentPosition(world, B.PLANKS, 0, n3, 2 + n3, 7 - n3, bb);
      for (n2 = 8 - n3; n2 <= 10; n2++) {
        this.placeBlockAtCurrentPosition(world, B.OAK_STAIRS, n4, n3, 2 + n3, n2, bb);
      }
    }
    n3 = this.getMetadataWithOffset(B.OAK_STAIRS, 1);
    this.placeBlockAtCurrentPosition(world, B.PLANKS, 0, 6, 6, 3, bb);
    this.placeBlockAtCurrentPosition(world, B.PLANKS, 0, 7, 5, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.OAK_STAIRS, n3, 6, 6, 4, bb);
    for (n2 = 6; n2 <= 8; n2++) {
      for (n = 5; n <= 10; n++) {
        this.placeBlockAtCurrentPosition(world, B.OAK_STAIRS, n3, n2, 12 - n2, n, bb);
      }
    }
    this.placeBlockAtCurrentPosition(world, B.LOG, 0, 0, 2, 1, bb);
    this.placeBlockAtCurrentPosition(world, B.LOG, 0, 0, 2, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 0, 2, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 0, 2, 3, bb);
    this.placeBlockAtCurrentPosition(world, B.LOG, 0, 4, 2, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 5, 2, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.LOG, 0, 6, 2, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.LOG, 0, 8, 2, 1, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 8, 2, 2, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 8, 2, 3, bb);
    this.placeBlockAtCurrentPosition(world, B.LOG, 0, 8, 2, 4, bb);
    this.placeBlockAtCurrentPosition(world, B.PLANKS, 0, 8, 2, 5, bb);
    this.placeBlockAtCurrentPosition(world, B.LOG, 0, 8, 2, 6, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 8, 2, 7, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 8, 2, 8, bb);
    this.placeBlockAtCurrentPosition(world, B.LOG, 0, 8, 2, 9, bb);
    this.placeBlockAtCurrentPosition(world, B.LOG, 0, 2, 2, 6, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 2, 2, 7, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 2, 2, 8, bb);
    this.placeBlockAtCurrentPosition(world, B.LOG, 0, 2, 2, 9, bb);
    this.placeBlockAtCurrentPosition(world, B.LOG, 0, 4, 4, 10, bb);
    this.placeBlockAtCurrentPosition(world, B.GLASS_PANE, 0, 5, 4, 10, bb);
    this.placeBlockAtCurrentPosition(world, B.LOG, 0, 6, 4, 10, bb);
    this.placeBlockAtCurrentPosition(world, B.PLANKS, 0, 5, 5, 10, bb);
    this.placeBlockAtCurrentPosition(world, B.AIR, 0, 2, 1, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.AIR, 0, 2, 2, 0, bb);
    this.placeBlockAtCurrentPosition(world, B.TORCH, 0, 2, 3, 1, bb);
    this.placeDoorAtCurrentPosition(world, bb, random, 2, 1, 0, this.getMetadataWithOffset(B.WOODEN_DOOR, 1));
    this.fillWithBlocks(world, bb, 1, 0, -1, 3, 2, -1, B.AIR, B.AIR, false);
    if (isAirMaterial(this.getBlockAtCurrentPosition(world, 2, 0, -1, bb)) && !isAirMaterial(this.getBlockAtCurrentPosition(world, 2, -1, -1, bb))) {
      this.placeBlockAtCurrentPosition(world, B.STONE_STAIRS, this.getMetadataWithOffset(B.STONE_STAIRS, 3), 2, 0, -1, bb);
    }
    for (n2 = 0; n2 < 5; n2++) {
      for (n = 0; n < 9; n++) {
        this.clearCurrentPositionBlocksUpwards(world, n, 7, n2, bb);
        this.fillCurrentPositionBlocksDownwards(world, B.COBBLESTONE, 0, n, -1, n2, bb);
      }
    }
    for (n2 = 5; n2 < 11; n2++) {
      for (n = 2; n < 9; n++) {
        this.clearCurrentPositionBlocksUpwards(world, n, 7, n2, bb);
        this.fillCurrentPositionBlocksDownwards(world, B.COBBLESTONE, 0, n, -1, n2, bb);
      }
    }
    this.spawnVillagers(world, bb, 4, 1, 2, 2);
    return true;
  }
}

export const VILLAGE_PIECE_CLASSES = [VillageStartPiece, VillageWell, VillagePath, VillageTorch, VillageHouse1, VillageChurch, VillageHouse4Garden, VillageWoodHut, VillageHall, VillageField1, VillageField2, VillageBlacksmith, VillageLibrary];

// avo: MapGenVillage.Start. Builds the whole piece tree in the constructor; valid with more than two non-road pieces.
export class VillageStart extends StructureStart {
  constructor(manager, random, chunkX, chunkZ, size) {
    super(chunkX, chunkZ);
    const weights = getStructureVillageWeightedPieceList(random, size);
    const start = new VillageStartPiece(manager, 0, random, ((chunkX << 4) + 2) | 0, ((chunkZ << 4) + 2) | 0, weights, size);
    this.components.push(start);
    start.buildComponent(start, this.components, random);
    const roads = start.pendingRoads, houses = start.pendingHouses;
    while (roads.length > 0 || houses.length > 0) {
      const queue = roads.length === 0 ? houses : roads;
      queue.splice(random.nextInt(queue.length), 1)[0].buildComponent(start, this.components, random);
    }
    this.updateBoundingBox();
    let others = 0;
    for (const c of this.components) if (!(c instanceof VillagePath)) others++;
    this.valid = others > 2;
  }
  isSizeableStructure() { return this.valid; }
}

// avn: MapGenVillage. `options` holds the world generator's "size" and "distance" strings.
export class MapGenVillage extends MapGenStructure {
  constructor(worldSeed, manager, options = {}) {
    super(worldSeed);
    this.manager = manager;
    this.size = parseOption(options.size, 0, 0);
    this.minDistanceBetweenVillages = 8;
    this.distance = parseOption(options.distance, 32, this.minDistanceBetweenVillages + 1);
  }
  // villageCandidate holds the salt-10387312 spawn cell and the viable-biome test. Native also reseeds World.rand.
  canSpawnStructureAtCoords(x, z) {
    return villageCandidate(this.worldSeed, this.manager, x, z, { distance: this.distance });
  }
  getStructureStart(x, z) { return new VillageStart(this.manager, this.random, x, z, this.size); }
}
