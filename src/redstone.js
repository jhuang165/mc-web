// Minecraft Java 1.7.10 redstone power, headless (REDSTONE-01).
//
// Ports, from the unchanged 1.7.10 classes:
//   World (ahb): setBlock / setBlockMetadataWithNotify / notifyBlocksOfNeighborChange /
//     notifyBlockOfNeighborChange, isBlockProvidingPowerTo, getBlockPowerInput,
//     getIndirectPowerLevelTo, isBlockIndirectlyGettingPowered, getStrongestIndirectPower,
//     doesBlockHaveSolidTopSurface, isBlockNormalCubeDefault;
//   Chunk.func_150807_a / setBlockMetadata (apx): the block -> breakBlock -> metadata ->
//     onBlockAdded order, empty-section rules;
//   WorldServer (mt) pending ticks: HashSet + TreeSet of NextTickListEntry ordered by
//     time, priority and creation, the 1000-entry cap and the this-tick list;
//   BlockRedstoneWire (ana), BlockRedstoneTorch (anc) + BlockTorch (aoc) support,
//   BlockLever (alv), BlockButton (ajs, stone anx / wood aon), BlockRedstoneLight (anb),
//   BlockCompressedPowered (ams, block of redstone);
//   BlockRedstoneDiode (akj) + BlockRedstoneRepeater (anf, ids 93/94): delay, locking,
//   scheduled-tick priorities, facing; BlockRedstoneComparator (akc, ids 149/150) with its
//   TileEntityComparator output signal (aoz), compare/subtract mode and the container
//   comparator-override input (cauldron 118, end portal frame 120 and native container fullness);
//   World.func_147453_f (updateNeighbourForOutputSignal);
//   BlockBasePressurePlate (ajd) with BlockPressurePlate (amu, stone 70 / wood 72) and
//   BlockPressurePlateWeighted (aol, light 147 / heavy 148) over a scripted entity-box list;
//   BlockTripWireHook (aog, 131) and BlockTripWire (aof, 132) (tools/verify-tripwire.mjs);
//   Block.dropBlockAsItemWithChance / dropBlockAsItem_do world-Random draws.
//
// Pistons (REDSTONE-04, see the "Pistons" section below): BlockPistonBase (app, 29 / 33),
//   BlockPistonExtension (apq, 34), BlockPistonMoving (apr, 36) and TileEntityPiston (aps) with
//   the World / Chunk tile-entity bookkeeping they depend on (setTileEntity, getTileEntity,
//   removeTileEntity, the scanning flag and added list, Chunk.func_150806_e / func_150812_a /
//   removeChunkBlockTileEntity, World.updateEntities' tile-entity loop) and the WorldServer
//   double-buffered block event list (addBlockEvent / sendQueuedBlockEvents).
//
// Evidence: tools/probes/RedstoneProbe.java runs those classes in a real World and Chunks
// and records public/research/redstone-reference.json; src/redstone.test.js replays every
// scenario here. tools/probes/PistonProbe.java does the same for pistons and records
// public/research/piston-reference.json, replayed by src/pistons.test.js. Not ported: entity
// pushing by TileEntityPiston (scripted entity list stays empty), creative-mode head harvest,
// daylight refresh scheduling, powered rails/doors/TNT/
// note blocks and unported inventory block behaviors, entity physics, random ticks, lighting,
// rendering. This module is not wired into the live game.
import { JavaRandom } from "./java-random.js";

export const AIR = 0;
export const STONE = 1;
export const GLASS = 20;
export const SLAB = 44;
export const WIRE = 55;
export const LEVER = 69;
export const UNLIT_TORCH = 75;
export const TORCH = 76;
export const STONE_BUTTON = 77;
export const FENCE = 85;
export const GLOWSTONE = 89;
export const REPEATER = 93;
export const POWERED_REPEATER = 94;
export const NETHER_FENCE = 113;
export const LAMP = 123;
export const LIT_LAMP = 124;
export const CAULDRON = 118;
export const END_PORTAL_FRAME = 120;
export const DAYLIGHT_SENSOR = 151;
export const JUKEBOX = 84;
export const CHEST = 54;
export const FURNACE = 61;
export const LIT_FURNACE = 62;
export const DISPENSER = 23;
export const HOPPER = 154;
export const DROPPER = 158;
export const TRAPPED_CHEST = 146;
export const COBBLE_WALL = 139;
export const WOOD_BUTTON = 143;
export const COMPARATOR = 149;
export const POWERED_COMPARATOR = 150;
export const REDSTONE_BLOCK = 152;
export const STONE_PLATE = 70;
export const WOOD_PLATE = 72;
export const LIGHT_PLATE = 147;
export const HEAVY_PLATE = 148;
export const REDSTONE_ITEM = 331;
export const BEDROCK = 7;
export const TNT = 46;
export const WOODEN_DOOR = 64;
export const IRON_DOOR = 71;
export const STICKY_PISTON = 29;
export const PISTON = 33;
export const PISTON_HEAD = 34;
export const PISTON_MOVING = 36;
export const OBSIDIAN = 49;
export const TRIPWIRE_HOOK = 131;
export const TRIPWIRE = 132;

// Native block properties for every registered 1.7.10 block id, as dumped by RedstoneProbe:
// "id(base36).flags[.top(base36)]"; flags = materialOpaque*4 + renderAsNormalBlock*2 +
// canProvidePower; top = doesBlockHaveSolidTopSurface bitmask over metadata 0..15.
const PACKED =
  "0.2 1.6.1ekf 2.6.1ekf 3.6.1ekf 4.6.1ekf 5.6.1ekf 6.0 7.6.1ekf 8.0 9.0 a.0 b.0 c.6.1ekf d.6.1ekf e.6.1ekf f.6.1ekf g.6.1ekf h.6.1ekf i.2 j.6.1ekf k.0 l.6.1ekf m.6.1ekf n.6.1ekf o.6.1ekf p.6.1ekf q.4 r.0 s.1 t.4 u.0 v.0 w.0 x.4 y.4 z.6.1ekf 10.4 11.0 12.0 13.0 14.0 15.6.1ekf 16.6.1ekf 17.6.1ekf 18.4.1edc 19.6.1ekf 1a.2 1b.6.1ekf 1c.6.1ekf 1d.6.1ekf 1e.0 1f.0 1g.6.1ekf 1h.4.1blc 1i.4 1j.1 1k.6.1ekf 1l.6.1ekf 1m.6.1ekf 1n.0 1o.4 1p.6.1ekf 1q.6.1ekf 1r.4 1s.4 1t.0 1u.0 1v.4.1blc 1w.4 1x.1 1y.5 1z.4 20.5 21.6.1ekf 22.6.1ekf 23.1 24.1 25.1 26.0.pds 27.2 28.6.1ekf 29.0 2a.6.1ekf 2b.0 2c.6.1ekf 2d.4 2e.6.1ekf 2f.6.1ekf 2g.6.1ekf 2h.2 2i.0 2j.6.1ekf 2k.4 2l.1 2m.1 2n.0 2o.4 2p.6.1ekf 2q.6.1ekf 2r.6.1ekf 2s.6.1ekf 2t.4 2u.0 2v.6.1ekf 2w.0 2x.0 2y.0 2z.4 30.4.1blc 31.4.1blc 32.6.1ekf 33.0 34.6.1ekf 35.4 36.4.1blc 37.0 38.4 39.4 3a.4 3b.0 3c.6.1ekf 3d.6.1ekf 3e.4 3f.6.1ekf 3g.6.1ekf 3h.6.1ekf 3i.4.1edc 3j.0 3k.4.1blc 3l.6.1ekf 3m.4 3n.1 3o.0 3p.6.1ekf 3q.4.1blc 3r.4.1blc 3s.4.1blc 3t.6.1ekf 3u.0 3v.4 3w.0 3x.0 3y.0 3z.1 40.0 41.4 42.5 43.5 44.5 45.1 46.1 47.5 48.7.1ekf 49.6.1ekf 4a.4.1ekf 4b.6.1ekf 4c.4.1blc 4d.0 4e.6.1ekf 4f.6.1ekf 4g.0 4h.2 4i.6.1ekf 4j.4.1blc 4k.4.1blc 4q.6.1ekf 4r.0 4s.6.1ekf 4t.6.1ekf 4u.6.1ekf 4v.0";
const OPAQUE = new Uint8Array(256),
  RENDER_NORMAL = new Uint8Array(256),
  POWER = new Uint8Array(256),
  TOP = new Uint16Array(256),
  REGISTERED = new Uint8Array(256);
for (const entry of PACKED.split(" ")) {
  const [id36, flags, top] = entry.split("."),
    id = parseInt(id36, 36),
    f = Number(flags);
  REGISTERED[id] = 1;
  OPAQUE[id] = f >> 2;
  RENDER_NORMAL[id] = (f >> 1) & 1;
  POWER[id] = f & 1;
  TOP[id] = top ? parseInt(top, 36) : 0;
}
// [id, materialOpaque, renderAsNormalBlock, canProvidePower, isNormalCube, topMask] rows.
export function blockProperties() {
  const rows = [];
  for (let id = 0; id < 256; id++)
    if (REGISTERED[id]) rows.push([id, OPAQUE[id], RENDER_NORMAL[id], POWER[id], isNormalCubeId(id) ? 1 : 0, TOP[id]]);
  return rows;
}
// Block.isNormalCube: material.isOpaque() && renderAsNormalBlock() && !canProvidePower().
function isNormalCubeId(id) {
  return OPAQUE[id] === 1 && RENDER_NORMAL[id] === 1 && POWER[id] === 0;
}
// Block.isEqualTo(a, b): a == b || a.isAssociatedBlock(b). Torches pair lit/unlit; diodes pair
// with their powered state (BlockRedstoneDiode.func_149907_e). Used by NextTickListEntry.
function tickGroup(id) {
  if (id === TORCH || id === UNLIT_TORCH) return TORCH;
  if (id === REPEATER || id === POWERED_REPEATER) return REPEATER;
  if (id === COMPARATOR || id === POWERED_COMPARATOR) return COMPARATOR;
  return id;
}
export function isEqualTo(a, b) {
  return tickGroup(a) === tickGroup(b);
}

// ChunkPosition.hashCode: x * 8976890 + y * 981131 + z (int arithmetic).
export function chunkPositionHash(x, y, z) {
  return (Math.imul(x, 8976890) + Math.imul(y, 981131) + z) | 0;
}
// java.util.HashSet<ChunkPosition> as in Java 8 and later: HashMap.hash spreads h ^ (h >>> 16),
// buckets iterate in index order and keep insertion order, resize doubles and splits
// without reordering, clear() keeps the table. Tree bins (a 9-entry bucket in a 64+ table)
// are not modelled and throw; BlockRedstoneWire never holds more than seven positions.
// Java 7's HashMap (other spreading, head insertion) would iterate differently.
export class ChunkPositionSet {
  constructor() {
    this.table = Array.from({ length: 16 }, () => []);
    this.size = 0;
  }
  add(x, y, z) {
    const h = chunkPositionHash(x, y, z),
      spread = h ^ (h >>> 16),
      bucket = this.table[spread & (this.table.length - 1)];
    for (const p of bucket) if (p.x === x && p.y === y && p.z === z) return false;
    bucket.push({ x, y, z, spread });
    if (bucket.length > 8 && this.table.length >= 64) throw new Error("HashMap tree bins are not modelled");
    if (bucket.length > 8) this.resize();
    if (++this.size > this.table.length * 0.75) this.resize();
    return true;
  }
  resize() {
    const old = this.table;
    this.table = Array.from({ length: old.length * 2 }, () => []);
    for (const bucket of old) for (const p of bucket) this.table[p.spread & (this.table.length - 1)].push(p);
  }
  toArray() {
    return this.table.flat();
  }
  clear() {
    for (const bucket of this.table) bucket.length = 0;
    this.size = 0;
  }
}

const F07 = Math.fround(0.7),
  DROP_OFFSET = Math.fround(1 - F07) * 0.5,
  F08 = Math.fround(0.8),
  F26 = Math.fround(2.6);

