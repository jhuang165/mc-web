// Minecraft Java 1.7.10 structure framework: StructureBoundingBox (asv),
// StructureComponent (avk), StructureStart (avm), MapGenBase's range-8 seeding
// (aqx) and MapGenStructure (ave), plus WeightedRandomChestContent (qx).
// Standalone: no live World, chunk or NBT integration. Original numeric IDs.
//
// World adapter (all coordinates absolute, original IDs):
//   getBlock(x,y,z) -> id, setBlock(x,y,z,id,meta,flags), isAirBlock(x,y,z),
//   getTileEntity(x,y,z) -> chest {size, setSlot(i, stack)} / spawner
//   {setEntityName(name)} / undefined, spawnEntity(entity).
// Block properties come from the tables below, which MineshaftProbe checks
// against the unchanged Block/Material classes for every ID 0..255.
// Stack representation: [itemId,count,metadata,[[storedEnchantmentId,level],...]].
import { JavaRandom } from "./java-random.js";

const f = Math.fround;
export const AIR = 0, STONE_STAIRS = 67, OAK_STAIRS = 53, RAIL = 66, WOODEN_DOOR = 64,
  IRON_DOOR = 71, LADDER = 65, STONE_BUTTON = 77, TRIPWIRE_HOOK = 131, PISTON = 33,
  STICKY_PISTON = 29, LEVER = 69, DISPENSER = 23, CHEST = 54, NETHER_BRICK_STAIRS = 114,
  STONE_BRICK_STAIRS = 109, SANDSTONE_STAIRS = 128;

// Material.air: air and every unregistered ID (Block.getBlockById falls back to air).
export const isAirMaterial = (id) => id === 0 || (id >= 165 && id <= 169) || id >= 176;
// Material.isLiquid: flowing/still water and lava.
export const isLiquid = (id) => id >= 8 && id <= 11;
// Block.func_149730_j (the opaque flag fixed at construction).
const NOT_OPAQUE = new Set([0,6,8,9,10,11,20,26,27,28,29,30,31,32,33,34,36,37,38,39,40,44,50,51,52,53,54,55,59,60,63,64,65,66,67,68,69,70,71,72,75,76,77,78,79,81,83,85,90,92,93,94,95,96,101,102,104,105,106,107,108,109,111,113,114,115,116,117,118,119,120,122,126,127,128,130,131,132,134,135,136,138,139,140,141,142,143,144,145,146,147,148,149,150,151,154,156,157,160,163,164,165,166,167,168,169,171,175]);
export const isOpaqueAtConstruction = (id) => id < 176 && !NOT_OPAQUE.has(id);
// BlockDirectional subclasses (beds, fence gates, pumpkins, diodes, cocoa, end portal frame...).
const DIRECTIONAL = new Set([26,86,91,93,94,107,127,149,150]);
export const isBlockDirectional = (id) => DIRECTIONAL.has(id);
export const DIRECTION_ROTATE_OPPOSITE = [2,3,0,1]; // Direction.rotateOpposite (p.f)
export const FACING_OPPOSITE = [1,0,3,2,5,4]; // Facing.oppositeSide (q.a)

export const randomLong = (r) => BigInt.asIntN(64, (BigInt(r.next(32)) << 32n) + BigInt(r.next(32)));

