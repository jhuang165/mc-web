# Iron golem (Java 1.7.10 EntityIronGolem, `wt`)

Code: `src/iron-golem.js` (constants, drops, animation, pumpkin shape), `src/village-ai.js` (tasks), `src/iron-golem-renderer.js` (ModelIronGolem rig), spawning in `src/village-host.js` and `src/entities.js`. Evidence: `tools/probes/VillageLiveProbe.java` records, replayed by `src/iron-golem.test.js`.

## Native-verified (replayed)

- Size 1.4 x 2.9, 100 health, speed 0.25, follow range 16, knockback resistance 0 (the brief assumed 1.0; 1.7.10 does not set it), sounds `mob.irongolem.hit`/`death`, `getAir` unchanged. Task list: AttackOnCollide(1.0, long memory) 1, MoveTowardsTarget(0.9, 32) 2, MoveThroughVillage(0.6, nocturnal) 3, MoveTowardsRestriction(1.0) 4, LookAtVillager 5, Wander(0.6) 6, WatchClosest(player, 6, 0.02) 7, LookIdle 8; targets DefendVillage 1, HurtByTarget 2 (no help), NearestAttackable(monsters, no sight) 3.
- Melee damage 7 + nextInt(15) (40 seeds), fling vy +0.4 on the target, state 4 on the golem, throw sound.
- Drops: nextInt(3) poppies then 3 + nextInt(3) iron ingots, looting not read (300 seeds).
- A player-created golem does not attack players (golemFlags); no golem attacks creepers.
- ModelIronGolem boxes on the 128 x 128 texture (head, body, arms, legs) and the arm/leg animation formulas.

## Live behaviour

- Village golem: spawned by the village collection by its native rule; refreshes its village and home every 70 + nextInt(50) ticks. It hits hostile mobs in range with the native damage, fling and sounds; it defends villagers against attackers and the player at reputation -15 or below.
- Player-created golem: a pumpkin placed on top of two iron blocks with an iron block on both sides of the middle one (x or z) clears the five blocks and spawns a golem with `playerCreated` (no jack-o'-lantern exists in this build; the native check accepts it too). The 120 snowball particles of the original are not drawn.
- Rose: LookAtVillager holds the arm out for 400 ticks; child villagers walk up and take it (FollowGolem).
- Saved in the browser record (`playerCreated`); Java export writes id `VillagerGolem` with `PlayerCreated`. Java import reads `VillagerGolem` (PlayerCreated, health, effects) in an imported area.
- Renderer: ModelIronGolem on the original `iron_golem.png`, with RenderIronGolem's walking roll. Sounds `mob.irongolem.*` come from the 1.7.10 asset index (imported by `tools/import-vanilla-media.mjs`).

## Approximations and open items

- The +0.4 fling (`golemLift`) applies to targets including the player.
- Step sounds (`mob.irongolem.walk|1.0|1.0`), the 1-in-20 collide retargeting on IMob types, the attack/rose timers, walking dust and the rose model are ported and replayed from probe records in `village-live-reference.json` (rose geometry is bytecode-read, not probed).
- NearestAttackable (monsters) is built with nearbyOnly, so EntityAITarget runs `canEasilyReach` for each candidate: a real PathFinder search to the monster whose end point must lie within 1.5 blocks horizontally of it (so a monster on a pillar counts, one behind a long wall or in a sealed room does not). The answer is cached on the task for 10 + `nextInt(5)` ticks whichever monster asked. Ported in `NearestMonster` (`village-ai.js`) and replayed against 128 native tasks over eight terrains in `villager-polish.test.js` (path end, per-tick result, cache state, draws). Since batch 18 this reach check is exempt from the port's per-tick search budget (`getPathToEntityLiving(target, true)`; 1.7.10 has no budget), so a busy tick can no longer read a reachable monster as unreachable (`villager-polish.test.js` runs it with an exhausted budget).
- NearestMonster uses the full probe-verified IMob set; creepers are excluded by `golemCanAttack` as natively.
- Parity is not complete.

## Batch 20: EntityAIDefendVillage (probed)

`EntityAIDefendVillage` (`vm`) is `EntityAITarget(golem, false, true)`: after `Village.findNearestVillageAggressor` (distance squared, `<=` keeps the later of equal distances, alive entities only) or, on a 1 in 20 roll, `findNearestTargetPlayer`, the candidate must pass the nearbyOnly `canEasilyReach` path check. The check and its draw (`nextInt(5)` on the golem's Random, cached for 10 + that many ticks) are now shared with the nearest-monster task; replayed by `src/village-aggressors.test.js` against `village-aggressors-reference.json`. Every living attacker of a villager is an aggressor (see `village.md`, batch 20).
