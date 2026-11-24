# Batch 100 mpperf100: portal step options, track Maps/rows reused, arrow pickup candidates without box arrays (fast100)

## Summary
- New `src/mpperf100-fast.js`, `MC_MPPERF100=on|off|verify` (default on). Off runs the b99 text of each site.
- `src/entity-portal.js` `EntityPortals.step`: `PortalState.tick` gets one module scratch options object (it destructures on entry, keeps nothing) instead of a literal per entity per tick. Verify runs the old call on a copy of the state and compares result, inPortal, portalCounter, timeUntilPortal.
- `src/multiplayer/server-portal-travel.js` `step`: the riding / ridden flags are read directly instead of a `mobLinks` pair per mob per tick (verify compares with `mobLinks`). `mobLinks` itself is unchanged (used by dimension-live.js, away-entities.js).
- `src/multiplayer/server-mobs.js` `track`: the byWatcher / outs Maps, each view's `{ out, later }` row and the out / destroys arrays are reused (`v.row100`, `v.later100`; destroys swaps with its spare each tick; `out` is emptied after its copy into `mobPackets`; Maps cleared at the end). Nothing outside `track` reads `v.destroys`.
- `src/bow.js` `pickupCandidates`: trigger box in locals, an arrow's box array only for a candidate (same comparisons); the old body is kept as `pickupCandidatesOld100` (off and verify).
- `tools/bench-alloc81.mjs` prints `mode100`; mode regexes of the b86..b90, b96..b99 tests allow `mode100=`. `entities.js` untouched. Shared files touched: server-mobs.js, bow.js, entity-portal.js, server-portal-travel.js, bench, old mpperf tests (regexes only).

## Evidence
- Executed heap sampling (travel, 150 ticks, before): `next` 10.3 MB, movePlayer 6.2, `push` 6.1 (plain 2.2 + track 1.5 + others), moveEntityBody 5.3, FineGrid 5.2, explosionBlocksWith 5.0, fround 4.9, `step` of server-portal-travel.js 4.5, bow.js pickupCandidates 3.4. Sampler noise is about +-3 MB per entry.
- Executed bench (travel, 150 ticks, 1 run each, off/on alternating x3): heap growth KB/tick off 1473, 1481, 1471; on 1448, 1439, 1447 (about -2%). ms/tick off 5.75, 6.10, 5.25; on 5.29, 6.92, 5.99: no measurable time change (noise larger than the effect).
- Executed hashes (`--state`, 150 ticks) equal for off, on, verify: travel `8739d6266090f4ba,ff999ef463b1dfa9,c48866327711946f`, pen `d086204fea891b9e,ae05bf9079f7a664,3af862547ec8f96a`, terrain `f924502c999eb782,446240d4e983e152,38f38c4ab6dfde24` (unchanged since b96).
- Not changed: FineGrid (the grid is built per tick by design, arrays already recycled by b90/b93; remaining size is Map growth), explosionBlocksWith (already flat from b95; the 5 MB is boxed doubles in the ray loop of a few explosions), `next` tail, `moveEntityBody`/`movePlayer` (boxed double fields of entity shape).

## Verification
- `node --test --test-concurrency=2` on 32 files (b81..b99 mpperf tests, mpperf100-b100, serverchunks-b67, multiplayer.test.js, bow.test.js, entity-portal.test.js, portals92..99): 217 tests, 217 pass. The new file alone: 4 pass. Fails-without-the-fix: with `server-mobs.js` from HEAD the row-reuse test fails.
- No full npm test, no build, no browser.

## Found wrong in the batch 99 list
- "`track` packet pushes (server-mobs.js:487/513)" as packet-object cost: the pushes are mostly array growth of the per-view out arrays (the packet copies are shared among watchers since b87); reuse of the arrays was the local fix.

## Follow-ups
- Open: `next` tail, FineGrid Map growth, `moveEntityBody` boxing, `bb.slice()`, `lists` / `at` closure per dimension in portal step (small).
- Browser-only: nothing (server-side only).
