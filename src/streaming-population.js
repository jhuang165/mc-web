// Java population for streamed worlds (WORLD-02e, generation version 13).
//
// The streamed world regenerates a column from the seed whenever it returns to the working set and
// replays only the player's edits on top, so population has to be a pure function of the seed. It
// is computed per population cell: 8 x 8 columns aligned to the generator origin (local chunk
// coordinates, floor division, negatives included). One cell runs the same ported chain as a finite
// v11 area (PopulationArea: mineshaft start search, then ChunkProviderGenerate.populate with
// structures, lakes, dungeons, decorators, animals and snow in x-outer, z-inner order), plus a
// one-chunk margin on the -x/-z side so every kept column also receives the writes of the populate
// calls that overlap it. The +x/+z halo terrain is read lazily and its writes are discarded.
//
// Neighbouring cells are computed independently. A populate call on a shared border runs once in each
// cell with that cell's own earlier writes, so a feature straddling a border can differ in rare
// overlaps (a tree against a vein, say); native order dependence is replaced by a fixed per-cell
// order, never by exploration order. The result for a column does not depend on which columns were
// loaded earlier. Cells are cached (LRU) and rebuilt on demand.
//
// Chests, animals, spawners, mineshaft minecarts and generation-time liquid ticks are listed per
// column. A column hands its records to the live runtime once, the first time it is resident; the
// world remembers claimed columns (a bitmask per cell, saved with the record) so looted chests and
// killed animals are never refilled.
import { PopulationArea, populationBlockMapper } from './population-world.js';

export const CELL = 8;
const key = (x, z) => `${x},${z}`;
const stackRecord = (s, slot) => ({ slot, id: s[0], count: s[1], damage: s[2], ...(s[3]?.length ? { stored: s[3].map(([id, lvl]) => ({ id, lvl })) } : {}) });

// Insertion-ordered least-recently-used map.
class Lru {
  constructor(max) { this.max = max; this.map = new Map(); }
  get(k) {
    const v = this.map.get(k);
    if (v !== undefined) { this.map.delete(k); this.map.set(k, v); }
    return v;
  }
  set(k, v) {
    this.map.delete(k); this.map.set(k, v);
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value);
    return v;
  }
}

