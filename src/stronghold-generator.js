// Minecraft Java 1.7.10 MapGenStronghold (aug), MapGenStronghold.Start (auh) and
// StructureStrongholdPieces (aui) with its pieces: Stairs2 start (auz), Stairs (auy), Straight (ava),
// Prison (aut), LeftTurn (aup), RightTurn (auu), RoomCrossing (auv), StairsStraight (avb), Crossing (auo),
// ChestCorridor (aum), Library (auq), PortalRoom (aus), Corridor (aun), the Stones block selector (auw),
// PieceWeight (aur/auj/auk) and the Door enum (avd).
// Built on structure-framework.js; world adapter documented there. Chest tiles take loot through
// generateStructureChestContents; the PortalRoom spawner calls setEntityName("Silverfish").
// Stronghold positions come from structure-placement.js (strongholdPositions); only the Start/piece
// generation is ported here. Standalone: not wired into ChunkProviderGenerate/java-world.js; no NBT save/load.
import {
  StructureBoundingBox, StructureComponent, StructureStart, MapGenStructure,
  IRON_DOOR, WOODEN_DOOR, LADDER, STONE_BUTTON, STONE_STAIRS, STONE_BRICK_STAIRS,
} from "./structure-framework.js";
import { dungeonEnchantedBook } from "./dungeon-generator.js";
import { strongholdPositions } from "./structure-placement.js";

const f = Math.fround;
const AIR = 0, COBBLESTONE = 4, PLANKS = 5, FLOWING_WATER = 8, FLOWING_LAVA = 10, WEB = 30, DOUBLE_SLAB = 43, SLAB = 44,
  BOOKSHELF = 47, TORCH = 50, MOB_SPAWNER = 52, FENCE = 85, MONSTER_EGG = 97, STONE_BRICK = 98, IRON_BARS = 101, END_PORTAL_FRAME = 120;
export const STRONGHOLD_DOORS = ["OPENING", "WOOD_DOOR", "GRATES", "IRON_DOOR"];
const OPENING = 0, WOOD_DOOR = 1, GRATES = 2, IRON_DOOR_TYPE = 3;

// [stack, min, max, weight, maxStackSize], extracted by StrongholdProbe from aum.a, auq.a and auv.b.
export const STRONGHOLD_CHEST_CORRIDOR_LOOT = [[[368,1,0,[]],1,1,10,16],[[264,1,0,[]],1,3,3,64],[[265,1,0,[]],1,5,10,64],[[266,1,0,[]],1,3,5,64],[[331,1,0,[]],4,9,5,64],[[297,1,0,[]],1,3,15,64],[[260,1,0,[]],1,3,15,64],[[257,1,0,[]],1,1,5,1],[[267,1,0,[]],1,1,5,1],[[307,1,0,[]],1,1,5,1],[[306,1,0,[]],1,1,5,1],[[308,1,0,[]],1,1,5,1],[[309,1,0,[]],1,1,5,1],[[322,1,0,[]],1,1,1,64],[[329,1,0,[]],1,1,1,1],[[417,1,0,[]],1,1,1,1],[[418,1,0,[]],1,1,1,1],[[419,1,0,[]],1,1,1,1]];
export const STRONGHOLD_LIBRARY_LOOT = [[[340,1,0,[]],1,3,20,64],[[339,1,0,[]],2,7,20,64],[[395,1,0,[]],1,1,1,64],[[345,1,0,[]],1,1,1,64]];
export const STRONGHOLD_ROOM_CROSSING_LOOT = [[[265,1,0,[]],1,5,10,64],[[266,1,0,[]],1,3,5,64],[[331,1,0,[]],4,9,5,64],[[263,1,0,[]],3,8,10,64],[[297,1,0,[]],1,3,15,64],[[260,1,0,[]],1,3,15,64],[[257,1,0,[]],1,1,1,1]];
// ItemEnchantedBook.func_92114_b (weight 1, count 1) for the corridor and room chests.
const lootWithBook = (loot, random) => [...loot, [dungeonEnchantedBook(random), 1, 1, 1, 1]];
// ItemEnchantedBook.func_92112_a(random, 1, 5, 2): the library's own book row.
const libraryLoot = (random) => [...STRONGHOLD_LIBRARY_LOOT, [dungeonEnchantedBook(random), 1, 5, 2, 1]];

// StructureStrongholdPieces.Stones (auw): stone brick / mossy / cracked / monster egg on edges, air inside.
export const STRONGHOLD_STONES = {
  select(random, _x, _y, _z, edge) {
    if (!edge) return [AIR, 0];
    const r = random.nextFloat();
    if (r < f(0.2)) return [STONE_BRICK, 2];
    if (r < f(0.5)) return [STONE_BRICK, 1];
    if (r < f(0.55)) return [MONSTER_EGG, 2];
    return [STONE_BRICK, 0];
  },
};

// StructureStrongholdPieces.PieceWeight (aur) and its two overriding anonymous subclasses (auj Library, auk PortalRoom).
export class PieceWeight {
  constructor(pieceClass, weight, limit) { this.pieceClass = pieceClass; this.weight = weight; this.instanceLimit = limit; this.instancesSpawned = 0; }
  canSpawnMoreStructuresOfType(_type) { return this.instanceLimit === 0 || this.instancesSpawned < this.instanceLimit; }
  canSpawnMoreStructures() { return this.instanceLimit === 0 || this.instancesSpawned < this.instanceLimit; }
}
class LibraryWeight extends PieceWeight { canSpawnMoreStructuresOfType(type) { return super.canSpawnMoreStructuresOfType(type) && type > 4; } }
class PortalRoomWeight extends PieceWeight { canSpawnMoreStructuresOfType(type) { return super.canSpawnMoreStructuresOfType(type) && type > 5; } }

