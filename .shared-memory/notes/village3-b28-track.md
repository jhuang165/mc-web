# village3 (batch 28)

## Summary
- Reputation is a name-keyed TreeMap natively (not HashMap): `Village.reputationNames()` gives map order, used by findNearestTargetPlayer, changeAllReputations and save order. Probe `VillageReputationProbe` (6 records) with byte-for-byte villages.dat comparison; only the model/persistence is exercised (one local player, name "Player").
- Fixed: killing a village iron golem (not player-created) with recentlyHit costs -5 reputation (`entities.js onDeath`, 3 lines; also `source.playerName` honoured in the two other reputation calls).
- Probe `VillageFightProbe` (5 records, all mobs ticked, moving player with scripted hits, two zombies, two skeletons, golem) and replay `village-fight.test.js` of the village layer (hits, aggressor list, reputation) up to the first native mob-on-mob death.
- Touched outside owned files: tiny hunks in src/entities.js. `tools/probes/VillageLiveProbe.java` gained `players`/`a(String)` (additive; existing references unchanged, village-aggressors regenerated identical).

## Verification
- `npm test` and `npm run build`: see final reply. New tests: village-reputation (2), village-fight (1).
- Evidence jar sha1 e80d9b3b; run `MC_RESEARCH=.../tools/research node tools/verify-village-reputation.mjs` / `verify-village-fight.mjs`.
- Not run: headless Chrome check (logic-only change).

## Follow-ups (proposed remaining-gaps lines)
- Villager: ticked-mob positions/targets/draws of a village fight (golem vs zombie/skeleton, mob revenge targets, villager flee with several zombies) are in `village-fight-reference.json` but not matched; the port has no mob-on-mob revenge target.
- Villager: reputation for several named players is model-only (one local player); Peaceful and live multi-skeleton arrows are unprobed.
