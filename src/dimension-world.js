// The streamed World of the Nether (dimension -1) and the End (dimension 1): the batch-6 generators behind the World API the
// game already runs streamed Overworlds on (an 8 x 8 chunk window that follows the player, block edits kept per column in the
// storage of `${worldId}~${dimension}`). No sky in the Nether; WorldProvider facts live in dimensions.js.
//
// Terrain is the unchanged ChunkProviderHell / ChunkProviderEnd port. Population is a labelled APPROXIMATION: the original
// populates each chunk once, after its +x/+z neighbours exist, on a Random that continues from earlier chunks. A streamed window
// regenerates columns at will, so every column is rebuilt statelessly: terrain of the chunk, then the populate step of the four
// chunks that can write into it (itself and its -x/-z neighbours), each on a Random seeded from that chunk, on a throw-away
// generation world; only the target chunk's cells are kept. Writes that reach beyond the neighbours' 16-block reach are lost.
import { drain } from "./steps.js";
import { World } from "./world.js";
import { javaSeed } from "./java-world.js";
import { JavaRandom } from "./java-random.js";
import { fromOriginal } from "./block-registry.js";
import { fortressMonsterSpawnList, MapGenNetherBridge } from "./fortress.js";
import { NETHER_BRICK } from "./nether-blocks.js";
import { structureTileRecords } from "./population-world.js";
import { StreamingPopulation } from "./streaming-population.js";
import { ChunkProviderHell, NetherGenWorld, hellChunkSeed } from "./nether-generator.js";
import { EndTerrain, EndWorld, populateEndChunk, END_BIOME_ID, END_HEIGHT } from "./end-generator.js";
import { providerOf, NETHER, END } from "./dimensions.js";

const CHUNK = 65536;
// Original block id -> internal id (metadata ignored by the generators except where noted). Unknown ids become netherrack/end stone.
const mapped = new Map();
function internal(mc, meta = 0, fallback = 1) {
  const key = mc << 4 | meta;
  let hit = mapped.get(key);
  if (!hit) {
    const r = mc === 0 ? { id: 0, meta: 0 } : fromOriginal(mc, meta);
    hit = r ? { id: r.id, meta: r.meta } : { id: fallback, meta: 0 };
    mapped.set(key, hit);
  }
  return hit;
}
const NETHER_BIOME = Object.freeze({ id: 8, name: "Hell", rainfall: 0, snowy: false, temperature: 2, topBlock: 150 });
const END_BIOME = Object.freeze({ id: END_BIOME_ID, name: "Sky", rainfall: 0, snowy: false, temperature: 0.5, topBlock: 152 });
const offsets = [[0, 0], [-1, 0], [0, -1], [-1, -1]];
// Stable per-chunk population seed (an approximation of the original's carried-over Random state).
const popSeed = (seed, cx, cz) => BigInt.asIntN(64, seed ^ (BigInt(cx) * 341873128712n + BigInt(cz) * 132897987541n));

class FortressPopulation extends StreamingPopulation {
  constructor(seed) {
    super({ seed, originX: 0, originZ: 0 });
    this.records = new Map();
  }
  cell() { return this; }
  claim(columns) {
    const result = super.claim(columns);
    for (const [x, z] of columns) this.records.delete(`${x},${z}`);
    return result;
  }
}

