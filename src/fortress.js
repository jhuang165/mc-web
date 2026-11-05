// Minecraft Java 1.7.10 Nether fortress: MapGenNetherBridge (atd), MapGenNetherBridge.Start (ate) and
// StructureNetherBridgePieces (atf) with its pieces: Start (atw), Crossing3 / bridge crossing (atg), End (ath),
// Straight / bridge (ati), Corridor3 / castle corridor stairs (atj), Corridor4 / corridor T balcony (atk),
// Entrance / castle entrance (atl), Crossing2 (atm), Corridor / left turn (atn), Corridor5 / straight corridor (ato),
// Corridor2 / right turn (atp), NetherStalkRoom (atq), Throne / monster throne (atr), Piece base (ats),
// PieceWeight (att), Crossing / room crossing (atu) and Stairs / stairs room (atv).
// Built on structure-framework.js. Original numeric block ids. World adapter as documented there, plus
// `world.immediate` + `world.updateTick(id,x,y,z,random)` (gen-world.js) for the castle entrance's lava tick.
// Chest tiles take loot through generateStructureChestContents; the throne spawner calls setEntityName("Blaze").
// The Nether generator (nether-generator.js) owns one MapGenNetherBridge per world seed. No NBT save/load.
import {
  StructureBoundingBox, StructureComponent, StructureStart, MapGenStructure, AIR, NETHER_BRICK_STAIRS,
} from "./structure-framework.js";
import { JavaRandom } from "./java-random.js";

const FLOWING_LAVA = 10, SOUL_SAND = 88, MOB_SPAWNER = 52, NETHER_BRICK = 112, NETHER_FENCE = 113, NETHER_WART = 115;
const B = NETHER_BRICK, F = NETHER_FENCE, A = AIR;

// ats.a (StructureNetherBridgePieces chest loot), extracted by FortressProbe: [stack, min, max, weight, maxStackSize].
export const FORTRESS_CHEST_LOOT = [[[264,1,0,[]],1,3,5,64],[[265,1,0,[]],1,5,5,64],[[266,1,0,[]],1,3,15,64],[[283,1,0,[]],1,1,5,1],[[315,1,0,[]],1,1,5,1],[[259,1,0,[]],1,1,5,1],[[372,1,0,[]],3,7,5,64],[[329,1,0,[]],1,1,10,1],[[418,1,0,[]],1,1,8,1],[[417,1,0,[]],1,1,5,1],[[419,1,0,[]],1,1,3,1]];
// MapGenNetherBridge.e: [entity, weight, minGroup, maxGroup] (BiomeGenBase.SpawnListEntry). Skeleton becomes a wither
// skeleton (skeleton type 1) through EntitySkeleton's Nether spawn rule, not through this list.
export const FORTRESS_SPAWN_LIST = [["Blaze", 10, 2, 3], ["PigZombie", 5, 4, 4], ["Skeleton", 10, 4, 4], ["LavaSlime", 3, 4, 4]];

// StructureNetherBridgePieces.PieceWeight (att).
export class PieceWeight {
  constructor(pieceClass, weight, limit, allowInRow = false) {
    this.pieceClass = pieceClass; this.weight = weight; this.instanceLimit = limit; this.allowInRow = allowInRow; this.instancesSpawned = 0;
  }
  canSpawnMoreStructuresOfType() { return this.instanceLimit === 0 || this.instancesSpawned < this.instanceLimit; }
  canSpawnMoreStructures() { return this.instanceLimit === 0 || this.instancesSpawned < this.instanceLimit; }
}

// getRandomComponent's weight lookup (ats.a(List)): the weight sum, or -1 when no limited piece remains.
function totalWeight(weights) {
  let any = false, sum = 0;
  for (const w of weights) { if (w.instanceLimit > 0 && w.instancesSpawned < w.instanceLimit) any = true; sum += w.weight; }
  return any ? sum : -1;
}
const canGoDeeper = (bb) => bb !== null && bb.minY > 10;

// Shared tail of every createValidComponent: depth test, collision test, then the constructor (which may draw random).
const factory = (Piece, ox, oy, oz, w, h, d) => (list, random, x, y, z, dir, type) => {
  const bb = StructureBoundingBox.componentBox(x, y, z, ox, oy, oz, w, h, d, dir);
  return canGoDeeper(bb) && StructureComponent.findIntersecting(list, bb) === null ? new Piece(type, random, bb, dir) : null;
};

