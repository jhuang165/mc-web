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
- Horses: since batch 18 the horse biome (plains and savanna slots) is replayed with the entity Random seeded; see Round 2 replays below.

## Round 2 replays (batch 18)

`tools/verify-spawn-replay2.mjs` runs `tools/probes/SpawnReplay2Probe.java` twice on the unchanged jar (outputs must match) and writes `public/research/spawn-replay2-reference.json`; `src/spawner-replay2.test.js` replays it through `EntityWorld.naturalSpawn` and compares every spawn (name, position, yaw, extras, horse stats within 1e-6, skeleton type and gear), the return value and the World.rand state per tick.

- Seeding Entity.rand: slimes, magma cubes, skeletons, ghasts and horses draw from the entity's own `Random` (`sa.Z`), which is unseeded natively. The probe seeds it inside `setLocationAndAngles` (after the yaw draw, before `getCanSpawnHere` and `onSpawnWithEgg`) with the World.rand state; the port does the same through `entitySeed` (tests) or a random seed (live) when the spawner creates the mob. The slime repeats its constructor draws first: size `1 << nextInt(3)`, then jump delay `nextInt(20) + 10`. A skeleton riding a spider keeps the unseeded Random, so its gear is not recorded.
- Replays (8): slime-swamp-full, -new and -lit (swamp slime chunk rule, moon phase from a real WorldInfo day time, light roll, size roll), ocelot-jungle and ocelot-only (jungle list, `canSpawn` grass and height rule, kittens), horse-plains (plains and savanna group data, foal, variant, speed, jump and health rolls), nether-fortress (pigmen, ghast, blazes, wither skeletons and magma cubes through the fortress list) and end-endermen. All pass.
- Horse group data: `onSpawnWithEgg` has a `horse` branch calling `horseSpawn` (`src/horse-live.js`), which threads the group data from one spawn to the next.
- Frozen mobs: `sweepFrozen` emulates native `despawnEntity` for despawnable mobs outside the ticking window: beyond 128 blocks they go at once, otherwise the idle counter grows by 20 per sweep and past 600 they are removed with probability `1 - (799/800)^20`.
- Fixed by the replays: bats did not block spawn boxes.
- Total world time: `totalTime` is per save and advances only while the world is played. Natively the Overworld ticks while the player is in other dimensions, and the Nether and End read the Overworld's value through `DerivedWorldInfo`; this build keeps one counter that advances in whichever dimension is played, so the 400-tick animal cadence is the same. Nothing else differs that a single-player save can observe.
- Not probed: the probe uses a stand-in fortress box (a fortress chunk and y 30..60) rather than real `MapGenNetherBridge`; the Nether replay has only one ghast; light rolls are at light 0 except in the lit slime replay; riding-skeleton gear; the kitten limit of 40 versus none natively.

## Portal pigmen

`BlockPortal.updateTick` (probed in `PortalWartProbe`, 14 pigman records over 30000 ticks) spawns a pig zombie on a portal block's random tick: `world.provider.isSurfaceWorld() && doMobSpawning && rand.nextInt(2000) < difficultyId`, then a search down for a solid top and `ItemMonsterPlacer.spawnCreature` at y + 1.1 with `timeUntilPortal = 300`. `NetherLive.randomTick` runs it from the live block tick (`main.js` supplies the difficulty id, the gamerule and `EntityWorld.spawnPortalPigman`). The gates short-circuit before the draw, so a Nether, End or `doMobSpawning false` tick consumes no randomness. The pigman's `onSpawnWithEgg` (`yh.a`) is EntityZombie's plus `setVillager(false)`: about 5 % of portal pigmen are children and about 5 % of those get a chicken jockey (a nearby chicken, else a new one), never a villager. The port now does the same; `tools/probes/PigmanJockeyProbe.java` (`verify-pigman-jockey.mjs`, [pigman-jockey-reference.json](pigman-jockey-reference.json)) ran 20000 spawns on each difficulty and `src/pigman-jockey.test.js` replays the child flags, the chicken events and the world Random's state. In the probe's double no chicken stands nearby, so the nearby-chicken branch is covered only by the shared zombie code.

## Approximations

