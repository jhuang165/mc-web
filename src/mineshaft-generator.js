// Minecraft Java 1.7.10 MapGenMineshaft (asw), StructureMineshaftStart (atc) and
// StructureMineshaftPieces (asx: Room ata, Corridor asy, Crossing asz, Stairs atb).
// Built on structure-framework.js; world adapter documented there. Corridor chests are
// EntityMinecartChest entities: world.spawnEntity({type:"MinecartChest", x, y, z, size:27,
// slots, setSlot}) after the rail is set. Spawners call setEntityName("CaveSpider").
// Standalone: not wired into ChunkProviderGenerate/java-world.js; no NBT save/load.
import {
  StructureBoundingBox, StructureComponent, StructureStart, MapGenStructure,
  generateChestContents, isAirMaterial, isOpaqueAtConstruction,
} from "./structure-framework.js";
import { dungeonEnchantedBook } from "./dungeon-generator.js";

const f = Math.fround;
const AIR = 0, DIRT = 3, PLANKS = 5, WEB = 30, FENCE = 85, RAIL = 66, TORCH = 50, MOB_SPAWNER = 52;

// [stack, min, max, weight, maxStackSize], extracted by MineshaftProbe from asx.a.
export const MINESHAFT_LOOT = [[[265,1,0,[]],1,5,10,64],[[266,1,0,[]],1,3,5,64],[[331,1,0,[]],4,9,5,64],[[351,1,4,[]],4,9,5,64],[[264,1,0,[]],1,2,3,64],[[263,1,0,[]],3,8,10,64],[[297,1,0,[]],1,3,15,64],[[257,1,0,[]],1,1,1,1],[[66,1,0,[]],4,8,1,64],[[362,1,0,[]],2,4,10,64],[[361,1,0,[]],2,4,10,64],[[329,1,0,[]],1,1,3,1],[[417,1,0,[]],1,1,1,1]];
// ItemEnchantedBook.func_92114_b: one level-30 book row (weight 1, max stack 1).
export const mineshaftLootWithBook = (random) => [...MINESHAFT_LOOT, [dungeonEnchantedBook(random), 1, 1, 1, 1]];

// StructureMineshaftPieces.getRandomComponent.
function randomComponent(list, random, x, y, z, mode, type) {
  const roll = random.nextInt(100);
  if (roll >= 80) {
    const bb = MineshaftCrossing.findValidPlacement(list, random, x, y, z, mode);
    if (bb) return new MineshaftCrossing(type, random, bb, mode);
  } else if (roll >= 70) {
    const bb = MineshaftStairs.findValidPlacement(list, random, x, y, z, mode);
    if (bb) return new MineshaftStairs(type, random, bb, mode);
  } else {
    const bb = MineshaftCorridor.findValidPlacement(list, random, x, y, z, mode);
    if (bb) return new MineshaftCorridor(type, random, bb, mode);
  }
  return null;
}
// getNextMineShaftComponent: depth 8 and 80-block limits from the start's (room's) min corner.
export function getNextMineShaftComponent(start, list, random, x, y, z, mode, type) {
  if (type > 8) return null;
  if (Math.abs(x - start.boundingBox.minX) > 80 || Math.abs(z - start.boundingBox.minZ) > 80) return null;
  const c = randomComponent(list, random, x, y, z, mode, type + 1);
  if (c) { list.push(c); c.buildComponent(start, list, random); }
  return c;
}

