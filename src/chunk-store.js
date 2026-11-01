// 1.7.10 chunk storage (WORLD-01): NibbleArray (apv), ExtendedBlockStorage (apz), the storage side of
// Chunk (apx), World.getBlock/getBlockMetadata/setBlock coordinate handling (ahb) and
// ChunkCoordIntPair (agu) keys. Cells hold original block ids (12 bits, the high nibble only when an id
// passes 255) and 4-bit metadata, so negative coordinates, 16 sections (256 high) and the 30,000,000
// world border work as in the original. Not yet the game's live world: World (world.js) still runs
// the fixed 128 x 128 x 64 arrays, and fromLegacyWorld/toLegacyWorld migrate between the two without
// moving any cell. Lighting, heightmaps, tile entities and neighbour updates are not part of this layer.
// Evidence: tools/probes/ChunkProbe.java -> public/research/chunk-reference.json.
import { SIZE, HEIGHT } from "./world.js";
import { isRegistered, ticksRandomlyOriginal, toOriginal, fromOriginal } from "./block-registry.js";

export const WORLD_BORDER = 30000000, WORLD_HEIGHT = 256, SECTION_COUNT = 16;

// NibbleArray: 4-bit values, two per byte (even index in the low nibble). The index is
// y << (depthBits + 4) | z << depthBits | x, ORed as in the original.
export class NibbleArray {
  constructor(size = 4096, depthBits = 4, data = null) {
    this.data = data || new Uint8Array(size >> 1);
    this.depthBits = depthBits;
    this.depthBitsPlusFour = depthBits + 4;
  }
  get(x, y, z) {
    const i = (y << this.depthBitsPlusFour) | (z << this.depthBits) | x, b = this.data[i >> 1];
    return i & 1 ? (b >> 4) & 15 : b & 15;
  }
  set(x, y, z, value) {
    const i = (y << this.depthBitsPlusFour) | (z << this.depthBits) | x, j = i >> 1;
    this.data[j] = i & 1 ? (this.data[j] & 15) | ((value & 15) << 4) : (this.data[j] & 240) | (value & 15);
  }
}

// ExtendedBlockStorage: one 16 x 16 x 16 section at yBase. blockRefCount counts non-air cells and
// tickRefCount random-ticking ones; an unregistered stored id reads (and recounts) as air.
export class ExtendedBlockStorage {
  constructor(yBase, hasSky = true) {
    this.yBase = yBase;
    this.blockRefCount = 0;
    this.tickRefCount = 0;
    this.lsb = new Uint8Array(4096);
    this.msb = null;
    this.metadata = new NibbleArray();
    this.blocklight = new NibbleArray();
    this.skylight = hasSky ? new NibbleArray() : null;
  }
  getBlock(x, y, z) {
    let id = this.lsb[(y << 8) | (z << 4) | x];
    if (this.msb) id |= this.msb.get(x, y, z) << 8;
    return isRegistered(id) ? id : 0;
  }
  // func_150818_a. Only registered ids exist as Block objects, so others are refused.
  setBlock(x, y, z, id) {
    if (!isRegistered(id)) throw new RangeError(`unregistered block id ${id}`);
    const old = this.getBlock(x, y, z);
    if (old !== 0) {
      this.blockRefCount--;
      if (ticksRandomlyOriginal(old)) this.tickRefCount--;
    }
    if (id !== 0) {
      this.blockRefCount++;
      if (ticksRandomlyOriginal(id)) this.tickRefCount++;
    }
    this.lsb[(y << 8) | (z << 4) | x] = id & 255;
    if (id > 255) (this.msb ||= new NibbleArray()).set(x, y, z, (id & 3840) >> 8);
    else if (this.msb) this.msb.set(x, y, z, 0);
  }
  getMeta(x, y, z) { return this.metadata.get(x, y, z); }
  setMeta(x, y, z, v) { this.metadata.set(x, y, z, v); }
  getSkylight(x, y, z) { return this.skylight.get(x, y, z); }
  setSkylight(x, y, z, v) { this.skylight.set(x, y, z, v); }
  getBlocklight(x, y, z) { return this.blocklight.get(x, y, z); }
  setBlocklight(x, y, z, v) { this.blocklight.set(x, y, z, v); }
  isEmpty() { return this.blockRefCount === 0; }
  needsRandomTick() { return this.tickRefCount > 0; }
  // createBlockMSBArray (func_76667_m)
  createMsb() { return (this.msb = new NibbleArray()); }
  // removeInvalidBlocks (func_76672_e): recount after raw array loads.
  recount() {
    this.blockRefCount = 0;
    this.tickRefCount = 0;
    for (let x = 0; x < 16; x++)
      for (let y = 0; y < 16; y++)
        for (let z = 0; z < 16; z++) {
          const id = this.getBlock(x, y, z);
          if (id !== 0) {
            this.blockRefCount++;
            if (ticksRandomlyOriginal(id)) this.tickRefCount++;
          }
        }
  }
}

