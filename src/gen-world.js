// 1.7.10 World/Chunk mechanics that population features observe, for decorating
// generated chunks: Chunk storage (ExtendedBlockStorage sections, height map),
// World.setBlock / setBlockMetadataWithNotify / notifyBlocksOfNeighborChange order,
// WorldServer tick scheduling with WorldGenLiquids' immediate mode (instant falling), and the block
// callbacks worldgen reaches (BlockDynamicLiquid, BlockStaticLiquid, BlockFalling,
// BlockBush family, double plants, reeds, cactus, vine, cocoa, leaves/log breakBlock, pumpkin, item
// drops), Chunk.getPrecipitationHeight's column cache, the queries world spawning and the
// freeze/snow pass make, the lake and dungeon services (saved sky light, biome top block,
// isBlockFreezable) and chest and mob spawner tile entities in the chunk maps (Chunk.func_150806_e
// creation, updateContainingBlockInfo, BlockChest's facing unification and markDirty's comparator
// neighbour reads). Light propagation is not modelled; a callback this does not port throws.
// Original numeric IDs. Replayed natively in springs.test.js, biome-decorator.test.js,
// biome-overrides.test.js, population-tail.test.js and populate-chunk.test.js.
import { canBlockStay } from "./decoration-features.js";
import { doublePlantCanStay } from "./biome-features.js";
import { canBlockFreeze } from "./population-tail.js";

export const AIR = 0, STONE = 1, COBBLESTONE = 4, FLOWING_WATER = 8, WATER = 9, FLOWING_LAVA = 10, LAVA = 11, SAND = 12, GRAVEL = 13,
  LOG = 17, LEAVES = 18, TALL_GRASS = 31, DEAD_BUSH = 32, OBSIDIAN = 49, FIRE = 51, CACTUS = 81, REEDS = 83, PUMPKIN = 86,
  LIT_PUMPKIN = 91, VINE = 106, COCOA = 127, LEAVES2 = 161, LOG2 = 162, DOUBLE_PLANT = 175, MOB_SPAWNER = 52, CHEST = 54, TRAPPED_CHEST = 146;

// Block.getMaterial letter (Material field name), material isSolid/blocksMovement/isReplaceable,
// renderAsNormalBlock, isOpaqueCube (flags base 36), getLightOpacity (absent: 255) and
// doesBlockHaveSolidTopSurface per metadata (absent: none, *: all, /mask), from SpringProbe.
const TABLE = "ac0 er* br* cr* er* dr* k00 er* h43 h43 i40 i40 pr* pr* er* er* er* dr* jr1 mr* s30 er* fr* er* er* dr* n30 q00 q00 H30 G11 l40 l40 H30 H30 nr* H30 k00 k00 k00 k00 fr* fr* er* e3/65280 er* ur dr* er* er* q00 o40 eb0* d3/61680 d30 q00 er* fr* dr* k00 c3 er* er* d30 d30 q00 q00 e3/61680 d30 q00 e30 f30 d30 er* er* q00 q00 q00 y40/32896 wb3 zr* A30 Br* k00 dr* d30 Cr* er* pr* sr E00 Cr* F30 q00 q00 s30 d30 Br* er* dr* dr* f30 s30 Cr* k00 k00 l40 d30 e3/61680 e3/61680 br* k00 er* e30 e3/61680 k00 e30 f30 f30 E00 eb0* er* D30 tr* tr* dr* d3/65280 k00 e3/61680 er* e30 q00 q00 fr* d3/61680 d3/61680 d3/61680 fr* s30 e30 q00 k00 k00 q00 q00 g30 d30 f30 f30 q00 q00 d30 fr* er* f30* er* e3/61680 q00 er* er* s30 jr1 dr* d3/61680 d3/61680 170=br* r00 er* er* xr* k00";
const MATERIAL = new Array(256).fill(null), FLAGS = new Uint8Array(256), OPACITY = new Uint8Array(256), TOP = new Uint16Array(256);
{
  let id = -1;
  for (const entry of TABLE.split(" ")) {
    const m = /^(?:(\d+)=)?(\w)(\w)(\d*)(\*|\/\d+)?$/.exec(entry);
    id = m[1] ? +m[1] : id + 1;
    MATERIAL[id] = m[2]; FLAGS[id] = parseInt(m[3], 36); OPACITY[id] = m[4] === "" ? 255 : +m[4];
    TOP[id] = m[5] === "*" ? 65535 : m[5] ? +m[5].slice(1) : 0;
  }
}
export const materialOf = (id) => MATERIAL[id] ?? "a";
// Block.isNormalCube (opaque, non-translucent material that blocks movement, renderAsNormalBlock,
// not a power source), from PopulationTailProbe.
const NORMAL_CUBE = new Set([1, 2, 3, 4, 5, 7, 12, 13, 14, 15, 16, 17, 19, 21, 22, 23, 24, 25, 35, 41, 42, 43, 45, 47, 48, 49, 52, 56,
  57, 58, 61, 62, 73, 74, 80, 82, 84, 86, 87, 88, 91, 97, 98, 99, 100, 103, 110, 112, 120, 121, 123, 124, 125, 129, 133, 137, 153, 155,
  158, 159, 162, 170, 172, 173, 174]);

