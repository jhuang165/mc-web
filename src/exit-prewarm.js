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

// NETHER_SPECULATIVE: extra Nether columns asked for behind the target's 8 x 8 window (batch 34): the windows round every spot within 18 blocks of the target
// (where makePortal may build the exit) union to at most 10 x 10 columns, so up to 36 more; a column is about 33 KB (blocks and metadata), so at most about 1.2 MB held.
const IDLE_MS = 30000, RESIDENT_CELLS = 9, SPECULATIVE_CELLS = 5, NETHER_SPECULATIVE = 40, MOVED = 6;
const SEARCH = 128; // Teleporter.placeInExistingPortal: the saved portals searched are the columns within 128 blocks of the target on both axes

// The portal Teleporter.placeInExistingPortal would pick from `columns` ([x, z, ys] of every saved portal column, sorted by x then z as TerrainPeek.portalColumns
// lists them, `ys` the ascending y of its portal blocks): the search (dimensions.js, ahp.b) visits the columns in that order and, in each, scans y from the top
// down, drops to the bottom block of every portal stack it meets, and keeps the first stack with the strictly smallest 3D distance (to the block centre) from
// the target (x, y, z). So a tie goes to the earlier column, and inside a column to the higher stack. A column without `ys` counts at the target's height.
// `cached` ({ x, y, z } of the Teleporter's destinationCoordinateCache entry for the target's column, a repeat trip): placeInExistingPortal uses it without any search
// (and without checking that the portal still stands), so it is the pick.
// Returns [x + 0.5, z + 0.5] or null.
export function savedPortalFor(columns, tt, cached = null) {
  if (cached) return [cached.x + 0.5, cached.z + 0.5];
  if (!columns?.length) return null;
  const lx = Math.floor(tt.x), lz = Math.floor(tt.z), ty = Number.isFinite(tt.y) ? tt.y : 0;
  let best = Infinity, at = null;
  for (const [x, z, ys] of columns) {
    if (x < lx - SEARCH || x > lx + SEARCH || z < lz - SEARCH || z > lz + SEARCH) continue;
    const dh = (x + 0.5 - tt.x) ** 2 + (z + 0.5 - tt.z) ** 2;
    if (!ys?.length) { if (dh < best) { best = dh; at = [x + 0.5, z + 0.5]; } continue; }
    for (let i = ys.length - 1; i >= 0; i--) { // top down; a stack's bottom is the block whose predecessor is not a portal block
      if (i > 0 && ys[i - 1] === ys[i] - 1) continue;
      const d = dh + (ys[i] + 0.5 - ty) ** 2;
      if (d < best) { best = d; at = [x + 0.5, z + 0.5]; }
    }
  }
  return at;
} // MOVED: blocks the target must shift before the wanted units are asked again

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
  // `portals`: the saved portal columns of the destination (batch 34): when one is within the Teleporter's search range the exit is that portal, so the
  // windows are asked for round it instead of round the target.
  start(root, to, tt, portals = null, cached = null) {
    if (!root || !tt || !Number.isFinite(tt.x) || !Number.isFinite(tt.z)) return false;
    const saved = savedPortalFor(portals, tt, cached), focus = saved ?? [tt.x, tt.z];
    const id = `${root.id}:${to}`;
    if (this.id === id && this.at && Math.hypot(focus[0] - this.at[0], focus[1] - this.at[1]) < MOVED) return true;
    if (this.id !== id) { this.dispose(); try { this.shell = this.makeShell(root, to); } catch (e) { console.warn(`exit prewarm: no shell: ${e.message}`); this.shell = null; } if (!this.shell) return false; this.id = id; this.warmer = arrivalWarmer(this.shell, { pause: null, pageFallback: false, specMax: to === OVERWORLD ? SPECULATIVE_CELLS : NETHER_SPECULATIVE, createWorker: this.createWorker, ...(this.maxWorkers ? { maxWorkers: this.maxWorkers } : {}) }); }
    this.at = focus; this.requests++; this.saved = !!saved;
    // The target's own window first (`need`, all a trip waits for), then the windows round the spots an exit may be built at (`job`, speculative; the
    // lanes are separate prefetchers, so the second request must not repeat a unit the first has in flight).
    const prior = this.job, warmer = this.warmer;
    this.need = Promise.resolve(prior).then(() => warmer.window(focus[0], focus[1], 0)).catch(() => {});
    this.job = this.need.then(() => warmer.window(focus[0], focus[1], 18)).catch(() => {});
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
