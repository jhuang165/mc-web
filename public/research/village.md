# Villages, village AI and villager breeding (Java 1.7.10)

Ported from VillageCollection (`wc`), Village (`vz`), VillageDoorInfo (`vy`), VillageAggressor (`wa`) and the village-dependent EntityAI tasks of EntityVillager (`yv`): EntityAIMoveIndoors (`ur`), RestrictOpenDoor (`ve`), VillagerMate (`up`), FollowGolem (`vj`), Play (`va`), MoveTowardsRestriction (`ut`). Code: `src/village.js` (records), `src/village-host.js` (the EntityWorld side), `src/village-ai.js` (tasks), `src/home-area.js` (EntityCreature home area and the RandomPositionGenerator home/direction rules). The golem is in `iron-golem.md`.

## Evidence

`tools/probes/VillageLiveProbe.java` (run by `tools/verify-village.mjs`, 21 records in `public/research/village-live-reference.json`) drives the unchanged classes from `tools/research/minecraft-1.7.10.jar` (SHA1 e80d9b3b...) on a flat probe world. Replayed by `src/village.test.js`, `src/village-ai.test.js` and `src/iron-golem.test.js`:

- scenario x4: scripted doors and villager positions, village digests on change and door rows every 200 ticks (merge, aging, removal, reputation).
- golemSpawn x3: 21 doors and 10 villagers, the tick and cell of the first spawned golem on the seeded world Random.
- reputation, matingSeason, doorMath: clamp -30..10, aggressive at -15, mating season 3600 ticks, door distances, restriction counters and findNearestVillage.
- gates (1440 rows): shouldExecute and the next Random draw of MoveIndoors, RestrictOpenDoor, LookAtVillager, FollowGolem and Play over day/rain/seed.
- mating x5: the first gate tick, the 300-tick run, heart ticks, birth tick, child (profession from the world Random, age -24000, position), both parents' ages (6000) and mating flags.
- NBT and browser JSON round trip of the village list (`data/villages.dat` layout from `Village.writeVillageDataToNBT`).

## What runs live

- `EntityWorld.villages` ticks every game tick (before entities). Villagers register their position every 70 + nextInt(50) ticks (EntityVillager.updateAITick), find the village within 32 blocks and take a home area of int(radius * 0.6F); without a village the home is detached.
- Doors are counted from registered positions (16 x 4 x 16 scan, one position per tick), merged into villages, aged and dropped as in the native class; a village spawns an iron golem by its native rule.
- Reputation: hitting a villager -1 (-3 for a child), killing -2, restock with a remembered buyer +1. A player at -15 or below is a golem target. A villager killed by a monster, or one that dies unseen with the player within 16 blocks, ends the mating season.
- Villager task list now follows the native priorities: 0 swim, 1 avoid zombie, 1 trade, 1 look at trader, 2 MoveIndoors (1.0), 3 RestrictOpenDoor, 4 OpenDoor, 5 MoveTowardsRestriction (0.6), 6 VillagerMate, 7 FollowGolem, 8 Play (0.32), 9 watch, 9 wander, 10 watch.
- Breeding: willing adults (growing age 0) near a door-rich village (villagers < int(doors * 0.35), not in an ended mating season) walk together; after 300 ticks within 1.5 blocks a child (age -24000, random profession) appears and both parents get age 6000.
- Persistence: the browser save keeps `villages` (door list, radius, reputation, mating timestamp); a Java export writes `data/villages.dat` (positions shifted by the export origin).

## Approximations and open items

- Entity-state packets 12/13/14 (hearts, angry, happy villager) are drawn by the client copy of the entity in the original, so the draws come from a per-entity visual Random (`visualRandom` in `village-ai.js`), never the server Entity.rand. The draw order and positions (3 nextGaussian * 0.02, then 3 nextFloat per particle, five particles, baby size 0.3 x 0.9) are replayed in `villager-polish.test.js` (72 native cases); the seed itself is free, as the client entity's is.
- MoveIndoors now has the native clear-daytime rule: it returns early only when day, not raining and `BiomeGenBase.canSpawnLightningBolt` (deserts and snowy biomes do not return by day), or when the dimension has no sky (1,920 native rows). MoveThroughVillage never breaks doors itself: it only forbids closed doors for its own path search (see Batch 18 below).
- Zombies now hunt villagers and convert them (see `zombie-villager.md`); only the local player is an attacker in the village aggressor list.
- The default-reputation flag (`bz`, set by a cured zombie villager, `cd()`) gives every player the village already knows +5 once, on the first `updateAITick` that finds a village within 32; with no village the flag stays set, and players the village has no entry for get nothing (48 native cases, `villager-polish-reference.json`).
- Java import reads `data/villages.dat` (villages whose centre is inside the imported area, shifted like entities; others are dropped and counted) and the Villager, VillagerGolem and Zombie entities (`src/java-mobs.js`). Imported mobs lose AI timers and the home area. When mobs are imported the world's usual animal seeding is skipped.
- Villages from world generation are not pre-registered: a generated village becomes a record once a villager has registered a position near its doors.
- Parity is not complete; this covers the listed systems only.

## Batch 18: EntityAIMoveThroughVillage (probed)

`tools/probes/MoveThroughVillageProbe.java` + `tools/verify-mob-doors.mjs` run the unchanged `us` on a zombie in the VillageLiveProbe double (12-door village, 20 rounds each of shouldExecute / startExecuting / continueExecuting / resetTask; day or night, nocturnal or not, navigator door flag on or off, 3 seeds; open ground, a zombie walled into a stone cell, and the village's door objects replaced by equal-coordinate clones): 120 records in `mob-doors-reference.json`, replayed by `src/mob-doors.test.js` (door chosen, path end, the navigator's `canBreakDoors` flag after each call, visited list, next Random draw). Bytecode and probe agree on four rules the port had approximated:

- The search forbids closed doors (`setBreakDoors(false)`) only around the two `getPathToXYZ` calls, then restores the saved flag. `startExecuting` is just `setPath(path, speed)` and `resetTask` only records the door; neither touches the flag (the port set it false and then true).
- The visited list holds doors by coordinates: `us.a(vy)` compares x, y, z, not identity, so a rebuilt village's clones are still excluded (the port compared objects). The list drops its first entry per `shouldExecute` while longer than 15; a door is added when the path is finished or the entity is within 4 blocks.
- `nocturnal` (third constructor argument) returns false in daylight: the zombie passes false (it walks through villages in the day, priority 6), villagers and golems pass true.
- When the path is null the task draws `findRandomTargetBlockTowards(10, 7, door)` and paths to that cell with the same flag handling (draws replayed through the walled scenario).

The task does not break doors; breaking is the zombie's own `EntityAIBreakDoor` ([mob riding](mob-riding.md)). Not probed: a walking zombie following the path to the door in a ticking world.
