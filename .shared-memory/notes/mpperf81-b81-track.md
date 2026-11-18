# Batch 81 mpperf81: server tick allocations in moveEntity and blockBoxes

## Summary
- `src/mpperf81-fast.js` (`MC_MPPERF81=on|off|verify`, default on; `verify` runs both paths and throws on the first difference): (1) `cellBoxesOf`, the per-id table of cell boxes for ids whose `world.js collisionBoxes` answer depends on nothing but the cell's id (probed on a Proxy world that flags every other read, at two positions; brewing stand 134 excluded for its collision-pass side effect). (2) `blockBoxes81`, the mpperf79 scan with those boxes pushed from a reused `BoxPool`; a world with a custom `solid` uses `blockBoxes79`. (3) `MoveScratch` for the outermost `moveEntity` (box, start, step-up, query box, box list; nested moves allocate as before; released in `finally`), `growInto` instead of the `grow` closure, the private kept box updated in place. (4) `dryBox` (no water cell in the water box: no reference call, `addVelocity(e,0,0,0)` kept), `lavaIn`, `burningIn` (direct cell scans). (5) `moveRecord`: per-(EntityWorld, mob) hooks and step-option objects reused.
- Call swaps: `src/entities.js` (`collisionBoxes`, `moveEntity` -> wrapper + `moveEntityBody`, `inWater`, two mob burn `inLava` calls, `moveHooks`/`moveSteps`/`moveWith`, unflagged hoist of `slip`/`climbable` to `slipOf`/`climbableOf`), `src/block-collisions.js` (`burningIn`), `src/mpperf80-fast.js` (`originalIdOf` without its per-call closure, unflagged).
- `tools/bench-alloc81.mjs` (pen, travel, pillar, nether, terrain; ms, cpu, GC count/ms, heap growth per tick; `--state` hashes; `--cpuprof`/`--heapprof`), `src/mpperf81-scene.js` (mixed-terrain pen), `src/mpperf81-b81.test.js` (5 tests), section in `public/research/server-performance.md`.
- Collision results unchanged; WebSocket compression stays off.

## Evidence
- Executed: heap sampling (GC'd objects kept, `--no-turbo-inlining`) in travel (16 spread / 300 mobs) at HEAD: `moveWith` 32% of sampled bytes inclusive, `moveEntity` 18.7% (282 MB / 300 ticks); after 88 MB. GC about 4.3% of CPU self time at HEAD.
- Executed (5 runs, median, 150 ticks, load 6-7, seeded): pen 200 cows 1.18 -> 0.92 ms/tick, heap growth 1817 -> 1056 KB/tick, GCs 0.13 -> 0.07/tick, GC 0.06 -> 0.02 ms/tick. Travel 4.58 -> 4.20 ms/tick (cpu 6.10 -> 6.18, noise), 3439 -> 2975 KB/tick, GCs 0.33 -> 0.24, GC 0.15 -> 0.09 ms. Terrain 120 mobs 2.54 -> 2.48 ms/tick, 1972 -> 1462 KB/tick, GCs 0.15 -> 0.10, GC 0.04 -> 0.03 ms. Heap and GC drops repeat at load 20; wall time there is inside noise.
- Executed (`--state`): equal hashes for the HEAD source (git archive), off, on, verify: pen `489bc3e3417df182 72fe14a16db70b30 387cc093e81563d1`, travel `71519279c26377ef 03fd6b2dbb7333f2 bba57a68a0e9c14a`, terrain seed 1 `b65a25ddfad29f92 f0407712ef1ea9e3 6f40930020de6983`, seed 2 `c44f3e86f6c1b1cf 5e9d911c70dc3a6c 7f2d0f07ec428ce4`.
- Port-read (from the existing JS ports, not bytecode): `growInto` is the addCoord arithmetic of the old closure; `dryBox`/`lavaIn`/`burningIn` reproduce `entityWaterBox`/`entityLavaBox`/`contract(0.001)` and the cell loops of `fluids.js`/`fire.js`; a non-wet `waterAcceleration` returns push `[0,0,0]`. No new 1.7.10 bytecode was read.
- Executed mutation checks: weakening the box-edge comparisons or leaving a stale kept-box height makes `mpperf81-b81.test.js` fail (both caught, sources restored).

## Verification
- `node --test --test-timeout=600000 src/mpperf81-b81.test.js`: 5 pass, 0 fail.
- 25 neighbour files (block-collisions, mpperf77-81, mob-steps, steps71-b71, pathfinding, entities, fluids, fire, webs, lava, ladders, player-movement, player-step, piston-live, headless-columns, suffocation, falling-damage, slime-world, spider, horse-world, explosion), `--test-concurrency=2`: 446 pass, 0 fail in default mode and 446 pass, 0 fail with `MC_MPPERF81=verify`.
- `npm run build`: ok. No full npm test, no browser checks.

## Follow-ups
- Remaining sampled allocation in travel: `nearestView`/`target` (about 8%, cause unclear, maybe HeapNumber boxing or sampling artefact), `isPlant` array literal in `world.js solidBlock` (about 26 MB / 300 ticks), `columnKey` strings in `World.chunkAt`, `mobSize` spreads, `pistonTiles` arrays, `e.moveMotion` arrays, `mobStepEvents` `[]` returns, HeapNumber entity fields.
- Unguarded edge: a nested move of the same entity inside its own hook would overwrite its move record's `t`/`from` (no such call exists).
- Browser-only: the client also runs `moveEntity` (same results by test); feel and frame time in the browser were not checked.
