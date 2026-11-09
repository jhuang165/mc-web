// The gun server's infinite world: a streamed Java world (World 'javaStreamed') whose resident columns are the union of every
// connected player's window, like PlayerManager's per-player chunk watch areas over one ChunkProviderServer. Each player's window
// is the browser's own resident square (World.windowAt: 8 x 8 columns), so the server sends a tab exactly the columns it holds.
// Population cells are built ahead of every player in a worker (streaming-generator.js StreamPrefetch over worker_threads,
// server/stream-worker.js); a window only moves once its cells are built, and a player whose column is not ticking waits.
// This is the port's residency policy, not Java's view-distance rule (a 1.7.10 server keeps view-distance 10 around each player).
import { WorldChunk } from '../world.js';
import { StreamPrefetch } from '../streaming-generator.js';
import { CELL } from '../streaming-population.js';
import { lightOpacity, lightEmission } from '../lighting.js';
import { populationBlockMapperReady } from '../population-world.js';
import { restorePopulationColumns } from '../population-runtime.js';

// Generation for new gun-server worlds: the newest streamed generator (population, structures, native spawn and neighbour callbacks).
export const STREAMED_BIOME = 'javaStreamed', STREAMED_GENERATION = 21;
// Population maps the generator's original block ids through block-registry.js, loaded asynchronously: await this before a streamed World.
export const serverWorldReady = populationBlockMapperReady;
const SPAN = 8; // columns per side of a window (World.streamAround)
const CELL_CACHE = 36; // population cells kept: about four players' worth of 3 x 3 cells
const noop = () => {};
const NO_MOBS = { create: () => ({}), entities: { push: noop } }, NO_SPAWNERS = { add: noop };
const columnKey = (cx, cz) => `${cx},${cz}`; // World's chunk-map key

export class ServerColumns {
  // `port`: a Worker-like object (postMessage / onmessage / terminate) running createStreamWorker, or null to generate inline.
  constructor(world, { port = null } = {}) {
    if (!world.streaming) throw new Error('ServerColumns needs a streamed world');
    this.world = world;
    this.ticking = new Set();
    this.prefetch = port ? new StreamPrefetch(world, port, { inFlight: 2 }) : null;
    if (world.population) world.population.cells.max = Math.max(world.population.cells.max, CELL_CACHE);
    // World.isTicking: a column whose eight neighbours are resident (the browser's one-chunk halo, per column instead of per square).
    world.isTicking = (x, z) => this.ticking.has(columnKey(Math.floor(x / 16), Math.floor(z / 16)));
    this.spawnWindow = { minX: world.minX, minZ: world.minZ };
    this.refreshTicking();
  }
  windowAt(x, z) { return this.world.windowAt(x, z); }
  static same(a, b) { return !!a && !!b && a.minX === b.minX && a.minZ === b.minZ; }
  *keys(w) { for (let cx = w.minX / 16; cx < w.minX / 16 + SPAN; cx++) for (let cz = w.minZ / 16; cz < w.minZ / 16 + SPAN; cz++) yield [cx, cz]; }
  // Every population cell of window `w` is built (or the window's columns are resident already), so moving there does not generate here.
  ready(w) {
    if (!this.prefetch || this.prefetch.failed || !this.prefetch.cells) return true;
    for (const [cx, cz] of this.keys(w)) if (!this.world.chunks.has(columnKey(cx, cz)) && !this.world.population.hasCell(Math.floor(cx / CELL), Math.floor(cz / CELL))) return false;
    return true;
  }
  // Ask the worker for what the players at these positions will need next (nearest first, two requests in flight).
  prefetchAround(points) { if (this.prefetch) for (const p of points) this.prefetch.update(p.x, p.z); }
  whenReady(w) {
    if (this.ready(w) || !this.prefetch) return Promise.resolve();
    return this.prefetch.whenHas([...new Map([...this.keys(w)].map(([cx, cz]) => [columnKey(Math.floor(cx / CELL), Math.floor(cz / CELL)), [Math.floor(cx / CELL), Math.floor(cz / CELL)]])).values()]);
  }
  // A column as World.streamAround builds it: the generated (or stored) terrain, then every remembered write to it.
  build(cx, cz) {
    const w = this.world, key = columnKey(cx, cz), generated = w.terrainFor(cx, cz), c = new WorldChunk(cx, cz, w.height);
    c.blocks.set(generated.blocks); c.meta.set(generated.metadata);
    for (const [cell, stored] of w.chunkEdits.get(key) ?? []) { const value = stored % 4096; c.blocks[cell] = value & 255; c.meta[cell] = value >> 8; }
    return c;
  }
  // Makes exactly the columns of these windows (plus the spawn window, the spawn chunks) resident. Returns { added, removed }.
  reside(windows) {
    const w = this.world, next = new Map(), added = [], removed = [];
    for (const win of [this.spawnWindow, ...windows]) for (const [cx, cz] of this.keys(win)) {
      const key = columnKey(cx, cz);
      if (next.has(key)) continue;
      let c = w.chunks.get(key);
      if (!c) { c = this.build(cx, cz); added.push(c); }
      next.set(key, c);
    }
    for (const [key, c] of w.chunks) if (!next.has(key)) removed.push(c);
    if (!added.length && !removed.length) return { added, removed };
    w.chunks = next; w.lastChunk = null;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const c of next.values()) { x0 = Math.min(x0, c.x); z0 = Math.min(z0, c.z); x1 = Math.max(x1, c.x); z1 = Math.max(z1, c.z); }
    // minX..maxX bound the resident columns (fire/fluid scans and World.inside read them); isTicking is per column (above).
    w.minX = x0 * 16; w.minZ = z0 * 16; w.maxX = x1 * 16 + 16; w.maxZ = z1 * 16 + 16;
    // WorldChunkManager's biome cache has no expiry: keep the resident columns and a one-column halo, as streamAround does.
    const cache = w.javaGenerator?.manager?.cache;
    if (cache) for (const k of cache.keys()) {
      const [gx, gz] = k.split(',').map(Number), cx = (gx * 16 - w.originX) >> 4, cz = (gz * 16 - w.originZ) >> 4;
      let near = false;
      for (let dx = -1; dx <= 1 && !near; dx++) for (let dz = -1; dz <= 1 && !near; dz++) near = next.has(columnKey(cx + dx, cz + dz));
      if (!near) cache.delete(k);
    }
    this.refreshTicking();
    return { added, removed };
  }
  refreshTicking() {
    const chunks = this.world.chunks;
    this.ticking = new Set();
    for (const c of chunks.values()) {
      let all = true;
      for (let dx = -1; dx <= 1 && all; dx++) for (let dz = -1; dz <= 1 && all; dz++) all = chunks.has(columnKey(c.x + dx, c.z + dz));
      if (all) this.ticking.add(columnKey(c.x, c.z));
    }
  }
  // Population records (chest loot, dispensers, flower pots, liquid ticks, animals, villagers, witches and mob spawners) of columns
  // resident for the first time, handed to the server's tiles and its mob world (server-mobs.js) when it has one. Minecart chests
  // (mineshafts) have no server entity yet and are dropped (counted).
  materialize({ tiles, fluids, mobs = NO_MOBS, spawners = NO_SPAWNERS }) {
    const columns = this.world.claimFreshColumns();
    if (!columns.length) return null;
    return restorePopulationColumns(columns, { world: this.world, survival: tiles, mobs, spawners, minecarts: { spawnChest: noop }, fluids });
  }
  dispose() { this.prefetch?.dispose(); this.prefetch = null; }
}