function sectionIndex(y) {
  const s = y >> 4;
  // The original indexes storageArrays[y >> 4] directly: below 0 that throws.
  if (s < 0) throw new RangeError(`chunk y ${y} below 0`);
  return s;
}

// Chunk storage. x/z are chunk coordinates; cells use chunk-local x/z 0-15 and y 0-255.
export class Chunk {
  constructor(x, z, hasSky = true) {
    this.x = x;
    this.z = z;
    this.hasSky = hasSky;
    this.sections = new Array(SECTION_COUNT).fill(null);
    this.biomes = new Int8Array(256).fill(-1);
    this.heightMap = new Int32Array(256);
    this.precipitationHeightMap = new Int32Array(256).fill(-999);
    this.modified = false; // isModified
    // Lifecycle state ChunkProviderServer and PlayerManager use (chunk-provider.js, player-chunks.js).
    this.isChunkLoaded = false;
    this.isTerrainPopulated = false;
    this.isLightPopulated = false;
    this.isTicked = false; // field_150815_m: set by the first block tick near a player
    this.hasEntities = false;
    this.lastSaveTime = 0;
    this.inhabitedTime = 0;
  }
  // Chunk(World, Block[], byte[], x, z), the generator constructor: index x * k * 16 | z * k | y with
  // k = length / 256; air (id 0) and missing (negative) cells are skipped; meta is written for the rest.
  static fromGeneration(blocks, meta, x, z, hasSky = true) {
    const c = new Chunk(x, z, hasSky), k = blocks.length / 256;
    for (let lx = 0; lx < 16; lx++)
      for (let lz = 0; lz < 16; lz++)
        for (let y = 0; y < k; y++) {
          const i = ((lx * k * 16) | (lz * k)) | y, id = blocks[i];
          if (!(id > 0)) continue;
          const s = c.section(y >> 4, true);
          s.setBlock(lx, y & 15, lz, id);
          s.setMeta(lx, y & 15, lz, meta[i]);
        }
    return c;
  }
  // Chunk(World, Block[], x, z): index x << 11 | z << 7 | y, Material.air cells skipped, no metadata.
  static fromBlocks(blocks, x, z, hasSky = true) {
    const c = new Chunk(x, z, hasSky), k = blocks.length / 256;
    for (let lx = 0; lx < 16; lx++)
      for (let lz = 0; lz < 16; lz++)
        for (let y = 0; y < k; y++) {
          const id = blocks[(lx << 11) | (lz << 7) | y];
          if (!(id > 0)) continue;
          c.section(y >> 4, true).setBlock(lx, y & 15, lz, id);
        }
    return c;
  }
  section(s, create = false) {
    let sec = this.sections[s];
    if (!sec && create) sec = this.sections[s] = new ExtendedBlockStorage(s << 4, this.hasSky);
    return sec;
  }
  getBlock(x, y, z) {
    const s = sectionIndex(y);
    if (s >= SECTION_COUNT) return 0;
    const sec = this.sections[s];
    return sec ? sec.getBlock(x, y & 15, z) : 0;
  }
  getMeta(x, y, z) {
    const s = sectionIndex(y);
    if (s >= SECTION_COUNT) return 0;
    const sec = this.sections[s];
    return sec ? sec.getMeta(x, y & 15, z) : 0;
  }
  // setBlockMetadata (apx.a(IIII)): false for a missing section or the same value. The comparison
  // uses the unmasked value, so 16 over 0 stores 0 and still reports a change. Tile entity
  // metadata refresh is not modelled.
  setMeta(x, y, z, v) {
    const s = sectionIndex(y);
    if (s >= SECTION_COUNT) throw new RangeError(`chunk y ${y} above 255`);
    const sec = this.sections[s];
    if (!sec || sec.getMeta(x, y & 15, z) === v) return false;
    this.modified = true;
    sec.setMeta(x, y & 15, z, v);
    return true;
  }
  // The storage steps of func_150807_a (setBlockIDWithMetadata): unchanged cells and air written into
  // a missing section are refused; a section is created on demand. Light, heightmap, tile entity and
  // block callbacks are left to their own systems.
  setBlockState(x, y, z, id, meta = 0) {
    const s = sectionIndex(y);
    if (s >= SECTION_COUNT) throw new RangeError(`chunk y ${y} above 255`);
    if (this.getBlock(x, y, z) === id && this.getMeta(x, y, z) === meta) return false;
    let sec = this.sections[s];
    if (!sec) {
      if (id === 0) return false;
      sec = this.section(s, true);
    }
    sec.setBlock(x, y & 15, z, id);
    sec.setMeta(x, y & 15, z, meta);
    this.modified = true;
    return true;
  }
  // getTopFilledSegment (func_76625_h): yBase of the highest existing section, 0 when none.
  topFilledSegment() {
    for (let s = SECTION_COUNT - 1; s >= 0; s--) if (this.sections[s]) return this.sections[s].yBase;
    return 0;
  }
  // onChunkLoad / onChunkUnload: the chunk's tile entities and entity lists join or leave the world
  // (world.chunkLoaded / chunkUnloaded hooks; this storage has no entity lists of its own yet).
  onChunkLoad(world) {
    this.isChunkLoaded = true;
    world?.chunkLoaded?.(this);
  }
  onChunkUnload(world) {
    this.isChunkLoaded = false;
    world?.chunkUnloaded?.(this);
  }
  // needsSaving: on a full save, entities and an unsaved tick or any change; otherwise entities
  // every 600 ticks, or a change.
  needsSaving(all, totalTime) {
    if (all) {
      if ((this.hasEntities && totalTime !== this.lastSaveTime) || this.modified) return true;
    } else if (this.hasEntities && totalTime >= this.lastSaveTime + 600) return true;
    return this.modified;
  }
  // func_150802_k: the chunk has ticked and is populated and lit, so PlayerInstance sends it.
  isReadyToSend() {
    return this.isTicked && this.isTerrainPopulated && this.isLightPopulated;
  }
  // populateChunk(p1, p2, x, z): each newly loaded chunk tries to populate itself and the three
  // chunks to its west/north once the 2 x 2 square each one decorates is loaded. As in the original,
  // the second check tests (x - 1, z + 1) twice and the third tests (x + 1, z - 1) twice.
  populateChunk(p1, p2, x, z) {
    if (!this.isTerrainPopulated && p1.chunkExists(x + 1, z + 1) && p1.chunkExists(x, z + 1) && p1.chunkExists(x + 1, z)) p1.populate(p2, x, z);
    if (p1.chunkExists(x - 1, z) && !p1.provideChunk(x - 1, z).isTerrainPopulated && p1.chunkExists(x - 1, z + 1) && p1.chunkExists(x, z + 1) && p1.chunkExists(x - 1, z + 1))
      p1.populate(p2, x - 1, z);
    if (p1.chunkExists(x, z - 1) && !p1.provideChunk(x, z - 1).isTerrainPopulated && p1.chunkExists(x + 1, z - 1) && p1.chunkExists(x + 1, z - 1) && p1.chunkExists(x + 1, z))
      p1.populate(p2, x, z - 1);
    if (p1.chunkExists(x - 1, z - 1) && !p1.provideChunk(x - 1, z - 1).isTerrainPopulated && p1.chunkExists(x, z - 1) && p1.chunkExists(x - 1, z))
      p1.populate(p2, x - 1, z - 1);
  }
}