// A headless 1.7.10 world: 16x16x16 sections that appear on the first non-air write, the
// native setBlock/notification semantics, a WorldServer pending-tick list, the world Random
// and the redstone blocks above. Other block ids are inert (no callbacks, no power).
export class RedstoneWorld {
  constructor({ seed = 0, log = false, sky = 15, skylightSubtracted = 0, celestialAngle = 0, noSky = false } = {}) {
    this.sections = new Map();
    // Block behaviours by original id; registerBehaviour adds to this world only (the shared table is never modified).
    this.behaviours = Object.create(BEHAVIOUR);
    this.primed = []; // primeTnt positions (standalone world); the live game's hook replaces this
    this.rand = new JavaRandom(seed);
    this.time = 0; // WorldInfo total world time
    this.sky = sky;
    this.skylightSubtracted = skylightSubtracted;
    this.celestialAngle = celestialAngle;
    this.noSky = noSky;
    this.pending = new Map(); // pendingTickListEntriesHashSet
    this.tree = []; // pendingTickListEntriesTreeSet, sorted
    this.thisTick = []; // pendingTickListEntriesThisTick
    this.serial = 0; // NextTickListEntry.nextTickEntryID
    this.wireUpdates = new ChunkPositionSet(); // BlockRedstoneWire.blocksNeedingUpdate
    this.wiresProvidePower = true; // BlockRedstoneWire.wiresProvidePower
    this.torchToggles = null; // BlockRedstoneTorch.toggles.get(world)
    this.doTileDrops = true;
    this.tiles = new Map(); // comparator and container tiles by "x,y,z"
    this.entities = []; // scripted entity boxes for pressure plates: { kind, box: [x0,y0,z0,x1,y1,z1] }
    this.sounds = [];
    this.drops = [];
    this.log = log ? [] : null;
    // Pistons: WorldServer block events (two ArrayLists swapped by index) and the World tile-entity lists.
    this.blockEvents = [[], []]; // WorldServer.blockEventCache
    this.blockEventIndex = 0; // WorldServer.blockEventCacheIndex
    this.chunkTiles = new Map(); // Chunk.chunkTileEntityMap by "x,y,z" (every chunk is loaded)
    this.loadedTiles = []; // World.loadedTileEntityList
    this.addedTiles = []; // World.addedTileEntityList
    this.scanning = false; // World.field_147481_N (set while updateEntities runs its tile-entity loop)
  }
  record(entry) {
    if (this.log) this.log.push(entry);
  }
  // Adds or replaces the behaviour of an original block id for this world (BEHAVIOUR shape).
  registerBehaviour(id, behaviour) {
    this.behaviours[id] = behaviour;
  }
  // BlockTNT.onBlockDestroyedByPlayer(meta 1): an EntityTNTPrimed at the block centre. The live world forwards it to its hook.
  primeTnt(x, y, z) {
    this.record(`g,${x},${y},${z}`);
    this.primed.push({ x, y, z });
  }
  // World.playAuxSFXAtEntity(null, id, x, y, z, 0): recorded; the live world plays door sounds from it.
  playAuxSFX(id, x, y, z) {
    this.record(`a,${id},${x},${y},${z}`);
  }
  section(x, y, z, create) {
    const key = `${x >> 4},${y >> 4},${z >> 4}`;
    let s = this.sections.get(key);
    if (!s && create) this.sections.set(key, (s = { ids: new Uint8Array(4096), meta: new Uint8Array(4096) }));
    return s;
  }
  static index(x, y, z) {
    return ((y & 15) << 8) | ((z & 15) << 4) | (x & 15);
  }
  static inside(x, z) {
    return x >= -30000000 && z >= -30000000 && x < 30000000 && z < 30000000;
  }
  getBlock(x, y, z) {
    if (!RedstoneWorld.inside(x, z) || y < 0 || y >= 256) return AIR;
    const s = this.section(x, y, z, false);
    return s ? s.ids[RedstoneWorld.index(x, y, z)] : AIR;
  }
  getBlockMetadata(x, y, z) {
    if (!RedstoneWorld.inside(x, z) || y < 0 || y >= 256) return 0;
    const s = this.section(x, y, z, false);
    return s ? s.meta[RedstoneWorld.index(x, y, z)] : 0;
  }
  // Direct section write without callbacks (terrain setup only).
  setRaw(x, y, z, id, meta = 0) {
    if (id === AIR && !this.section(x, y, z, false)) return;
    const s = this.section(x, y, z, true),
      i = RedstoneWorld.index(x, y, z);
    s.ids[i] = id;
    s.meta[i] = meta;
  }
  // World.setBlock(x, y, z, block, meta, flags) with Chunk.func_150807_a inside.
  setBlock(x, y, z, id, meta, flags) {
    this.record(`s,${x},${y},${z},${id},${meta},${flags}`);
    if (!RedstoneWorld.inside(x, z) || y < 0 || y >= 256) return false;
    const before = (flags & 1) !== 0 ? this.getBlock(x, y, z) : null;
    const old = this.getBlock(x, y, z),
      oldMeta = this.getBlockMetadata(x, y, z);
    if (old === id && oldMeta === meta) return false;
    let s = this.section(x, y, z, false);
    if (!s) {
      if (id === AIR) return false;
      s = this.section(x, y, z, true);
    }
    const i = RedstoneWorld.index(x, y, z);
    s.ids[i] = id;
    if (isContainerId(old) && old !== id) this.tiles.delete(`${x},${y},${z}`);
    this.behaviours[old]?.breakBlock?.(this, x, y, z, old, oldMeta);
    if (s.ids[i] !== id) return false;
    s.meta[i] = meta;
    if (old === PISTON_MOVING) this.chunkTile(x, y, z);
    this.behaviours[id]?.onBlockAdded?.(this, x, y, z);
    if (id === PISTON_MOVING && !this.chunkTile(x, y, z)) this.setTileEntity(x, y, z, createNewTileEntity(id));
    if ((flags & 1) !== 0) {
      this.notifyBlocksOfNeighborChange(x, y, z, before);
      if (hasComparatorOverride(id)) this.updateNeighbourForOutputSignal(x, y, z, id);
    }
    return true;
  }
  setBlockToAir(x, y, z) {
    return this.setBlock(x, y, z, AIR, 0, 3);
  }
  // World.setBlockMetadataWithNotify with Chunk.setBlockMetadata.
  setBlockMetadataWithNotify(x, y, z, meta, flags) {
    this.record(`m,${x},${y},${z},${meta},${flags}`);
    if (!RedstoneWorld.inside(x, z) || y < 0 || y >= 256) return false;
    const s = this.section(x, y, z, false);
    if (!s) return false;
    const i = RedstoneWorld.index(x, y, z);
    if (s.meta[i] === meta) return false;
    s.meta[i] = meta;
    if ((flags & 1) !== 0) {
      this.notifyBlocksOfNeighborChange(x, y, z, s.ids[i]);
      if (hasComparatorOverride(s.ids[i])) this.updateNeighbourForOutputSignal(x, y, z, s.ids[i]);
    }
    return true;
  }
  // World.notifyBlocksOfNeighborChange: x-1, x+1, y-1, y+1, z-1, z+1.
  notifyBlocksOfNeighborChange(x, y, z, source) {
    this.notifyBlockOfNeighborChange(x - 1, y, z, source);
    this.notifyBlockOfNeighborChange(x + 1, y, z, source);
    this.notifyBlockOfNeighborChange(x, y - 1, z, source);
    this.notifyBlockOfNeighborChange(x, y + 1, z, source);
    this.notifyBlockOfNeighborChange(x, y, z - 1, source);
    this.notifyBlockOfNeighborChange(x, y, z + 1, source);
  }
  // World.func_147441_b: notifyBlocksOfNeighborChange without the neighbour on `side`
  // (Facing index of the neighbour to skip: 0 y-1, 1 y+1, 2 z-1, 3 z+1, 4 x-1, 5 x+1).
  notifyBlocksOfNeighborChangeExcept(x, y, z, source, side) {
    if (side !== 4) this.notifyBlockOfNeighborChange(x - 1, y, z, source);
    if (side !== 5) this.notifyBlockOfNeighborChange(x + 1, y, z, source);
    if (side !== 0) this.notifyBlockOfNeighborChange(x, y - 1, z, source);
    if (side !== 1) this.notifyBlockOfNeighborChange(x, y + 1, z, source);
    if (side !== 2) this.notifyBlockOfNeighborChange(x, y, z - 1, source);
    if (side !== 3) this.notifyBlockOfNeighborChange(x, y, z + 1, source);
  }
  // World.func_147453_f: tell comparators beside a comparator-override block (or one solid
  // block further) that the block's output changed. Calls onNeighborBlockChange directly
  // (no notifyBlockOfNeighborChange, so nothing is logged for the call itself).
  updateNeighbourForOutputSignal(x, y, z, source) {
    for (let i = 0; i < 4; i++) {
      let nx = x + DIR_X[i],
        nz = z + DIR_Z[i];
      let id = this.getBlock(nx, y, nz);
      if (isComparatorId(id)) this.behaviours[id].onNeighborBlockChange(this, nx, y, nz, source);
      else if (this.isNormalCube(id)) {
        nx += DIR_X[i];
        nz += DIR_Z[i];
        id = this.getBlock(nx, y, nz);
        if (isComparatorId(id)) this.behaviours[id].onNeighborBlockChange(this, nx, y, nz, source);
      }
    }
  }
  // World.getTileEntity for a comparator: Chunk.func_150806_e creates one lazily when absent.
  comparatorTile(x, y, z) {
    const key = `${x},${y},${z}`;
    let t = this.tiles.get(key);
    if (!t) this.tiles.set(key, (t = { signal: 0 }));
    return t;
  }
  containerTile(x, y, z, id = this.getBlock(x, y, z)) {
    const key = `${x},${y},${z}`;
    let tile = this.tiles.get(key);
    if (!tile || !tile.slots) {
      const size = id === CHEST || id === TRAPPED_CHEST ? 27 : id === HOPPER ? 5 : id === DISPENSER || id === DROPPER ? 9 : id === JUKEBOX ? 1 : 3;
      tile = { slots: Array(size).fill(null), id, record: null };
      this.tiles.set(key, tile);
    }
    return tile;
  }
  setContainerSlot(x, y, z, slot, item, count, max = itemStackLimit(item), meta = 0) {
    const tile = this.containerTile(x, y, z);
    tile.slots[slot] = count > 0 ? { item, count, max, meta } : null;
    if (tile.id === CHEST || tile.id === TRAPPED_CHEST) this.updateNeighbourForOutputSignal(x, y, z, tile.id);
  }
  notifyBlockOfNeighborChange(x, y, z, source) {
    this.record(`n,${x},${y},${z},${source}`);
    this.behaviours[this.getBlock(x, y, z)]?.onNeighborBlockChange?.(this, x, y, z, source);
  }
  // WorldServer.scheduleBlockUpdateWithPriority (scheduleBlockUpdate uses priority 0).
  scheduleBlockUpdate(x, y, z, id, delay, priority = 0) {
    this.record(`t,${x},${y},${z},${id},${delay},${priority}`);
    const entry = { x, y, z, id, time: 0, priority: 0, serial: this.serial++ };
    if (id !== AIR) {
      entry.time = delay + this.time;
      entry.priority = priority;
    }
    const key = `${x},${y},${z},${tickGroup(id)}`;
    if (this.pending.has(key)) return;
    this.pending.set(key, entry);
    let lo = 0,
      hi = this.tree.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (compareEntries(this.tree[mid], entry) < 0) lo = mid + 1;
      else hi = mid;
    }
    this.tree.splice(lo, 0, entry);
  }
  // Re-inserts a saved pending tick (live save/reload); the entry keeps its time, priority and serial.
  restorePending(e) {
    const key = `${e.x},${e.y},${e.z},${tickGroup(e.id)}`;
    if (this.pending.has(key)) return;
    const entry = { x: e.x, y: e.y, z: e.z, id: e.id, time: e.time, priority: e.priority, serial: e.serial };
    this.serial = Math.max(this.serial, entry.serial + 1);
    this.pending.set(key, entry);
    let lo = 0,
      hi = this.tree.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (compareEntries(this.tree[mid], entry) < 0) lo = mid + 1;
      else hi = mid;
    }
    this.tree.splice(lo, 0, entry);
  }
  isBlockTickScheduledThisTick(x, y, z, id) {
    return this.thisTick.some((e) => e.x === x && e.y === y && e.z === z && isEqualTo(e.id, id));
  }
  // One server tick as far as redstone sees it: total world time advances, then tickUpdates.
  // Random block ticks (BlockTorch.tickRandomly) are not run.
  tick() {
    this.time++;
    this.tickUpdates();
  }
  // WorldServer.tickUpdates(false).
  tickUpdates() {
    const n = Math.min(this.tree.length, 1000);
    for (let i = 0; i < n; i++) {
      const e = this.tree[0];
      if (e.time > this.time) break;
      this.tree.shift();
      this.pending.delete(`${e.x},${e.y},${e.z},${tickGroup(e.id)}`);
      this.thisTick.push(e);
    }
    while (this.thisTick.length) {
      const e = this.thisTick.shift(),
        id = this.getBlock(e.x, e.y, e.z);
      if (id === AIR || !isEqualTo(id, e.id)) continue;
      this.record(`u,${e.x},${e.y},${e.z},${id}`);
      this.behaviours[id]?.updateTick?.(this, e.x, e.y, e.z);
    }
  }
  pendingTicks() {
    return this.tree.map((e) => ({ ...e }));
  }
  // Player right click: Block.onBlockActivated (lever, buttons, repeater, comparator).
  activate(x, y, z) {
    return this.behaviours[this.getBlock(x, y, z)]?.onBlockActivated?.(this, x, y, z) ?? false;
  }
  // ItemReed.onItemUse for a diode: setBlock(id, 0, 3) then Block.onBlockPlacedBy with a placer
  // looking along `yaw` degrees (EntityLivingBase.rotationYaw).
  placeBy(x, y, z, id, yaw) {
    if (!this.setBlock(x, y, z, id, 0, 3) || this.getBlock(x, y, z) !== id) return false;
    this.behaviours[id]?.onBlockPlacedBy?.(this, x, y, z, yaw);
    return true;
  }
  // Entity touches the block (Block.onEntityCollidedWithBlock), for pressure plates.
  collide(x, y, z) {
    this.behaviours[this.getBlock(x, y, z)]?.onEntityCollidedWithBlock?.(this, x, y, z);
  }
  // World.getEntitiesWithinAABB over the scripted list. `mode` is the class asked for: "all"
  // (Entity), "living" (EntityLivingBase: mobs and players) or "player". The boxes intersect
  // with AxisAlignedBB.intersectsWith (strict on every axis).
  getEntities(mode, [x0, y0, z0, x1, y1, z1]) {
    return this.entities.filter(
      (e) =>
        (mode === "all" || (mode === "living" && e.kind !== "item" && e.kind !== "minecart") || (mode === "player" && e.kind === "player") || (mode === "minecart" && e.kind === "minecart") || (mode === "inventory" && e.kind === "minecart" && e.signal !== undefined)) &&
        e.box[3] > x0 &&
        e.box[0] < x1 &&
        e.box[4] > y0 &&
        e.box[1] < y1 &&
        e.box[5] > z0 &&
        e.box[2] < z1,
    );
  }

  isNormalCube(id) {
    return id === WIRE ? false : isNormalCubeId(id);
  }
  canProvidePower(id) {
    return id === WIRE ? this.wiresProvidePower : POWER[id] === 1;
  }
  // World.doesBlockHaveSolidTopSurface.
  doesBlockHaveSolidTopSurface(x, y, z) {
    return ((TOP[this.getBlock(x, y, z)] >> this.getBlockMetadata(x, y, z)) & 1) === 1;
  }
  // World.isBlockNormalCubeDefault: every chunk here exists, so only the x/z bound uses the default.
  isBlockNormalCubeDefault(x, y, z, fallback) {
    if (!RedstoneWorld.inside(x, z)) return fallback;
    const id = this.getBlock(x, y, z);
    return OPAQUE[id] === 1 && RENDER_NORMAL[id] === 1;
  }
  weakPower(x, y, z, side) {
    return this.behaviours[this.getBlock(x, y, z)]?.weak?.(this, x, y, z, side) ?? 0;
  }
  strongPower(x, y, z, side) {
    return this.behaviours[this.getBlock(x, y, z)]?.strong?.(this, x, y, z, side) ?? 0;
  }
  // World.isBlockProvidingPowerTo.
  isBlockProvidingPowerTo(x, y, z, side) {
    return this.strongPower(x, y, z, side);
  }
  // World.getBlockPowerInput: strong power into (x, y, z), sides down, up, north, south, west, east.
  getBlockPowerInput(x, y, z) {
    let p = 0;
    if ((p = Math.max(p, this.isBlockProvidingPowerTo(x, y - 1, z, 0))) >= 15) return p;
    if ((p = Math.max(p, this.isBlockProvidingPowerTo(x, y + 1, z, 1))) >= 15) return p;
    if ((p = Math.max(p, this.isBlockProvidingPowerTo(x, y, z - 1, 2))) >= 15) return p;
    if ((p = Math.max(p, this.isBlockProvidingPowerTo(x, y, z + 1, 3))) >= 15) return p;
    if ((p = Math.max(p, this.isBlockProvidingPowerTo(x - 1, y, z, 4))) >= 15) return p;
    return Math.max(p, this.isBlockProvidingPowerTo(x + 1, y, z, 5));
  }
  // World.getIndirectPowerLevelTo.
  getIndirectPowerLevelTo(x, y, z, side) {
    return this.isNormalCube(this.getBlock(x, y, z)) ? this.getBlockPowerInput(x, y, z) : this.weakPower(x, y, z, side);
  }
  isBlockIndirectlyProvidingPowerTo(x, y, z, side) {
    return this.getIndirectPowerLevelTo(x, y, z, side) > 0;
  }
  // World.isBlockIndirectlyGettingPowered.
  isBlockIndirectlyGettingPowered(x, y, z) {
    return (
      this.getIndirectPowerLevelTo(x, y - 1, z, 0) > 0 ||
      this.getIndirectPowerLevelTo(x, y + 1, z, 1) > 0 ||
      this.getIndirectPowerLevelTo(x, y, z - 1, 2) > 0 ||
      this.getIndirectPowerLevelTo(x, y, z + 1, 3) > 0 ||
      this.getIndirectPowerLevelTo(x - 1, y, z, 4) > 0 ||
      this.getIndirectPowerLevelTo(x + 1, y, z, 5) > 0
    );
  }
  // World.getStrongestIndirectPower, Facing offsets in side order 0..5.
  getStrongestIndirectPower(x, y, z) {
    let best = 0;
    for (let i = 0; i < 6; i++) {
      const p = this.getIndirectPowerLevelTo(x + FACING_X[i], y + FACING_Y[i], z + FACING_Z[i], i);
      if (p >= 15) return 15;
      if (p > best) best = p;
    }
    return best;
  }
  // WorldServer.addBlockEvent: skip an event equal to one already in the list being filled.
  addBlockEvent(x, y, z, id, event, param) {
    this.record(`b,${x},${y},${z},${id},${event},${param}`);
    for (const d of this.blockEvents[this.blockEventIndex])
      if (d.x === x && d.y === y && d.z === z && d.id === id && d.event === event && d.param === param) return;
    this.blockEvents[this.blockEventIndex].push({ x, y, z, id, event, param });
  }
  // WorldServer.sendQueuedBlockEvents: deliver one list while new events fill the other, until both are empty.
  // An event whose block no longer stands at its position is dropped.
  sendQueuedBlockEvents() {
    while (this.blockEvents[this.blockEventIndex].length) {
      const i = this.blockEventIndex;
      this.blockEventIndex ^= 1;
      for (const d of this.blockEvents[i]) {
        const id = this.getBlock(d.x, d.y, d.z);
        if (id !== d.id) continue;
        this.record(`v,${d.x},${d.y},${d.z},${id},${d.event},${d.param}`);
        const r = this.behaviours[id]?.onBlockEventReceived?.(this, d.x, d.y, d.z, d.event, d.param) ?? false;
        this.record(`r,${r ? 1 : 0}`);
      }
      this.blockEvents[i].length = 0;
    }
  }
  queuedBlockEvents() {
    return this.blockEvents[this.blockEventIndex].map((d) => ({ ...d }));
  }
  // Chunk.func_150806_e (getTileEntity with creation) for the piston-moving block, the only tile entity
  // block modelled here: a missing entry makes the block's createNewTileEntity (null) go through
  // World.setTileEntity; an invalidated entry is dropped.
  chunkTile(x, y, z) {
    const key = `${x},${y},${z}`;
    let te = this.chunkTiles.get(key);
    if (!te) {
      const id = this.getBlock(x, y, z);
      if (id !== PISTON_MOVING) return null;
      te = createNewTileEntity(id);
      this.setTileEntity(x, y, z, te);
    }
    if (te && te.invalid) {
      this.chunkTiles.delete(key);
      return null;
    }
    return te;
  }
  // Chunk.func_150812_a (setChunkBlockTileEntity): only for a tile-entity block; replaces and invalidates the old entry.
  chunkSetTile(x, y, z, te) {
    te.world = true;
    te.x = x;
    te.y = y;
    te.z = z;
    if (this.getBlock(x, y, z) !== PISTON_MOVING) return;
    const key = `${x},${y},${z}`,
      old = this.chunkTiles.get(key);
    if (old) old.invalid = true;
    te.invalid = false;
    this.chunkTiles.set(key, te);
  }
  // Chunk.removeChunkBlockTileEntity.
  chunkRemoveTile(x, y, z) {
    const key = `${x},${y},${z}`,
      te = this.chunkTiles.get(key);
    if (!te) return;
    this.chunkTiles.delete(key);
    te.invalid = true;
  }
  // World.getTileEntity.
  getTileEntity(x, y, z) {
    if (y < 0 || y >= 256) return null;
    let te = null;
    if (this.scanning) te = this.addedTiles.find((t) => !t.invalid && t.x === x && t.y === y && t.z === z) ?? null;
    if (!te) te = this.chunkTile(x, y, z);
    if (!te) te = this.addedTiles.find((t) => !t.invalid && t.x === x && t.y === y && t.z === z) ?? null;
    return te;
  }
  // World.setTileEntity (logged even for null, as the chunk's creation path calls it with null).
  setTileEntity(x, y, z, te) {
    this.record(`k,${x},${y},${z}`);
    if (!te || te.invalid) return;
    if (this.scanning) {
      te.x = x;
      te.y = y;
      te.z = z;
      this.addedTiles = this.addedTiles.filter((t) => {
        if (t.x === x && t.y === y && t.z === z) {
          t.invalid = true;
          return false;
        }
        return true;
      });
      this.addedTiles.push(te);
    } else {
      this.loadedTiles.push(te);
      this.chunkSetTile(x, y, z, te);
    }
  }
  // World.removeTileEntity.
  removeTileEntity(x, y, z) {
    this.record(`K,${x},${y},${z}`);
    const te = this.getTileEntity(x, y, z);
    if (te && this.scanning) {
      te.invalid = true;
      this.addedTiles = this.addedTiles.filter((t) => t !== te);
    } else {
      if (te) {
        this.addedTiles = this.addedTiles.filter((t) => t !== te);
        this.loadedTiles = this.loadedTiles.filter((t) => t !== te);
      }
      this.chunkRemoveTile(x, y, z);
    }
  }
  // The tile-entity part of World.updateEntities: update every loaded entity (tile entities created while
  // scanning wait in the added list), drop invalid ones and their chunk entry, then adopt the added ones.
  updateTileEntities() {
    this.scanning = true;
    for (let i = 0; i < this.loadedTiles.length; ) {
      const te = this.loadedTiles[i];
      if (!te.invalid && te.world && te.y >= 0 && te.y < 256) tileUpdate(this, te);
      if (te.invalid) {
        this.loadedTiles.splice(i, 1);
        this.chunkRemoveTile(te.x, te.y, te.z);
      } else i++;
    }
    this.scanning = false;
    for (const te of this.addedTiles) {
      if (te.invalid) continue;
      if (!this.loadedTiles.includes(te)) this.loadedTiles.push(te);
      this.chunkSetTile(te.x, te.y, te.z, te);
    }
    this.addedTiles = [];
  }
  pistonTiles() {
    return this.loadedTiles.filter((t) => t.kind === "piston");
  }
  playSoundEffect(x, y, z, name, volume, pitch) {
    this.record(`p,${name}`);
    this.sounds.push({ x, y, z, name, volume, pitch });
  }
  // Block.dropBlockAsItem(world, x, y, z, meta, 0): one item, chance 1, three offset floats.
  dropBlockAsItem(x, y, z, id, meta) {
    if (this.rand.nextFloat() > 1) return;
    if (isDoorId(id) && (meta & 8) !== 0) return; // BlockDoor.getItemDropped: the upper half drops nothing
    const item = DROP_ITEM[id] ?? id;
    if (!this.doTileDrops) return;
    const dx = Math.fround(this.rand.nextFloat() * F07) + DROP_OFFSET,
      dy = Math.fround(this.rand.nextFloat() * F07) + DROP_OFFSET,
      dz = Math.fround(this.rand.nextFloat() * F07) + DROP_OFFSET;
    this.record(`e,${item}`);
    this.drops.push({ x: x + dx, y: y + dy, z: z + dz, item, count: 1, damage: 0 });
  }
}
const FACING_X = [0, 0, 0, 0, -1, 1],
  FACING_Y = [-1, 1, 0, 0, 0, 0],
  FACING_Z = [0, 0, -1, 1, 0, 0];
