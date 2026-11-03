# Chunk storage and the block registry (WORLD-01)

**Current status (0.29.0):** an opt-in streaming preview (generation 12 terrain, generation 13 terrain plus per-area population) streams live columns, light/meshes and saved edits; a Web Worker generates ahead of the player and light shifts incrementally (0.29.0). See [WORLD-02d/02e streaming](streaming.md) for the current behavior, acceptance evidence and remaining work. The sections below describe their historical standalone/finite milestones; the native provider/player-manager policy remains unconnected. Finite populated Java worlds still use v11.

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
- No chunk generation and no Anvil/NBT format. Loading and unloading are below (WORLD-02a).
- The live `World` moved into chunk columns in WORLD-02b (below); the renderer and saves still go through its legacy API.

## Chunk lifecycle (WORLD-02a)

The first WORLD-02 slice ports when the original server loads, populates, queues, saves and unloads chunks, and which chunks each player keeps. It runs in tests over stub storage and generation only. The live world is not streamed yet.

`tools/probes/ChunkProviderProbe.java` and `tools/verify-chunk-provider.mjs` record the unchanged `ChunkProviderServer`, `PlayerManager`, `PlayerInstance` and `WorldServer.saveAllChunks` in [chunk-provider-reference.json](chunk-provider-reference.json), with class hashes.

- **Stubs.** A stub chunk loader stores TerrainPopulated, LightPopulated, InhabitedTime and hasEntities. A stub generator logs provide, populate and recreateStructures.
- **Allocation.** WorldServer, PlayerManager and the players are allocated without constructors. Only the fields these methods read are set. Each player gets its own entity id, because `Entity.equals` compares ids.
- **Ticks** follow `WorldServer.tick`: unload queued chunks, then add 1 to totalWorldTime, then update the player instances.
- **`prepare`** is `MinecraftServer.initialWorldChunkLoad`'s 25 × 25 loop.

`src/chunk-provider.test.js` replays every step: each event, the loaded-chunk list with its flags, save time and inhabited time, the unload queue order, the watcher list and every player's send queue. All of them match.

| Scenario | What it covers |
| --- | --- |
| spawn | 625 spawn chunks, then a player walks 800 blocks away. Chunks within 128 blocks of spawn are never queued; the rest drain 100 per tick. Incremental (24-chunk) and full saves; walking back reloads saved chunks |
| walk | 50 moves of 3–5 blocks: the 8-block threshold, square shifts by one and two chunks, the spiral send queue, and a diagonal jump |
| teleport | 441 chunks queued at once, drained in queue order. Teleporting back rescues the chunks still queued and reloads the rest without populating them again |
| noRespawn | A dimension players cannot respawn in: chunks queue regardless of spawn, and an empty world queues every chunk each tick |
| view | Two overlapping players; view distance 10 → 4 → 15 → 3 → 25 (clamped to 20) → 1 (clamped to 3). Shrinking creates and loads a watcher for every chunk outside the new square before removing the player from it |
| save | Modified chunks; hasEntities chunks every 600 ticks; the full save; unwatched chunks queued by a save; level saving blocking saves and unloads |
| inhabit | provideChunk with and without load-on-request (a queued chunk stays queued), and inhabited time from the 8000-tick sweep and from the last player leaving |

### What exists

- **`src/chunk-provider.js`**
  - `ChunkProviderServer` extends `ChunkStore`. It has `loadChunk`, `provideChunk` (with `EmptyChunk`), `populate`, `unloadChunksIfNotNearSpawn`, `unloadAllChunks`, `unloadQueuedChunks` (100 per tick, each saved unconditionally) and `saveChunks` (24 per incremental save).
  - `prepareSpawnArea`, `saveAllChunks` and `tickChunks` are the WorldServer steps.
- **`ChunkKeySet`** reproduces the unload queue's iteration order. The queue is a `Collections.newSetFromMap(new ConcurrentHashMap())` of chunk keys, so it drains in ConcurrentHashMap order. That order covers:
  - 16 bins at the start, doubled at three-quarters load;
  - resize splits;
  - red-black tree bins and their conversion back to lists;
  - presizing a small table.

  The port follows the JDK source. Seeded stress runs check it: ten runs of 23,000 operations in total, with 92 order checkpoints, `set` records in the reference. The same runs on the launcher's bundled Java 8u74 classes (the runtime it uses for 1.7.10) give the same order at all 92 checkpoints. Java 6/7's segmented map would drain in a different order.
