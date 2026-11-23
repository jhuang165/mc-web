# Batch 97 mpperf97: tick packet lists without closures, move scratch list keeps its store (fast97)

## Summary
- New `src/mpperf97-fast.js`, `MC_MPPERF97=on|off|verify` (default on).
- `src/multiplayer/simulation.js`: `itemList()` and `presence()` build the tick packet's lists with one index loop / one `forEach` over the players (no `filter().map()` closures, no array spread). Off runs the old bodies (`itemListRef`, `presenceRef`, unchanged text); verify builds both and compares `JSON.stringify` per call. The player object literal moved to `presenceOf97(p)`.
- `src/mpperf81-fast.js`: `MoveScratch.freshList` and `releaseMoveScratch` empty the scratch list through `resetList97` (pops down to 0 instead of `length = 0`). `length = 0` always hands the backing store back, so the next push regrows 152 bytes on every `collisionBoxes` call; pops keep it. Off keeps `length = 0`.
- `tools/bench-alloc81.mjs` prints `mode97`; mode regexes of mpperf86..90 tests allow `mode97=`; the b96 test's `mode96=x mobs=` pattern allows it too.

## Evidence
- Executed heap sampling (travel, 150 ticks, `--heapprof`): total 255.6 MB; `blockBoxesFast` self 6.0 to 6.5 MB (its callers: moveEntityWithHeading 5.1, moveEntity 1.1; it was the list regrowth, not the box pool), itemList closure 2.1, presence closure 1.5. After: `blockBoxesFast` 0.05, list push growth gone, itemList/presence closures gone (the item objects and the player objects themselves remain: 2.1 and 1.1 MB), total 250.0 MB (-4.5 MB, -1.8%).
- Executed micro-measurement (large semi-space, 100k cycles of reset + 3..14 pushes): `length = 0` 154 bytes per cycle, pre-sized `new Array(8|15)` the same (first attempt, failed in the real profile), pop loop 4-7 bytes.
- Executed bench (`--scene=travel --runs=3 --ticks=150`, off/on/off/on): heap growth KB/tick 1271, 1269 (off) vs 1238, 1238 (on), -2.5%; ms/tick 8.06/7.34 (off), 7.95/7.47 (on): no measurable tick-time change (noise 6.5 to 9).
- Executed hashes (`--state`, 150 ticks) equal for off, on and verify: travel `8739d6266090f4ba,ff999ef463b1dfa9,c48866327711946f`, pen `d086204fea891b9e,ae05bf9079f7a664,3af862547ec8f96a`, terrain `f924502c999eb782,446240d4e983e152,38f38c4ab6dfde24` (same as the b96 note).
- Not touched, measured and left: `bb.slice()` at entities.js:645 (only entities with their own `e.bb`: carts and boats; `e.bb` identity is read by many modules, so copying in place is not provably safe); `movePlayer` self 7.0 MB (about 3 KB per player call, many small literals and closures in shared client/server code), `moveEntityBody` self 5.3 (heap numbers for double fields), `fround` 5.2, entity-portal `step` 4.7 (b93 already scratch'd; the rest is the option literals and stored doubles), `next` 10.4 MB (about 60 sites), `track` pushes (the packets themselves).

## Verification
- `node --test --test-concurrency=2 src/mpperf97-b97.test.js`: 4 pass (itemList off/on/verify and no filter/map calls; presence per dimension off/on/verify; scratch list reset in every mode; bench hashes pen and travel plus `mode97`). Fails-without-the-fix was not run by reverting; the filter/map-call test cannot pass on the old bodies (they call both).
- Neighbours (19 files: mpperf81, 86-91, 96, mpitems, mppickup74, mpcapes, mpsleep, mpvelocity77, mptrackers71, mpinvis, tracker83, mpstate, mpmobs-b59, multiplayer.test.js): 159 tests, 159 pass.
- No full npm test, no build (imports only), no browser.

## Found wrong in the batch 96 list
- "`blockBoxesFast` allocator" was the scratch list's backing store regrown after `length = 0`, not box arrays; "`server-mobs.js:481` closure" is the `send`/`plain` closures made once per tick (tiny); not changed.

## Follow-ups
- Open: `movePlayer` literals and closures, `moveEntityBody`/`moveWith` double-field heap numbers, `next` tail, `bb.slice()` for own-bb entities, the dimension tick's `players: [...].map` (simulation.js, 0.6 MB).