// Direction.rotateOpposite.
const ROTATE_OPPOSITE = [2, 3, 0, 1];
const DROP_ITEM = {
  [WIRE]: REDSTONE_ITEM,
  [UNLIT_TORCH]: TORCH,
  [LIT_LAMP]: LAMP,
  [REPEATER]: 356,
  [POWERED_REPEATER]: 356,
  [COMPARATOR]: 404,
  [POWERED_COMPARATOR]: 404,
  [WOODEN_DOOR]: 324,
  [IRON_DOOR]: 330,
  [TRIPWIRE]: 287,
};
// Direction.offsetX / offsetZ and directionToFacing (south, west, north, east).
const DIR_X = [0, -1, 0, 1],
  DIR_Z = [1, 0, -1, 0],
  DIR_TO_FACING = [3, 4, 2, 5];
function isDoorId(id) {
  return id === WOODEN_DOOR || id === IRON_DOOR;
}
function isComparatorId(id) {
  return id === COMPARATOR || id === POWERED_COMPARATOR;
}
// Block.hasComparatorInputOverride among the supported ids.
export function hasComparatorOverride(id) {
  return id === 137 || id === 84 || id === 28 || id === CAULDRON || id === END_PORTAL_FRAME || isContainerId(id);
}
// Block.getComparatorInputOverride: cauldron level (metadata), end portal frame eye (15 or 0).
function comparatorOverride(w, id, x, y, z) {
  const m = w.getBlockMetadata(x, y, z);
  if (id === 137) return w.behaviours[137]?.comparator?.(w, x, y, z) ?? 0;
  if (id === 28) return w.behaviours[28]?.comparator?.(w, x, y, z) ?? 0; // BlockRailDetector (powered-rails.js)
  if (id === 84) return w.behaviours[84]?.comparator?.(w, x, y, z) ?? 0; // BlockJukebox: disc index + 1 (jukebox.js)
  if (id === CAULDRON) return m;
  if (id === END_PORTAL_FRAME) return (m & 4) !== 0 ? 15 : 0;
  return containerComparatorSignal(w, x, y, z, id);
}
function isContainerId(id) {
  return id === CHEST || id === TRAPPED_CHEST || id === FURNACE || id === LIT_FURNACE || id === DISPENSER || id === DROPPER || id === HOPPER || id === 117; // 117: brewing stand (BlockBrewingStand.hasComparatorInputOverride)
}
export function itemStackLimit(item) {
  return ITEM_STACK_LIMITS.get(item) ?? 64;
}
// Native Item.getItemStackLimit values for every non-64 item registered in 1.7.10.
const ITEM_STACK_LIMITS = new Map([
  ...[256,257,258,259,261,267,268,269,270,271,272,273,274,275,276,277,278,279,282,283,284,285,286,290,291,292,293,294,298,299,300,301,302,303,304,305,306,307,308,309,310,311,312,313,314,315,316,317,324,326,327,328,329,330,333,335,342,343,346,354,355,359,373,386,398,403,407,408,417,418,419,422,2256,2257,2258,2259,2260,2261,2262,2263,2264,2265,2266,2267].map((id) => [id, 1]),
  ...[323,325,332,344,368,387].map((id) => [id, 16]),
]);
function containerComparatorSignal(w, x, y, z, id) {
  if ((id === CHEST || id === TRAPPED_CHEST) && w.isNormalCube(w.getBlock(x, y + 1, z))) return 0;
  let parts = [w.containerTile(x, y, z, id)];
  if (id === CHEST || id === TRAPPED_CHEST) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (w.getBlock(x + dx, y, z + dz) === id) {
        if (w.isNormalCube(w.getBlock(x + dx, y + 1, z + dz))) return 0;
        parts = [parts[0], w.containerTile(x + dx, y, z + dz, id)];
        break;
      }
    }
  }
  const slots = parts.flatMap((p) => p.slots);
  let fullness = Math.fround(0), occupied = false;
  for (const stack of slots) if (stack && stack.count > 0) {
    occupied = true;
    fullness = Math.fround(fullness + Math.fround(stack.count / Math.min(64, stack.max)));
  }
  fullness = Math.fround(fullness / slots.length);
  return occupied ? Math.floor(Math.fround(fullness * 14)) + 1 : 0;
}
const SIN_TABLE = Float32Array.from({ length: 65536 }, (_, i) => Math.fround(Math.sin((i * Math.PI * 2) / 65536)));
function daylightCos(angle) {
  const scaled = Math.fround(Math.fround(angle) * Math.fround(10430.378));
  const index = Math.trunc(Math.fround(scaled + 16384)) & 65535;
  return SIN_TABLE[index];
}
export function refreshDaylightSensor(w, x, y, z) {
  if (w.noSky) return;
  const sky = w.sky - w.skylightSubtracted;
  let angle = Math.fround(w.celestialAngle);
  if (angle < Math.fround(3.1415927)) angle = Math.fround(angle + Math.fround(Math.fround(0 - angle) * Math.fround(0.2)));
  else angle = Math.fround(angle + Math.fround(Math.fround(Math.fround(6.2831855) - angle) * Math.fround(0.2)));
  let signal = Math.floor(Math.fround(Math.fround(Math.fround(sky) * daylightCos(angle)) + 0.5));
  signal = Math.max(0, Math.min(15, signal));
  if (w.getBlockMetadata(x, y, z) !== signal) w.setBlockMetadataWithNotify(x, y, z, signal, 3);
}
function compareEntries(a, b) {
  if (a.time !== b.time) return a.time < b.time ? -1 : 1;
  if (a.priority !== b.priority) return a.priority - b.priority;
  return a.serial - b.serial;
}

