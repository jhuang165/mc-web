// Live mineshaft generation for Java worlds (GEN-05b): Minecraft Java 1.7.10 MapGenMineshaft run
// as ChunkProviderGenerate runs it with map features on, but with mineshafts as the only
// structure and the only population feature. Each loaded chunk runs the structure start search
// (MapGenBase.func_151539_a, range 8) after its terrain, caves and ravines; ChunkProviderServer
// then calls Chunk.populateChunk, whose populate step here is only
// MapGenStructure.generateStructuresInChunk(world, populationRandom, x, z) over the original
// population box (chunk * 16 + 8 .. + 23 on each axis). Villages, strongholds, temples, lakes,
// dungeons and decorators do not run, so every mineshaft write sees terrain, caves and ravines
// plus earlier mineshaft writes only.
//
// Finite area: the 8 x 8 live chunks plus a one-chunk ring (chunks -1..8 on each axis, world-local)
// load in x-outer, z-inner order. A chunk populates once it and its +x, +z and +x+z neighbours are
// loaded, so chunks -1..7 populate (81 calls) and every live column receives exactly the writes
// native population would give it for this load order; nothing in the live area is lost. Writes
// that land in the ring stay there, as World.put refuses cells outside 0..127. Ring terrain is
// generated only when a population call reads or writes it.
//
// Block writes go through the 1.7.10 Chunk/World callbacks gen-world.js models, with BlockTorch
// (onBlockAdded wall attachment, support checks and drops) and BlockRail / BlockRailBase$Rail
// (onBlockAdded shape logic, onNeighborBlockChange support, breakBlock slope notification)
// ported here. Redstone power next to a rail is unported and throws. Original numeric IDs
// throughout; generateLiveMineshafts maps the final cells to the live World with block-registry
// fromOriginal, throwing on an unmapped original block. Replayed natively in
// mineshaft-world.test.js against public/research/mineshaft-world-reference.json.
import { GenWorld } from "./gen-world.js";
import { JavaRandom } from "./java-random.js";
import { MapGenMineshaft } from "./mineshaft-generator.js";
import { populationSeed } from "./ore-generator.js";

const AIR = 0, GLASS = 20, POWERED_RAIL = 27, DETECTOR_RAIL = 28, TORCH = 50, MOB_SPAWNER = 52, RAIL = 66, FENCE = 85,
  NETHER_FENCE = 113, COBBLE_WALL = 139, HOPPER = 154, ACTIVATOR_RAIL = 157;
// BlockRailBase.func_150051_a: the four rail blocks.
export const RAIL_BLOCKS = Object.freeze([POWERED_RAIL, DETECTOR_RAIL, RAIL, ACTIVATOR_RAIL]);
const RAILS = new Set(RAIL_BLOCKS);
// BlockTorch.func_150107_m: blocks a torch stands on without a solid top.
export const TORCH_STANDS = Object.freeze([FENCE, NETHER_FENCE, GLASS, COBBLE_WALL]);
const STANDS = new Set(TORCH_STANDS);
// Block.canProvidePower, from MineshaftWorldProbe.
export const POWER_SOURCES = Object.freeze([28, 55, 69, 70, 72, 75, 76, 77, 93, 94, 131, 143, 146, 147, 148, 149, 150, 151, 152]);
const POWER = new Set(POWER_SOURCES);
// World.isBlockNormalCubeDefault on a loaded chunk: Material.isOpaque && renderAsNormalBlock. That
// is exactly the first doesBlockHaveSolidTopSurface test, so it is every block solid on top for all
// metadata except the hopper (solid top by class). MineshaftWorldProbe lists the native set.
// Built on first use: gen-world.js can still be initialising when this module evaluates (the
// world.js -> java-world.js import cycle).
let NORMAL_DEFAULT = null;
export function normalCubeDefaultIds() {
  NORMAL_DEFAULT ??= new Set(Array.from({ length: 256 }, (_, id) => id).filter(
    (id) => id !== HOPPER && Array.from({ length: 16 }, (_, m) => m).every((m) => GenWorld.prototype.solidTop(id, m))));
  return [...NORMAL_DEFAULT];
}
const unported = (what, id) => { throw new Error(`mineshaft-world: unported ${what} for block ${id}`); };
const BOUND = 30000000;
const key = (x, z) => `${x},${z}`;

