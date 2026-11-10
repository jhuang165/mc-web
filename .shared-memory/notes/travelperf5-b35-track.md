# travelperf5 (batch 35)

## Summary
- Saved-portal pick (goal 1). `TerrainPeek.portalColumns` and `StoredIndex.portalColumns` now list `[x, z, ys]` (ascending y of every portal block in the column; was `[x, z]`). `savedPortalFor` (exit-prewarm.js) picks as `Teleporter.placeInExistingPortal` does: columns in x-then-z order, inside a column from the top down, each portal stack counted at its bottom block, 3D squared distance to (x, y, z) of the target, strict `<` (so ties go to the earlier column, then the higher stack). Evidence: the search code in `dimensions.js` (bytecode-read earlier, ported) was executed: a unit test runs `Teleporter.placeInExistingPortal` on a probe `TerrainPeek` for 60 seeded random worlds (stacks, 4-block grid with many equal distances, portals beyond the 128 box) and compares its cached pick with `savedPortalFor`. A column without `ys` still counts at the target height. The Teleporter's per-column pick cache (`cache`, a repeat teleport to the same column) is not modelled; a wrong prewarm only wastes work.
- Ring light beside the resident window (goal 2). `RingLight.search` asked the block-light spread whenever a resident chunk was in the 3 x 3 (resident chunks answer "may have both"). It now calls `residentReaches`: a direct scan of the resident chunk's blocks inside the 29-cell box round the query, true only when an emitter with `emission > start` and `emission - Manhattan distance > start` exists (a path costs at least 1 per step, so nothing else can raise the value). Exact for the current blocks, no cache that could go stale on edits. Sky handling unchanged (resident chunks still count as "may see the sky"). Test: 2500 random cells beside the window with torches placed in resident edge cells, fast equals plain, with both outcomes (skipped, kept) covered.
- Browser frame times (goal 3): not conclusive, see Verification. Stream worker cap idle measurement and the speculative cell cap (goal 4): not measured; the machine was at load 50-160 for most of the session.

## Verification
Focused tests (final code): `exit-prewarm.test.js` 8 pass (+1), `dimension-live.test.js` 20 pass (expectations now carry `ys`), `ring-light-search.test.js` 3 pass (+1), `headless-columns.test.js` 16 pass, `stored-peek.test.js` 2 pass, `travel-loading.test.js` 9 pass. The full `npm test` and `npm run build` were NOT run by this track (the lead throttled the machine); the lead's final run covers them.

Node benchmark `artifacts/b35-travelperf5/bench-resident.mjs` (surface cells in held columns whose 3 x 3 touches the resident window, min of 7 alternating runs, us per query, result hash identical for plain, old and new; load 6-7):
| seed | cells | plain | batch 34 | now |
|---|---|---|---|---|
| walkperf31 | 1460 | 59.3 | 59.3 | 5.1 |
| a2 | 1460 | 61.8 | 62.2 | 6.8 |

Browser walk (`artifacts/b35-travelperf5/walk.mjs` = the batch 32 script, seed `walkperf31`, 120 blocks toward -x, muted headless Chrome, `headless-columns.js` swapped between A = batch 33 version (84c77c98e), B = batch 34 (HEAD), C = this track). 6 runs completed. The machine load was 48-160 (other tracks, one-minute average at run start), so frame times only show noise: median 16.7 ms and p99 16.8 ms in every run except A-3 (load 160, 10 frames over 50 ms), over-50-ms frames A 0/1/10, B 0/2, C 1 at loads 48 to 160. No difference between A, B and C can be read from this. A pkill of the runner script did not stop it (it was started as `./walkall.sh`), so it ran its remaining rounds; the extra rounds (loads 160) were discarded except those listed; `headless-columns.js` was confirmed byte-equal to the C variant afterward and the tests above were re-run after that.

## Follow-ups (proposed gap lines)
- Frame-time effect of the ring-light changes is still unmeasured in the browser (load 50-160 during batch 35); only the node benchmarks (59 to 5 us beside the window, 102 to 0.55 us for held neighbourhoods) show it.
- The stream worker cap (`ringMax` min(3, cores - 3), `arrivalWarmer` maxWorkers min(3, cores - 2)) has no idle-machine measurement; the Overworld speculative cell cap of 5 was not varied (no evidence gathered).
- Resident chunks still count as "may see the sky" in the ring-light search; cells under a roof beside the window run the sky spread.
- The Teleporter's per-column portal cache is not modelled by the prewarm pick.