// ---- BlockRedstoneWire (ana) ----
// isPowerProviderOrWire (func_150174_f).
export function isPowerProviderOrWire(w, x, y, z, dir) {
  const id = w.getBlock(x, y, z);
  if (id === WIRE) return true;
  if (id === REPEATER || id === POWERED_REPEATER) {
    const m = w.getBlockMetadata(x, y, z);
    return dir === (m & 3) || dir === ROTATE_OPPOSITE[m & 3];
  }
  return w.canProvidePower(id) && dir !== -1;
}
// func_150176_g.
export function isPoweredOrRepeater(w, x, y, z, dir) {
  if (isPowerProviderOrWire(w, x, y, z, dir)) return true;
  return w.getBlock(x, y, z) === POWERED_REPEATER && dir === (w.getBlockMetadata(x, y, z) & 3);
}
function maxWire(w, x, y, z, current) {
  if (w.getBlock(x, y, z) !== WIRE) return current;
  const m = w.getBlockMetadata(x, y, z);
  return m > current ? m : current;
}
// func_150175_a (calculateCurrentChanges).
function wireCalculate(w, x, y, z, sx, sy, sz) {
  const before = w.getBlockMetadata(x, y, z);
  let power = maxWire(w, sx, sy, sz, 0);
  w.wiresProvidePower = false;
  const input = w.getStrongestIndirectPower(x, y, z);
  w.wiresProvidePower = true;
  if (input > 0 && input > power - 1) power = input;
  let wires = 0;
  for (let i = 0; i < 4; i++) {
    let nx = x,
      nz = z;
    if (i === 0) nx--;
    if (i === 1) nx++;
    if (i === 2) nz--;
    if (i === 3) nz++;
    if (nx !== sx || nz !== sz) wires = maxWire(w, nx, y, nz, wires);
    if (w.isNormalCube(w.getBlock(nx, y, nz)) && !w.isNormalCube(w.getBlock(x, y + 1, z))) {
      if ((nx === sx && nz === sz) || y < sy) continue;
      wires = maxWire(w, nx, y + 1, nz, wires);
      continue;
    }
    if (w.isNormalCube(w.getBlock(nx, y, nz)) || (nx === sx && nz === sz) || y > sy) continue;
    wires = maxWire(w, nx, y - 1, nz, wires);
  }
  power = wires > power ? wires - 1 : power > 0 ? power - 1 : 0;
  if (input > power - 1) power = input;
  if (before !== power) {
    w.setBlockMetadataWithNotify(x, y, z, power, 2);
    const set = w.wireUpdates;
    set.add(x, y, z);
    set.add(x - 1, y, z);
    set.add(x + 1, y, z);
    set.add(x, y - 1, z);
    set.add(x, y + 1, z);
    set.add(x, y, z - 1);
    set.add(x, y, z + 1);
  }
}
// updateAndPropagateCurrentStrength (func_150177_e).
function wireUpdate(w, x, y, z) {
  wireCalculate(w, x, y, z, x, y, z);
  const list = w.wireUpdates.toArray();
  w.wireUpdates.clear();
  for (const p of list) w.notifyBlocksOfNeighborChange(p.x, p.y, p.z, WIRE);
}
// func_150172_m (notifyWireNeighborsOfNeighborChange).
function wireNotify(w, x, y, z) {
  if (w.getBlock(x, y, z) !== WIRE) return;
  w.notifyBlocksOfNeighborChange(x, y, z, WIRE);
  w.notifyBlocksOfNeighborChange(x - 1, y, z, WIRE);
  w.notifyBlocksOfNeighborChange(x + 1, y, z, WIRE);
  w.notifyBlocksOfNeighborChange(x, y, z - 1, WIRE);
  w.notifyBlocksOfNeighborChange(x, y, z + 1, WIRE);
  w.notifyBlocksOfNeighborChange(x, y - 1, z, WIRE);
  w.notifyBlocksOfNeighborChange(x, y + 1, z, WIRE);
}
function wireNotifyAround(w, x, y, z) {
  wireNotify(w, x - 1, y, z);
  wireNotify(w, x + 1, y, z);
  wireNotify(w, x, y, z - 1);
  wireNotify(w, x, y, z + 1);
  wireNotify(w, x - 1, w.isNormalCube(w.getBlock(x - 1, y, z)) ? y + 1 : y - 1, z);
  wireNotify(w, x + 1, w.isNormalCube(w.getBlock(x + 1, y, z)) ? y + 1 : y - 1, z);
  wireNotify(w, x, w.isNormalCube(w.getBlock(x, y, z - 1)) ? y + 1 : y - 1, z - 1);
  wireNotify(w, x, w.isNormalCube(w.getBlock(x, y, z + 1)) ? y + 1 : y - 1, z + 1);
}
export function wireCanStay(w, x, y, z) {
  return w.doesBlockHaveSolidTopSurface(x, y - 1, z) || w.getBlock(x, y - 1, z) === GLOWSTONE;
}
function wireWeak(w, x, y, z, side) {
  if (!w.wiresProvidePower) return 0;
  const m = w.getBlockMetadata(x, y, z);
  if (m === 0) return 0;
  if (side === 1) return m;
  const cube = (dx, dz) => w.isNormalCube(w.getBlock(x + dx, y, z + dz));
  let west = isPoweredOrRepeater(w, x - 1, y, z, 1) || (!cube(-1, 0) && isPoweredOrRepeater(w, x - 1, y - 1, z, -1));
  let east = isPoweredOrRepeater(w, x + 1, y, z, 3) || (!cube(1, 0) && isPoweredOrRepeater(w, x + 1, y - 1, z, -1));
  let north = isPoweredOrRepeater(w, x, y, z - 1, 2) || (!cube(0, -1) && isPoweredOrRepeater(w, x, y - 1, z - 1, -1));
  let south = isPoweredOrRepeater(w, x, y, z + 1, 0) || (!cube(0, 1) && isPoweredOrRepeater(w, x, y - 1, z + 1, -1));
  if (!w.isNormalCube(w.getBlock(x, y + 1, z))) {
    if (cube(-1, 0) && isPoweredOrRepeater(w, x - 1, y + 1, z, -1)) west = true;
    if (cube(1, 0) && isPoweredOrRepeater(w, x + 1, y + 1, z, -1)) east = true;
    if (cube(0, -1) && isPoweredOrRepeater(w, x, y + 1, z - 1, -1)) north = true;
    if (cube(0, 1) && isPoweredOrRepeater(w, x, y + 1, z + 1, -1)) south = true;
  }
  if (!(north || east || west || south || side < 2 || side > 5)) return m;
  if (side === 2 && north && !west && !east) return m;
  if (side === 3 && south && !west && !east) return m;
  if (side === 4 && west && !north && !south) return m;
  if (side === 5 && east && !north && !south) return m;
  return 0;
}
const wire = {
  onBlockAdded(w, x, y, z) {
    wireUpdate(w, x, y, z);
    w.notifyBlocksOfNeighborChange(x, y + 1, z, WIRE);
    w.notifyBlocksOfNeighborChange(x, y - 1, z, WIRE);
    wireNotifyAround(w, x, y, z);
  },
  breakBlock(w, x, y, z) {
    w.notifyBlocksOfNeighborChange(x, y + 1, z, WIRE);
    w.notifyBlocksOfNeighborChange(x, y - 1, z, WIRE);
    w.notifyBlocksOfNeighborChange(x + 1, y, z, WIRE);
    w.notifyBlocksOfNeighborChange(x - 1, y, z, WIRE);
    w.notifyBlocksOfNeighborChange(x, y, z + 1, WIRE);
    w.notifyBlocksOfNeighborChange(x, y, z - 1, WIRE);
    wireUpdate(w, x, y, z);
    wireNotifyAround(w, x, y, z);
  },
  onNeighborBlockChange(w, x, y, z) {
    if (wireCanStay(w, x, y, z)) wireUpdate(w, x, y, z);
    else {
      w.dropBlockAsItem(x, y, z, WIRE, 0);
      w.setBlockToAir(x, y, z);
    }
  },
  weak: wireWeak,
  strong: (w, x, y, z, side) => (w.wiresProvidePower ? wireWeak(w, x, y, z, side) : 0),
};

// ---- BlockTorch (aoc) support rules and BlockRedstoneTorch (anc) ----
function torchCanStandOn(w, x, y, z) {
  if (w.doesBlockHaveSolidTopSurface(x, y, z)) return true;
  const id = w.getBlock(x, y, z);
  return id === FENCE || id === NETHER_FENCE || id === GLASS || id === COBBLE_WALL;
}
export function torchCanPlace(w, x, y, z) {
  return (
    w.isBlockNormalCubeDefault(x - 1, y, z, true) ||
    w.isBlockNormalCubeDefault(x + 1, y, z, true) ||
    w.isBlockNormalCubeDefault(x, y, z - 1, true) ||
    w.isBlockNormalCubeDefault(x, y, z + 1, true) ||
    torchCanStandOn(w, x, y - 1, z)
  );
}
// BlockTorch.func_150109_e: drop the torch if nothing supports it.
function torchCheck(w, x, y, z, self) {
  if (torchCanPlace(w, x, y, z)) return true;
  if (w.getBlock(x, y, z) === self) {
    w.dropBlockAsItem(x, y, z, self, w.getBlockMetadata(x, y, z));
    w.setBlockToAir(x, y, z);
  }
  return false;
}
// BlockTorch.onBlockAdded for metadata 0: pick the first supporting face.
function torchOrient(w, x, y, z, self) {
  if (w.getBlockMetadata(x, y, z) === 0) {
    if (w.isBlockNormalCubeDefault(x - 1, y, z, true)) w.setBlockMetadataWithNotify(x, y, z, 1, 2);
    else if (w.isBlockNormalCubeDefault(x + 1, y, z, true)) w.setBlockMetadataWithNotify(x, y, z, 2, 2);
    else if (w.isBlockNormalCubeDefault(x, y, z - 1, true)) w.setBlockMetadataWithNotify(x, y, z, 3, 2);
    else if (w.isBlockNormalCubeDefault(x, y, z + 1, true)) w.setBlockMetadataWithNotify(x, y, z, 4, 2);
    else if (torchCanStandOn(w, x, y - 1, z)) w.setBlockMetadataWithNotify(x, y, z, 5, 2);
  }
  torchCheck(w, x, y, z, self);
}
// BlockTorch.func_150108_b: true when the torch was dropped (or could not stay).
function torchDropCheck(w, x, y, z, self) {
  if (!torchCheck(w, x, y, z, self)) return true;
  const m = w.getBlockMetadata(x, y, z);
  let drop = false;
  if (!w.isBlockNormalCubeDefault(x - 1, y, z, true) && m === 1) drop = true;
  if (!w.isBlockNormalCubeDefault(x + 1, y, z, true) && m === 2) drop = true;
  if (!w.isBlockNormalCubeDefault(x, y, z - 1, true) && m === 3) drop = true;
  if (!w.isBlockNormalCubeDefault(x, y, z + 1, true) && m === 4) drop = true;
  if (!torchCanStandOn(w, x, y - 1, z) && m === 5) drop = true;
  if (!drop) return false;
  w.dropBlockAsItem(x, y, z, self, w.getBlockMetadata(x, y, z));
  w.setBlockToAir(x, y, z);
  return true;
}
// BlockRedstoneTorch.func_150110_m: is the block the torch hangs on powered?
export function torchShouldTurnOff(w, x, y, z) {
  const m = w.getBlockMetadata(x, y, z);
  if (m === 5 && w.isBlockIndirectlyProvidingPowerTo(x, y - 1, z, 0)) return true;
  if (m === 3 && w.isBlockIndirectlyProvidingPowerTo(x, y, z - 1, 2)) return true;
  if (m === 4 && w.isBlockIndirectlyProvidingPowerTo(x, y, z + 1, 3)) return true;
  if (m === 1 && w.isBlockIndirectlyProvidingPowerTo(x - 1, y, z, 4)) return true;
  return m === 2 && w.isBlockIndirectlyProvidingPowerTo(x + 1, y, z, 5);
}
// BlockRedstoneTorch.checkForBurnout: the per-world toggle list, 8 entries at one position.
function torchBurnedOut(w, x, y, z, add) {
  if (!w.torchToggles) w.torchToggles = [];
  const list = w.torchToggles;
  if (add) list.push({ x, y, z, time: w.time });
  let count = 0;
  for (const t of list) if (t.x === x && t.y === y && t.z === z && ++count >= 8) return true;
  return false;
}
function torchNotifyAll(w, x, y, z, self) {
  w.notifyBlocksOfNeighborChange(x, y - 1, z, self);
  w.notifyBlocksOfNeighborChange(x, y + 1, z, self);
  w.notifyBlocksOfNeighborChange(x - 1, y, z, self);
  w.notifyBlocksOfNeighborChange(x + 1, y, z, self);
  w.notifyBlocksOfNeighborChange(x, y, z - 1, self);
  w.notifyBlocksOfNeighborChange(x, y, z + 1, self);
}
function redstoneTorch(lit) {
  const self = lit ? TORCH : UNLIT_TORCH;
  const weak = (w, x, y, z, side) => {
    if (!lit) return 0;
    const m = w.getBlockMetadata(x, y, z);
    if ((m === 5 && side === 1) || (m === 3 && side === 3) || (m === 4 && side === 2)) return 0;
    if ((m === 1 && side === 5) || (m === 2 && side === 4)) return 0;
    return 15;
  };
  return {
    onBlockAdded(w, x, y, z) {
      if (w.getBlockMetadata(x, y, z) === 0) torchOrient(w, x, y, z, self);
      if (lit) torchNotifyAll(w, x, y, z, self);
    },
    breakBlock(w, x, y, z) {
      if (lit) torchNotifyAll(w, x, y, z, self);
    },
    onNeighborBlockChange(w, x, y, z) {
      if (torchDropCheck(w, x, y, z, self)) return;
      const powered = torchShouldTurnOff(w, x, y, z);
      if ((lit && powered) || (!lit && !powered)) w.scheduleBlockUpdate(x, y, z, self, 2);
    },
    updateTick(w, x, y, z) {
      const powered = torchShouldTurnOff(w, x, y, z),
        list = w.torchToggles;
      while (list && list.length && w.time - list[0].time > 60) list.shift();
      if (lit) {
        if (!powered) return;
        w.setBlock(x, y, z, UNLIT_TORCH, w.getBlockMetadata(x, y, z), 3);
        if (!torchBurnedOut(w, x, y, z, true)) return;
        const r = w.rand,
          pitch = Math.fround(F26 + Math.fround(Math.fround(r.nextFloat() - r.nextFloat()) * F08));
        w.playSoundEffect(Math.fround(x + 0.5), Math.fround(y + 0.5), Math.fround(z + 0.5), "random.fizz", 0.5, pitch);
        for (let i = 0; i < 5; i++) {
          r.nextDouble();
          r.nextDouble();
          r.nextDouble(); // smoke particle position
        }
      } else if (!powered && !torchBurnedOut(w, x, y, z, false)) {
        w.setBlock(x, y, z, TORCH, w.getBlockMetadata(x, y, z), 3);
      }
    },
    weak,
    strong: (w, x, y, z, side) => (side === 0 ? weak(w, x, y, z, side) : 0),
  };
}

// ---- BlockLever (alv) ----
function leverCanPlace(w, x, y, z) {
  const cube = (a, b, c) => w.isNormalCube(w.getBlock(a, b, c));
  return cube(x - 1, y, z) || cube(x + 1, y, z) || cube(x, y, z - 1) || cube(x, y, z + 1) || w.doesBlockHaveSolidTopSurface(x, y - 1, z) || cube(x, y + 1, z);
}
function leverNotifyAttached(w, x, y, z, facing) {
  w.notifyBlocksOfNeighborChange(x, y, z, LEVER);
  if (facing === 1) w.notifyBlocksOfNeighborChange(x - 1, y, z, LEVER);
  else if (facing === 2) w.notifyBlocksOfNeighborChange(x + 1, y, z, LEVER);
  else if (facing === 3) w.notifyBlocksOfNeighborChange(x, y, z - 1, LEVER);
  else if (facing === 4) w.notifyBlocksOfNeighborChange(x, y, z + 1, LEVER);
  else if (facing === 5 || facing === 6) w.notifyBlocksOfNeighborChange(x, y - 1, z, LEVER);
  else if (facing === 0 || facing === 7) w.notifyBlocksOfNeighborChange(x, y + 1, z, LEVER);
}
const lever = {
  onNeighborBlockChange(w, x, y, z) {
    if (!leverCanPlace(w, x, y, z)) {
      w.dropBlockAsItem(x, y, z, LEVER, w.getBlockMetadata(x, y, z));
      w.setBlockToAir(x, y, z);
      return;
    }
    const f = w.getBlockMetadata(x, y, z) & 7,
      cube = (a, b, c) => w.isNormalCube(w.getBlock(a, b, c));
    let drop = false;
    if (!cube(x - 1, y, z) && f === 1) drop = true;
    if (!cube(x + 1, y, z) && f === 2) drop = true;
    if (!cube(x, y, z - 1) && f === 3) drop = true;
    if (!cube(x, y, z + 1) && f === 4) drop = true;
    if (!w.doesBlockHaveSolidTopSurface(x, y - 1, z) && f === 5) drop = true;
    if (!w.doesBlockHaveSolidTopSurface(x, y - 1, z) && f === 6) drop = true;
    if (!cube(x, y + 1, z) && f === 0) drop = true;
    if (!cube(x, y + 1, z) && f === 7) drop = true;
    if (drop) {
      w.dropBlockAsItem(x, y, z, LEVER, w.getBlockMetadata(x, y, z));
      w.setBlockToAir(x, y, z);
    }
  },
  onBlockActivated(w, x, y, z) {
    const m = w.getBlockMetadata(x, y, z),
      f = m & 7,
      on = 8 - (m & 8);
    w.setBlockMetadataWithNotify(x, y, z, f + on, 3);
    w.playSoundEffect(x + 0.5, y + 0.5, z + 0.5, "random.click", Math.fround(0.3), Math.fround(on > 0 ? 0.6 : 0.5));
    leverNotifyAttached(w, x, y, z, f);
    return true;
  },
  breakBlock(w, x, y, z, old, meta) {
    if ((meta & 8) > 0) leverNotifyAttached(w, x, y, z, meta & 7);
  },
  weak: (w, x, y, z) => ((w.getBlockMetadata(x, y, z) & 8) > 0 ? 15 : 0),
  strong(w, x, y, z, side) {
    const m = w.getBlockMetadata(x, y, z);
    if ((m & 8) === 0) return 0;
    const f = m & 7;
    if ((f === 0 || f === 7) && side === 0) return 15;
    if ((f === 6 || f === 5) && side === 1) return 15;
    if ((f === 4 && side === 2) || (f === 3 && side === 3) || (f === 2 && side === 4) || (f === 1 && side === 5)) return 15;
    return 0;
  },
};

