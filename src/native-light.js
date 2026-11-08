// The unchanged Minecraft Java 1.7.10 light engine, ported statement by statement from the bytecode of World (ahb) and Chunk (apx):
// World.updateLightByType (c(ahn,III)) with its 32768-entry queue (World.I) and 17-block distance cutoff, computeLightValue
// (a(IIIahn)), getSavedLightValue / setLightValue, checkChunksExist / doChunksNearChunkExist, updateAllLightTypes (func_147451_t),
// and Chunk.generateSkylightMap (b()), relightBlock (h), propagateSkylightOcclusion (e), recheckGaps (c(Z)),
// checkSkylightNeighborHeight (g), updateSkylightNeighborHeight (c(IIII)), the light half of func_150807_a (setBlockIDWithMetadata),
// func_150804_b (the per-tick chunk work), func_150809_p (light population), func_150801_a, func_150811_f, enqueueRelightChecks (o()),
// resetRelightChecks (n()) and populateChunk with ChunkProviderServer.populate (ms.a(apu,II)) for the neighbour ordering.
// Evidence: public/research/light-engine.md, light-engine-reference.json (LightEngineProbe) and light-engine2-reference.json
// (LightEngine2Probe), both replayed exactly by src/native-light.test.js.
//
// Storage: a square of `width` x `width` blocks (a whole number of chunks) in local coordinates 0..width-1, the same layout as
// LightVolume: cell (x, y, z) at (x * width + z) * height + y, heightMap at x * width + z. Chunks outside the square or not marked
// loaded behave like unloaded chunks (reads give the EnumSkyBlock default, writes are dropped, updates near them are skipped).
// Per chunk: the ExtendedBlockStorage sections that exist (a bit mask: a missing section reads as 15 sky at or above the heightMap and
// 0 otherwise, and writing light into it creates it and runs generateSkylightMap), heightMapMinimum, updateSkylightColumns and
// isGapLightingUpdated, isTerrainPopulated, isLightPopulated and queuedLightChecks.
export const SKY = 0, BLOCK = 1, QUEUE_LENGTH = 32768;
const ORIGIN = 133152, MAX_INT = 2147483647; // 32 | 32 << 6 | 32 << 12: the queued cell is the update's own position
// Facing offsets (q.b, q.c, q.d): down, up, north, south, west, east.
const FX = [0, 0, 0, 0, -1, 1], FY = [-1, 1, 0, 0, 0, 0], FZ = [0, 0, -1, 1, 0, 0];

export class NativeLight {
  // blockAt(x, y, z): the block id of a loaded cell; opacity(id): Block.getLightOpacity; emission(x, y, z, id): Block.getLightValue.
  constructor({ width, height = 256, hasNoSky = false, sky = null, block = null, heights = null, blockAt, opacity, emission, isRemote = false, queueLength = QUEUE_LENGTH, reach = 17 }) {
    this.W = width; this.H = height; this.n = width >> 4; this.sections = height >> 4;
    this.hasNoSky = !!hasNoSky; this.isRemote = isRemote;
    this.sky = sky ?? new Uint8Array(width * width * height);
    this.block = block ?? new Uint8Array(width * width * height);
    this.heights = heights ?? new Uint16Array(width * width);
    this.blockAt = blockAt; this.opacity = opacity; this.emission = emission;
    const n2 = this.n * this.n;
    this.loaded = new Uint8Array(n2);
    this.mask = new Int32Array(n2);
    this.hmMin = new Int32Array(n2).fill(MAX_INT);
    this.gaps = new Uint8Array(n2 * 256);
    this.gapFlag = new Uint8Array(n2);
    this.terrainPopulated = new Uint8Array(n2);
    this.lightPopulated = new Uint8Array(n2);
    this.queued = new Int32Array(n2).fill(4096); // Chunk(World, int, int): queuedLightChecks = 4096
    this.queue = new Int32Array(queueLength); // World.lightUpdateBlockList: new int[32768] in both World constructors
    this.reach = reach; // the 17-block cutoff (a test hook: research tools compare against a longer reach)
    this.dirty = null;
    this.stats = { updates: 0, overflow: 0, peak: 0 };
  }