function createPiece(weight, list, random, x, y, z, dir, type) {
  return weight.pieceClass.create(list, random, x, y, z, dir, type);
}
// ats.a(atw, List, List, Random, ...): up to 5 weighted rolls, then an End piece. When a chosen piece does not fit, the
// roll's remainder stays negative and the next weight in the same pass is tried (native `continue` of the inner loop).
function weightedPiece(start, weights, list, random, x, y, z, dir, type) {
  const total = totalWeight(weights);
  const open = total > 0 && type <= 30;
  for (let tries = 0; tries < 5 && open;) {
    tries++;
    let roll = random.nextInt(total);
    for (const w of weights.slice()) {
      roll -= w.weight;
      if (roll >= 0) continue;
      if (!w.canSpawnMoreStructuresOfType(type)) break;
      if (w === start.lastPieceWeight && !w.allowInRow) break;
      const piece = createPiece(w, list, random, x, y, z, dir, type);
      if (!piece) continue;
      w.instancesSpawned++;
      start.lastPieceWeight = w;
      if (!w.canSpawnMoreStructures()) weights.splice(weights.indexOf(w), 1);
      return piece;
    }
  }
  return FortressEnd.create(list, random, x, y, z, dir, type);
}
// ats.a(atw, List, Random, ...): the 112-block limit from the start piece's minimum corner.
function nextValidComponent(start, list, random, x, y, z, dir, type, secondary) {
  if (Math.abs(x - start.boundingBox.minX) > 112 || Math.abs(z - start.boundingBox.minZ) > 112)
    return FortressEnd.create(list, random, x, y, z, dir, type);
  const weights = secondary ? start.secondaryWeights : start.primaryWeights;
  const piece = weightedPiece(start, weights, list, random, x, y, z, dir, type + 1);
  if (piece) { list.push(piece); start.pendingPieces.push(piece); }
  return piece;
}

class FortressPiece extends StructureComponent {
  constructor(type, _random, bb, dir) { super(type); this.coordBaseMode = dir; this.boundingBox = bb; }
  // ats.a / b / c(start, list, random, offsetA, offsetB, secondary): forward, left (-x side) and right (+x side) exits.
  nextNormal(start, list, random, xOff, yOff, secondary) {
    const b = this.boundingBox, m = this.coordBaseMode, t = this.componentType;
    switch (m) {
      case 2: return nextValidComponent(start, list, random, b.minX + xOff, b.minY + yOff, b.minZ - 1, m, t, secondary);
      case 0: return nextValidComponent(start, list, random, b.minX + xOff, b.minY + yOff, b.maxZ + 1, m, t, secondary);
      case 1: return nextValidComponent(start, list, random, b.minX - 1, b.minY + yOff, b.minZ + xOff, m, t, secondary);
      case 3: return nextValidComponent(start, list, random, b.maxX + 1, b.minY + yOff, b.minZ + xOff, m, t, secondary);
      default: return null;
    }
  }
  nextX(start, list, random, yOff, zOff, secondary) {
    const b = this.boundingBox, m = this.coordBaseMode, t = this.componentType;
    switch (m) {
      case 2: case 0: return nextValidComponent(start, list, random, b.minX - 1, b.minY + yOff, b.minZ + zOff, 1, t, secondary);
      case 1: case 3: return nextValidComponent(start, list, random, b.minX + zOff, b.minY + yOff, b.minZ - 1, 2, t, secondary);
      default: return null;
    }
  }
  nextZ(start, list, random, yOff, zOff, secondary) {
    const b = this.boundingBox, m = this.coordBaseMode, t = this.componentType;
    switch (m) {
      case 2: case 0: return nextValidComponent(start, list, random, b.maxX + 1, b.minY + yOff, b.minZ + zOff, 3, t, secondary);
      case 1: case 3: return nextValidComponent(start, list, random, b.minX + zOff, b.minY + yOff, b.maxZ + 1, 0, t, secondary);
      default: return null;
    }
  }
  put(world, id, meta, x, y, z, bb) { this.placeBlockAtCurrentPosition(world, id, meta, x, y, z, bb); }
  // fillWithBlocks with skipAir false, many boxes at once: [x0,y0,z0,x1,y1,z1,edge,inside=edge].
  fills(world, bb, boxes) {
    for (const [x0, y0, z0, x1, y1, z1, edge, inside = edge] of boxes) this.fillWithBlocks(world, bb, x0, y0, z0, x1, y1, z1, edge, inside, false);
  }
  // fillCurrentPositionBlocksDownwards of nether brick over [x0..x1] x [z0..z1] at y -1.
  foundation(world, bb, x0, x1, z0, z1) {
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) this.fillCurrentPositionBlocksDownwards(world, B, 0, x, -1, z, bb);
  }
  // The save-format description used by the tests: [id, orientation, type, bb..., ...extra].
  describe() { return [this.typeName, this.coordBaseMode, this.componentType, ...this.boundingBox.toArray(), ...this.extra()]; }
  extra() { return []; }
}