// Classes overriding onNeighborBlockChange / onBlockAdded / breakBlock / dropBlockAsItemWithChance (census).
const NEIGHBOR = new Set([6, 8, 9, 10, 11, 12, 13, 23, 25, 26, 27, 28, 29, 31, 32, 33, 34, 36, 37, 38, 39, 40, 46, 50, 51, 54, 55, 59, 60, 63, 64, 65, 66, 68, 69, 70, 71, 72, 75, 76, 77, 78, 81, 83, 90, 92, 93, 94, 96, 104, 105, 106, 107, 111, 115, 122, 123, 124, 127, 131, 132, 137, 140, 141, 142, 143, 145, 146, 147, 148, 149, 150, 151, 154, 157, 158, 171, 175]);
const ADDED = new Set([8, 9, 10, 11, 12, 13, 23, 25, 27, 28, 29, 33, 36, 46, 50, 51, 52, 53, 54, 55, 61, 62, 63, 66, 67, 68, 75, 76, 84, 86, 91, 93, 94, 108, 109, 114, 116, 117, 119, 122, 123, 124, 128, 130, 132, 134, 135, 136, 137, 138, 140, 144, 145, 146, 149, 150, 151, 154, 156, 157, 158, 163, 164]);
const BROKEN = new Set([17, 18, 23, 25, 27, 28, 34, 36, 52, 53, 54, 55, 61, 62, 63, 66, 67, 68, 69, 70, 72, 75, 76, 77, 84, 93, 94, 108, 109, 114, 116, 117, 119, 128, 130, 131, 132, 134, 135, 136, 137, 138, 140, 143, 144, 146, 147, 148, 149, 150, 151, 154, 156, 157, 158, 161, 162, 163, 164]);
// Block.hasComparatorInputOverride, ITileEntityProvider and the redstone comparators (BlockRedstoneComparator.func_149907_e).
const COMPARATOR_INPUT = new Set([23, 28, 54, 61, 62, 84, 117, 118, 120, 137, 146, 154, 158]);
const TILE_PROVIDERS = new Set([23, 25, 36, 52, 54, 61, 62, 63, 68, 84, 116, 117, 119, 130, 137, 138, 140, 144, 146, 149, 150, 151, 154, 158]);
const COMPARATORS = new Set([149, 150]);
// Direction.offsetX / offsetZ.
const DIRECTION_X = [0, -1, 0, 1], DIRECTION_Z = [1, 0, -1, 0];
// Bush blocks whose canBlockStay decoration-features.js ports (others in the family throw).
const BUSHES = new Set([6, 31, 32, 37, 38, 39, 40, 111]);
// BlockLiquid.func_149807_p blockers: wooden door, iron door, standing sign, ladder, reeds.
const LIQUID_BLOCKERS = new Set([64, 71, 63, 65, 83]);
// Item drops: Item.getItemFromBlock or the override, damageDropped (meta, meta & 7, 0).
const DROPS = new Map([[6, [6, 7]], [31, null], [32, null], [37, [37, 15]], [38, [38, 15]], [39, [39, 0]], [40, [40, 0]], [81, [81, 0]], [77, [77, 0]], [83, [338, 0]], [106, null], [111, [111, 0]], [143, [143, 0]], [175, [175, 7]]]);
const SEEDS = 295, REEDS_ITEM = 338, DYE = 351;
const FLOWER_POT_CONTENTS = [[-1, 0], [38, 0], [37, 0], [6, 0], [6, 1], [6, 2], [6, 3], [40, 0], [39, 0], [81, 0], [32, 0], [31, 2], [6, 4], [6, 5]];
const unported = (what, id) => { throw new Error(`gen-world: unported ${what} for block ${id}`); };
const BOUND = 30000000;
const inWorld = (x, z) => x >= -BOUND && z >= -BOUND && x < BOUND && z < BOUND;

class Section {
  constructor(base) { this.base = base; this.blocks = new Uint16Array(4096); this.meta = new Uint8Array(4096); }
}
// Chunk storage: 16 sections indexed (y & 15) << 8 | z << 4 | x, height map indexed z << 4 | x.
export class GenChunk {
  constructor(x, z, blocks, meta) {
    this.x = x; this.z = z; this.sections = new Array(16).fill(null); this.heightMap = new Int32Array(256);
    // chunkTileEntityMap, keyed (y << 8 | z << 4 | x).
    this.tiles = new Map();
    // precipitationHeightMap: -999 until getPrecipitationHeight fills the column.
    this.precipitation = new Int32Array(256).fill(-999);
    // Chunk(World, Block[], byte[], x, z): non-air blocks indexed (x * 16 + z) * 256 + y.
    for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y < 256; y++) {
      const i = (lx * 16 + lz) * 256 + y, id = blocks[i];
      if (id === AIR) continue;
      const s = this.sections[y >> 4] ??= new Section(y & ~15), j = (y & 15) << 8 | lz << 4 | lx;
      s.blocks[j] = id; s.meta[j] = meta[i] & 15;
    }
    this.generateSkylightMap();
  }
  getBlock(x, y, z) { const s = y >= 0 && y < 256 ? this.sections[y >> 4] : null; return s ? s.blocks[(y & 15) << 8 | z << 4 | x] : AIR; }
  getMeta(x, y, z) { const s = y >= 0 && y < 256 ? this.sections[y >> 4] : null; return s ? s.meta[(y & 15) << 8 | z << 4 | x] : 0; }
  topFilledSegment() { for (let i = 15; i >= 0; i--) if (this.sections[i]) return this.sections[i].base; return 0; }
  // generateSkylightMap: the top block of the top section never counts; columns with nothing keep
  // their height. Every precipitation column is reset.
  generateSkylightMap() {
    const top = this.topFilledSegment();
    this.precipitation.fill(-999);
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++)
      for (let l = top + 15; l > 0; l--) if (OPACITY[this.getBlock(x, l - 1, z)] !== 0) { this.heightMap[z << 4 | x] = l; break; }
  }
  relightBlock(x, y, z) {
    const l = this.heightMap[z << 4 | x] & 255;
    let i = Math.max(y, l);
    while (i > 0 && OPACITY[this.getBlock(x, i - 1, z)] === 0) i--;
    if (i !== l) this.heightMap[z << 4 | x] = i;
  }
  // getPrecipitationHeight: one above the highest block whose material blocks movement or is liquid.
  precipitationHeight(x, z) {
    const i = z << 4 | x;
    if (this.precipitation[i] === -999) {
      let y = this.topFilledSegment() + 15, h = -1;
      while (y > 0 && h === -1) {
        const id = this.getBlock(x, y, z);
        if (FLAGS[id] & 2 || isLiquidMaterial(id)) h = y + 1;
        else y--;
      }
      this.precipitation[i] = h;
    }
    return this.precipitation[i];
  }
  setMeta(x, y, z, meta) {
    const s = this.sections[y >> 4];
    if (!s) return false;
    const j = (y & 15) << 8 | z << 4 | x;
    if (s.meta[j] === meta) return false;
    s.meta[j] = meta & 15;
    return true;
  }
}

