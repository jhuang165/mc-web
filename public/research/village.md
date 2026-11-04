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

- Entity-state packets 12/13/14 are drawn as particles from a visual Random (not Entity.rand), so particle positions are not native-reproducible.
- MoveIndoors skips the native rain biome check and `hasNoSky`; MoveThroughVillage does not break doors.
- Zombies do not target villagers and do not convert them; only the local player is an attacker in the village aggressor list.
- The default-reputation flag (`bz`) has no setter, so the +5 starting reputation is not given.
- Java import does not read `villages.dat` or villager entities; villages restart from door scanning after an import.
- Villages from world generation are not pre-registered: a generated village becomes a record once a villager has registered a position near its doors.
- Parity is not complete; this covers the listed systems only.