// BlockRailBase$Rail (ajf).
class Rail {
  constructor(w, x, y, z) {
    this.w = w; this.x = x; this.y = y; this.z = z;
    const id = w.getBlock(x, y, z);
    let meta = w.getBlockMetadata(x, y, z);
    // BlockRailBase.field_150053_a: powered, detector and activator rails cannot curve.
    this.straight = id !== RAIL;
    if (this.straight) meta &= ~8;
    this.connections = [];
    this.setShape(meta);
  }
  setShape(meta) {
    const { x, y, z } = this, c = (this.connections = []);
    if (meta === 0) c.push([x, y, z - 1], [x, y, z + 1]);
    else if (meta === 1) c.push([x - 1, y, z], [x + 1, y, z]);
    else if (meta === 2) c.push([x - 1, y, z], [x + 1, y + 1, z]);
    else if (meta === 3) c.push([x - 1, y + 1, z], [x + 1, y, z]);
    else if (meta === 4) c.push([x, y + 1, z - 1], [x, y, z + 1]);
    else if (meta === 5) c.push([x, y, z - 1], [x, y + 1, z + 1]);
    else if (meta === 6) c.push([x + 1, y, z], [x, y, z + 1]);
    else if (meta === 7) c.push([x - 1, y, z], [x, y, z + 1]);
    else if (meta === 8) c.push([x - 1, y, z], [x, y, z - 1]);
    else if (meta === 9) c.push([x + 1, y, z], [x, y, z - 1]);
  }
  isRail(x, y, z) { return RAILS.has(this.w.getBlock(x, y, z)); }
  // func_150651_b: keep only connections whose rail connects back, at that rail's height.
  refresh() {
    for (let i = 0; i < this.connections.length; i++) {
      const r = this.railAt(this.connections[i]);
      if (r === null || !r.connectsTo(this)) this.connections.splice(i--, 1);
      else this.connections[i] = [r.x, r.y, r.z];
    }
  }
  hasRail(x, y, z) { return this.isRail(x, y, z) || this.isRail(x, y + 1, z) || this.isRail(x, y - 1, z); }
  railAt([x, y, z]) {
    if (this.isRail(x, y, z)) return new Rail(this.w, x, y, z);
    if (this.isRail(x, y + 1, z)) return new Rail(this.w, x, y + 1, z);
    if (this.isRail(x, y - 1, z)) return new Rail(this.w, x, y - 1, z);
    return null;
  }
  connectsTo(r) { return this.connections.some((p) => p[0] === r.x && p[2] === r.z); }
  hasConnection(x, z) { return this.connections.some((p) => p[0] === x && p[2] === z); }
  countAdjacent() {
    const { x, y, z } = this;
    return (this.hasRail(x, y, z - 1) ? 1 : 0) + (this.hasRail(x, y, z + 1) ? 1 : 0) + (this.hasRail(x - 1, y, z) ? 1 : 0) + (this.hasRail(x + 1, y, z) ? 1 : 0);
  }
  canConnectTo(r) { return this.connectsTo(r) || this.connections.length !== 2; }
  slope(n) {
    const { x, y, z } = this;
    if (n === 0) {
      if (this.isRail(x, y + 1, z - 1)) n = 4;
      if (this.isRail(x, y + 1, z + 1)) n = 5;
    }
    if (n === 1) {
      if (this.isRail(x + 1, y + 1, z)) n = 2;
      if (this.isRail(x - 1, y + 1, z)) n = 3;
    }
    return n < 0 ? 0 : n;
  }
  // func_150645_c.
  connect(r) {
    const { x, y, z } = this;
    this.connections.push([r.x, r.y, r.z]);
    const n0 = this.hasConnection(x, z - 1), s = this.hasConnection(x, z + 1), w = this.hasConnection(x - 1, z), e = this.hasConnection(x + 1, z);
    let n = -1;
    if (n0 || s) n = 0;
    if (w || e) n = 1;
    if (!this.straight) {
      if (s && e && !n0 && !w) n = 6;
      if (s && w && !n0 && !e) n = 7;
      if (n0 && w && !s && !e) n = 8;
      if (n0 && e && !s && !w) n = 9;
    }
    n = this.slope(n);
    const meta = this.straight ? (this.w.getBlockMetadata(x, y, z) & 8) | n : n;
    this.w.setBlockMetadata(x, y, z, meta, 3);
  }
  // func_150647_c.
  canConnectFrom(x, y, z) {
    const r = this.railAt([x, y, z]);
    if (r === null) return false;
    r.refresh();
    return r.canConnectTo(this);
  }
  // func_150655_a(powered, force).
  update(powered, force) {
    const { x, y, z } = this;
    const n0 = this.canConnectFrom(x, y, z - 1), s = this.canConnectFrom(x, y, z + 1), w = this.canConnectFrom(x - 1, y, z), e = this.canConnectFrom(x + 1, y, z);
    let n = -1;
    if ((n0 || s) && !w && !e) n = 0;
    if ((w || e) && !n0 && !s) n = 1;
    if (!this.straight) {
      if (s && e && !n0 && !w) n = 6;
      if (s && w && !n0 && !e) n = 7;
      if (n0 && w && !s && !e) n = 8;
      if (n0 && e && !s && !w) n = 9;
    }
    if (n === -1) {
      if (n0 || s) n = 0;
      if (w || e) n = 1;
      if (!this.straight) {
        if (powered) {
          if (s && e) n = 6;
          if (w && s) n = 7;
          if (e && n0) n = 9;
          if (n0 && w) n = 8;
        } else {
          if (n0 && w) n = 8;
          if (e && n0) n = 9;
          if (w && s) n = 7;
          if (s && e) n = 6;
        }
      }
    }
    n = this.slope(n);
    this.setShape(n);
    const meta = this.straight ? (this.w.getBlockMetadata(x, y, z) & 8) | n : n;
    if (force || this.w.getBlockMetadata(x, y, z) !== meta) {
      this.w.setBlockMetadata(x, y, z, meta, 3);
      for (let i = 0; i < this.connections.length; i++) {
        const r = this.railAt(this.connections[i]);
        if (r === null) continue;
        r.refresh();
        if (r.canConnectTo(this)) r.connect(this);
      }
    }
  }
}