- **Eligible chunks (round 2, batch 18):** the cap uses 289 (`ELIGIBLE_CHUNKS`), and points are now drawn in every resident chunk of the 15×15 non-edge set, ticking or not (`spawnChunkTop` uses `world.chunkAt` when the world has one; the ticking window only applies to worlds without it). Natively `getChunkFromChunkCoords` loads or generates a chunk that is not loaded, with no `chunkExists` check. This build cannot generate 225 chunks per tick, so a chunk that is not resident is skipped without draws; that is the closest faithful choice, and it is the one remaining divergence: the streamed window is 8×8 columns, far smaller than 17×17, so a streamed world draws in fewer chunks than native and mobs sit nearer the player. Finite worlds and the replay doubles cover the whole set.
- **Resident window vs eligible area (measured in batch 19; spawning data closed in batch 21 for populated worlds with a worker, see Round 4):** see Round 3 below. The streamed window is a fixed 8x8 columns (`World.windowAt`: chunk -4..+3 around the player, independent of the 12-chunk render distance), so 64 of the 225 non-edge eligible chunks (28 %) can be drawn in; no cheap enlargement exists, so it stayed a documented divergence until batch 21; the headless ring (Round 4) now supplies the spawn data. Rendering, edits and mob movement there remain divergent.
- **Counting (closed in batch 14):** `countEntities` counts every non-persistent mob in `EntityWorld.entities`, including mobs frozen outside the ticking window, as `World.countEntities` walks the whole loaded entity list. `sweepFrozen` drops despawnable mobs that are frozen and more than 128 blocks away, standing in for their native despawn, so only frozen mobs inside 128 blocks count.
- **Animal cadence (closed in batch 14):** the saved total world time drives the 400-tick phase (see Per-tick flow). Worlds saved before batch 14 have no `totalTime` and start from the player's time. The total time advances only while the world is played; natively the Overworld also ticks while the player is in another dimension, and the Nether and End read the Overworld's value through DerivedWorldInfo.
- **Chunk height:** `getTopFilledSegment` comes from the chunk's live blocks: a scan of the streamed chunk arrays, `world.chunkTop`, or the surface height for doubles. The result is cached for 400 ticks per chunk, so a newly built tower changes the draw range only on the next rescan.
- **Witch hut lookup (closed in batch 14):** `MapGenScatteredFeature.func_143030_a` (`atx.a(int,int,int)`) reads only the structure start whose bounding box covers the point and tests that its first piece is a swamp hut. It never looks at the biome, so the lookup now runs for every monster list query whatever the block's biome slot. Flat worlds and worlds without structures have no hut lookup.
- **Spawn point in dimensions (closed in batch 14, with a correction):** the Nether and End do not have a spawn point of their own. `WorldServerMulti` (`mm`) sets its WorldInfo to `new DerivedWorldInfo(overworld info)`, and `World.getSpawnPoint` reads that info, so the 24-block exclusion uses the Overworld's spawn point in every dimension. `spawnPointOf(record)` in `dimension-spawning.js` returns it from the shared `record.worldSpawn`. (`WorldProvider.getSpawnPoint`, which the End overrides for the player respawn, is not what the spawner calls.)
- **Spawn collision (bats fixed in batch 18):** a bat now blocks a spawn box, as natively (`preventEntitySpawning` is set by EntityLivingBase; found when the seeded replay spawned a second bat on top of the first). End crystals and the dragon are still skipped by `pushable`.
- **Entity limit (kittens fixed in batch 19):** spawning stops at 256 entities in the EntityWorld (a safety valve; natively there is no entity cap). The kittens `EntityOcelot.onSpawnWithEgg` adds during natural spawning no longer stop at 40 (`opts.limit` is Infinity from the spawner); a spawn egg's kittens keep the older 40-entity limit.
- **Old worlds:** a world without biome data reads Plains (slot 1).
- **Persistence:** mobs this build marks persistent (for example bred animals) are left out of the count, as `persistenceRequired` mobs are natively; which mobs carry the flag follows each mob's own port.

## Round 3 replays (batch 19)

`tools/verify-spawn-replay3.mjs` runs `tools/probes/SpawnReplay3Probe.java` twice on the unchanged jar (outputs must match) and writes `public/research/spawn-replay3-reference.json` (6 replays, about 7,600 spawns); `src/spawner-replay3.test.js` replays them through `EntityWorld.naturalSpawn` comparing every spawn (name, position, yaw, extras, zombie and skeleton gear, horse stats), the return value and the World.rand state per tick. Probed natively (executed): the lit and fortress replays below. Bytecode-read only: the spider jockey path and the `aqv.a(sx, III)` fortress tests the double replicates.

