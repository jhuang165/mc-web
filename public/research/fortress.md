# Nether fortress (MapGenNetherBridge) - 1.7.10

Port of `MapGenNetherBridge` (atd), its `Start` (ate), `StructureNetherBridgePieces` (atf) with `PieceWeight` (att) and every
piece (atg..atv, start piece atw) on the shared structure framework (`src/structure-framework.js`). Code: `src/fortress.js`,
wired into `ChunkProviderHell` in `src/nether-generator.js`. The Nether is not reachable from the game yet; the generator is
exercised through `NetherArea` in tests. This is not full parity; see Gaps.

## Behaviour (all from bytecode, then replayed against the probe)

- Placement (`atd.a(II)`): region `chunk >> 4`, Random seeded `(rx ^ rz << 4) ^ worldSeed`, one `nextInt()`, then `nextInt(3) == 0`, chunk X `rx*16 + 4 + nextInt(8)`, chunk Z likewise. Range 8 start search as in `MapGenBase`.
- Start (`ate`): Start piece at `(chunkX*16+2, 64, chunkZ*16+2)` (19 wide, random facing), then the pending-piece list is drained with `nextInt(size)` removal, then `setRandomHeight(48, 70)`.
- Piece choice (`ats`): up to 5 weighted rolls (primary table for corridors off the start, secondary for the castle parts), per-piece instance limits, 112-block extent limit measured from the Start piece, End piece fallback.
- Weights, limits, allow-in-row flags: primary Straight 30, Crossing3 10/4, Crossing 10/4, Stairs 10/3, Throne 5/2, Entrance 5/1; secondary Corridor5 25, Crossing2 15/5, Corridor2 5/10, Corridor 5/10, Corridor3 10/3, Corridor4 7/2, NetherStalkRoom 5/2.
- Blocks: nether brick 112, fence 113, stairs 114, wart 115, soul sand 88, lava 10 (Entrance lava is ticked immediately like the original), spawner 52 (Throne, entity "Blaze"), chests 54 in the turn corridors (`2 + nextInt(4)` rolls, 11-row loot table).
- Spawn list (`atd.b()`): Blaze 10 (2-3), PigZombie 5 (4), Skeleton 10 (4), LavaSlime 3 (4). `fortressMonsterSpawnList(bridge, blockAt, x, y, z)` mirrors `ChunkProviderHell.getPossibleCreatures`: the fortress list inside a piece, or over the first start's XZ footprint on a nether brick block; otherwise it returns null (use the biome list).
- Determinism: the bridge keeps its own Random and uses the provider seed; `populate` runs `generateStructuresInChunk` first on `hellRNG`, so the later populate output shifts exactly as in the original.
- The nether-brick stair block `onBlockAdded` is a no-op in `NetherGenWorld`.

## Evidence

`tools/probes/FortressProbe.java` (driven by `tools/verify-fortress.mjs`, `MC_RESEARCH` set, jar SHA-1 pinned) drives the unchanged classes and writes `public/research/fortress-reference.json` (about 285 KB): 1 config record, 32 placement scans (16 seeds, 128x128 chunks near the origin plus a 64x64 window near (100000,-200000)), 16 native start-driver records (5 centres per seed, piece lists with saveId, facing, depth, bounding box and extras, full piece lists for the first one or two starts and a SHA-1 of the list for the rest), and 8 population records (real `ChunkProviderHell` with its own `atd`, 6x6 chunks generated and 5x5 populated around a native fortress: per-populate world-call and write hashes, area hashes, chests and spawners, pieces after population, 30-60 spawn-list probes per record, both Random streams after). `src/fortress.test.js` replays all of it (60 tests).

## Gaps

- No runtime behaviour: nothing spawns fortress mobs in game, the wither skeleton roll (skeleton type 1 from the Nether spawn rule) is not wired, and the Nether is not reachable from the game.
- No `MapGenStructureData` persistence (start list is regenerated from the seed), no NBT save/load of pieces, no `/locate`-style lookup (`nearestFortressStart` exists but is untested).
- Placement was only probed on 16 seeds and two windows; the 1.7.10 `Start` save path is not exercised.
- Light, entity and block-update side effects beyond those in `NetherGenWorld` (e.g. the lava flow after the Entrance tick) are exact only where the probe world double exercises them.
- Nothing was checked in a browser.