// Crossing3 (atg, NeBCr): bridge crossing, 19x10x19. The start piece shares its constructor shape.
export class FortressCrossing3 extends FortressPiece {
  static saveId = "NeBCr";
  static create = factory(FortressCrossing3, -8, -3, 0, 19, 10, 19);
  buildComponent(start, list, random) {
    this.nextNormal(start, list, random, 8, 3, false);
    this.nextX(start, list, random, 3, 8, false);
    this.nextZ(start, list, random, 3, 8, false);
  }
  addComponentParts(world, _random, bb) {
    this.fills(world, bb, [[7,3,0,11,4,18,B],[0,3,7,18,4,11,B],[8,5,0,10,7,18,A],[0,5,8,18,7,10,A],[7,5,0,7,5,7,B],[7,5,11,7,5,18,B],
      [11,5,0,11,5,7,B],[11,5,11,11,5,18,B],[0,5,7,7,5,7,B],[11,5,7,18,5,7,B],[0,5,11,7,5,11,B],[11,5,11,18,5,11,B],[7,2,0,11,2,5,B],
      [7,2,13,11,2,18,B],[7,0,0,11,1,3,B],[7,0,15,11,1,18,B]]);
    for (let x = 7; x <= 11; x++) for (let z = 0; z <= 2; z++) {
      this.fillCurrentPositionBlocksDownwards(world, B, 0, x, -1, z, bb);
      this.fillCurrentPositionBlocksDownwards(world, B, 0, x, -1, 18 - z, bb);
    }
    this.fills(world, bb, [[0,2,7,5,2,11,B],[13,2,7,18,2,11,B],[0,0,7,3,1,11,B],[15,0,7,18,1,11,B]]);
    for (let x = 0; x <= 2; x++) for (let z = 7; z <= 11; z++) {
      this.fillCurrentPositionBlocksDownwards(world, B, 0, x, -1, z, bb);
      this.fillCurrentPositionBlocksDownwards(world, B, 0, 18 - x, -1, z, bb);
    }
    return true;
  }
}

// Start (atw): the first piece. Random draw order: orientation (nextInt(4)); the weight lists reset instancesSpawned.
export class FortressStart extends FortressCrossing3 {
  static saveId = "NeStart";
  constructor(random, x, z) {
    const dir = random.nextInt(4);
    super(0, random, new StructureBoundingBox(x, 64, z, x + 18, 73, z + 18), dir);
    this.lastPieceWeight = null;
    this.primaryWeights = PRIMARY_WEIGHTS().map((w) => w);
    this.secondaryWeights = SECONDARY_WEIGHTS().map((w) => w);
    this.pendingPieces = [];
  }
}

// End (ath, NeBEF): bridge end, a seeded ragged edge. The constructor draws nextInt() as its seed.
export class FortressEnd extends FortressPiece {
  static saveId = "NeBEF";
  static create = factory(FortressEnd, -1, -3, 0, 5, 10, 8);
  constructor(type, random, bb, dir) { super(type, random, bb, dir); this.seed = random.nextInt(); }
  extra() { return [this.seed]; }
  addComponentParts(world, _random, bb) {
    const r = new JavaRandom(BigInt(this.seed));
    for (let x = 0; x <= 4; x++) for (let y = 3; y <= 4; y++) {
      const n = r.nextInt(8);
      this.fillWithBlocks(world, bb, x, y, 0, x, y, n, B, B, false);
    }
    let n = r.nextInt(8);
    this.fillWithBlocks(world, bb, 0, 5, 0, 0, 5, n, B, B, false);
    n = r.nextInt(8);
    this.fillWithBlocks(world, bb, 4, 5, 0, 4, 5, n, B, B, false);
    for (let x = 0; x <= 4; x++) { n = r.nextInt(5); this.fillWithBlocks(world, bb, x, 2, 0, x, 2, n, B, B, false); }
    for (let x = 0; x <= 4; x++) for (let y = 0; y <= 1; y++) {
      n = r.nextInt(3);
      this.fillWithBlocks(world, bb, x, y, 0, x, y, n, B, B, false);
    }
    return true;
  }
}

// Straight (ati, NeBS): the 19-long bridge.
export class FortressStraight extends FortressPiece {
  static saveId = "NeBS";
  static create = factory(FortressStraight, -1, -3, 0, 5, 10, 19);
  buildComponent(start, list, random) { this.nextNormal(start, list, random, 1, 3, false); }
  addComponentParts(world, _random, bb) {
    this.fills(world, bb, [[0,3,0,4,4,18,B],[1,5,0,3,7,18,A],[0,5,0,0,5,18,B],[4,5,0,4,5,18,B],[0,2,0,4,2,5,B],[0,2,13,4,2,18,B],[0,0,0,4,1,3,B],[0,0,15,4,1,18,B]]);
    for (let x = 0; x <= 4; x++) for (let z = 0; z <= 2; z++) {
      this.fillCurrentPositionBlocksDownwards(world, B, 0, x, -1, z, bb);
      this.fillCurrentPositionBlocksDownwards(world, B, 0, x, -1, 18 - z, bb);
    }
    this.fills(world, bb, [[0,1,1,0,4,1,F],[0,3,4,0,4,4,F],[0,3,14,0,4,14,F],[0,1,17,0,4,17,F],[4,1,1,4,4,1,F],[4,3,4,4,4,4,F],[4,3,14,4,4,14,F],[4,1,17,4,4,17,F]]);
    return true;
  }
}