- **Light rolls (item 1).** The probe double now has a lit fixture: saved sky light (`ahb.b(Sky, ...)`, 0..15 per 2-block cell), block light (0..15 per 4-block cell), `skylightSubtracted` (`ahb.j` int field; 0, 4 and 11 across replays), `ahb.P()` thunder (the real `EntityMob.isValidLightLevel` saves `j`, sets 10 and reads `ahb.k` again), `getFullBlockLightValue` (`ahb.j(III)`) and the provider's real `lightBrightnessTable` (`aqo.a()`, `aqp.a()` with ambient 0.1) behind `ahb.n`. The unchanged zombies, skeletons, creepers, spiders, endermen, witches, swamp slimes, bats, pig zombies and blazes draw `savedSky > rand.nextInt(32)` and `light <= rand.nextInt(8)` (and bats' and slimes' own rolls) on a seeded Entity.rand (every swapped class seeds in `setLocationAndAngles`, as in round 2); animals test grass and full light > 8. Replays: lit-day (sub 0), lit-night (sub 11), lit-dusk-thunder (sub 4, thundering), lit-swamp-night (swamp slime and witch lists), lit-animals-day. The port's light rules (`monsterCanSpawnHere`, the animal rule, the blaze path weight) already matched in draw order and comparison; no divergence was found there. The replays also use a real local difficulty (`World.func_147462_b` at NORMAL over a never-inhabited chunk: the moon-phase term of the real day time), which drives the zombie and skeleton gear rolls.
- **Real fortress boxes (item 2).** The probe runs the unchanged `MapGenNetherBridge` (`atd`) through its `MapGenBase` driver over the 17x17 eligible chunks (2 starts in the final window, 136 and 156 pieces, structure boxes y 48..77 and 48..69) on the double, and ChunkProviderHell.getPossibleCreatures' two tests (`atd.b` inside a piece box, `atd.d` plus a nether brick block below) pick the fortress list (blaze, pigman, skeleton, magma cube). The Nether terrain has a raised plateau (floor y 62..65) with a nether brick floor under every start's box so spawn heights meet the piece boxes (which start at y 64); elsewhere the floor is y 32..35 (hell list). `fortressMonsterSpawnList` and `MapGenNetherBridge` generate the same starts: the test compares every start's chunk, structure box and every piece record with the jar's, then replays 2,500 ticks (31 ghasts, 48 blazes, 12 skeletons, 34 magma cubes, pigmen, block light varying) matching exactly.
- **Foal and baby boxes (found by the replays).** `Entity.setSize` keeps the box's minimum corner, so a foal (or a baby zombie) rolled in `onSpawnWithEgg` has a box anchored at the adult's corner until its first move recentres it; the next group member's collision test in the same tick sees that box. The port used a centred scaled box and spawned two cows the jar refused. `anchoredShrunkBox` (mob-spawner.js) now gives the spawner the anchored box for the tick of the spawn (`spawnBoxTick`).
- **Kittens (item 4).** The 40-entity limit no longer applies to natural spawning (above).
- **Spider jockey gear (item 4, bytecode-read only).** `EntitySpider.onSpawnWithEgg` (`yn.a(sy)`): super, `World.rand.nextInt(100) == 0`, then `new EntitySkeleton`, `setLocationAndAngles(x, y, z, yaw, 0)`, `onSpawnWithEgg(null)` on the skeleton's own Entity.rand, `spawnEntityInWorld`, `mountEntity`; the port's `spawnSpiderJockey` follows that order (including the free Nether wither roll). The jockey's Entity.rand is created inside a `new` the double cannot swap, so its gear cannot be seeded and compared; the world-random draws that decide the jockey are replayed (every spider in the lit replays).
- **Spawn area beyond the resident window (item 3, measured, not changed).** The streamed window is 8x8 columns around the player (`World.windowAt`, chunk offsets -4..+3 whatever the render distance of 12), against 15x15 = 225 non-edge eligible chunks: 64 of 225 (28 %) are drawn in; the 289-chunk cap is still applied, so a streamed world reaches the cap with mobs packed into about 3.5 times the native density near the player. Enlarging eligibility was evaluated: a 15x15 draw set costs about 2.2 ms per tick against 0.6 ms for 8x8 in the spawn-heavy micro-benchmark (clearing mobs each tick, flat doubles), which would fit, but the data is the blocker: a column that is not resident would need generated terrain plus its population cell (0.6 to 1.2 s per 8x8 cell, worker-built, streaming.md), light (the sky and block light volume covers only the window) and, for mobs it spawns there, a place to live while frozen. Terrain-only columns would lack trees, lakes and structures, so heights, `canCreatureTypeSpawnAtLocation` surfaces and light would differ from native in exactly the chunks the player cannot see, and the generator runs on the page's thread. No change was made in batch 19; batch 21 (Round 4) added headless terrain, light and a frozen-mob policy.

## Round 4: headless ring (batch 21)

