# Natural spawning (SpawnerAnimals) in Minecraft Java 1.7.10

Batch 13 replaces this build's separate spawn passes with one port of `SpawnerAnimals.findChunksForSpawning` (`aho.a(mt, ZZZ)`), driven by the BiomeGenBase spawn lists. The old passes are gone: the night ring for zombies, skeletons, creepers, spiders and witches, the slime clock, the enderman clock, the squid and bat pass, the ocelot pass (`ocelot-spawn.js`) and the separate Nether/End pass. All natural spawning now goes through `src/spawner-animals.js` and `EntityWorld.naturalSpawn` (`src/entities.js`). Chunk-population animals (`performWorldGenSpawning`) were already ported in `population-tail.js`, and they now read the same lists.

This is not full parity. The sections below say which parts come from probe records, which come only from bytecode, and which are approximations.

## Files

- `src/spawn-lists.js`:
  - EnumCreatureType: caps 70/10/15/5, materials, and the peaceful and animal flags.
  - The four spawn lists of every one of the 61 registered biome slots, as `[EntityList name, weight, min, max]`.
  - BiomeGenHell, BiomeGenEnd, the fortress list (`MapGenNetherBridge.getSpawnList`) and the witch hut list (`MapGenScatteredFeature.getScatteredFeatureSpawnList`).
  - `getMaxSpawnedInChunk`: Ghast 1, horse 6, wolf 8, all others 4.
  - The creature type each listed mob counts as.
- `src/spawner-animals.js`: the control flow, in World.rand order. It holds the eligible-chunk HashMap order (`ChunkCoordIntPair.hashCode`, `java.util.HashMap` bucket order with a 512 table), the per-type cap, `canCreatureTypeSpawnAtLocation`, and 3 groups × 4 attempts per chunk. The world comes in through a `ctx` object.
- `src/entities.js`:
  - `naturalSpawn` builds that `ctx` from the live world: blocks, light, biome, dimension and the fortress and witch hut lookups.
  - `spawnerHooks().canSpawnHere` holds each mob's `getCanSpawnHere`.
  - `onSpawnWithEgg(e, {group})` passes the group's IEntityLivingData from one spawn to the next. That covers the spider's GroupData (its effect), the zombie's GroupData (child and villager), the sheep fleece colour and ocelot kittens.
- `src/main.js` sets `mobs.naturalSpawning = true` for every played world, finite, streamed and dimension. Headless tests and tools leave it off unless a test turns it on.

## Per-tick flow

`WorldServer.tick` (`mt`, read from the bytecode) calls the spawner only when the `doMobSpawning` gamerule is true. It calls `findChunksForSpawning(world, spawnHostileMobs, spawnPeacefulMobs, worldInfo.getWorldTotalTime() % 400 == 0)`.

- Here, `EntityWorld.tick` makes the same call each tick, gated by `gameRule("doMobSpawning")`.
- The hostile flag is `difficulty != Peaceful`, and the peaceful flag is always true. These are the values the integrated server sets through `setAllowedSpawnTypes`.
- So on Peaceful no monster type is visited, but creatures, ambient mobs and water creatures still spawn.
- The animal flag is `totalTime % 400 == 0`, where `totalTime` is the saved total world time (`record.totalTime`, level.dat `Time`). `WorldServer.tick` reads it before it adds 1 (bytecode `mt.b`: the spawner call comes before `ays.b(f() + 1)`), so a world saved at total time T sees T on its next tick. `EntityWorld.loadTotalTime` and `saveTotalTime` do this in `main.js`; a record without the field starts from the player's time.
- Population animals (`performWorldGenSpawning`) are not gated by the gamerule, as in 1.7.10.

For each creature type:

1. The type is skipped when it is not allowed by the flags, or when `countEntities(type) > max * eligibleChunks / 256`. `eligibleChunks` is always 289 for one player and `countEntities` counts every loaded non-persistent mob of the type, ticking or not (see the approximations).
2. For each non-edge chunk in HashMap order, a random point is drawn: `nextInt(16)`, `nextInt(16)`, then `nextInt(getTopFilledSegment + 15)`.
3. The point is used only if its block is not a normal cube and its material is the type's (air, or water for squid).
4. Up to 3 groups are made, each of up to 4 attempts. Each attempt moves the position by `nextInt(6) - nextInt(6)` on x and z and by `nextInt(1) - nextInt(1)` on y.
5. An attempt is rejected inside 24 blocks of a player, or inside 24 blocks of the world spawn point (using float math).
6. A group's first valid point runs `spawnRandomCreature`, a WeightedRandom pick on World.rand.
7. Each spawn gets `setLocationAndAngles` with a random yaw, then `getCanSpawnHere`, then `onSpawnWithEgg`.
8. Once a chunk has `getMaxSpawnedInChunk` spawns, the loop moves on to the next chunk.

Dimensions use the same flow.