export class DimensionWorld extends World {
  static pending = 0;
  constructor(seed, dimension) {
    DimensionWorld.pending = dimension; // World's constructor calls generate() before this class's fields exist
    super(seed, "javaStreamed", 12, "default");
  }
  // Called by World's constructor. No first 8 x 8 window is built: streamAround(x, z) fills it for the real position.
  generate() {
    const dimension = DimensionWorld.pending;
    this.dimension = dimension;
    this.isEnd = dimension === END;
    this.hasNoSky = providerOf(dimension).hasNoSky; // the Nether
    this.isHell = dimension === NETHER;
    this.originX = this.originZ = 0;
    this.javaSeed = javaSeed(this.seed);
    this.javaGenerator = { manager: { cache: new Map() } }; // streamAround trims this biome cache
    this.pregenerated = new Map();
    this.noPrefetch = true; // streaming-worker.js would build Overworld terrain
    this.terrainCache = new Map();
    this.provider = dimension === NETHER ? new ChunkProviderHell(this.javaSeed) : null;
    this.populator = dimension === NETHER ? new ChunkProviderHell(this.javaSeed) : null;
    this.population = dimension === NETHER ? new FortressPopulation(this.javaSeed) : null;
    this.endTerrain = dimension === END ? new EndTerrain(this.javaSeed) : null;
    this.biomeAt = () => (dimension === NETHER ? NETHER_BIOME : END_BIOME);
    this.temperatureAt = () => (dimension === NETHER ? 2 : 0.5);
    this.chunks.clear();
    this.lastChunk = null;
    this.minX = this.minZ = Number.NaN; // the first streamAround always builds the window
    this.maxX = this.maxZ = 0;
    this.seaLevel = dimension === NETHER ? 32 : 0;
  }
  // The Nether has 128 usable layers (WorldProvider.getActualHeight); the End 128 of terrain with a build limit of 256.
  get actualHeight() { return providerOf(this.dimension).hasNoSky ? 128 : 256; }
  fortressSpawns(x, y, z) {
    return fortressMonsterSpawnList(this.provider.bridge,
      (bx, by, bz) => this.get(bx, by, bz) === NETHER_BRICK ? 112 : 0, x, y, z);
  }
  // streamAround's contract: { blocks, metadata } in this world's own ids, index (lx * 16 + lz) * height + y.
  generateTerrainChunk(cx, cz) {
    const key = `${cx},${cz}`, hit = this.pregenerated.get(key);
    if (hit) { this.pregenerated.delete(key); return hit; }
    return this.dimension === NETHER ? this.netherChunk(cx, cz) : this.endChunk(cx, cz);
  }
  hellTerrain(x, z) {
    const key = `${x},${z}`;
    let c = this.terrainCache.get(key);
    if (!c) {
      c = this.provider.generateChunk(x, z);
      if (this.terrainCache.size > 400) this.terrainCache.delete(this.terrainCache.keys().next().value);
      this.terrainCache.set(key, c);
    }
    return c;
  }
  netherChunk(cx, cz) {
    const gen = new NetherGenWorld({ rand: new JavaRandom(popSeed(this.javaSeed, cx, cz)), halo: { generateChunk: (x, z) => this.hellTerrain(x, z) } });
    // Each reconstruction owns fresh structure pieces: their one-time loot/spawner
    // flags must not carry over from another generated column.
    this.populator.bridge = new MapGenNetherBridge(this.javaSeed);
    this.populator.bridge.generate(cx, cz);
    let source = null;
    for (const [dx, dz] of offsets) {
      const px = cx + dx, pz = cz + dz;
      this.populator.hellRNG = new JavaRandom(hellChunkSeed(px, pz));
      // A feature the generation world does not port (e.g. fire's neighbour update) skips that populate step only.
      try { this.populator.populate(gen, px, pz); } catch (e) {
        if (!this.populationWarned) { this.populationWarned = true; console.warn(`nether population step skipped: ${e.message}`); }
      }
    }
    try { source = gen.chunk(cx, cz); } catch { source = null; }
    const blocks = new Uint8Array(CHUNK), metadata = new Uint8Array(CHUNK);
    if (source) {
      for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y < 128; y++) {
        const id = source.getBlock(lx, y, lz);
        if (!id) continue;
        const m = internal(id, source.getMeta(lx, y, lz), 150), i = (lx * 16 + lz) * 256 + y;
        blocks[i] = m.id; metadata[i] = m.meta;
      }
      if (!this.population.isMaterialized(cx, cz)) {
        const inside = (x, z) => x >> 4 === cx && z >> 4 === cz;
        const { chests } = structureTileRecords(gen, inside);
        const spawners = [...source.tiles.values()].filter(t => t.kind === "spawner")
          .map(t => ({ x: t.x, y: t.y, z: t.z, entityId: t.name }));
        if (chests.length || spawners.length)
          this.population.records.set(`${cx},${cz}`, { chests, spawners, minecartChests: [], pendingTicks: [] });
      }
    } else {
      const t = this.hellTerrain(cx, cz).blocks;
      for (let i = 0; i < 32768; i++) if (t[i]) blocks[(i >> 7) * 256 + (i & 127)] = internal(t[i], 0, 150).id;
    }
    return { blocks, metadata };
  }
  // Terrain only (no population): what the Teleporter's 257 x 257 search reads before the real window exists. Cheap and cached.
  peekChunk(cx, cz) {
    if (this.dimension !== NETHER) return this.generateTerrainChunk(cx, cz);
    const key = `${cx},${cz}`;
    let hit = this.peekCache?.get(key);
    if (hit) return hit;
    const t = this.hellTerrain(cx, cz).blocks, blocks = new Uint8Array(CHUNK);
    for (let i = 0; i < 32768; i++) if (t[i]) blocks[(i >> 7) * 256 + (i & 127)] = internal(t[i], 0, 150).id;
    hit = { blocks, metadata: new Uint8Array(CHUNK) };
    (this.peekCache ??= new Map()).set(key, hit);
    if (this.peekCache.size > 400) this.peekCache.delete(this.peekCache.keys().next().value);
    return hit;
  }
  endChunk(cx, cz) {
    const end = new EndWorld(0, new JavaRandom(1));
    end.terrain = this.endTerrain; // the noise tables are built once per world
    try {
      for (const [dx, dz] of offsets) {
        const px = cx + dx, pz = cz + dz;
        populateEndChunk(end, new JavaRandom(popSeed(this.javaSeed, px, pz)), px, pz);
      }
    } catch (e) { if (!this.populationWarned) { this.populationWarned = true; console.warn(`end population skipped: ${e.message}`); } }
    const c = end.chunk(cx, cz), blocks = new Uint8Array(CHUNK), metadata = new Uint8Array(CHUNK);
    for (let i = 0; i < CHUNK; i++) {
      const id = c.ids[i];
      if (!id) continue;
      const m = internal(id, c.meta[i], 152);
      blocks[i] = m.id; metadata[i] = m.meta;
    }
    return { blocks, metadata };
  }
  // WorldGenSpikes' EntityEnderCrystal for every spike within `r` chunks of the origin. endChunk keeps only blocks (each
  // column is repopulated with its neighbours), so the crystals are collected once here when the dragon first spawns.
  endCrystals(r = 10) { return drain(this.endCrystalSteps(r)); }
  // The same walk as a generator that yields after each chunk row, so a loading screen can run it in slices (it returns the crystals).
  *endCrystalSteps(r = 10) {
    if (this.dimension !== END) return [];
    const end = new EndWorld(0, new JavaRandom(1));
    end.terrain = this.endTerrain;
    try {
      for (let cx = -r; cx <= r; cx++) {
        for (let cz = -r; cz <= r; cz++) { populateEndChunk(end, new JavaRandom(popSeed(this.javaSeed, cx, cz)), cx, cz); yield; }
      }
    } catch (e) { console.warn(`end crystals skipped: ${e.message}`); return []; }
    return end.entities.filter((e) => e.type === "ender_crystal");
  }
  // A dry spot to stand on for respawns that find no entry: the End platform, or the first safe netherrack floor near the origin.
  spawn() {
    if (this.dimension === END) return { x: 100.5, y: 49.01, z: 0.5 };
    for (let r = 0; r < 64; r++) for (let x = -r; x <= r; x++) for (const z of [-r, r]) {
      for (let y = 40; y < 120; y++) if (this.get(x, y, z) === 0 && this.get(x, y + 1, z) === 0 && this.solid(x, y - 1, z) && this.get(x, y - 1, z) !== 11) return { x: x + 0.5, y: y + 0.01, z: z + 0.5 };
    }
    return { x: 0.5, y: 64, z: 0.5 };
  }
}

