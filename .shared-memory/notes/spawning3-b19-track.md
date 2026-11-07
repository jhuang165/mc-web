# spawning3 (batch 19) track

## Summary
- Lit-area replays: block light, saved sky light, skylightSubtracted (0, 4, 11), thunder, full-light animals; every `EntityMob.isValidLightLevel` draw and comparison matched the jar in native order for zombies, skeletons, creepers, spiders, endermen, witches, slimes, bats, pig zombies and blazes. No light-rule divergence found.
- Real fortress: the Nether replay now uses the unchanged `MapGenNetherBridge` starts (structure and piece boxes); the port's `MapGenNetherBridge` builds identical starts and `fortressMonsterSpawnList` picks the same lists. 31 ghasts, 48 blazes, 12 skeletons and 34 magma cubes in one 2,500-tick replay.
- Found and fixed by the replays: a foal (or baby zombie) rolled in `onSpawnWithEgg` keeps an anchored (min-corner) box until its first move (`Entity.setSize`), which blocks the next group member in the same tick; the port had a centred box (`anchoredShrunkBox`, `spawnBox`/`spawnBoxTick`).
- Natural-spawn ocelot kittens no longer stop at the 40-entity limit (`opts.limit` Infinity); egg spawns keep 40.
- Resident window measured, not changed (see Remaining gaps).

## Native evidence
- Probed natively (executed, unchanged 1.7.10 classes): `tools/probes/SpawnReplay3Probe.java` via `tools/verify-spawn-replay3.mjs` -> `public/research/spawn-replay3-reference.json` (6 replays: lit-day, lit-night, lit-dusk-thunder, lit-swamp-night, lit-animals-day, nether-lit-fortress). Run twice, outputs must match. Also native: `atd` structure generation, `ahb.n` through the provider's real lightBrightnessTable, `EntityMob.isValidLightLevel` thunder branch.
- Bytecode-read only: `aqv.a(sx, III)` fortress tests (replicated in the double), `EntitySpider.onSpawnWithEgg` jockey path (the jockey skeleton's Entity.rand cannot be seeded), `Entity.setSize` anchoring (deduced from the replay and bytecode).
- Probe change: `SpawnReplay2Probe` gained `floorOverride`/`brickOverride` hooks (round 2 output unchanged).

## Tests
- New `src/spawner-replay3.test.js` (8 tests: 6 replays, port-vs-jar fortress starts and piece boxes, kitten limit); `npm test` and `npm run build` pass.
- Micro-benchmark (not a test): naturalSpawn 0.62 ms/tick with an 8x8 draw set vs 2.2 ms/tick for 15x15, spawn-heavy flat double.

## Remaining gaps
- Streamed resident window 8x8 columns vs 225 non-edge eligible chunks (28 %); mobs concentrate near the player at the cap. Enlarging needs populated terrain, light and frozen-mob housing for non-resident columns.
- Spider jockey gear unverified against the jar (unseedable Entity.rand); the foal/baby box recentring on the first move is not modelled beyond the spawn tick.
- Light fixture covers the saved-light inputs only; the port's real `scene.light` values (neighbour light for slabs/stairs in `getBlockLightValue`) are covered by light tests, not by these replays.

## Proposed remaining-gaps "Natural spawning" line
Natural spawning: findChunksForSpawning is probed (batches 13-19, incl. slime, ocelot, horse, lit day/night/thunder light rolls, and a Nether over the real MapGenNetherBridge boxes); remaining gap: chunks outside the 8x8 streamed resident window (28 % of the 225 eligible chunks) are skipped instead of generated, and a spider jockey's gear is unverified.