const isLiquidMaterial = (id) => { const m = MATERIAL[id]; return m === "h" || m === "i"; };
const liquid = (id) => ({ id, material: id === FLOWING_WATER ? "h" : "i", adjacent: 0, cost: new Int32Array(4), flow: [false, false, false, false] });

// A World over loaded GenChunks. Hooks (all optional): onCall(kind, ...ints) for every block
// access (0 getBlock, 1 setBlock x/y/z/id/meta/flags, 2 getBlockMetadata, 3 block light,
// 4 setBlockMetadata x/y/z/meta/flags, 5 schedule x/y/z/id/delay/priority, 6 saved block light,
// 7 saved sky light);
// onWrite for each change (metadata writes as id -1, recorded after its notifications); onSound,
// onAux, onItem, onEntity. light is the full light value, blockLight the saved block-light value,
// skyLight the saved sky-light value, biomeAt(x, z) the World.getBiomeGenForCoords biome (with
// .slot, .temperature and .topBlock).
export class GenWorld {
  constructor({ rand, light = () => 0, blockLight = () => 0, skyLight = () => 15, biomeAt = null, hasNoSky = false, hellWorld = false } = {}) {
    this.rand = rand; this.light = light; this.blockLight = blockLight; this.skyLight = skyLight; this.biomeAt = biomeAt; this.hasNoSky = hasNoSky; this.hellWorld = hellWorld;
    this.chunks = new Map(); this.immediate = false; this.pending = []; this.pendingKeys = new Set();
    this.onCall = null; this.onWrite = null; this.onSound = null; this.onAux = null; this.onItem = null; this.onEntity = null;
    this.liquids = new Map([[FLOWING_WATER, liquid(FLOWING_WATER)], [FLOWING_LAVA, liquid(FLOWING_LAVA)]]);
  }
  addChunk(x, z, blocks, meta) { const c = new GenChunk(x, z, blocks, meta); this.chunks.set(`${x},${z}`, c); return c; }
  chunkExists(x, z) { return this.chunks.has(`${x},${z}`); }
  chunk(x, z) { const c = this.chunks.get(`${x},${z}`); if (!c) throw new Error(`gen-world: unloaded chunk ${x},${z}`); return c; }
  checkChunksExist(x0, y0, z0, x1, y1, z1) {
    if (y1 < 0 || y0 >= 256) return false;
    for (let x = x0 >> 4; x <= x1 >> 4; x++) for (let z = z0 >> 4; z <= z1 >> 4; z++) if (!this.chunkExists(x, z)) return false;
    return true;
  }

  // Block access as World does it.
  getBlock(x, y, z) {
    this.onCall?.(0, x, y, z);
    return inWorld(x, z) && y >= 0 && y < 256 ? this.chunk(x >> 4, z >> 4).getBlock(x & 15, y, z & 15) : AIR;
  }
  getBlockMetadata(x, y, z) {
    this.onCall?.(2, x, y, z);
    return inWorld(x, z) && y >= 0 && y < 256 ? this.chunk(x >> 4, z >> 4).getMeta(x & 15, y, z & 15) : 0;
  }
  getLight(x, y, z) { this.onCall?.(3, x, y, z); return this.light(x, y, z); }
  getSavedBlockLight(x, y, z) { this.onCall?.(6, x, y, z); return this.blockLight(x, y, z); }
  // The WorldGenLakes services: getSavedLightValue(Sky), getBiomeGenForCoords(x, z).topBlock and
  // World.isBlockFreezable.
  getSkyLight(x, y, z) { this.onCall?.(7, x, y, z); return this.skyLight(x, y, z); }
  biome(x, z) { return this.biomeAt(x, z); }
  biomeTop(x, z) { return this.biomeAt(x, z).topBlock; }
  canFreeze(x, y, z) { return canBlockFreeze(this, x, y, z); }
  getPrecipitationHeight(x, z) { return this.chunk(x >> 4, z >> 4).precipitationHeight(x & 15, z & 15); }
  // spawnEntityInWorld for worldgen animals.
  spawnEntity(entity) { this.onEntity?.(entity); return true; }
  isAirBlock(x, y, z) { return materialOf(this.getBlock(x, y, z)) === "a"; }
  getHeightValue(x, z) {
    if (!inWorld(x, z)) return 64;
    return this.chunkExists(x >> 4, z >> 4) ? this.chunk(x >> 4, z >> 4).heightMap[(z & 15) << 4 | (x & 15)] : 0;
  }
  getTopSolidOrLiquidBlock(x, z) {
    const c = this.chunk(x >> 4, z >> 4);
    for (let k = c.topFilledSegment() + 15; k > 0; k--) {
      const id = c.getBlock(x & 15, k, z & 15);
      if (FLAGS[id] & 2 && materialOf(id) !== "j") return k + 1;
    }
    return -1;
  }
  // Material and block properties for decoration-features.js / tree-generators.js.
  isSolid(id) { return (FLAGS[id] & 1) !== 0; }
  blocksMovement(id) { return (FLAGS[id] & 2) !== 0; }
  isReplaceable(id) { return (FLAGS[id] & 4) !== 0; }
  isOpaqueCube(id) { return (FLAGS[id] & 16) !== 0; }
  isNormalCube(id) { return NORMAL_CUBE.has(id); }
  isLiquid(id) { return isLiquidMaterial(id); }
  solidTop(id, meta) { return (TOP[id] >> meta & 1) !== 0; }