export class StreamingPopulation {
  // `terrain(x, z)`: original-ID chunk (blocks, metadata) after caves and ravines at native chunk
  // coordinates; `biomeAt(x, z)`: native block coordinates; `terrainOnly(lcx, lcz)`: the unpopulated
  // live column, used only if a cell cannot be generated.
  constructor({ seed, originX, originZ, terrain, biomeAt, terrainOnly, mapBlock = null, cells = 6, terrainChunks = 192 }) {
    this.seed = BigInt(seed);
    this.originChunkX = originX >> 4; this.originChunkZ = originZ >> 4;
    this.terrain = terrain; this.biomeAt = biomeAt; this.terrainOnly = terrainOnly; this.mapBlock = mapBlock;
    this.originals = new Lru(terrainChunks); this.cells = new Lru(cells);
    this.materialized = new Map();
    this.generated = 0;
  }
  original(x, z) {
    const k = key(x, z);
    return this.originals.get(k) ?? this.originals.set(k, this.terrain(x, z));
  }
  cell(cellX, cellZ) {
    const k = key(cellX, cellZ);
    const hit = this.cells.get(k);
    if (hit) return hit;
    let built;
    try { built = this.generate(cellX, cellZ); }
    catch (error) {
      // Generation is deterministic, so a cell that throws always falls back the same way. This is a
      // labelled approximation (terrain, caves and ravines only), never silent.
      console.error(`streaming-population: cell ${k} fell back to unpopulated terrain: ${error.message}`);
      built = this.fallback(cellX, cellZ, error);
    }
    this.generated++;
    return this.cells.set(k, built);
  }
  fallback(cellX, cellZ, error) {
    const columns = new Map();
    for (let a = 0; a < CELL; a++) for (let b = 0; b < CELL; b++) {
      const lcx = cellX * CELL + a, lcz = cellZ * CELL + b, t = this.terrainOnly(lcx, lcz);
      columns.set(key(lcx, lcz), { blocks: Uint8Array.from(t.blocks), metadata: Uint8Array.from(t.metadata) });
    }
    return { cellX, cellZ, columns, records: new Map(), mineshafts: [], populates: 0, failed: String(error?.message ?? error) };
  }
  generate(cellX, cellZ) {
    const mapBlock = this.mapBlock ?? populationBlockMapper();
    if (!mapBlock) throw new Error('original block mapper not ready');
    const baseX = this.originChunkX + cellX * CELL, baseZ = this.originChunkZ + cellZ * CELL;
    const pass = new PopulationArea({
      seed: this.seed, chunkX: baseX, chunkZ: baseZ, size: CELL, margin: 1,
      terrain: (x, z) => this.original(x, z), biomeAt: this.biomeAt,
    }).run();
    const w = pass.world;
    // (original id, metadata) -> live id << 4 | live metadata, resolved once per state.
    const table = new Int32Array(1 << 16).fill(-1);
    const lookup = (id, meta) => {
      const k = id << 4 | meta;
      let v = table[k];
      if (v < 0) {
        const m = mapBlock(id, meta);
        if (!m?.exact || m.id > 255) throw new Error(`unmapped original block ${id}:${meta}`);
        v = table[k] = m.id << 4 | m.meta;
      }
      return v;
    };
    if (lookup(0, 0) !== 0) throw new Error('air does not map to live air');
    const columns = new Map();
    for (let a = 0; a < CELL; a++) for (let b = 0; b < CELL; b++) {
      const c = w.chunk(baseX + a, baseZ + b), blocks = new Uint8Array(65536), metadata = new Uint8Array(65536);
      for (let s = 0; s < 16; s++) {
        const section = c.sections[s];
        if (!section) continue;
        for (let ly = 0; ly < 16; ly++) for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
          const j = ly << 8 | lz << 4 | lx, id = section.blocks[j];
          if (id === 0 && section.meta[j] === 0) continue;
          const v = lookup(id, section.meta[j]), i = (lx * 16 + lz) * 256 + s * 16 + ly;
          blocks[i] = v >> 4; metadata[i] = v & 15;
        }
      }
      columns.set(key(cellX * CELL + a, cellZ * CELL + b), { blocks, metadata });
    }
    // Records keep only what lies in this cell's columns, in world-local block coordinates.
    const ox = this.originChunkX * 16, oz = this.originChunkZ * 16, x0 = baseX * 16, z0 = baseZ * 16;
    const inside = (x, z) => x >= x0 && z >= z0 && x < x0 + CELL * 16 && z < z0 + CELL * 16;
    const records = new Map();
    const at = (x, z) => {
      const k = key(Math.floor((x - ox) / 16), Math.floor((z - oz) / 16));
      let r = records.get(k);
      if (!r) records.set(k, r = { chests: [], animals: [], spawners: [], minecartChests: [], pendingTicks: [] });
      return r;
    };
    for (const t of w.liveSpawners()) if (inside(t.x, t.z)) at(t.x, t.z).spawners.push({ x: t.x - ox, y: t.y, z: t.z - oz, entityId: t.name });
    for (const e of w.carts) {
      const x = Math.floor(e.x), z = Math.floor(e.z);
      if (inside(x, z)) at(x, z).minecartChests.push({ x: e.x - ox, y: e.y, z: e.z - oz, items: e.slots.flatMap((s, i) => (s ? [stackRecord(s, i)] : [])) });
    }
    for (const c of w.chunks.values()) for (const t of c.tiles.values()) {
      if (t.kind === 'chest' && inside(t.x, t.z)) at(t.x, t.z).chests.push({
        x: t.x - ox, y: t.y, z: t.z - oz, facing: w.getBlockMetadata(t.x, t.y, t.z),
        items: t.slots.flatMap((s, i) => (s ? [stackRecord(s, i)] : [])),
      });
    }
    for (const e of w.animals) {
      const x = Math.floor(e.x), z = Math.floor(e.z);
      if (inside(x, z)) at(x, z).animals.push({ ...e, x: e.x - ox, z: e.z - oz });
    }
    for (const [x, y, z, id, delay] of w.pending) if (inside(x, z)) at(x, z).pendingTicks.push({ x: x - ox, y, z: z - oz, id, delay });
    const local = (b) => [b.minX - ox, b.minY, b.minZ - oz, b.maxX - ox, b.maxY, b.maxZ - oz];
    const mineshafts = [...pass.mineshafts.structureMap.values()]
      .filter((s) => s.boundingBox.intersectsWithXZ(x0, z0, x0 + CELL * 16 - 1, z0 + CELL * 16 - 1))
      .map((s) => ({ chunkX: s.chunkX - this.originChunkX, chunkZ: s.chunkZ - this.originChunkZ, boundingBox: local(s.boundingBox) }));
    return { cellX, cellZ, columns, records, mineshafts, populates: pass.order.length, failed: null };
  }
  // A cell built elsewhere (the generation worker runs this same class) joins the cache unless the
  // cell was already built here; generation is a pure function of the seed, so either copy serves.
  hasCell(cellX, cellZ) { return this.cells.map.has(key(cellX, cellZ)); }
  adopt(cell) {
    const k = key(cell.cellX, cell.cellZ);
    if (this.cells.map.has(k)) return false;
    this.cells.set(k, cell);
    return true;
  }
  // Builds a cell for another thread: the result is not cached here, its arrays are handed over.
  export(cellX, cellZ) {
    const cell = this.cell(cellX, cellZ);
    this.cells.map.delete(key(cellX, cellZ));
    return cell;
  }
  // The live column (original blocks mapped to live ids) at local chunk coordinates.
  column(lcx, lcz) { return this.cell(lcx >> 3, lcz >> 3).columns.get(key(lcx, lcz)); }
  bit(lcx, lcz) { return 1n << BigInt((lcx & 7) * 8 + (lcz & 7)); }
  isMaterialized(lcx, lcz) { return ((this.materialized.get(key(lcx >> 3, lcz >> 3)) ?? 0n) & this.bit(lcx, lcz)) !== 0n; }
  // Marks each listed column claimed and returns the records of those not claimed before, as
  // [{ x, z, records }] in x-outer, z-inner order (columns with nothing to hand over are omitted).
  claim(columns) {
    const out = [];
    const ordered = [...columns].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    for (const [lcx, lcz] of ordered) {
      if (this.isMaterialized(lcx, lcz)) continue;
      const cell = this.cell(lcx >> 3, lcz >> 3), records = cell.records.get(key(lcx, lcz));
      const k = key(lcx >> 3, lcz >> 3);
      this.materialized.set(k, (this.materialized.get(k) ?? 0n) | this.bit(lcx, lcz));
      if (records) out.push({ x: lcx, z: lcz, records });
    }
    return out;
  }
  saveMaterialized() {
    return { version: 1, cells: Object.fromEntries([...this.materialized].map(([k, mask]) => [k, mask.toString(16)])) };
  }
  // Invalid entries are ignored: a column that is not recorded as claimed simply hands over again.
  restoreMaterialized(saved) {
    this.materialized = new Map();
    if (saved?.version !== 1 || !saved.cells || typeof saved.cells !== 'object') return this;
    for (const [k, hex] of Object.entries(saved.cells)) {
      if (!/^-?\d+,-?\d+$/.test(k) || typeof hex !== 'string' || !/^[0-9a-f]{1,16}$/.test(hex)) continue;
      this.materialized.set(k, BigInt(`0x${hex}`));
    }
    return this;
  }
}