export class MineshaftRoom extends StructureComponent {
  static saveId = "MSRoom";
  constructor(type, random, x, z) {
    super(type);
    this.roomsLinkedToTheRoom = [];
    if (random) {
      const maxX = x + 7 + random.nextInt(6), maxY = 54 + random.nextInt(6), maxZ = z + 7 + random.nextInt(6);
      this.boundingBox = new StructureBoundingBox(x, 50, z, maxX, maxY, maxZ);
    }
  }
  buildComponent(start, list, random) {
    const type = this.componentType, b = this.boundingBox;
    let h = b.ySize - 3 - 1;
    if (h <= 0) h = 1;
    let n, c;
    for (n = 0; n < b.xSize && (n += random.nextInt(b.xSize)) + 3 <= b.xSize; n += 4) {
      c = getNextMineShaftComponent(start, list, random, b.minX + n, b.minY + random.nextInt(h) + 1, b.minZ - 1, 2, type);
      if (c) { const o = c.boundingBox; this.roomsLinkedToTheRoom.push(new StructureBoundingBox(o.minX, o.minY, b.minZ, o.maxX, o.maxY, b.minZ + 1)); }
    }
    for (n = 0; n < b.xSize && (n += random.nextInt(b.xSize)) + 3 <= b.xSize; n += 4) {
      c = getNextMineShaftComponent(start, list, random, b.minX + n, b.minY + random.nextInt(h) + 1, b.maxZ + 1, 0, type);
      if (c) { const o = c.boundingBox; this.roomsLinkedToTheRoom.push(new StructureBoundingBox(o.minX, o.minY, b.maxZ - 1, o.maxX, o.maxY, b.maxZ)); }
    }
    for (n = 0; n < b.zSize && (n += random.nextInt(b.zSize)) + 3 <= b.zSize; n += 4) {
      c = getNextMineShaftComponent(start, list, random, b.minX - 1, b.minY + random.nextInt(h) + 1, b.minZ + n, 1, type);
      if (c) { const o = c.boundingBox; this.roomsLinkedToTheRoom.push(new StructureBoundingBox(b.minX, o.minY, o.minZ, b.minX + 1, o.maxY, o.maxZ)); }
    }
    for (n = 0; n < b.zSize && (n += random.nextInt(b.zSize)) + 3 <= b.zSize; n += 4) {
      c = getNextMineShaftComponent(start, list, random, b.maxX + 1, b.minY + random.nextInt(h) + 1, b.minZ + n, 3, type);
      if (c) { const o = c.boundingBox; this.roomsLinkedToTheRoom.push(new StructureBoundingBox(b.maxX - 1, o.minY, o.minZ, b.maxX, o.maxY, o.maxZ)); }
    }
  }
  addComponentParts(world, random, bb) {
    if (this.isLiquidInStructureBoundingBox(world, bb)) return false;
    const b = this.boundingBox;
    this.fillWithBlocks(world, bb, b.minX, b.minY, b.minZ, b.maxX, b.minY, b.maxZ, DIRT, AIR, true);
    this.fillWithBlocks(world, bb, b.minX, b.minY + 1, b.minZ, b.maxX, Math.min(b.minY + 3, b.maxY), b.maxZ, AIR, AIR, false);
    for (const e of this.roomsLinkedToTheRoom)
      this.fillWithBlocks(world, bb, e.minX, e.maxY - 2, e.minZ, e.maxX, e.maxY, e.maxZ, AIR, AIR, false);
    this.randomlyRareFillWithBlocks(world, bb, b.minX, b.minY + 4, b.minZ, b.maxX, b.maxY, b.maxZ, AIR, false);
    return true;
  }
  describe() { return [MineshaftRoom.saveId, this.coordBaseMode, this.componentType, ...this.boundingBox.toArray(), this.roomsLinkedToTheRoom.map((e) => e.toArray())]; }
}

