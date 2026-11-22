# Batch 95 mpperf95: flat explosion position set (explosionBlocks)

## Summary
- New `src/mpperf95-fast.js`, `MC_MPPERF95=on|off|verify` (default on). `FlatPositionSet95` replaces `PositionSet`'s per-cell `{h,x,y,z}` objects and bin arrays with reused module-level Int32Arrays (entry rows, bins as linked lists with head/tail). Same java.util.HashMap model: table 16 doubling past 0.75, bins in insertion order, a resize re-links each old bin in order into its low/high bin, a bin reaching 9 resizes below 64 and marks `treeified` otherwise.
- `src/explosion.js`: `explosionBlocks` picks the set (off: `PositionSet`; nested call while the scratch is held: `PositionSet`; verify: runs both with the rand replayed from recorded floats and throws on the first difference in length, order or `treeified`). The ray loop is unchanged (`explosionBlocksWith`). Only the result list `[x,y,z]` is still allocated.
- `tools/bench-alloc81.mjs` prints `mode95`; the mode regexes of mpperf86..90 tests allow `mode95=`.
- Only difference from the reference: a block coordinate of `-0` (Math.floor(-0)) is stored as `0` by the Int32Array. Not observable (JSON, Map keys, arithmetic); verify uses `!==`.

## Evidence
- Executed heap profile (travel, 150 ticks): `explosionBlocks` self 5.5 MB off, 3.2 MB on (of about 260 MB). Other candidates measured in the same profile: blockBoxesFast 6.1 MB (cell functions of non-constant cells and unpooled provider lists, not touched), tickMobs 4.3, moveEntityBody 5.3, `next` iterators 15.6 (not attributable). I chose only explosionBlocks: the others needed riskier changes for similar gains.
- Executed bench, off/on alternated twice (`--runs=3 --ticks=150`, KB/tick; ms/tick is noise on the shared Mac): travel 1301 -> 1264 and 1301 -> 1293 (-1..-3%); pen 415/414 -> 416/411 and terrain 698/701 -> 703/697 (no explosions, unchanged). Micro-bench of 200 explosions (size 4): 0.47 vs 0.45-0.49 ms per explosion, so ray marching dominates and there is no measurable time gain. Claimed: a small allocation drop only.
- Executed world hashes (`--state`, 150 ticks), equal off = on = verify: travel `7459b9003fda4e13,ff999ef463b1dfa9,d5aa46cad2ae3123`, pen `d086204fea891b9e,ae05bf9079f7a664,3af862547ec8f96a`, terrain `f924502c999eb782,446240d4e983e152,38f38c4ab6dfde24` (same as the b94 baselines).

## Verification
- `node --test --test-concurrency=2 src/mpperf95-b95.test.js`: 4 pass (flat vs PositionSet over 33 random/dense/far/colliding add sequences incl. a treeified case; nested acquire refused; explosionBlocks off = on = verify for 5 sizes x 3 seeds and the nested fallback; bench hashes pen/travel off/on/verify + mode95). Mutation (executed): `binLen >= 9` instead of `>= 8` fails test 1 (the first version of the test did not catch it; added the 6..14 same-hash cases ending at a 9-entry bin).
- Neighbours: the new test, mpperf86..90, 94 and every test naming explosion.js / explosionBlocks / PositionSet (53 files, concurrency 2): 518 pass / 0 fail. No full npm test, no build (imports only between existing modules), no browser.

## Found wrong in the batch 94 list
- Nothing wrong. Confirms its note that the profile is flat; explosionBlocks' 5.3 MB was real but only about 2% of allocation.

## Follow-ups
- Still open: `blockBoxesFast` allocation (non-constant cell results, provider lists), `tickMobs` shapes, tracker `next` iterators (largest, 15 MB, unattributed), `moveEntityBody`'s `bb.slice()`. Browser-only: single-player frame time.