// EmptyChunk: what provideChunk returns for a chunk it will not load. Reads are air; writes, load,
// unload and modification do nothing; it never needs saving.
export class EmptyChunk extends Chunk {
  getBlock() { return 0; }
  getMeta() { return 0; }
  setMeta() { return false; }
  setBlockState() { return false; }
  onChunkLoad() {}
  onChunkUnload() {}
  needsSaving() { return false; }
  get modified() { return false; }
  set modified(v) {}
}

// ChunkCoordIntPair.chunkXZ2Int as the original signed long (BigInt), and its hashCode.
export function chunkXZ2Int(x, z) {
  return BigInt.asIntN(64, (BigInt(x) & 0xffffffffn) | ((BigInt(z) & 0xffffffffn) << 32n));
}
export function chunkHash(x, z) {
  return (Math.imul(1664525, x) + 1013904223) ^ (Math.imul(1664525, z ^ -559038737) + 1013904223);
}
// Map key for loadable chunks (|x|, |z| < 2^21 covers the 1,875,000-chunk border).
const KEY_OFFSET = 1 << 21, KEY_SCALE = 1 << 22;
export function chunkKey(x, z) {
  if (!(x > -KEY_OFFSET && x < KEY_OFFSET && z > -KEY_OFFSET && z < KEY_OFFSET)) throw new RangeError(`chunk ${x},${z} beyond the world`);
  return (x + KEY_OFFSET) * KEY_SCALE + (z + KEY_OFFSET);
}
const inBorder = (x, z) => x >= -WORLD_BORDER && z >= -WORLD_BORDER && x < WORLD_BORDER && z < WORLD_BORDER;

