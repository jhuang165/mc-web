# dimperf2 b29 track (arrival launch, Overworld return, workers)

## Summary
- Return phases measured with `performance.mark('trip:*')` hunks in `main.js` (openWorld/launch): spawn cell wait 1.1-1.9 s, Teleporter plus window cells 1.3 s, light 0.15 s, meshes 1.5-1.8 s (about 22 ms per column, CPU-bound).
- `main.js` launch: `presolveWorld({...root, dimension: 0})` once a dimension world launches (>= 4 cores) so the Overworld spawn cell is parked before a return; the mesh and light loops and the arrival pauses use `taskPause()` (`steps.js`, MessageChannel task, a real frame every 100 ms) instead of `nextPaint`/`nextFrame`; resident columns' `sectionTickCount` is counted in 8 ms slices at the end of launch (it cost 20-40 ms in the first tick). Hunks in `main.js` are small (marks, three call swaps, two inserted blocks, `startPrefetch`).
- `streaming-generator.js`: `StreamPrefetch({ringSpawn, ringMax})` makes ring workers up front, ends them after `RING_IDLE_TICKS` (100) updates once `ring.units()` is empty, makes them again after 3 updates of unserved units. `startPrefetch` passes `ringMax = clamp(hardwareConcurrency - 3, 0, 3)` (was `max(1, ...)`). Workers once the ring is full: 4 -> 1 (JS heap 44-57 MB -> 11-12 MB).
- No edits to `dimension-live.js`, `weather.js`, `headless-columns.js`, `headless-env.js` or light files; `travel-loading.js` unchanged (a speculative neighbour-window prefetch there made returns 4.5 s slower and was reverted).
- Results (3 runs each, `public/research/loading-screens.md` "Batch 29"): Overworld return from the Nether 3.8-4.6 -> 2.2-2.6 s, from the End 2.8-3.3 -> 1.1-1.4 s, Nether trip 2.2-2.8 -> 1.75-1.9 s; arrival tasks over 50 ms 0-1 (max 56); rings and Nether/End ring-fill times unchanged.

## Verification
- `npm test` 4744 pass, 0 fail (3 new: ring workers up front/ended/remade, ringMax 0, `taskPause`). `npm run build` ok.
- Muted headless Chrome (`artifacts/b29-dimperf2/`: `trip.mjs`, `table.mjs`, `sum.mjs`, `busy.mjs`, `mem.mjs`, `prodlong.mjs`, `trainhunt.mjs`; `base*.json` baseline on a clean copy, `run1/`, `run2/` earlier iterations). Vite 5296, baseline 5396, `vite preview` 5298. Machine load varied (7 to 100 from other tracks); the table runs were at load 7-18.
- Production check: three `vite preview` runs of a new world showed no task over 140 ms after start-up; the 1.1 s task is consistent with dev-server optimisation or HMR, not reproduced in about 40 dev loads.
- Ports 5297 and 5298 were held by other tracks' servers at times; the first baseline attempt on 5297 hit someone else's server and was discarded.

## Follow-ups
- Ringlight owns the post-return task train (`HeadlessColumns.search`/`heightAt`, `canLightningStrikeAt` with biome-layer `getInts`): 60-200 ms tasks for 1-8 s once the ring is complete, seen in about half of End returns and once on a new world; here the worst run had 70 tasks.
- Proposed gap lines: "Column meshing (22 ms per column) runs on the page thread; a return still spends 1.1-1.5 s meshing the 64 arrival columns." "A Teleporter result in another population cell costs a second 1.3 s window fetch on Overworld returns." "End arrival: first-frame shader compile (`getProgramInfoLog`, 100-140 ms task) is not warmed."
- Worker memory counts JS heap only; thread/isolate overhead of the ring workers is unmeasured.
- Ideas not done: start the arrival window prefetch while the player stands in the portal (needs a `dimension-live.js` hook), mesh in a worker.
