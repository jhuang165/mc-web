// Batch 90 mpperf90: server tick speed (results unchanged). MC_MPPERF90=on (default) | off (reference paths) | verify (both where both can run, throws on the first
// difference); tests set `fast90.mode`. This module imports nothing.
//   1. multiplayer/server-vehicles.js track: the per-view loop runs through Map.forEach (eachView90), not a for-of loop that makes an [id, view] entry array per view.
//   2. push-grid.js FineGrid: the grid of the previous mob loop hands its arrays (entity copy, cell index, candidate buffer, cell lists, answer list) to the next one, so a tick
//      builds no new ones; query answers in a reused list (the push loop that reads it ends before the next query).
//   3. world.js get: a streaming world's block read of an integer cell in the column it read last skips inside() and chunkAt() (the same tests, inline).
//   (entities.js moveEntityBody: its sneak-edge closure moved to a module function, so the function makes no context per call. That is a source change, not a switch.)
export const fast90 = { mode: (typeof process !== "undefined" && process.env?.MC_MPPERF90) || "on" };
export const fail90 = (what) => { throw new Error(`mpperf90 ${what} mismatch`); };

// `fn(view, id)` for each entry of a Map, in the order and with the live semantics of `for (const [id, view] of map)`. Off runs the for-of loop itself.
// The callback cannot `continue`, `break` or `return` from the caller.
export function eachView90(map, fn) {
  if (fast90.mode === "off") { for (const [id, view] of map) fn(view, id); return; }
  map.forEach(fn);
}

// ---- FineGrid recycling ----
// A retired grid's arrays, cleared, for the next one. `spare` is the previous grid (or null).
export function recycleOf90(spare) {
  if (spare === null || spare === undefined || fast90.mode === "off") return null;
  const pool = spare.pool ?? [];
  spare.cells.forEach((c) => { c.length = 0; pool.push(c); });
  return { ents: spare.ents, keyAt: spare.keyAt, buf: spare.buf, out: spare.out ?? [], pool };
}
// verify: the recycled copies equal the list (entities) and the keys the constructor wrote.
export function checkGrid90(g, list) {
  if (g.ents.length !== list.length || g.keyAt.length !== list.length) fail90("grid size");
  for (let i = 0; i < list.length; i++) if (g.ents[i] !== list[i]) fail90("grid entity");
  let n = 0; g.cells.forEach((c) => { n += c.length; });
  let want = 0; for (let i = 0; i < list.length; i++) { const k = g.keyAt[i]; if (k !== -1 && k === k) want++; }
  if (n !== want) fail90("grid cells");
}
