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
- Batch 69 (docs sweep): trading is live (`src/villager-trading.js`, `src/villager-offers.js`, [villager trading live](villager-trading-live.md)). Original text: Trade, LookAtTrade, offers, riches use and Offers on export were not live.
- Village systems (door records, reputation, mating, golems, MoveIndoors/RestrictOpenDoor/FollowGolem/Play/MoveTowardsRestriction and the home area) now run from `src/village.js` and `src/village-ai.js`; see `village.md` and `iron-golem.md` for what is native-verified and what is approximated.
- Batch 69 (docs sweep): zombies target and infect villagers (`src/zombie-villager.js`, [zombie villager](zombie-villager.md)).
- Batch 69 (docs sweep): Java-save import converts mobs (`src/java-mobs.js`), including villagers (see [villager trading live](villager-trading-live.md)).
- Step sounds were not compared with the native trace.
- Full parity is not claimed.