export class MineshaftCorridor extends StructureComponent {
  static saveId = "MSCorridor";
  constructor(type, random, bb, mode) {
    super(type);
    this.coordBaseMode = mode;
    this.boundingBox = bb;
    this.hasRails = random.nextInt(3) === 0;
    this.hasSpiders = !this.hasRails && random.nextInt(23) === 0;
    this.spawnerPlaced = false;
    this.sectionCount = mode === 2 || mode === 0 ? Math.trunc(bb.zSize / 5) : Math.trunc(bb.xSize / 5);
  }
  static findValidPlacement(list, random, x, y, z, mode) {
    const bb = new StructureBoundingBox(x, y, z, x, y + 2, z);
    let n;
    for (n = random.nextInt(3) + 2; n > 0; n--) {
      const len = n * 5;
      switch (mode) {
        case 2: bb.maxX = x + 2; bb.minZ = z - (len - 1); break;
        case 0: bb.maxX = x + 2; bb.maxZ = z + (len - 1); break;
        case 1: bb.minX = x - (len - 1); bb.maxZ = z + 2; break;
        case 3: bb.maxX = x + (len - 1); bb.maxZ = z + 2; break;
      }
      if (StructureComponent.findIntersecting(list, bb) === null) break;
    }
    return n > 0 ? bb : null;
  }
  buildComponent(start, list, random) {
    const type = this.componentType, b = this.boundingBox, mode = this.coordBaseMode, roll = random.nextInt(4);
    const next = (x, z, m) => getNextMineShaftComponent(start, list, random, x, b.minY - 1 + random.nextInt(3), z, m, type);
    switch (mode) {
      case 2:
        if (roll <= 1) next(b.minX, b.minZ - 1, mode);
        else if (roll === 2) next(b.minX - 1, b.minZ, 1);
        else next(b.maxX + 1, b.minZ, 3);
        break;
      case 0:
        if (roll <= 1) next(b.minX, b.maxZ + 1, mode);
        else if (roll === 2) next(b.minX - 1, b.maxZ - 3, 1);
        else next(b.maxX + 1, b.maxZ - 3, 3);
        break;
      case 1:
        if (roll <= 1) next(b.minX - 1, b.minZ, mode);
        else if (roll === 2) next(b.minX, b.minZ - 1, 2);
        else next(b.minX, b.maxZ + 1, 0);
        break;
      case 3:
        if (roll <= 1) next(b.maxX + 1, b.minZ, mode);
        else if (roll === 2) next(b.maxX - 3, b.minZ - 1, 2);
        else next(b.maxX - 3, b.maxZ + 1, 0);
        break;
    }
    if (type >= 8) return;
    if (mode === 2 || mode === 0) {
      for (let z = b.minZ + 3; z + 3 <= b.maxZ; z += 5) {
        const r = random.nextInt(5);
        if (r === 0) getNextMineShaftComponent(start, list, random, b.minX - 1, b.minY, z, 1, type + 1);
        else if (r === 1) getNextMineShaftComponent(start, list, random, b.maxX + 1, b.minY, z, 3, type + 1);
      }
    } else {
      for (let x = b.minX + 3; x + 3 <= b.maxX; x += 5) {
        const r = random.nextInt(5);
        if (r === 0) getNextMineShaftComponent(start, list, random, x, b.minY, b.minZ - 1, 2, type + 1);
        else if (r === 1) getNextMineShaftComponent(start, list, random, x, b.minY, b.maxZ + 1, 0, type + 1);
      }
    }
  }
  // Corridor override: a rail and an EntityMinecartChest instead of a chest block.
  generateStructureChestContents(world, bb, random, x, y, z, rows, count) {
    const wx = this.getXWithOffset(x, z), wy = this.getYWithOffset(y), wz = this.getZWithOffset(x, z);
    if (bb.isVecInside(wx, wy, wz) && isAirMaterial(world.getBlock(wx, wy, wz))) {
      const shape = random.nextBoolean() ? 1 : 0;
      world.setBlock(wx, wy, wz, RAIL, this.getMetadataWithOffset(RAIL, shape), 2);
      const cart = { type: "MinecartChest", x: f(f(wx) + 0.5), y: f(f(wy) + 0.5), z: f(f(wz) + 0.5), size: 27, slots: Array(27).fill(null) };
      cart.setSlot = (i, stack) => { cart.slots[i] = stack; };
      generateChestContents(random, rows, cart, count);
      world.spawnEntity(cart);
      return true;
    }
    return false;
  }
  addComponentParts(world, random, bb) {
    if (this.isLiquidInStructureBoundingBox(world, bb)) return false;
    const len = this.sectionCount * 5 - 1;
    this.fillWithBlocks(world, bb, 0, 0, 0, 2, 1, len, AIR, AIR, false);
    this.randomlyFillWithBlocks(world, bb, random, 0.8, 0, 2, 0, 2, 2, len, AIR, AIR, false);
    if (this.hasSpiders) this.randomlyFillWithBlocks(world, bb, random, 0.6, 0, 0, 0, 2, 1, len, WEB, AIR, false);
    for (let i = 0; i < this.sectionCount; i++) {
      const z = 2 + i * 5;
      this.fillWithBlocks(world, bb, 0, 0, z, 0, 1, z, FENCE, AIR, false);
      this.fillWithBlocks(world, bb, 2, 0, z, 2, 1, z, FENCE, AIR, false);
      if (random.nextInt(4) === 0) {
        this.fillWithBlocks(world, bb, 0, 2, z, 0, 2, z, PLANKS, AIR, false);
        this.fillWithBlocks(world, bb, 2, 2, z, 2, 2, z, PLANKS, AIR, false);
      } else this.fillWithBlocks(world, bb, 0, 2, z, 2, 2, z, PLANKS, AIR, false);
      this.randomlyPlaceBlock(world, bb, random, 0.1, 0, 2, z - 1, WEB, 0);
      this.randomlyPlaceBlock(world, bb, random, 0.1, 2, 2, z - 1, WEB, 0);
      this.randomlyPlaceBlock(world, bb, random, 0.1, 0, 2, z + 1, WEB, 0);
      this.randomlyPlaceBlock(world, bb, random, 0.1, 2, 2, z + 1, WEB, 0);
      this.randomlyPlaceBlock(world, bb, random, 0.05, 0, 2, z - 2, WEB, 0);
      this.randomlyPlaceBlock(world, bb, random, 0.05, 2, 2, z - 2, WEB, 0);
      this.randomlyPlaceBlock(world, bb, random, 0.05, 0, 2, z + 2, WEB, 0);
      this.randomlyPlaceBlock(world, bb, random, 0.05, 2, 2, z + 2, WEB, 0);
      this.randomlyPlaceBlock(world, bb, random, 0.05, 1, 2, z - 1, TORCH, 0);
      this.randomlyPlaceBlock(world, bb, random, 0.05, 1, 2, z + 1, TORCH, 0);
      // Java argument order: the enchanted book is drawn before the item count.
      if (random.nextInt(100) === 0) { const rows = mineshaftLootWithBook(random); this.generateStructureChestContents(world, bb, random, 2, 0, z - 1, rows, 3 + random.nextInt(4)); }
      if (random.nextInt(100) === 0) { const rows = mineshaftLootWithBook(random); this.generateStructureChestContents(world, bb, random, 0, 0, z + 1, rows, 3 + random.nextInt(4)); }
      if (!this.hasSpiders || this.spawnerPlaced) continue;
      const sy = this.getYWithOffset(0), lz = z - 1 + random.nextInt(3);
      const sx = this.getXWithOffset(1, lz), sz = this.getZWithOffset(1, lz);
      if (!bb.isVecInside(sx, sy, sz)) continue;
      this.spawnerPlaced = true;
      world.setBlock(sx, sy, sz, MOB_SPAWNER, 0, 2);
      const spawner = world.getTileEntity(sx, sy, sz);
      if (spawner) spawner.setEntityName("CaveSpider");
    }
    for (let x = 0; x <= 2; x++) for (let z = 0; z <= len; z++)
      if (isAirMaterial(this.getBlockAtCurrentPosition(world, x, -1, z, bb))) this.placeBlockAtCurrentPosition(world, PLANKS, 0, x, -1, z, bb);
    if (this.hasRails) for (let z = 0; z <= len; z++) {
      const below = this.getBlockAtCurrentPosition(world, 1, -1, z, bb);
      if (isAirMaterial(below) || !isOpaqueAtConstruction(below)) continue;
      this.randomlyPlaceBlock(world, bb, random, 0.7, 1, 0, z, RAIL, this.getMetadataWithOffset(RAIL, 0));
    }
    return true;
  }
  describe() { return [MineshaftCorridor.saveId, this.coordBaseMode, this.componentType, ...this.boundingBox.toArray(), this.hasRails, this.hasSpiders, this.spawnerPlaced, this.sectionCount]; }
}

