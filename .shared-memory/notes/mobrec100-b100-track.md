# mobrec100 (batch 100): golem rose, witch potions, bat in water

Branch batch100-mobrec100 from main 9958c1313 (0.128.0). Probe output dirs: tools/research/mobrec100-probe (villagers), tools/research/mobrec100-ew-probe (witch, bat).

## Summary (file by file)
- `src/entities.js` (shared file): `waterAfterMove` skips a bat, and the client-copy path does not run `copyWaterAfterMove` for a bat. EntityBat overrides `updateFallState` with an empty body, so its move never calls `handleWaterMovement` a second time; the splash comes from the next tick's own call. The port splashed one tick early (the old "missing splash particles" bat item).
- `src/enderman-wolf-replay.js`: new export `reference100` (five reference files); for `b97mr-witch100` records the potion walker counts the player's hurtResistantTime down first (the probe's B88 block does it before its throwable loop). Replay harness only, no shipped code.
- `src/village-fight-replay.js`: `rose` script op (forced `nextInt(8000)` of 0 on the k-th mob Random), golem state `[holdRoseTick, attackTimer]` in row element 9, `fightReference100` merging two files.
- `tools/probes/VillageFightProbe.java`, `EndermanWolfProbe.java`, `EndermanWolfScenarios.java` (`run100`), `tools/verify-villagers100.mjs` (new), `tools/verify-endermanwolf.mjs` (`EW_B100=1`): the recorders.
- `public/research/village-fight-b100-rose{1,2}-reference.json` (8 records), `enderman-wolf-b100mr-{witch1..4,bat}-reference.json` (17 witch, 4 bat records); every file under 1.1 MB.
- `src/mobrec100-b100.test.js`: 32 tests.

## Evidence
- Executed: 8 golem rose records (child takes the rose at tick 283/220/135/59 dusk; adults hold 398 ticks; far child never; night no rose). All replay with no divergence and no fix: already native.
- Executed: 17 witch records (water breathing, fire resistance, healing, swiftness skip conditions and combos, a near throw). Executed: 4 bat records (surface, fall, ceiling, dry control); the ceiling one found the early splash (native tick 30, port tick 29 before the fix).
- Bytecode-read: `yp.e` drink chain (water breathing 0.15, fire resistance 0.15, healing 0.05, swiftness 0.25, final 7.5E-4 roll) matches `witchDrink`; `we.a(double, boolean)` is `return`.
- Executed (existing): village golem spawn already covered by three golemSpawn records in village-live-reference.json (seeds 41-43, ticks 10774/2285/3895); no new work.
- Port-read: the two witch records 10041 and 10061 diverged only on harness order (hurtResistantTime decrement vs the potion hit); fixed in the replay hook, so a harm splash 10 ticks after a poison tick hits.

## Verification
- `node --test --test-concurrency=2 src/mobrec100-b100.test.js`: 32 pass.
- Fails without the fix: with src/entities.js reverted, 2 fail (bat ceiling record, splash tick test); restored.
- Targeted run, 38 files (mobrec86..100, creeperwitch-b45, witch, enderman-wolf-b42..44, squid-bat*, squid-push-b85, village-fight*, entities, mobpush-b46, mobcopies2-b61, spcopy89): 1033 tests, 1033 pass. No full npm test, no build (no shipped imports changed), no browser.

## Found wrong in the batch 99 list
- The b97/b98 "bat in water, missing splash particles" item was a real port bug (early splash), not a probe artefact.

## Follow-ups
- Dropped records `b97mr-witch100-throw-near-10072/10073`: the witch's knockback direction after its own potion hits it comes from `Math.random` (unseeded; native vx -0.3227 vs port -0.3261), so it cannot be replayed. Not proven beyond that; magnitude differences fit unseeded randomness.
- The replay's player-tick order (decrement before potions) is the probe's; whether the shipped loop orders the potion hit and the hurtResistantTime decrement the same way is not checked.
- Golem spawn gating (20 doors or 9 villagers never spawn) has no record.
- Browser-only: the splash particles of a bat in water were not seen.
