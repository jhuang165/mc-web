# Batch 76 mplos76: faster line-of-sight walk

## Summary
- `src/projectiles.js`: `rayTraceBlocks` now runs `rayTraceFast` (no per-call closures, scalar start vector, direct block-array read for a plain `World.get`, air skipped before any object is built). The previous body is exported as `rayTraceBlocksReference`. `rayTraceConfig.mode` / env `MC_RAYTRACE`: `on`, `off` (reference), `verify` (both, throws on any difference).
- `src/mplos76-scene.js` (seeded scenes and rays), `tools/bench-raytrace.mjs` (verify then time), `src/mplos76-b76.test.js` (7 tests), `public/research/server-performance.md` (section).

## Evidence
- Port-read: EntitySenses caching already matches native (`senseCache` per brain, cleared once per AI tick, one ray per target); no change needed. About 2400 rays/tick in the 600-mob bench, 72 cells each; the callers are native tasks, so the count stays.
- Executed: `--state` hashes equal before/after (two scenes), also with `MC_RAYTRACE=verify`; 763 related tests pass under verify.
- Executed: profile ray-walk self time 3.6 -> 2.2 ms/tick (15.9% -> 11.5% of the run); micro bench 1.12x to 1.42x. Server ms/tick pairs were unusable (load 10-13).
- Cross-tick ray caching was rejected: block arrays are written directly in many places (java-world, gen-world, headless-columns, away-world), so no safe invalidation hook.

## Verification
- `node --test src/mplos76-b76.test.js`: 7 pass. Related set (45 files) under `MC_RAYTRACE=verify`: 763 pass, 0 fail. No full npm test, no browser.

## Follow-ups
- Remaining ray cost is the per-cell double arithmetic; only a different traversal would be faster and it would not be bit-identical.
- `nearby`/target scans still allocate; `tickMobs` self time is now the largest item.