  setBlock(x, y, z, id, meta = 0, flags = 3) {
    this.onCall?.(1, x, y, z, id, meta, flags);
    if (!inWorld(x, z) || y < 0 || y >= 256) return false;
    const c = this.chunk(x >> 4, z >> 4), old = flags & 1 ? c.getBlock(x & 15, y, z & 15) : null;
    const changed = this.setBlockInChunk(c, x & 15, y, z & 15, id, meta);
    if (changed) {
      if (flags & 1) {
        this.notifyNeighbors(x, y, z, old);
        if (COMPARATOR_INPUT.has(id)) this.notifyComparators(x, y, z, id);
      }
      this.onWrite?.(x, y, z, id, meta, flags);
    }
    return changed;
  }
  setBlockToAir(x, y, z) { return this.setBlock(x, y, z, AIR, 0, 3); }
  setBlockMetadata(x, y, z, meta, flags) {
    this.onCall?.(4, x, y, z, meta, flags);
    if (!inWorld(x, z) || y < 0 || y >= 256) return false;
    const c = this.chunk(x >> 4, z >> 4), changed = c.setMeta(x & 15, y, z & 15, meta);
    if (changed) {
      const id = c.getBlock(x & 15, y, z & 15);
      // Chunk.setBlockMetadata refreshes a provider's tile entity, creating it if missing.
      if (TILE_PROVIDERS.has(id)) { const t = this.chunkTile(c, x & 15, y, z & 15); if (t) { this.tileChanged(t); t.meta = meta; } }
      if (flags & 1) {
        this.notifyNeighbors(x, y, z, id);
        if (COMPARATOR_INPUT.has(id)) this.notifyComparators(x, y, z, id);
      }
      this.onWrite?.(x, y, z, -1, meta, flags);
    }
    return changed;
  }
  // World.func_147453_f: comparators beside the block, or behind a normal cube beside it.
  notifyComparators(x, y, z, source) {
    for (let i = 0; i < 4; i++) {
      let nx = x + DIRECTION_X[i], nz = z + DIRECTION_Z[i];
      const id = this.getBlock(nx, y, nz);
      if (COMPARATORS.has(id)) unported("comparator neighbour", id);
      if (!this.isNormalCube(id)) continue;
      nx += DIRECTION_X[i]; nz += DIRECTION_Z[i];
      const behind = this.getBlock(nx, y, nz);
      if (COMPARATORS.has(behind)) unported("comparator neighbour", behind);
    }
  }

