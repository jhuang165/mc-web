# dimperf b28 track (dimension trip performance)

## Summary
- Cause of the Nether long tasks: the Nether/End headless ring generated a column on the page every other tick (40-60 ms each), and the window shift / arrival warm-up also generated Nether columns on the page. The Overworld return waited on three population cells built serially by one worker.
- `streaming-generator.js`: `createStreamWorker({dimension, dimensionSeed})` builds Nether/End columns with `DimensionWorld.netherChunk/endChunk` (same data; fortress records returned and adopted unless materialized). `StreamPrefetch` gains `ringPorts` (dedicated ring workers; `windowPending()` keeps ring requests from blocking window requests).
- `main.js` (2 small hunks): `startPrefetch` runs for dimension worlds and spawns up to 3 ring workers (all dimensions). `headless-columns.js`: `createRing` uses the worker path for dimensions; `units()` returns [] before the ring has a centre (otherwise NaN requests killed the worker).
- `travel-loading.js`: `arrivalWarmer` uses workers for Nether/End columns (page slices only if no worker) and shares large requests over up to 3 workers (`maxWorkers`).
- Overlap: no edits to `dimension-live.js`, `dimension-world.js`, `dimensions.js`, `weather.js`, or the light files. A dimension world change that adds generator state must also be mirrored in `createDimensionWorker`.

## Verification
- `npm test` 4688 pass, 0 fail (3 new: dimension worker columns equal the page's incl. records; ring workers/NaN centre; warmer lanes). `npm run build` ok.
- Muted headless Chrome (`artifacts/b28-dimperf/trip.mjs`, results `before*.json`, `after*.json`, profiles `*.cpuprofile`, `prof.mjs` summariser). Before/after table is in `public/research/loading-screens.md` "Batch 28": Nether tasks over 50 ms 53 -> 1-4 (max 164 -> 61-85 ms); Nether ring 44 s -> 8-10 s; End ring 44 s -> 6.5-7 s; Overworld return 8.1 s -> 4.5-6.9 s; Overworld ring 10.6-12.6 s -> 3.5-5.7 s.

## Follow-ups
- Proposed gap line: "An End-to-Overworld return sometimes shows a 1-3 s train of 70-170 ms tasks once the ring is complete (spawn-side ring reads: canLightningStrikeAt, RingLight heightAt/search); present before batch 28."
- Light builds were not the main cost here (not moved to a worker); the arrival `launch` (meshes, light) still has 50-100 ms tasks.
- Up to 4-5 workers now exist per played world (memory not measured).
