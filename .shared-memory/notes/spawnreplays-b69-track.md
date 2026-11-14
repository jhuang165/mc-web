# Batch 69 spawnreplays: slime and bat natural-spawn replays

## Summary
- `tools/probes/SpawnReplay4Probe.java`, `tools/verify-spawn-replay4.mjs` -> `public/research/spawn-replay4-reference.json` (15 replays).
- `src/spawnreplays-b69.test.js` replays them against the SpawnerAnimals port (16 tests). No port differences were found; no port code changed.
- Catalogue rows for Slime and Bat updated in `tools/build-content-catalogue.mjs` (regenerated); `public/research/slime.md` line corrected.
- The old catalogue claims ("no seeded replay reached a slime / a bat") were stale: rounds 2 and 3 already spawned slimes and bats. Round 4 adds what they held fixed.

## Evidence
- Executed (unchanged 1.7.10 classes, probe run twice, identical): slime chunk rule (`Chunk.getRandomWithSeed(987234911)`, y < 40) over world seeds 99, 20261114, -777; swamp rule (biome 6, 50 < y < 70, light, moon phase) at moon days 0, 2, 4, 6 (day 4 = new moon: zero slimes, native and port), sizes 1/2/4 with jump delay draws; bats in caves (y < 63) with the light limit 4, or 7 from Oct 20 to Nov 3 (dates Oct 19, 20, Halloween, Nov 3, 4, 14); ambient cap (400 ticks without clearing, 17 bats, port total matches each tick).
- Date handling: the probe's world double overrides `World.getCurrentDate` with a fixed month/day, and the test sets `mobs.currentDate` to the same date, so the replay never reads the clock.
- Slime-only lists replace the monster list with one Slime entry (as round 2) so other mobs do not disturb the draws; bat scenarios use the real ambient list with hostile = false.
- Recalled/not replayed: the world double's terrain is the synthetic round 2/3 terrain, not generated chunks.

## Verification
- `node --test src/spawnreplays-b69.test.js`: 16 pass, 0 fail.
- Catalogue regenerated; catalogue tests and `npm run build` see below in the report. Full npm test not run (batch rule).

## Follow-ups
- Real generated slime chunks and real cave carving (only a synthetic cave layer).
- Browser check not done (batch rule).
