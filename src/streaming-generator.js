// Asynchronous generation for streamed worlds (WORLD-02f). A worker (streaming-worker.js) runs the same
// generator chain as the page (java-world.js streamedSource) and builds what the player will need
// next: population cells for generation 13, terrain columns for 12. Results join the page's caches,
// so World.streamAround finds them instead of generating for about a second on the main thread.
//
// Columns are a pure function of the seed, so a column from the worker equals one generated here and
// nothing depends on which side built it or when it arrived. If the player outruns the worker, the
// page waits for it while they are still inside the ticking area (`ready`), then falls back to
// generating synchronously; a worker that fails is dropped and generation stays synchronous.
import { streamedSource } from './java-world.js';
import { populationBlockMapperReady } from './population-world.js';
import { CELL } from './streaming-population.js';
import { compactColumn } from './headless-columns.js';
import { DimensionWorld } from './dimension-world.js';

// Chunks of lead beyond the resident square on every side.
export const PREFETCH_MARGIN = 2;
// A 12-column span touches at most three cells per axis.
const CELL_CACHE = 9;
const key = (x, z) => `${x},${z}`;
// Ring workers made on demand (`ringSpawn`) are ended after this many updates (ticks) with the ring complete and the worker idle (batch 29:
// each worker holds 8-12 MB of JS heap plus an isolate and a thread), and made again when ring units stay unserved.
export const RING_IDLE_TICKS = 100;
const RING_HUNGRY_TICKS = 3; // updates of unserved ring units before another ring worker is made (a walking player's few columns go to the main worker)

// Worker side: builds the requested cell or column and lists the buffers to transfer.
export async function createStreamWorker({ seed, generationVersion, originX, originZ, worldType, generatorOptions, dimension, dimensionSeed }) {
  await populationBlockMapperReady;
  if (dimension) return createDimensionWorker(dimensionSeed, dimension);
  const source = streamedSource({ seed: BigInt(seed), generationVersion, originX, originZ, worldType, generatorOptions });
  return (request) => {
    if (request.type === 'cell') {
      const cell = source.population.export(request.x, request.z), transfer = [];
      for (const c of cell.columns.values()) transfer.push(c.blocks.buffer, c.metadata.buffer);
      return { message: { type: 'cell', x: request.x, z: request.z, cell }, transfer };
    }
    if (request.type === 'ring') {
      // Headless spawning columns (headless-columns.js): compacted here, so only about 25 KB a column crosses over.
      const columns = [], transfer = [], add = (cx, cz, blocks, metadata) => {
        const col = compactColumn(blocks, metadata); columns.push([cx, cz, col]); transfer.push(col.blocks.buffer, col.meta.buffer);
      };
      if (request.cell) for (const [k, c] of source.population.export(request.x, request.z).columns) { const [cx, cz] = k.split(',').map(Number); add(cx, cz, c.blocks, c.metadata); }
      else { const c = source.column(request.x, request.z); add(request.x, request.z, c.blocks, c.metadata); }
      return { message: { type: 'ring', x: request.x, z: request.z, cell: !!request.cell, columns }, transfer };
    }
    const c = source.column(request.x, request.z), blocks = Uint8Array.from(c.blocks), metadata = Uint8Array.from(c.metadata);
    return { message: { type: 'column', x: request.x, z: request.z, column: { blocks, metadata } }, transfer: [blocks.buffer, metadata.buffer] };
  };
}

// Worker side of a Nether/End world (batch 28): the same stateless column builders DimensionWorld runs on the page (netherChunk /
// endChunk), so a column from here equals the page's. The Nether's chest/spawner records of the column ride along with it.
function createDimensionWorker(seed, dimension) {
  const dw = new DimensionWorld(seed, dimension), build = (cx, cz) => {
    const c = dimension === -1 ? dw.netherChunk(cx, cz) : dw.endChunk(cx, cz), k = `${cx},${cz}`;
    const records = dw.population?.records.get(k) ?? null;
    dw.population?.records.delete(k);
    return { c, records };
  };
  return (request) => {
    if (request.type === 'ring') {
      const { c } = build(request.x, request.z), col = compactColumn(c.blocks, c.metadata);
      return { message: { type: 'ring', x: request.x, z: request.z, cell: false, columns: [[request.x, request.z, col]] }, transfer: [col.blocks.buffer, col.meta.buffer] };
    }
    const { c, records } = build(request.x, request.z);
    return { message: { type: 'column', x: request.x, z: request.z, column: { blocks: c.blocks, metadata: c.metadata }, records }, transfer: [c.blocks.buffer, c.metadata.buffer] };
  };
}