// Module-level state mirrors the statics of StructureStrongholdPieces (b, c, d, a); prepareStructurePieces resets it.
let weightList = [], totalWeight = 0, forcedPieceClass = null;
const WEIGHT_TABLE = () => [
  new PieceWeight(StrongholdStraight, 40, 0), new PieceWeight(StrongholdPrison, 5, 5), new PieceWeight(StrongholdLeftTurn, 20, 0),
  new PieceWeight(StrongholdRightTurn, 20, 0), new PieceWeight(StrongholdRoomCrossing, 10, 6), new PieceWeight(StrongholdStairsStraight, 5, 5),
  new PieceWeight(StrongholdStairs, 5, 5), new PieceWeight(StrongholdCrossing, 5, 4), new PieceWeight(StrongholdChestCorridor, 5, 4),
  new LibraryWeight(StrongholdLibrary, 10, 2), new PortalRoomWeight(StrongholdPortalRoom, 20, 1),
];
export function prepareStructurePieces() {
  weightList = WEIGHT_TABLE();
  forcedPieceClass = null;
}
export const strongholdWeightTable = () => WEIGHT_TABLE().map((w) => [w.pieceClass.saveId, w.weight, w.instanceLimit]);
function canAddStructurePieces() {
  let any = false;
  totalWeight = 0;
  for (const w of weightList) {
    if (w.instanceLimit > 0 && w.instancesSpawned < w.instanceLimit) any = true;
    totalWeight += w.weight;
  }
  return any;
}
const setComponentType = (cls) => { forcedPieceClass = cls; };

function getStrongholdComponentFromWeightedPiece(cls, list, random, x, y, z, dir, type) {
  return cls.create(list, random, x, y, z, dir, type);
}
// StructureStrongholdPieces.func_175955_b: weighted piece choice, 5 rolls, then a Corridor fallback.
function getNextComponent(start, list, random, x, y, z, dir, type) {
  if (!canAddStructurePieces()) return null;
  if (forcedPieceClass !== null) {
    const forced = getStrongholdComponentFromWeightedPiece(forcedPieceClass, list, random, x, y, z, dir, type);
    forcedPieceClass = null;
    if (forced) return forced;
  }
  for (let tries = 0; tries < 5;) {
    tries++;
    let roll = random.nextInt(totalWeight);
    for (const w of weightList) {
      roll -= w.weight;
      if (roll >= 0) continue;
      if (!w.canSpawnMoreStructuresOfType(type) || w === start.strongholdPieceWeight) break;
      const piece = getStrongholdComponentFromWeightedPiece(w.pieceClass, list, random, x, y, z, dir, type);
      if (!piece) continue;
      w.instancesSpawned++;
      start.strongholdPieceWeight = w;
      if (!w.canSpawnMoreStructures()) weightList.splice(weightList.indexOf(w), 1);
      return piece;
    }
  }
  const bb = StrongholdCorridor.findValidPlacement(list, random, x, y, z, dir);
  return bb && bb.minY > 1 ? new StrongholdCorridor(type, random, bb, dir) : null;
}
// StructureStrongholdPieces.func_175953_c: depth 50 and 112-block limits from the start's min corner.
export function getNextValidComponent(start, list, random, x, y, z, dir, type) {
  if (type > 50) return null;
  if (Math.abs(x - start.boundingBox.minX) > 112 || Math.abs(z - start.boundingBox.minZ) > 112) return null;
  const piece = getNextComponent(start, list, random, x, y, z, dir, type + 1);
  if (piece) { list.push(piece); start.pendingPieces.push(piece); }
  return piece;
}
const canStrongholdGoDeeper = (bb) => bb !== null && bb.minY > 10;
// Shared tail of every piece's findValidPlacement: depth check, collision check, then the constructor
// (which draws its own random numbers).
const place = (Piece, list, random, x, y, z, ox, oy, oz, w, h, d, dir, type) => {
  const bb = StructureBoundingBox.componentBox(x, y, z, ox, oy, oz, w, h, d, dir);
  return canStrongholdGoDeeper(bb) && StructureComponent.findIntersecting(list, bb) === null ? new Piece(type, random, bb, dir) : null;
};