export class StructureBoundingBox {
  constructor(minX = 0, minY = 0, minZ = 0, maxX = 0, maxY = 0, maxZ = 0) {
    this.minX = minX; this.minY = minY; this.minZ = minZ;
    this.maxX = maxX; this.maxY = maxY; this.maxZ = maxZ;
  }
  static empty() { return new StructureBoundingBox(2147483647,2147483647,2147483647,-2147483648,-2147483648,-2147483648); }
  // asv(int,int,int,int): a chunk-population box spanning Y 1..512.
  static xz(minX, minZ, maxX, maxZ) { return new StructureBoundingBox(minX,1,minZ,maxX,512,maxZ); }
  static fromArray(a) { return new StructureBoundingBox(...a); }
  // getComponentToAddBoundingBox: anchor, offset, size and coordBaseMode.
  static componentBox(x, y, z, ox, oy, oz, w, h, d, mode) {
    switch (mode) {
      case 2: return new StructureBoundingBox(x+ox, y+oy, z-d+1+oz, x+w-1+ox, y+h-1+oy, z+oz);
      case 1: return new StructureBoundingBox(x-d+1+oz, y+oy, z+ox, x+oz, y+h-1+oy, z+w-1+ox);
      case 3: return new StructureBoundingBox(x+oz, y+oy, z+ox, x+d-1+oz, y+h-1+oy, z+w-1+ox);
      default: return new StructureBoundingBox(x+ox, y+oy, z+oz, x+w-1+ox, y+h-1+oy, z+d-1+oz);
    }
  }
  copy() { return new StructureBoundingBox(this.minX,this.minY,this.minZ,this.maxX,this.maxY,this.maxZ); }
  toArray() { return [this.minX,this.minY,this.minZ,this.maxX,this.maxY,this.maxZ]; }
  intersectsWith(b) {
    return this.maxX >= b.minX && this.minX <= b.maxX && this.maxZ >= b.minZ && this.minZ <= b.maxZ && this.maxY >= b.minY && this.minY <= b.maxY;
  }
  intersectsWithXZ(minX, minZ, maxX, maxZ) { return this.maxX >= minX && this.minX <= maxX && this.maxZ >= minZ && this.minZ <= maxZ; }
  expandTo(b) {
    this.minX = Math.min(this.minX,b.minX); this.minY = Math.min(this.minY,b.minY); this.minZ = Math.min(this.minZ,b.minZ);
    this.maxX = Math.max(this.maxX,b.maxX); this.maxY = Math.max(this.maxY,b.maxY); this.maxZ = Math.max(this.maxZ,b.maxZ);
  }
  offset(dx, dy, dz) {
    this.minX = (this.minX+dx)|0; this.minY = (this.minY+dy)|0; this.minZ = (this.minZ+dz)|0;
    this.maxX = (this.maxX+dx)|0; this.maxY = (this.maxY+dy)|0; this.maxZ = (this.maxZ+dz)|0;
  }
  isVecInside(x, y, z) { return x >= this.minX && x <= this.maxX && z >= this.minZ && z <= this.maxZ && y >= this.minY && y <= this.maxY; }
  get xSize() { return (this.maxX - this.minX + 1)|0; }
  get ySize() { return (this.maxY - this.minY + 1)|0; }
  get zSize() { return (this.maxZ - this.minZ + 1)|0; }
  get centerX() { return this.minX + Math.trunc((this.maxX - this.minX + 1) / 2); }
  get centerY() { return this.minY + Math.trunc((this.maxY - this.minY + 1) / 2); }
  get centerZ() { return this.minZ + Math.trunc((this.maxZ - this.minZ + 1) / 2); }
}

// WeightedRandom.getRandomItem over [stack,min,max,weight,maxStackSize] rows.
export function weightedRow(random, rows) {
  let total = 0;
  for (const r of rows) total += r[3];
  if (total <= 0) throw new Error("IllegalArgumentException");
  let n = random.nextInt(total);
  for (const r of rows) { n -= r[3]; if (n < 0) return r; }
  return null;
}
// WeightedRandomChestContent.generateChestContents (IInventory overload).
export function generateChestContents(random, rows, inventory, count) {
  for (let i = 0; i < count; i++) {
    const [stack, min, max, , maxStack] = weightedRow(random, rows);
    const n = min + random.nextInt(max - min + 1);
    const copy = (size) => [stack[0], size, stack[2], stack[3].map((e) => [...e])];
    if (maxStack >= n) inventory.setSlot(random.nextInt(inventory.size), copy(n));
    else for (let j = 0; j < n; j++) inventory.setSlot(random.nextInt(inventory.size), copy(1));
  }
}

