# Batch 82 mpperf82: leftover server tick allocations

## Summary
- New `src/mpperf82-fast.js` (`MC_MPPERF82=on|off|verify`, default on; `verify` runs both paths and throws on the first difference). It has no imports.
  1. `nearestView` (mpperf79-fast.js, still under MC_MPPERF79 as well). It reads the mob's x, y, z once per call (unflagged hoist). When on, the pruned scan reads a player's y and z only while the partial sum is below the best distance.
  2. `chunkKeyOf`: `World.chunkAt`'s `${cx},${cz}` key comes from a 4096-slot direct-mapped string cache, int32 pairs only.
  3. `mobSizeObject`: the AI's `mobSize` returns one reused `{ width, height }`. In verify mode the previous answer is set to NaN.
  4. `motionEnter/motionOf/motionRelease`: `moveWith` lends `moveEntityWithHeading` one `e.moveMotion` buffer per nesting depth. It clears the field in the body and in a `finally`.
  5. `noSteps`: `mobStepEvents` returns one frozen `[]` when nothing plays.
  6. `walkLoadedTiles`: piston-live.js `collisionBoxes` walks `RedstoneWorld.loadedTiles` in place instead of the `pistonTiles()` filter copy. A redstone with its own `pistonTiles` keeps the old path.
- Unflagged pure hoists: world.js `isPlant` uses comparisons instead of an array literal per call; mob-steps.js reads each entity field once.
- Call sites:
  - `src/world.js`: one import, the `isPlant` line, the `chunkAt` key.
  - `src/entities.js`: one import, the `moveEntityWithHeading` 7th parameter `motion`, three `moveMotion` stores, the `mobSize` dep, `moveWith`'s try/finally.
  - `src/mob-steps.js`, `src/piston-live.js` (new inner `movingTileBoxes`), `src/mpperf79-fast.js`.
  - `tools/bench-alloc81.mjs` prints `mode82`.
- Added `src/mpperf82-b82.test.js` (8 tests) and a section in `public/research/server-performance.md`. WebSocket compression stays off.

## Evidence
- Executed: `nearestView` stays TurboFan-optimized all run (`%GetOptimizationStatus` sampled every tick). A `process.memoryUsage().heapUsed` bracket round the call gave 1390 bytes per call at HEAD (the same bracket round an empty statement: 21).
- Executed probes inside the server loop: reading only `e.x/y/z` costs about 70 bytes per call; summing `p.x` over the 16 positions costs about 310. Number loads from megamorphic mobs and from the two-map player positions come out as fresh HeapNumbers. That is the "cause unclear" 8% from batch 81. After the change: 465 bytes per call, and 102 -> 3.5 MB in the heap sample.
- Executed heap sampling, travel, 300 ticks: 1293 -> 1161 MB in all.
  - `mobSize` 39.1 -> 17.2 MB, `columnKey` 18.3 -> 0, `mobStepEvents` 12.9 -> 8.0, `pistonTiles` 9.2 -> 3.5 (now `movingTileBoxes` result arrays), `isPlant` 3.0 -> 0, `moveEntityWithHeading` 22.2 -> 16.8.
- Executed timing: four rounds of 5 runs (150 ticks), HEAD from git archive interleaved with the branch, load 6-9.
  - Travel: 4.03-5.32 -> 3.76-4.84 ms/tick; heap growth 2967-2991 -> 2756-2771 KB/tick; GCs 0.24-0.25 -> 0.21-0.22 per tick; GC 0.08-0.11 -> 0.07-0.09 ms/tick.
  - Pen: heap 1055-1058 -> 935-976 KB/tick; GCs 0.07 -> 0.06; wall time within noise.
  - Terrain: heap 1463-1466 -> 1408-1412 KB/tick; wall time within noise.
  - With `MC_MPPERF82=off`, heap matches HEAD.
- Executed `--state` hashes: off, on and verify equal the batch 81 hashes for pen, travel, terrain seeds 1 and 2. They also agree with each other for nether `7bfbd45ea3f43c52 0cd5ccd61ffb1111 81145261c94eff65` and pillar `fa4896a776c7a6c3 ae32ca04d00d2182 c09ffa538e2c4ae7`.
- Reasoning, checked by the tests: the pruned nearest scan is exact because squares are >= 0 (or NaN) and a rounded sum of non-negative terms never falls below its partial sum.
- Port-read, not bytecode: no game rule changed. No 1.7.10 bytecode was read; these are representation-only changes.
- Bug caught by the new test during development: the first key cache stored fractional coordinates truncated in an Int32Array, so a later integer lookup could get "1.5,2". Fixed by caching int32 pairs only.
- Mutation checks (executed): removing the int32 guard fails test 1; flipping the prune comparison fails test 5.

## Verification
- `node --test --test-timeout=600000 src/mpperf82-b82.test.js`: 8 pass, 0 fail.
- 32 neighbour files, `--test-concurrency=2`: 491 pass, 0 fail in default mode, and 491 pass, 0 fail with `MC_MPPERF82=verify`.
  - Files: mpperf77-82, mob-steps, iron-golem, piston-live, mppistons-b66, pistons4-b67, pistons5-b68, ring-pistons, ring-rim-piston, entities, world, world-chunks, world-types, headless-columns, streaming-world, block-collisions, steps71-b71, fishing, ai, pathfinding, fluids, horse-world, villager, crops, stems-cake, spawner-animals, dimension-ticks.
- `npm run build`: passes (the usual chunk-size warning only). No full npm test, no browser checks.

## Follow-ups
- Number loads that box: `ai.js` `get x/y/z` (Brain getters over `this.e`), megamorphic `e.x` reads in mob code.
- Player positions keep two maps. Giving `simulation.js vector` one shared `copy` did not merge them; the other map comes from somewhere else (not found).
- `push`'s `near` array and `pushNear` filter closure, `size()`'s `[w, h]` arrays, the `stepBlock` result object, HeapNumber stores into entity fields.
- Browser-only: the client also runs `moveWith`/`mobStepEvents`/`chunkAt` (same results by test); frame time in the browser was not checked.