export class StrongholdPiece extends StructureComponent {
  constructor(type) { super(type); this.door = OPENING; }
  getRandomDoor(random) {
    switch (random.nextInt(5)) {
      case 2: return WOOD_DOOR;
      case 3: return GRATES;
      case 4: return IRON_DOOR_TYPE;
      default: return OPENING;
    }
  }
  // Stronghold.placeDoor: the 3x3 door frame on the z = z plane.
  placeDoor(world, _random, bb, door, x, y, z) {
    const frame = (id) => {
      for (const [dx, dy] of [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [2, 1], [2, 0]]) this.placeBlockAtCurrentPosition(world, id, 0, x + dx, y + dy, z, bb);
    };
    switch (door) {
      case WOOD_DOOR:
        frame(STONE_BRICK);
        this.placeBlockAtCurrentPosition(world, WOODEN_DOOR, 0, x + 1, y, z, bb);
        this.placeBlockAtCurrentPosition(world, WOODEN_DOOR, 8, x + 1, y + 1, z, bb);
        break;
      case GRATES:
        this.placeBlockAtCurrentPosition(world, AIR, 0, x + 1, y, z, bb);
        this.placeBlockAtCurrentPosition(world, AIR, 0, x + 1, y + 1, z, bb);
        frame(IRON_BARS);
        break;
      case IRON_DOOR_TYPE:
        frame(STONE_BRICK);
        this.placeBlockAtCurrentPosition(world, IRON_DOOR, 0, x + 1, y, z, bb);
        this.placeBlockAtCurrentPosition(world, IRON_DOOR, 8, x + 1, y + 1, z, bb);
        this.placeBlockAtCurrentPosition(world, STONE_BUTTON, this.getMetadataWithOffset(STONE_BUTTON, 4), x + 2, y + 1, z + 1, bb);
        this.placeBlockAtCurrentPosition(world, STONE_BUTTON, this.getMetadataWithOffset(STONE_BUTTON, 3), x + 2, y + 1, z - 1, bb);
        break;
      default:
        this.fillWithBlocks(world, bb, x, y, z, x + 2, y + 2, z, AIR, AIR, false);
    }
  }
  getNextComponentNormal(start, list, random, xOff, yOff) {
    const b = this.boundingBox, type = this.componentType;
    switch (this.coordBaseMode) {
      case 2: return getNextValidComponent(start, list, random, b.minX + xOff, b.minY + yOff, b.minZ - 1, 2, type);
      case 0: return getNextValidComponent(start, list, random, b.minX + xOff, b.minY + yOff, b.maxZ + 1, 0, type);
      case 1: return getNextValidComponent(start, list, random, b.minX - 1, b.minY + yOff, b.minZ + xOff, 1, type);
      case 3: return getNextValidComponent(start, list, random, b.maxX + 1, b.minY + yOff, b.minZ + xOff, 3, type);
      default: return null;
    }
  }
  // Left side (func_74989_b): modes 2/0 go direction 1, modes 1/3 go direction 2.
  getNextComponentX(start, list, random, yOff, zOff) {
    const b = this.boundingBox, type = this.componentType;
    switch (this.coordBaseMode) {
      case 2: case 0: return getNextValidComponent(start, list, random, b.minX - 1, b.minY + yOff, b.minZ + zOff, 1, type);
      case 1: case 3: return getNextValidComponent(start, list, random, b.minX + zOff, b.minY + yOff, b.minZ - 1, 2, type);
      default: return null;
    }
  }
  // Right side (func_74987_c): modes 2/0 go direction 3, modes 1/3 go direction 0.
  getNextComponentZ(start, list, random, yOff, zOff) {
    const b = this.boundingBox, type = this.componentType;
    switch (this.coordBaseMode) {
      case 2: case 0: return getNextValidComponent(start, list, random, b.maxX + 1, b.minY + yOff, b.minZ + zOff, 3, type);
      case 1: case 3: return getNextValidComponent(start, list, random, b.minX + zOff, b.minY + yOff, b.maxZ + 1, 0, type);
      default: return null;
    }
  }
  // Common first lines of addComponentParts: bail on any liquid, then the randomized stone shell.
  shell(world, random, bb, x1, y1, z1) {
    if (this.isLiquidInStructureBoundingBox(world, bb)) return false;
    this.fillWithRandomizedBlocks(world, bb, 0, 0, 0, x1, y1, z1, true, random, STRONGHOLD_STONES);
    return true;
  }
  put(world, id, meta, x, y, z, bb) { this.placeBlockAtCurrentPosition(world, id, meta, x, y, z, bb); }
  air(world, bb, x0, y0, z0, x1, y1, z1) { this.fillWithBlocks(world, bb, x0, y0, z0, x1, y1, z1, AIR, AIR, false); }
  rand(world, bb, random, x0, y0, z0, x1, y1, z1) { this.fillWithRandomizedBlocks(world, bb, x0, y0, z0, x1, y1, z1, false, random, STRONGHOLD_STONES); }
  solid(world, bb, x0, y0, z0, x1, y1, z1, id) { this.fillWithBlocks(world, bb, x0, y0, z0, x1, y1, z1, id, id, false); }
  base(extra = []) { return [this.constructor.saveId, this.coordBaseMode, this.componentType, ...this.boundingBox.toArray(), this.door, ...extra]; }
  describe() { return this.base(); }
}

export class StrongholdStairs extends StrongholdPiece {
  static saveId = "SHSD";
  // (type, random, bb, dir) for a placed piece; the start overload is StrongholdStart's constructor.
  constructor(type, random, bb, dir) {
    super(type);
    this.isStart = false;
    if (bb) { this.coordBaseMode = dir; this.door = this.getRandomDoor(random); this.boundingBox = bb; }
  }
  static create(list, random, x, y, z, dir, type) { return place(StrongholdStairs, list, random, x, y, z, -1, -7, 0, 5, 11, 5, dir, type); }
  buildComponent(start, list, random) {
    if (this.isStart) setComponentType(StrongholdCrossing);
    this.getNextComponentNormal(start, list, random, 1, 1);
  }
  addComponentParts(world, random, bb) {
    if (!this.shell(world, random, bb, 4, 10, 4)) return false;
    this.placeDoor(world, random, bb, this.door, 1, 7, 0);
    this.placeDoor(world, random, bb, OPENING, 1, 1, 4);
    const S = (id, x, y, z) => this.put(world, id, 0, x, y, z, bb);
    S(STONE_BRICK, 2, 6, 1); S(STONE_BRICK, 1, 5, 1); S(SLAB, 1, 6, 1); S(STONE_BRICK, 1, 5, 2); S(STONE_BRICK, 1, 4, 3); S(SLAB, 1, 5, 3);
    S(STONE_BRICK, 2, 4, 3); S(STONE_BRICK, 3, 3, 3); S(SLAB, 3, 4, 3); S(STONE_BRICK, 3, 3, 2); S(STONE_BRICK, 3, 2, 1); S(SLAB, 3, 3, 1);
    S(STONE_BRICK, 2, 2, 1); S(STONE_BRICK, 1, 1, 1); S(SLAB, 1, 2, 1); S(STONE_BRICK, 1, 1, 2); S(SLAB, 1, 1, 3);
    return true;
  }
  describe() { return this.base([this.isStart]); }
}

// StructureStrongholdPieces.Stairs2 (auz), the start piece: also carries the weight state of the walk.
export class StrongholdStart extends StrongholdStairs {
  static saveId = "SHStart";
  constructor(type, random, x, z) {
    super(type, null, null, -1);
    this.isStart = true;
    this.coordBaseMode = random.nextInt(4);
    this.door = OPENING;
    this.boundingBox = new StructureBoundingBox(x, 64, z, x + 4, 74, z + 4);
    this.strongholdPieceWeight = null;
    this.portalRoom = null;
    this.pendingPieces = [];
  }
  describe() { return this.base([true, this.portalRoom !== null]); }
}

