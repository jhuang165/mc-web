// Builds the terrain a portal trip will need while the player is still standing in the portal (the 4 s countdown, 80 ticks), and hands it to the
// world the trip creates. Natively the destination world is already loaded and its chunks are generated as the player arrives; here the destination
// World is made fresh by the trip, so its first window cost a worker round (about 1.2 s per Overworld population cell, batch 32) after the loading
// screen came up. The cells and columns are the output of the unchanged generators in the stream workers, a pure function of the seed (and, for the
// Overworld, the window origin), so adopting them gives the same blocks the trip would have asked the same workers for afterwards.
//  - Overworld target: population cells (generation 13 and up) are built into a bare shell that only holds them (never edited, never ticked);
//  - Nether target: the shell is a DimensionWorld whose `pregenerated` columns and chunk records are moved into the trip's world.
// A request that was never used (the player stepped out of the portal) is dropped after IDLE_MS.
import { arrivalWarmer } from "./travel-loading.js";
import { World } from "./world.js";
import { DimensionWorld } from "./dimension-world.js";
import { javaSeed, spawnKey, spawnOrigins, presolvedSpawns } from "./java-world.js";
import { spawnRequest } from "./spawn-presolve.js";
import { OVERWORLD, NETHER } from "./dimensions.js";

const IDLE_MS = 30000, RESIDENT_CELLS = 9, SPECULATIVE_CELLS = 5, MOVED = 6; // MOVED: blocks the target must shift before the wanted units are asked again

class ShellPopulation { // what StreamPrefetch needs of a StreamingPopulation: a cell cache with adopt / hasCell
  constructor() { this.cells = { max: RESIDENT_CELLS, map: new Map() }; }
  hasCell(x, z) { return this.cells.map.has(`${x},${z}`); }
  adopt(cell) { const k = `${cell.cellX},${cell.cellZ}`; if (this.cells.map.has(k)) return false; this.cells.map.set(k, cell); return true; }
}

export class ExitPrewarm {
  constructor({ createWorker, maxWorkers, setTimer = (f, ms) => setTimeout(f, ms) } = {}) {
    this.createWorker = createWorker; this.maxWorkers = maxWorkers; this.setTimer = setTimer;
    this.shell = null; this.warmer = null; this.job = null; this.need = null; this.id = null; this.at = null; this.timer = null; this.requests = 0;
  }
  // The shell for the root world's dimension `to`, or null when that world builds nothing a worker can (generation below 13, the End).
  makeShell(root, to) {
    if (to === NETHER) return new DimensionWorld(root.seed, NETHER);
    if (to !== OVERWORLD) return null;
    const request = spawnRequest({ ...root, dimension: 0 }); // a root saved while in the Nether carries its dimension
    if (!request || request.generationVersion < 13) return null;
    const key = spawnKey(request.seed, request.generationVersion, request.worldType, request.generatorOptions);
    let origin = spawnOrigins.get(key);
    if (!origin) { const s = presolvedSpawns.get(key); if (s) origin = [((s.x >> 4) - 4) * 16, ((s.z >> 4) - 4) * 16]; }
    if (!origin) return null;
    const shell = { streaming: true, dimension: 0, seed: request.seed, javaSeed: javaSeed(request.seed), generationVersion: request.generationVersion, worldType: request.worldType, generatorOptions: request.generatorOptions, originX: origin[0], originZ: origin[1], chunks: new Map(), baseColumns: new Map(), pregenerated: new Map(), population: new ShellPopulation() };
    shell.windowAt = (x, z) => World.prototype.windowAt.call(shell, x, z);
    return shell;
  }
  // tt: transferTarget(...) of the trip; asks for the window round it and (spare lanes) the windows round the spots an exit may be built at.
  start(root, to, tt) {
    if (!root || !tt || !Number.isFinite(tt.x) || !Number.isFinite(tt.z)) return false;
    const id = `${root.id}:${to}`;
    if (this.id === id && this.at && Math.hypot(tt.x - this.at[0], tt.z - this.at[1]) < MOVED) return true;
    if (this.id !== id) { this.dispose(); try { this.shell = this.makeShell(root, to); } catch (e) { console.warn(`exit prewarm: no shell: ${e.message}`); this.shell = null; } if (!this.shell) return false; this.id = id; this.warmer = arrivalWarmer(this.shell, { pause: null, pageFallback: false, specMax: to === OVERWORLD ? SPECULATIVE_CELLS : null, createWorker: this.createWorker, ...(this.maxWorkers ? { maxWorkers: this.maxWorkers } : {}) }); }
    this.at = [tt.x, tt.z]; this.requests++;
    // The target's own window first (`need`, all a trip waits for), then the windows round the spots an exit may be built at (`job`, speculative; the
    // lanes are separate prefetchers, so the second request must not repeat a unit the first has in flight).
    const prior = this.job, warmer = this.warmer;
    this.need = Promise.resolve(prior).then(() => warmer.window(tt.x, tt.z, 0)).catch(() => {});
    this.job = this.need.then(() => warmer.window(tt.x, tt.z, 18)).catch(() => {});
    clearTimeout(this.timer); this.timer = this.setTimer(() => this.dispose(), IDLE_MS); this.timer?.unref?.();
    return true;
  }
  // Moves what was built into `prepared` (the trip's world) and ends the workers. `stage` "start" (before the Teleporter reads terrain) takes Overworld
  // cells; "end" (after it) takes Nether columns, which the Teleporter's own page-thread reads would otherwise consume out of `pregenerated`.
  async adopt(prepared, stage, { timeoutMs = 15000 } = {}) {
    const shell = this.shell;
    if (!shell || !prepared?.streaming || (prepared.dimension ?? 0) !== (shell.dimension ?? 0)) return 0;
    const overworld = !shell.dimension;
    if (overworld !== (stage === "start")) return 0;
    let t; // the units still in flight are the ones the trip would ask for next: wait for them rather than start them again
    await Promise.race([this.need, new Promise((r) => { t = setTimeout(r, timeoutMs); })]); clearTimeout(t);
    let moved = 0;
    if (overworld) {
      if (shell.originX !== prepared.originX || shell.originZ !== prepared.originZ || !prepared.population?.adopt) { this.dispose(); return 0; }
      prepared.population.cells.max = Math.max(prepared.population.cells.max, RESIDENT_CELLS);
      for (const cell of shell.population.cells.map.values()) if (prepared.population.adopt(cell)) moved++;
    } else {
      const records = shell.population?.records, pop = prepared.population;
      for (const [k, column] of shell.pregenerated) {
        if (prepared.chunks.has(k) || prepared.pregenerated.has(k)) continue;
        prepared.pregenerated.set(k, column); moved++;
        const r = records?.get(k);
        if (r && pop?.records && !pop.isMaterialized?.(...k.split(",").map(Number))) pop.records.set(k, r);
      }
    }
    this.dispose();
    return moved;
  }
  dispose() {
    clearTimeout(this.timer); this.timer = null;
    this.warmer?.dispose(); this.warmer = null; this.shell = null; this.job = this.need = null; this.id = null; this.at = null;
  }
}
