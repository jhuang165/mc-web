# villagefight3 (batch 31)

## Summary
- Before: 7 native village fight records replayed exactly, none of the new cases could be recorded. After: 26 of 26 replay exactly (the original 7 plus 19 new).
- New records (`public/research/village-fight-b31-reference.json`, written by `tools/verify-village-fight.mjs` from `tools/probes/VillageFightProbe.java`, unchanged 1.7.10 classes; the original `village-fight-reference.json` is untouched):
  - four records with three zombies, one a Hard door breaker, Normal and Hard (reinforcement draws included);
  - six hunt records (Normal and Hard) where a zombie kills a villager: Hard always converts it, Normal draws on the zombie's Random;
  - three bow records (three skeletons shooting at the golem, villagers and the player, Easy/Normal/Hard) and three records with villagers standing in the line of fire (26 and 15 arrows, arrows hitting mobs, villagers and the player);
  - a moving player who walks up to bow skeletons, hits one and backs off;
  - an equipment swap record (a bow given to and taken from a skeleton, one swap between two mob updates);
  - a hit on a Peaceful-removed mob.
  Native arrows start from a Random that cannot be seeded, so a record stores each shot's initial state and the replay writes it onto the port's arrow; everything after that (flight, hits, damage) is the port's own and compared every tick.
- Port fixes the records found:
  - `WatchClosest.shouldExecute` (ai.js): a player-watching task overwrites the attack target with the closest player within range, it does not keep the attack target (a skeleton with a far target no longer starts watching).
  - A skeleton keeps one `ArrowAttack` and one `AttackOnCollide` object for life (1.7.10 fields built once), so a swap back reuses the old timers and last target position.
  - The loot pickup now runs per mob at the end of that mob's update (`lootPickupOne`, as EntityLiving.onLivingUpdate), not once before all AI; a bow picked up changes the combat task for the next tick. `lootPickup()` still exists and loops over all mobs. A swap is also followed by an immediate `syncCombatTask`.
  - A villager killed by a converting zombie leaves the entity list at once (native `World.removeEntity`), so it no longer ticks a corpse step with knockback.
  - Arrow ray traces: a test world may declare `floorBelow` (floor at y < 0). The game world is unchanged.
- Replay-side corrections (probe parity, not game changes): zombies created by the probe never ran onSpawnWithEgg (no random knockback resistance); the per-tick path search budget is off in the replay; a hit on a removed mob puts the mob back for that hit alone.
- Hit on an already-removed mob: replayable in the replay (native health 20 -> 17.24, the hurt window refuses the next hit, a lethal hit works). The port's `attackEntityFrom` still refuses a mob that is not in the world list on purpose: nothing in the game can reach one, and allowing it would also run drops and experience for a mob that already left the world. So it is "replayed", not "ported".

## Verification
- `npm test`: 4838 tests, 4838 pass, 0 fail (new `src/village-fight-b31.test.js`: 5 tests; `src/village-fight.test.js` unchanged and passing).
- `npm run build`: passes (usual chunk size warning only).
- Probe regeneration: `node tools/verify-village-fight.mjs` with `MC_RESEARCH` pointing at the main checkout's research folder (needs a JDK). The extra class hashes of the b31 file are listed in its `classes`.
- Browser: not run. The game code changes are in mob AI, pickup order, arrows and the entity list; they are covered by the replays and the full test suite, and I did not do a muted headless Chrome pass.

## Follow-ups (proposed gap lines)
- Village fights are replayed on a flat open arena: terrain steps, water, doors closed by a villager and arrows against block types other than the floor are not probed.
- The Hard reinforcement site search was probed only with a fully lit world (it finds no site), so spawned reinforcement zombies are not compared.
- A converted villager zombie (onKillEntity) is replayed only up to its creation: its own ticks are not probed (its onSpawnWithEgg Random cannot be seeded).
- A hit on a removed mob is replayed through the replay harness only; the port refuses it.
- Arrow initial headings (the unseedable Random) are taken from the record, not derived.