export class StrongholdStraight extends StrongholdPiece {
  static saveId = "SHS";
  constructor(type, random, bb, dir) {
    super(type);
    this.coordBaseMode = dir; this.door = this.getRandomDoor(random); this.boundingBox = bb;
    this.expandsX = random.nextInt(2) === 0;
    this.expandsZ = random.nextInt(2) === 0;
  }
  static create(list, random, x, y, z, dir, type) { return place(StrongholdStraight, list, random, x, y, z, -1, -1, 0, 5, 5, 7, dir, type); }
  buildComponent(start, list, random) {
    this.getNextComponentNormal(start, list, random, 1, 1);
    if (this.expandsX) this.getNextComponentX(start, list, random, 1, 2);
    if (this.expandsZ) this.getNextComponentZ(start, list, random, 1, 2);
  }
  addComponentParts(world, random, bb) {
    if (!this.shell(world, random, bb, 4, 4, 6)) return false;
    this.placeDoor(world, random, bb, this.door, 1, 1, 0);
    this.placeDoor(world, random, bb, OPENING, 1, 1, 6);
    this.randomlyPlaceBlock(world, bb, random, 0.1, 1, 2, 1, TORCH, 0);
    this.randomlyPlaceBlock(world, bb, random, 0.1, 3, 2, 1, TORCH, 0);
    this.randomlyPlaceBlock(world, bb, random, 0.1, 1, 2, 5, TORCH, 0);
    this.randomlyPlaceBlock(world, bb, random, 0.1, 3, 2, 5, TORCH, 0);
    if (this.expandsX) this.air(world, bb, 0, 1, 2, 0, 3, 4);
    if (this.expandsZ) this.air(world, bb, 4, 1, 2, 4, 3, 4);
    return true;
  }
  describe() { return this.base([this.expandsX, this.expandsZ]); }
}

export class StrongholdPrison extends StrongholdPiece {
  static saveId = "SHPH";
  constructor(type, random, bb, dir) { super(type); this.coordBaseMode = dir; this.door = this.getRandomDoor(random); this.boundingBox = bb; }
  static create(list, random, x, y, z, dir, type) { return place(StrongholdPrison, list, random, x, y, z, -1, -1, 0, 9, 5, 11, dir, type); }
  buildComponent(start, list, random) { this.getNextComponentNormal(start, list, random, 1, 1); }
  addComponentParts(world, random, bb) {
    if (!this.shell(world, random, bb, 8, 4, 10)) return false;
    this.placeDoor(world, random, bb, this.door, 1, 1, 0);
    this.air(world, bb, 1, 1, 10, 3, 3, 10);
    this.rand(world, bb, random, 4, 1, 1, 4, 3, 1);
    this.rand(world, bb, random, 4, 1, 3, 4, 3, 3);
    this.rand(world, bb, random, 4, 1, 7, 4, 3, 7);
    this.rand(world, bb, random, 4, 1, 9, 4, 3, 9);
    this.solid(world, bb, 4, 1, 4, 4, 3, 6, IRON_BARS);
    this.solid(world, bb, 5, 1, 5, 7, 3, 5, IRON_BARS);
    this.put(world, IRON_BARS, 0, 4, 3, 2, bb);
    this.put(world, IRON_BARS, 0, 4, 3, 8, bb);
    const m = this.getMetadataWithOffset(IRON_DOOR, 3);
    this.put(world, IRON_DOOR, m, 4, 1, 2, bb);
    this.put(world, IRON_DOOR, m + 8, 4, 2, 2, bb);
    this.put(world, IRON_DOOR, m, 4, 1, 8, bb);
    this.put(world, IRON_DOOR, m + 8, 4, 2, 8, bb);
    return true;
  }
}

export class StrongholdLeftTurn extends StrongholdPiece {
  static saveId = "SHLT";
  constructor(type, random, bb, dir) { super(type); this.coordBaseMode = dir; this.door = this.getRandomDoor(random); this.boundingBox = bb; }
  static create(list, random, x, y, z, dir, type) { return place(StrongholdLeftTurn, list, random, x, y, z, -1, -1, 0, 5, 5, 5, dir, type); }
  buildComponent(start, list, random) {
    if (this.coordBaseMode === 2 || this.coordBaseMode === 3) this.getNextComponentX(start, list, random, 1, 1);
    else this.getNextComponentZ(start, list, random, 1, 1);
  }
  addComponentParts(world, random, bb) {
    if (!this.shell(world, random, bb, 4, 4, 4)) return false;
    this.placeDoor(world, random, bb, this.door, 1, 1, 0);
    if (this.coordBaseMode === 2 || this.coordBaseMode === 3) this.air(world, bb, 0, 1, 1, 0, 3, 3);
    else this.air(world, bb, 4, 1, 1, 4, 3, 3);
    return true;
  }
}

export class StrongholdRightTurn extends StrongholdLeftTurn {
  static saveId = "SHRT";
  // No own findValidPlacement: the native RightTurn weight inherits LeftTurn.a, so RightTurn pieces never generate.
  buildComponent(start, list, random) {
    if (this.coordBaseMode === 2 || this.coordBaseMode === 3) this.getNextComponentZ(start, list, random, 1, 1);
    else this.getNextComponentX(start, list, random, 1, 1);
  }
  addComponentParts(world, random, bb) {
    if (!this.shell(world, random, bb, 4, 4, 4)) return false;
    this.placeDoor(world, random, bb, this.door, 1, 1, 0);
    if (this.coordBaseMode === 2 || this.coordBaseMode === 3) this.air(world, bb, 4, 1, 1, 4, 3, 3);
    else this.air(world, bb, 0, 1, 1, 0, 3, 3);
    return true;
  }
}

