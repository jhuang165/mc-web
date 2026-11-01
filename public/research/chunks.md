# Chunk storage and the block registry (WORLD-01)

WORLD-01 sets the storage and addressing the streamed world will use, without changing the current terrain. The game still runs on the fixed 128 × 128 × 64 `World` arrays. Nothing in `main.js`, rendering, lighting or saving reads the new storage yet; that is WORLD-02.

`tools/probes/ChunkProbe.java` and `tools/verify-chunks.mjs` run the unchanged 1.7.10 classes from the SHA-1-pinned client and write [chunk-reference.json](chunk-reference.json), with the sha256 of every class used. `src/chunk-store.test.js` and `src/block-registry.test.js` replay it.

| Case | Records | What is checked |
| --- | --- | --- |
| registry | 1 | `Block.registerBlocks`: the 171 registered ids (0–175 without 165–169), the 49 random-tick blocks, the 24 `BlockContainer` blocks; only id 0 has `Material.air` |
| nibble | 3 | `NibbleArray` get/set (400 ops, 200 reads each) at depth 4 and 7, values outside 0–15 included, against the original bytes |
| section | 4 | `ExtendedBlockStorage` at y bases 0, 16, 48 and 240, with and without skylight: 4,600 ops (block, metadata and light writes, raw LSB/MSB writes, `removeInvalidBlocks`) with the reference and tick counts after each, then the final arrays |
| chunk | 3 | `Chunk(World, Block[], byte[], x, z)` for 64-, 128- and 256-high generation arrays at chunk (−3, 5): sections, top filled segment, 400 reads (y ≥ 256 included), the y < 0 `ArrayIndexOutOfBoundsException`, 300 `setBlockMetadata` results, height maps and biome bytes |
| blockChunk | 1 | `Chunk(World, Block[], x, z)` at (2, −7): 600 reads |
| world | 1 | `World.getBlock`/`getBlockMetadata` over 16 chunks around the origin: 2,312 lookups at negative coordinates, y −1/0/255/256 and the ±30,000,000 border, including which chunk each lookup requests |
| keys | 1 | `ChunkCoordIntPair.chunkXZ2Int` and `hashCode` for 169 coordinate pairs |

All of them matched on the first run.

## What exists

- **`src/chunk-store.js`.** `NibbleArray`, `ExtendedBlockStorage` (12-bit ids as LSB byte plus an MSB nibble created on demand, metadata, block light, skylight only with a sky) and `Chunk` (16 sections, 256 high, biome bytes −1, precipitation height −999). `ChunkStore` keys chunks by coordinate and answers `getBlock`, `getMeta`, `setBlockState` and `setMeta` with the World bounds: x and z within ±30,000,000, y 0–255, air for a missing chunk. Writing air into a missing chunk or section does nothing, as in `Chunk.func_150807_a`; emptied sections stay allocated.
- **`src/block-registry.js`.** Every one of the port's 56 internal block states maps to an original id and metadata (`toOriginal`) and back (`fromOriginal`). State the port keeps outside the cell travels alongside: flowing water/lava (8/10), farmland moisture, chest and furnace facing, and the lit furnace (62). Original states the port can only approximate (a wall torch, a fern, podzol, wheat metadata above 7) come back marked inexact; blocks it lacks (sponge, unused ids) come back null.
- **Migration.** `fromLegacyWorld` copies a 128 × 128 × 64 world into 64 chunks at the same coordinates; `toLegacyWorld` copies it back. Every internal block with every metadata value survives the round trip. Only stray metadata on blocks whose original state is fixed (stone with meta 3, say) is dropped. The port's virtual bedrock below y 0 is not stored.

## Not done

- Light values are stored but not computed in chunks; height maps, precipitation heights and biomes stay at their constructor values.
- No tile entities, entity lists, neighbour updates, block-added/removed hooks, scheduled or random ticks per section.
- No loading, unloading or chunk generation, and no Anvil/NBT format.
- The live `World`, renderer and saves still use the legacy arrays.