// Corridor3 (atj, NeCCS): castle corridor with a stair descending seven blocks.
export class FortressCorridor3 extends FortressPiece {
  static saveId = "NeCCS";
  static create = factory(FortressCorridor3, -1, -7, 0, 5, 14, 10);
  buildComponent(start, list, random) { this.nextNormal(start, list, random, 1, 0, true); }
  addComponentParts(world, _random, bb) {
    const stairs = this.getMetadataWithOffset(NETHER_BRICK_STAIRS, 2);
    for (let i = 0; i <= 9; i++) {
      const lo = Math.max(1, 7 - i), hi = Math.min(Math.max(lo + 5, 14 - i), 13);
      this.fills(world, bb, [[0,0,i,4,lo,i,B],[1,lo+1,i,3,hi-1,i,A]]);
      if (i <= 6) for (let x = 1; x <= 3; x++) this.put(world, NETHER_BRICK_STAIRS, stairs, x, lo + 1, i, bb);
      this.fills(world, bb, [[0,hi,i,4,hi,i,B],[0,lo+1,i,0,hi-1,i,B],[4,lo+1,i,4,hi-1,i,B]]);
      if ((i & 1) === 0) this.fills(world, bb, [[0,lo+2,i,0,lo+3,i,F],[4,lo+2,i,4,lo+3,i,F]]);
      for (let x = 0; x <= 4; x++) this.fillCurrentPositionBlocksDownwards(world, B, 0, x, -1, i, bb);
    }
    return true;
  }
}

// Corridor4 (atk, NeCTB): corridor T balcony. Both side exits roll nextInt(8) > 0 in X-then-Z order.
export class FortressCorridor4 extends FortressPiece {
  static saveId = "NeCTB";
  static create = factory(FortressCorridor4, -3, 0, 0, 9, 7, 9);
  buildComponent(start, list, random) {
    const y = this.coordBaseMode === 1 || this.coordBaseMode === 2 ? 5 : 1;
    this.nextX(start, list, random, 0, y, random.nextInt(8) > 0);
    this.nextZ(start, list, random, 0, y, random.nextInt(8) > 0);
  }
  addComponentParts(world, _random, bb) {
    this.fills(world, bb, [[0,0,0,8,1,8,B],[0,2,0,8,5,8,A],[0,6,0,8,6,5,B],[0,2,0,2,5,0,B],[6,2,0,8,5,0,B],[1,3,0,1,4,0,F],[7,3,0,7,4,0,F],
      [0,2,4,8,2,8,B],[1,1,4,2,2,4,A],[6,1,4,7,2,4,A],[0,3,8,8,3,8,F],[0,3,6,0,3,7,F],[8,3,6,8,3,7,F],[0,3,4,0,5,5,B],[8,3,4,8,5,5,B],
      [1,3,5,2,5,5,B],[6,3,5,7,5,5,B],[1,4,5,1,5,5,F],[7,4,5,7,5,5,F]]);
    for (let z = 0; z <= 5; z++) for (let x = 0; x <= 8; x++) this.fillCurrentPositionBlocksDownwards(world, B, 0, x, -1, z, bb);
    return true;
  }
}

// Entrance (atl, NeCE): castle entrance, 13x14x13, with the lava well that ticks immediately.
export class FortressEntrance extends FortressPiece {
  static saveId = "NeCE";
  static create = factory(FortressEntrance, -5, -3, 0, 13, 14, 13);
  buildComponent(start, list, random) { this.nextNormal(start, list, random, 5, 3, true); }
  addComponentParts(world, random, bb) {
    this.fills(world, bb, [[0,3,0,12,4,12,B],[0,5,0,12,13,12,A],[0,5,0,1,12,12,B],[11,5,0,12,12,12,B],[2,5,11,4,12,12,B],[8,5,11,10,12,12,B],
      [5,9,11,7,12,12,B],[2,5,0,4,12,1,B],[8,5,0,10,12,1,B],[5,9,0,7,12,1,B],[2,11,2,10,12,10,B],[5,8,0,7,8,0,F]]);
    for (let n = 1; n <= 11; n += 2) {
      this.fills(world, bb, [[n,10,0,n,11,0,F],[n,10,12,n,11,12,F],[0,10,n,0,11,n,F],[12,10,n,12,11,n,F]]);
      this.put(world, B, 0, n, 13, 0, bb); this.put(world, B, 0, n, 13, 12, bb); this.put(world, B, 0, 0, 13, n, bb); this.put(world, B, 0, 12, 13, n, bb);
      this.put(world, F, 0, n + 1, 13, 0, bb); this.put(world, F, 0, n + 1, 13, 12, bb); this.put(world, F, 0, 0, 13, n + 1, bb); this.put(world, F, 0, 12, 13, n + 1, bb);
    }
    this.put(world, F, 0, 0, 13, 0, bb); this.put(world, F, 0, 0, 13, 12, bb); this.put(world, F, 0, 0, 13, 0, bb); this.put(world, F, 0, 12, 13, 0, bb);
    for (let n = 3; n <= 9; n += 2) this.fills(world, bb, [[1,7,n,1,8,n,F],[11,7,n,11,8,n,F]]);
    this.fills(world, bb, [[4,2,0,8,2,12,B],[0,2,4,12,2,8,B],[4,0,0,8,1,3,B],[4,0,9,8,1,12,B],[0,0,4,3,1,8,B],[9,0,4,12,1,8,B]]);
    for (let x = 4; x <= 8; x++) for (let z = 0; z <= 2; z++) {
      this.fillCurrentPositionBlocksDownwards(world, B, 0, x, -1, z, bb);
      this.fillCurrentPositionBlocksDownwards(world, B, 0, x, -1, 12 - z, bb);
    }
    for (let x = 0; x <= 2; x++) for (let z = 4; z <= 8; z++) {
      this.fillCurrentPositionBlocksDownwards(world, B, 0, x, -1, z, bb);
      this.fillCurrentPositionBlocksDownwards(world, B, 0, 12 - x, -1, z, bb);
    }
    this.fills(world, bb, [[5,5,5,7,5,7,B],[6,1,6,6,4,6,A]]);
    this.put(world, B, 0, 6, 0, 6, bb);
    this.put(world, FLOWING_LAVA, 0, 6, 5, 6, bb);
    const x = this.getXWithOffset(6, 6), y = this.getYWithOffset(5), z = this.getZWithOffset(6, 6);
    if (bb.isVecInside(x, y, z)) {
      world.immediate = true;
      world.updateTick(FLOWING_LAVA, x, y, z, random);
      world.immediate = false;
    }
    return true;
  }
}