export class StrongholdRoomCrossing extends StrongholdPiece {
  static saveId = "SHRC";
  constructor(type, random, bb, dir) {
    super(type);
    this.coordBaseMode = dir; this.door = this.getRandomDoor(random); this.boundingBox = bb;
    this.roomType = random.nextInt(5);
  }
  static create(list, random, x, y, z, dir, type) { return place(StrongholdRoomCrossing, list, random, x, y, z, -4, -1, 0, 11, 7, 11, dir, type); }
  buildComponent(start, list, random) {
    this.getNextComponentNormal(start, list, random, 4, 1);
    this.getNextComponentX(start, list, random, 1, 4);
    this.getNextComponentZ(start, list, random, 1, 4);
  }
  addComponentParts(world, random, bb) {
    if (!this.shell(world, random, bb, 10, 6, 10)) return false;
    this.placeDoor(world, random, bb, this.door, 4, 1, 0);
    this.air(world, bb, 4, 1, 10, 6, 3, 10);
    this.air(world, bb, 0, 1, 4, 0, 3, 6);
    this.air(world, bb, 10, 1, 4, 10, 3, 6);
    const P = (id, x, y, z, meta = 0) => this.put(world, id, meta, x, y, z, bb);
    switch (this.roomType) {
      case 0:
        P(STONE_BRICK, 5, 1, 5); P(STONE_BRICK, 5, 2, 5); P(STONE_BRICK, 5, 3, 5);
        P(TORCH, 4, 3, 5); P(TORCH, 6, 3, 5); P(TORCH, 5, 3, 4); P(TORCH, 5, 3, 6);
        P(SLAB, 4, 1, 4); P(SLAB, 4, 1, 5); P(SLAB, 4, 1, 6); P(SLAB, 6, 1, 4); P(SLAB, 6, 1, 5); P(SLAB, 6, 1, 6); P(SLAB, 5, 1, 4); P(SLAB, 5, 1, 6);
        break;
      case 1:
        for (let i = 0; i < 5; i++) { P(STONE_BRICK, 3, 1, 3 + i); P(STONE_BRICK, 7, 1, 3 + i); P(STONE_BRICK, 3 + i, 1, 3); P(STONE_BRICK, 3 + i, 1, 7); }
        P(STONE_BRICK, 5, 1, 5); P(STONE_BRICK, 5, 2, 5); P(STONE_BRICK, 5, 3, 5); P(FLOWING_WATER, 5, 4, 5);
        break;
      case 2: {
        for (let i = 1; i <= 9; i++) { P(COBBLESTONE, 1, 3, i); P(COBBLESTONE, 9, 3, i); }
        for (let i = 1; i <= 9; i++) { P(COBBLESTONE, i, 3, 1); P(COBBLESTONE, i, 3, 9); }
        P(COBBLESTONE, 5, 1, 4); P(COBBLESTONE, 5, 1, 6); P(COBBLESTONE, 5, 3, 4); P(COBBLESTONE, 5, 3, 6);
        P(COBBLESTONE, 4, 1, 5); P(COBBLESTONE, 6, 1, 5); P(COBBLESTONE, 4, 3, 5); P(COBBLESTONE, 6, 3, 5);
        for (let i = 1; i <= 3; i++) { P(COBBLESTONE, 4, i, 4); P(COBBLESTONE, 6, i, 4); P(COBBLESTONE, 4, i, 6); P(COBBLESTONE, 6, i, 6); }
        P(TORCH, 5, 3, 5);
        for (let i = 2; i <= 8; i++) {
          P(PLANKS, 2, 3, i); P(PLANKS, 3, 3, i);
          if (i <= 3 || i >= 7) { P(PLANKS, 4, 3, i); P(PLANKS, 5, 3, i); P(PLANKS, 6, 3, i); }
          P(PLANKS, 7, 3, i); P(PLANKS, 8, 3, i);
        }
        const ladder = this.getMetadataWithOffset(LADDER, 4);
        P(LADDER, 9, 1, 3, ladder); P(LADDER, 9, 2, 3, ladder); P(LADDER, 9, 3, 3, ladder);
        // Java argument order: the enchanted book is drawn before the item count.
        const rows = lootWithBook(STRONGHOLD_ROOM_CROSSING_LOOT, random);
        this.generateStructureChestContents(world, bb, random, 3, 4, 8, rows, 1 + random.nextInt(4));
        break;
      }
      default:
    }
    return true;
  }
  describe() { return this.base([this.roomType]); }
}

export class StrongholdStairsStraight extends StrongholdPiece {
  static saveId = "SHSSD";
  constructor(type, random, bb, dir) { super(type); this.coordBaseMode = dir; this.door = this.getRandomDoor(random); this.boundingBox = bb; }
  static create(list, random, x, y, z, dir, type) { return place(StrongholdStairsStraight, list, random, x, y, z, -1, -7, 0, 5, 11, 8, dir, type); }
  buildComponent(start, list, random) { this.getNextComponentNormal(start, list, random, 1, 1); }
  addComponentParts(world, random, bb) {
    if (!this.shell(world, random, bb, 4, 10, 7)) return false;
    this.placeDoor(world, random, bb, this.door, 1, 7, 0);
    this.placeDoor(world, random, bb, OPENING, 1, 1, 7);
    const m = this.getMetadataWithOffset(STONE_STAIRS, 2);
    for (let i = 0; i < 6; i++) {
      this.put(world, STONE_STAIRS, m, 1, 6 - i, 1 + i, bb);
      this.put(world, STONE_STAIRS, m, 2, 6 - i, 1 + i, bb);
      this.put(world, STONE_STAIRS, m, 3, 6 - i, 1 + i, bb);
      if (i < 5) {
        this.put(world, STONE_BRICK, 0, 1, 5 - i, 1 + i, bb);
        this.put(world, STONE_BRICK, 0, 2, 5 - i, 1 + i, bb);
        this.put(world, STONE_BRICK, 0, 3, 5 - i, 1 + i, bb);
      }
    }
    return true;
  }
}