// ---- BlockButton (ajs): stone (anx, 20 ticks) and wood (aon, 30 ticks) ----
function button(id, wooden) {
  const rate = wooden ? 30 : 20;
  const cube = (w, a, b, c) => w.isNormalCube(w.getBlock(a, b, c));
  const notify = (w, x, y, z, f) => {
    w.notifyBlocksOfNeighborChange(x, y, z, id);
    if (f === 1) w.notifyBlocksOfNeighborChange(x - 1, y, z, id);
    else if (f === 2) w.notifyBlocksOfNeighborChange(x + 1, y, z, id);
    else if (f === 3) w.notifyBlocksOfNeighborChange(x, y, z - 1, id);
    else if (f === 4) w.notifyBlocksOfNeighborChange(x, y, z + 1, id);
    else w.notifyBlocksOfNeighborChange(x, y - 1, z, id);
  };
  return {
    onNeighborBlockChange(w, x, y, z) {
      if (!(cube(w, x - 1, y, z) || cube(w, x + 1, y, z) || cube(w, x, y, z - 1) || cube(w, x, y, z + 1))) {
        w.dropBlockAsItem(x, y, z, id, w.getBlockMetadata(x, y, z));
        w.setBlockToAir(x, y, z);
        return;
      }
      const f = w.getBlockMetadata(x, y, z) & 7;
      let drop = false;
      if (!cube(w, x - 1, y, z) && f === 1) drop = true;
      if (!cube(w, x + 1, y, z) && f === 2) drop = true;
      if (!cube(w, x, y, z - 1) && f === 3) drop = true;
      if (!cube(w, x, y, z + 1) && f === 4) drop = true;
      if (drop) {
        w.dropBlockAsItem(x, y, z, id, w.getBlockMetadata(x, y, z));
        w.setBlockToAir(x, y, z);
      }
    },
    onBlockActivated(w, x, y, z) {
      const m = w.getBlockMetadata(x, y, z),
        f = m & 7,
        on = 8 - (m & 8);
      if (on === 0) return true;
      w.setBlockMetadataWithNotify(x, y, z, f + on, 3);
      w.playSoundEffect(x + 0.5, y + 0.5, z + 0.5, "random.click", Math.fround(0.3), Math.fround(0.6));
      notify(w, x, y, z, f);
      w.scheduleBlockUpdate(x, y, z, id, rate);
      return true;
    },
    // Wooden buttons re-check for arrows (none exist here) before releasing.
    updateTick(w, x, y, z) {
      const m = w.getBlockMetadata(x, y, z);
      if ((m & 8) === 0) return;
      w.setBlockMetadataWithNotify(x, y, z, m & 7, 3);
      notify(w, x, y, z, m & 7);
      w.playSoundEffect(x + 0.5, y + 0.5, z + 0.5, "random.click", Math.fround(0.3), Math.fround(0.5));
    },
    breakBlock(w, x, y, z, old, meta) {
      if ((meta & 8) > 0) notify(w, x, y, z, meta & 7);
    },
    weak: (w, x, y, z) => ((w.getBlockMetadata(x, y, z) & 8) > 0 ? 15 : 0),
    strong(w, x, y, z, side) {
      const m = w.getBlockMetadata(x, y, z);
      if ((m & 8) === 0) return 0;
      const f = m & 7;
      if ((f === 5 && side === 1) || (f === 4 && side === 2) || (f === 3 && side === 3) || (f === 2 && side === 4) || (f === 1 && side === 5)) return 15;
      return 0;
    },
  };
}

// ---- BlockRedstoneLight (anb) ----
function lamp(lit) {
  const self = lit ? LIT_LAMP : LAMP;
  const check = (w, x, y, z) => {
    if (lit && !w.isBlockIndirectlyGettingPowered(x, y, z)) w.scheduleBlockUpdate(x, y, z, self, 4);
    else if (!lit && w.isBlockIndirectlyGettingPowered(x, y, z)) w.setBlock(x, y, z, LIT_LAMP, 0, 2);
  };
  return {
    onBlockAdded: check,
    onNeighborBlockChange: check,
    updateTick(w, x, y, z) {
      if (lit && !w.isBlockIndirectlyGettingPowered(x, y, z)) w.setBlock(x, y, z, LAMP, 0, 2);
    },
  };
}

// ---- BlockRedstoneDiode (akj), BlockRedstoneRepeater (anf), BlockRedstoneComparator (akc) ----
// Direction metadata is meta & 3 (BlockDirectional.getDirection); the input is at
// (x + offsetX[dir], z + offsetZ[dir]) and the output on the opposite face.
const dirOf = (m) => m & 3;
function isDiodeId(id) {
  return id === REPEATER || id === POWERED_REPEATER || id === COMPARATOR || id === POWERED_COMPARATOR;
}
// BlockRedstoneDiode.func_149911_e: notify the block in front, skipping its facing back to us.
function diodeNotifyFront(w, x, y, z, self) {
  const d = dirOf(w.getBlockMetadata(x, y, z));
  if (d === 1) {
    w.notifyBlockOfNeighborChange(x + 1, y, z, self);
    w.notifyBlocksOfNeighborChangeExcept(x + 1, y, z, self, 4);
  }
  if (d === 3) {
    w.notifyBlockOfNeighborChange(x - 1, y, z, self);
    w.notifyBlocksOfNeighborChangeExcept(x - 1, y, z, self, 5);
  }
  if (d === 2) {
    w.notifyBlockOfNeighborChange(x, y, z + 1, self);
    w.notifyBlocksOfNeighborChangeExcept(x, y, z + 1, self, 2);
  }
  if (d === 0) {
    w.notifyBlockOfNeighborChange(x, y, z - 1, self);
    w.notifyBlocksOfNeighborChangeExcept(x, y, z - 1, self, 3);
  }
}
// BlockRedstoneDiode.func_149903_h: power arriving at the input side (indirect power, or wire).
function diodeInput(w, x, y, z, m) {
  const d = dirOf(m),
    x1 = x + DIR_X[d],
    z1 = z + DIR_Z[d],
    p = w.getIndirectPowerLevelTo(x1, y, z1, DIR_TO_FACING[d]);
  if (p >= 15) return p;
  return Math.max(p, w.getBlock(x1, y, z1) === WIRE ? w.getBlockMetadata(x1, y, z1) : 0);
}
// BlockRedstoneDiode.func_149913_i with this block's isPowerSource (func_149908_a).
function diodeSideSource(w, x, y, z, side, repeater) {
  const id = w.getBlock(x, y, z);
  if (repeater ? !isDiodeId(id) : !w.canProvidePower(id)) return 0;
  return id === WIRE ? w.getBlockMetadata(x, y, z) : w.isBlockProvidingPowerTo(x, y, z, side);
}
// BlockRedstoneDiode.func_149902_h: strongest power from the two sides.
function diodeSides(w, x, y, z, m, repeater) {
  const d = dirOf(m);
  if (d === 0 || d === 2) return Math.max(diodeSideSource(w, x - 1, y, z, 4, repeater), diodeSideSource(w, x + 1, y, z, 5, repeater));
  if (d === 1 || d === 3) return Math.max(diodeSideSource(w, x, y, z + 1, 3, repeater), diodeSideSource(w, x, y, z - 1, 2, repeater));
  return 0;
}
// BlockRedstoneDiode.func_149912_i (isFacingTowardsRepeater): a diode feeds us from behind
// and is not facing the same way.
function diodeFacingTowardsDiode(w, x, y, z, m) {
  const d = dirOf(m),
    bx = x - DIR_X[d],
    bz = z - DIR_Z[d];
  return isDiodeId(w.getBlock(bx, y, bz)) ? dirOf(w.getBlockMetadata(bx, y, bz)) !== d : false;
}
const diodeCanStay = (w, x, y, z) => w.doesBlockHaveSolidTopSurface(x, y - 1, z);
// onBlockPlacedBy: direction from the placer's yaw; schedule a tick when already powered.
function diodePlacedBy(w, x, y, z, self, yaw, gettingInput) {
  const f = Math.fround(Math.fround(Math.fround(yaw) * 4) / 360),
    d = ((Math.floor(f + 0.5) & 3) + 2) % 4;
  w.setBlockMetadataWithNotify(x, y, z, d, 3);
  if (gettingInput(w, x, y, z, d)) w.scheduleBlockUpdate(x, y, z, self, 1);
}
// onNeighborBlockChange: drop when the support is gone, otherwise updateState.
function diodeNeighbourChange(w, x, y, z, self, updateState) {
  if (diodeCanStay(w, x, y, z)) return updateState(w, x, y, z, self);
  w.dropBlockAsItem(x, y, z, self, w.getBlockMetadata(x, y, z));
  w.setBlockToAir(x, y, z);
  w.notifyBlocksOfNeighborChange(x + 1, y, z, self);
  w.notifyBlocksOfNeighborChange(x - 1, y, z, self);
  w.notifyBlocksOfNeighborChange(x, y, z + 1, self);
  w.notifyBlocksOfNeighborChange(x, y, z - 1, self);
  w.notifyBlocksOfNeighborChange(x, y - 1, z, self);
  w.notifyBlocksOfNeighborChange(x, y + 1, z, self);
}
// strong (and weak) output: only through the front face, only while powered.
function diodeOutput(w, x, y, z, side, powered, signal) {
  const m = w.getBlockMetadata(x, y, z);
  if (!powered(w, x, y, z, m)) return 0;
  const d = dirOf(m);
  if ((d === 0 && side === 3) || (d === 1 && side === 4) || (d === 2 && side === 2) || (d === 3 && side === 5)) return signal(w, x, y, z, m);
  return 0;
}

function repeater(lit) {
  const self = lit ? POWERED_REPEATER : REPEATER,
    delay = (m) => [1, 2, 3, 4][(m & 12) >> 2] * 2,
    locked = (w, x, y, z, m) => diodeSides(w, x, y, z, m, true) > 0,
    gettingInput = (w, x, y, z, m) => diodeInput(w, x, y, z, m) > 0;
  const updateState = (w, x, y, z) => {
    const m = w.getBlockMetadata(x, y, z);
    if (locked(w, x, y, z, m)) return;
    const input = gettingInput(w, x, y, z, m);
    if (((lit && !input) || (!lit && input)) && !w.isBlockTickScheduledThisTick(x, y, z, self)) {
      let priority = -1;
      if (diodeFacingTowardsDiode(w, x, y, z, m)) priority = -3;
      else if (lit) priority = -2;
      w.scheduleBlockUpdate(x, y, z, self, delay(m), priority);
    }
  };
  const output = (w, x, y, z, side) => diodeOutput(w, x, y, z, side, () => lit, () => 15);
  return {
    onBlockAdded: (w, x, y, z) => diodeNotifyFront(w, x, y, z, self),
    breakBlock: (w, x, y, z) => diodeNotifyFront(w, x, y, z, self),
    onNeighborBlockChange: (w, x, y, z) => diodeNeighbourChange(w, x, y, z, self, updateState),
    updateTick(w, x, y, z) {
      const m = w.getBlockMetadata(x, y, z);
      if (locked(w, x, y, z, m)) return;
      const input = gettingInput(w, x, y, z, m);
      if (lit && !input) w.setBlock(x, y, z, REPEATER, m, 2);
      else if (!lit) {
        w.setBlock(x, y, z, POWERED_REPEATER, m, 2);
        if (!input) w.scheduleBlockUpdate(x, y, z, POWERED_REPEATER, delay(m), -1);
      }
    },
    // BlockRedstoneRepeater.onBlockActivated: next delay (metadata bits 2 and 3), flags 3.
    onBlockActivated(w, x, y, z) {
      const m = w.getBlockMetadata(x, y, z),
        next = ((((m & 12) >> 2) + 1) << 2) & 12;
      w.setBlockMetadataWithNotify(x, y, z, next | (m & 3), 3);
      return true;
    },
    onBlockPlacedBy: (w, x, y, z, yaw) => diodePlacedBy(w, x, y, z, self, yaw, gettingInput),
    weak: output,
    strong: output,
  };
}