export class StructureComponent {
  constructor(componentType = 0) {
    this.componentType = componentType;
    this.coordBaseMode = -1;
    this.boundingBox = null;
  }
  get typeName() { return this.constructor.saveId; }
  buildComponent(_start, _list, _random) {}
  addComponentParts(_world, _random, _bb) { throw new Error("abstract"); }
  static findIntersecting(list, bb) {
    for (const c of list) if (c.boundingBox && c.boundingBox.intersectsWith(bb)) return c;
    return null;
  }
  getCenter() { return [this.boundingBox.centerX, this.boundingBox.centerY, this.boundingBox.centerZ]; }
  // Any liquid on the six faces of the box grown by one, clipped to bb.
  isLiquidInStructureBoundingBox(world, bb) {
    const b = this.boundingBox;
    const x0 = Math.max(b.minX-1, bb.minX), y0 = Math.max(b.minY-1, bb.minY), z0 = Math.max(b.minZ-1, bb.minZ);
    const x1 = Math.min(b.maxX+1, bb.maxX), y1 = Math.min(b.maxY+1, bb.maxY), z1 = Math.min(b.maxZ+1, bb.maxZ);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (isLiquid(world.getBlock(x,y0,z))) return true;
      if (isLiquid(world.getBlock(x,y1,z))) return true;
    }
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      if (isLiquid(world.getBlock(x,y,z0))) return true;
      if (isLiquid(world.getBlock(x,y,z1))) return true;
    }
    for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) {
      if (isLiquid(world.getBlock(x0,y,z))) return true;
      if (isLiquid(world.getBlock(x1,y,z))) return true;
    }
    return false;
  }
  getXWithOffset(x, z) {
    switch (this.coordBaseMode) {
      case 0: case 2: return this.boundingBox.minX + x;
      case 1: return this.boundingBox.maxX - z;
      case 3: return this.boundingBox.minX + z;
      default: return x;
    }
  }
  getYWithOffset(y) { return this.coordBaseMode === -1 ? y : y + this.boundingBox.minY; }
  getZWithOffset(x, z) {
    switch (this.coordBaseMode) {
      case 2: return this.boundingBox.maxZ - z;
      case 0: return this.boundingBox.minZ + z;
      case 1: case 3: return this.boundingBox.minZ + x;
      default: return z;
    }
  }
  getMetadataWithOffset(id, meta) {
    const mode = this.coordBaseMode;
    if (id === RAIL) {
      if (mode === 1 || mode === 3) return meta === 1 ? 0 : 1;
    } else if (id === WOODEN_DOOR || id === IRON_DOOR) {
      if (mode === 0) { if (meta === 0) return 2; if (meta === 2) return 0; }
      else if (mode === 1) return (meta + 1) & 3;
      else if (mode === 3) return (meta + 3) & 3;
    } else if (id === STONE_STAIRS || id === OAK_STAIRS || id === NETHER_BRICK_STAIRS || id === STONE_BRICK_STAIRS || id === SANDSTONE_STAIRS) {
      if (mode === 0) { if (meta === 2) return 3; if (meta === 3) return 2; }
      else if (mode === 1) { if (meta === 0) return 2; if (meta === 1) return 3; if (meta === 2) return 0; if (meta === 3) return 1; }
      else if (mode === 3) { if (meta === 0) return 2; if (meta === 1) return 3; if (meta === 2) return 1; if (meta === 3) return 0; }
    } else if (id === LADDER) {
      if (mode === 0) { if (meta === 2) return 3; if (meta === 3) return 2; }
      else if (mode === 1) { if (meta === 2) return 4; if (meta === 3) return 5; if (meta === 4) return 2; if (meta === 5) return 3; }
      else if (mode === 3) { if (meta === 2) return 5; if (meta === 3) return 4; if (meta === 4) return 2; if (meta === 5) return 3; }
    } else if (id === STONE_BUTTON) {
      if (mode === 0) { if (meta === 3) return 4; if (meta === 4) return 3; }
      else if (mode === 1) { if (meta === 3) return 1; if (meta === 4) return 2; if (meta === 2) return 3; if (meta === 1) return 4; }
      else if (mode === 3) { if (meta === 3) return 2; if (meta === 4) return 1; if (meta === 2) return 3; if (meta === 1) return 4; }
    } else if (id === TRIPWIRE_HOOK || isBlockDirectional(id)) {
      if (mode === 0) { if (meta === 0 || meta === 2) return DIRECTION_ROTATE_OPPOSITE[meta]; }
      else if (mode === 1) { if (meta === 2) return 1; if (meta === 0) return 3; if (meta === 1) return 2; if (meta === 3) return 0; }
      else if (mode === 3) { if (meta === 2) return 3; if (meta === 0) return 1; if (meta === 1) return 2; if (meta === 3) return 0; }
    } else if (id === PISTON || id === STICKY_PISTON || id === LEVER || id === DISPENSER) {
      if (mode === 0) { if (meta === 2 || meta === 3) return FACING_OPPOSITE[meta]; }
      else if (mode === 1) { if (meta === 2) return 4; if (meta === 3) return 5; if (meta === 4) return 2; if (meta === 5) return 3; }
      else if (mode === 3) { if (meta === 2) return 5; if (meta === 3) return 4; if (meta === 4) return 2; if (meta === 5) return 3; }
    }
    return meta;
  }
  placeBlockAtCurrentPosition(world, id, meta, x, y, z, bb) {
    const wx = this.getXWithOffset(x,z), wy = this.getYWithOffset(y), wz = this.getZWithOffset(x,z);
    if (bb.isVecInside(wx,wy,wz)) world.setBlock(wx,wy,wz,id,meta,2);
  }
  getBlockAtCurrentPosition(world, x, y, z, bb) {
    const wx = this.getXWithOffset(x,z), wy = this.getYWithOffset(y), wz = this.getZWithOffset(x,z);
    return bb.isVecInside(wx,wy,wz) ? world.getBlock(wx,wy,wz) : AIR;
  }
  fillWithAir(world, bb, x0, y0, z0, x1, y1, z1) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++)
      this.placeBlockAtCurrentPosition(world, AIR, 0, x, y, z, bb);
  }
  // fillWithBlocks / fillWithMetadataBlocks. skipAir leaves positions whose block is Material.air.
  fillWithBlocks(world, bb, x0, y0, z0, x1, y1, z1, edge, inside, skipAir, edgeMeta = 0, insideMeta = 0) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (skipAir && isAirMaterial(this.getBlockAtCurrentPosition(world,x,y,z,bb))) continue;
      if (y === y0 || y === y1 || x === x0 || x === x1 || z === z0 || z === z1) this.placeBlockAtCurrentPosition(world,edge,edgeMeta,x,y,z,bb);
      else this.placeBlockAtCurrentPosition(world,inside,insideMeta,x,y,z,bb);
    }
  }
  // fillWithRandomizedBlocks; selector.select(random,x,y,z,edge) -> [id, meta].
  fillWithRandomizedBlocks(world, bb, x0, y0, z0, x1, y1, z1, skipAir, random, selector) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (skipAir && isAirMaterial(this.getBlockAtCurrentPosition(world,x,y,z,bb))) continue;
      const [id, meta] = selector.select(random,x,y,z,y === y0 || y === y1 || x === x0 || x === x1 || z === z0 || z === z1);
      this.placeBlockAtCurrentPosition(world,id,meta,x,y,z,bb);
    }
  }
  // func_74880_a: nextFloat is drawn for every position before the air test.
  randomlyFillWithBlocks(world, bb, random, chance, x0, y0, z0, x1, y1, z1, edge, inside, skipAir) {
    const c = f(chance);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (random.nextFloat() > c || (skipAir && isAirMaterial(this.getBlockAtCurrentPosition(world,x,y,z,bb)))) continue;
      if (y === y0 || y === y1 || x === x0 || x === x1 || z === z0 || z === z1) this.placeBlockAtCurrentPosition(world,edge,0,x,y,z,bb);
      else this.placeBlockAtCurrentPosition(world,inside,0,x,y,z,bb);
    }
  }
  randomlyPlaceBlock(world, bb, random, chance, x, y, z, id, meta) {
    if (random.nextFloat() < f(chance)) this.placeBlockAtCurrentPosition(world,id,meta,x,y,z,bb);
  }
  // randomlyRareFillWithBlocks: float ellipsoid (dome) fill.
  randomlyRareFillWithBlocks(world, bb, x0, y0, z0, x1, y1, z1, id, skipAir) {
    const sx = f(x1-x0+1), sy = f(y1-y0+1), sz = f(z1-z0+1);
    const cx = f(f(x0) + f(sx/2)), cz = f(f(z0) + f(sz/2)), hx = f(sx*f(0.5)), hz = f(sz*f(0.5)), limit = f(1.05);
    for (let y = y0; y <= y1; y++) {
      const dy = f(f(y-y0)/sy);
      for (let x = x0; x <= x1; x++) {
        const dx = f(f(f(x)-cx)/hx);
        for (let z = z0; z <= z1; z++) {
          const dz = f(f(f(z)-cz)/hz);
          if (skipAir && isAirMaterial(this.getBlockAtCurrentPosition(world,x,y,z,bb))) continue;
          if (!(f(f(f(dx*dx)+f(dy*dy))+f(dz*dz)) <= limit)) continue;
          this.placeBlockAtCurrentPosition(world,id,0,x,y,z,bb);
        }
      }
    }
  }
  clearCurrentPositionBlocksUpwards(world, x, y, z, bb) {
    const wx = this.getXWithOffset(x,z); let wy = this.getYWithOffset(y); const wz = this.getZWithOffset(x,z);
    if (!bb.isVecInside(wx,wy,wz)) return;
    while (!world.isAirBlock(wx,wy,wz) && wy < 255) { world.setBlock(wx,wy,wz,AIR,0,2); wy++; }
  }
  // func_151554_b: replace air/liquid downwards to Y 2.
  fillCurrentPositionBlocksDownwards(world, id, meta, x, y, z, bb) {
    const wx = this.getXWithOffset(x,z); let wy = this.getYWithOffset(y); const wz = this.getZWithOffset(x,z);
    if (!bb.isVecInside(wx,wy,wz)) return;
    while ((world.isAirBlock(wx,wy,wz) || isLiquid(world.getBlock(wx,wy,wz))) && wy > 1) { world.setBlock(wx,wy,wz,id,meta,2); wy--; }
  }
  // Chest block plus loot; the tile may be missing.
  generateStructureChestContents(world, bb, random, x, y, z, rows, count) {
    const wx = this.getXWithOffset(x,z), wy = this.getYWithOffset(y), wz = this.getZWithOffset(x,z);
    if (bb.isVecInside(wx,wy,wz) && world.getBlock(wx,wy,wz) !== CHEST) {
      world.setBlock(wx,wy,wz,CHEST,0,2);
      const chest = world.getTileEntity(wx,wy,wz);
      if (chest) generateChestContents(random, rows, chest, count);
      return true;
    }
    return false;
  }
}

