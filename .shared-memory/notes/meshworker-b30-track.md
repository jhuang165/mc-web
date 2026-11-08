# Batch 30 meshworker track

## Summary
- Column meshing moved off the page thread: `src/chunk-mesher.js` (mesh code from scene.js, `ChunkMesher`), `src/mesh-region.js` (20 x 20 column snapshot and the worker-side source), `src/mesh-worker.js`, `src/mesh-pool.js` (up to min(3, cores - 2) workers). `?meshWorkers=0` or no `Worker` = page-thread fallback.
- scene.js: dirty set with global stamps, `buildPendingAsync`, `pumpDirty` (replaces the 2 sync builds per frame), `installChunk`, `setMeshPool`, `warmShaders`. Single-block live edits keep the sync `buildChunk` path (immediate).
- main.js (small hunks): MeshPool import, `scene.setMeshPool(new MeshPool())` after `new VoxelScene`, `buildPendingAsync` in `launch`, `warmShaders()` started before and awaited after it. biome-colors.js: `colormaps()` export so workers get the grass/foliage maps.
- Anaglyph: `meshAnaglyph.on` is passed in the job; anaglyph.js untouched. Light modules untouched (read through `LightVolume` fields).
- Bug fixed: `endFrame` mesh method was shadowed by `VoxelScene.endFrame`, so End portal frames never meshed; renamed `endFrameBlock`.
- End shader warm-up: `renderer.compileAsync` during the loading screen removes the ~55 ms task at the end of the End arrival.

## Verification
- `npm test`: 4780 pass, 0 fail. `npm run build` ok. `mesh-worker.test.js` (3 tests): byte identity of worker path vs page mesher.
- Chrome: 64 columns, 0 differing values; before/after screenshots in artifacts/b30-meshworker (identity-*.png).
- Trips (load average 45-80): Nether 3.4-3.6 s to 1.9 s; Overworld return 5.5 to 2.7 s; End 1.6-1.8 to 1.35 s; second return 2.0-2.2 to 0.8-0.9 s. Walking frames over 50 ms 72/63 to 40/44.
- Teleporter second window fetch: 1.9 s in one of three instrumented returns, 1 ms in the others; cell known only after the search; not fixed.

## Follow-ups
- Proposed gap lines (remaining-gaps.md not edited): "Walking still has 40 frames over 50 ms per 120 blocks (streaming, lighting, entity work), not meshing." and "Teleporter arrival in a different population cell than the target costs a second window fetch (about 1.9 s)."
- Worker count cap of 3 chosen under heavy load; re-measure on an idle machine.
