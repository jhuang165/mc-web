# ringlight b29 track (ring column light, return task train, server vs client light)

## Summary
- `src/ring-light.js`: `computeColumnLight` lights a held ring column whole from its 3 x 3 chunk neighbourhood (sky seeds at height-map steps and above each column top, emitters, value spread with the computeLightValue rule). Same fixed point as the resident volume, so a column's light does not change when the window reaches it. `RingLight` (headless-columns.js) uses it for a column asked 6 times, only when all eight neighbours are resident/held, at most 2 a tick; cold, rim and no-sky-skip cases keep the per-cell search (now stamped grid, no per-call allocation).
- Per-column caches (`HeadlessColumns.state`): height map, precipitation height, bulk light. Dropped for the column and its 8 neighbours on edit, arrival, adoption, hydration, prune and window move. State lives in a side map, not on the column objects.
- `weather.js` (dimrules2's file, three one-line hooks): `precipitationHeight` and `canSeeSky` read the ring caches for held columns; `canLightningStrikeAt` returns false first when not raining (it evaluated every column read and biome lookup every call, from `isWet` per mob per tick).
- light-engine.md "Batch 29" documents the server-vs-client light bytecode read (client never calls `apx.b(Z)`, so no recheckGaps or light population; chunk packet carries light; setBlock path identical). Predicted visible effect not executed, not ported.

## Verification
- `npm test` 4744 pass, 0 fail; `npm run build` ok. New `src/ring-light.test.js` (3): bulk vs StreamingLight 115,200 cells fresh and edited (dropping invalidation fails it); night spawning under roofs/canopies/torches identical for bulk, search and all-resident; cold-rain ice/snow beside torches identical (the ice/snow test did not fail when I removed invalidation, so it is weaker evidence than the first test).
- Muted headless Chrome (`artifacts/b29-ringlight/ret.mjs`, results `before*.json`, `after*.json`, profiles `*.cpuprofile`, `prof.mjs`, `callers.mjs`): New world, then End -> Overworld returns, 35 s of long tasks after arrival. Machine load from other tracks varied (load average 180 to 5), so runs are noisy.
  - Before (11 valid returns, two sessions): 5 returns with 5+ tasks over 50 ms (up to 88 tasks, max 366 ms), summed 28.6 s of such tasks.
  - After (12 returns, two sessions): 4 returns with 5+ tasks (15, 11, 7, 17 tasks), max 193 ms, summed 4.3 s.
  - Profile (whole 40 s): `canLightningStrikeAt` via mob `wet` 3.2 s before, 1.2 s after the cache hooks (the not-raining early return came after that profile and was not profiled). The remaining train in one profiled return (7.0 to 7.8 s) is window meshing/relight (`cube`, `smoothFace`, `relightSteps`), not ring reads. Return 5 of the first "before" run lost its ring (ring 0) and is excluded.
  - The train is reduced, not removed.

## Follow-ups
- Proposed gap lines: (1) "Ring rim columns (fewer than eight held neighbours) are lit against air, brighter than native within 14 blocks of the held area's rim; bulk light for ring columns replaces the per-cell search only for interior columns." (2) "Rendered light follows the server model (recheckGaps ticks); native client never runs Chunk.func_150804_b, so sky light beside height-map edits can differ (bytecode-read, not executed; needs a second NativeLight and a probe)." (3) "An End-to-Overworld return can still show a short train of 50-190 ms tasks (window mesh and relight at arrival, dimperf2's area)."
- Edits to resident cells beside a ring column invalidate its light only when the window moves (a `blockTap` hook would fix it).
- A probe over unchanged `ahb`/`apx` with a client and a server world would size the client/server difference before porting.