// World-level cell access over loaded chunks. A missing chunk reads as air (EmptyChunk).
export class ChunkStore {
  constructor(hasSky = true) {
    this.hasSky = hasSky;
    this.chunks = new Map();
  }
  getChunk(cx, cz) { return this.chunks.get(chunkKey(cx, cz)) || null; }
  provideChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    let c = this.chunks.get(key);
    if (!c) this.chunks.set(key, (c = new Chunk(cx, cz, this.hasSky)));
    return c;
  }
  addChunk(chunk) { this.chunks.set(chunkKey(chunk.x, chunk.z), chunk); return chunk; }
  removeChunk(cx, cz) { return this.chunks.delete(chunkKey(cx, cz)); }
  // World.getBlock: air outside the border or y 0-255, else the chunk at (x >> 4, z >> 4).
  getBlock(x, y, z) {
    if (!inBorder(x, z) || y < 0 || y >= WORLD_HEIGHT) return 0;
    return this.getChunk(x >> 4, z >> 4)?.getBlock(x & 15, y, z & 15) ?? 0;
  }
  getMeta(x, y, z) {
    if (!inBorder(x, z) || y < 0 || y >= WORLD_HEIGHT) return 0;
    return this.getChunk(x >> 4, z >> 4)?.getMeta(x & 15, y, z & 15) ?? 0;
  }
  // World.setBlock's bounds, then the chunk's storage write (chunks are created on demand).
  setBlockState(x, y, z, id, meta = 0) {
    if (!inBorder(x, z) || y < 0 || y >= WORLD_HEIGHT) return false;
    const c = id === 0 ? this.getChunk(x >> 4, z >> 4) : this.provideChunk(x >> 4, z >> 4);
    return c ? c.setBlockState(x & 15, y, z & 15, id, meta) : false;
  }
  setMeta(x, y, z, meta) {
    if (!inBorder(x, z) || y < 0 || y >= WORLD_HEIGHT) return false;
    return this.getChunk(x >> 4, z >> 4)?.setMeta(x & 15, y, z & 15, meta) ?? false;
  }
}

// Copies a legacy World (world.js, x/z 0-127, y 0-63) into chunks 0-7 x 0-7 at the same coordinates.
// `stateAt(x, y, z, id, meta)` may supply block-registry side state (flowing, moisture, facing, lit).
// Returns the store and the cells whose internal state has no exact original form.
export function fromLegacyWorld(world, { stateAt = null, hasSky = true } = {}) {
  const store = new ChunkStore(hasSky), n = SIZE / 16, k = 256;
  for (let cx = 0; cx < n; cx++)
    for (let cz = 0; cz < n; cz++) {
      const blocks = new Int16Array(256 * k), meta = new Uint8Array(256 * k);
      for (let lx = 0; lx < 16; lx++)
        for (let lz = 0; lz < 16; lz++) {
          const x = cx * 16 + lx, z = cz * 16 + lz, src = (x * SIZE + z) * HEIGHT;
          for (let y = 0; y < HEIGHT; y++) {
            const id = world.data[src + y];
            if (id === 0) continue;
            const m = world.meta[src + y], mapped = toOriginal(id, m, stateAt?.(x, y, z, id, m));
            if (!mapped) throw new RangeError(`no original block for internal id ${id}`);
            const i = lx * k * 16 + lz * k + y;
            blocks[i] = mapped[0];
            meta[i] = mapped[1];
          }
        }
      store.addChunk(Chunk.fromGeneration(blocks, meta, cx, cz, hasSky));
    }
  return store;
}

// Writes the legacy area of a store back into a World's data/meta arrays. Returns the cells that
// changed meaning: [x, y, z, originalId, originalMeta] for original blocks without a port family or
// without an exact port state, and the side state fromOriginal produced, keyed "x,y,z".
export function toLegacyWorld(store, world) {
  const inexact = [], state = new Map();
  for (let x = 0; x < SIZE; x++)
    for (let z = 0; z < SIZE; z++) {
      const c = store.getChunk(x >> 4, z >> 4), dst = (x * SIZE + z) * HEIGHT;
      for (let y = 0; y < HEIGHT; y++) {
        const mc = c ? c.getBlock(x & 15, y, z & 15) : 0, mm = c ? c.getMeta(x & 15, y, z & 15) : 0;
        const r = mc === 0 && mm === 0 ? { id: 0, meta: 0, exact: true } : fromOriginal(mc, mm);
        world.data[dst + y] = r ? r.id : 0;
        world.meta[dst + y] = r ? r.meta : 0;
        if (!r || !r.exact) inexact.push([x, y, z, mc, mm]);
        if (r?.state) state.set(`${x},${y},${z}`, r.state);
      }
    }
  world.tickCounts = null;
  return { inexact, state };
}
