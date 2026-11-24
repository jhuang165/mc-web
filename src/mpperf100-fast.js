// Batch 100 mpperf100: server tick allocation (results unchanged). MC_MPPERF100=on (default) | off (the b99 code) | verify (both where a comparison is cheap, throws on a difference); tests set `fast100.mode`.
// Attribution (heap sampling, travel, 150 ticks): `step` of server-portal-travel.js 4.5 MB (a mobLinks pair and a tick options object per entity per tick), `plain`/`track` pushes 3.7 MB
// (per tick: two Maps, per view a row object and two arrays grown by push), bow.js pickupCandidates 3.4 MB (a box array per arrow, twice, per player per tick).
//   1. entity-portal.js `step`: PortalState.tick gets one module scratch options object (destructured on entry, never kept); server-portal-travel.js reads the riding / ridden flags without a mobLinks pair.
//   2. server-mobs.js `track`: the byWatcher / outs Maps, each view's { out, later } row and the out / destroys arrays are kept and reused (a view's destroys array swaps with its spare each tick).
//   3. bow.js `pickupCandidates`: the trigger box is read into locals and an arrow's box is built only for a candidate (the same arithmetic).
// This module imports nothing.
export const fast100 = { mode: (typeof process !== "undefined" && process.env?.MC_MPPERF100) || "on" };
export const fail100 = (what) => { throw new Error(`mpperf100 ${what} mismatch`); };