// Crossing2 (atm, NeSCSC): small four-way castle crossing.
export class FortressCrossing2 extends FortressPiece {
  static saveId = "NeSCSC";
  static create = factory(FortressCrossing2, -1, 0, 0, 5, 7, 5);
  buildComponent(start, list, random) {
    this.nextNormal(start, list, random, 1, 0, true);
    this.nextX(start, list, random, 0, 1, true);
    this.nextZ(start, list, random, 0, 1, true);
  }
  addComponentParts(world, _random, bb) {
    this.fills(world, bb, [[0,0,0,4,1,4,B],[0,2,0,4,5,4,A],[0,2,0,0,5,0,B],[4,2,0,4,5,0,B],[0,2,4,0,5,4,B],[4,2,4,4,5,4,B],[0,6,0,4,6,4,B]]);
    this.foundation(world, bb, 0, 4, 0, 4);
    return true;
  }
}

// Left and right turn corridors share the chest roll: nextInt(3) == 0 in the constructor, chest at generation.
class FortressTurn extends FortressPiece {
  constructor(type, random, bb, dir) { super(type, random, bb, dir); this.hasChest = random.nextInt(3) === 0; }
  extra() { return [this.hasChest]; }
  chest(world, bb, random, cx) {
    const y = this.getYWithOffset(2), x = this.getXWithOffset(cx, 3), z = this.getZWithOffset(cx, 3);
    if (bb.isVecInside(x, y, z)) {
      this.hasChest = false;
      this.generateStructureChestContents(world, bb, random, cx, 2, 3, FORTRESS_CHEST_LOOT, 2 + random.nextInt(4));
    }
  }
}
// Corridor (atn, NeSCLT): left turn.
export class FortressCorridor extends FortressTurn {
  static saveId = "NeSCLT";
  static create = factory(FortressCorridor, -1, 0, 0, 5, 7, 5);
  buildComponent(start, list, random) { this.nextX(start, list, random, 0, 1, true); }
  addComponentParts(world, random, bb) {
    this.fills(world, bb, [[0,0,0,4,1,4,B],[0,2,0,4,5,4,A],[4,2,0,4,5,4,B],[4,3,1,4,4,1,F],[4,3,3,4,4,3,F],[0,2,0,0,5,0,B],[0,2,4,3,5,4,B],
      [1,3,4,1,4,4,F,B],[3,3,4,3,4,4,F,B]]);
    if (this.hasChest) this.chest(world, bb, random, 3);
    this.fills(world, bb, [[0,6,0,4,6,4,B]]);
    this.foundation(world, bb, 0, 4, 0, 4);
    return true;
  }
}
// Corridor2 (atp, NeSCRT): right turn.
export class FortressCorridor2 extends FortressTurn {
  static saveId = "NeSCRT";
  static create = factory(FortressCorridor2, -1, 0, 0, 5, 7, 5);
  buildComponent(start, list, random) { this.nextZ(start, list, random, 0, 1, true); }
  addComponentParts(world, random, bb) {
    this.fills(world, bb, [[0,0,0,4,1,4,B],[0,2,0,4,5,4,A],[0,2,0,0,5,4,B],[0,3,1,0,4,1,F],[0,3,3,0,4,3,F],[4,2,0,4,5,0,B],[1,2,4,4,5,4,B],
      [1,3,4,1,4,4,F,B],[3,3,4,3,4,4,F,B]]);
    if (this.hasChest) this.chest(world, bb, random, 1);
    this.fills(world, bb, [[0,6,0,4,6,4,B]]);
    this.foundation(world, bb, 0, 4, 0, 4);
    return true;
  }
}

