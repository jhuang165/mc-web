# Batch 98 mpperf98: movePlayer stores, beacon list only when read, deliverSounds without splice (fast98)

## Summary
- New `src/mpperf98-fast.js`, `MC_MPPERF98=on|off|verify` (default on). Off runs the b97 text of each site.
- `src/player-physics.js` `movePlayer`: `previous`, `position` and `velocity` are stored field by field instead of three `Object.assign(x, {literal})` calls (same stores, same order).
- `src/multiplayer/simulation.js`: the beacon call's `players: [...].map(...)` is built only when `tickBeacons` can read it (a beacon tile exists and `ticks % 80 === 0`; it returns before touching `players` otherwise), else a frozen empty list. `deliverSounds` returns on an empty queue and walks a non-empty one by index, then `length = 0` (was `splice(0)` copy).
- `tools/bench-alloc81.mjs` prints `mode98`; mode regexes of the b86..b90, b96 and b97 tests allow `mode98=`.
- `entities.js` untouched.

## Evidence
- Executed micro-measurement (large semi-space, 200k calls): three Object.assign literals 432 bytes/call vs direct stores 0; beacon list for 16 players 2825 bytes/tick vs 0; empty `splice(0)` 32 bytes vs 0.
- Executed hashes (`--state`, 150 ticks) equal for off, on, verify: travel `8739d6266090f4ba,ff999ef463b1dfa9,c48866327711946f`, pen `d086204fea891b9e,ae05bf9079f7a664,3af862547ec8f96a`, terrain `f924502c999eb782,446240d4e983e152,38f38c4ab6dfde24` (same as b96/b97).
- Executed end to end (travel, 16 players, 300 mobs; baseline heap-sampling total 246.9 MB per 150 ticks; heapUsed delta with a 1 GB semi-space, 400 warm ticks, three off/on pairs): off 148.79/148.82/149.61 MB, on 148.24/148.78/147.86 MB, mean -0.8 MB (-0.5%) but the pair noise is about +-1 MB (the first 30-tick-warm run even read +0.7 MB for on), so the end-to-end gain is within noise; the micro numbers are the evidence. Bench (3 runs x 150 ticks, off/on/off/on): heap growth KB/tick 1236, 1227, 1234, 1225 (-0.7%); ms/tick 5.07/4.62/4.69/4.61 (noise 4.0 to 6.6), no provable tick-time change.
- Heap sampling after (one run, 250.3 MB total, sampling noise +-3 MB): `movePlayer` self still listed at 6.3 MB (baseline 5.0), so the heap sampler did not show the Object.assign saving; in optimized code V8 probably already elided those literals and `movePlayer`'s self bytes are its `body`, `pushed`, `oldPosition`, waterBox/webMove arrays and doubles. Not shown to be a real saving in the live tick; kept because the stores are identical and the micro-measure is 0.
- Not changed, measured and left: `bb.slice()` for own-bb entities (entities.js:645; carts and boats only, `e.bb` identity is read by many modules, and another track may edit entities.js); `moveEntityBody`/`moveWith` double-field boxing (self 5.4 and 3.5 MB: stored doubles of the entity fields, only removable by changing the entity shape); `next` 10.2 MB (about 60 for-of sites); `FineGrid` push-grid 5.2, `fround` 4.9, entity-portal `step` 4.7, `tickMobs` 4.3, `updateAITasks` 4.3.

## Verification
- `node --test --test-concurrency=2 src/mpperf98-b98.test.js`: 4 pass (deliverSounds off/on/verify and in-place empty; beacon list built 0 of 10 ticks on vs 10 off, and once or twice in 100 ticks with a beacon tile; Object.assign calls drop in the live tick with equal positions; bench hashes pen and travel plus `mode98`). Fails-without-the-fix: with `simulation.js` and `player-physics.js` checked out from main, tests 2 and 3 fail (test 1 and 4 pass there, they only assert equal output).
- Neighbours (59 files: mpperf81, 86-98, mpitems, mpsleep, mpstate, multiplayer.test.js, pyramid, and every test naming tickBeacons/movePlayer/deliverSounds): 510 tests, 510 pass.
- No full npm test, no build (imports only), no browser. movePlayer is shared with the client; the client path is covered by `player-physics` neighbours only through the server scene and the tests above.

## Found wrong in the batch 97 list
- "`movePlayer` literals and closures" as a heap target: the three Object.assign literals are not visible in the live heap sample (V8 elides them when optimized); the remaining self bytes are the per-step `body`/`pushed`/box arrays, which the code needs.

## Follow-ups
- Open: `moveEntityBody`/`moveWith` double-field boxing, `next` tail, `bb.slice()` for own-bb entities, `tickSpawners`' `players.filter().map()` (built every tick although it returns early with no spawner), `FineGrid`/`pushNear`, `tickMobs`/`updateAITasks` literals.
- Browser-only: nothing changed on the client path beyond the equal stores.