export class MineshaftCrossing extends StructureComponent {
  static saveId = "MSCrossing";
  constructor(type, random, bb, direction) {
    super(type);
    this.corridorDirection = direction;
    this.boundingBox = bb;
    this.isMultipleFloors = bb.ySize > 3;
  }
  static findValidPlacement(list, random, x, y, z, mode) {
    const bb = new StructureBoundingBox(x, y, z, x, y + 2, z);
    if (random.nextInt(4) === 0) bb.maxY += 4;
    switch (mode) {
      case 2: bb.minX = x - 1; bb.maxX = x + 3; bb.minZ = z - 4; break;
      case 0: bb.minX = x - 1; bb.maxX = x + 3; bb.maxZ = z + 4; break;
      case 1: bb.minX = x - 4; bb.minZ = z - 1; bb.maxZ = z + 3; break;
      case 3: bb.maxX = x + 4; bb.minZ = z - 1; bb.maxZ = z + 3; break;
    }
    return StructureComponent.findIntersecting(list, bb) !== null ? null : bb;
  }
  buildComponent(start, list, random) {
    const type = this.componentType, b = this.boundingBox;
    const next = (x, y, z, m) => getNextMineShaftComponent(start, list, random, x, y, z, m, type);
    switch (this.corridorDirection) {
      case 2: next(b.minX + 1, b.minY, b.minZ - 1, 2); next(b.minX - 1, b.minY, b.minZ + 1, 1); next(b.maxX + 1, b.minY, b.minZ + 1, 3); break;
      case 0: next(b.minX + 1, b.minY, b.maxZ + 1, 0); next(b.minX - 1, b.minY, b.minZ + 1, 1); next(b.maxX + 1, b.minY, b.minZ + 1, 3); break;
      case 1: next(b.minX + 1, b.minY, b.minZ - 1, 2); next(b.minX + 1, b.minY, b.maxZ + 1, 0); next(b.minX - 1, b.minY, b.minZ + 1, 1); break;
      case 3: next(b.minX + 1, b.minY, b.minZ - 1, 2); next(b.minX + 1, b.minY, b.maxZ + 1, 0); next(b.maxX + 1, b.minY, b.minZ + 1, 3); break;
    }
    if (this.isMultipleFloors) {
      if (random.nextBoolean()) next(b.minX + 1, b.minY + 3 + 1, b.minZ - 1, 2);
      if (random.nextBoolean()) next(b.minX - 1, b.minY + 3 + 1, b.minZ + 1, 1);
      if (random.nextBoolean()) next(b.maxX + 1, b.minY + 3 + 1, b.minZ + 1, 3);
      if (random.nextBoolean()) next(b.minX + 1, b.minY + 3 + 1, b.maxZ + 1, 0);
    }
  }
  addComponentParts(world, random, bb) {
    if (this.isLiquidInStructureBoundingBox(world, bb)) return false;
    const b = this.boundingBox;
    if (this.isMultipleFloors) {
      this.fillWithBlocks(world, bb, b.minX + 1, b.minY, b.minZ, b.maxX - 1, b.minY + 3 - 1, b.maxZ, AIR, AIR, false);
      this.fillWithBlocks(world, bb, b.minX, b.minY, b.minZ + 1, b.maxX, b.minY + 3 - 1, b.maxZ - 1, AIR, AIR, false);
      this.fillWithBlocks(world, bb, b.minX + 1, b.maxY - 2, b.minZ, b.maxX - 1, b.maxY, b.maxZ, AIR, AIR, false);
      this.fillWithBlocks(world, bb, b.minX, b.maxY - 2, b.minZ + 1, b.maxX, b.maxY, b.maxZ - 1, AIR, AIR, false);
      this.fillWithBlocks(world, bb, b.minX + 1, b.minY + 3, b.minZ + 1, b.maxX - 1, b.minY + 3, b.maxZ - 1, AIR, AIR, false);
    } else {
      this.fillWithBlocks(world, bb, b.minX + 1, b.minY, b.minZ, b.maxX - 1, b.maxY, b.maxZ, AIR, AIR, false);
      this.fillWithBlocks(world, bb, b.minX, b.minY, b.minZ + 1, b.maxX, b.maxY, b.maxZ - 1, AIR, AIR, false);
    }
    this.fillWithBlocks(world, bb, b.minX + 1, b.minY, b.minZ + 1, b.minX + 1, b.maxY, b.minZ + 1, PLANKS, AIR, false);
    this.fillWithBlocks(world, bb, b.minX + 1, b.minY, b.maxZ - 1, b.minX + 1, b.maxY, b.maxZ - 1, PLANKS, AIR, false);
    this.fillWithBlocks(world, bb, b.maxX - 1, b.minY, b.minZ + 1, b.maxX - 1, b.maxY, b.minZ + 1, PLANKS, AIR, false);
    this.fillWithBlocks(world, bb, b.maxX - 1, b.minY, b.maxZ - 1, b.maxX - 1, b.maxY, b.maxZ - 1, PLANKS, AIR, false);
    for (let x = b.minX; x <= b.maxX; x++) for (let z = b.minZ; z <= b.maxZ; z++)
      if (isAirMaterial(this.getBlockAtCurrentPosition(world, x, b.minY - 1, z, bb))) this.placeBlockAtCurrentPosition(world, PLANKS, 0, x, b.minY - 1, z, bb);
    return true;
  }
  describe() { return [MineshaftCrossing.saveId, this.coordBaseMode, this.componentType, ...this.boundingBox.toArray(), this.corridorDirection, this.isMultipleFloors]; }
}