export class StructureStart {
  constructor(chunkX = 0, chunkZ = 0) {
    this.chunkX = chunkX; this.chunkZ = chunkZ;
    this.components = [];
    this.boundingBox = null;
  }
  isSizeableStructure() { return true; }
  // Pieces that report failure (liquid) are dropped for good, as Iterator.remove does natively.
  generateStructure(world, random, bb) {
    const kept = [];
    for (const c of this.components)
      if (!c.boundingBox.intersectsWith(bb) || c.addComponentParts(world, random, bb)) kept.push(c);
    this.components = kept;
  }
  updateBoundingBox() {
    this.boundingBox = StructureBoundingBox.empty();
    for (const c of this.components) this.boundingBox.expandTo(c.boundingBox);
  }
  markAvailableHeight(world, random, offset) {
    const limit = 63 - offset;
    let y = this.boundingBox.ySize + 1;
    if (y < limit) y += random.nextInt(limit - y);
    const dy = y - this.boundingBox.maxY;
    this.boundingBox.offset(0, dy, 0);
    for (const c of this.components) c.boundingBox.offset(0, dy, 0);
  }
  setRandomHeight(world, random, min, max) {
    const range = max - min + 1 - this.boundingBox.ySize;
    const y = range > 1 ? min + random.nextInt(range) : min;
    const dy = y - this.boundingBox.minY;
    this.boundingBox.offset(0, dy, 0);
    for (const c of this.components) c.boundingBox.offset(0, dy, 0);
  }
}