- **`src/player-chunks.js`**
  - `PlayerManager`: watcher squares, the spiral `filterChunkLoadQueue`, the 8-block move rule, `setViewDistance` (3–20) and `isPlayerWatchingChunk`.
  - `PlayerInstance`: inhabited time.
- **`Chunk` state in `chunk-store.js`**
  - Lifecycle fields: populated, light populated, ticked, hasEntities, lastSaveTime, inhabitedTime and loaded.
  - Methods: `populateChunk`, with the original's four neighbour checks, two of which test one neighbour twice; `needsSaving`; and `onChunkLoad`/`onChunkUnload` hooks.

### Not done (later WORLD-02 slices)

- **Not connected.** The live `World` keeps its cells in chunk columns since WORLD-02b, but generation, the renderer, lighting and saves still treat it as one 128 × 128 × 64 world.
- **Lighting.** The probe world has no sky, so `func_150809_p` skips its lighting. Sky-light population is a `lightPopulate` hook.
- **Entities, tile entities and pending ticks** don't move with chunks yet. The load and unload hooks are where they will attach.
- **No networking parts.** Block-change batching (`flagChunkForUpdate`/`sendChunkUpdate`) and chunk packets are not ported; the send queue is kept as an order only. `isTicked` is never set, because block ticking does not run here.
- **Storage.** No Anvil/region format and no asynchronous chunk I/O.

## Live World in chunk columns (WORLD-02b)

The live `World` no longer keeps two flat 128 × 128 × 64 arrays. Its cells now live in 64 `WorldChunk` columns (16 × 16 × 64, chunk coordinates 0–7 on both axes) in a `Map` keyed by chunk coordinate, with a one-entry lookup cache. The API is unchanged: `get`, `getMeta`, `solid`, `put` and `set` behave as before, and the finite bounds stay. Reads below y 0 return the virtual bedrock; reads outside the edges or above the top return air; writes outside the bounds and to the bedrock layer are refused.

- **Layout.** In each column, cell `(x, y, z)` is at `((x & 15) * 16 + (z & 15)) * 64 + y`. `World.index()` keeps the old flat order, because the fire and fluid queues use it as a cell key.
- **Tick counts.** Each column keeps its own section random-tick counts, the per-column analogue of `ExtendedBlockStorage.tickRefCount`. They are built lazily and updated on `put`.
- **`snapshot()`** returns flat `{ data, meta }` in `index()` order, for tests and whole-world copies. **`setRaw()`** writes a cell with no bounds checks or edit bookkeeping; generation and `toLegacyWorld` use it.
- **Readers moved off the arrays.** `lighting.js`, `snow.js` (generation light), `fire.js`, `flowers.js` and `chunk-store.js` now read cells through `get`, `getMeta` or `snapshot()`.

`src/world-chunks.test.js` compares against sha1 fingerprints of the flat arrays, recorded before the change. It covers 14 worlds (terrain versions 1–8 with seed "Overworld", plus meadow, alpine, island and snowy worlds, and older snowy and alpine versions) and the `LightVolume` after five edits. All are byte-identical. In the browser, a freshly created world gives the same fingerprint as in node, renders all 64 chunk meshes, and relights correctly when blocks are broken on either side of a column boundary.

Node timings, before → after: generating the 14 worlds, 385 → 381 ms; the full `LightVolume`, 111 → 122 ms; 5 million `get` calls, 16 → 20 ms.

### Not done

- `ChunkProviderServer` and `PlayerManager` are not connected to the game loop. Columns are never loaded, unloaded or generated on demand, and the world stays 128 × 128 × 64.
- `LightVolume` is still one flat volume, not per-chunk light arrays. Saves are still edit lists over regenerated terrain.
- Rendering still builds one mesh per 16 × 16 column from `World.get`; it does not read `WorldChunk` directly.