// Corridor5 (ato, NeSC): straight castle corridor.
export class FortressCorridor5 extends FortressPiece {
  static saveId = "NeSC";
  static create = factory(FortressCorridor5, -1, 0, 0, 5, 7, 5);
  buildComponent(start, list, random) { this.nextNormal(start, list, random, 1, 0, true); }
  addComponentParts(world, _random, bb) {
    this.fills(world, bb, [[0,0,0,4,1,4,B],[0,2,0,4,5,4,A],[0,2,0,0,5,4,B],[4,2,0,4,5,4,B],[0,3,1,0,4,1,F],[0,3,3,0,4,3,F],[4,3,1,4,4,1,F],
      [4,3,3,4,4,3,F],[0,6,0,4,6,4,B]]);
    this.foundation(world, bb, 0, 4, 0, 4);
    return true;
  }
}

// NetherStalkRoom (atq, NeCSR): the nether wart room.
export class FortressNetherStalkRoom extends FortressPiece {
  static saveId = "NeCSR";
  static create = factory(FortressNetherStalkRoom, -5, -3, 0, 13, 14, 13);
  buildComponent(start, list, random) {
    this.nextNormal(start, list, random, 5, 3, true);
    this.nextNormal(start, list, random, 5, 11, true);
  }
  addComponentParts(world, _random, bb) {
    this.fills(world, bb, [[0,3,0,12,4,12,B],[0,5,0,12,13,12,A],[0,5,0,1,12,12,B],[11,5,0,12,12,12,B],[2,5,11,4,12,12,B],[8,5,11,10,12,12,B],
      [5,9,11,7,12,12,B],[2,5,0,4,12,1,B],[8,5,0,10,12,1,B],[5,9,0,7,12,1,B],[2,11,2,10,12,10,B]]);
    for (let n = 1; n <= 11; n += 2) {
      this.fills(world, bb, [[n,10,0,n,11,0,F],[n,10,12,n,11,12,F],[0,10,n,0,11,n,F],[12,10,n,12,11,n,F]]);
      this.put(world, B, 0, n, 13, 0, bb); this.put(world, B, 0, n, 13, 12, bb); this.put(world, B, 0, 0, 13, n, bb); this.put(world, B, 0, 12, 13, n, bb);
      this.put(world, F, 0, n + 1, 13, 0, bb); this.put(world, F, 0, n + 1, 13, 12, bb); this.put(world, F, 0, 0, 13, n + 1, bb); this.put(world, F, 0, 12, 13, n + 1, bb);
    }
    this.put(world, F, 0, 0, 13, 0, bb); this.put(world, F, 0, 0, 13, 12, bb); this.put(world, F, 0, 0, 13, 0, bb); this.put(world, F, 0, 12, 13, 0, bb);
    for (let n = 3; n <= 9; n += 2) this.fills(world, bb, [[1,7,n,1,8,n,F],[11,7,n,11,8,n,F]]);
    const stairsS = this.getMetadataWithOffset(NETHER_BRICK_STAIRS, 3);
    for (let i = 0; i <= 6; i++) {
      const z = i + 4;
      for (let x = 5; x <= 7; x++) this.put(world, NETHER_BRICK_STAIRS, stairsS, x, 5 + i, z, bb);
      if (z >= 5 && z <= 8) this.fills(world, bb, [[5,5,z,7,i+4,z,B]]);
      else if (z >= 9 && z <= 10) this.fills(world, bb, [[5,8,z,7,i+4,z,B]]);
      if (i >= 1) this.fills(world, bb, [[5,6+i,z,7,9+i,z,A]]);
    }
    for (let x = 5; x <= 7; x++) this.put(world, NETHER_BRICK_STAIRS, stairsS, x, 12, 11, bb);
    this.fills(world, bb, [[5,6,7,5,7,7,F],[7,6,7,7,7,7,F],[5,13,12,7,13,12,A],[2,5,2,3,5,3,B],[2,5,9,3,5,10,B],[2,5,4,2,5,8,B],[9,5,2,10,5,3,B],
      [9,5,9,10,5,10,B],[10,5,4,10,5,8,B]]);
    const stairsW = this.getMetadataWithOffset(NETHER_BRICK_STAIRS, 0), stairsE = this.getMetadataWithOffset(NETHER_BRICK_STAIRS, 1);
    for (const [m, x] of [[stairsE, 4], [stairsW, 8]]) for (const z of [2, 3, 9, 10]) this.put(world, NETHER_BRICK_STAIRS, m, x, 5, z, bb);
    this.fills(world, bb, [[3,4,4,4,4,8,SOUL_SAND],[8,4,4,9,4,8,SOUL_SAND],[3,5,4,4,5,8,NETHER_WART],[8,5,4,9,5,8,NETHER_WART],
      [4,2,0,8,2,12,B],[0,2,4,12,2,8,B],[4,0,0,8,1,3,B],[4,0,9,8,1,12,B],[0,0,4,3,1,8,B],[9,0,4,12,1,8,B]]);
    for (let x = 4; x <= 8; x++) for (let z = 0; z <= 2; z++) {
      this.fillCurrentPositionBlocksDownwards(world, B, 0, x, -1, z, bb);
      this.fillCurrentPositionBlocksDownwards(world, B, 0, x, -1, 12 - z, bb);
    }
    for (let x = 0; x <= 2; x++) for (let z = 4; z <= 8; z++) {
      this.fillCurrentPositionBlocksDownwards(world, B, 0, x, -1, z, bb);
      this.fillCurrentPositionBlocksDownwards(world, B, 0, 12 - x, -1, z, bb);
    }
    return true;
  }
}