// ---- BlockRedstoneComparator (akc) with TileEntityComparator (aoz) ----
// metadata: bits 0-1 direction, bit 4 subtract mode, bit 8 powered (the lit block 150 only
// appears when placed raw; its first tick turns it into 149 with bit 8 set).
function comparatorInput(w, x, y, z, m) {
  let l = diodeInput(w, x, y, z, m);
  const d = dirOf(m);
  let x1 = x + DIR_X[d],
    z1 = z + DIR_Z[d],
    id = w.getBlock(x1, y, z1);
  if (hasComparatorOverride(id)) l = comparatorOverride(w, id, x1, y, z1);
  else if (l < 15 && w.isNormalCube(id)) {
    x1 += DIR_X[d];
    z1 += DIR_Z[d];
    id = w.getBlock(x1, y, z1);
    if (hasComparatorOverride(id)) l = comparatorOverride(w, id, x1, y, z1);
  }
  return l;
}
const comparatorSides = (w, x, y, z, m) => diodeSides(w, x, y, z, m, false);
// func_149970_j: the signal the comparator should output.
function comparatorTarget(w, x, y, z, m) {
  const input = comparatorInput(w, x, y, z, m);
  return (m & 4) === 4 ? Math.max(input - comparatorSides(w, x, y, z, m), 0) : input;
}
// func_149900_a: whether the input still counts as powered (rear input vs side input).
function comparatorGettingInput(w, x, y, z, m) {
  const l = comparatorInput(w, x, y, z, m);
  if (l >= 15) return true;
  if (l === 0) return false;
  const side = comparatorSides(w, x, y, z, m);
  return side === 0 ? true : l >= side;
}
function comparator(lit) {
  const self = lit ? POWERED_COMPARATOR : COMPARATOR,
    powered = (w, x, y, z, m) => lit || (m & 8) !== 0;
  // func_149972_c: store the new output, flip the powered bit, notify the front.
  const updateOutput = (w, x, y, z) => {
    const m = w.getBlockMetadata(x, y, z),
      target = comparatorTarget(w, x, y, z, m),
      tile = w.comparatorTile(x, y, z),
      old = tile.signal;
    tile.signal = target;
    if (old !== target || (m & 4) !== 4) {
      const input = comparatorGettingInput(w, x, y, z, m),
        on = lit || (m & 8) !== 0;
      if (on && !input) w.setBlockMetadataWithNotify(x, y, z, m & -9, 2);
      else if (!on && input) w.setBlockMetadataWithNotify(x, y, z, m | 8, 2);
      diodeNotifyFront(w, x, y, z, self);
    }
  };
  const updateState = (w, x, y, z) => {
    if (w.isBlockTickScheduledThisTick(x, y, z, self)) return;
    const m = w.getBlockMetadata(x, y, z);
    if (comparatorTarget(w, x, y, z, m) !== w.comparatorTile(x, y, z).signal || powered(w, x, y, z, m) !== comparatorGettingInput(w, x, y, z, m))
      w.scheduleBlockUpdate(x, y, z, self, 2, diodeFacingTowardsDiode(w, x, y, z, m) ? -1 : 0);
  };
  const output = (w, x, y, z, side) => diodeOutput(w, x, y, z, side, powered, (ww, xx, yy, zz) => ww.comparatorTile(xx, yy, zz).signal);
  return {
    onBlockAdded(w, x, y, z) {
      diodeNotifyFront(w, x, y, z, self);
      w.tiles.set(`${x},${y},${z}`, { signal: 0 });
    },
    breakBlock(w, x, y, z) {
      w.tiles.delete(`${x},${y},${z}`);
      diodeNotifyFront(w, x, y, z, self);
    },
    onNeighborBlockChange: (w, x, y, z) => diodeNeighbourChange(w, x, y, z, self, updateState),
    updateTick(w, x, y, z) {
      if (lit) w.setBlock(x, y, z, COMPARATOR, w.getBlockMetadata(x, y, z) | 8, 4);
      updateOutput(w, x, y, z);
    },
    // onBlockActivated: toggle compare/subtract (bit 4); click pitch 0.55 into subtract, else 0.5.
    onBlockActivated(w, x, y, z) {
      const m = w.getBlockMetadata(x, y, z),
        on = lit || (m & 8) !== 0,
        subtract = (m & 4) !== 4;
      const next = (subtract ? 4 : 0) | (on ? 8 : 0);
      w.playSoundEffect(x + 0.5, y + 0.5, z + 0.5, "random.click", Math.fround(0.3), subtract ? Math.fround(0.55) : Math.fround(0.5));
      w.setBlockMetadataWithNotify(x, y, z, next | (m & 3), 2);
      updateOutput(w, x, y, z);
      return true;
    },
    onBlockPlacedBy: (w, x, y, z, yaw) => diodePlacedBy(w, x, y, z, self, yaw, comparatorGettingInput),
    weak: output,
    strong: output,
  };
}

// ---- BlockBasePressurePlate (ajd): stone / wood (amu) and weighted (aol) ----
// getEntitiesWithinAABB for the plate's sensing box, over the scripted entity list.
function plateBox(x, y, z) {
  const f = (v) => Math.fround(Math.fround(v) + 0.125),
    g = (v) => Math.fround(Math.fround(v + 1) - 0.125);
  return [f(x), y, f(z), g(x), y + 0.25, g(z)];
}
const plateCanStay = (w, x, y, z) => {
  const below = w.getBlock(x, y - 1, z);
  return w.doesBlockHaveSolidTopSurface(x, y - 1, z) || below === FENCE || below === NETHER_FENCE;
};
function pressurePlate(id, { mode, max, rate, weighted }) {
  const powerOf = weighted ? (m) => m : (m) => (m === 1 ? 15 : 0),
    metaOf = weighted ? (p) => p : (p) => (p > 0 ? 1 : 0);
  const notify = (w, x, y, z) => {
    w.notifyBlocksOfNeighborChange(x, y, z, id);
    w.notifyBlocksOfNeighborChange(x, y - 1, z, id);
  };
  // computeRedstoneStrength: the first triggering entity (stone/wood) or the weighted count.
  const strength = (w, x, y, z) => {
    const list = w.getEntities(weighted ? "all" : mode, plateBox(x, y, z));
    if (!weighted) return list.length > 0 ? 15 : 0;
    const n = Math.min(list.length, max);
    if (n <= 0) return 0;
    const f = Math.fround(Math.fround(Math.min(max, n)) / Math.fround(max)),
      v = Math.fround(f * 15),
      i = Math.trunc(v);
    return v > i ? i + 1 : i;
  };
  // func_150062_a (setStateIfMobInteractsWithPlate).
  const refresh = (w, x, y, z, old) => {
    const now = strength(w, x, y, z),
      was = old > 0,
      is = now > 0;
    if (old !== now) {
      w.setBlockMetadataWithNotify(x, y, z, metaOf(now), 2);
      notify(w, x, y, z);
    }
    if (!is && was) w.playSoundEffect(x + 0.5, y + 0.1, z + 0.5, "random.click", Math.fround(0.3), Math.fround(0.5));
    else if (is && !was) w.playSoundEffect(x + 0.5, y + 0.1, z + 0.5, "random.click", Math.fround(0.3), Math.fround(0.6));
    if (is) w.scheduleBlockUpdate(x, y, z, id, rate);
  };
  const power = (w, x, y, z) => powerOf(w.getBlockMetadata(x, y, z));
  return {
    onNeighborBlockChange(w, x, y, z) {
      if (plateCanStay(w, x, y, z)) return;
      w.dropBlockAsItem(x, y, z, id, w.getBlockMetadata(x, y, z));
      w.setBlockToAir(x, y, z);
    },
    updateTick(w, x, y, z) {
      const p = power(w, x, y, z);
      if (p > 0) refresh(w, x, y, z, p);
    },
    onEntityCollidedWithBlock(w, x, y, z) {
      const p = power(w, x, y, z);
      if (p === 0) refresh(w, x, y, z, p);
    },
    breakBlock(w, x, y, z, old, meta) {
      if (powerOf(meta) > 0) notify(w, x, y, z);
    },
    weak: (w, x, y, z) => power(w, x, y, z),
    strong: (w, x, y, z, side) => (side === 1 ? power(w, x, y, z) : 0),
  };
}

// ---- Pistons (REDSTONE-04) ----
// Native Block.getBlockHardness == -1, getMobilityFlag, ITileEntityProvider and Material.air for every
// registered id below 256 as dumped by tools/probes/PistonProbe.java ("id.hardnessMinusOne.mobility.tile.air";
// rows equal to 0.0.0.0.0 are left out). Mobility: 0 normal, 1 destroyed by a piston, 2 immovable.
const PISTON_PACKED =
  "0.0.0.0.1 6.0.1.0.0 7.1.0.0.0 8.0.1.0.0 9.0.1.0.0 10.0.1.0.0 11.0.1.0.0 18.0.1.0.0 23.0.0.1.0 25.0.0.1.0 26.0.1.0.0 29.0.2.0.0 30.0.1.0.0 31.0.1.0.0 32.0.1.0.0 33.0.2.0.0 34.0.2.0.0 36.1.2.1.0 37.0.1.0.0 38.0.1.0.0 39.0.1.0.0 40.0.1.0.0 50.0.1.0.0 51.0.1.0.0 52.0.0.1.0 54.0.0.1.0 55.0.1.0.0 59.0.1.0.0 61.0.0.1.0 62.0.0.1.0 63.0.0.1.0 64.0.1.0.0 65.0.1.0.0 68.0.0.1.0 69.0.1.0.0 70.0.1.0.0 71.0.1.0.0 72.0.1.0.0 75.0.1.0.0 76.0.1.0.0 77.0.1.0.0 78.0.1.0.0 81.0.1.0.0 83.0.1.0.0 84.0.0.1.0 86.0.1.0.0 90.1.2.0.0 91.0.1.0.0 92.0.1.0.0 93.0.1.0.0 94.0.1.0.0 103.0.1.0.0 104.0.1.0.0 105.0.1.0.0 106.0.1.0.0 111.0.1.0.0 115.0.1.0.0 116.0.0.1.0 117.0.0.1.0 119.1.2.1.0 120.1.0.0.0 122.0.1.0.0 127.0.1.0.0 130.0.0.1.0 131.0.1.0.0 132.0.1.0.0 137.1.0.1.0 138.0.0.1.0 140.0.1.1.0 141.0.1.0.0 142.0.1.0.0 143.0.1.0.0 144.0.1.1.0 145.0.2.0.0 146.0.0.1.0 147.0.1.0.0 148.0.1.0.0 149.0.1.1.0 150.0.1.1.0 151.0.0.1.0 154.0.0.1.0 158.0.0.1.0 161.0.1.0.0 175.0.1.0.0";
const NO_HARDNESS = new Uint8Array(256),
  MOBILITY = new Uint8Array(256),
  TILE_PROVIDER = new Uint8Array(256),
  AIR_MATERIAL = new Uint8Array(256);
for (const entry of PISTON_PACKED.split(" ")) {
  const [id, hard, mobility, tile, air] = entry.split(".").map(Number);
  NO_HARDNESS[id] = hard;
  MOBILITY[id] = mobility;
  TILE_PROVIDER[id] = tile;
  AIR_MATERIAL[id] = air;
}
// [id, hardness == -1, getMobilityFlag, ITileEntityProvider, material air] rows for every registered id.
export function pistonBlockProperties() {
  const rows = [];
  for (let id = 0; id < 256; id++)
    if (REGISTERED[id]) rows.push([id, NO_HARDNESS[id], MOBILITY[id], TILE_PROVIDER[id], AIR_MATERIAL[id]]);
  return rows;
}
const isAirMaterial = (id) => AIR_MATERIAL[id] === 1 || !REGISTERED[id];
const isPistonBase = (id) => id === PISTON || id === STICKY_PISTON;
const isExtended = (meta) => (meta & 8) !== 0; // BlockPistonBase.isExtended
const pistonFacing = (meta) => meta & 7; // BlockPistonBase.getPistonOrientation
const F025 = Math.fround(0.25),
  F015 = Math.fround(0.15),
  F06 = Math.fround(0.6);