export class MineshaftStairs extends StructureComponent {
  static saveId = "MSStairs";
  constructor(type, _random, bb, mode) {
    super(type);
    this.coordBaseMode = mode;
    this.boundingBox = bb;
  }
  static findValidPlacement(list, random, x, y, z, mode) {
    const bb = new StructureBoundingBox(x, y - 5, z, x, y + 2, z);
    switch (mode) {
      case 2: bb.maxX = x + 2; bb.minZ = z - 8; break;
      case 0: bb.maxX = x + 2; bb.maxZ = z + 8; break;
      case 1: bb.minX = x - 8; bb.maxZ = z + 2; break;
      case 3: bb.maxX = x + 8; bb.maxZ = z + 2; break;
    }
    return StructureComponent.findIntersecting(list, bb) !== null ? null : bb;
  }
  buildComponent(start, list, random) {
    const type = this.componentType, b = this.boundingBox;
    switch (this.coordBaseMode) {
      case 2: getNextMineShaftComponent(start, list, random, b.minX, b.minY, b.minZ - 1, 2, type); break;
      case 0: getNextMineShaftComponent(start, list, random, b.minX, b.minY, b.maxZ + 1, 0, type); break;
      case 1: getNextMineShaftComponent(start, list, random, b.minX - 1, b.minY, b.minZ, 1, type); break;
      case 3: getNextMineShaftComponent(start, list, random, b.maxX + 1, b.minY, b.minZ, 3, type); break;
    }
  }
  addComponentParts(world, random, bb) {
    if (this.isLiquidInStructureBoundingBox(world, bb)) return false;
    this.fillWithBlocks(world, bb, 0, 5, 0, 2, 7, 1, AIR, AIR, false);
    this.fillWithBlocks(world, bb, 0, 0, 7, 2, 2, 8, AIR, AIR, false);
    for (let i = 0; i < 5; i++) this.fillWithBlocks(world, bb, 0, 5 - i - (i < 4 ? 1 : 0), 2 + i, 2, 7 - i, 2 + i, AIR, AIR, false);
    return true;
  }
  describe() { return [MineshaftStairs.saveId, this.coordBaseMode, this.componentType, ...this.boundingBox.toArray()]; }
}

export class StructureMineshaftStart extends StructureStart {
  constructor(world, random, chunkX, chunkZ) {
    super(chunkX, chunkZ);
    const room = new MineshaftRoom(0, random, (chunkX << 4) + 2, (chunkZ << 4) + 2);
    this.components.push(room);
    room.buildComponent(room, this.components, random);
    this.updateBoundingBox();
    this.markAvailableHeight(world, random, 10);
  }
}

export const MINESHAFT_CHANCE = 0.004;
export class MapGenMineshaft extends MapGenStructure {
  constructor(worldSeed, chance = MINESHAFT_CHANCE) {
    super(worldSeed);
    this.chance = chance;
  }
  get structureName() { return "Mineshaft"; }
  canSpawnStructureAtCoords(x, z) {
    return this.random.nextDouble() < this.chance && this.random.nextInt(80) < Math.max(Math.abs(x), Math.abs(z));
  }
  getStructureStart(x, z) { return new StructureMineshaftStart(null, this.random, x, z); }
}