export class StrongholdCrossing extends StrongholdPiece {
  static saveId = "SH5C";
  constructor(type, random, bb, dir) {
    super(type);
    this.coordBaseMode = dir; this.door = this.getRandomDoor(random); this.boundingBox = bb;
    this.leftLow = random.nextBoolean(); this.leftHigh = random.nextBoolean(); this.rightLow = random.nextBoolean();
    this.rightHigh = random.nextInt(3) > 0;
  }
  static create(list, random, x, y, z, dir, type) { return place(StrongholdCrossing, list, random, x, y, z, -4, -3, 0, 10, 9, 11, dir, type); }
  buildComponent(start, list, random) {
    let low = 3, high = 5;
    if (this.coordBaseMode === 1 || this.coordBaseMode === 2) { low = 8 - low; high = 8 - high; }
    this.getNextComponentNormal(start, list, random, 5, 1);
    if (this.leftLow) this.getNextComponentX(start, list, random, low, 1);
    if (this.leftHigh) this.getNextComponentX(start, list, random, high, 7);
    if (this.rightLow) this.getNextComponentZ(start, list, random, low, 1);
    if (this.rightHigh) this.getNextComponentZ(start, list, random, high, 7);
  }
  addComponentParts(world, random, bb) {
    if (!this.shell(world, random, bb, 9, 8, 10)) return false;
    this.placeDoor(world, random, bb, this.door, 4, 3, 0);
    if (this.leftLow) this.air(world, bb, 0, 3, 1, 0, 5, 3);
    if (this.rightLow) this.air(world, bb, 9, 3, 1, 9, 5, 3);
    if (this.leftHigh) this.air(world, bb, 0, 5, 7, 0, 7, 9);
    if (this.rightHigh) this.air(world, bb, 9, 5, 7, 9, 7, 9);
    this.air(world, bb, 5, 1, 10, 7, 3, 10);
    this.rand(world, bb, random, 1, 2, 1, 8, 2, 6);
    this.rand(world, bb, random, 4, 1, 5, 4, 4, 9);
    this.rand(world, bb, random, 8, 1, 5, 8, 4, 9);
    this.rand(world, bb, random, 1, 4, 7, 3, 4, 9);
    this.rand(world, bb, random, 1, 3, 5, 3, 3, 6);
    this.solid(world, bb, 1, 3, 4, 3, 3, 4, SLAB);
    this.solid(world, bb, 1, 4, 6, 3, 4, 6, SLAB);
    this.rand(world, bb, random, 5, 1, 7, 7, 1, 8);
    this.solid(world, bb, 5, 1, 9, 7, 1, 9, SLAB);
    this.solid(world, bb, 5, 2, 7, 7, 2, 7, SLAB);
    this.solid(world, bb, 4, 5, 7, 4, 5, 9, SLAB);
    this.solid(world, bb, 8, 5, 7, 8, 5, 9, SLAB);
    this.solid(world, bb, 5, 5, 7, 7, 5, 9, DOUBLE_SLAB);
    this.put(world, TORCH, 0, 6, 5, 6, bb);
    return true;
  }
  describe() { return this.base([this.leftLow, this.leftHigh, this.rightLow, this.rightHigh]); }
}

export class StrongholdChestCorridor extends StrongholdPiece {
  static saveId = "SHCC";
  constructor(type, random, bb, dir) { super(type); this.coordBaseMode = dir; this.door = this.getRandomDoor(random); this.boundingBox = bb; this.hasMadeChest = false; }
  static create(list, random, x, y, z, dir, type) { return place(StrongholdChestCorridor, list, random, x, y, z, -1, -1, 0, 5, 5, 7, dir, type); }
  buildComponent(start, list, random) { this.getNextComponentNormal(start, list, random, 1, 1); }
  addComponentParts(world, random, bb) {
    if (!this.shell(world, random, bb, 4, 4, 6)) return false;
    this.placeDoor(world, random, bb, this.door, 1, 1, 0);
    this.placeDoor(world, random, bb, OPENING, 1, 1, 6);
    this.solid(world, bb, 3, 1, 2, 3, 1, 4, STONE_BRICK);
    this.put(world, SLAB, 5, 3, 1, 1, bb); this.put(world, SLAB, 5, 3, 1, 5, bb);
    this.put(world, SLAB, 5, 3, 2, 2, bb); this.put(world, SLAB, 5, 3, 2, 4, bb);
    for (let i = 2; i <= 4; i++) this.put(world, SLAB, 5, 2, 1, i, bb);
    if (!this.hasMadeChest) {
      const y = this.getYWithOffset(2), x = this.getXWithOffset(3, 3), z = this.getZWithOffset(3, 3);
      if (bb.isVecInside(x, y, z)) {
        this.hasMadeChest = true;
        const rows = lootWithBook(STRONGHOLD_CHEST_CORRIDOR_LOOT, random);
        this.generateStructureChestContents(world, bb, random, 3, 2, 3, rows, 2 + random.nextInt(2));
      }
    }
    return true;
  }
  describe() { return this.base([this.hasMadeChest]); }
}

