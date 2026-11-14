# Batch 72 mpstream72: the first view-distance square streams, per-player block changes, entity unload

## Summary
- `src/multiplayer/server-chunk-view.js`: the welcome / `dimRespawn` snapshot carries `columns: []` (still `chunkView: true`); the square is queued as `addPlayer` does and `tick()` streams it five columns per tick (S26), player column first. `entry.sent` (local column keys) is what the player holds. New methods: `sees(pid, cx, cz)` (PlayerManager.isPlayerWatchingChunk), `takeFresh(pid, who)`, `messageFor(pid, tick)` (cells, resent chunks, tile descriptions cut to sent columns). `rules.chunkStream = false` restores the square in the snapshot. The legacy End window (origin -25/-96) now follows the view on its local 16 grid.
- Hooks (short, commented `b72 mpstream72`): `server/server.js` (`chunkViews.messageFor` in `broadcast`; `chunkOut` is sent before the tick broadcast so S26 comes before that tick's cells), `simulation.js` (ObjectTracker gate), `server-object-tracker.js` / `server-mobs.js` / `server-mob-entries.js` / `entity-tracker.js` `PlayerWatch.gate` / `server-vehicles.js` (tracking needs the column sent; re-list when columns change), `client.js` (a buffered `dimRespawn` drops buffered `chunk*` of the old world), `client-chunks.js` + `remote-mobs.js` + `remote-vehicles.js` + `main.js` (`host.entities` -> `dropColumns`).
- Wire: no new names; `chunkBulk` / `chunkUnload` unchanged, the snapshot now has no columns.
- Tests: `src/mpstream72-b72.test.js` (10, one with a real WebSocket join). Adjusted: `mpchunks71-b71` (fixture sets `chunkStream = false`), `mpend-b63`, `mpendwindow-b65`, `mpnether-b61` (same, they read snapshot columns), `multiplayer.test.js` (welcome has no columns, a bulk follows; Bob waits for his column before the block change).

## Evidence
- Bytecode-read (javap on the unchanged jar): `NetHandlerPlayClient.a(gx)` (S21) -> `WorldClient.a(IIZ)` (doPreChunk) -> `ChunkProviderClient.b(II)` -> `Chunk.d()` (onChunkUnload): `World.a(aor)` per tile entity and `World.b(List)` (unloadEntities) per entity list. So the native client drops every entity of an unloaded column, tracker entry or not.
- Recalled (not re-run): PlayerInstance.sendToAllPlayersWatchingChunk skips players whose `loadedChunks` still holds the chunk; `isPlayerWatchingChunk` = in the instance's watcher list and not in `loadedChunks`; EntityTrackerEntry.tryStartWachingThis needs it; `PlayerManager` calls the entity tracker for the chunk after S26; GuiDownloadTerrain closes on the first S08.
- Found by reading, no new Java probe: ChunkWatch (b71, executed) already models the join queue, so streaming only changes who calls `take`.

## Findings per item
1. Streaming join: done. The client needs no physics wait: in multiplayer the server moves the player (`movementTick` returns after sending input), so an empty world around the camera is only visual. Messages (including the first bulks) are buffered until `client.start()` and applied in order.
2. Per-player block changes: done (`messageFor`). Native sends nothing for a chunk still in `loadedChunks`; here a player gets cells only for columns in `sent`. The player's own `blocks` resend (clicker) is not cut.
3. Entities on unload: client copies of mobs and vehicles in the column are dropped (`dropColumns`); items and orbs ride the per-tick list the server now cuts with the same gate. Native's tracker does NOT remove an entity that is in range but unwatched, so a mob can vanish on the client while the server still tracks it; the port matches that (rare: range = view*16-16 is tighter than the square). Not done: remote players (presence list is global), tile entity maps on the client (signs, chests) are not cleared on unload.
4. Legacy End: not aligned to native chunks, so it uses the local grid. Borders sit 7 blocks off native in x; documented, not executed.

## Verification
- `node --test src/mpstream72-b72.test.js`: 10 pass. Adjacent files, one at a time, all pass: mpchunks71-b71 10, mptrackers71-b71 10, mpend-b63 5, mpendwindow-b65 5, mpnether-b61 7, multiplayer 5, multiplayer-refusal 5, mpdragon-b64 6, mpnether3-b63 9, plus accounts, away-commands, b61/b62/b64-lead, dimension-live, mpclicks-b70, mpadmin71, mpcontainers2, mpend2/3, mpfixes69, mpgolems, mpdragon2, mppaintings, mpping, mpnether2, mppistons, mpspawners2, mpstate, mpsurvival, mpsummon, mpwither-b63/b64, mpworldcmds, serverprops/2, simulation-replay, summon2, serverchunks, hanging. `node --check` on every touched file ok; `npm run build` ok. Several older tests set `rules.chunkStream = false` or wait for their column (tracking and cells now need the column sent).
- Full npm test not run (batch rule). No browser checks.

## Follow-ups
- Only a browser shows: the blank-world launch (`launch(record, prepared)` with every column absent), light and mesh refresh while 49 columns arrive in 10 ticks, "Downloading terrain" timing.
- Remote player entities and client tile-entity maps are not dropped on unload.
- `rules.chunkStream` is a test/ops switch, not read from server.properties.
