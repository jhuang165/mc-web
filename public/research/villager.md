# Villager (1.7.10 EntityVillager, `yv`) without trading

Evidence: `tools/probes/VillagerProbe.java` runs the unchanged 1.7.10 classes (EntityVillager, EntityAIAvoidEntity, EntityAIOpenDoor, EntityAIWander, BlockDoor, ModelVillager, RenderVillager). `tools/verify-villager.mjs` regenerates `public/research/villager-reference.json`. `src/villager.test.js` replays it.

Native records: 3 wander traces, 2 avoid traces (static and chase zombie), 2 door traces, 8 sound-pitch records, 400 drop trials.

## Live
- Spawn from generation records `{type:"Villager",x,y,z,profession}`; saved, reloaded and exported (Java id `Villager` with Profession, Riches, Age).
- Original profession textures (farmer, librarian, priest, smith, butcher; others use villager.png) on ModelVillager geometry, scale 0.9375 (halved for a child), legs at 0.5 of the biped amplitude, folded arms.
- Tasks: Swim, AvoidEntity (zombie, 8 blocks, 0.6/0.6), OpenDoor (wooden doors only, open 20 ticks), WatchClosest (3, 5, 8), Wander 0.6, and the `bp` random-tick-divider draw.
- The AI uses the entity's shared `Entity.rand`, so seeded replays match native positions, door metadata and living-sound pitches exactly.
- 20 health, no drops, 0 experience, talk interval 80, sounds mob.villager.idle/hit/death.

## Not live (limits)
- Trading (Trade, LookAtTrade, offers, riches use), no Offers written on export.
- No VillageCollection: no door counting, iron golems, mating, reputation. MoveIndoors and VillagerMate only draw their random numbers and never start. RestrictOpenDoor, MoveTowardsRestriction, FollowGolem and Play are not implemented.
- Zombies do not target or infect villagers.
- Java-save import does not convert mobs; villagers there count as lost like other mobs.
- Step sounds were not compared with the native trace.
- Full parity is not claimed.
