# Batch 99 mpperf99: spawner player list only when read, ChunkSet unchanged-input path, deliverSounds list per call (fast99)

## Summary
- New `src/mpperf99-fast.js`, `MC_MPPERF99=on|off|verify` (default on). Off runs the b98 text of each site.
- `src/multiplayer/server-spawners.js` `tickSpawners`: `players` may be a function; it is called only after the no-spawner / no-cart early return (then the empty check runs on its result). `src/multiplayer/simulation.js` passes a function for the Overworld (`[...players.values()].filter(...)` was built every tick). The Nether caller already has its list and is unchanged.
- `src/multiplayer/server-chunks.js` `ChunkSet.chunks`: before building the pair list and key string, the players' chunk numbers, radius, size and origin are compared with the last call's flat numbers (`same99`/`keep99`); equal returns the kept list. Verify mode recomputes the key and throws on a mismatch. A miss or off mode runs the old code; off clears the flat copy so a mode switch cannot serve a stale list.
- `simulation.js` `deliverSounds`: one `[...players.values()]` per non-empty call instead of one Map iterator per queued sound (same order).
- `tools/bench-alloc81.mjs` prints `mode99`; mode regexes of the b86..b90, b96..b98 tests allow `mode99=`. `entities.js` untouched.

## Evidence
- Executed heap sampling (travel, 16 players, 300 mobs, 150 ticks): baseline total 249.3 MB; the sampler shows `tickSpawners`'s list, `chunks` and `deliverSounds` each well under 0.5 MB, so the real allocators are elsewhere. Largest by self size: `next` 10.3 MB (about 60 for-of sites, the biggest single caller 0.4 MB), `movePlayer` 6.3, `push` 5.8 (packet objects in `track`/`plain`, server-mobs.js:487/513, 3.7 MB together), `moveEntityBody` 5.1, `FineGrid` 5.0, `explosionBlocksWith` 4.9, `fround` 4.9, entity-portal `step` 4.8.
- Executed, after (same scene): total 250.8 MB (off 252.0 in the same session); sampling noise is +-3 MB, so no gain is shown. Bench (travel, 3 runs x 150 ticks, off/on/off/on): heap growth KB/tick 1236, 1234, 1239, 1229 (-0.3%); ms/tick 4.86/4.91/4.80/4.88. Gain is within noise; this batch's changes are tail trims, not a measured speedup.
- Executed hashes (`--state`, 150 ticks) equal for off, on, verify: travel `8739d6266090f4ba,ff999ef463b1dfa9,c48866327711946f`, pen `d086204fea891b9e,ae05bf9079f7a664,3af862547ec8f96a`, terrain `f924502c999eb782,446240d4e983e152,38f38c4ab6dfde24` (same as b96..b98).
- Not changed: `moveEntityBody`/`moveWith` boxing (stored double fields of the entity, only removable by changing the entity shape, which touches every module); `bb.slice()` for own-bb entities (entities.js:645; `e.bb` identity is read widely, not proven safe); the `next` tail (spread over 60 sites, each under 0.4 MB).

## Verification
- `node --test --test-concurrency=2 src/mpperf99-b99.test.js`: 5 pass (function player list not called without spawners; live tick builds the Overworld spawner list fewer times on than off, equal positions in all modes; ChunkSet equal across a move sequence in every mode, no `map` on an unchanged call, no stale list after a mode switch; deliverSounds with three sounds; bench hashes pen and travel plus `mode99`). Fails-without-the-fix: with `simulation.js` and `server-chunks.js` checked out from main, tests 2 and 3 fail.
- Neighbours (b81, b86-b99, serverchunks-b67, chunkscan2-b68, mpbuckets-b75, mpnether3-b63, mpspawners2-b65, mpsummon-b67, summon2-b68, mpsleep, mpsleep2, multiplayer.test.js): 178 tests, 178 pass.
- No full npm test, no build (imports only), no browser.

## Found wrong in the batch 98 list
- "`tickSpawners`' per-tick player list" as a heap target: tickSpawners itself returns before building it; the list was built by its Overworld caller, and it is too small to show in the sampler.

## Follow-ups
- Open: `moveEntityBody`/`moveWith` double boxing, `next` tail, `bb.slice()` for own-bb entities, `track` packet pushes (server-mobs.js), `FineGrid`/`pushNear`, `explosionBlocksWith`.
- Browser-only: nothing (server-side only).
