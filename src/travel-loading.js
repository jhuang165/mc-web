// Portal and dimension trips behind native loading screens, with their heavy work spread over frames. Natively
// NetHandlerPlayClient.handleRespawn (bytecode-read) calls Minecraft.loadWorld(world, "") - a blank LoadingScreenRenderer frame,
// LoadingScreenRenderer.displayProgressMessage("") and resetProgresAndWorkingMessage("") - and then shows GuiDownloadTerrain when the
// dimension changed. public/research/loading-screens.md has the evidence.
import { LoadingState } from "./loading-screen.js";
import { StreamPrefetch } from "./streaming-generator.js";
import { CELL } from "./streaming-population.js";

// The state of that blank frame: empty title, empty message, no bar.
export function blankLoading() {
  const state = new LoadingState();
  state.displayProgressMessage("");
  state.resetProgressAndWorkingMessage("");
  return state;
}

const WINDOW = 8; // chunks per axis of the resident square (World.streamAround)
const chunkRange = (world, x, z) => { const { minX, minZ } = world.windowAt(x, z); return [minX / 16, minZ / 16]; };

// Builds the terrain a trip will read, ahead of the synchronous code that reads it (the Teleporter's portal-site scan and
// World.streamAround), in slices or in a worker, so those calls find it ready and generate nothing on the page thread:
//  - worlds with a worker generator (the Overworld: population cells, or terrain columns below generation 13) ask a
//    StreamPrefetch worker for the missing units and wait; a worker that is missing or fails leaves the units to the old
//    synchronous generation (identical results: columns are a pure function of the seed);
//  - Nether/End worlds (`noPrefetch`) ask the same worker for the columns since batch 28; without a worker they generate on the page one at a time into `pregenerated`, where
//    generateTerrainChunk finds them, pausing between slices.
// Either way World.streamAround then runs the same code on the same column data.
export function arrivalWarmer(world, { pause, createWorker = () => new Worker(new URL("./streaming-worker.js", import.meta.url), { type: "module" }), timeoutMs = 120000, now = () => performance.now(), budgetMs = 12, maxWorkers = Math.max(1, Math.min(3, (globalThis.navigator?.hardwareConcurrency ?? 4) - 2)) } = {}) {
  let prefetch = null, broken = false;
  const spares = []; // extra workers that share a big request (batch 28: three population cells took 5.1 s on one worker)
  const missing = (cx, cz) => !world.chunks.has(`${cx},${cz}`) && !world.baseColumns?.has?.(`${cx},${cz}`);
  const open = () => {
    if (prefetch || broken) return prefetch;
    try { prefetch = new StreamPrefetch(world, createWorker(), { margin: 0 }); } catch (e) { broken = true; console.warn(`arrival: no worker, generating on the page thread: ${e.message}`); }
    return prefetch;
  };
  const withTimeout = (p) => { let t; return Promise.race([p, new Promise((r) => { t = setTimeout(r, timeoutMs); })]).finally(() => clearTimeout(t)); };
  // `extra` (batch 32): chunks a later window may need (the exits a portal can be built at). Their units ride along with the units that
  // are needed, one per spare lane at most and nearest `at` first, so a window round the exit finds them held instead of asking again.
  async function chunks(list, extra = [], at = null) { // [[cx, cz]...] local chunk coordinates
    const need = list.filter(([cx, cz]) => missing(cx, cz)), spec = extra.filter(([cx, cz]) => missing(cx, cz));
    if (!need.length && !spec.length || !world.streaming) return 0;
    // Nether/End columns come from the worker too (DimensionWorld there builds the same column); only a missing worker keeps the page slices.
    const pf = typeof Worker === "function" ? open() : null;
    if (world.noPrefetch && (!pf || pf.failed)) {
      let end = now() + budgetMs, built = 0;
      for (const [cx, cz] of need) {
        const k = `${cx},${cz}`;
        if (world.pregenerated.has(k)) continue;
        world.pregenerated.set(k, world.generateTerrainChunk(cx, cz)); built++;
        if (now() >= end) { await pause(); end = now() + budgetMs; }
      }
      return built;
    }
    if (!pf || pf.failed) return 0;
    const units = new Map();
    const unitOf = ([cx, cz]) => (pf.cells ? [Math.floor(cx / CELL), Math.floor(cz / CELL)] : [cx, cz]);
    for (const c of need) { const u = unitOf(c); units.set(u.join(","), u); }
    if (spec.length && at) {
      const more = new Map(), centre = (u) => (pf.cells ? [(u[0] + 0.5) * CELL * 16, (u[1] + 0.5) * CELL * 16] : [(u[0] + 0.5) * 16, (u[1] + 0.5) * 16]);
      for (const c of spec) { const u = unitOf(c), k = u.join(","); if (!units.has(k)) more.set(k, u); }
      const room = Math.max(0, maxWorkers - units.size), dist = (u) => { const [a, b] = centre(u); return (a - at[0]) ** 2 + (b - at[1]) ** 2; };
      for (const [k, u] of [...more].sort((a, b) => dist(a[1]) - dist(b[1])).slice(0, room)) units.set(k, u);
    }
    if (!units.size) return 0;
    const all = [...units.values()], lanes = [pf];
    for (let i = 1; i < Math.min(maxWorkers, all.length); i++) {
      if (!spares[i - 1]) { try { spares[i - 1] = new StreamPrefetch(world, createWorker(), { margin: 0 }); } catch { break; } }
      lanes.push(spares[i - 1]);
    }
    await withTimeout(Promise.all(lanes.map((lane, i) => lane.whenHas(all.filter((_, j) => j % lanes.length === i)))));
    return units.size;
  }
  return {
    // The resident square World.streamAround(x, z) would build.
    // `spread` (blocks, default 0): the windows round every spot within that distance also count as wanted, behind the needed ones (see chunks).
    window(x, z, spread = 0) {
      if (!Number.isFinite(x) || !Number.isFinite(z) || !world.streaming) return Promise.resolve(0);
      const square = (px, pz, into) => { const [c0, d0] = chunkRange(world, px, pz); for (let cx = c0; cx < c0 + WINDOW; cx++) for (let cz = d0; cz < d0 + WINDOW; cz++) into.push([cx, cz]); return into; };
      const list = square(x, z, []), extra = [];
      if (spread > 0) for (let px = Math.floor((x - spread) / 16); px <= Math.floor((x + spread) / 16); px++) for (let pz = Math.floor((z - spread) / 16); pz <= Math.floor((z + spread) / 16); pz++) square(px * 16, pz * 16, extra);
      return chunks(list, extra, [x, z]);
    },
    // Single block columns (portal candidates the Teleporter will read).
    columns(points) { return chunks(points.map(([x, z]) => [Math.floor(x / 16), Math.floor(z / 16)])); },
    dispose() { prefetch?.dispose(); prefetch = null; for (const p of spares.splice(0)) p.dispose(); },
  };
}
