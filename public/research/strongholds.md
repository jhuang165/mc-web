# Strongholds (GEN-05d)

Status: standalone port of the 1.7.10 stronghold structure generator, replayed exactly against the unchanged original classes. It is **not wired into live world generation** and this is not a claim of full parity.

## Files

- `src/stronghold-generator.js`: the port (`MapGenStronghold`, `StructureStrongholdStart`, all pieces, weights, Stones selector, doors).
- `src/stronghold-generator.test.js`: node:test replay of the reference (`node --test src/stronghold-generator.test.js`, 8 tests).
- `tools/probes/StrongholdProbe.java` and `tools/verify-strongholds.mjs`: regenerate the evidence from the pinned jar (SHA-1 `e80d9b3bf5085002218d4be59e668bac718abbc6`, JDK 19.0.1, research inputs in the git-ignored `tools/research/`).
- `public/research/stronghold-reference.json` (1.44 MB): the evidence. Regeneration is deterministic (byte-identical on re-run).

## Evidence recorded from the unchanged classes

- `aug` MapGenStronghold, `auh` Start, `aui` StructureStrongholdPieces (PieceWeight `aur`/`auj`/`auk`, Stones `auw`, doors `avd`) and all piece classes `aum aun auo aup auq aus aut auu auv auy auz ava avb`, on top of the unchanged `MapGenStructure`/`StructureStart`/`StructureComponent`.
- Config: the 11-entry weight table with limits and the per-depth `canSpawnMoreStructuresOfType` answers (fresh and saturated), the three loot tables (18/4/7 rows), block ids, stronghold settings (distance 32, spread 3, count 3).
- 16 seeds of native stronghold positions and coordinate lists (including `Long.MIN_VALUE`, `Long.MAX_VALUE`, negative seeds).
- 48 native starts (3 per seed for 16 seeds), 7748 pieces in total (23 to 402 per start), driven through the unchanged `MapGenBase` seeding including negative chunk coordinates and the HashMap order of `structureMap`. 14 of those starts record every piece (2514 pieces: type, orientation, depth, box, door, per-type fields). All 12 saved piece types occur. The probe re-runs the regenerate-until-portal-room loop independently and records the attempt count and Random state; one start (seed -1) needed 2 attempts.
- 16 door replays (4 orientations x 4 door types, 304 writes, two anchors each), 2 Stones selector runs (3000 draws each).
- 13 population runs, 735 chunks, 3454 `addComponentParts` calls, 363,488 block writes, 98 tiles (87 chests, 11 silverfish spawners): synthetic stone/pockets/water/air fixtures for seeds 8675309, 0, -123456789 and natural chunks (terrain, surface, caves, ravines, input hashes retained). Each chunk records writes and ordered world-service call hashes, the post-population Random, per-piece-call `[start index, piece index, kept, write count, write hash]` from an unrolled pass (the probe asserts it equals the native `generateStructuresInChunk`), and 28 chunks have full write lists (49,048 writes, 24 end portal frames).

## What the JS port replays exactly

`node --test src/stronghold-generator.test.js` replays all of the above: positions via `strongholdPositions`, Start RNG (initial orientation draw, forced Crossing, pending-list draining order), `getNextComponent` weighted selection with the 5 retry rolls and Corridor fallback, depth (>50) and distance (112) limits, `markAvailableHeight(...,10)`, the regenerate-until-portal-room loop and its attempt count, piece boxes, the per-piece constructor RNG order (door first), `describe()` output for every piece, then block writes per chunk-bounded call, chest contents (including the enchanted-book row drawn before the item count in RoomCrossing and Library), the silverfish spawner and eye-of-ender rolls, liquid vetoes that drop pieces for good, and the Random state after each chunk.

Native quirks that are reproduced because they are what 1.7.10 does:

- `RightTurn` has no own placement method, so its weight spawns `LeftTurn` pieces. `SHRT` never occurs (0 of 2514 recorded pieces); the class exists for saved data only.
- `PortalRoom` has no liquid veto and fills with skipAir false; Library is allowed from depth 5, PortalRoom from depth 6.
- The Corridor fallback only applies at minY > 1, draws no RNG and keeps the OPENING door.

## Framework notes

No framework file was edited. Everything needed existed in `structure-framework.js`: I added the Stronghold-only logic in my own module (`StrongholdStart` carries the weight state and portal-room pointer like `Stairs2`, `MapGenStronghold` subclasses `MapGenStructure` and gets positions from `structure-placement.js`). `getStructureStart` records `attemptLog` entries (not part of the native class) so the test can compare attempts.

## Limits and remaining work

- Not wired into `ChunkProviderGenerate`/`java-world.js`/live generation, and no `MapGenStructureData` or NBT save/load of starts or pieces (`describe()` is a test format, not the NBT layout).
- The stronghold position search is the existing `strongholdPositions` (covered by its own reference); only default world type with positions for 3 strongholds per seed is exercised here, and positions beyond the first ring are not re-verified for other counts.
- The test world is a recording double, not the game chunk store: no neighbour-chunk lighting, block updates or notifications, and spawner/chest tiles are represented by the fixture's tile objects.
- Silverfish `setEntityName` is checked through the tile, not through an entity spawn pipeline; monster eggs (block 97) behaviour and stronghold spawn lists are outside this module.
- Evidence covers 3 seeds' worth of populated chunks plus 16 seeds of start trees; unusual cases (very deep trees at the world edge, extremely large coordinates) are covered only by the seeds listed above.
- The HashMap iteration order is recorded on JVM 19.0.1 and modelled by the framework's `StructureMap`.