Natively `SpawnerAnimals.findChunksForSpawning` reads every chunk of the 15 x 15 non-edge set, and `ChunkProviderServer.provideChunk` (`ms.d`) loads or generates any chunk that is not loaded (bytecode-read: `ms.d` returns the map entry or calls `ms.c`, which clears the drop-queue entry, tries the anvil loader and otherwise `IChunkProvider.provideChunk`; `ms.b()` only unloads chunks queued by `unloadChunksIfNotNearSpawn`, which `PlayerInstance` calls when a chunk leaves the player's view, so with a view distance of at least 8 every eligible chunk is inside the view). A spawn attempt walks at most 4 steps of 5 blocks from a point in its chunk, so it reads up to 2 chunks beyond the non-edge set (assumed from the loop bounds in `aho.a`, which `spawner-animals.js` ports line for line; probed through the existing replays on doubles that supply every chunk).

Since batch 21 the port holds those chunks as data only: `src/headless-columns.js` keeps a `HeadlessColumns` ring of up to 21 x 21 chunks around the player (radius 10: 7 for the non-edge set, 2 for the walk, 1 for light inflow) beside the 8 x 8 resident window. A ring column is the generated block ids trimmed to the highest filled section (about 25 KB), the nonzero metadata as a sorted sparse list, and `Chunk.getTopFilledSegment`. It has no mesh, no light volume and no entities. Sources, nearest first: the page's population cell cache (free), the generation worker (`type: 'ring'` in `streaming-generator.js`, lowest priority, columns compacted in the worker, only when the window needs nothing), and for the Nether, End and terrain-only versions the world's own generator at one column every other tick (about 37 ms a Nether column, 11 ms an End column, about 30 s to fill). Columns beyond radius 12 are dropped as the player moves (the streamed window's unloading policy), so memory stays near 11 MB.

- **Draw order and caps.** `spawnChunkTop` returns the ring column's top for a chunk with no resident column, so `findChunksForSpawning` draws in it in HashMap order exactly as in a resident chunk; the cap still counts 289. During a spawn pass `EntityWorld.world` is a `view` (`Object.create(world)` with `get`/`getMeta` reading the resident column first, then the ring) so block, collision, liquid, biome and fortress-list reads see the ring. A column that has not arrived yet is skipped without draws (the old behaviour), so a fresh world draws in fewer chunks for the first seconds until the worker has filled the ring.
- **Light.** Cells in ring chunks are lit by `RingLight` (headless-columns.js), a reverse search at the same fixed point as the light volume (a cell takes its brightest neighbour minus max(1, opacity); cells at or above a column's height see the sky at 15). `src/headless-columns.test.js` compares it with `StreamingLight` over 4,000 resident cells and 500 cells that are only headless columns here, cell for cell. Resident cells keep the scene's light. Columns missing beyond the rim read as air, so cells within 15 blocks of the rim of the held area can read brighter than natively (they are the outermost reach of a spawn walk).
- **Entities (assumed from the port's policy, bytecode-read for native).** Natively an entity ticks when the 65 x 65 blocks around it are loaded (`World.updateEntityWithOptionalForce`, `ahb.a(sa, boolean)`: `checkChunksExist` with radius 32), which holds for every spawner chunk, so ring mobs walk, despawn and attack natively. The port keeps its existing policy for mobs outside the ticking window: they are frozen (not rendered, `world.isLoaded` filter in `main.js`), counted for the cap, removed by `sweepFrozen` (beyond 128 blocks at once, otherwise the native idle roll) and saved with the rest of `mobs.serialize()`. Ring mobs near the rim (over 128 blocks) are therefore gone at the next sweep, as natively on their first update; the others stand still until the player walks into the ticking window. `mobs.localDifficulty` counts a ring chunk as loaded.
- **Not covered.** Player edits in columns outside the resident window are not applied to ring columns (the edit journal is hydrated for the window and one column of halo only), so a tower built 100 blocks away is invisible to spawn heights there. Frozen ring mobs do not move.
- **Measured** in headless Chrome (localhost:5184, `?silent`, `--mute-audio`, a new default world): see `.shared-memory/notes/spawning4-b21-track.md`. In short: the ring fills to 441 columns (about 10.5 MB) within 20 s; the spawn pass averages 0.13 to 0.43 ms per tick (max 5 to 19 ms); frame median 17.2 to 17.6 ms with the ring against 17.1 without; heap within about 10 MB of the control.

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
- the round 2 replays (`src/spawner-replay2.test.js`) and resident-chunk eligibility and frozen-mob despawn tests;
- the round 3 replays (`src/spawner-replay3.test.js`): lit areas at day, night and thunder, animals' light rule, a Nether over the real fortress (start and piece boxes compared with the jar's) and the foal box quirk;
- the timing bench.

`src/dimension-spawning.test.js`, `src/entities.test.js`, `src/difficulty.test.js` and `src/spider.test.js` drive the live pass.

`src/headless-columns.test.js` (batch 21) covers:

- the compact column round trip;
- `RingLight` against `StreamingLight`;
- a replay where a ring-backed streamed world equals the same world with all 441 chunks resident, with spawns in the formerly skipped ring;
- the no-ring control (no spawns outside the window);
- the prune and memory bound;
- the worker `ring` protocol and `StreamPrefetch` requests;
- a Nether and End smoke test.
