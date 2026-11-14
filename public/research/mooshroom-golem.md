# Mooshroom and snow golem (1.7.10)

Source of truth: `tools/probes/MooshroomGolemProbe.java` runs the unchanged obfuscated classes (wm EntityMooshroom, wh EntityCow, wr EntitySnowman, amw BlockPumpkin, zj EntitySnowball, bif ModelSnowMan, and helpers) on a world double. `tools/verify-mooshroom-golem.mjs` (set `MC_RESEARCH`) writes `public/research/mooshroom-golem-reference.json`: 141 records (facts, step, tasks, shear, bowl, bucket, breed, spawn, drops, build, trail, damage, fall, shoot, flight, think, plus one `model`). `src/mooshroom-golem.test.js` checks the port against it.

## Mooshroom ("MushroomCow", id 96)

- Extends the cow: 10 health, 0.9 x 1.3, cow tasks, sounds and step, leather and beef drops, wheat breeding. A mooshroom pair makes a mooshroom calf; a calf cannot be sheared or milked into stew.
- Bowl: one bowl becomes stew; a stack of bowls adds a stew when there is room. Creative with a stack of 2 and a full inventory return false, as probed (`useBowl` in `src/mooshroom.js`).
- Bucket: milk, through the existing bucket path (`buckets-simulation.js` now accepts a mooshroom).
- Shears: the mooshroom becomes a cow (same position, yaw, pitch and health), drops 5 red mushrooms at height 1.3, a `largeexplode` particle and the shear sound; the shears lose 1 durability outside Creative.
- `/summon MushroomCow`, save, region export and import, population spawn (`MushroomCow`).

## Snow golem ("SnowMan", id 97)

- 0.4 x 1.8, 4 health, speed 0.2, eye height 1.53, no talk or hurt sounds.
- Built by a pumpkin or jack o'lantern on two stacked snow blocks (`tryBuildGolem` in `mooshroom-golem-live.js`, which tries the snow golem and then the iron golem). A gap or a single block builds nothing.
- Melts in warm biomes (temperature above 1.0, 1 damage per tick) and in water. It leaves snow layers on the four cells a quarter block around it where the temperature is below 0.8.
- Shoots snowballs every 20 ticks within 10 blocks with sight, at monsters only; the ball does 0 damage and knocks back. Drops `nextInt(16)` snowballs. Falls do nothing.
- Renderer: ModelSnowMan boxes from the probe dump, `snowman.png`, pumpkin head.

## Gaps

- Mooshroom natural spawning: `EntityAnimal.getCanSpawnHere` needs grass, so mooshrooms cannot spawn on mycelium at runtime. They exist through chunk population and `/summon` only; no mushroom island biome spawning is added.
- The `snowshovel` build burst (120 particles) is still not drawn (no snowshovel kind in `src/`); Batch 69 (docs sweep): `snowballpoof` impact particles are drawn (`src/object-tracker.js`, `sims.balls.poof`).
- Renderer: the mushroom placement on the cow and the pumpkin head transform are approximations of the RenderBlocks calls, not matched to bytecode. ModelSnowMan arm and body animation angles are reconstructed, not probed (the boxes are probed). Not checked in a browser.
- Snow golem balls do not damage the player or other mobs than the golem's targets (golems only target monsters). Golems do not retaliate against the player.
- Spawn eggs and the mob spawner id list were left alone.
- Not verified: nothing was run in a browser; `snowGolemUpdate` and `GolemBalls` are covered by the pure-rule tests only.