// HashMap<Long, StructureStart> keyed by ChunkCoordIntPair.chunkXZ2Int. Long.hashCode of
// (x & 0xffffffffL) | (z & 0xffffffffL) << 32 is x ^ z; Java 8+ HashMap spreads h ^ h>>>16,
// iterates buckets in index order with insertion order inside a bucket and doubles past 0.75.
// Treeified buckets (8+ keys in one bucket at capacity >= 64) are not modelled and throw.
export class StructureMap {
  constructor() { this.byKey = new Map(); this.entries = []; this.capacity = 16; this.order = null; }
  static key(x, z) { return `${x},${z}`; }
  has(x, z) { return this.byKey.has(StructureMap.key(x,z)); }
  get(x, z) { return this.byKey.get(StructureMap.key(x,z))?.value; }
  set(x, z, value) {
    const k = StructureMap.key(x,z), old = this.byKey.get(k);
    if (old) { old.value = value; return; }
    const h0 = (x ^ z) | 0, hash = h0 ^ (h0 >>> 16);
    const e = { x, z, value, hash, seq: this.entries.length };
    this.byKey.set(k, e); this.entries.push(e); this.order = null;
    // putVal appends; a chain reaching nine nodes calls treeifyBin, which only resizes below 64.
    const mask = this.capacity - 1;
    if (this.entries.filter((o) => (o.hash & mask) === (hash & mask)).length >= 9) {
      if (this.capacity >= 64) throw new Error("HashMap treeified bucket not modelled");
      this.capacity *= 2;
    }
    if (this.entries.length > this.capacity * 0.75) this.capacity *= 2;
  }
  get size() { return this.entries.length; }
  values() {
    if (!this.order) {
      const mask = this.capacity - 1;
      this.order = [...this.entries].sort((a, b) => (a.hash & mask) - (b.hash & mask) || a.seq - b.seq);
    }
    return this.order.map((e) => e.value);
  }
  keys() { this.values(); return this.order.map((e) => [e.x, e.z]); }
}

