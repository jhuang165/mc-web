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

// Chunks of lead beyond the resident square on every side.
export const PREFETCH_MARGIN = 2;
// A 12-column span touches at most three cells per axis.
const CELL_CACHE = 9;
const key = (x, z) => `${x},${z}`;

// Worker side: builds the requested cell or column and lists the buffers to transfer.
export async function createStreamWorker({ seed, generationVersion, originX, originZ, worldType, generatorOptions }) {
  await populationBlockMapperReady;
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

// Page side. `port` is a Worker (or anything with postMessage and onmessage/onerror slots).
export class StreamPrefetch {
  constructor(world, port, { margin = PREFETCH_MARGIN, inFlight = 1 } = {}) {
    this.world = world; this.port = port; this.margin = margin; this.inFlight = inFlight;
    this.cells = world.generationVersion >= 13 && !!world.population;
    this.pending = new Set();
    this.waiters = new Set();
    this.failed = null;
    this.received = 0;
    if (this.cells) world.population.cells.max = Math.max(world.population.cells.max, CELL_CACHE);
    port.onmessage = ({ data }) => this.receive(data);
    port.onerror = (event) => this.fail(event?.message ?? 'worker error');
    port.postMessage({ type: 'init', seed: String(world.javaSeed), generationVersion: world.generationVersion, originX: world.originX, originZ: world.originZ, worldType: world.worldType, generatorOptions: world.generatorOptions });
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
      if (this.pending.size >= this.inFlight) break;
      const k = key(...u);
      if (this.pending.has(k) || this.has(u)) continue;
      this.pending.add(k);
      this.port.postMessage({ type: this.cells ? 'cell' : 'column', x: u[0], z: u[1] });
    }
    // Idle worker: headless columns for the spawner's chunks beyond the resident square (lowest priority).
    if (this.ring && this.pending.size < this.inFlight) {
      for (const u of this.ring.units()) {
        const k = `r${key(...u)}`;
        if (this.pending.has(k)) continue;
        this.pending.add(k);
        this.port.postMessage({ type: 'ring', cell: this.cells, x: u[0], z: u[1] });
        break;
      }
    }
  }
  receive(data) {
    if (data?.type === 'error') { this.fail(data.message); return; }
    if (data?.type === 'ring') {
      if (this.pending.delete(`r${key(data.x, data.z)}`)) { this.received++; this.ring?.receive(data.columns); }
      return;
    }
    const k = key(data.x, data.z);
    if (!this.pending.delete(k)) return;
    this.received++;
    if (data.type === 'cell') this.world.population.adopt(data.cell);
    else if (data.type === 'column' && !this.world.chunks.has(k)) this.world.pregenerated.set(k, data.column);
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
    this.pending.clear();
  }
}