// An approximate light for the server's streamed world (the finite LightVolume covers 128 x 128 only): sky light is 15 less the
// opacity of the blocks above the cell; block light is the brightest emitter within 15 blocks less its Manhattan distance,
// ignoring walls. Crops, saplings, melting and freezing read it. Not World.getSavedLightValue.
export class ServerLight {
  constructor(world, emission) {
    this.world = world; this.emission = emission;
    this.emitters = new Map(); // column key -> Map(cell key -> [x, y, z])
    this.mayEmit = Uint8Array.from({ length: 256 }, (_, b) => +(lightEmission(b, true) > 0)); // lit or not (a powered repeater)
  }
  scan(c) {
    const H = this.world.height, found = new Map(), blocks = c.blocks, mayEmit = this.mayEmit;
    for (let i = 0; i < blocks.length; i++) if (mayEmit[blocks[i]]) {
      const y = i % H, t = (i - y) / H, x = c.x * 16 + (t >> 4), z = c.z * 16 + (t & 15); // WorldChunk order: ((x * 16 + z) * height + y)
      // An unlit emitter (redstone ore, a repeater) is kept: whether it shines is read when the light is asked for.
      found.set(`${x},${y},${z}`, [x, y, z]);
    }
    this.emitters.set(columnKey(c.x, c.z), found);
  }
  columns({ added = [], removed = [] }) {
    for (const c of removed) this.emitters.delete(columnKey(c.x, c.z));
    for (const c of added) this.scan(c);
  }
  update(x, y, z) {
    const k = columnKey(x >> 4, z >> 4);
    let col = this.emitters.get(k);
    if (!col) { if (!this.world.chunkAt(x >> 4, z >> 4)) return; this.emitters.set(k, col = new Map()); }
    const cell = `${x},${y},${z}`;
    if (this.mayEmit[this.world.get(x, y, z)]) col.set(cell, [x, y, z]); else col.delete(cell);
  }
  skyAt(x, y, z) {
    const w = this.world;
    if (y >= w.height) return 15;
    const blocks = w.columnBlocks(x, z);
    if (!blocks) return 15;
    let light = 15;
    for (let h = w.height - 1; h > y && light > 0; h--) { const b = blocks[h]; if (b) light -= Math.max(0, lightOpacity(b)); }
    return Math.max(0, light);
  }
  blockAt(x, y, z) {
    let best = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const col = this.emitters.get(columnKey((x >> 4) + dx, (z >> 4) + dz));
      if (col) for (const [ex, ey, ez] of col.values()) {
        const d = Math.abs(ex - x) + Math.abs(ey - y) + Math.abs(ez - z);
        if (d >= 15) continue;
        best = Math.max(best, this.emission(ex, ey, ez, this.world.get(ex, ey, ez)) - d);
      }
    }
    return Math.max(0, best);
  }
  level(x, y, z, darkness = 0) { return Math.max(this.skyAt(x, y, z) - darkness, this.blockAt(x, y, z)); }
}

// A browser-Worker-shaped wrapper of a worker_threads Worker (Node), for StreamPrefetch. Messages that arrive before `init`
// finishes are queued in the worker's own port, so requests sent right after init wait for it there.
export function nodeWorkerPort(Worker, url) {
  const worker = new Worker(url);
  const port = { onmessage: null, onerror: null, postMessage: (m, t) => worker.postMessage(m, t), terminate: () => worker.terminate() };
  worker.on('message', data => port.onmessage?.({ data }));
  worker.on('error', error => port.onerror?.({ message: error?.message ?? String(error) }));
  worker.unref?.();
  return port;
}
