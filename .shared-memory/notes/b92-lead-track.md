# Batch 92 lead (2026-11-21)

Ten Sonnet tracks in `../wt92-<name>` on `batch92-<name>92`, cut from main a5c011b4f (0.120.0), merged --no-ff on `batch92-lead`. Rules: `../artifacts/b92-lead/track-rules.md` (adds a no-bare-`git stash` rule). Released as 0.121.0.

## Merged
- tiles92 6f5248f52: entity-time darkness for random ticks and sleep; away clock start and `cycling`. Touched `away-world.js` (one line).
- mpperf92 f70adcce9: `MC_MPPERF92`, `carryBoxStore`/`mobTargetAt92`, shared `PathFinder`, pooled `beginMemo`. Edited the mode regexes in the mpperf86-90 tests.
- console92 f17faec21: native-schedule S1C counts, creeper/enderman/wither values, cart/boat join packets, TNT/fireball tracker packets, `Console92Probe`.
- portals92 9460a6f2e: `server-portal-travel.js`; `ServerPortalShots.placed` split out.
- mpobjects92 66723799b: server tick order, `tickScheduledSystems`/`tickTileSystems`, `spawnsPending`.
- credit92 30a43ff91, bd1383e7a: dead thrower's balls and pearls, arrow Thorns on mobs. Edited the `spexec79-b79` stub host (`throwerBody`).
- entnbt92 4febdf83d: HurtTime/AttackTime, witch equipment, fireball in-ground, firework Explosions, no PickupDelay read, hanging Fire 0. Edited `region-import.test.js` and `summon-coverage.test.js` (they expected the non-native delay 10).
- spcopy92 e98e81c43: `SpCopy92Probe`, `left` at the player's list turn with the skip, away `absent` as `left`, edits gated. Edited a source regex in `spcopy89-b89.test.js`.
- mobrec92 150b1388b: 15 records, slimeball id, slime boxes, child yaw, copy push order, witch target. Edited `slime-world.test.js` (it expected 341, this build's Water bucket).
- horse92 6d272eb54: `Vehicle92Probe`, `Horse92Probe`, `takeRideOrQueue`, mob rider yaw and rear seat; `NOT_CREATURES` moved to `mob-riding.js`.

## Lead checks and fixes
- One conflict: `src/projectiles.js`, mobrec92's size-scaled slime and magma cube box against mpperf92's `mobTargetAt92`; kept both (the sized `t` goes into `mobTargetAt92`) (51e8e7f9e).
- Checked the slimeball claim: `buckets.js` has WATER_BUCKET = 341 and `dispenser-piston.js` SLIMEBALL = 460 (`ORIGINAL_ITEMS` maps original 341 to 460); `slime.js` keeps the original id and `combat.js`, its only drop caller, maps it.
- Committed `tools/probes/SpCopy92Probe.java` (spcopy92 had left it in the ignored research folder); its `run.sh` holds a personal library path and stays out.
- Targeted run of the new track tests together: 91/91 and 41/41.
- One full `npm test` on the merged tree: 10331/10331. No browser checks.
- entnbt92 rebuilt four lost edits after its revert check and did not re-run its wider set; the full run covers it.

## Open
"Still open from batch 92" in `public/research/remaining-gaps.md`.
