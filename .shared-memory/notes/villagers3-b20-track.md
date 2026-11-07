# Batch 20 villagers3 track (village aggressors and attacks through doors)

## Summary
- Every living attacker of a villager is now a village aggressor (`EntityWorld.villagerHurtBy` + `villageAttacker` in `village-host.js`): zombies, skeleton arrows (shooter), wolves, spiders, villagers, creeper blasts (any `source.attacker` entity still in the world), plus the player as before. Reputation (-1, -3 child) and the angry particles stay player-only. `Village.removeDeadAndOldAgressors` uses a host `isAlive` (it read a `.dead` flag nothing set).
- `EntityAIDefendVillage` is nearbyOnly in 1.7.10: aggressor and reputation-player candidates pass `canEasilyReach` (cached path search, one `nextInt(5)` draw). New `NearbyGolemTarget` base in `village-ai.js`, shared with the nearest-monster task.
- Zombie vs villager through a door replayed against 10 native records. Fixes it needed: the villager's `EntityAIWatchClosest2(EntityVillager, 5, 0.02)` and `EntityAIWatchClosest(EntityLiving, 8)` watch villagers / any living entity (port: players only), `EntityAIWatchClosest` watches an existing attack target instead of overwriting it with the closest player (`ai.js`), and `attackEntityFrom` resets the despawn age `idle` (`entities.js`, one line; gates `EntityAIWander` at 100).
- Zombie villager conversion per difficulty was already probed (`zombie-villager-reference.json`, kill rolls per difficulty): not redone.

## Native evidence
- Executed natively (unchanged classes): `VillageAggressorProbe` (yv/sv.attackEntityFrom with mob and arrow sources, Village + VillageCollection ticking, real EntityIronGolem + EntityAIDefendVillage.shouldExecute every tick, logged golem Random) -> `village-aggressors-reference.json` (9 records: 3 scenarios x 3 seeds). `ZombieDoorAttackProbe` (zombie with CanBreakDoors + a ticked villager in a stone room behind the door wall; EntityAIAttackOnCollide, EntityAIBreakDoor, MoveThroughVillage, EntityAIAvoidEntity, both Entity.rand streams) -> `zombie-door-attack-reference.json` (10 records).
- Bytecode-read only: `yv.b(sv)` (aggressor add for any non-null attacker, reputation and status 13 only for `yz`), `vz.b(sv)` (nearest, `<=`), `vm.a()`, `yv` constructor task list, `un.a()` watch logic.

## Tests
`npm test` 4056 tests pass; `npm run build` passes. New: `village-aggressors.test.js` (2), `zombie-door-attack.test.js` (1). Regenerate with `MC_RESEARCH=... node tools/verify-village-aggressors.mjs` / `verify-zombie-door-attack.mjs` (compiled output in `$MC_RESEARCH/villagers3-probe` and `villagers3-door-attack-probe`).

## Remaining gaps
- The player as the target of a zombie through a door, and the player's `setRevengeTarget` path, are not run natively (no EntityPlayer in the probe double); reputation numbers come from the earlier reputation probe.
- Skeleton arrows hitting villagers in the live game: the arrow damage source is probed natively but the port's mob arrows do not hurt villagers through a verified route.
- Door-attack replay accepts 1e-6 on position (ulp drift past x 64); the probe world has no ray tracing and no players.
- Aggressors are not saved (also native).

## Proposed remaining-gaps lines
- Villager: "Every living attacker of a villager is a village aggressor with the native 300-tick expiry, dead/removed removal and nearest search, and the golem's EntityAIDefendVillage is nearbyOnly (9 native scenarios replayed); a zombie attacking a villager behind a door (10 native records) is replayed. The player as a zombie's target through a door and a skeleton arrow hitting a villager in play are not run natively."
