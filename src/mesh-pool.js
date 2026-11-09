// A small pool of mesh workers (mesh-worker.js). `request(snapshot)` posts a region snapshot to the least busy worker and resolves with
// the layer arrays (or null when the pool cannot serve it: no Worker, a worker error). Workers are made on first use and receive the
// page's colormaps before their first job. Without Worker the pool is `unavailable` and the scene meshes on the page thread.
import { colormaps } from "./biome-colors.js";

// `?meshWorkers=0` (or localStorage blockworld.meshWorkers = 0) keeps column meshing on the page thread.
export function meshWorkersEnabled() {
  try {
    const q = new URLSearchParams(globalThis.location?.search ?? "").get("meshWorkers") ?? globalThis.localStorage?.getItem("blockworld.meshWorkers");
    if (q === "0" || q === "false") return false;
  } catch {}
  return typeof Worker === "function";
}
// `?meshWorkers=N` (N >= 1) sets the pool size, for measuring it (batch 31); the default is min(3, cores - 2).
export const defaultMeshWorkers = () => {
  try {
    const n = Number(new URLSearchParams(globalThis.location?.search ?? "").get("meshWorkers") ?? globalThis.localStorage?.getItem("blockworld.meshWorkers"));
    if (Number.isInteger(n) && n >= 1 && n <= 16) return n;
  } catch {}
  return Math.max(1, Math.min(3, (globalThis.navigator?.hardwareConcurrency ?? 4) - 2));
};

export class MeshPool {
  constructor({ size = defaultMeshWorkers(), createWorker } = {}) {
    this.injected = !!createWorker;
    this.size = size; this.createWorker = createWorker ?? (() => new Worker(new URL("./mesh-worker.js", import.meta.url), { type: "module" })); this.lanes = []; this.jobs = new Map(); this.nextId = 1; this.broken = false; this.maps = null;
  }
  get unavailable() { return this.broken || (!this.injected && typeof Worker !== "function"); }
  get inflight() { return this.jobs.size; }
  get capacity() { return this.size * 2; }
  lane() {
    if (this.lanes.length < this.size && !this.lanes.some((l) => !l.busy)) {
      try {
        const worker = this.createWorker(), lane = { worker, busy: 0, maps: null };
        worker.onmessage = ({ data }) => this.done(lane, data);
        worker.onerror = (e) => this.fail(lane, e?.message ?? "worker error");
        this.lanes.push(lane);
      } catch (e) { if (!this.lanes.length) this.broken = true; }
    }
    return this.lanes.reduce((best, l) => (!best || l.busy < best.busy ? l : best), null);
  }
  request({ job, transfer }) {
    const lane = this.broken ? null : this.lane();
    if (!lane) return Promise.resolve(null);
    const maps = colormaps();
    if (!maps) return Promise.resolve(null);
    if (lane.maps !== maps.grass) { lane.worker.postMessage({ type: "colormaps", grass: maps.grass, foliage: maps.foliage }); lane.maps = maps.grass; }
    job.id = this.nextId++;
    return new Promise((resolve) => {
      this.jobs.set(job.id, { resolve, lane });
      lane.busy++;
      try { lane.worker.postMessage(job, transfer); } catch (e) { this.jobs.delete(job.id); lane.busy--; resolve(null); }
    });
  }
  done(lane, data) {
    const j = this.jobs.get(data.id);
    if (!j) return;
    this.jobs.delete(data.id); lane.busy--;
    if (data.type === "error") { console.warn(`mesh worker: ${data.message}`); j.resolve(null); } else j.resolve(data);
  }
  fail(lane, message) {
    console.warn(`mesh worker failed, meshing on the page thread: ${message}`);
    this.broken = true;
    for (const [id, j] of this.jobs) if (j.lane === lane) { this.jobs.delete(id); j.resolve(null); }
    try { lane.worker.terminate(); } catch {}
    this.lanes = this.lanes.filter((l) => l !== lane);
  }
  dispose() {
    for (const l of this.lanes) try { l.worker.terminate(); } catch {}
    this.lanes = [];
    for (const j of this.jobs.values()) j.resolve(null);
    this.jobs.clear();
  }
}
