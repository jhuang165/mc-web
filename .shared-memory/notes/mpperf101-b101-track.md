# Batch 101 mpperf101: FineGrid keeps its cell lists, tickMobs keeps its order arrays (fast101)

## Summary
- New `src/mpperf101-fast.js`, `MC_MPPERF101=on|off|verify` (default on). Off runs the b100 text. Imports nothing.
- `src/push-grid.js` FineGrid + `src/mpperf93-fast.js` `recycleOf93`: when the retired grid held the same entities (b93's kept Maps), the cell lists are no longer emptied with `c.length = 0` (which drops the backing store, so every occupied cell regrew one per tick). The constructor instead moves only the indices whose cell key changed (big / NaN handled). Query sorts the indices, so list-internal order does not matter. Verify checks every cell against a fresh scan (`checkCells101`).
- `src/entities.js`: `withBalls(order, keep)` (tickMobs passes true) refills kept `others`, `keyed` rows and `out` per world and drops the entities from the rows afterwards; `entities101()` copies the entity list into one kept array for tickMobs instead of `slice()`. Other `withBalls` callers (playerJoined, saved-order) are unchanged (fresh arrays), because they can run during a pass. `tickOrder` is null at the pass end, so nothing holds the kept order array.
- `tools/bench-alloc81.mjs` prints `mode101`; mode regexes of b86..b100 tests allow `mode101=`. Shared files touched: entities.js (three small hunks), push-grid.js, mpperf93-fast.js, bench, old mpperf test regexes only.

## Evidence
- Executed heap sampling (travel, last run of 2, 150 ticks, before): `next` 7.8 MB (about 60 small sites), FineGrid 5.75, tickMobs 5.4 (of which `push` growth 2.1 = withBalls arrays), moveWith 4.7, moveEntityBody 4.1, movePlayer 3.7. FineGrid: 183 grids per 180 ticks, 173 of them reused both Maps (so the 5.75 MB was cell-list regrowth, not Map growth).
- Executed bench (travel, 3 runs x 150 ticks, off/on alternating x3): heap growth KB/tick off 1182, 1185, 1181; on 1149, 1170, 1149 (about -1.3 to -2.8%). ms/tick off 6.85, 5.37, 5.65; on 7.00, 5.05, 5.43: within noise (noise is larger than the effect). Pen (1 pair): 374 -> 357 KB/tick (-4.5%), 1.08 vs 1.19 ms/tick (noise).
- Executed hashes (`--state`, 150 ticks) equal for off, on, verify: travel `8739d6266090f4ba,ff999ef463b1dfa9,c48866327711946f`, pen `d086204fea891b9e,ae05bf9079f7a664,3af862547ec8f96a`, terrain `f924502c999eb782,446240d4e983e152,38f38c4ab6dfde24` (unchanged).
- Not changed (candidates left): the `next` tail (spread over about 60 for-of sites, none above 0.4 MB, so no single fix); `moveEntityBody` boxing (double fields of the entity, only removable by changing the entity shape); `bb.slice()` for own-bb entities (identity of `e.bb` read widely, not proven safe); `track` pushes are the real move packets.

## Verification
- `node --test --test-concurrency=2` on 39 files (b77..b101 mpperf tests, serverchunks-b67, multiplayer, bow, entity-portal, mpbuckets-b75, chunkscan2-b68, portals9x): 263 tests, 263 pass. New file: 4 pass. Fails-without-the-fix: with entities.js, push-grid.js and mpperf93-fast.js from HEAD the withBalls test fails; the two FineGrid tests pass on old code too (they pin equal answers, not allocation).
- No full npm test, no build (the new import is a module with no imports), no browser.

## Found wrong in the batch 100 list
- "FineGrid Map growth": the Maps are already kept (173 of 183 grids); the cost was cell-list backing stores released by `length = 0`.

## Follow-ups
- Open: `next` tail, `moveEntityBody` boxing, `bb.slice()`, `chunks` (server-chunks.js:47, 0.5 MB) iterators.
- Browser-only: nothing (server-side only).
