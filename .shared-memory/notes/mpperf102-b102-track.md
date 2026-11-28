# Batch 102 mpperf102: ChunkSet numeric fill, kept player rows (fast102)

## Summary
- New `src/mpperf102-fast.js`, `MC_MPPERF102=on|off|verify` (default on). Off runs the b101 text. Imports nothing.
- `src/multiplayer/server-chunks.js` `ChunkSet.chunks`: on a changed player chunk set, the HashSet fill uses `orderNum102` (one Smi key `(x+4096)*8192+(z+4096)`, same `chunkHash(x, z)` input and insert order, flat `[x, z, ...]` answer) instead of a `"x,z"` string key per chunk plus `split(',').map(Number)` pair arrays. Falls back to the string path when a chunk number is outside +-4096. Verify runs the old `order()` (with the capacity restored to its pre-call value, since the retained table size feeds the order) and compares order and capacity.
- `ServerChunkSets.chunks`: the `{ x, z }` player rows are refilled in place (`set.here102`); `ChunkSet.chunks` keeps only numbers from them.
- `tools/bench-alloc81.mjs` prints `mode102`; mode regexes of b86..b101 tests allow `mode102=`.

## Evidence
- Executed heap sampling (travel, 150 ticks, before): flat profile, `next` 7.8 MB, tickMobs 4.8, moveWith 4.8, moveEntityBody 4.6, movePlayer 3.6, `order` server-chunks.js 2.1. CPU profile (travel): tickMobs self 9%, no single function above 5%; `dispatch` is the inspector's own `post`.
- Executed microbench (16 players moving 4 blocks per call, 200 calls, 256 world): `chunks()` 0.37 ms/call off, 0.13 ms/call on (about 2.8x), heap per call within noise (the live-heap delta is dominated by GC timing).
- Executed bench (travel, 3 runs x 150 ticks, off/on x2): cpu ms/tick off 5.98, 5.61; on 5.85, 5.87; heap growth KB/tick off 1150, 1149; on 1153, 1153: within noise. The travel scene rarely changes a player's chunk, so the change does not show at tick level there. Wall ms/tick was unusable (the Mac was shared: single runs of 850 and 2571 ms/tick).
- Executed hashes (`--state`, 150 ticks) equal for off, on, verify: travel `8739d6266090f4ba,ff999ef463b1dfa9,c48866327711946f`, pen `d086204fea891b9e,ae05bf9079f7a664,3af862547ec8f96a`, terrain `f924502c999eb782,446240d4e983e152,38f38c4ab6dfde24` (unchanged).
- Not changed: `moveEntityBody` boxing (double fields; the scratch path is already used, `bb.slice()` only runs when `s` is null, i.e. entities outside the pooled path, and `e.bb` identity is read widely: not proven safe, skipped); the `next` tail (spread over about 60 sites, none above 0.4 MB); `lootPickupOne` box (only for canPickUpLoot mobs, 3 MB of 1.2 GB per 150 ticks); `get width`/`size` (already one reused object since b82, remaining cost is boxed doubles).

## Verification
- `node --test --test-concurrency=2` on 30 files (b77..b102 mpperf tests, serverchunks-b67, multiplayer, mpbuckets-b75, chunkscan2-b68): 173 tests, 173 pass. New file: 3 tests.
- No full npm test, no build (the new import is a module with no imports), no browser.

## Follow-ups
- Open: `next` tail, `moveEntityBody` boxing, `bb.slice()` non-scratch path.
- Browser-only: nothing (server side only).
- Fails-without-the-fix: with server-chunks.js from HEAD the kept-rows test fails (no `here102`); the order test and hash test pass on old code too (they pin equal answers).