  // --- bookkeeping (not native) ---
  // The box of cells whose readable light changed since the last call, or null.
  takeDirty() { const d = this.dirty; this.dirty = null; return d; }
  mark(x0, y0, z0, x1 = x0, y1 = y0, z1 = z0) {
    const d = this.dirty;
    if (!d) this.dirty = { x0, x1, y0, y1, z0, z1 };
    else {
      if (x0 < d.x0) d.x0 = x0; if (x1 > d.x1) d.x1 = x1;
      if (y0 < d.y0) d.y0 = y0; if (y1 > d.y1) d.y1 = y1;
      if (z0 < d.z0) d.z0 = z0; if (z1 > d.z1) d.z1 = z1;
    }
  }
  chunkIndex(cx, cz) { return cx < 0 || cz < 0 || cx >= this.n || cz >= this.n || !this.loaded[cx * this.n + cz] ? -1 : cx * this.n + cz; }
  chunkAt(x, z) { return this.chunkIndex(x >> 4, z >> 4); }
  hasSection(c, s) { return ((this.mask[c] >> s) & 1) !== 0; }

  // --- World ---
  // World.getBlock: air outside 0..255 and in unloaded chunks.
  getBlock(x, y, z) { return y < 0 || y >= this.H || this.chunkAt(x, z) < 0 ? 0 : this.blockAt(x, y, z); }
  op(x, y, z) { return this.opacity(this.blockAt(x, y, z)); } // Chunk.func_150808_b (loaded chunk, y in range)
  lightValue(x, y, z) { const b = this.getBlock(x, y, z); return b ? this.emission(x, y, z, b) : 0; }
  // World.getSavedLightValue: y clamped to 0..255; an unloaded chunk gives EnumSkyBlock.defaultLightValue (sky 15, block 0).
  saved(type, x, y, z) {
    if (y < 0) y = 0;
    if (y >= this.H) y = this.H - 1;
    const c = this.chunkAt(x, z);
    return c < 0 ? (type === SKY ? 15 : 0) : this.chunkSaved(c, type, x, y, z);
  }
  // Chunk.getSavedLightValue. The arrays always hold what it returns: a missing section's cells mirror its rule (syncColumn) and an
  // existing section's sky stays 0 without sky (writes are skipped and createSection zero-fills).
  chunkSaved(c, type, x, y, z) { return (type === SKY ? this.sky : this.block)[(x * this.W + z) * this.H + y]; }
  // A missing section reads sky 15 at or above the column's heightMap (canBlockSeeTheSky) and 0 below; block light 0.
  syncColumn(c, x, z) {
    const h = this.heights[x * this.W + z], base = (x * this.W + z) * this.H;
    for (let s = 0; s < this.sections; s++) {
      if (this.hasSection(c, s)) continue;
      const y0 = s << 4, y1 = y0 + 16, cut = Math.min(y1, Math.max(y0, h));
      this.sky.fill(0, base + y0, base + cut); this.sky.fill(15, base + cut, base + y1);
      this.block.fill(0, base + y0, base + y1);
    }
  }
  // World.setLightValue: dropped outside 0..255 and in unloaded chunks.
  setLight(type, x, y, z, v) {
    if (y < 0 || y >= this.H) return;
    const c = this.chunkAt(x, z);
    if (c >= 0) this.chunkSetLight(c, type, x, y, z, v);
  }
  // Chunk.setLightValue: a missing section is created (new ExtendedBlockStorage: zero light) and generateSkylightMap runs.
  chunkSetLight(c, type, x, y, z, v) {
    if (!this.hasSection(c, y >> 4)) { this.createSection(c, y >> 4); this.generateSkylightMap(c); }
    if (type === SKY && this.hasNoSky) return;
    const arr = type === SKY ? this.sky : this.block, i = (x * this.W + z) * this.H + y;
    if (arr[i] !== v) { arr[i] = v; this.mark(x, y, z); }
  }
  setSectionSky(c, x, y, z, v) { // ExtendedBlockStorage.setExtSkylightValue where the section exists
    if (!this.hasSection(c, y >> 4)) return;
    const i = (x * this.W + z) * this.H + y;
    if (this.sky[i] !== v) { this.sky[i] = v; this.mark(x, y, z); }
  }
  createSection(c, s) {
    this.mask[c] |= 1 << s;
    const X0 = ((c / this.n) | 0) << 4, Z0 = (c % this.n) << 4, y0 = s << 4;
    for (let x = X0; x < X0 + 16; x++) for (let z = Z0; z < Z0 + 16; z++) {
      const base = (x * this.W + z) * this.H + y0;
      this.sky.fill(0, base, base + 16); this.block.fill(0, base, base + 16);
    }
    this.mark(X0, y0, Z0, X0 + 15, y0 + 15, Z0 + 15); // reads switch from the missing-section values to the stored ones
  }
  canSeeSky(x, y, z) { const c = this.chunkAt(x, z); return c >= 0 && y >= this.heights[x * this.W + z]; } // EmptyChunk: false
  heightValue(x, z) { return this.chunkAt(x, z) < 0 ? 0 : this.heights[x * this.W + z]; } // World.getHeightValue
  heightMapMinimum(x, z) { const c = this.chunkAt(x, z); return c < 0 ? 0 : this.hmMin[c]; } // World.getChunkHeightMapMinimum
  // World.checkChunksExist.
  chunksExist(x0, y0, z0, x1, y1, z1) {
    if (y1 < 0 || y0 >= 256) return false;
    for (let cx = x0 >> 4; cx <= x1 >> 4; cx++) for (let cz = z0 >> 4; cz <= z1 >> 4; cz++) if (this.chunkIndex(cx, cz) < 0) return false;
    return true;
  }
  near(x, y, z, r) { return this.chunksExist(x - r, y - r, z - r, x + r, y + r, z + r); } // World.doChunksNearChunkExist
  // World.computeLightValue.
  computeLight(x, y, z, type) {
    if (type === SKY && this.canSeeSky(x, y, z)) return 15;
    const b = this.getBlock(x, y, z), lv = b ? this.emission(x, y, z, b) : 0;
    let e = type === SKY ? 0 : lv, o = this.opacity(b);
    if (o >= 15 && lv > 0) o = 1;
    if (o < 1) o = 1;
    if (o >= 15) return 0;
    if (e >= 14) return e;
    for (let f = 0; f < 6; f++) {
      const l = this.saved(type, x + FX[f], y + FY[f], z + FZ[f]) - o;
      if (l > e) e = l;
      if (e >= 14) return e;
    }
    return e;
  }
  // World.updateLightByType: a removal pass over cells holding the old value (up to QUEUE_LENGTH entries), then an addition pass
  // from every queued cell; spreading stops 17 blocks (|dx| + |dy| + |dz|) from (x, y, z) and when fewer than 6 entries are free.
  updateLightByType(type, x, y, z) {
    if (!this.near(x, y, z, 17)) return false;
    const q = this.queue, L = q.length;
    let i = 0, j = 0;
    this.stats.updates++;
    const old = this.saved(type, x, y, z), now = this.computeLight(x, y, z, type);
    if (now > old) q[j++] = ORIGIN;
    else if (now < old) {
      q[j++] = ORIGIN | (old << 18);
      while (i < j) {
        const e = q[i++], cx = (e & 63) - 32 + x, cy = ((e >> 6) & 63) - 32 + y, cz = ((e >> 12) & 63) - 32 + z, level = (e >> 18) & 15;
        if (this.saved(type, cx, cy, cz) !== level) continue;
        this.setLight(type, cx, cy, cz, 0);
        if (level <= 0) continue;
        if (Math.abs(cx - x) + Math.abs(cy - y) + Math.abs(cz - z) >= this.reach) continue;
        for (let f = 0; f < 6; f++) {
          const nx = cx + FX[f], ny = cy + FY[f], nz = cz + FZ[f], o = Math.max(1, this.opacity(this.getBlock(nx, ny, nz)));
          if (this.saved(type, nx, ny, nz) === level - o) {
            if (j < L) q[j++] = (nx - x + 32) | ((ny - y + 32) << 6) | ((nz - z + 32) << 12) | ((level - o) << 18);
            else this.stats.overflow++;
          }
        }
      }
      i = 0;
    }
    while (i < j) {
      const e = q[i++], cx = (e & 63) - 32 + x, cy = ((e >> 6) & 63) - 32 + y, cz = ((e >> 12) & 63) - 32 + z;
      const was = this.saved(type, cx, cy, cz), v = this.computeLight(cx, cy, cz, type);
      if (v === was) continue;
      this.setLight(type, cx, cy, cz, v);
      if (v <= was) continue;
      const room = j < L - 6;
      if (!room) this.stats.overflow++;
      if (Math.abs(cx - x) + Math.abs(cy - y) + Math.abs(cz - z) >= this.reach || !room) continue;
      const p = (cx - x + 32) + ((cy - y + 32) << 6) + ((cz - z + 32) << 12); // neighbours x - 1, x + 1, y - 1, y + 1, z - 1, z + 1
      if (this.saved(type, cx - 1, cy, cz) < v) q[j++] = p - 1;
      if (this.saved(type, cx + 1, cy, cz) < v) q[j++] = p + 1;
      if (this.saved(type, cx, cy - 1, cz) < v) q[j++] = p - 64;
      if (this.saved(type, cx, cy + 1, cz) < v) q[j++] = p + 64;
      if (this.saved(type, cx, cy, cz - 1) < v) q[j++] = p - 4096;
      if (this.saved(type, cx, cy, cz + 1) < v) q[j++] = p + 4096;
    }
    if (j > this.stats.peak) this.stats.peak = j;
    return true;
  }
  // World.func_147451_t (updateAllLightTypes).
  updateAll(x, y, z) {
    let r = false;
    if (!this.hasNoSky) r = this.updateLightByType(SKY, x, y, z) || r;
    return this.updateLightByType(BLOCK, x, y, z) || r;
  }
  // World.setBlock's light part: Chunk.func_150807_a then updateAllLightTypes (run whether or not the chunk changed). Call it after
  // the cell holds `newId`; `oldOpacity` is the replaced block's getLightOpacity and `same` whether block and metadata were unchanged.
  // Returns func_150807_a's result.
  setBlock(x, y, z, oldOpacity, newId, same = false) {
    if (y < 0 || y >= this.H) return false;
    const c = this.chunkAt(x, z);
    if (c < 0) return false;
    const changed = this.chunkSetBlock(c, x, y, z, oldOpacity, newId, same);
    this.updateAll(x, y, z);
    return changed;
  }
  chunkSetBlock(c, x, y, z, oldOpacity, newId, same) {
    const j1 = this.heights[x * this.W + z];
    if (same) return false;
    let regenerate = false;
    if (!this.hasSection(c, y >> 4)) {
      if (newId === 0) return false;
      this.createSection(c, y >> 4);
      regenerate = y >= j1;
    }
    if (regenerate) this.generateSkylightMap(c);
    else {
      const j2 = this.opacity(newId), k2 = oldOpacity;
      if (j2 > 0) { if (y >= j1) this.relightBlock(c, x, y + 1, z); }
      else if (y === j1 - 1) this.relightBlock(c, x, y, z);
      if (j2 !== k2 && (j2 < k2 || this.chunkSaved(c, SKY, x, y, z) > 0 || this.chunkSaved(c, BLOCK, x, y, z) > 0)) this.propagateSkylightOcclusion(c, x & 15, z & 15);
    }
    return true;
  }