  // Tile entities. Chunk.func_150806_e: the map entry, or a new one when the chunk's block is a
  // provider (created with the chunk metadata and added through World.setTileEntity).
  chunkTile(c, x, y, z) {
    const key = y << 8 | z << 4 | x;
    let t = c.tiles.get(key);
    if (!t) {
      const id = c.getBlock(x, y, z);
      if (!TILE_PROVIDERS.has(id)) return null;
      t = this.createTile(id, c.x * 16 + x, y, c.z * 16 + z, c.getMeta(x, y, z));
      c.tiles.set(key, t);
    }
    return t;
  }
  createTile(id, x, y, z, meta) {
    // TileEntity's cached block type and metadata (getBlockType, blockMetadata).
    const t = { x, y, z, block: null, meta };
    if (id === CHEST) {
      Object.assign(t, { kind: "chest", size: 27, slots: new Array(27).fill(null), type: -1 });
      t.setSlot = (i, stack) => this.setChestSlot(t, i, stack);
    } else if (id === MOB_SPAWNER) {
      Object.assign(t, { kind: "spawner", name: "Pig" });
      t.setEntityName = (name) => { t.name = name; };
    } else if (id === 23 || id === 61 || id === 62) {
      // TileEntityDispenser (9 slots) and TileEntityFurnace (3 slots); structures only fill the dispenser.
      const size = id === 23 ? 9 : 3;
      Object.assign(t, { kind: id === 23 ? "dispenser" : "furnace", size, slots: new Array(size).fill(null) });
      // TileEntityDispenser.setInventorySlotContents ends in markDirty like the chest's (traced natively: aor.e reads the metadata, the first call the block, then
      // the comparator side reads of func_147453_f); the furnace is never filled during generation.
      t.setSlot = id === 23 ? (i, stack) => this.setChestSlot(t, i, stack) : (i, stack) => { t.slots[i] = stack; };
    } else if (id === 140) {
      // BlockFlowerPot.createNewTileEntity: the metadata names the plant (native-checked for 7, red mushroom).
      const [item, data] = FLOWER_POT_CONTENTS[meta] ?? [-1, 0];
      Object.assign(t, { kind: "flowerPot", item, data });
    } else unported("tile entity", id);
    return t;
  }
  // World.getTileEntity.
  getTileEntity(x, y, z) {
    if (y < 0 || y >= 256) return null;
    return this.chunkTile(this.chunk(x >> 4, z >> 4), x & 15, y, z & 15);
  }
  // World.removeTileEntity: the lookup (which may create one), then Chunk.removeTileEntity on a
  // loaded chunk removes and invalidates it.
  removeTileEntity(x, y, z) {
    const t = this.getTileEntity(x, y, z);
    if (!t) return;
    this.chunk(x >> 4, z >> 4).tiles.delete(y << 8 | (z & 15) << 4 | (x & 15));
    if (t.kind === "chest") this.invalidateChest(t);
  }
  // TileEntityChest.invalidate: updateContainingBlockInfo, then checkForAdjacentChests looks up
  // each neighbour chest of its own type (read from its now-replaced block, cached once a chest).
  invalidateChest(t) {
    this.tileChanged(t);
    const type = () => {
      if (t.type !== -1) return t.type;
      t.block ??= this.getBlock(t.x, t.y, t.z);
      if (t.block !== CHEST && t.block !== TRAPPED_CHEST) return 0;
      return (t.type = t.block === CHEST ? 0 : 1);
    };
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const id = this.getBlock(t.x + dx, t.y, t.z + dz);
      if ((id === CHEST || id === TRAPPED_CHEST) && (id === CHEST ? 0 : 1) === type()) this.getTileEntity(t.x + dx, t.y, t.z + dz);
    }
  }
  // TileEntity.updateContainingBlockInfo.
  tileChanged(t) { t.block = null; t.meta = -1; }
  // TileEntityChest.setInventorySlotContents, then markDirty: the metadata, the cached block, and
  // comparator updates.
  setChestSlot(t, i, stack) {
    if (stack && stack[1] > 64) stack[1] = 64;
    t.slots[i] = stack;
    t.meta = this.getBlockMetadata(t.x, t.y, t.z);
    t.block ??= this.getBlock(t.x, t.y, t.z);
    if (t.block !== AIR) this.notifyComparators(t.x, t.y, t.z, t.block);
  }
  // BlockChest.func_149954_e: face away from an opaque side, matching an adjacent chest.
  unifyChest(x, y, z) {
    const op = (id) => this.isOpaqueCube(id);
    const north = this.getBlock(x, y, z - 1), south = this.getBlock(x, y, z + 1), west = this.getBlock(x - 1, y, z), east = this.getBlock(x + 1, y, z);
    let facing = 4;
    if (north === CHEST || south === CHEST) {
      const oz = north === CHEST ? z - 1 : z + 1, a = this.getBlock(x - 1, y, oz), b = this.getBlock(x + 1, y, oz);
      facing = 5;
      if (this.getBlockMetadata(x, y, oz) === 4) facing = 4;
      if ((op(west) || op(a)) && !op(east) && !op(b)) facing = 5;
      if ((op(east) || op(b)) && !op(west) && !op(a)) facing = 4;
    } else if (west === CHEST || east === CHEST) {
      const ox = west === CHEST ? x - 1 : x + 1, a = this.getBlock(ox, y, z - 1), b = this.getBlock(ox, y, z + 1);
      facing = 3;
      if (this.getBlockMetadata(ox, y, z) === 2) facing = 2;
      if ((op(north) || op(a)) && !op(south) && !op(b)) facing = 3;
      if ((op(south) || op(b)) && !op(north) && !op(a)) facing = 2;
    } else {
      facing = 3;
      if (op(north) && !op(south)) facing = 3;
      if (op(south) && !op(north)) facing = 2;
      if (op(west) && !op(east)) facing = 5;
      if (op(east) && !op(west)) facing = 4;
    }
    this.setBlockMetadata(x, y, z, facing, 3);
  }
  // World.func_147480_a: destroy a block with its break effect and optional drops.
  destroyBlock(x, y, z, drop) {
    const id = this.getBlock(x, y, z);
    if (materialOf(id) === "a") return false;
    const meta = this.getBlockMetadata(x, y, z);
    this.onAux?.(2001, x, y, z, id + (meta << 12));
    if (drop) this.dropBlockAsItem(id, x, y, z, meta, 0);
    return this.setBlock(x, y, z, AIR, 0, 3);
  }
  // Chunk.func_150807_a.
  setBlockInChunk(c, x, y, z, id, meta) {
    const column = z << 4 | x;
    if (y >= c.precipitation[column] - 1) c.precipitation[column] = -999;
    const height = c.heightMap[column], old = c.getBlock(x, y, z), oldMeta = c.getMeta(x, y, z);
    if (old === id && oldMeta === meta) return false;
    let s = c.sections[y >> 4], created = false;
    if (!s) {
      if (id === AIR) return false;
      s = c.sections[y >> 4] = new Section(y & ~15);
      created = y >= height;
    }
    const wx = c.x * 16 + x, wz = c.z * 16 + z, j = (y & 15) << 8 | z << 4 | x;
    s.blocks[j] = id;
    this.breakBlock(old, wx, y, wz, oldMeta);
    if (s.blocks[j] !== id) return false;
    s.meta[j] = meta & 15;
    if (created) c.generateSkylightMap();
    else if (OPACITY[id] > 0) { if (y >= height) c.relightBlock(x, y + 1, z); }
    else if (y === height - 1) c.relightBlock(x, y, z);
    if (TILE_PROVIDERS.has(old)) { const t = this.chunkTile(c, x, y, z); if (t) this.tileChanged(t); }
    this.blockAdded(id, wx, y, wz);
    if (TILE_PROVIDERS.has(id)) { const t = this.chunkTile(c, x, y, z); if (t) this.tileChanged(t); }
    return true;
  }
  notifyNeighbors(x, y, z, source) {
    this.notifyNeighbor(x - 1, y, z, source); this.notifyNeighbor(x + 1, y, z, source);
    this.notifyNeighbor(x, y - 1, z, source); this.notifyNeighbor(x, y + 1, z, source);
    this.notifyNeighbor(x, y, z - 1, source); this.notifyNeighbor(x, y, z + 1, source);
  }
  notifyNeighbor(x, y, z, source) { this.neighborChanged(this.getBlock(x, y, z), x, y, z, source); }
  // WorldServer.scheduleBlockUpdateWithPriority at world time 0, recording queued entries.
  scheduleBlockUpdate(x, y, z, id, delay, priority = 0) {
    this.onCall?.(5, x, y, z, id, delay, priority);
    if (this.immediate && materialOf(id) !== "a") {
      // Block.func_149698_L is true except for fire: those tick at once with the world Random.
      if (id !== FIRE) {
        if (this.checkChunksExist(x - 8, y - 8, z - 8, x + 8, y + 8, z + 8)) {
          const here = this.getBlock(x, y, z);
          if (materialOf(here) !== "a" && here === id) this.updateTick(id, x, y, z, this.rand);
        }
        return;
      }
      delay = 1;
    }
    if (!this.checkChunksExist(x, y, z, x, y, z)) return;
    const key = `${x},${y},${z},${id}`;
    if (!this.pendingKeys.has(key)) { this.pendingKeys.add(key); this.pending.push([x, y, z, id, delay, priority]); }
  }
  playSound(x, y, z, name, volume, pitch) { this.onSound?.(name, x, y, z, volume, pitch); }

  // Block.dropBlockAsItem(world, x, y, z, meta, fortune) with chance 1.
  dropBlockAsItem(id, x, y, z, meta, fortune) {
    if (id === AIR) return;
    // BlockDoublePlant.getItemDropped: nothing for the top half, double grass or large fern.
    if (id === DOUBLE_PLANT && ((meta & 8) !== 0 || (meta & 7) === 2 || (meta & 7) === 3)) {
      this.rand.nextFloat();
      return;
    }
    if (id === COCOA) {
      for (let k = ((meta & 12) >> 2) >= 2 ? 3 : 1; k > 0; k--) this.spawnItem(x, y, z, DYE, 1, 3);
      return;
    }
    if (!DROPS.has(id)) unported("drops", id);
    const rule = DROPS.get(id), rand = this.rand;
    const count = id === TALL_GRASS ? 1 + rand.nextInt(fortune * 2 + 1) : id === VINE ? 0 : 1;
    for (let k = 0; k < count; k++) {
      if (!(rand.nextFloat() <= 1)) continue;
      const item = id === TALL_GRASS ? (rand.nextInt(8) === 0 ? SEEDS : null) : rule?.[0] ?? null;
      if (item !== null) this.spawnItem(x, y, z, item, 1, rule ? meta & rule[1] : 0);
    }
  }
  // Block.dropBlockAsItem_do: an EntityItem at a random offset, pickup delay 10.
  spawnItem(x, y, z, item, count, damage) {
    const f = Math.fround(0.7), offset = () => Math.fround(this.rand.nextFloat() * f) + 0.15000000596046448;
    const dx = offset(), dy = offset(), dz = offset();
    this.onItem?.(x + dx, y + dy, z + dz, item, count, damage, 10);
  }

  neighborChanged(id, x, y, z, source) {
    switch (id) {
      case FLOWING_WATER: case FLOWING_LAVA: this.harden(id, x, y, z); return;
      case WATER: case LAVA:
        this.harden(id, x, y, z);
        if (this.getBlock(x, y, z) === id) {
          const meta = this.getBlockMetadata(x, y, z);
          this.setBlock(x, y, z, id - 1, meta, 2);
          this.scheduleBlockUpdate(x, y, z, id - 1, this.liquidTickRate(id));
        }
        return;
      case SAND: case GRAVEL: this.scheduleBlockUpdate(x, y, z, id, 2); return;
      case CACTUS: if (!canBlockStay(this, CACTUS, x, y, z)) this.destroyBlock(x, y, z, true); return;
      case REEDS:
        if (!canBlockStay(this, REEDS, x, y, z)) { this.dropBlockAsItem(REEDS, x, y, z, this.getBlockMetadata(x, y, z), 0); this.setBlockToAir(x, y, z); }
        return;
      case VINE:
        if (!this.vineCanStay(x, y, z)) { this.dropBlockAsItem(VINE, x, y, z, this.getBlockMetadata(x, y, z), 0); this.setBlockToAir(x, y, z); }
        return;
      case DOUBLE_PLANT:
        // BlockDoublePlant.func_149855_e: a broken bottom half drops and clears the top first.
        if (!doublePlantCanStay(this, x, y, z)) {
          const meta = this.getBlockMetadata(x, y, z);
          if ((meta & 8) === 0) {
            this.dropBlockAsItem(DOUBLE_PLANT, x, y, z, meta, 0);
            if (this.getBlock(x, y + 1, z) === DOUBLE_PLANT) this.setBlock(x, y + 1, z, AIR, 0, 2);
          }
          this.setBlock(x, y, z, AIR, 0, 2);
        }
        return;
      case COCOA:
        if (!this.cocoaCanStay(x, y, z)) { this.dropBlockAsItem(COCOA, x, y, z, this.getBlockMetadata(x, y, z), 0); this.setBlock(x, y, z, AIR, 0, 2); }
        return;
      case CHEST: { const t = this.getTileEntity(x, y, z); if (t) this.tileChanged(t); return; }
    }
    if (BUSHES.has(id)) {
      if (!canBlockStay(this, id, x, y, z)) { this.dropBlockAsItem(id, x, y, z, this.getBlockMetadata(x, y, z), 0); this.setBlock(x, y, z, AIR, 0, 2); }
    } else if (NEIGHBOR.has(id)) unported("onNeighborBlockChange", id);
  }
  blockAdded(id, x, y, z) {
    switch (id) {
      case FLOWING_WATER: case FLOWING_LAVA:
        this.harden(id, x, y, z);
        if (this.getBlock(x, y, z) === id) this.scheduleBlockUpdate(x, y, z, id, this.liquidTickRate(id));
        return;
      case WATER: case LAVA: this.harden(id, x, y, z); return;
      case SAND: case GRAVEL: this.scheduleBlockUpdate(x, y, z, id, 2); return;
      case MOB_SPAWNER: return;
      case CHEST:
        // BlockChest.onBlockAdded: unify this chest, then each adjacent one.
        this.unifyChest(x, y, z);
        {
          const north = this.getBlock(x, y, z - 1), south = this.getBlock(x, y, z + 1), west = this.getBlock(x - 1, y, z), east = this.getBlock(x + 1, y, z);
          if (north === CHEST) this.unifyChest(x, y, z - 1);
          if (south === CHEST) this.unifyChest(x, y, z + 1);
          if (west === CHEST) this.unifyChest(x - 1, y, z);
          if (east === CHEST) this.unifyChest(x + 1, y, z);
        }
        return;
      case PUMPKIN: case LIT_PUMPKIN:
        // BlockPumpkin.onBlockAdded: snow golem and iron golem checks.
        if (this.getBlock(x, y - 1, z) === 80 && this.getBlock(x, y - 2, z) === 80) unported("snow golem", id);
        if (this.getBlock(x, y - 1, z) === 42 && this.getBlock(x, y - 2, z) === 42) unported("iron golem", id);
        return;
    }
    if (ADDED.has(id)) unported("onBlockAdded", id);
  }
  breakBlock(id, x, y, z, meta) {
    if (id === LEAVES || id === LEAVES2) {
      if (!this.checkChunksExist(x - 2, y - 2, z - 2, x + 2, y + 2, z + 2)) return;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++)
        if (materialOf(this.getBlock(x + dx, y + dy, z + dz)) === "j")
          this.setBlockMetadata(x + dx, y + dy, z + dz, this.getBlockMetadata(x + dx, y + dy, z + dz) | 8, 4);
    } else if (id === LOG || id === LOG2) {
      if (!this.checkChunksExist(x - 5, y - 5, z - 5, x + 5, y + 5, z + 5)) return;
      for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) for (let dz = -4; dz <= 4; dz++)
        if (materialOf(this.getBlock(x + dx, y + dy, z + dz)) === "j") {
          const m = this.getBlockMetadata(x + dx, y + dy, z + dz);
          if ((m & 8) === 0) this.setBlockMetadata(x + dx, y + dy, z + dz, m | 8, 4);
        }
    } else if (id === CHEST) {
      // BlockChest.breakBlock drops the contents with its own unseeded Random, then BlockContainer
      // removes the tile entity.
      const t = this.getTileEntity(x, y, z);
      if (t) {
        if (t.slots?.some((s) => s)) unported("chest contents drop", id);
        this.notifyComparators(x, y, z, id);
      }
      this.removeTileEntity(x, y, z);
    } else if (id === MOB_SPAWNER) this.removeTileEntity(x, y, z);
    else if (BROKEN.has(id)) unported("breakBlock", id);
  }
  updateTick(id, x, y, z, rand) {
    if (id === FLOWING_WATER || id === FLOWING_LAVA) this.flow(this.liquids.get(id), x, y, z, rand);
    else if (id === SAND || id === GRAVEL) this.fall(id, x, y, z);
    else unported("updateTick", id);
  }

  // BlockFalling.func_149830_m with fallInstantly, as during population.
  fall(id, x, y, z) {
    if (!this.canFall(x, y - 1, z) || y < 0) return;
    this.setBlockToAir(x, y, z);
    while (this.canFall(x, y - 1, z) && y > 0) y--;
    if (y > 0) this.setBlock(x, y, z, id);
  }
  canFall(x, y, z) {
    const id = this.getBlock(x, y, z), m = materialOf(id);
    return m === "a" || id === FIRE || m === "h" || m === "i";
  }
  // BlockVine.func_150094_e; Direction.offsetX/Z for metadata bits 1, 2, 4, 8.
  vineCanStay(x, y, z) {
    const meta = this.getBlockMetadata(x, y, z);
    let kept = meta;
    if (meta > 0)
      for (let i = 0; i <= 3; i++) {
        const bit = 1 << i;
        if ((meta & bit) !== 0 && !this.vineSupport(this.getBlock(x + [0, -1, 0, 1][i], y, z + [1, 0, -1, 0][i])) &&
          (this.getBlock(x, y + 1, z) !== VINE || (this.getBlockMetadata(x, y + 1, z) & bit) === 0)) kept &= ~bit;
      }
    if (kept === 0 && !this.vineSupport(this.getBlock(x, y + 1, z))) return false;
    if (kept !== meta) this.setBlockMetadata(x, y, z, kept, 2);
    return true;
  }
  vineSupport(id) { return (FLAGS[id] & 8) !== 0 && (FLAGS[id] & 2) !== 0; }
  cocoaCanStay(x, y, z) {
    const dir = this.getBlockMetadata(x, y, z) & 3, px = x + [0, -1, 0, 1][dir], pz = z + [1, 0, -1, 0][dir];
    return this.getBlock(px, y, pz) === LOG && (this.getBlockMetadata(px, y, pz) & 3) === 3;
  }

  // BlockLiquid.
  liquidTickRate(id) { return materialOf(id) === "h" ? 5 : this.hasNoSky ? 10 : 30; }
  // func_149805_n: lava next to water hardens to obsidian (source) or cobblestone (level <= 4).
  harden(id, x, y, z) {
    if (this.getBlock(x, y, z) !== id || materialOf(id) !== "i") return;
    const water = (a, b, c) => materialOf(this.getBlock(a, b, c)) === "h";
    if (!(water(x, y, z - 1) || water(x, y, z + 1) || water(x - 1, y, z) || water(x + 1, y, z) || water(x, y + 1, z))) return;
    const meta = this.getBlockMetadata(x, y, z);
    if (meta === 0) this.setBlock(x, y, z, OBSIDIAN);
    else if (meta <= 4) this.setBlock(x, y, z, COBBLESTONE);
    this.fizz(x, y, z);
  }
  fizz(x, y, z) {
    const r = this.rand, a = r.nextFloat(), b = r.nextFloat();
    this.playSound(Math.fround(x + 0.5), Math.fround(y + 0.5), Math.fround(z + 0.5), "random.fizz", Math.fround(0.5),
      Math.fround(Math.fround(2.6) + Math.fround(Math.fround(a - b) * Math.fround(0.8))));
  }
  level(L, x, y, z) { return materialOf(this.getBlock(x, y, z)) === L.material ? this.getBlockMetadata(x, y, z) : -1; }

  // BlockDynamicLiquid.
  flow(L, x, y, z, rand) {
    let l = this.level(L, x, y, z);
    const lava = L.material === "i", step = lava && !this.hellWorld ? 2 : 1;
    let rate = this.liquidTickRate(L.id);
    if (l > 0) {
      L.adjacent = 0;
      let min = -100;
      min = this.lowest(L, x - 1, y, z, min); min = this.lowest(L, x + 1, y, z, min);
      min = this.lowest(L, x, y, z - 1, min); min = this.lowest(L, x, y, z + 1, min);
      let next = min + step;
      if (next >= 8 || min < 0) next = -1;
      if (this.level(L, x, y + 1, z) >= 0) {
        const above = this.level(L, x, y + 1, z);
        next = above >= 8 ? above : above + 8;
      }
      if (L.adjacent >= 2 && !lava) {
        if (this.isSolid(this.getBlock(x, y - 1, z))) next = 0;
        else if (materialOf(this.getBlock(x, y - 1, z)) === L.material && this.getBlockMetadata(x, y - 1, z) === 0) next = 0;
      }
      if (lava && l < 8 && next < 8 && next > l && rand.nextInt(4) !== 0) rate *= 4;
      if (next === l) this.makeStatic(L, x, y, z);
      else {
        l = next;
        if (next < 0) this.setBlockToAir(x, y, z);
        else {
          this.setBlockMetadata(x, y, z, next, 2);
          this.scheduleBlockUpdate(x, y, z, L.id, rate);
          this.notifyNeighbors(x, y, z, L.id);
        }
      }
    } else this.makeStatic(L, x, y, z);
    if (this.canFlowInto(L, x, y - 1, z)) {
      if (lava && materialOf(this.getBlock(x, y - 1, z)) === "h") {
        this.setBlock(x, y - 1, z, STONE);
        this.fizz(x, y - 1, z);
        return;
      }
      this.flowInto(L, x, y - 1, z, l >= 8 ? l : l + 8);
    } else if (l >= 0 && (l === 0 || this.blocksLiquid(x, y - 1, z))) {
      const flow = this.flowDirections(L, x, y, z);
      const spread = l >= 8 ? 1 : l + step;
      if (spread >= 8) return;
      // The direction array is the block's shared field; nested flows overwrite it.
      if (flow[0]) this.flowInto(L, x - 1, y, z, spread);
      if (flow[1]) this.flowInto(L, x + 1, y, z, spread);
      if (flow[2]) this.flowInto(L, x, y, z - 1, spread);
      if (flow[3]) this.flowInto(L, x, y, z + 1, spread);
    }
  }
  makeStatic(L, x, y, z) { const meta = this.getBlockMetadata(x, y, z); this.setBlock(x, y, z, L.id + 1, meta, 2); }
  lowest(L, x, y, z, current) {
    let m = this.level(L, x, y, z);
    if (m < 0) return current;
    if (m === 0) L.adjacent++;
    if (m >= 8) m = 0;
    return current >= 0 && m >= current ? current : m;
  }
  flowInto(L, x, y, z, meta) {
    if (!this.canFlowInto(L, x, y, z)) return;
    const id = this.getBlock(x, y, z);
    if (L.material === "i") this.fizz(x, y, z);
    else this.dropBlockAsItem(id, x, y, z, this.getBlockMetadata(x, y, z), 0);
    this.setBlock(x, y, z, L.id, meta, 3);
  }
  blocksLiquid(x, y, z) {
    const id = this.getBlock(x, y, z);
    return LIQUID_BLOCKERS.has(id) || materialOf(id) === "E" || this.blocksMovement(id);
  }
  canFlowInto(L, x, y, z) {
    const m = materialOf(this.getBlock(x, y, z));
    return m !== L.material && m !== "i" && !this.blocksLiquid(x, y, z);
  }
  pathCost(L, x, y, z, depth, from) {
    let best = 1000;
    for (let i = 0; i < 4; i++) {
      if ((i === 0 && from === 1) || (i === 1 && from === 0) || (i === 2 && from === 3) || (i === 3 && from === 2)) continue;
      const nx = x + (i === 0 ? -1 : i === 1 ? 1 : 0), nz = z + (i === 2 ? -1 : i === 3 ? 1 : 0);
      if (this.blocksLiquid(nx, y, nz) || (materialOf(this.getBlock(nx, y, nz)) === L.material && this.getBlockMetadata(nx, y, nz) === 0)) continue;
      if (!this.blocksLiquid(nx, y - 1, nz)) return depth;
      if (depth < 4) { const c = this.pathCost(L, nx, y, nz, depth + 1, i); if (c < best) best = c; }
    }
    return best;
  }
  flowDirections(L, x, y, z) {
    for (let i = 0; i < 4; i++) {
      L.cost[i] = 1000;
      const nx = x + (i === 0 ? -1 : i === 1 ? 1 : 0), nz = z + (i === 2 ? -1 : i === 3 ? 1 : 0);
      if (this.blocksLiquid(nx, y, nz) || (materialOf(this.getBlock(nx, y, nz)) === L.material && this.getBlockMetadata(nx, y, nz) === 0)) continue;
      L.cost[i] = this.blocksLiquid(nx, y - 1, nz) ? this.pathCost(L, nx, y, nz, 1, i) : 0;
    }
    let min = L.cost[0];
    for (let i = 1; i < 4; i++) if (L.cost[i] < min) min = L.cost[i];
    for (let i = 0; i < 4; i++) L.flow[i] = L.cost[i] === min;
    return L.flow;
  }
}