// A GenWorld over chunks that load in a set order: chunkExists is the loaded set, and a loaded
// chunk's GenChunk is built from terrain(cx, cz) -> {blocks, metadata} on first access. Defined on
// first use: when gen-world.js is the first module loaded, its population-tail.js -> java-world.js
// import reaches this module before GenWorld exists.
const defineGenWorld = () => class MineshaftGenWorld extends GenWorld {
  constructor({ rand, terrain }) {
    super({ rand });
    this.terrain = terrain; this.loaded = new Set(); this.last = null;
    // Spawner tile entities in creation order and EntityMinecartChest spawns.
    this.spawners = []; this.carts = []; this.items = [];
    this.onItem = (x, y, z, item, count, damage) => this.items.push({ x, y, z, item, count, damage });
  }
  load(x, z) { this.loaded.add(key(x, z)); }
  chunkExists(x, z) { return this.loaded.has(key(x, z)); }
  chunk(x, z) {
    const last = this.last;
    if (last && last.x === x && last.z === z) return last;
    let c = this.chunks.get(key(x, z));
    if (!c) {
      if (!this.chunkExists(x, z)) throw new Error(`mineshaft-world: unloaded chunk ${x},${z}`);
      const t = this.terrain(x, z);
      c = this.addChunk(x, z, t.blocks, t.metadata);
    }
    return (this.last = c);
  }
  spawnEntity(entity) {
    if (entity.type !== "MinecartChest") unported("entity", entity.type);
    this.carts.push(entity);
    return super.spawnEntity(entity);
  }
  createTile(id, x, y, z, meta) {
    const t = super.createTile(id, x, y, z, meta);
    if (t.kind === "spawner") this.spawners.push(t);
    return t;
  }
  // Spawner tiles still in their chunk's map (a later write may have removed one).
  liveSpawners() {
    return this.spawners.filter((t) => this.chunk(t.x >> 4, t.z >> 4).tiles.get(t.y << 8 | (t.z & 15) << 4 | (t.x & 15)) === t);
  }

  // World.isBlockNormalCubeDefault (every chunk read here is loaded).
  normalCubeDefault(x, y, z) {
    if (x < -BOUND || z < -BOUND || x >= BOUND || z >= BOUND) return true;
    if (!this.chunkExists(x >> 4, z >> 4)) unported("normal-cube read of an unloaded chunk", -1);
    if (!NORMAL_DEFAULT) normalCubeDefaultIds();
    return NORMAL_DEFAULT.has(this.getBlock(x, y, z));
  }
  // World.doesBlockHaveSolidTopSurface.
  solidTopAt(x, y, z) { const id = this.getBlock(x, y, z); return this.solidTop(id, this.getBlockMetadata(x, y, z)); }
  // World.isBlockIndirectlyGettingPowered with its reads: a normal cube side reads its six
  // neighbours (getBlockPowerInput), any other side reads itself twice. No block here provides
  // power, so it is false unless a power source is in reach, which is unported.
  indirectlyPowered(x, y, z) {
    const sides = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
    for (const [dx, dy, dz] of sides) {
      const ax = x + dx, ay = y + dy, az = z + dz, id = this.getBlock(ax, ay, az);
      if (this.isNormalCube(id)) {
        for (const [ex, ey, ez] of sides) { const n = this.getBlock(ax + ex, ay + ey, az + ez); if (POWER.has(n)) unported("redstone power", n); }
      } else {
        // getIndirectPowerLevelTo reads the block again for isProvidingWeakPower.
        const again = this.getBlock(ax, ay, az);
        if (POWER.has(again)) unported("redstone power", again);
      }
    }
    return false;
  }

  // BlockTorch.
  torchStand(x, y, z) { return this.solidTopAt(x, y, z) || STANDS.has(this.getBlock(x, y, z)); }
  torchCanPlace(x, y, z) {
    return this.normalCubeDefault(x - 1, y, z) || this.normalCubeDefault(x + 1, y, z) || this.normalCubeDefault(x, y, z - 1) ||
      this.normalCubeDefault(x, y, z + 1) || this.torchStand(x, y - 1, z);
  }
  torchCheck(x, y, z) {
    if (this.torchCanPlace(x, y, z)) return true;
    if (this.getBlock(x, y, z) === TORCH) { this.dropBlockAsItem(TORCH, x, y, z, this.getBlockMetadata(x, y, z), 0); this.setBlockToAir(x, y, z); }
    return false;
  }
  torchAdded(x, y, z) {
    if (this.getBlockMetadata(x, y, z) === 0) {
      if (this.normalCubeDefault(x - 1, y, z)) this.setBlockMetadata(x, y, z, 1, 2);
      else if (this.normalCubeDefault(x + 1, y, z)) this.setBlockMetadata(x, y, z, 2, 2);
      else if (this.normalCubeDefault(x, y, z - 1)) this.setBlockMetadata(x, y, z, 3, 2);
      else if (this.normalCubeDefault(x, y, z + 1)) this.setBlockMetadata(x, y, z, 4, 2);
      else if (this.torchStand(x, y - 1, z)) this.setBlockMetadata(x, y, z, 5, 2);
    }
    this.torchCheck(x, y, z);
  }
  torchNeighbor(x, y, z) {
    if (!this.torchCheck(x, y, z)) return;
    const m = this.getBlockMetadata(x, y, z);
    let drop = false;
    if (!this.normalCubeDefault(x - 1, y, z) && m === 1) drop = true;
    if (!this.normalCubeDefault(x + 1, y, z) && m === 2) drop = true;
    if (!this.normalCubeDefault(x, y, z - 1) && m === 3) drop = true;
    if (!this.normalCubeDefault(x, y, z + 1) && m === 4) drop = true;
    if (!this.torchStand(x, y - 1, z) && m === 5) drop = true;
    if (drop) { this.dropBlockAsItem(TORCH, x, y, z, this.getBlockMetadata(x, y, z), 0); this.setBlockToAir(x, y, z); }
  }
  // BlockRailBase.onNeighborBlockChange, then BlockRail.func_150048_a.
  railNeighbor(x, y, z, source) {
    const m = this.getBlockMetadata(x, y, z);
    let drop = false;
    if (!this.solidTopAt(x, y - 1, z)) drop = true;
    if (m === 2 && !this.solidTopAt(x + 1, y, z)) drop = true;
    if (m === 3 && !this.solidTopAt(x - 1, y, z)) drop = true;
    if (m === 4 && !this.solidTopAt(x, y, z - 1)) drop = true;
    if (m === 5 && !this.solidTopAt(x, y, z + 1)) drop = true;
    if (drop) { this.dropBlockAsItem(RAIL, x, y, z, this.getBlockMetadata(x, y, z), 0); this.setBlockToAir(x, y, z); }
    else if (POWER.has(source)) unported("rail power update", source);
  }

  blockAdded(id, x, y, z) {
    if (id === TORCH) this.torchAdded(x, y, z);
    else if (id === RAIL) new Rail(this, x, y, z).update(this.indirectlyPowered(x, y, z), true);
    else super.blockAdded(id, x, y, z);
  }
  neighborChanged(id, x, y, z, source) {
    if (id === TORCH) this.torchNeighbor(x, y, z);
    else if (id === RAIL) this.railNeighbor(x, y, z, source);
    else super.neighborChanged(id, x, y, z, source);
  }
  breakBlock(id, x, y, z, meta) {
    // BlockRailBase.breakBlock: a slope tells the blocks around the cell above it.
    if (id === RAIL) { if (meta >= 2 && meta <= 5) this.notifyNeighbors(x, y + 1, z, RAIL); }
    else if (id !== TORCH) super.breakBlock(id, x, y, z, meta);
  }
  // Block.dropBlockAsItemWithChance at chance 1: one item, damage 0, for torches and rails.
  dropBlockAsItem(id, x, y, z, meta, fortune) {
    if (id !== TORCH && id !== RAIL) return super.dropBlockAsItem(id, x, y, z, meta, fortune);
    if (this.rand.nextFloat() <= 1) this.spawnItem(x, y, z, id, 1, 0);
  }
};
let genWorldClass = null;
export const mineshaftGenWorldClass = () => (genWorldClass ??= defineGenWorld());