  // --- Chunk ---
  origin(c) { return [((c / this.n) | 0) << 4, (c % this.n) << 4]; }
  topFilledSegment(c) { for (let s = this.sections - 1; s >= 0; s--) if (this.hasSection(c, s)) return s << 4; return 0; }
  // Chunk.generateSkylightMap: heightMap, then sky light straight down each column (15 above the first block with opacity, minus
  // max(1, opacity) per cell below it) into the sections that exist, stopping at 0; y 0 and the cells below are not written.
  generateSkylightMap(c) {
    const top = this.topFilledSegment(c), [X0, Z0] = this.origin(c);
    this.hmMin[c] = MAX_INT;
    for (let x = X0; x < X0 + 16; x++) for (let z = Z0; z < Z0 + 16; z++) {
      const hi = x * this.W + z;
      for (let l = top + 15; l > 0; l--) if (this.op(x, l - 1, z) !== 0) { if (this.heights[hi] !== l) { this.heights[hi] = l; this.syncColumn(c, x, z); this.mark(x, 0, z, x, this.H - 1, z); } if (l < this.hmMin[c]) this.hmMin[c] = l; break; }
      if (this.hasNoSky) continue;
      let l = 15, y = top + 15;
      do {
        let o = this.op(x, y, z);
        if (o === 0 && l !== 15) o = 1;
        l -= o;
        if (l > 0) this.setSectionSky(c, x, y, z, l);
        y--;
      } while (y > 0 && l > 0);
    }
  }
  // Chunk.relightBlock(x, y, z): moves the column's heightMap down to y or below, rewrites the sky light it uncovered or covered and
  // relights the column and its four neighbours over the changed height range.
  relightBlock(c, x, y, z) {
    const hi = x * this.W + z, old = this.heights[hi] & 255;
    let h = old;
    if (y > old) h = y;
    while (h > 0 && this.op(x, h - 1, z) === 0) h--;
    if (h === old) return;
    this.heights[hi] = h;
    this.syncColumn(c, x, z);
    this.mark(x, 0, z, x, this.H - 1, z);
    if (!this.hasNoSky) {
      if (h < old) for (let yy = h; yy < old; yy++) this.setSectionSky(c, x, yy, z, 15);
      else for (let yy = old; yy < h; yy++) this.setSectionSky(c, x, yy, z, 0);
      let l = 15;
      while (h > 0 && l > 0) {
        h--;
        let o = this.op(x, h, z);
        if (o === 0) o = 1;
        l -= o;
        if (l < 0) l = 0;
        this.setSectionSky(c, x, h, z, l);
      }
    }
    const now = this.heights[hi];
    let lo = old, top = now;
    if (top < lo) { const t = lo; lo = top; top = t; }
    if (now < this.hmMin[c]) this.hmMin[c] = now;
    if (!this.hasNoSky) {
      this.updateSkylightNeighborHeight(x - 1, z, lo, top);
      this.updateSkylightNeighborHeight(x + 1, z, lo, top);
      this.updateSkylightNeighborHeight(x, z - 1, lo, top);
      this.updateSkylightNeighborHeight(x, z + 1, lo, top);
      this.updateSkylightNeighborHeight(x, z, lo, top);
    }
  }
  propagateSkylightOcclusion(c, lx, lz) { this.gaps[c * 256 + lx + lz * 16] = 1; this.gapFlag[c] = 1; }
  updateSkylightNeighborHeight(x, z, y0, y1) {
    if (y1 > y0 && this.near(x, 0, z, 16)) for (let y = y0; y < y1; y++) this.updateLightByType(SKY, x, y, z);
  }
  checkSkylightNeighborHeight(x, z, h) {
    const l = this.heightValue(x, z);
    if (l > h) this.updateSkylightNeighborHeight(x, z, h, l + 1);
    else if (l < h) this.updateSkylightNeighborHeight(x, z, l, h + 1);
  }
  // Chunk.recheckGaps: each flagged column against its neighbours' heights; with isRemote only the first flagged column.
  recheckGaps(c, remote = this.isRemote) {
    const [X0, Z0] = this.origin(c);
    if (!this.near(X0 + 8, 0, Z0 + 8, 16)) return;
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
      const g = c * 256 + i + j * 16;
      if (!this.gaps[g]) continue;
      this.gaps[g] = 0;
      const x = X0 + i, z = Z0 + j, k = this.heights[x * this.W + z];
      let m = this.heightMapMinimum(x - 1, z);
      const a = this.heightMapMinimum(x + 1, z), b = this.heightMapMinimum(x, z - 1), d = this.heightMapMinimum(x, z + 1);
      if (a < m) m = a;
      if (b < m) m = b;
      if (d < m) m = d;
      this.checkSkylightNeighborHeight(x, z, m);
      this.checkSkylightNeighborHeight(x - 1, z, k);
      this.checkSkylightNeighborHeight(x + 1, z, k);
      this.checkSkylightNeighborHeight(x, z - 1, k);
      this.checkSkylightNeighborHeight(x, z + 1, k);
      if (remote) return;
    }
    this.gapFlag[c] = 0;
  }
  // Chunk.func_150804_b: WorldServer.func_147456_g runs it (argument false) on every active chunk each tick.
  tickChunk(c, skipGaps = false) {
    if (this.gapFlag[c] && !this.hasNoSky && !skipGaps) this.recheckGaps(c, this.isRemote);
    if (!this.lightPopulated[c] && this.terrainPopulated[c]) this.populateLight(c);
  }
  // Chunk.func_150809_p: needs the chunks holding x0 - 1 and z0 - 1; every column through func_150811_f, then the facing edge column
  // of the west, east, north and south neighbours (in that order) when they are terrain-populated.
  populateLight(c) {
    this.terrainPopulated[c] = 1;
    this.lightPopulated[c] = 1;
    if (this.hasNoSky) return;
    const [X0, Z0] = this.origin(c);
    if (!this.chunksExist(X0 - 1, 0, Z0 - 1, X0 + 1, 63, Z0 + 1)) { this.lightPopulated[c] = 0; return; }
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) if (!this.columnRelight(c, i, j)) { this.lightPopulated[c] = 0; break; }
    if (!this.lightPopulated[c]) return;
    this.edgeRelight(this.chunkAt(X0 - 1, Z0), 3);
    this.edgeRelight(this.chunkAt(X0 + 16, Z0), 1);
    this.edgeRelight(this.chunkAt(X0, Z0 - 1), 0);
    this.edgeRelight(this.chunkAt(X0, Z0 + 16), 2);
  }
  // Chunk.func_150801_a (an unloaded neighbour is the EmptyChunk, which is never terrain-populated).
  edgeRelight(c, side) {
    if (c < 0 || !this.terrainPopulated[c]) return;
    for (let j = 0; j < 16; j++) {
      if (side === 3) this.columnRelight(c, 15, j);
      else if (side === 1) this.columnRelight(c, 0, j);
      else if (side === 0) this.columnRelight(c, j, 15);
      else if (side === 2) this.columnRelight(c, j, 0);
    }
  }
  // Chunk.func_150811_f: from the top section down, every transparent cell below the first block with opacity (to y 63, then on to
  // the first opacity-255 block below 63) gets updateAllLightTypes; below that only emitters do. False when an update was skipped.
  columnRelight(c, lx, lz) {
    const top = this.topFilledSegment(c), [X0, Z0] = this.origin(c), x = X0 + lx, z = Z0 + lz;
    let found = false, deep = false, y;
    for (y = top + 15; y > 63 || (y > 0 && !deep); y--) {
      const o = this.op(x, y, z);
      if (o === 255 && y < 63) deep = true;
      if (!found && o > 0) found = true;
      else if (found && o === 0 && !this.updateAll(x, y, z)) return false;
    }
    for (; y > 0; y--) if (this.lightValue(x, y, z) > 0) this.updateAll(x, y, z);
    return true;
  }
  resetRelightChecks(c) { this.queued[c] = 0; } // Chunk.n()
  // Chunk.enqueueRelightChecks (o()), from World.func_147467_a for each active chunk every tick: 8 of the 4096 (section, column) slots.
  enqueueRelightChecks(c) {
    const [X0, Z0] = this.origin(c);
    for (let k = 0; k < 8; k++) {
      if (this.queued[c] >= 4096) return;
      const q = this.queued[c], s = q % 16, lx = ((q / 16) | 0) % 16, lz = (q / 256) | 0;
      this.queued[c]++;
      const x = X0 + lx, z = Z0 + lz;
      for (let t = 0; t < 16; t++) {
        const y = (s << 4) + t;
        if (y >= this.H) break;
        const present = this.hasSection(c, s);
        if (present ? this.blockAt(x, y, z) !== 0 : !(t === 0 || t === 15 || lx === 0 || lx === 15 || lz === 0 || lz === 15)) continue;
        if (this.lightValue(x, y - 1, z) > 0) this.updateAll(x, y - 1, z);
        if (this.lightValue(x, y + 1, z) > 0) this.updateAll(x, y + 1, z);
        if (this.lightValue(x - 1, y, z) > 0) this.updateAll(x - 1, y, z);
        if (this.lightValue(x + 1, y, z) > 0) this.updateAll(x + 1, y, z);
        if (this.lightValue(x, y, z - 1) > 0) this.updateAll(x, y, z - 1);
        if (this.lightValue(x, y, z + 1) > 0) this.updateAll(x, y, z + 1);
        this.updateAll(x, y, z);
      }
    }
  }

  // --- chunk loading (server) ---
  // A freshly generated chunk: the Chunk(World, Block[], byte[], x, z) sections (those holding a non-air block) and
  // ChunkProviderGenerate.provideChunk's generateSkylightMap. The caller has put the blocks in place.
  generateChunk(cx, cz) {
    const c = cx * this.n + cz, X0 = cx << 4, Z0 = cz << 4;
    this.loaded[c] = 1;
    let m = 0;
    for (let x = X0; x < X0 + 16; x++) for (let z = Z0; z < Z0 + 16; z++)
      for (let y = 0; y < this.H; y++) if (!((m >> (y >> 4)) & 1) && this.blockAt(x, y, z) !== 0) m |= 1 << (y >> 4);
    this.mask[c] = 0;
    for (let x = X0; x < X0 + 16; x++) for (let z = Z0; z < Z0 + 16; z++) { this.heights[x * this.W + z] = 0; this.syncColumn(c, x, z); }
    for (let s = 0; s < this.sections; s++) if ((m >> s) & 1) this.createSection(c, s);
    this.generateSkylightMap(c);
    return c;
  }
  // Chunk.populateChunk(provider, provider, x, z) after a load: populates this chunk and its west, north and north-west neighbours
  // once the three chunks each one's population covers are loaded. `decorate(cx, cz)` stands for the generator's populate.
  populateChunk(cx, cz, decorate = null) {
    const has = (a, b) => this.chunkIndex(a, b) >= 0, populated = (a, b) => this.terrainPopulated[this.chunkIndex(a, b)] !== 0;
    if (!populated(cx, cz) && has(cx + 1, cz + 1) && has(cx, cz + 1) && has(cx + 1, cz)) this.populate(cx, cz, decorate);
    if (has(cx - 1, cz) && !populated(cx - 1, cz) && has(cx - 1, cz + 1) && has(cx, cz + 1) && has(cx - 1, cz + 1)) this.populate(cx - 1, cz, decorate);
    if (has(cx, cz - 1) && !populated(cx, cz - 1) && has(cx + 1, cz - 1) && has(cx + 1, cz - 1) && has(cx + 1, cz)) this.populate(cx, cz - 1, decorate);
    if (has(cx - 1, cz - 1) && !populated(cx - 1, cz - 1) && has(cx, cz - 1) && has(cx - 1, cz)) this.populate(cx - 1, cz - 1, decorate);
  }
  // ChunkProviderServer.populate: func_150809_p first, then the generator's decoration.
  populate(cx, cz, decorate) {
    const c = this.chunkIndex(cx, cz);
    if (this.terrainPopulated[c]) return;
    this.populateLight(c);
    decorate?.(cx, cz);
  }
}
