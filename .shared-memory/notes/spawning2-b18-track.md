# spawning2 (batch 18) track

## Summary
- findChunksForSpawning now draws in every resident chunk of the 15x15 non-edge set (ticking or not); non-resident chunks are skipped without draws (native would generate them; not feasible per tick).
- Entity.rand is seeded at spawn (`entitySeed` in tests); slimes and magma cubes roll size `1<<nextInt(3)` and jump delay on it; horses use `horseSpawn` group data (`src/horse-live.js`).
- Frozen despawnable mobs outside the ticking window follow native despawnEntity in `sweepFrozen`.
- Bats now block spawn boxes (found by replay).
- Total world time: per save, advances while played; Nether/End read the Overworld value natively; no observable difference found.

## Tests
- New: `tools/probes/SpawnReplay2Probe.java`, `tools/verify-spawn-replay2.mjs`, `public/research/spawn-replay2-reference.json` (8 replays), `src/spawner-replay2.test.js`; two updated/new tests in `src/spawner-animals.test.js`.
- Probed natively: slime, ocelot, horse, Nether, End replays. Bytecode-read: Entity.rand sources, despawn rule.

## Remaining gaps
- Streamed resident window (8x8) is smaller than the native 17x17 spawn area.
- Probe uses a stand-in fortress box, only one ghast in the Nether replay, light rolls at 0 except lit slimes, riding-skeleton gear unverified, kitten limit 40 vs none.

## Proposed remaining-gaps "Natural spawning" line
Natural spawning: findChunksForSpawning is probed (batches 13-18, incl. slime, ocelot, horse, Nether and End replays); remaining gap: chunks outside the streamed resident window are skipped instead of generated, plus a stand-in fortress box and light-roll coverage limited to light 0.