// The load and population schedule over chunks (chunkX - 1 .. chunkX + size) x (chunkZ - 1 ..
// chunkZ + size), absolute chunk coordinates. hooks.beforePopulate(cx, cz) / afterPopulate(cx, cz,
// random, result) bracket each generateStructuresInChunk call.
export class MineshaftPopulation {
  constructor({ seed, chunkX, chunkZ, size = 8, terrain, worldRandSeed = 0n }) {
    this.seed = BigInt.asIntN(64, BigInt(seed)); this.chunkX = chunkX; this.chunkZ = chunkZ; this.size = size;
    this.mineshafts = new MapGenMineshaft(this.seed);
    this.world = new (mineshaftGenWorldClass())({ rand: new JavaRandom(BigInt(worldRandSeed)), terrain });
    this.populated = new Set(); this.order = [];
  }
  run(hooks = {}) {
    const w = this.world, exists = (x, z) => w.chunkExists(x, z), done = (x, z) => this.populated.has(key(x, z));
    const populate = (x, z) => {
      // ChunkProviderServer.populate marks the chunk populated before ChunkProviderGenerate runs.
      this.populated.add(key(x, z)); this.order.push([x, z]);
      hooks.beforePopulate?.(x, z);
      const random = new JavaRandom(populationSeed(this.seed, x, z));
      const result = this.mineshafts.generateStructuresInChunk(w, random, x, z);
      hooks.afterPopulate?.(x, z, random, result);
    };
    for (let x = this.chunkX - 1; x <= this.chunkX + this.size; x++)
      for (let z = this.chunkZ - 1; z <= this.chunkZ + this.size; z++) {
        // provideChunk: terrain, caves and ravines (built lazily), then the structure start search.
        this.mineshafts.generate(x, z);
        w.load(x, z);
        // Chunk.populateChunk (the second and third checks repeat a test, as native does).
        if (!done(x, z) && exists(x + 1, z + 1) && exists(x, z + 1) && exists(x + 1, z)) populate(x, z);
        if (exists(x - 1, z) && !done(x - 1, z) && exists(x - 1, z + 1) && exists(x, z + 1) && exists(x - 1, z + 1)) populate(x - 1, z);
        if (exists(x, z - 1) && !done(x, z - 1) && exists(x + 1, z - 1) && exists(x + 1, z - 1) && exists(x + 1, z)) populate(x, z - 1);
        if (exists(x - 1, z - 1) && !done(x - 1, z - 1) && exists(x, z - 1) && exists(x - 1, z)) populate(x - 1, z - 1);
      }
    return this;
  }
}

