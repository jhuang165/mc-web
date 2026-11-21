# mobrec94 (batch 94): executed wither, pigman and giant records

## Summary
- `tools/probes/EndermanWolfProbe.java`: set `b94mr` (B94 implies the B93 behaviour). The explosion double now lists the skulls in flight, so a blast pushes other skulls like `doExplosionA`. New op `invul` (EntityWither.func_82215_s). Dead entities leave the probe's entity list after their update (the old harness kept corpses in the candidate pool).
- `tools/probes/EndermanWolfScenarios.java`: `run94` with 18 records: wither blue skulls (9601-9603), armour vs arrows (9611, 9612, 9614 edge at 150.5), wither hit by mob attackers (9613), block breaking (9621-9623, incl. mobGriefing off), regeneration (9631, 9632 cap), a mob killed by the wither effect (9633); pigman group anger at 20/30/34 blocks (9701), pigman hit by a zombie (9702, 9703), giant hit by a zombie (9704), giant vs pigmen (9705).
- `tools/verify-endermanwolf.mjs`: `EW_SET=b94mr` writes `public/research/enderman-wolf-b94mr-reference.json` (1.2 MB, wither) and `enderman-wolf-b94mr-pigman-reference.json` (0.9 MB).
- `src/enderman-wolf-replay.js`: `reference94`; b94 regexes; `invul` op; `blue` on the blast request; arrow kills carry the bow's source fields; block-break cells; client-only `mob.zombie.woodbreak` filtered; for b94 the player's hurt-window countdown runs before the first skull update of the tick (the probe's order: mobs, then `--hurtResistantTime`, then the fireballs and skulls).
- `src/bow.js`: arrow hits pass `directArrow: true` (small, outside the strict mob files; needed by the wither armour).
- `src/wither-boss-mobs.js`: armour refuses `directArrow` arrows; block-break drops roll on the world Random (`m.worldRandom`), not the wither's own.
- `src/entities.js`: `mobThink` does nothing for a mob at health <= 0, and `talk` is skipped for it (both after a wither-effect kill inside the potion step). Not the melee Bane function.
- `src/pots82-b82.test.js`: one source regex updated (`rand` to `wrand`); the old text encoded the non-native Random.
- `src/mobrec94-b94.test.js`: 24 tests.

## Evidence
- Executed: all 18 records replay with no divergence; wither blue skulls, armour, breaking, regeneration, pigman anger range, giants.
- Bytecode-read: `xc.a(ro,F)` refusal order, `xc.bn` sweep, `World.func_147480_a` drop random (ahb.s), EntityLiving isMovementBlocked / isEntityAlive gates.
- Port-read: the live arrow path never set `arrow`, so an armoured wither took arrow damage in the game.

## Verification
- `node --test --test-concurrency=2 src/mobrec94-b94.test.js`: 24 pass. With bow.js, wither-boss-mobs.js, entities.js reverted: 7 fail (hit-9613, break-9621, break-twice-9622, cross-9633 and three source tests); restored afterwards.
- Regression: 82 test files that name bow.js, wither-boss-mobs or the replay, concurrency 2: 1322 tests, 1320 pass; the 2 failures were the pots82 regex (updated, passes) and mpwither-b64 "S1D", which passed in 15 solo reruns and 3 grouped reruns (not reproduced, probable timing flake).
- No full `npm test`, no build (no imports changed), no browser checks.

## Found wrong in the batch 93 list
- "Explosion double does not push other skulls" was a probe artefact, now fixed in the probe; the port already pushed skulls (fireballRows).
- The armoured-phase arrow immunity existed in code but never fired for bow arrows.

## Follow-ups
- Group anger and attacker records use player-hit and mob-hit paths only; pigman vs giant melee over longer fights is not recorded.
- Browser-only: wither block-break level event sound and the armour shimmer.
