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

## Derived from bytecode but not replayed natively
- `ChunkProviderFlat.populate`: structure generators in list order (village, biome_1, mineshaft, stronghold), `lake` (needs no village,
  `nextInt(4)`), `lava_lake` (`nextInt(8)`, and `nextInt(10)` at y >= 63), 8 dungeons, decoration only with `decoration`; no animals, no
  snow. `src/flat-structures.js`, reusing the existing structure and population code.
- `GuiCreateFlatWorld` and `GuiFlatPresets` layouts, strings and behaviour (`src/flat-gui.js`). The en_US strings are recalled, not
  read from the jar. Remove Layer works; Add Layer and Edit Layer are created hidden as "(NYI)" in 1.7.10 itself. Slot frame drawing
  is an approximation of the stats icon sprite.
- Void fog and horizon for flat worlds reuse the existing `void-fog.js`; the slime rule uses the existing `flat` flag.

## Approximations and gaps
- Flat worlds exist only as streamed generation version 15 worlds.
- Biome ids that are holes in the 1.7.10 table (40, 126-128, 168-255) throw a NullPointerException natively when a chunk is built;
  the browser uses plains.
- The spawn point uses the repository's `World.spawn` / `findBiomePosition`, not the native `canCoordinateBeSpawn` walk.
- Bonus chest: the world Random is seeded from the world seed (native is an unseeded `Random`); Material.blocksMovement and
  `doesBlockHaveSolidTopSurface` use the live `World.solid`; torches are placed standing (meta 5) instead of running `onBlockAdded`.
  The chest is placed once on first open (`bonusChest` and `bonusChestPlaced` on the world record); the chest is not placed in the
  creation screen itself.
- Java ZIP export writes `generatorName "flat"` and `generatorOptions`. There is no level.dat import path in this build, so Java import of
  a Superflat save is not implemented. Browser JSON export/import keeps `generatorOptions`.
- Population (structures, lakes, dungeons) of flat worlds is not compared against native output.
