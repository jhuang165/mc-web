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

## Live worlds (GEN-05b)

`src/mineshaft-world.js` runs `MapGenMineshaft` in live Java worlds whose `generationVersion` is 10
or higher. `java-world.js` calls `generateLiveMineshafts` once caves and ravines have run for all 64
chunks. Version 9 worlds take the unchanged code path; `java-world.test.js` pins their snapshot
SHA-1 values, which were recorded from the pre-GEN-05b module. The World default version is not
changed here.

- **Mineshaft-only population.** Each loaded chunk runs the 1.7.10 `provideChunk` (terrain, surface,
  caves, ravines) and then the `func_151539_a` start search (range 8). The populate step is only the
  population reseed followed by `generateStructuresInChunk`, over the native box (chunk*16+8 ..
  +23). Villages, strongholds, temples, lakes, dungeons and decorators never run. Every mineshaft
  write therefore sees terrain, caves, ravines and earlier mineshaft writes only. The native results
  of this pass are not the results of a full native populate.
- **Finite area.** The 8 × 8 live chunks and a one-chunk ring (chunks -1..8 on each axis) load in
  x-outer, z-inner order, as `ChunkProviderServer.loadChunk` does, and fire the four
  `Chunk.populateChunk` checks. That gives 81 populate calls over chunks -1..7. Every live column gets
  exactly the writes native population gives it for this load order, so nothing in the live area is
  lost. Ring terrain is built only when the pass reads or writes it, and writes that land in the
  ring are discarded, the same way World bounds would discard them. Spawners, carts, pending ticks
  and drops are filtered to the live area.
- **Callbacks.** Chunk storage writes run `onBlockAdded`/`breakBlock` even for flag-2 writes.
  `BlockTorch` (wall attachment, support, drops) and `BlockRail`/`BlockRailBase$Rail` (shape
  logic, support drop, slope notification) are ported. A redstone power source next to a rail
  throws, because it is unported.
- **Live mapping.** Changed cells map through `block-registry` `fromOriginal(id, meta)`, and an
  unmapped id throws. The mapper loads by dynamic import (an import cycle), so callers that build
  a version-10 World at startup must `await originalBlockMapperReady` or call
  `setOriginalBlockMapper` first.
- **Output.** `world.generatedStructures = { mineshafts: [{chunkX, chunkZ, boundingBox}],
  spawners: [{x, y, z, entityId}], minecartChests: [{x, y, z, items: [{slot, id, damage, count,
  stored?}]}], pendingTicks, droppedItems }`. Coordinates are world-local, carts sit at the native
  x+0.5/y+0.5/z+0.5, item ids are the original 1.7.10 ids, and records are in native creation order.

Evidence: `tools/probes/MineshaftWorldProbe.java` and `tools/verify-mineshaft-world.mjs` write
`mineshaft-world-reference.json` (84 KB). The probe runs unchanged `aqz.d`, `asw` and `ave` over
real `apx` Chunk storage, with real World `setBlock`/notification code. It covers four worlds:
default seeds 0 and 17, amplified 10 and large-biomes 0. Each record keeps:
- the 100 input chunk hashes;
- the population order;
- per-chunk write and call hashes with cart inventories;
- start bounding boxes and piece hashes;
- spawners;
- the 64 live-chunk cell hashes;
- World.rand.

`mineshaft-world.test.js` replays all of it in original-ID space. It also checks version-10 Worlds
end to end: changed cells equal `fromOriginal`, other cells equal version 9, and the structure
records match the probe.

Visible example: in the default seed-0 world, a cave-spider spawner sits at world-local
(120, 31, 37) and a chest minecart at (115.5, 43.5, 75.5). The start at local chunk (8, 5) spans
x 91..210, y 24..50, z 17..162.

Performance (median of 3, Node 20): building a 64-chunk World takes 360–400 ms at version 9 and
440–480 ms at version 10, so mineshafts add 60–105 ms. That includes the ring terrain built
lazily (15–36 extra chunks).

Gaps:
- No full population chain.
- Powered-rail and redstone logic is unported.
- Drops and pending ticks are counted or listed, not handed to the live world.
- Cells follow the `fromOriginal` mapping. All 28,644 changed cells in the four worlds map
  exactly, and no fluid `state` is returned, but `exact` is not enforced.
- No structure NBT save.
- The start map order is that of the recorded JVM's HashMap.