export class StrongholdLibrary extends StrongholdPiece {
  static saveId = "SHLi";
  constructor(type, random, bb, dir) { super(type); this.coordBaseMode = dir; this.door = this.getRandomDoor(random); this.boundingBox = bb; this.isLarge = bb.ySize > 6; }
  static create(list, random, x, y, z, dir, type) {
    let bb = StructureBoundingBox.componentBox(x, y, z, -4, -1, 0, 14, 11, 15, dir);
    if (!canStrongholdGoDeeper(bb) || StructureComponent.findIntersecting(list, bb) !== null) {
      bb = StructureBoundingBox.componentBox(x, y, z, -4, -1, 0, 14, 6, 15, dir);
      if (!canStrongholdGoDeeper(bb) || StructureComponent.findIntersecting(list, bb) !== null) return null;
    }
    return new StrongholdLibrary(type, random, bb, dir);
  }
  addComponentParts(world, random, bb) {
    if (this.isLiquidInStructureBoundingBox(world, bb)) return false;
    const tall = this.isLarge;
    const height = tall ? 11 : 6;
    this.fillWithRandomizedBlocks(world, bb, 0, 0, 0, 13, height - 1, 14, true, random, STRONGHOLD_STONES);
    this.placeDoor(world, random, bb, this.door, 4, 1, 0);
    this.randomlyFillWithBlocks(world, bb, random, 0.07, 2, 1, 1, 11, 4, 13, WEB, WEB, false);
    for (let z = 1; z <= 13; z++) {
      if ((z - 1) % 4 === 0) {
        this.solid(world, bb, 1, 1, z, 1, 4, z, PLANKS);
        this.solid(world, bb, 12, 1, z, 12, 4, z, PLANKS);
        this.put(world, TORCH, 0, 2, 3, z, bb);
        this.put(world, TORCH, 0, 11, 3, z, bb);
        if (tall) { this.solid(world, bb, 1, 6, z, 1, 9, z, PLANKS); this.solid(world, bb, 12, 6, z, 12, 9, z, PLANKS); }
      } else {
        this.solid(world, bb, 1, 1, z, 1, 4, z, BOOKSHELF);
        this.solid(world, bb, 12, 1, z, 12, 4, z, BOOKSHELF);
        if (tall) { this.solid(world, bb, 1, 6, z, 1, 9, z, BOOKSHELF); this.solid(world, bb, 12, 6, z, 12, 9, z, BOOKSHELF); }
      }
    }
    for (let z = 3; z < 12; z += 2) {
      this.solid(world, bb, 3, 1, z, 4, 3, z, BOOKSHELF);
      this.solid(world, bb, 6, 1, z, 7, 3, z, BOOKSHELF);
      this.solid(world, bb, 9, 1, z, 10, 3, z, BOOKSHELF);
    }
    if (tall) {
      this.solid(world, bb, 1, 5, 1, 3, 5, 13, PLANKS);
      this.solid(world, bb, 10, 5, 1, 12, 5, 13, PLANKS);
      this.solid(world, bb, 4, 5, 1, 9, 5, 2, PLANKS);
      this.solid(world, bb, 4, 5, 12, 9, 5, 13, PLANKS);
      this.put(world, PLANKS, 0, 9, 5, 11, bb); this.put(world, PLANKS, 0, 8, 5, 11, bb); this.put(world, PLANKS, 0, 9, 5, 10, bb);
      this.solid(world, bb, 3, 6, 2, 3, 6, 12, FENCE);
      this.solid(world, bb, 10, 6, 2, 10, 6, 10, FENCE);
      this.solid(world, bb, 4, 6, 2, 9, 6, 2, FENCE);
      this.solid(world, bb, 4, 6, 12, 8, 6, 12, FENCE);
      this.put(world, FENCE, 0, 9, 6, 11, bb); this.put(world, FENCE, 0, 8, 6, 11, bb); this.put(world, FENCE, 0, 9, 6, 10, bb);
      const ladder = this.getMetadataWithOffset(LADDER, 3);
      for (let y = 1; y <= 7; y++) this.put(world, LADDER, ladder, 10, y, 13, bb);
      const x = 7, z = 7;
      this.put(world, FENCE, 0, x - 1, 9, z, bb); this.put(world, FENCE, 0, x, 9, z, bb);
      this.put(world, FENCE, 0, x - 1, 8, z, bb); this.put(world, FENCE, 0, x, 8, z, bb);
      this.put(world, FENCE, 0, x - 1, 7, z, bb); this.put(world, FENCE, 0, x, 7, z, bb);
      this.put(world, FENCE, 0, x - 2, 7, z, bb); this.put(world, FENCE, 0, x + 1, 7, z, bb);
      this.put(world, FENCE, 0, x - 1, 7, z - 1, bb); this.put(world, FENCE, 0, x - 1, 7, z + 1, bb);
      this.put(world, FENCE, 0, x, 7, z - 1, bb); this.put(world, FENCE, 0, x, 7, z + 1, bb);
      this.put(world, TORCH, 0, x - 2, 8, z, bb); this.put(world, TORCH, 0, x + 1, 8, z, bb);
      this.put(world, TORCH, 0, x - 1, 8, z - 1, bb); this.put(world, TORCH, 0, x - 1, 8, z + 1, bb);
      this.put(world, TORCH, 0, x, 8, z - 1, bb); this.put(world, TORCH, 0, x, 8, z + 1, bb);
    }
    // Java argument order: the book row is drawn before the item count.
    let rows = libraryLoot(random);
    this.generateStructureChestContents(world, bb, random, 3, 3, 5, rows, 1 + random.nextInt(4));
    if (tall) {
      this.put(world, AIR, 0, 12, 9, 1, bb);
      rows = libraryLoot(random);
      this.generateStructureChestContents(world, bb, random, 12, 8, 1, rows, 1 + random.nextInt(4));
    }
    return true;
  }
  describe() { return this.base([this.isLarge]); }
}

export class StrongholdPortalRoom extends StrongholdPiece {
  static saveId = "SHPR";
  constructor(type, _random, bb, dir) { super(type); this.coordBaseMode = dir; this.boundingBox = bb; this.hasSpawner = false; }
  static create(list, random, x, y, z, dir, type) { return place(StrongholdPortalRoom, list, random, x, y, z, -4, -1, 0, 11, 8, 16, dir, type); }
  buildComponent(start, _list, _random) { if (start) start.portalRoom = this; }
  // No liquid veto: the portal room is always built.
  addComponentParts(world, random, bb) {
    this.rand(world, bb, random, 0, 0, 0, 10, 7, 15);
    this.placeDoor(world, random, bb, GRATES, 4, 1, 0);
    const top = 6;
    this.rand(world, bb, random, 1, top, 1, 1, top, 14);
    this.rand(world, bb, random, 9, top, 1, 9, top, 14);
    this.rand(world, bb, random, 2, top, 1, 8, top, 2);
    this.rand(world, bb, random, 2, top, 14, 8, top, 14);
    this.rand(world, bb, random, 1, 1, 1, 2, 1, 4);
    this.rand(world, bb, random, 8, 1, 1, 9, 1, 4);
    this.solid(world, bb, 1, 1, 1, 1, 1, 3, FLOWING_LAVA);
    this.solid(world, bb, 9, 1, 1, 9, 1, 3, FLOWING_LAVA);
    this.rand(world, bb, random, 3, 1, 8, 7, 1, 12);
    this.solid(world, bb, 4, 1, 9, 6, 1, 11, FLOWING_LAVA);
    for (let z = 3; z < 14; z += 2) { this.solid(world, bb, 0, 3, z, 0, 4, z, IRON_BARS); this.solid(world, bb, 10, 3, z, 10, 4, z, IRON_BARS); }
    for (let x = 2; x < 9; x += 2) this.solid(world, bb, x, 3, 15, x, 4, 15, IRON_BARS);
    const stairs = this.getMetadataWithOffset(STONE_BRICK_STAIRS, 3);
    this.rand(world, bb, random, 4, 1, 5, 6, 1, 7);
    this.rand(world, bb, random, 4, 2, 6, 6, 2, 7);
    this.rand(world, bb, random, 4, 3, 7, 6, 3, 7);
    for (let x = 4; x <= 6; x++) {
      this.put(world, STONE_BRICK_STAIRS, stairs, x, 1, 4, bb);
      this.put(world, STONE_BRICK_STAIRS, stairs, x, 2, 5, bb);
      this.put(world, STONE_BRICK_STAIRS, stairs, x, 3, 6, bb);
    }
    let d6 = 2, d7 = 0, d8 = 3, d9 = 1;
    switch (this.coordBaseMode) {
      case 0: d6 = 0; d7 = 2; break;
      case 1: d6 = 1; d7 = 3; d8 = 0; d9 = 2; break;
      case 3: d6 = 3; d7 = 1; d8 = 0; d9 = 2; break;
      default:
    }
    // Eye of ender roll per frame, drawn in this order whether or not the frame is inside bb.
    const frame = (dir, x, z) => this.put(world, END_PORTAL_FRAME, dir + (random.nextFloat() > f(0.9) ? 4 : 0), x, 3, z, bb);
    frame(d6, 4, 8); frame(d6, 5, 8); frame(d6, 6, 8);
    frame(d7, 4, 12); frame(d7, 5, 12); frame(d7, 6, 12);
    frame(d8, 3, 9); frame(d8, 3, 10); frame(d8, 3, 11);
    frame(d9, 7, 9); frame(d9, 7, 10); frame(d9, 7, 11);
    if (!this.hasSpawner) {
      const y = this.getYWithOffset(3), x = this.getXWithOffset(5, 6), z = this.getZWithOffset(5, 6);
      if (bb.isVecInside(x, y, z)) {
        this.hasSpawner = true;
        world.setBlock(x, y, z, MOB_SPAWNER, 0, 2);
        const spawner = world.getTileEntity(x, y, z);
        if (spawner) spawner.setEntityName("Silverfish");
      }
    }
    return true;
  }
  describe() { return this.base([this.hasSpawner]); }
}