- **Nether:** `ChunkProviderHell.getPossibleCreatures` returns the fortress list inside a fortress (`DimensionWorld.fortressSpawns`, the bridge's bounding boxes). Outside a fortress it returns BiomeGenHell's list (ghast, zombie pigman, magma cube).
- **End:** BiomeGenEnd's list (endermen in groups of 4).
- **Both:** the creature, ambient and water lists are empty. Light comes from the dimension's block light and the provider's brightness table.
- **Overworld:** `ChunkProviderGenerate.getPossibleCreatures` returns the witch hut list (witches) for monsters inside a swamp hut. Otherwise it returns the biome's list.

## What the probe replays

`tools/verify-spawn-lists.mjs` runs `tools/probes/SpawnListProbe.java` twice on the unchanged 1.7.10 classes; the two runs must match. It writes `public/research/spawn-lists-reference.json`, and `src/spawner-animals.test.js` checks the port against it.

- EnumCreatureType `values()`: caps, materials and flags.
- All 61 biome slots (`getBiomeGenArray`): the four `getSpawnableList` lists and `getSpawningChance`, which is 0.1 for every biome. The population-tail creature lists are checked against the same records.
- `getMaxSpawnedInChunk` and the creature type for each of the 57 listed or structure entities.
- The fortress and witch hut lists.
- The eligible-chunk HashMap iteration order for 5 player chunks, including negative and far coordinates.
- `canCreatureTypeSpawnAtLocation` down the columns of the replay terrain, for every type.
- Four seeded `findChunksForSpawning` replays: "near" (120 ticks), "far" (160 ticks), "negative" (80 ticks, with a spawn point away from the origin) and, since batch 14, "wet-caves" (240 ticks). Together they cover 600 ticks and 499 spawns.
  - "wet-caves" uses the jungle, jungle edge and swamp-M slots and air pockets at y 30 to 35 under every other chunk, so cave spawns and bats occur (19 bats, 37 creepers, 27 zombies, 20 skeletons). Plain swamp is left out on purpose: a slime's size rolls on the unseeded entity Random, so the probe would not repeat. Ocelots, slimes and horses therefore still rest on their own probes (`OcelotProbe`, `SlimeProbe`, the horse bytecode).
  - The world double is stone with a grass top at y 63 to 66 in 8-block cells, with water ponds. It uses one fixed biome per chunk from plains, jungle, taiga, extreme hills, desert, mushroom island, forest and ice plains. It has no light, but gives full block light to EntityAnimal. It is set to Normal difficulty, local difficulty 0 and 31 October. The probe passes the animal flag every 40 ticks so creature passes come often.
  - Every tick is compared: each `spawnEntityInWorld` (name, position, yaw, child and villager state, age, riding, fleece), the return value, and the World.rand seed after the tick.
  - All 499 spawns and seeds match. The checked paths are: the HashMap order; the draws and jitter; the caps (including the cap reached mid-run); the distance rules; the weighted pick; group data for zombies (child and villager) and spiders; chicken jockeys; sheep fleece; squid in the ponds; and the monster light and animal grass rules on the probe terrain.
  - The replayed mobs are zombies, skeletons, creepers, spiders, endermen, witches, sheep, pigs, chickens, cows, wolves, mooshrooms and squid.

## Read from bytecode only, not replayed

- The `WorldServer.tick` call: the `doMobSpawning` gate, the hostile and peaceful flags, and `getWorldTotalTime() % 400`.
- `getPossibleCreatures` in `ChunkProviderGenerate` (the witch hut test runs before the biome list), `ChunkProviderHell` (fortress, then BiomeGenHell) and `ChunkProviderFlat` (no huts). The lists themselves are probed.
- Mob rules that no replay reached. Each has its own probe elsewhere:
  - bat light and height (SquidBatProbe);
  - the slime chunk and swamp rules (SlimeProbe);
  - the ocelot's `nextInt(3)` (OcelotProbe);
  - the blaze path weight;
  - the ghast's 1-in-20 roll;
  - the zombie pigman and magma cube space checks.
- Horses: foals roll on the unseeded entity Random, so the probe has no horse biome. The horse group data path is bytecode-derived.

## Portal pigmen

`BlockPortal.updateTick` (probed in `PortalWartProbe`, 14 pigman records over 30000 ticks) spawns a pig zombie on a portal block's random tick: `world.provider.isSurfaceWorld() && doMobSpawning && rand.nextInt(2000) < difficultyId`, then a search down for a solid top and `ItemMonsterPlacer.spawnCreature` at y + 1.1 with `timeUntilPortal = 300`. `NetherLive.randomTick` runs it from the live block tick (`main.js` supplies the difficulty id, the gamerule and `EntityWorld.spawnPortalPigman`). The gates short-circuit before the draw, so a Nether, End or `doMobSpawning false` tick consumes no randomness. The pigman's `onSpawnWithEgg` (`yh.a`) is EntityZombie's plus `setVillager(false)`: about 5 % of portal pigmen are children and about 5 % of those get a chicken jockey (a nearby chicken, else a new one), never a villager. The port now does the same; `tools/probes/PigmanJockeyProbe.java` (`verify-pigman-jockey.mjs`, [pigman-jockey-reference.json](pigman-jockey-reference.json)) ran 20000 spawns on each difficulty and `src/pigman-jockey.test.js` replays the child flags, the chicken events and the world Random's state. In the probe's double no chicken stands nearby, so the nearby-chicken branch is covered only by the shared zombie code.

## Approximations

- **Eligible chunks (closed in batch 14):** the cap uses 289 (`ELIGIBLE_CHUNKS`) in every world, as `eligibleChunksForSpawning.size()` is natively, so the monster cap is 70 × 289 / 256 = 79. Points are still drawn only in chunks this build simulates (the 6×6 ticking window in a streamed world, the in-bounds chunks of a finite one); the other chunks of the 17×17 window are skipped without draws. Natively all 225 non-edge chunks are visited, so the density of mobs per visited chunk is higher here than natively, and mobs cluster nearer the player.
- **Counting (closed in batch 14):** `countEntities` counts every non-persistent mob in `EntityWorld.entities`, including mobs frozen outside the ticking window, as `World.countEntities` walks the whole loaded entity list. `sweepFrozen` drops despawnable mobs that are frozen and more than 128 blocks away, standing in for their native despawn, so only frozen mobs inside 128 blocks count.
- **Animal cadence (closed in batch 14):** the saved total world time drives the 400-tick phase (see Per-tick flow). Worlds saved before batch 14 have no `totalTime` and start from the player's time. The total time advances only while the world is played; natively the Overworld also ticks while the player is in another dimension, and the Nether and End read the Overworld's value through DerivedWorldInfo.
- **Chunk height:** `getTopFilledSegment` comes from the chunk's live blocks: a scan of the streamed chunk arrays, `world.chunkTop`, or the surface height for doubles. The result is cached for 400 ticks per chunk, so a newly built tower changes the draw range only on the next rescan.
- **Witch hut lookup (closed in batch 14):** `MapGenScatteredFeature.func_143030_a` (`atx.a(int,int,int)`) reads only the structure start whose bounding box covers the point and tests that its first piece is a swamp hut. It never looks at the biome, so the lookup now runs for every monster list query whatever the block's biome slot. Flat worlds and worlds without structures have no hut lookup.
- **Spawn point in dimensions (closed in batch 14, with a correction):** the Nether and End do not have a spawn point of their own. `WorldServerMulti` (`mm`) sets its WorldInfo to `new DerivedWorldInfo(overworld info)`, and `World.getSpawnPoint` reads that info, so the 24-block exclusion uses the Overworld's spawn point in every dimension. `spawnPointOf(record)` in `dimension-spawning.js` returns it from the shared `record.worldSpawn`. (`WorldProvider.getSpawnPoint`, which the End overrides for the player respawn, is not what the spawner calls.)
- **Spawn collision:** `checkNoEntityCollision` here skips bats, end crystals and the dragon (this build's `pushable`). Natively `preventEntitySpawning` is true for them.
- **Entity limit:** spawning stops at 256 entities in the EntityWorld. The kittens `EntityOcelot.onSpawnWithEgg` adds (natural or egg spawns) still stop at the older 40-entity limit.
- **Old worlds:** a world without biome data reads Plains (slot 1).
- **Persistence:** mobs this build marks persistent (for example bred animals) are left out of the count, as `persistenceRequired` mobs are natively; which mobs carry the flag follows each mob's own port.

## Performance

The spawner caches its context, the HashMap order (rebuilt only when the player's chunk or the streaming origin changes) and the chunk heights.

These numbers come from `node --test src/spawner-animals.test.js`, on a `javaStreamed` world (seed "17", generation 12) at night with every chunk dark, after 50 warm-up ticks:

| Case | Mean per tick | p99 | Spawned per tick |
| --- | --- | --- | --- |
| Capped: mobs accumulate, so the monster cap ends most passes early | 0.015 ms | 0.04 ms | 0.04 |
| Uncapped: entities cleared before each tick, so every type visits all 36 chunks | 0.15 ms | 1.3 ms | 6 |

The first tick costs about 6 ms, because it scans the heights of 36 chunks with a cold JIT. The 400-tick rescan of the heights costs up to about 2.5 ms in one tick. The test fails if the uncapped mean exceeds 2 ms.

## Tests

`src/spawner-animals.test.js` covers:

- the lists for every biome against the reference;
- the caps and flags;
- the HashMap order;
- the location columns;
- the three seeded replays;
- the 24-block player and spawn-point rules;
- cap scaling;
- which types each flag combination visits (Peaceful);
- group data threading;
- the 400-tick creature cadence, driven by the saved total world time;
- the 289 eligible-chunk cap, with mobs outside the ticking window counted;
- the witch hut list outside swamp slots;
- the Nether and End spawn-point exclusion;
- the portal pigman (`src/nether-portal-wart.test.js`: rate by difficulty id, `doMobSpawning` and non-surface gating without draws; `EntityWorld.spawnPortalPigman`);
- the `doMobSpawning` gamerule;
- Peaceful in a live world;
- streamed-world eligibility (points only in ticking chunks, 289 counted for the cap, height scan);
- the Nether fortress and BiomeGenHell lists, plus the End and Peaceful in dimensions;
- the timing bench.

`src/dimension-spawning.test.js`, `src/entities.test.js`, `src/difficulty.test.js` and `src/spider.test.js` drive the live pass.