// Read-only terrain peek for the Teleporter before a world's window exists around the arrival point: column cache over
// generateTerrainChunk plus the world's saved edits (a Map "x,y,z" -> block | meta << 8), live writes recorded for replay.
export class TerrainPeek {
  constructor(world, edits = new Map(), { limit = 600 } = {}) {
    this.world = world; this.edits = edits; this.columns = new Map(); this.limit = limit; this.writes = [];
    this.dimension = world.dimension ?? 0; this.time = 0; this.seed = world.javaSeed ?? 0n;
    this.actualHeight = this.dimension === NETHER ? 128 : 256;
  }
  column(cx, cz) {
    const key = `${cx},${cz}`;
    let c = this.columns.get(key);
    if (!c) {
      c = this.stored?.column(cx, cz) ?? this.world.peekChunk?.(cx, cz) ?? this.world.generateTerrainChunk(cx, cz);
      if (this.columns.size >= this.limit) this.columns.delete(this.columns.keys().next().value);
      this.columns.set(key, c);
    }
    return c;
  }
  get(x, y, z) {
    if (y < 0 || y >= 256) return 0;
    const e = this.edits.get(`${x},${y},${z}`);
    if (e !== undefined) return e & 255;
    return this.column(x >> 4, z >> 4).blocks[((x & 15) * 16 + (z & 15)) * 256 + y];
  }
  set(x, y, z, id, meta = 0, flags = 3) {
    if (y < 0 || y >= 256) return;
    this.edits.set(`${x},${y},${z}`, id | meta << 8);
    this.writes.push([x, y, z, id, meta, flags]);
  }
  notify() {}
  // The columns in the box whose saved or written cells include block `id`, sorted by x then z (the Teleporter's search order).
  // Terrain never contains a portal block (neither the Nether/End generators nor the Overworld population place one), so every
  // portal this peek can see is one of its edits and the 257 x 257 column scan can skip the rest.
  portalColumns(id, x0, x1, z0, z1) {
    const seen = new Set(), out = [];
    for (const [key, value] of this.edits) {
      if ((value & 255) !== id) continue;
      const [x, , z] = key.split(',').map(Number), k = `${x},${z}`;
      if (x < x0 || x > x1 || z < z0 || z > z1 || seen.has(k)) continue;
      seen.add(k); out.push([x, z]);
    }
    // Imported stored columns (stored-peek.js StoredIndex, attached as `stored`) can hold a portal block too.
    if (this.stored?.marker === id) for (const [x, z] of this.stored.portalColumns(x0, x1, z0, z1)) { const k = `${x},${z}`; if (!seen.has(k)) { seen.add(k); out.push([x, z]); } }
    return out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }
}