export class StrongholdCorridor extends StrongholdPiece {
  static saveId = "SHFC";
  // The constructor draws no random numbers and keeps the default OPENING door.
  constructor(type, _random, bb, dir) {
    super(type);
    this.coordBaseMode = dir; this.boundingBox = bb;
    this.steps = dir === 2 || dir === 0 ? bb.zSize : bb.xSize;
  }
  // Returns the (possibly shortened) box adjoining an existing piece at the same level, or null.
  static findValidPlacement(list, random, x, y, z, dir) {
    let bb = StructureBoundingBox.componentBox(x, y, z, -1, -1, 0, 5, 5, 4, dir);
    const hit = StructureComponent.findIntersecting(list, bb);
    if (hit === null) return null;
    if (hit.boundingBox.minY === bb.minY) {
      for (let depth = 3; depth >= 1; depth--) {
        bb = StructureBoundingBox.componentBox(x, y, z, -1, -1, 0, 5, 5, depth - 1, dir);
        if (!hit.boundingBox.intersectsWith(bb)) return StructureBoundingBox.componentBox(x, y, z, -1, -1, 0, 5, 5, depth, dir);
      }
    }
    return null;
  }
  addComponentParts(world, _random, bb) {
    if (this.isLiquidInStructureBoundingBox(world, bb)) return false;
    for (let i = 0; i < this.steps; i++) {
      for (let x = 0; x <= 4; x++) this.put(world, STONE_BRICK, 0, x, 0, i, bb);
      for (let y = 1; y <= 3; y++) {
        this.put(world, STONE_BRICK, 0, 0, y, i, bb);
        this.put(world, AIR, 0, 1, y, i, bb); this.put(world, AIR, 0, 2, y, i, bb); this.put(world, AIR, 0, 3, y, i, bb);
        this.put(world, STONE_BRICK, 0, 4, y, i, bb);
      }
      for (let x = 0; x <= 4; x++) this.put(world, STONE_BRICK, 0, x, 4, i, bb);
    }
    return true;
  }
  describe() { return this.base([this.steps]); }
}

// MapGenStronghold.Start (auh): the Stairs2 start, then the pending-piece list drained in random order.
export class StructureStrongholdStart extends StructureStart {
  constructor(world, random, chunkX, chunkZ) {
    super(chunkX, chunkZ);
    prepareStructurePieces();
    const start = new StrongholdStart(0, random, (chunkX << 4) + 2, (chunkZ << 4) + 2);
    this.components.push(start);
    start.buildComponent(start, this.components, random);
    const pending = start.pendingPieces;
    while (pending.length) {
      const piece = pending.splice(random.nextInt(pending.length), 1)[0];
      piece.buildComponent(start, this.components, random);
    }
    this.updateBoundingBox();
    this.markAvailableHeight(world, random, 10);
  }
}

// MapGenStronghold (aug). positions are the ChunkCoordIntPair [x, z] list that the native canSpawnStructureAtCoords
// computes lazily (already ported as structure-placement.js strongholdPositions).
export class MapGenStronghold extends MapGenStructure {
  constructor(worldSeed, positions) {
    super(worldSeed);
    this.positions = positions.map(([x, z]) => [x, z]);
    this.attemptLog = []; // [chunkX, chunkZ, attempts, Random state probe]: for tests, not part of the native class
  }
  static forSeed(worldSeed, manager, options) {
    return new MapGenStronghold(worldSeed, strongholdPositions(BigInt.asIntN(64, BigInt(worldSeed)), manager, options));
  }
  get structureName() { return "Stronghold"; }
  canSpawnStructureAtCoords(x, z) { return this.positions.some((p) => p[0] === x && p[1] === z); }
  // o_(): ChunkCoordIntPair.func_151349_a(64), the block coordinates at the chunk centre.
  getCoordList() { return this.positions.map(([x, z]) => [(x << 4) + 8, 64, (z << 4) + 8]); }
  // ave.b: start pieces are regenerated, continuing the same Random, until the walk placed a PortalRoom.
  getStructureStart(x, z) {
    let attempts = 0, start;
    do {
      start = new StructureStrongholdStart(null, this.random, x, z);
      attempts++;
    } while (start.components.length === 0 || start.components[0].portalRoom === null);
    this.attemptLog.push([x, z, attempts]);
    return start;
  }
}

export const STRONGHOLD_PIECE_CLASSES = [
  StrongholdStart, StrongholdStairs, StrongholdStraight, StrongholdPrison, StrongholdLeftTurn, StrongholdRightTurn, StrongholdRoomCrossing,
  StrongholdStairsStraight, StrongholdCrossing, StrongholdChestCorridor, StrongholdLibrary, StrongholdPortalRoom, StrongholdCorridor,
];
