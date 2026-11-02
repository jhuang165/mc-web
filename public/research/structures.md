# Java 1.7.10 structures (GEN-05)

Status: **partial**. GEN-05a ports the shared structure framework and mineshafts as standalone
modules, checked against the unchanged pinned 1.7.10 classes. They are not yet called from
live world generation. Villages, strongholds, temples and nether fortresses are not ported.
This is not a parity claim for structures.

## Ported (GEN-05a)

| JS | Native class (obf) | Notes |
| --- | --- | --- |
| `StructureBoundingBox` (`src/structure-framework.js`) | StructureBoundingBox (`asv`) | empty/XZ population box (Y 1..512), getComponentToAddBoundingBox for modes 0–3 and default, intersects/expand/offset/isVecInside, sizes and centres |
| `StructureComponent` | StructureComponent (`avk`) | coordBaseMode X/Y/Z transforms (mode -1 is absolute), full getMetadataWithOffset table, place/get block, fillWithAir, fillWithBlocks (+metadata), fillWithRandomizedBlocks (BlockSelector as `{select}`), randomlyFillWithBlocks, randomlyPlaceBlock, randomlyRareFillWithBlocks (float ellipsoid), clearCurrentPositionBlocksUpwards, func_151554_b downward fill, chest generation, isLiquidInStructureBoundingBox, findIntersecting |
| `StructureStart` | StructureStart (`avm`) | generateStructure with permanent removal of pieces that hit liquid, updateBoundingBox, markAvailableHeight, setRandomHeight |
| `MapGenStructure` | MapGenBase (`aqx`) + MapGenStructure (`ave`) | range-8 per-chunk seeding (`x*a ^ z*b ^ seed`), recursiveGenerate (skip known keys, `nextInt()` before the candidate test), generateStructuresInChunk over the population area, getStructureAt/isInsideStructure/func_142038_b |
| `StructureMap` | `HashMap<Long, StructureStart>` | Java 8+ iteration order for ChunkCoordIntPair keys (hash `x ^ z`, spread, 0.75 growth, treeify resize below 64) |
| `generateChestContents`, `weightedRow` | WeightedRandomChestContent (`qx`), WeightedRandom (`qv`) | including the one-at-a-time branch for counts above max stack size |
| `MapGenMineshaft` (`src/mineshaft-generator.js`) | MapGenMineshaft (`asw`) | chance 0.004 then `nextInt(80) < max(|x|,|z|)` |
| `StructureMineshaftStart` | `atc` | room at chunk*16+2, recursive build, bounding box, markAvailableHeight(10) |
| `MineshaftRoom/Corridor/Crossing/Stairs`, `getNextMineShaftComponent` | `ata`, `asy`, `asz`, `atb`, `asx` | 80/70 piece roll, depth 8 and 80-block limits, corridor lengths, rails (0.7 on opaque support), fences/planks, webs, torches, cave-spider spawner (once per corridor, persistent flag), plank supports, minecart chests with mineshaft loot plus a level-30 enchanted book (reuses `dungeonEnchantedBook`) |

World adapter: `getBlock`, `setBlock(x,y,z,id,meta,flags)`, `isAirBlock`, `getTileEntity`,
`spawnEntity`. Block properties (Material.air, Material.isLiquid, Block.func_149730_j,
BlockDirectional) are module tables verified against every native ID 0..255.

## Evidence

`tools/probes/MineshaftProbe.java` + `node tools/verify-mineshafts.mjs` run the unchanged
classes from `minecraft-1.7.10.jar` (SHA-1 e80d9b3b…) over a World double and write
`public/research/mineshaft-reference.json` (~450 KB, 40 records; regeneration is
byte-identical). Recorded JVM: 19.0.1.

- **config**: material/opaque/directional flags for 256 IDs, the 13 mineshaft loot rows with
  max stack sizes, block IDs, minecart inventory size 27, Direction/Facing arrays, chance.
- **boxes / metadata**: 28 getComponentToAddBoundingBox cases (modes -1..5, far coordinates);
  getMetadataWithOffset for every ID × metadata × mode (310 changed values).
- **framework** (15): every helper above on a probe component for modes -1..3 and three seeds,
  with a clipping box, chests and loot; ordered call/write SHA-1, tiles and following RNG.
- **candidates** (4): 120,592 raw candidate decisions (three seeds over 192×192 chunks, plus
  Long.MIN_VALUE near the ±1,875,000 chunk edge), 385 accepted, with post-decision RNG hashes.
- **starts** (6): the native driver (`func_151539_a`) over 49 near-origin, 9 far and 2 edge
  centres: map key order, RNG after each call, 99 starts / 12,412 pieces (SHA-1 of each piece
  list; 14 full piece trees with type, mode, depth, box, rails/spiders/spawner/sections,
  crossing direction/floors, room entrances).
- **populate** (13): provideChunk-then-populate order on ChunkProviderGenerate's population
  seed for 942 chunks: ten synthetic runs (stone, air pockets/glass/gravel/leaves, sparse water
  columns, all air; first and largest starts of two seeds) and three natural 3×3 runs over 48
  native terrain/surface/cave/ravine chunks (input hashes re-derived by the JS generators).
  221,109 writes and 885,931 service calls by SHA-1 per chunk (2,344 writes in full), 53
  minecart chests (7 with books) with exact slots and positions, 21 cave-spider spawners,
  population RNG after each chunk, and every start's surviving pieces afterwards (liquid
  removal, spawner flags).

`src/structure-framework.test.js` and `src/mineshaft-generator.test.js` replay all records exactly.

## Known deviations and limits

- HashMap order is the probe JVM's (Java 8+ HashMap). The 2014 launcher often ran Java 6/7, whose
  HashMap hashing and iteration differ. This only matters when two starts populate the same chunk,
  where iteration order decides write and RNG order. Treeified buckets are not modelled and throw.
- MapGenStructureData persistence (load/save of starts, `Children`/`BB`/`Entrances`/`hr`/`sc`/`hps`/`Num`
  NBT), MapGenStructureIO and reloading starts are not ported. A reloaded native world rebuilds
  piece state from NBT, including spawner and removal flags, so live parity needs that save path.
- placeDoorAtCurrentPosition (ItemDoor.placeDoorBlock), dispenser contents and
  func_151545_a (locate nearest) are not ported. Villages, strongholds and temples need them.
- The minecart is a plain record. EntityMinecartChest's own entity state (UUID, unseeded entity Random,
  motion, NBT) is not modelled. Spawner tiles only receive the entity name.
- The World double uses no native Chunk storage: there are no notifications, lighting, height maps
  or neighbour updates for flag-2 writes. `gen-world.js` integration still has to be checked against
  a native populate with map features on.

## Open (next tranches)

1. Integration: `ChunkProviderGenerate.provideChunk` calls the structure generators after caves
   and ravines, and `populate` calls them first on the population Random. That is the
   `population-stage.js` structure hook, currently a stub. Needs a generation-version bump,
   cross-chunk ownership and a native populate-chain replay with map features enabled.
2. Structure NBT save/load (MapGenStructureData per dimension), so the session `StructureMap` survives reloads.
3. Strongholds (ring placement, biome search on the WorldChunkManager, portal room), villages
   (biome-checked start, roads, well, houses, villagers), scattered features (desert/jungle temples,
   witch huts) and nether fortresses on the same framework.
