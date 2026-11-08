// A bounded lighting volume over the resident chunk square. Coordinates exposed
// to gameplay stay absolute, including negative x/z. The existing fixed-point
// light solver is reused without changing legacy worlds' light arrays.
import { LightVolume, lightOpacity } from './lighting.js';
import { NativeLight } from './native-light.js';
import { SIZE } from './world.js';

// Native 1.7.10 incremental light for the Overworld (NativeLight, src/native-light.js), on by default after the batch-26 measurements
// (public/research/light-engine.md). Off: the fixed-point
// LightVolume path of batches 20-25. On: the eager build still produces the first sky/block arrays, then edits, per-tick gap rechecks
// and window shifts follow World.updateLightByType / Chunk.func_150804_b (17-block reach, queue bound, unloaded-edge skip).
// Override per page with `?nativeLight=1` / `?nativeLight=0` or localStorage 'blockworld.nativeLight' ('1' / '0').
export const NATIVE_LIGHT_DEFAULT = true;
export function nativeLightEnabled() {
  try {
    const q = new URLSearchParams(globalThis.location?.search ?? '').get('nativeLight') ?? globalThis.localStorage?.getItem('blockworld.nativeLight');
    if (q === '1' || q === 'true') return true;
    if (q === '0' || q === 'false') return false;
  } catch {}
  return NATIVE_LIGHT_DEFAULT;
}
const N = SIZE >> 4, OPACITY = new Uint8Array(256);
for (let b = 0; b < 256; b++) OPACITY[b] = Math.min(255, lightOpacity(b));

const drain = (g) => { for (let r = g.next(); !r.done; r = g.next()); };

// WorldProvider.hasNoSky (aqo.g: Nether and End; `world.hasNoSky`, dimensions.js) for the light engine. Only `?nativeLight=0`, the pre-native
// fallback volume, keeps the End sky-lit as it always was.
const noSkyFor = (world, native) => !!world.hasNoSky && (native || !world.isEnd);
const merge = (a, b) => (!a ? b : !b ? a : { x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1), z0: Math.min(a.z0, b.z0), z1: Math.max(a.z1, b.z1) });

