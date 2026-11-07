# Superflat and the bonus chest (1.7.10)

Target: Minecraft Java 1.7.10 (client SHA-1 `e80d9b3b...`). Reference data: `public/research/flat-world-reference.json`, produced by
`tools/verify-flat-world.mjs` running `tools/probes/FlatWorldProbe.java` against the unchanged client classes (needs a JDK and the
pinned jar; `MC_RESEARCH` points at `tools/research`). Parity with 1.7.10 is not claimed.

## Verified against the unchanged classes (replayed natively)
- `FlatGeneratorInfo` (`ass`) parse and `toString` over 61 fixed strings, including malformed ones (default fallback, version range,
  layer count clamp, unregistered block ids, metadata range, feature and parameter parsing). Feature and parameter order is Java
  `HashMap` order, simulated in `JavaHashMap`. `src/flat-world.js`, `src/flat-world.test.js`.
- The eight `GuiFlatPresets` entries (names, icons, strings), read from the class bytecode.
- `ChunkProviderFlat.provideChunk` blocks, metadata and biomes (SHA-1 over whole chunks plus a full column) for every preset and
  three more strings at two chunks.
- `WorldChunkManagerHell` `areBiomesViable` and `findBiomePosition`; `BiomeGenBase.getBiome` edge ids.
- Bonus chest: `WorldServer.bonusChestContent`, `WorldServer.k` (ten attempts) and `WorldGeneratorBonusChest` over 40 records (8 presets
  x 5 seeds): attempt coordinates, every `setBlock`, every chest slot write and the Random state afterwards. `src/bonus-chest.js`,
  `src/bonus-chest.test.js`.

## Replayed natively (batch 18)
- `ChunkProviderFlat.populate` (`aqu`, unchanged jar) over 44 areas, 949 populated chunks (`tools/probes/FlatPopulateProbe.java`,
  `tools/verify-flat-populate.mjs`, areas in `tools/probes/flat-populate-areas.json`, `public/research/flat-populate-reference.json`,
  `src/flat-populate.test.js`): every preset and custom strings with each structure option and its parameters (village distance/size,
  biome_1 distance, mineshaft chance, stronghold distance/count/spread), lake, lava_lake, dungeon, decoration in every biome id used by
  the presets, and `mapFeatures` true and false. Per chunk the replay compares the provideChunk bytes, populate order, generator list
  order, structure start maps (boxes and component counts), ordered World writes (count and SHA-1), the provider Random and World.rand
  after each populate, the final chunk hash, tile entities, entities, minecarts, pending ticks and item drops. Each area runs in its own JVM
  because the native jungle temple leaves static state that changes later areas. No divergence was found in the structure-free
  paths; the call order is the native one.
- Limits of that replay: the live `PopulationArea` has no native `neighborChanged` chain, so the ordered call stream (reads) is not compared
  for areas with a village, and for the stronghold and desert temple areas; writes still match there. Jungle temples differ by 8 to 10
  tripwire/redstone updater writes, their World.rand draws and pending ticks, so those three comparisons are skipped for that area; the
  final chunk bytes, tiles and entities still match.
- `mapFeatures` false (`off-*` areas): no structure generator is constructed (no village, biome_1, mineshaft, stronghold), populate still
  runs lake, lava_lake, dungeon and decoration. That is streamed generation 17.

## Derived from bytecode but not replayed natively
- `GuiCreateFlatWorld` and `GuiFlatPresets` layouts, strings and behaviour (`src/flat-gui.js`). The en_US strings are recalled, not
  read from the jar. Remove Layer works; Add Layer and Edit Layer are created hidden as "(NYI)" in 1.7.10 itself. Slot frame drawing
  is an approximation of the stats icon sprite.
- Void fog and horizon for flat worlds reuse the existing `void-fog.js`; the slime rule uses the existing `flat` flag.

## Approximations and gaps
- Flat worlds exist only as streamed generation version 15 or later worlds (17 when MapFeatures is off).
- Biome ids that are holes in the 1.7.10 table (40, 126-128, 168-255) throw a NullPointerException natively when a chunk is built;
  the browser uses plains.
- The spawn point of new (generation 18 and 19) worlds is the native `createSpawnPosition` walk ([world-spawn.md](world-spawn.md)); worlds saved at 15 to 17 keep the earlier `findBiomePosition` origin.
- Bonus chest: native `World.rand` is `new Random()` (unseeded), so a native bonus chest differs every creation; the game now seeds its Random
  from fresh entropy (`unseededBonusRandom`) and tests inject a fixed `JavaRandom`. Material.blocksMovement and
  `doesBlockHaveSolidTopSurface` use the live `World.solid`; torches are placed standing (meta 5) instead of running `onBlockAdded`.
  The chest is placed once on first open (`bonusChest` and `bonusChestPlaced` on the world record); the chest is not placed in the
  creation screen itself.
- Java ZIP export writes `generatorName "flat"` and `generatorOptions`. There is no level.dat import path in this build, so Java import of
  a Superflat save is not implemented. Browser JSON export/import keeps `generatorOptions`.
- Live-world structure reads (door/redstone/tripwire neighbour chains) are not replayed; see the limits above.
