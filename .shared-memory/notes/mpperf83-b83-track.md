# Batch 83 mpperf83: BigInt draws, tickMobs' type object, push box, pickup and target lists, player vector maps

## Summary
- New `src/mpperf83-fast.js` (`MC_MPPERF83=on|off|verify`, default on; `verify` runs both paths and throws on the first difference). It has no imports.
  1. `lcgNext`: `JavaRandom` keeps its 48-bit seed as two 24-bit numbers (`hi`, `lo`) and steps them exactly. `seed` is still a BigInt to every reader and writer (an accessor, masked to 48 bits on write; the draws match the BigInt step for any written value). `lcgBig` is the old BigInt step (the off path).
  2. `typeSize`: tickMobs' `t` and the AI's `moveWithHeading` type object, one frozen `{ ...base, width, height }` per (ENTITY_TYPES entry, scale). A write into it would throw. Verify compares it field by field with a fresh spread. -0 and non-number scales are built fresh; each entry's cache is capped at 256 scales (a growing foal).
  3. `pushNearBox` / `pushNearDone`: `push`'s grown box in one reused array (a push inside a push, or one after an exception, gets a fresh array). `meetsArg`: the grid's `meets` closure is made only when MC_MPPERF78 verifies (the only reader).
  4. `fineSorted`: push-grid.js `FineGrid.query` insertion-sorts short candidate index lists in place (n <= 48; the indices are distinct, so the order is the typed-array sort's). `add` became a method, so there is no closure per query.
  5. `pickupHits`: item-entities.js `pickupCandidates` computes the box bounds in place and makes an entry only for a hit. A subclass with its own `box` keeps the old loop (`pickupCandidatesReference`).
  6. `mobTargetList`: projectiles.js `mobTargets` builds its list with a loop instead of `flatMap` (it still skips holes).
  7. `vectorOf`: simulation.js `vector` builds a plain `{x, y, z}` (or `{x, y, z, copy}`) record as one literal with a shared `copy`. Anything else (extra keys, other key order, getters, class instances) keeps the spread.
- Call sites: `src/java-random.js` (import, accessor, `next`), `src/entities.js` (two imports, the tickMobs `t` line, `moveWithHeading`, push's `near` line, the `pushNear` argument, `pushNearDone`), `src/push-grid.js` (import, `this.n`, `add`, `query`), `src/item-entities.js` (import, `pickupCandidates` wrapper), `src/projectiles.js` (import, one line), `src/multiplayer/simulation.js` (import, `vector`). `tools/bench-alloc81.mjs` prints `mode83`.
- Added `src/mpperf83-b83.test.js` (8 tests) and a section in `public/research/server-performance.md`.

## Evidence
- Executed: the batch 82 "second map" of player positions. In travel, `%HaveSameMap` put the 16 `p.position` objects in five hidden classes (12 + 1 + 1 + 1 + 1). They come from `vector`'s `{ ...p, copy }`. With the literal they share one. The `beforeMob` (nearestView) bytes went 30.4 -> 4.5 MB per 300 ticks; that tickMobs line went 17 -> 7 CPU ticks in line-level profiles.
- Executed: about 984 `JavaRandom.next` calls per travel tick. Microbenchmark: BigInt step 35 ns per draw, number step 5 ns. Equal over 1e6 mixed-bit draws.
- Executed heap sampling, travel, 300 ticks, normal inlining: 1060 -> 912 MB in all. tickMobs 47.4 -> 37.6, item `pickupCandidates` 29.0 -> 0.2, JavaRandom `nextInt`/`nextFloat` 17.9 -> 0.5, `push` 41.6 -> 31.3, push-grid `query` + `subarray` 22.5 -> 7.7, `mobTargets` 20.0 -> 18.3. With `--no-turbo-inlining`: 1118 -> 974 MB, `JavaRandom.next` 45.9 -> 0.
- Executed timing: three rounds of 5 runs (150 ticks), HEAD from git archive interleaved with the branch, load 6-8.
  - Travel: heap 2671-2717 -> 2344-2369 KB/tick (-12%); GCs 0.22 -> 0.18-0.19 per tick.
  - Pen: heap 928-953 -> 775-809 KB/tick (-16%); GCs 0.07 -> 0.05.
  - Terrain: heap 1404-1409 -> 1233-1246 KB/tick (-12%).
  - Wall time is within noise in all three (travel 4.07-4.48 -> 4.05-5.22 ms/tick; terrain 2.45-3.50 -> 2.33-3.32).
  - `MC_MPPERF83=off` costs more than HEAD (2828 / 1050 / 1567 KB/tick), because it runs the BigInt step through the accessor. It is a reference path, not the old speed.
- Executed `--state` hashes: off, on and verify all equal the HEAD (0.111.0) hashes for pen, travel, nether, pillar, and terrain seeds 1 and 2. The values are in server-performance.md. They differ from the batch 82 note's hashes because the other batch 82 tracks changed the game.
- Reasoning, checked by the tests: the split multiply is exact because every partial product is below 2^53, and only the low 24 bits of the high half are kept (so `Math.imul`'s low 32 bits suffice). The output shift is a multiply by a power of two, then `| 0` (the int cast), for bits 0..48. Other bit counts take the BigInt step.
- Port-read, not bytecode: no game rule changed. No 1.7.10 bytecode was read; these are representation-only changes.
- Mutation checks (executed, each caught by `mpperf83-b83.test.js`): a wrong multiplier half (2 tests fail), a wrong near-box edge (1), a reversed insertion-sort comparison (2), a dropped pickup `posY` offset (1).

## Verification
- `node --test --test-timeout=600000 src/mpperf83-b83.test.js`: 8 pass, 0 fail.
- 47 neighbour files, `--test-concurrency=2`: 834 pass, 0 fail in default mode, and 834 pass, 0 fail with `MC_MPPERF83=verify`.
  - Files: mpperf77-83, mppushgrid75, entities, item-entities, projectiles, projectiles3/4, multiplayer, ai, iron-golem, villager, spawner-animals, fishing.
  - The JavaRandom users: tree-generators, stronghold-generator, ore-generator, mapgen, end, loading-screen, the `seed`-writing particle tests (explosion, extra, portal, snow-cloud, fireworks, player-throws-b46), scheduled-ticks, ring-ticks.
  - The JavaRandom subclass tests: cave-spider, mob-spawner, spawner-cart, spawn-data, silverfish, mobcopies2/3, singleleft-b62, trackertransient(2), mobsounds-b60, deathfx-b59, vehicles4-b58, horse-sounds-b57.
- 24 replay/generator files (legacy-ai / enderman-wolf / fireballs replays, nether and end generators, dimension-live users) with `MC_MPPERF83=verify`: 598 pass, 0 fail.
- `npm run build`: passes (the usual chunk-size warning only). No full npm test, no browser checks.

## Follow-ups
- Megamorphic `e.x` loads in mob code. Travel has 32 mob hidden classes, and tickMobs still allocates about 36 MB per 300 ticks of boxed loads.
- The per-ball `targets()` list in server-dispense.js: every mob's box, for every ball, every tick (`mobTargets` 18 MB).
- `for...of` iterator objects in `moveEntityBody` and the item `move` (about 7 MB).
- `aiMoveSpeed`/`liveAttribute` modifier arrays, `size()`'s `[w, h]`, and `stepBlock`'s result.
- Tracker `track`/`stateDiffs`/`sendLocation` (tracker83's files this batch).
- Browser-only: the client also runs JavaRandom (world generation, particles), tickMobs, push and mobTargets (same results by test). Frame time and chunk generation speed in the browser were not checked.