// Throne (atr, NeMT): the blaze spawner room. The spawner is placed once (the flag survives for later chunks).
export class FortressThrone extends FortressPiece {
  static saveId = "NeMT";
  static create = factory(FortressThrone, -2, 0, 0, 7, 8, 9);
  constructor(type, random, bb, dir) { super(type, random, bb, dir); this.hasSpawner = false; }
  extra() { return [this.hasSpawner]; }
  addComponentParts(world, _random, bb) {
    this.fills(world, bb, [[0,2,0,6,7,7,A],[1,0,0,5,1,7,B],[1,2,1,5,2,7,B],[1,3,2,5,3,7,B],[1,4,3,5,4,7,B],[1,2,0,1,4,2,B],[5,2,0,5,4,2,B],
      [1,5,2,1,5,3,B],[5,5,2,5,5,3,B],[0,5,3,0,5,8,B],[6,5,3,6,5,8,B],[1,5,8,5,5,8,B]]);
    this.put(world, F, 0, 1, 6, 3, bb);
    this.put(world, F, 0, 5, 6, 3, bb);
    this.fills(world, bb, [[0,6,3,0,6,8,F],[6,6,3,6,6,8,F],[1,6,8,5,7,8,F],[2,8,8,4,8,8,F]]);
    if (!this.hasSpawner) {
      const y = this.getYWithOffset(5), x = this.getXWithOffset(3, 5), z = this.getZWithOffset(3, 5);
      if (bb.isVecInside(x, y, z)) {
        this.hasSpawner = true;
        world.setBlock(x, y, z, MOB_SPAWNER, 0, 2);
        const spawner = world.getTileEntity(x, y, z);
        if (spawner) spawner.setEntityName("Blaze");
      }
    }
    this.foundation(world, bb, 0, 6, 0, 6);
    return true;
  }
}

// Crossing (atu, NeRC): room crossing.
export class FortressCrossing extends FortressPiece {
  static saveId = "NeRC";
  static create = factory(FortressCrossing, -2, 0, 0, 7, 9, 7);
  buildComponent(start, list, random) {
    this.nextNormal(start, list, random, 2, 0, false);
    this.nextX(start, list, random, 0, 2, false);
    this.nextZ(start, list, random, 0, 2, false);
  }
  addComponentParts(world, _random, bb) {
    this.fills(world, bb, [[0,0,0,6,1,6,B],[0,2,0,6,7,6,A],[0,2,0,1,6,0,B],[0,2,6,1,6,6,B],[5,2,0,6,6,0,B],[5,2,6,6,6,6,B],[0,2,0,0,6,1,B],
      [0,2,5,0,6,6,B],[6,2,0,6,6,1,B],[6,2,5,6,6,6,B],[2,6,0,4,6,0,B],[2,5,0,4,5,0,F],[2,6,6,4,6,6,B],[2,5,6,4,5,6,F],[0,6,2,0,6,4,B],
      [0,5,2,0,5,4,F],[6,6,2,6,6,4,B],[6,5,2,6,5,4,F]]);
    this.foundation(world, bb, 0, 6, 0, 6);
    return true;
  }
}

// Stairs (atv, NeSR): stairs room.
export class FortressStairs extends FortressPiece {
  static saveId = "NeSR";
  static create = factory(FortressStairs, -2, 0, 0, 7, 11, 7);
  buildComponent(start, list, random) { this.nextZ(start, list, random, 6, 2, false); }
  addComponentParts(world, _random, bb) {
    this.fills(world, bb, [[0,0,0,6,1,6,B],[0,2,0,6,10,6,A],[0,2,0,1,8,0,B],[5,2,0,6,8,0,B],[0,2,1,0,8,6,B],[6,2,1,6,8,6,B],[1,2,6,5,8,6,B],
      [0,3,2,0,5,4,F],[6,3,2,6,5,2,F],[6,3,4,6,5,4,F]]);
    this.put(world, B, 0, 5, 2, 5, bb);
    this.fills(world, bb, [[4,2,5,4,3,5,B],[3,2,5,3,4,5,B],[2,2,5,2,5,5,B],[1,2,5,1,6,5,B],[1,7,1,5,7,4,B],[6,8,2,6,8,4,A],[2,6,0,4,8,0,B],[2,5,0,4,5,0,F]]);
    this.foundation(world, bb, 0, 6, 0, 6);
    return true;
  }
}