// block-registry.js imports world.js, which reaches this module through java-world.js, so a static
// import here would evaluate block-registry before world.js. The mapper loads once the module graph
// has; setOriginalBlockMapper replaces it (tests, or callers that already hold it).
let blockMapper = null, blockMapperError = null;
export function setOriginalBlockMapper(fn) { blockMapper = fn; }
export const originalBlockMapperReady = import("./block-registry.js").then(
  (m) => (blockMapper ??= m.fromOriginal),
  (e) => { blockMapperError = e; return null; },
);

const stackRecord = (slot, s) => {
  const r = { slot, id: s[0], damage: s[2], count: s[1] };
  if (s[3]?.length) r.stored = s[3].map(([id, lvl]) => ({ id, lvl }));
  return r;
};

// Runs the population over a live Java World (generationVersion >= 10) whose 64 chunks hold
// `originals` (absolute "cx,cz" -> provideChunk output after caves and ravines, original IDs) and
// whose ring chunks come from ringTerrain(cx, cz). Changed cells are mapped with fromOriginal and
// written into the live chunk arrays; world.generatedStructures receives the JSON-safe record.
export function generateLiveMineshafts(world, { seed, originals, ringTerrain, mapBlock = blockMapper }) {
  if (!mapBlock) throw blockMapperError ?? new Error("mineshaft-world: block-registry not loaded yet; await originalBlockMapperReady or call setOriginalBlockMapper");
  const ox = world.originX, oz = world.originZ, cx0 = ox >> 4, cz0 = oz >> 4;
  const terrain = (x, z) => originals.get(key(x, z)) ?? ringTerrain(x, z);
  const pass = new MineshaftPopulation({ seed, chunkX: cx0, chunkZ: cz0, terrain }).run();
  const w = pass.world, inArea = (x, z) => x >= ox && z >= oz && x < ox + 128 && z < oz + 128;
  for (const c of w.chunks.values()) {
    const lx = c.x - cx0, lz = c.z - cz0;
    if (lx < 0 || lz < 0 || lx >= 8 || lz >= 8) continue;
    const source = originals.get(key(c.x, c.z)), live = world.chunkAt(lx, lz);
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 0; y < 256; y++) {
      const i = (x * 16 + z) * 256 + y, id = c.getBlock(x, y, z), meta = c.getMeta(x, y, z);
      if (id === source.blocks[i] && meta === source.metadata[i]) continue;
      const r = mapBlock(id, meta);
      if (!r) throw new Error(`mineshaft-world: unmapped original block ${id}:${meta} at ${c.x * 16 + x},${y},${c.z * 16 + z}`);
      live.blocks[i] = r.id; live.meta[i] = r.meta;
    }
    live.tickCounts = null;
  }
  const local = (b) => [b.minX - ox, b.minY, b.minZ - oz, b.maxX - ox, b.maxY, b.maxZ - oz];
  world.generatedStructures = {
    mineshafts: pass.mineshafts.structureMap.values()
      .filter((s) => s.boundingBox.intersectsWithXZ(ox, oz, ox + 127, oz + 127))
      .map((s) => ({ chunkX: s.chunkX - cx0, chunkZ: s.chunkZ - cz0, boundingBox: local(s.boundingBox) })),
    spawners: w.liveSpawners().filter((t) => inArea(t.x, t.z)).map((t) => ({ x: t.x - ox, y: t.y, z: t.z - oz, entityId: t.name })),
    minecartChests: w.carts.filter((e) => inArea(Math.floor(e.x), Math.floor(e.z))).map((e) => ({
      x: e.x - ox, y: e.y, z: e.z - oz,
      items: e.slots.flatMap((s, slot) => (s ? [stackRecord(slot, s)] : [])),
    })),
    // Scheduled ticks population left (water next to a dropped torch, say) and dropped items,
    // neither of which the live world receives.
    pendingTicks: w.pending.filter(([x, , z]) => inArea(x, z)).map(([x, y, z, id, delay]) => ({ x: x - ox, y, z: z - oz, id, delay })),
    droppedItems: w.items.filter((d) => inArea(Math.floor(d.x), Math.floor(d.z))).length,
  };
  return pass;
}
