// Batch 101 mpperf101: server tick allocation (results unchanged). MC_MPPERF101=on (default) | off (the b100 code) | verify (both where a comparison is cheap, throws on a difference); tests set `fast101.mode`.
// Attribution (heap sampling, travel, 150 ticks): FineGrid 5.75 MB (every tick's `c.length = 0` on a cell list drops its backing store, so each occupied cell regrows one per tick),
// `push` inside tickMobs 2.1 MB (the order arrays of EntityWorld.withBalls: others / keyed pairs / out, and the entities copy).
//   1. push-grid.js FineGrid: when the retired grid held the same entities (b93's kept Maps), its cell lists are NOT emptied; an entity whose cell key changed is moved between lists
//      (queries sort the indices, so a cell's internal order never matters). The cell lists keep their backing arrays.
//   2. entities.js tickMobs: the entities copy, withBalls' `others` / `keyed` rows / `out` are kept per world and refilled (the order array is dead when the pass ends: tickOrder = null).
// This module imports nothing.
export const fast101 = { mode: (typeof process !== "undefined" && process.env?.MC_MPPERF101) || "on" };
export const fail101 = (what) => { throw new Error(`mpperf101 ${what} mismatch`); };

// verify (FineGrid): every cell holds exactly the indices a fresh scan would file under it (as sets), and keyAt agrees.
export function checkCells101(g, list) {
  const want = new Map();
  for (let i = 0; i < list.length; i++) { const k = g.keyAt[i]; if (k === -1 || k !== k) continue; let a = want.get(k); if (!a) want.set(k, (a = [])); a.push(i); }
  let seen = 0;
  g.cells.forEach((c, k) => {
    const w = want.get(k) ?? [];
    if (c.length !== w.length) fail101("grid cell size");
    for (const i of w) if (!c.includes(i)) fail101("grid cell member");
    seen += c.length;
  });
  let total = 0; want.forEach((a) => { total += a.length; });
  if (seen !== total) fail101("grid cell total");
  for (let i = 0; i < list.length; i++) {
    const o = list[i], big = !(g.halfOf(o) <= 3), k = big ? -1 : (Number.isFinite(o?.x) && Number.isFinite(o.z) ? Math.floor(o.x / 2) * 1048576 + Math.floor(o.z / 2) : NaN);
    if (!(Object.is(k, g.keyAt[i]) || (k === g.keyAt[i]))) fail101("grid key");
  }
}