// StructureNetherBridgePieces.a (primary) and .b (secondary) weight tables; each Start copies fresh counters.
const PRIMARY_WEIGHTS = () => [
  new PieceWeight(FortressStraight, 30, 0, true), new PieceWeight(FortressCrossing3, 10, 4), new PieceWeight(FortressCrossing, 10, 4),
  new PieceWeight(FortressStairs, 10, 3), new PieceWeight(FortressThrone, 5, 2), new PieceWeight(FortressEntrance, 5, 1),
];
const SECONDARY_WEIGHTS = () => [
  new PieceWeight(FortressCorridor5, 25, 0, true), new PieceWeight(FortressCrossing2, 15, 5), new PieceWeight(FortressCorridor2, 5, 10),
  new PieceWeight(FortressCorridor, 5, 10), new PieceWeight(FortressCorridor3, 10, 3, true), new PieceWeight(FortressCorridor4, 7, 2),
  new PieceWeight(FortressNetherStalkRoom, 5, 2),
];
export const fortressWeightTable = () => [PRIMARY_WEIGHTS(), SECONDARY_WEIGHTS()].map((l) => l.map((w) => [w.pieceClass.saveId, w.weight, w.instanceLimit, w.allowInRow]));

export const FORTRESS_PIECE_CLASSES = [
  FortressStart, FortressCrossing3, FortressEnd, FortressStraight, FortressCorridor3, FortressCorridor4, FortressEntrance, FortressCrossing2,
  FortressCorridor, FortressCorridor5, FortressCorridor2, FortressNetherStalkRoom, FortressThrone, FortressCrossing, FortressStairs,
];

// MapGenNetherBridge.Start (ate): the Start piece at chunk*16+2, then the pending pieces drained in random order, then a
// random height in 48..70.
export class NetherBridgeStart extends StructureStart {
  constructor(world, random, chunkX, chunkZ) {
    super(chunkX, chunkZ);
    const start = new FortressStart(random, (chunkX << 4) + 2, (chunkZ << 4) + 2);
    this.components.push(start);
    start.buildComponent(start, this.components, random);
    const pending = start.pendingPieces;
    while (pending.length) {
      const piece = pending.splice(random.nextInt(pending.length), 1)[0];
      piece.buildComponent(start, this.components, random);
    }
    this.updateBoundingBox();
    this.setRandomHeight(world, random, 48, 70);
  }
}

// MapGenNetherBridge (atd): one fortress start per 16x16 chunk region with probability 1/3, at a random chunk offset 4..11.
export class MapGenNetherBridge extends MapGenStructure {
  constructor(worldSeed) {
    super(worldSeed);
    this.spawnList = FORTRESS_SPAWN_LIST.map((r) => [...r]);
  }
  get structureName() { return "Fortress"; }
  canSpawnStructureAtCoords(chunkX, chunkZ) {
    const i = chunkX >> 4, j = chunkZ >> 4, r = this.random;
    r.setSeed(BigInt((i ^ (j << 4)) | 0) ^ this.worldSeed);
    r.nextInt();
    if (r.nextInt(3) !== 0) return false;
    if (chunkX !== (i << 4) + 4 + r.nextInt(8)) return false;
    return chunkZ === (j << 4) + 4 + r.nextInt(8);
  }
  getStructureStart(x, z) { return new NetherBridgeStart(null, this.random, x, z); }
  // atd.b(): the fortress monster spawn list.
  getSpawnList() { return this.spawnList; }
}

// ChunkProviderHell.getPossibleCreatures for monsters: inside a fortress piece the fortress list applies; on a nether brick
// block under any fortress start's XZ footprint (MapGenStructure.func_142038_b, first sizeable start only) it applies too.
// `blockAt(x,y,z)` is the world's block lookup; returns the fortress list or null (use the biome list).
export function fortressMonsterSpawnList(bridge, blockAt, x, y, z) {
  if (bridge.isInsideStructure(x, y, z)) return bridge.getSpawnList();
  if (bridge.hasStructureAtXZ(x, y, z) && blockAt(x, y - 1, z) === NETHER_BRICK) return bridge.getSpawnList();
  return null;
}

// MapGenStructure.func_151545_a (ave.a(World,x,y,z)): nearest fortress start piece position, for tests and the lead's tools.
export function nearestFortressStart(bridge, x, z) {
  let best = null, bestD = Infinity;
  for (const start of bridge.structureMap.values()) {
    const [px, py, pz] = start.components[0].getCenter();
    const d = (px - x) ** 2 + (py - 64) ** 2 + (pz - z) ** 2;
    if (d < bestD) { bestD = d; best = [px, py, pz]; }
  }
  return best;
}