// Block.createNewTileEntity: BlockPistonMoving returns null (the entity is attached by the piston).
function createNewTileEntity() {
  return null;
}
// BlockPistonMoving.func_149962_a: a TileEntityPiston holding `block` with `meta`, moving along `facing`.
export function pistonTile(block, meta, facing, extending, renderHead) {
  return { kind: "piston", block, meta, facing, extending, renderHead, progress: 0, lastProgress: 0, invalid: false, world: false, x: 0, y: 0, z: 0 };
}
// TileEntityPiston.clearPistonTileEntity: finish the move at once and put the stored block in place.
function tileClear(w, te) {
  if (te.lastProgress < 1 && te.world) {
    te.progress = te.lastProgress = 1;
    w.removeTileEntity(te.x, te.y, te.z);
    te.invalid = true;
    if (w.getBlock(te.x, te.y, te.z) === PISTON_MOVING) {
      w.setBlock(te.x, te.y, te.z, te.block, te.meta, 3);
      w.notifyBlockOfNeighborChange(te.x, te.y, te.z, te.block);
    }
  }
}
// TileEntityPiston.updateEntity: progress 0 -> 0.5 -> 1.0, then the next update replaces the moving block.
// Entity pushing (func_145863_a) is not ported: the scripted entity list is empty in every scenario.
function tileUpdate(w, te) {
  te.lastProgress = te.progress;
  if (te.lastProgress >= 1) {
    w.removeTileEntity(te.x, te.y, te.z);
    te.invalid = true;
    if (w.getBlock(te.x, te.y, te.z) === PISTON_MOVING) {
      w.setBlock(te.x, te.y, te.z, te.block, te.meta, 3);
      w.notifyBlockOfNeighborChange(te.x, te.y, te.z, te.block);
    }
    return;
  }
  te.progress += 0.5;
  if (te.progress >= 1) te.progress = 1;
}
// BlockPistonBase.canPushBlock.
function canPushBlock(w, id, x, y, z, allowDestroy) {
  if (id === OBSIDIAN) return false;
  if (isPistonBase(id)) {
    if (isExtended(w.getBlockMetadata(x, y, z))) return false;
  } else {
    if (NO_HARDNESS[id] === 1) return false;
    if (MOBILITY[id] === 2) return false;
    if (MOBILITY[id] === 1) return allowDestroy;
  }
  return TILE_PROVIDER[id] !== 1;
}
// BlockPistonBase.func_150077_h (canExtend): the push line may hold at most 12 blocks and ends at air or a
// block the piston destroys; y must stay inside 1..254.
function canExtend(w, x, y, z, facing) {
  let x1 = x + FACING_X[facing],
    y1 = y + FACING_Y[facing],
    z1 = z + FACING_Z[facing];
  for (let i = 0; i < 13; i++) {
    if (y1 <= 0 || y1 >= 255) return false;
    const id = w.getBlock(x1, y1, z1);
    if (isAirMaterial(id)) break;
    if (!canPushBlock(w, id, x1, y1, z1, true)) return false;
    if (MOBILITY[id] === 1) break;
    if (i === 12) return false;
    x1 += FACING_X[facing];
    y1 += FACING_Y[facing];
    z1 += FACING_Z[facing];
  }
  return true;
}
// BlockPistonBase.func_150079_i (tryExtend): break a mobility-1 block at the end of the line (drop, then
// setBlockToAir), then move the line one cell with piston-moving blocks (flags 4) from the far end back, and
// notify the neighbours of every vacated cell in the same order.
function tryExtend(w, self, x, y, z, facing) {
  let x1 = x + FACING_X[facing],
    y1 = y + FACING_Y[facing],
    z1 = z + FACING_Z[facing];
  for (let i = 0; i < 13; i++) {
    if (y1 <= 0 || y1 >= 255) return false;
    const id = w.getBlock(x1, y1, z1);
    if (isAirMaterial(id)) break;
    if (!canPushBlock(w, id, x1, y1, z1, true)) return false;
    if (MOBILITY[id] === 1) {
      w.dropBlockAsItem(x1, y1, z1, id, w.getBlockMetadata(x1, y1, z1));
      w.setBlockToAir(x1, y1, z1);
      break;
    }
    if (i === 12) return false;
    x1 += FACING_X[facing];
    y1 += FACING_Y[facing];
    z1 += FACING_Z[facing];
  }
  const endX = x1,
    endY = y1,
    endZ = z1,
    moved = [],
    sticky = self === STICKY_PISTON ? 8 : 0;
  while (x1 !== x || y1 !== y || z1 !== z) {
    const px = x1 - FACING_X[facing],
      py = y1 - FACING_Y[facing],
      pz = z1 - FACING_Z[facing],
      id = w.getBlock(px, py, pz),
      meta = w.getBlockMetadata(px, py, pz);
    if (id === self && px === x && py === y && pz === z) {
      w.setBlock(x1, y1, z1, PISTON_MOVING, facing | sticky, 4);
      w.setTileEntity(x1, y1, z1, pistonTile(PISTON_HEAD, facing | sticky, facing, true, false));
    } else {
      w.setBlock(x1, y1, z1, PISTON_MOVING, meta, 4);
      w.setTileEntity(x1, y1, z1, pistonTile(id, meta, facing, true, false));
    }
    moved.push(id);
    x1 = px;
    y1 = py;
    z1 = pz;
  }
  x1 = endX;
  y1 = endY;
  z1 = endZ;
  let n = 0;
  while (x1 !== x || y1 !== y || z1 !== z) {
    x1 -= FACING_X[facing];
    y1 -= FACING_Y[facing];
    z1 -= FACING_Z[facing];
    w.notifyBlocksOfNeighborChange(x1, y1, z1, moved[n++]);
  }
  return true;
}
// BlockPistonBase.isIndirectlyPowered (func_150072_a): the sides but the face, then the same checks for the
// cell itself and the cells one above it (quasi-connectivity), in this order (east before west).
function isIndirectlyPowered(w, x, y, z, facing) {
  const f = (a, b, c, d) => w.isBlockIndirectlyProvidingPowerTo(a, b, c, d);
  return (
    (facing !== 0 && f(x, y - 1, z, 0)) ||
    (facing !== 1 && f(x, y + 1, z, 1)) ||
    (facing !== 2 && f(x, y, z - 1, 2)) ||
    (facing !== 3 && f(x, y, z + 1, 3)) ||
    (facing !== 5 && f(x + 1, y, z, 5)) ||
    (facing !== 4 && f(x - 1, y, z, 4)) ||
    f(x, y, z, 0) ||
    f(x, y + 2, z, 1) ||
    f(x, y + 1, z - 1, 2) ||
    f(x, y + 1, z + 1, 3) ||
    f(x - 1, y + 1, z, 4) ||
    f(x + 1, y + 1, z, 5)
  );
}
// BlockPistonBase.func_150078_e (updatePistonState).
function updatePistonState(w, self, x, y, z) {
  const meta = w.getBlockMetadata(x, y, z),
    facing = pistonFacing(meta);
  if (facing === 7) return;
  const powered = isIndirectlyPowered(w, x, y, z, facing);
  if (powered && !isExtended(meta)) {
    if (canExtend(w, x, y, z, facing)) w.addBlockEvent(x, y, z, self, 0, facing);
  } else if (!powered && isExtended(meta)) {
    w.setBlockMetadataWithNotify(x, y, z, facing, 2);
    w.addBlockEvent(x, y, z, self, 1, facing);
  }
}
// BlockPistonBase.determineOrientation for a placer { x, y, z (feet), yaw } with eye height 1.62.
export function pistonOrientation(x, y, z, placer) {
  const f32 = Math.fround;
  if (Math.abs(f32(f32(placer.x) - x)) < 2 && Math.abs(f32(f32(placer.z) - z)) < 2) {
    const eye = placer.y + 1.82 - f32(1.62);
    if (eye - y > 2) return 1;
    if (y - eye > 0) return 0;
  }
  const l = Math.floor(f32(f32(f32(placer.yaw) * 4) / 360) + 0.5) & 3;
  return l === 0 ? 2 : l === 1 ? 5 : l === 2 ? 3 : l === 3 ? 4 : 0;
}
function pistonBase(self) {
  const sticky = self === STICKY_PISTON;
  return {
    onBlockAdded(w, x, y, z) {
      if (!w.getTileEntity(x, y, z)) updatePistonState(w, self, x, y, z);
    },
    onNeighborBlockChange(w, x, y, z) {
      updatePistonState(w, self, x, y, z);
    },
    onBlockPlacedBy(w, x, y, z, placer) {
      w.setBlockMetadataWithNotify(x, y, z, pistonOrientation(x, y, z, placer), 2);
      updatePistonState(w, self, x, y, z);
    },
    // BlockPistonBase.onBlockEventReceived: event 0 extends, 1 retracts; a retract event that finds the piston
    // powered again only re-sets the extended bit, an extend event without power does nothing.
    onBlockEventReceived(w, x, y, z, event, facing) {
      const powered = isIndirectlyPowered(w, x, y, z, facing);
      if (powered && event === 1) {
        w.setBlockMetadataWithNotify(x, y, z, facing | 8, 2);
        return false;
      }
      if (!powered && event === 0) return false;
      if (event === 0) {
        if (!tryExtend(w, self, x, y, z, facing)) return false;
        w.setBlockMetadataWithNotify(x, y, z, facing | 8, 2);
        w.playSoundEffect(x + 0.5, y + 0.5, z + 0.5, "tile.piston.out", 0.5, Math.fround(Math.fround(w.rand.nextFloat() * F025) + F06));
      } else if (event === 1) {
        const front = w.getTileEntity(x + FACING_X[facing], y + FACING_Y[facing], z + FACING_Z[facing]);
        if (front && front.kind === "piston") tileClear(w, front);
        w.setBlock(x, y, z, PISTON_MOVING, facing, 3);
        w.setTileEntity(x, y, z, pistonTile(self, facing, facing, false, true));
        if (sticky) {
          const nx = x + FACING_X[facing] * 2,
            ny = y + FACING_Y[facing] * 2,
            nz = z + FACING_Z[facing] * 2;
          let id = w.getBlock(nx, ny, nz),
            meta = w.getBlockMetadata(nx, ny, nz),
            completed = false;
          if (id === PISTON_MOVING) {
            const te = w.getTileEntity(nx, ny, nz);
            if (te && te.kind === "piston" && te.facing === facing && te.extending) {
              tileClear(w, te);
              id = te.block;
              meta = te.meta;
              completed = true;
            }
          }
          if (!completed && !isAirMaterial(id) && canPushBlock(w, id, nx, ny, nz, false) && (MOBILITY[id] === 0 || isPistonBase(id))) {
            x += FACING_X[facing];
            y += FACING_Y[facing];
            z += FACING_Z[facing];
            w.setBlock(x, y, z, PISTON_MOVING, meta, 3);
            w.setTileEntity(x, y, z, pistonTile(id, meta, facing, false, false));
            w.setBlockToAir(nx, ny, nz);
          } else if (!completed) w.setBlockToAir(x + FACING_X[facing], y + FACING_Y[facing], z + FACING_Z[facing]);
        } else w.setBlockToAir(x + FACING_X[facing], y + FACING_Y[facing], z + FACING_Z[facing]);
        w.playSoundEffect(x + 0.5, y + 0.5, z + 0.5, "tile.piston.in", 0.5, Math.fround(Math.fround(w.rand.nextFloat() * F015) + F06));
      }
      return true;
    },
  };
}
// BlockPistonExtension (the piston head, metadata = facing + 8 when sticky).
const pistonHead = {
  // breakBlock: removing the head drops and removes an extended base behind it.
  breakBlock(w, x, y, z, old, meta) {
    const dir = ROTATE_FACING_OPPOSITE[Math.min(meta & 7, 5)],
      bx = x + FACING_X[dir],
      by = y + FACING_Y[dir],
      bz = z + FACING_Z[dir],
      id = w.getBlock(bx, by, bz);
    if (isPistonBase(id)) {
      const m = w.getBlockMetadata(bx, by, bz);
      if (isExtended(m)) {
        w.dropBlockAsItem(bx, by, bz, id, m);
        w.setBlockToAir(bx, by, bz);
      }
    }
  },
  // onNeighborBlockChange: a head without its base disappears, otherwise the base re-evaluates its state.
  onNeighborBlockChange(w, x, y, z, source) {
    const dir = Math.min(w.getBlockMetadata(x, y, z) & 7, 5),
      bx = x - FACING_X[dir],
      by = y - FACING_Y[dir],
      bz = z - FACING_Z[dir],
      id = w.getBlock(bx, by, bz);
    if (!isPistonBase(id)) w.setBlockToAir(x, y, z);
    else w.behaviours[id].onNeighborBlockChange(w, bx, by, bz, source);
  },
};
// BlockPistonMoving.
const pistonMoving = {
  // breakBlock: replacing a moving block finishes its tile entity; without one BlockContainer.breakBlock
  // removes the tile entity.
  breakBlock(w, x, y, z) {
    const te = w.getTileEntity(x, y, z);
    if (te && te.kind === "piston") tileClear(w, te);
    else w.removeTileEntity(x, y, z);
  },
  onNeighborBlockChange(w, x, y, z) {
    w.getTileEntity(x, y, z);
  },
};
// Facing.opposite for the head's breakBlock (q.a): down/up, north/south, west/east.
const ROTATE_FACING_OPPOSITE = [1, 0, 3, 2, 5, 4];

// ---- BlockDoor (akn, 64 wooden / 71 iron): power from either half (REDSTONE-05, probed by RedstoneLiveProbe) ----
// BlockDoor.func_150012_g: bits 0-2 from the lower half, bit 3 when this is the upper half, bit 4 from the upper half's hinge.
function doorFlags(w, x, y, z) {
  const meta = w.getBlockMetadata(x, y, z),
    upper = (meta & 8) !== 0,
    low = upper ? w.getBlockMetadata(x, y - 1, z) : meta,
    high = upper ? meta : w.getBlockMetadata(x, y + 1, z);
  return (low & 7) | (upper ? 8 : 0) | ((high & 1) !== 0 ? 16 : 0);
}
// BlockDoor.func_150014_a: open or close the door (lower half's bit 4, metadata flags 2) and play aux effect 1003.
function doorSetOpen(w, x, y, z, open) {
  const flags = doorFlags(w, x, y, z);
  if (((flags & 4) !== 0) === open) return;
  const next = (flags & 7) ^ 4;
  w.setBlockMetadataWithNotify(x, (flags & 8) === 0 ? y : y - 1, z, next, 2);
  w.playAuxSFX(1003, x, y, z);
}
function door(self) {
  const onNeighborBlockChange = (w, x, y, z, source) => {
    const meta = w.getBlockMetadata(x, y, z);
    if ((meta & 8) === 0) {
      let broke = false;
      if (w.getBlock(x, y + 1, z) !== self) {
        w.setBlockToAir(x, y, z);
        broke = true;
      }
      if (!w.doesBlockHaveSolidTopSurface(x, y - 1, z)) {
        w.setBlockToAir(x, y, z);
        broke = true;
        if (w.getBlock(x, y + 1, z) === self) w.setBlockToAir(x, y + 1, z);
      }
      if (broke) w.dropBlockAsItem(x, y, z, self, meta);
      else {
        const powered = w.isBlockIndirectlyGettingPowered(x, y, z) || w.isBlockIndirectlyGettingPowered(x, y + 1, z);
        if ((powered || w.canProvidePower(source)) && source !== self) doorSetOpen(w, x, y, z, powered);
      }
    } else {
      if (w.getBlock(x, y - 1, z) !== self) w.setBlockToAir(x, y, z);
      if (source !== self) onNeighborBlockChange(w, x, y - 1, z, source);
    }
  };
  return { onNeighborBlockChange };
}
// ---- BlockTNT (aob, 46): primes from power on placement and on neighbour changes ----
const tnt = (() => {
  const check = (w, x, y, z) => {
    if (!w.isBlockIndirectlyGettingPowered(x, y, z)) return;
    w.primeTnt(x, y, z); // onBlockDestroyedByPlayer(meta 1)
    w.setBlockToAir(x, y, z);
  };
  return { onBlockAdded: check, onNeighborBlockChange: check };
})();

// ---- BlockTripWireHook (aog, 131) and BlockTripWire (aof, 132) ----
// Hook metadata: bits 0-1 facing (Direction index), 4 attached, 8 powered. String metadata: 1 active
// (powered), 2 suspended (no solid top below), 4 attached, 8 disarmed. Ported from the bytecode of both
// classes; the entity-free paths are probed (tools/verify-tripwire.mjs). The string's sensing box uses the
// constructor bounds (y 0..0.15625); the native singleton's bounds drift with the last
// setBlockBoundsBasedOnState call (a client/selection quirk) and are not modelled.
const hookCell = (w, x, y, z) => {
  const l = w.getBlockMetadata(x, y, z) & 3;
  return [x + (l === 3 ? -1 : l === 1 ? 1 : 0), z + (l === 0 ? -1 : l === 2 ? 1 : 0)];
};
// func_150136_a's private notify: the hook itself, then the block it is attached to (direction `dir`).
function hookNotify(w, x, y, z, dir) {
  w.notifyBlocksOfNeighborChange(x, y, z, TRIPWIRE_HOOK);
  if (dir === 3) w.notifyBlocksOfNeighborChange(x - 1, y, z, TRIPWIRE_HOOK);
  else if (dir === 1) w.notifyBlocksOfNeighborChange(x + 1, y, z, TRIPWIRE_HOOK);
  else if (dir === 0) w.notifyBlocksOfNeighborChange(x, y, z - 1, TRIPWIRE_HOOK);
  else if (dir === 2) w.notifyBlocksOfNeighborChange(x, y, z + 1, TRIPWIRE_HOOK);
}
function hookSounds(w, x, y, z, attached, powered, wasAttached, wasPowered) {
  const sx = x + 0.5,
    sy = y + 0.1,
    sz = z + 0.5;
  if (powered && !wasPowered) w.playSoundEffect(sx, sy, sz, "random.click", Math.fround(0.4), Math.fround(0.6));
  else if (!powered && wasPowered) w.playSoundEffect(sx, sy, sz, "random.click", Math.fround(0.4), Math.fround(0.5));
  else if (attached && !wasAttached) w.playSoundEffect(sx, sy, sz, "random.click", Math.fround(0.4), Math.fround(0.7));
  else if (!attached && wasAttached)
    w.playSoundEffect(sx, sy, sz, "random.bowhit", Math.fround(0.4), Math.fround(Math.fround(1.2) / Math.fround(Math.fround(w.rand.nextFloat() * Math.fround(0.2)) + Math.fround(0.9))));
}
// BlockTripWireHook.func_150136_a(world, x, y, z, destroying, meta, notifySelf, overrideDist, overrideMeta).
function hookUpdate(w, x, y, z, destroying, meta, notifySelf, overrideDist, overrideMeta) {
  const l = meta & 3,
    wasAttached = (meta & 4) > 0,
    wasPowered = (meta & 8) > 0,
    suspended = !w.doesBlockHaveSolidTopSurface(x, y - 1, z),
    dx = DIR_X[l],
    dz = DIR_Z[l],
    line = new Array(42);
  let attached = !destroying,
    powered = false,
    k = 0;
  for (let j = 1; j < 42; j++) {
    const cx = x + dx * j,
      cz = z + dz * j,
      id = w.getBlock(cx, y, cz);
    if (id === TRIPWIRE_HOOK) {
      if ((w.getBlockMetadata(cx, y, cz) & 3) === ROTATE_OPPOSITE[l]) k = j;
      break;
    }
    if (id === TRIPWIRE || j === overrideDist) {
      const m = j === overrideDist ? overrideMeta : w.getBlockMetadata(cx, y, cz),
        armed = (m & 8) === 0;
      attached = attached && (m & 2) > 0 === suspended;
      powered = powered || (armed && (m & 1) > 0);
      line[j] = m;
      if (j === overrideDist) {
        w.scheduleBlockUpdate(x, y, z, TRIPWIRE_HOOK, 10);
        attached = attached && armed;
      }
    } else {
      line[j] = -1;
      attached = false;
    }
  }
  attached = attached && k > 1;
  powered = powered && attached;
  const bits = (attached ? 4 : 0) | (powered ? 8 : 0),
    newMeta = l | bits;
  if (k > 0) {
    const fx = x + dx * k,
      fz = z + dz * k,
      fd = ROTATE_OPPOSITE[l];
    w.setBlockMetadataWithNotify(fx, y, fz, fd | bits, 3);
    hookNotify(w, fx, y, fz, fd);
    hookSounds(w, fx, y, fz, attached, powered, wasAttached, wasPowered);
  }
  hookSounds(w, x, y, z, attached, powered, wasAttached, wasPowered);
  if (!destroying) {
    w.setBlockMetadataWithNotify(x, y, z, newMeta, 3);
    if (notifySelf) hookNotify(w, x, y, z, l);
  }
  if (wasAttached !== attached)
    for (let i = 1; i < k; i++) {
      let m = line[i];
      if (m < 0) continue;
      m = attached ? m | 4 : m & -5;
      w.setBlockMetadataWithNotify(x + dx * i, y, z + dz * i, m, 3);
    }
}
const hookCanPlace = (w, x, y, z) =>
  w.isNormalCube(w.getBlock(x - 1, y, z)) || w.isNormalCube(w.getBlock(x + 1, y, z)) || w.isNormalCube(w.getBlock(x, y, z - 1)) || w.isNormalCube(w.getBlock(x, y, z + 1));
