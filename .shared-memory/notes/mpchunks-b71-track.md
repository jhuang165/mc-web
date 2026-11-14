# Batch 71 mpchunks: chunk columns follow the server view distance

## Summary
- `src/multiplayer/server-chunk-view.js` (new): `ChunkWatch` (one player's `loadedChunks` and managed position: join square, spiral reorder, 8-block move rule, S21 unload list, 5-column `take`) and `ServerChunkViews` (`sim.chunkViews`: `columnsFor` for snapshots, `tick`, `leave`).
- `src/multiplayer/client-chunks.js` (new): `restoreColumns` (a snapshot may hold only a square; the rest is blank and listed in `world.absentColumns`), `applyChunkMessage` (`chunkBulk` fills, `chunkUnload` blanks, light and meshes of the 3x3 columns are refreshed), `presentCells` (block changes for absent columns are dropped).
- Hooks: `simulation.js` (constructor, `snapshot`, `removePlayer`, `tick` after the player loop), `server-dimensions.js` (`snapshotFor`), `server/server.js` (sends `player.chunkOut` next to `pistonOut`), `client.js` and `client-dimensions.js` (`restoreColumns`, buffer and apply `chunk*`), `main.js` (import, `presentCells` in `applyMultiplayerCells`, `client.onChunks`).
- Wire names: `chunkBulk` { columns: [{x, z, runs}], tiles? }, `chunkUnload` { columns: [[x, z]] }, snapshot field `chunkView: true`. Coordinates are the replica's local column coordinates.
- Tests: `src/mpchunks71-b71.test.js` (10). Two older tests adjusted for the new snapshot (`mpend-b63`, `mpendwindow-b65`: the End snapshot is the square, not all 256 columns).
- Research: `tools/probes/ChunkViewProbe.java`, `tools/verify-chunk-view.mjs`, `public/research/chunk-view-reference.json`.

## Evidence
- Executed (unchanged 1.7.10 classes): PlayerManager `mq.a(mw)` addPlayer, `mq.d(mw)` updatePlayerInstances, the spiral reorder, `mr.b` removePlayer with a real S21 `gx` (stub world, provider, chunk and net handler made with Unsafe). Recorded: pending list order after join, unload packets `[x, z, groundUp, mask]` in order, pending list and managed position after each move (cases with partly drained queues, negative coordinates, jumps). `ChunkWatch` replays all of it. Also executed: `gz.c()` = 5.
- Bytecode-read: `EntityPlayerMP.onUpdate` (`mw.h`) takes up to `gz.c()` populated chunks per tick into one S26, then S35 per tile entity, then the tracker spawn packets. `S01` (`hd`) has entity id, game type, dimension, difficulty, max players, level type: no view distance. `oi.d(mw)` wraps `mq.d`.
- Recalled: that NetHandlerPlayServer calls `oi.d(mw)` after each move packet.

## Findings per item
- Found wrong in the brief: one S26 holds 5 columns in 1.7.10, not 10 (10 is a later version).
- Found wrong: the native client never receives the view distance (S01 has none). The welcome `viewDistance` of this port is not native and is still unread; the client now only loads what is sent and unloads what the server unloads.
- Moving rule: nothing until 8 blocks from the managed position; and if the chunk is unchanged the managed position is NOT updated (executed). Chunk = trunc(pos) >> 4 (-0.5 is chunk 0).
- Closed: columns on the dedicated server follow `chunkRadius` (view-distance clamped 3..20), order, batching and unloads as native.

## Verification
- `node --test src/mpchunks71-b71.test.js`: 10 pass.
- Adjacent files, one at a time: mpend-b63 5, mpendwindow-b65 5, mpnether-b61 7, multiplayer 5, hanging 13, mpcontainers2-b60 9, mpend2-b64 6, mpgolems-b66 13, mpsurvival-b58 8, mpwither-b63 12, mpworldcmds-b68 11, away-commands 18, simulation-replay 1, mpdragon-b64 6, serverchunks-b67 7, serverprops-b69 19: all pass.
- `node --check` on every touched file ok; `npm run build` ok. Full npm test not run (batch rule). No browser checks.

## Follow-ups
- The join snapshot carries the first square at once instead of streaming it (the replica is built from the snapshot). Native streams it 5 columns per tick.
- The shared tick message still carries block changes of the whole world; the client drops those of absent columns (native filters on the server per player). Per-player filtering would save bandwidth.
- Only view-distance 3..7 changes anything in the 8 x 8 world (8+ covers it); the 16 x 16 End is limited from 8 up.
- The legacy End window (origin not a multiple of 16) is never limited. Entities (mobs, items) in an unloaded column are not removed on the client.
- Only a browser could show: the mesh and light refresh when columns appear and vanish while walking, and spawn-time light of a streamed column.
