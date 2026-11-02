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
//   Block.dropBlockAsItemWithChance / dropBlockAsItem_do world-Random draws.
//
// Evidence: tools/probes/RedstoneProbe.java runs those classes in a real World and Chunks
// and records public/research/redstone-reference.json; src/redstone.test.js replays every
// scenario here. Not ported: repeaters, comparators, pistons, pressure plates, tripwire,
// daylight sensors, powered rails/doors/TNT/note blocks, random ticks, lighting, rendering.
// This module is not wired into the live game.
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
export const COBBLE_WALL = 139;
export const WOOD_BUTTON = 143;
export const COMPARATOR = 149;
export const POWERED_COMPARATOR = 150;
export const REDSTONE_BLOCK = 152;
export const REDSTONE_ITEM = 331;

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
  constructor({ seed = 0, log = false } = {}) {
    this.sections = new Map();
    this.rand = new JavaRandom(seed);
    this.time = 0; // WorldInfo total world time
    this.pending = new Map(); // pendingTickListEntriesHashSet
    this.tree = []; // pendingTickListEntriesTreeSet, sorted
    this.thisTick = []; // pendingTickListEntriesThisTick
    this.serial = 0; // NextTickListEntry.nextTickEntryID
    this.wireUpdates = new ChunkPositionSet(); // BlockRedstoneWire.blocksNeedingUpdate
    this.wiresProvidePower = true; // BlockRedstoneWire.wiresProvidePower
    this.torchToggles = null; // BlockRedstoneTorch.toggles.get(world)
    this.doTileDrops = true;
    this.sounds = [];
    this.drops = [];
    this.log = log ? [] : null;
  }
  record(entry) {
    if (this.log) this.log.push(entry);
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
    BEHAVIOUR[old]?.breakBlock?.(this, x, y, z, old, oldMeta);
    if (s.ids[i] !== id) return false;
    s.meta[i] = meta;
    BEHAVIOUR[id]?.onBlockAdded?.(this, x, y, z);
    if ((flags & 1) !== 0) this.notifyBlocksOfNeighborChange(x, y, z, before);
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
    if ((flags & 1) !== 0) this.notifyBlocksOfNeighborChange(x, y, z, s.ids[i]);
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
  notifyBlockOfNeighborChange(x, y, z, source) {
    this.record(`n,${x},${y},${z},${source}`);
    BEHAVIOUR[this.getBlock(x, y, z)]?.onNeighborBlockChange?.(this, x, y, z, source);
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
      BEHAVIOUR[id]?.updateTick?.(this, e.x, e.y, e.z);
    }
  }
  pendingTicks() {
    return this.tree.map((e) => ({ ...e }));
  }
  // Player right click: Block.onBlockActivated (lever and buttons).
  activate(x, y, z) {
    return BEHAVIOUR[this.getBlock(x, y, z)]?.onBlockActivated?.(this, x, y, z) ?? false;
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
    return BEHAVIOUR[this.getBlock(x, y, z)]?.weak?.(this, x, y, z, side) ?? 0;
  }
  strongPower(x, y, z, side) {
    return BEHAVIOUR[this.getBlock(x, y, z)]?.strong?.(this, x, y, z, side) ?? 0;
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
  playSoundEffect(x, y, z, name, volume, pitch) {
    this.record(`p,${name}`);
    this.sounds.push({ x, y, z, name, volume, pitch });
  }
  // Block.dropBlockAsItem(world, x, y, z, meta, 0): one item, chance 1, three offset floats.
  dropBlockAsItem(x, y, z, id, meta) {
    if (this.rand.nextFloat() > 1) return;
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
const DROP_ITEM = { [WIRE]: REDSTONE_ITEM, [UNLIT_TORCH]: TORCH, [LIT_LAMP]: LAMP };
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

const BEHAVIOUR = {
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
};
export const PORTED_BLOCKS = Object.keys(BEHAVIOUR).map(Number);

// Scenario driver shared by tools/verify-redstone.mjs and src/redstone.test.js. A scenario is
// { origin:[x,y,z], size:[dx,dy,dz], ticks, seed, grid:"id[:meta],..." (x-major, then y, z),
//   events:[[tick, "place"|"air"|"use", x, y, z, id?, meta?]] } with region-relative coordinates.
// Events of tick t run before tick t's world tick (as player packets between server ticks).
export function replayScenario(s) {
  const [ox, oy, oz] = s.origin,
    [dx, dy, dz] = s.size,
    w = new RedstoneWorld({ seed: s.seed, log: true }),
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
  let prev = snapshot();
  const frames = [],
    calls = [],
    sounds = [],
    drops = [];
  for (let t = 1; t <= s.ticks; t++) {
    w.log.length = 0;
    const soundStart = w.sounds.length,
      dropStart = w.drops.length;
    for (const [et, op, x0, y0, z0, id, meta] of s.events) {
      if (et !== t) continue;
      const x = ox + x0,
        y = oy + y0,
        z = oz + z0;
      w.record(`E,${op}`);
      if (op === "place") w.setBlock(x, y, z, id, meta, 3);
      else if (op === "air") w.setBlockToAir(x, y, z);
      else if (op === "use") w.activate(x, y, z);
      else throw new Error(`Unknown event ${op}`);
    }
    w.time++;
    w.record("T");
    w.tickUpdates();
    const now = snapshot(),
      diff = [];
    for (let i = 0; i < now.length; i++)
      if (now[i][0] !== prev[i][0] || now[i][1] !== prev[i][1]) diff.push([Math.floor(i / (dy * dz)), Math.floor(i / dz) % dy, i % dz, now[i][0], now[i][1]]);
    prev = now;
    frames.push(diff);
    calls.push(w.log.join(" "));
    for (const e of w.sounds.slice(soundStart)) sounds.push([t, e.x, e.y, e.z, e.name, e.volume, e.pitch]);
    for (const e of w.drops.slice(dropStart)) drops.push([t, e.x, e.y, e.z, e.item, e.count, e.damage]);
  }
  return {
    frames,
    calls,
    final: prev.map(([id, m]) => (m ? `${id}:${m}` : `${id}`)).join(","),
    pending: w.pendingTicks().map((e) => [e.x - ox, e.y - oy, e.z - oz, e.id, e.time - w.time, e.priority]),
    sounds,
    drops,
    rng: w.rand.nextInt(),
    world: w,
  };
}