const tripwireHook = {
  onNeighborBlockChange(w, x, y, z, source) {
    if (source === TRIPWIRE_HOOK) return;
    const meta = w.getBlockMetadata(x, y, z);
    if (!hookCanPlace(w, x, y, z)) {
      w.dropBlockAsItem(x, y, z, TRIPWIRE_HOOK, meta);
      w.setBlockToAir(x, y, z);
      return;
    }
    const [ax, az] = hookCell(w, x, y, z);
    if (!w.isNormalCube(w.getBlock(ax, y, az))) {
      w.dropBlockAsItem(x, y, z, TRIPWIRE_HOOK, meta);
      w.setBlockToAir(x, y, z);
    }
  },
  onPostBlockPlaced(w, x, y, z, meta) {
    hookUpdate(w, x, y, z, false, meta, false, -1, 0);
  },
  updateTick(w, x, y, z) {
    hookUpdate(w, x, y, z, false, w.getBlockMetadata(x, y, z), true, -1, 0);
  },
  breakBlock(w, x, y, z, old, meta) {
    const a = (meta & 4) > 0,
      p = (meta & 8) > 0;
    if (a || p) hookUpdate(w, x, y, z, true, meta, false, -1, 0);
    if (p) hookNotify(w, x, y, z, meta & 3);
  },
  weak: (w, x, y, z) => ((w.getBlockMetadata(x, y, z) & 8) > 0 ? 15 : 0),
  strong(w, x, y, z, side) {
    const m = w.getBlockMetadata(x, y, z);
    if ((m & 8) === 0) return 0;
    const l = m & 3;
    return (l === 2 && side === 2) || (l === 0 && side === 3) || (l === 1 && side === 4) || (l === 3 && side === 5) ? 15 : 0;
  },
};
// BlockTripWire.func_150138_a: tell the hooks at both ends of the string line about its metadata.
function tripwireNotifyHooks(w, x, y, z, meta) {
  for (let i = 0; i < 2; i++)
    for (let j = 1; j < 42; j++) {
      const cx = x + DIR_X[i] * j,
        cz = z + DIR_Z[i] * j,
        id = w.getBlock(cx, y, cz);
      if (id === TRIPWIRE_HOOK) {
        const hm = w.getBlockMetadata(cx, y, cz);
        if ((hm & 3) === ROTATE_OPPOSITE[i]) hookUpdate(w, cx, y, cz, false, hm, true, j, meta);
        break;
      }
      if (id !== TRIPWIRE) break;
    }
}
// func_150140_e: re-sense entities in the string's box and publish a change.
function tripwireSense(w, x, y, z) {
  let meta = w.getBlockMetadata(x, y, z);
  const was = (meta & 1) > 0,
    active = w.getEntities("all", [x, y, z, x + 1, y + 0.15625, z + 1]).length > 0;
  if (active && !was) meta |= 1;
  if (!active && was) meta &= -2;
  if (active !== was) {
    w.setBlockMetadataWithNotify(x, y, z, meta, 3);
    tripwireNotifyHooks(w, x, y, z, meta);
  }
  if (active) w.scheduleBlockUpdate(x, y, z, TRIPWIRE, 10);
}
const tripwire = {
  onNeighborBlockChange(w, x, y, z) {
    const meta = w.getBlockMetadata(x, y, z);
    if ((meta & 2) > 0 !== !w.doesBlockHaveSolidTopSurface(x, y - 1, z)) {
      w.dropBlockAsItem(x, y, z, TRIPWIRE, meta);
      w.setBlockToAir(x, y, z);
    }
  },
  onBlockAdded(w, x, y, z) {
    const meta = w.doesBlockHaveSolidTopSurface(x, y - 1, z) ? 0 : 2;
    w.setBlockMetadataWithNotify(x, y, z, meta, 3);
    tripwireNotifyHooks(w, x, y, z, meta);
  },
  breakBlock(w, x, y, z, old, meta) {
    tripwireNotifyHooks(w, x, y, z, meta | 1);
  },
  onEntityCollidedWithBlock(w, x, y, z) {
    if ((w.getBlockMetadata(x, y, z) & 1) === 1) return;
    tripwireSense(w, x, y, z);
  },
  updateTick(w, x, y, z) {
    if ((w.getBlockMetadata(x, y, z) & 1) !== 1) return;
    tripwireSense(w, x, y, z);
  },
};

const BEHAVIOUR = {
  [TNT]: tnt,
  [WOODEN_DOOR]: door(WOODEN_DOOR),
  [IRON_DOOR]: door(IRON_DOOR),
  [WIRE]: wire,
  [TORCH]: redstoneTorch(true),
  [UNLIT_TORCH]: redstoneTorch(false),
  [LEVER]: lever,
  [STONE_BUTTON]: button(STONE_BUTTON, false),
  [WOOD_BUTTON]: button(WOOD_BUTTON, true),
  [LAMP]: lamp(false),
  [LIT_LAMP]: lamp(true),
  // BlockCompressedPowered: weak power 15 on every side, no strong power.
  [REDSTONE_BLOCK]: { weak: () => 15 },
  [DAYLIGHT_SENSOR]: { weak: (w, x, y, z) => w.getBlockMetadata(x, y, z) },
  [REPEATER]: repeater(false),
  [POWERED_REPEATER]: repeater(true),
  [COMPARATOR]: comparator(false),
  [POWERED_COMPARATOR]: comparator(true),
  [STONE_PLATE]: pressurePlate(STONE_PLATE, { mode: "living", rate: 20 }),
  [WOOD_PLATE]: pressurePlate(WOOD_PLATE, { mode: "all", rate: 20 }),
  [LIGHT_PLATE]: pressurePlate(LIGHT_PLATE, { max: 15, rate: 10, weighted: true }),
  [HEAVY_PLATE]: pressurePlate(HEAVY_PLATE, { max: 150, rate: 10, weighted: true }),
  [TRIPWIRE_HOOK]: tripwireHook,
  [TRIPWIRE]: tripwire,
  [PISTON]: pistonBase(PISTON),
  [STICKY_PISTON]: pistonBase(STICKY_PISTON),
  [PISTON_HEAD]: pistonHead,
  [PISTON_MOVING]: pistonMoving,
};
export const PORTED_BLOCKS = Object.keys(BEHAVIOUR).map(Number);

// Scenario driver shared by tools/verify-redstone.mjs and src/redstone.test.js. A scenario is
// { origin:[x,y,z], size:[dx,dy,dz], ticks, seed, grid:"id[:meta],..." (x-major, then y, z),
//   events:[[tick, "place"|"air"|"use", x, y, z, id?, meta?]] } with region-relative coordinates.
// Events of tick t run before tick t's world tick (as player packets between server ticks).
export function replayScenario(s, make = (options) => new RedstoneWorld(options)) {
  const [ox, oy, oz] = s.origin,
    [dx, dy, dz] = s.size,
    w = make({ seed: s.seed, log: true, sky: s.sky ?? 15, skylightSubtracted: s.skylightSubtracted ?? 0, celestialAngle: s.angle ?? 0, noSky: s.noSky ?? false }),
    cells = s.grid.split(",");
  for (let x = 0; x < dx; x++)
    for (let y = 0; y < dy; y++)
      for (let z = 0; z < dz; z++) {
        const [id, meta = 0] = cells[(x * dy + y) * dz + z].split(":").map(Number);
        if (id !== AIR) w.setRaw(ox + x, oy + y, oz + z, id, meta);
      }
  const snapshot = () => {
    const out = [];
    for (let x = 0; x < dx; x++)
      for (let y = 0; y < dy; y++)
        for (let z = 0; z < dz; z++) out.push([w.getBlock(ox + x, oy + y, oz + z), w.getBlockMetadata(ox + x, oy + y, oz + z)]);
    return out;
  };
  // TileEntityComparator output signal of every comparator block (ids 149 and 150) in the region, else 0.
  const signals = () => {
    const out = [];
    for (let x = 0; x < dx; x++)
      for (let y = 0; y < dy; y++)
        for (let z = 0; z < dz; z++) {
          const id = w.getBlock(ox + x, oy + y, oz + z);
          out.push(isComparatorId(id) ? w.comparatorTile(ox + x, oy + y, oz + z).signal : 0);
        }
    return out;
  };
  let prev = snapshot(),
    prevSig = signals();
  const frames = [],
    tiles = [],
    te = [],
    calls = [],
    sounds = [],
    drops = [];
  for (let t = 1; t <= s.ticks; t++) {
    w.log.length = 0;
    const soundStart = w.sounds.length,
      dropStart = w.drops.length;
    for (const [et, op, x0, y0, z0, ...args] of s.events) {
      if (et !== t) continue;
      const x = ox + x0,
        y = oy + y0,
        z = oz + z0,
        [id, meta] = args;
      w.record(`E,${op}`);
      if (op === "place") w.setBlock(x, y, z, id, meta, 3);
      else if (op === "place2") w.setBlock(x, y, z, id, meta, 2);
      else if (op === "placehook") {
        if (w.setBlock(x, y, z, id, meta, 3) && w.getBlock(x, y, z) === id) w.behaviours[id]?.onPostBlockPlaced?.(w, x, y, z, meta);
      } else if (op === "air") w.setBlockToAir(x, y, z);
      else if (op === "use") w.activate(x, y, z);
      else if (op === "placeby") w.placeBy(x, y, z, id, meta);
      else if (op === "placepiston") {
        // ItemBlock.placeBlockAt: setBlock(id, 0, 3), then onBlockPlacedBy for a placer standing at (px, py, pz).
        const [, px, py, pz, yaw] = args;
        if (w.setBlock(x, y, z, id, 0, 3) && w.getBlock(x, y, z) === id) w.behaviours[id]?.onBlockPlacedBy?.(w, x, y, z, { x: ox + px, y: oy + py, z: oz + pz, yaw });
      }
      else if (op === "cauldron") {
        // BlockCauldron.func_150024_a(setWaterLevel): clamp 0..3, metadata flags 2, then the comparator update.
        w.setBlockMetadataWithNotify(x, y, z, Math.min(Math.max(id, 0), 3), 2);
        w.updateNeighbourForOutputSignal(x, y, z, CAULDRON);
      } else if (op === "entity") {
        // Scripted entity standing in cell (x, y, z): 0.25-wide box at the cell centre, on the floor.
        const kind = ["item", "mob", "player"][id];
        w.entities.push({ kind, cell: [x, y, z], box: [x + 0.375, y, z + 0.375, x + 0.625, y + 0.25, z + 0.625] });
      } else if (op === "unentity") w.entities = w.entities.filter((e) => !(e.cell[0] === x && e.cell[1] === y && e.cell[2] === z));
      else if (op === "collide") w.collide(x, y, z);
      else if (op === "container") {
        w.setBlock(x, y, z, id, meta ?? 0, 3);
        w.containerTile(x, y, z, id);
      } else if (op === "slot") w.setContainerSlot(x, y, z, id, meta, args[2], args[4] ?? itemStackLimit(meta), args[3] ?? 0);
      else if (op === "notify") w.notifyBlockOfNeighborChange(x, y, z, id);
      else if (op === "cake") w.setBlockMetadataWithNotify(x, y, z, id, 3);
      else if (op === "record") {
        w.containerTile(x, y, z, JUKEBOX).record = id;
        w.setBlockMetadataWithNotify(x, y, z, 1, 2);
        w.record(`q,${Math.max(0, id + 1 - 2256)}`);
      }
      else if (op === "power") w.record(`q,${w.strongPower(x, y, z, id)},${w.weakPower(x, y, z, id)},${Number(w.isBlockIndirectlyGettingPowered(x + 1, y, z))}`);
      else if (op === "daylight") refreshDaylightSensor(w, x, y, z);
      else if (op === "fixture") {
        w.sky = id; w.skylightSubtracted = meta; w.celestialAngle = args[2]; w.noSky = Boolean(args[3]);
      }
      else throw new Error(`Unknown event ${op}`);
    }
    w.time++;
    w.record("T");
    w.tickUpdates();
    w.sendQueuedBlockEvents();
    w.updateTileEntities();
    const now = snapshot(),
      diff = [];
    for (let i = 0; i < now.length; i++)
      if (now[i][0] !== prev[i][0] || now[i][1] !== prev[i][1]) diff.push([Math.floor(i / (dy * dz)), Math.floor(i / dz) % dy, i % dz, now[i][0], now[i][1]]);
    prev = now;
    frames.push(diff);
    const sig = signals(),
      tdiff = [];
    for (let i = 0; i < sig.length; i++)
      if (sig[i] !== prevSig[i]) tdiff.push([Math.floor(i / (dy * dz)), Math.floor(i / dz) % dy, i % dz, sig[i]]);
    prevSig = sig;
    tiles.push(tdiff);
    te.push(w.pistonTiles().map((t) => [t.x - ox, t.y - oy, t.z - oz, t.block, t.meta, t.facing, t.extending ? 1 : 0, t.renderHead ? 1 : 0, t.progress, t.lastProgress]));
    calls.push(w.log.join(" "));
    for (const e of w.sounds.slice(soundStart)) sounds.push([t, e.x, e.y, e.z, e.name, e.volume, e.pitch]);
    for (const e of w.drops.slice(dropStart)) drops.push([t, e.x, e.y, e.z, e.item, e.count, e.damage]);
  }
  return {
    frames,
    tiles,
    te,
    queued: w.queuedBlockEvents().map((d) => [d.x - ox, d.y - oy, d.z - oz, d.id, d.event, d.param]),
    calls,
    final: prev.map(([id, m]) => (m ? `${id}:${m}` : `${id}`)).join(","),
    pending: w.pendingTicks().map((e) => [e.x - ox, e.y - oy, e.z - oz, e.id, e.time - w.time, e.priority]),
    sounds,
    drops,
    rng: w.rand.nextInt(),
    world: w,
  };
}
