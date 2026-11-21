# Batch 90 mpperf90: vehicle view loop, FineGrid arrays, moveEntityBody context, world.get fast path

## Summary
- New `src/mpperf90-fast.js` with `MC_MPPERF90=on|off|verify` (default on; no imports). `tools/bench-alloc81.mjs` prints `mode90` after `mode89`.
- `multiplayer/server-vehicles.js` track: the per-view `for (const [id, view] of this.views)` loop runs through `eachView90` (Map.forEach; off runs the for-of). The body's one `continue` became `return`; the inner `continue` is untouched. Two lines changed, the body is as it was.
- `push-grid.js` FineGrid: the grid a mob loop ends with (`spare`, taken at begin/endPushGrid) hands its entity copy, `keyAt`, Int32 buffer, emptied cell lists and answer list to the next grid. `query` answers in that reused list (the single push loop that reads it ends before the next query). Verify checks the recycled copies against the list (`checkGrid90`) and pushNear's own verify compares with the full scan.
- `world.js` `get`: streaming world, integer cell in the last-read column: inside() and chunkAt()'s first test inline. Anything else calls the old body (`get90Reference`). Verify compares both.
- `entities.js` moveEntityBody: the sneak-edge closure moved to `sneakAdjust90`, so moveEntityBody makes no function context per call. This is a source change; it cannot sit behind a run-time switch (V8 makes the context at entry whatever branch runs), so MC_MPPERF90=off still has it. Same arithmetic and call order.
- Old tests: the four `mode89=... mobs=` regexes (mpperf86..89 tests) now allow `mode90=` after mode89.

## Evidence
- Executed: `node --expose-gc tools/bench-alloc81.mjs --scene=X --runs=3 --ticks=150`, off/on alternated, two pairs, load 6-10 (noisy).

  | Scene | heap KB/tick off -> on | ms/tick off -> on |
  |---|---|---|
  | travel | 1577 -> 1527, 1595 -> 1539 (-3.4%) | 4.14 -> 3.83, 4.70 -> 4.12 |
  | terrain | 789 -> 777, 787 -> 778 (-1.3%) | 3.02 -> 3.08, 2.83 -> 2.95 (noise) |
  | pen | 560 -> 534, 561 -> 532 (-5%) | 0.99 -> 1.08, 1.17 -> 1.16 (noise) |

  Before-everything baseline (no b90 code): travel 1589 KB / 3.93 ms, terrain 801 / 2.56, pen 587 / 0.98. Tick times are inside noise; not a claimed speed-up.
- Executed heap profile before (travel, MB per 150 ticks): mobTargetAt88 10.7, moveEntityBody 7.0, FineGrid 6.7, `push` builtin 7.4, `next` 8.1.
- Executed `--state` hashes, 150 ticks, identical in off, on and verify (verify with MC_MPPERF83..89 verify too): travel `7668a58130c946a2,eabd4792df21d0ee,3c1e7bad89653e83`; terrain `84059172eab75e80,1f4ca33a0af07dcd,e1ac65b45726b9c6`; pen `881d5b183faaeb76,299f5b68c2b695ca,a0f2782811dd9f8b`. (Differ from the b89 note: base moved.)
- Port-read: no game rule changed.

## Verification
- `node --test src/mpperf90-b90.test.js`: 6 pass / 0 fail (eachView90 vs for-of with live edits; FineGrid recycled vs fresh across loops, a length change and wide entities; recycling takes and clears arrays; world.get off/on/verify; seeded 4-player vehicle scene packet hash; bench state hashes incl. travel and bench-server-mobs). Mutation check (executed): not clearing the recycled cell lists fails 4 of 6.
- Neighbour tests (85 files: mpperf*, push, vehicle, boat, cart, tracker, world*, multiplayer, mplos, legacy-body, eye-height, simulation-replay), concurrency 2: 1092 pass / 0 fail.
- MC_MPPERF90=verify over 10 files (mpperf89, 78, pushgrid75, mpvehicles x2, mpboat84, multiplayer, world, mobpush, tracker83): 105 pass / 0 fail. MC_MPPERF90=off over 3 files: 18 pass.
- `npm run build` once, passes. No full npm test, no browser.

## Follow-ups
- Not changed: tickMobs field reads (megamorphic `e.field` over lazily added keys; unifying shapes changes keys/saves), and mobTargetAt88's per-move box (10.7 MB per 150 travel ticks, the largest allocator left): reusing the box in place would alias any holder of an earlier target record across ticks; not proven safe.
- Other remaining allocators: blockBoxesFast boxes, watchedAttributes, moveSpeedModifiers, pathfinding finder/Path.
- Browser-only: single-player frame time (the browser runs the same world.get and moveEntityBody).
