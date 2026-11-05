# Ocelots (EntityOcelot, "Ozelot", id 98) in Minecraft Java 1.7.10

Evidence: `public/research/ocelot-reference.json`, written by `tools/verify-ocelot.mjs` from `tools/probes/OcelotProbe.java`. The probe drives the unchanged obfuscated classes (`wn` EntityOcelot, `tg` EntityTameable, the task classes, `bht` ModelOcelot) on the `MobMoveProbe` world double. Seeds go through splitmix64 so small seeds are not correlated; `src/ocelot.test.js` reproduces that.

## What is implemented

- Entity: 0.6 x 0.8, speed 0.3, 10 health tamed or wild, no drops, no fall damage, hurt and death `mob.cat.hitt` at volume 0.4. Despawn only for a wild ocelot older than 2400 ticks.
- Tasks (priority, mutex): Swim 1; Sit 2; Tempt 3 (raw fish, 0.6, scared by the player's movement or look); Avoid player 4 (16 blocks, 0.8 far, 1.33 near); FollowOwner 5 (10 to 5); OcelotSit 6 (1.33); Leap 7 (0.3); OcelotAttack 8; Mate 9; Wander 10; WatchClosest 11. Target: chickens (750). Creepers avoid ocelots within 6 blocks (1.0 far, 1.2 near).
- Taming: a raw fish (cod, salmon, clownfish, pufferfish) on a wild ocelot that is tempted and within 3 blocks: one chance in three, then CatType 1 + nextInt(3). Otherwise the click follows the breeding path.
- Sitting: the owner's non-fish click toggles the sit wish; a tamed cat may start sitting on a free chest, lit furnace, or bed foot within 8 blocks (0.0065 per tick). A sitting cat on a chest blocks opening it.
- Move speed 0.6 shows sneaking, 1.33 sprinting while the move helper is updating.
- Breeding: tamed pairs in love (sitting is not checked); the kitten of a tamed parent copies owner and CatType. A spawn egg gives two kittens one time in seven.
- Sounds: a wild ocelot is silent; a tamed cat purrs in love, otherwise purreow one time in four, else meow.
- Model: ModelOcelot parts a to h in the four poses (sneak, stand, sprint, sit), checked against the 13 probe rows; the four CatType textures; 0.8 scale when tamed; kitten head scale 1.5.
- Persistence: save records, region export (Ozelot NBT with CatType, Sitting, OwnerUUID, Age, InLove), region import, `/summon Ozelot`, mob spawner entity id.
- Natural spawning: an approximate jungle-biome pass (`src/ocelot-spawn.js`) using the probe's `getCanSpawnHere` rule.

## Gaps

- No worldgen or chunk-time ocelot population. The live spawn pass is approximate: jungle biomes only, random points, a 2% chance per tick, cap of 10 ocelots.
- Avoid and pathing behaviour is derived from bytecode; probing reached the pathfinding NPE of the world double. The `ocelotNearPlayer` avoid rows are unexplained and not asserted.
- The scared check in Tempt needs the player's look (`EntityWorld.playerLook`, set in `main.js`); without it only movement counts.
- Kitten growth by feeding fish is not modelled. The original returns false for a kitten with fish.
- Single-player owner only (the owner is a name string, not a UUID).
- The owner's sit click returns "used" here; the original returns false from interact after setting the sit wish.
- Sounds: `cat` was added to the import regex in `tools/import-vanilla-media.mjs` but the import needs network and was not run, so no `mob.cat.*` audio files exist yet and `media.test.js` is unchanged. Until then the cat sounds are silent.
- No browser or visual check was made (no dev server by rule); rendering is verified only through the model pose maths test.
- Region import of `Ozelot` has a single test, not an end-to-end save round trip.