// Page side. `port` is a Worker (or anything with postMessage and onmessage/onerror slots).
export class StreamPrefetch {
  constructor(world, port, { margin = PREFETCH_MARGIN, inFlight = 1, ringPorts = [], ringSpawn = null, ringMax = 0 } = {}) {
    this.world = world; this.port = port; this.margin = margin; this.inFlight = inFlight;
    this.cells = world.generationVersion >= 13 && !!world.population;
    this.pending = new Set();
    this.waiters = new Set();
    this.failed = null;
    this.received = 0;
    if (this.cells) world.population.cells.max = Math.max(world.population.cells.max, CELL_CACHE);
    port.onmessage = ({ data }) => this.receive(data);
    port.onerror = (event) => this.fail(event?.message ?? 'worker error');
    // Extra workers that only build headless ring columns (batch 28: a Nether/End column is generated from scratch, about 40-60 ms of
    // worker CPU, and one worker serving both the window and the ring filled the 441-column ring in about 28 s).
    this.mainRing = null;
    this.ringPorts = ringPorts.map((p) => ({ port: p, busy: null, idle: 0 }));
    this.hungry = 0; this.ringSpawn = ringSpawn; this.ringMax = ringMax; // lazily created ring workers: up to ringMax at once, none on a low-core machine
    if (ringSpawn) for (let i = 0; i < ringMax; i++) { try { this.ringPorts.push({ port: ringSpawn(), busy: null, idle: 0 }); } catch { break; } } // made up front (they start while the loading screen finishes); ended when the ring is full, made again if units stay unserved
    const init = () => ({ type: 'init', seed: String(world.javaSeed), generationVersion: world.generationVersion, originX: world.originX, originZ: world.originZ, worldType: world.worldType, generatorOptions: world.generatorOptions, dimension: world.dimension || 0, dimensionSeed: world.dimension ? world.seed : undefined });
    port.postMessage(init());
    this.init = init;
    for (const r of this.ringPorts) this.startRing(r);
  }
  startRing(r) {
    r.port.onmessage = ({ data }) => { r.busy = null; this.receive(data); };
    r.port.onerror = (event) => this.fail(event?.message ?? 'worker error');
    r.port.postMessage(this.init());
  }
  fail(reason) {
    if (this.failed) return;
    this.failed = String(reason);
    this.pending.clear();
    for (const w of [...this.waiters]) w();
    console.error(`streaming-generator: worker unavailable, generating on the main thread: ${this.failed}`);
  }
  // Units (cells or columns) holding a non-resident column within `margin` chunks of the square for
  // (x, z), nearest first; with margin 0, exactly what streamAround would generate.
  units(x, z, margin = this.margin) {
    const { minX, minZ } = this.world.windowAt(x, z), cx0 = minX / 16 - margin, cz0 = minZ / 16 - margin, n = 8 + 2 * margin;
    const out = new Map(), px = x / 16, pz = z / 16;
    for (let cx = cx0; cx < cx0 + n; cx++) for (let cz = cz0; cz < cz0 + n; cz++) {
      if (this.world.chunks.has(key(cx, cz))) continue;
      const u = this.cells ? [Math.floor(cx / CELL), Math.floor(cz / CELL)] : [cx, cz];
      out.set(key(...u), u);
    }
    const centre = (u) => (this.cells ? [(u[0] + 0.5) * CELL, (u[1] + 0.5) * CELL] : [u[0] + 0.5, u[1] + 0.5]);
    return [...out.values()].sort((a, b) => {
      const [ax, az] = centre(a), [bx, bz] = centre(b);
      return (ax - px) ** 2 + (az - pz) ** 2 - ((bx - px) ** 2 + (bz - pz) ** 2);
    });
  }
  // Requests in flight on the main worker (window columns, cells and its own ring request; ring-worker requests do not count).
  windowPending() { let n = 0; for (const k of this.pending) if (k[0] !== 'r' || k === this.mainRing) n++; return n; }
  has([x, z]) { return this.cells ? this.world.population.hasCell(x, z) : this.world.pregenerated.has(key(x, z)); }
  // Called once per tick with the player's position: requests missing units and trims the column cache.
  update(x, z) {
    if (this.failed || !Number.isFinite(x) || !Number.isFinite(z)) return;
    const wanted = this.units(x, z);
    if (!this.cells) {
      const keep = new Set(wanted.map((u) => key(...u)));
      for (const k of this.world.pregenerated.keys()) if (!keep.has(k)) this.world.pregenerated.delete(k);
    }
    for (const u of wanted) {
      if (this.windowPending() >= this.inFlight) break;
      const k = key(...u);
      if (this.pending.has(k) || this.has(u)) continue;
      this.pending.add(k);
      this.port.postMessage({ type: this.cells ? 'cell' : 'column', x: u[0], z: u[1] });
    }
    // Idle worker: headless columns for the spawner's chunks beyond the resident square (lowest priority). Dedicated ring workers
    // take them first; the main worker only when it has no window request in flight.
    if (this.ring) {
      const all = this.ringSpawn ? this.ring.units() : null; // at most four units at a time (HeadlessColumns.units)
      if (all) { // on-demand ring workers: make some when units stay unserved, end idle ones once the ring is complete
        const open = all.filter((u) => !this.pending.has(`r${key(...u)}`)).length, free = this.ringPorts.filter((r) => !r.busy).length + (this.windowPending() + (this.mainRing ? 1 : 0) < this.inFlight ? 1 : 0);
        this.hungry = open > free ? this.hungry + 1 : 0;
        if (this.hungry >= RING_HUNGRY_TICKS) {
          for (let n = Math.min(this.ringMax - this.ringPorts.length, open - free); n > 0; n--) { try { const r = { port: this.ringSpawn(), busy: null, idle: 0 }; this.ringPorts.push(r); this.startRing(r); } catch { this.ringMax = 0; break; } }
        }
        for (const r of [...this.ringPorts]) {
          if (r.busy || all.length) { r.idle = 0; continue; }
          if (++r.idle < RING_IDLE_TICKS) continue;
          r.port.onmessage = r.port.onerror = null; r.port.terminate?.();
          this.ringPorts.splice(this.ringPorts.indexOf(r), 1);
        }
      }
      const idle = this.ringPorts.filter((r) => !r.busy);
      if (this.windowPending() + (this.mainRing ? 1 : 0) < this.inFlight) idle.push(null);
      if (idle.length) {
        for (const u of all ?? this.ring.units()) {
          const k = `r${key(...u)}`;
          if (this.pending.has(k)) continue;
          const slot = idle.shift();
          this.pending.add(k);
          const msg = { type: 'ring', cell: this.cells, x: u[0], z: u[1] };
          if (slot) { slot.busy = k; slot.port.postMessage(msg); } else { this.mainRing = k; this.port.postMessage(msg); }
          if (!idle.length) break;
        }
      }
    }
  }
  receive(data) {
    if (data?.type === 'error') { this.fail(data.message); return; }
    if (data?.type === 'ring') {
      const rk = `r${key(data.x, data.z)}`;
      if (rk === this.mainRing) this.mainRing = null;
      if (this.pending.delete(rk)) { this.received++; this.ring?.receive(data.columns); }
      return;
    }
    const k = key(data.x, data.z);
    if (!this.pending.delete(k)) return;
    this.received++;
    if (data.type === 'cell') this.world.population.adopt(data.cell);
    else if (data.type === 'column' && !this.world.chunks.has(k)) {
      this.world.pregenerated.set(k, data.column);
      const pop = this.world.population;
      if (data.records && pop?.records && !pop.isMaterialized?.(data.x, data.z)) pop.records.set(k, data.records); // DimensionWorld.netherChunk's side effect
    }
    for (const w of [...this.waiters]) w();
  }
  // Requests exactly these units (cells, or columns below generation 13) and resolves once each has arrived or the worker has failed
  // (loading-screen paths: the arrival window of a portal trip, travel-loading.js). Units already held are not asked for.
  whenHas(units) {
    const todo = units.filter((u) => !this.has(u));
    if (this.failed) return Promise.resolve();
    for (const u of todo) {
      const k = key(...u);
      if (!this.pending.has(k)) { this.pending.add(k); this.port.postMessage({ type: this.cells ? 'cell' : 'column', x: u[0], z: u[1] }); }
    }
    return new Promise((resolve) => {
      const check = () => {
        if (!this.failed && todo.some((u) => this.pending.has(key(...u)))) return;
        this.waiters.delete(check); resolve();
      };
      this.waiters.add(check); check();
    });
  }
  // True when the square for (x, z) can be built without generating on this thread, or when there
  // is nothing to wait for (no worker, or a failed one).
  ready(x, z) {
    if (this.failed) return true;
    return this.units(x, z, 0).every((u) => this.has(u));
  }
  dispose() {
    this.port.onmessage = this.port.onerror = null;
    this.port.terminate?.();
    for (const r of this.ringPorts) { r.port.onmessage = r.port.onerror = null; r.port.terminate?.(); }
    this.pending.clear();
  }
}