export class StreamingLight {
  constructor(world, emission, { defer = false, native = false } = {}) {
    this.world = world;
    this.native = null; this.useNative = !!native;
    this.noSky = noSkyFor(world, this.useNative);
    this.emission = emission;
    this.x = world.minX; this.z = world.minZ;
    this.pend = new Set(); this.changes = new Map(); // changes the light has not processed yet / distinct changed cells per chunk this tick
    this.resends = 0;
    if (world.blockTap !== undefined) world.blockTap = null; // a rebuilt volume replaces the previous one's tap
    this.inner = new LightVolume({ height: world.height, hasNoSky: this.noSky, get: (x,y,z) => world.get(x+this.x,y,z+this.z),
      columnBlocks: (x,z) => world.columnBlocks(x+this.x,z+this.z) },
      emission && ((x,y,z,b) => emission(x+this.x,y,z+this.z,b)), { defer });
    if (!defer && this.useNative) drain(this.nativeSteps());
  }
  // The deferred build's slices (LightVolume.buildSteps); nothing is readable as light until it has run to its end.
  buildSteps() { return this.useNative ? this.nativeBuildSteps() : this.inner.buildSteps(); }
  *nativeBuildSteps() { yield* this.inner.buildSteps(); yield* this.nativeSteps(); }
  // Native state on top of the eager arrays (shared, not copied). Per chunk: the sections holding a non-air block (a missing section reads
  // 0 below the heightMap and 15 above it, so the arrays are rewritten to that rule), heightMapMinimum, no pending gaps, light populated
  // and no relight checks left. `ids` shadows the block ids so an edit knows the replaced block's opacity. The outermost ring of chunks
  // counts as unloaded: an edit within 17 blocks of it is skipped, and it reads the unloaded defaults (sky 15, block 0).
  *nativeSteps() {
    const v = this.inner, H = v.height, world = this.world;
    this.ids = new Uint8Array(SIZE * SIZE * H);
    // Without sky the native heightMap still holds the real top (Chunk.generateSkylightMap), so it gets its own array: the fixed-point volume
    // keeps 256 there (no cell may see the sky).
    this.native = new NativeLight({ width: SIZE, height: H, hasNoSky: this.noSky, sky: v.sky, block: v.block, heights: this.noSky ? new Uint16Array(SIZE * SIZE) : v.heights,
      blockAt: (x, y, z) => this.ids[(x * SIZE + z) * H + y], opacity: (b) => OPACITY[b], emission: (x, y, z, b) => v.emission(x, y, z, b), replaySkipped: true });
    for (let cx = 0; cx < N; cx++) { for (let cz = 0; cz < N; cz++) this.nativeChunk(cx * N + cz); yield; }
    this.nativeLoaded();
    if (world.blockTap !== undefined) world.blockTap = (x, y, z, b) => this.tap(x, y, z, b);
  }
  nativeLoaded() { const n = this.native; for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) n.loaded[a * N + b] = a > 0 && b > 0 && a < N - 1 && b < N - 1 ? 1 : 0; }
  // Fresh per-chunk state from the world: copies the ids, then mask, hmMin and the missing-section light rule.
  nativeChunk(c) {
    const n = this.native, H = n.H, X0 = ((c / N) | 0) << 4, Z0 = (c % N) << 4, w = this.world;
    let mask = 0, hm = 2147483647;
    for (let x = X0; x < X0 + 16; x++) for (let z = Z0; z < Z0 + 16; z++) {
      const col = w.columnBlocks(x + this.x, z + this.z), base = (x * SIZE + z) * H;
      if (!col) { this.ids.fill(0, base, base + H); continue; }
      this.ids.set(col, base);
      if (this.noSky) { let hh = 0; for (let y = H - 1; y >= 0; y--) if (OPACITY[col[y]]) { hh = y + 1; break; } n.heights[x * SIZE + z] = hh; }
      for (let s = 0; s < n.sections; s++) if (!((mask >> s) & 1)) for (let y = s << 4, e = y + 16; y < e; y++) if (col[y]) { mask |= 1 << s; break; }
      const h = n.heights[x * SIZE + z];
      if (h > 0 && h < hm) hm = h;
    }
    n.mask[c] = mask; n.hmMin[c] = hm;
    n.gapFlag[c] = 0; n.gaps.fill(0, c * 256, c * 256 + 256);
    n.terrainPopulated[c] = 1; n.lightPopulated[c] = 1; n.queued[c] = 4096;
    for (let x = X0; x < X0 + 16; x++) for (let z = Z0; z < Z0 + 16; z++) n.syncColumn(c, x, z);
  }
  // Absolute edit: `oldId` is the replaced block (the shadow's when omitted). Runs World.setBlock's light part and returns the box of
  // changed light (absolute x/z) or null.
  edit(x, y, z, oldId) {
    const n = this.native, lx = x - this.x, lz = z - this.z;
    if (lx < 0 || lz < 0 || lx >= SIZE || lz >= SIZE || y < 0 || y >= n.H) return null;
    const i = (lx * SIZE + lz) * n.H + y, id = this.world.get(x, y, z), was = oldId ?? this.ids[i];
    this.ids[i] = id;
    this.pend.delete(i);
    n.takeDirty();
    if (n.chunkAt(lx, lz) < 0) n.defer(lx, y, lz, OPACITY[was], id); // an outer chunk of the square: its light work waits until it is resident
    else n.setBlock(lx, y, lz, OPACITY[was], id, was === id);
    return this.box(n.takeDirty());
  }
  // World.put's tap (World.blockTap): the block changed. The shadow keeps the id the light last saw, so a change nobody reports with
  // update() is relit at the next tick with the right old opacity (flush). A chunk with 64 changed cells in one tick is what
  // PlayerInstance.sendChunkUpdate answers with a whole-chunk packet (see tick()).
  tap(x, y, z, b) {
    const lx = x - this.x, lz = z - this.z;
    if (lx < 0 || lz < 0 || lx >= SIZE || lz >= SIZE || y < 0) return;
    const H = this.world.height, i = (lx * SIZE + lz) * H + y, c = (lx >> 4) * N + (lz >> 4);
    let set = this.changes.get(c);
    if (!set) this.changes.set(c, set = new Set());
    set.add(i);
    if (this.ids[i] !== b) this.pend.add(i);
  }
  // Relights the changes the light has not seen (a world.set without updateBlock). Returns the box of changed light or null.
  flush() {
    if (!this.pend.size) return null;
    const H = this.world.height, list = [...this.pend];
    this.pend.clear();
    let box = null;
    for (const i of list) {
      const y = i % H, t = (i - y) / H, lz = t % SIZE, lx = (t - lz) / SIZE, x = lx + this.x, z = lz + this.z;
      if (!this.world.isLoaded(x, z)) continue;
      box = merge(merge(box, this.edit(x, y, z)), { x0: x, x1: x, y0: y, y1: y, z0: z, z1: z });
    }
    return box;
  }
  // Chunk.func_150804_b for every loaded chunk (once per game tick): recheckGaps for flagged columns. Returns the changed box or null.
  // Before the chunk work: the changes nobody reported (flush), and the client side of PlayerInstance.sendChunkUpdate: a chunk with 64
  // distinct changed cells in the tick is resent whole, NetHandlerPlayClient resets its relight checks (Chunk.n()) and Chunk.o() then
  // works through the 4096 (section, column) slots, 8 per tick (World.func_147467_a). The port has one volume, so the checks run on it.
  tick() {
    const n = this.native;
    if (!n) return null;
    const first = this.flush();
    n.takeDirty();
    for (const [c, set] of this.changes) if (set.size >= 64 && n.loaded[c]) { n.resetRelightChecks(c); this.resends++; }
    this.changes.clear();
    for (let c = 0; c < N * N; c++) {
      if (!n.loaded[c]) continue;
      if (n.queued[c] < 4096) n.enqueueRelightChecks(c);
      if (n.gapFlag[c] || (!n.lightPopulated[c] && n.terrainPopulated[c])) n.tickChunk(c);
    }
    return merge(first, this.box(n.takeDirty()));
  }
  skyAt(x,y,z) { return this.inner.skyAt(x-this.x,y,z-this.z); }
  blockAt(x,y,z) { return this.inner.blockAt(x-this.x,y,z-this.z); }
  packed(x,y,z) { return this.inner.packed(x-this.x,y,z-this.z); }
  level(x,y,z,subtracted=0) { return this.inner.level(x-this.x,y,z-this.z,subtracted); }
  column(x,z) { this.inner.column(x-this.x,z-this.z); }
  box(box) { return box && {...box,x0:box.x0+this.x,x1:box.x1+this.x,z0:box.z0+this.z,z1:box.z1+this.z}; }
  update(x,y,z,oldId) {
    if (this.native) return this.edit(x, y, z, oldId);
    return this.box(this.inner.update(x-this.x,y,z-this.z));
  }
  relight(x0,x1,z0,z1) { return this.box(this.inner.relight(x0-this.x,x1-this.x,z0-this.z,z1-this.z)); }
  // Follows the world's resident square after World.streamAround. The overlap keeps its light and only
  // the strips that can see a difference are relit: the new columns plus 15 blocks into the kept
  // area, and the 16 blocks along the edge the removed columns leave (outside the volume reads as open
  // sky, as in a fresh build). Light cannot travel 15 blocks, so cells beyond those strips already hold
  // their final values and LightVolume.relight's inflow from them is exact: the result equals a newly
  // built volume. A diagonal or long move relights everything. Returns the changed boxes (absolute
  // coordinates) or null when the whole volume was rebuilt.
  shift() {
    const dx = this.world.minX - this.x, dz = this.world.minZ - this.z;
    if (!dx && !dz) return [];
    const v = this.inner, H = v.height, old = this.native && this.nativeSnapshot();
    if (this.native) this.shiftPending(dx, dz);
    this.x += dx; this.z += dz;
    if ((dx && dz) || Math.abs(dx) + Math.abs(dz) + 47 > SIZE) {
      for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) v.column(x, z);
      v.relight(0, SIZE - 1, 0, SIZE - 1);
      if (this.native) { this.nativeShifted(old, dx, dz, true); this.native.takeDirty(); this.native.replayDeferred(); this.native.takeDirty(); }
      return null;
    }
    // Translate the overlap: new local (x, z) holds old local (x + dx, z + dz).
    const sky = new Uint8Array(v.sky.length), block = new Uint8Array(v.block.length), heights = new v.heights.constructor(v.heights.length);
    const x0 = Math.max(0, -dx), x1 = Math.min(SIZE, SIZE - dx), z0 = Math.max(0, -dz), z1 = Math.min(SIZE, SIZE - dz);
    for (let x = x0; x < x1; x++) {
      const to = x * SIZE + z0, from = (x + dx) * SIZE + z0 + dz;
      sky.set(v.sky.subarray(from * H, (from + z1 - z0) * H), to * H);
      block.set(v.block.subarray(from * H, (from + z1 - z0) * H), to * H);
      heights.set(v.heights.subarray(from, from + z1 - z0), to);
    }
    v.sky = sky; v.block = block; v.heights = heights;
    if (this.native) { Object.assign(this.native, this.noSky ? { sky, block } : { sky, block, heights }); this.nativeShifted(old, dx, dz, false); }
    const boxes = [], d = dx || dz, n = Math.abs(d), strip = (a0, a1) => (dx ? [a0, a1, 0, SIZE - 1] : [0, SIZE - 1, a0, a1]);
    const fresh = d > 0 ? strip(SIZE - n, SIZE - 1) : strip(0, n - 1);
    for (let x = fresh[0]; x <= fresh[1]; x++) for (let z = fresh[2]; z <= fresh[3]; z++) v.column(x, z);
    for (const [a0, a1] of d > 0 ? [[SIZE - n - 15, SIZE - 1], [0, 15]] : [[0, n + 14], [SIZE - 16, SIZE - 1]]) {
      const changed = this.box(v.relight(...strip(a0, a1)));
      if (changed) boxes.push(changed);
    }
    if (this.native) {
      for (const c of this.nativeFresh) this.nativeChunk(c); // the relit strips are final: mask, hmMin and the section rule now
      // The chunks that are resident now catch up with what was refused while they were not (edits near the square's edge).
      this.native.takeDirty();
      this.native.replayDeferred();
      const caught = this.box(this.native.takeDirty());
      if (caught) boxes.push(caught);
    }
    return boxes;
  }
  // The window moves by (dx, dz): the unprocessed changes and the refused updates keep their cells (local coordinates move by -d).
  shiftPending(dx, dz) {
    const H = this.world.height, next = new Set();
    for (const i of this.pend) {
      const y = i % H, t = (i - y) / H, lz = t % SIZE - dz, lx = (t - t % SIZE) / SIZE - dx;
      if (lx >= 0 && lz >= 0 && lx < SIZE && lz < SIZE) next.add((lx * SIZE + lz) * H + y);
    }
    this.pend = next;
    this.changes.clear();
    this.native.shiftDeferred(dx, dz);
  }
  nativeSnapshot() {
    const n = this.native, H = n.H;
    return { ids: this.ids, heights: n.heights, mask: n.mask, hmMin: n.hmMin, gaps: n.gaps, gapFlag: n.gapFlag, terrain: n.terrainPopulated, lightPop: n.lightPopulated, queued: n.queued };
  }
  // Translates the per-chunk arrays and the id shadow like the light arrays (new local (x, z) holds old (x + dx, z + dz)); chunks that
  // enter the square are listed in nativeFresh and initialised once the light of their strip is final.
  nativeShifted(o, dx, dz, whole) {
    const n = this.native, H = n.H, n2 = N * N, cx = dx >> 4, cz = dz >> 4;
    n.mask = new Int32Array(n2); n.hmMin = new Int32Array(n2).fill(2147483647); n.gaps = new Uint8Array(n2 * 256); n.gapFlag = new Uint8Array(n2);
    n.terrainPopulated = new Uint8Array(n2); n.lightPopulated = new Uint8Array(n2); n.queued = new Int32Array(n2).fill(4096);
    if (this.noSky) n.heights = new Uint16Array(SIZE * SIZE);
    this.ids = new Uint8Array(SIZE * SIZE * H);
    this.nativeFresh = [];
    for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
      const c = a * N + b, ox = a + cx, oz = b + cz;
      if (whole || ox < 0 || oz < 0 || ox >= N || oz >= N) { this.nativeFresh.push(c); continue; }
      const k = ox * N + oz;
      n.mask[c] = o.mask[k]; n.hmMin[c] = o.hmMin[k]; n.gapFlag[c] = o.gapFlag[k]; n.gaps.set(o.gaps.subarray(k * 256, k * 256 + 256), c * 256);
      n.terrainPopulated[c] = o.terrain[k]; n.lightPopulated[c] = o.lightPop[k]; n.queued[c] = o.queued[k];
      for (let x = 0; x < 16; x++) {
        const to = ((a * 16 + x) * SIZE + b * 16) * H, from = ((ox * 16 + x) * SIZE + oz * 16) * H;
        this.ids.set(o.ids.subarray(from, from + 16 * H), to);
        if (this.noSky) { const fh = (ox * 16 + x) * SIZE + oz * 16; n.heights.set(o.heights.subarray(fh, fh + 16), (a * 16 + x) * SIZE + b * 16); }
      }
    }
    this.nativeLoaded();
    if (whole) for (const c of this.nativeFresh) this.nativeChunk(c);
  }
}