export class MapGenStructure {
  constructor(worldSeed) {
    this.worldSeed = BigInt.asIntN(64, BigInt(worldSeed));
    this.range = 8;
    this.random = new JavaRandom(0n);
    this.structureMap = new StructureMap();
  }
  canSpawnStructureAtCoords(_x, _z) { throw new Error("abstract"); }
  getStructureStart(_x, _z) { throw new Error("abstract"); }
  // MapGenBase.func_151539_a (called from provideChunk; the block array is unused here).
  generate(chunkX, chunkZ) {
    const r = this.random;
    r.setSeed(this.worldSeed);
    const a = randomLong(r), b = randomLong(r);
    for (let x = chunkX - this.range; x <= chunkX + this.range; x++)
      for (let z = chunkZ - this.range; z <= chunkZ + this.range; z++) {
        r.setSeed(BigInt.asIntN(64, BigInt(x) * a) ^ BigInt.asIntN(64, BigInt(z) * b) ^ this.worldSeed);
        this.recursiveGenerate(x, z, chunkX, chunkZ);
      }
  }
  recursiveGenerate(x, z) {
    if (this.structureMap.has(x, z)) return;
    this.random.nextInt();
    if (this.canSpawnStructureAtCoords(x, z)) this.structureMap.set(x, z, this.getStructureStart(x, z));
    // Native also saves the start to MapGenStructureData (not modelled).
  }
  // generateStructuresInChunk: population area (chunk*16+8 .. +15) on the provider Random.
  generateStructuresInChunk(world, random, chunkX, chunkZ) {
    const x = (chunkX << 4) + 8, z = (chunkZ << 4) + 8;
    let any = false;
    for (const start of this.structureMap.values()) {
      if (!start.isSizeableStructure() || !start.boundingBox.intersectsWithXZ(x, z, x + 15, z + 15)) continue;
      start.generateStructure(world, random, StructureBoundingBox.xz(x, z, x + 15, z + 15));
      any = true;
    }
    return any;
  }
  getStructureAt(x, y, z) {
    for (const start of this.structureMap.values()) {
      if (!start.isSizeableStructure() || !start.boundingBox.intersectsWithXZ(x, z, x, z)) continue;
      for (const c of start.components) if (c.boundingBox.isVecInside(x, y, z)) return start;
    }
    return null;
  }
  isInsideStructure(x, y, z) { return this.getStructureAt(x, y, z) !== null; }
  // func_142038_b: native returns after the first sizeable start in map order.
  hasStructureAtXZ(x, _y, z) {
    for (const start of this.structureMap.values()) {
      if (!start.isSizeableStructure()) continue;
      return start.boundingBox.intersectsWithXZ(x, z, x, z);
    }
    return false;
  }
}
