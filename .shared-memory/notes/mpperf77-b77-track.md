# Batch 77 mpperf77: multi-player, Nether and End server benchmarks, two exact speed-ups

## Summary
- `tools/bench-server-players.mjs` + `src/mpperf77-scene.js`: seeded 8/16/32-player scenes (spread, cluster), Nether and End scenes; ms/tick, phase timers, `--state` hashes, `--cpuprof` for timed ticks only.
- `src/mpperf77-fast.js` (`MC_MPPERF77=on|off|verify`): `nearbyLate` (villager zombie-avoid: box check before the ray; `ai.js nearbyLate`, `villager.js`), `stateDiffs` (`server-mobs.js track`), `pushMeets` (`entities.js` push, plus `sizeInto`). Edits in shared files are one-line call swaps.
- `src/mpperf77-b77.test.js` (6 tests), `public/research/server-performance.md` (section).

## Evidence
- Executed: tick times and self-time shares recorded in server-performance.md (machine load 10-110, so shares not wall-clock).
- Executed: `--state` hashes equal between original HEAD source, `on` and `verify` for four scenes (over spread, over cluster, Nether, End).
- Port-read: native canSee runs on getEntitiesWithinAABB results; the old order cast rays for far zombies and discarded them. Cache `senseCache` is cleared each AI tick, so skipped rays change nothing.
- Executed: villager avoid share 7% -> under 2%; track and push gains are within noise.

## Verification
- `node --test src/mpperf77-b77.test.js`: 6 pass. Related set (76 files) under `MC_MPPERF77=verify MC_PUSHGRID=verify`: 896 pass, 0 fail (76 files: villagers, golems, push, trackers, mob suites, mpperf, mplos). No full npm test, no browser.

## Follow-ups
- Lighting relight after explosions is the largest remaining self-time item; needs a proof or array-compare verify.
- Dense-cluster `push` O(n^2) remains. `server-player-tracker.js` was not touched.
