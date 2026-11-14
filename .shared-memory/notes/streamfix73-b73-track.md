# Batch 73 streamfix73: remote player tracking and client tile entities on unload

## Summary
- `src/multiplayer/server-player-tracker.js` (new, `ServerPlayerTracker`): one `TrackerEntry` per (viewer, other player), range 512 and frequency 2, velocity false, range clamped by `rules.trackerLimit`, square test, 4-block re-list of the viewer, and the sent-column gate (`chunkViews.sees`). The viewer's tick `players` rows keep the full row for himself and tracked players; any other player becomes `{ id, name, far: true }` (the player-list entry, no entity). The welcome snapshot is cut the same way (`snapshot`).
- Hooks: `simulation.js` (builds `playerTracker`), `server/server.js` (two commented calls: tick message and welcome), `server-chunk-view.js` (`FRESH` + `'players'`, so a column change re-lists), `presence.js` (`RemotePlayers.sync` skips far rows, new `dropColumns`), `main.js` (`remotePlayers?.dropColumns` in the unload hook, far rows ignored in the two collect lookups, `dropTiles` host hook), `client-chunks.js` (calls `host.dropTiles`).
- `src/multiplayer/client-tiles.js` (new, `dropTilesIn`): on `chunkUnload` removes the signs, skulls, beacons, spawners, chests, ender tiles and moving piston tiles of the columns. A re-sent `chunkBulk` restores them through its `tiles` (describeTiles, `contChest`).
- Wire: no new names; `players` rows may carry `far: true`.
- Tests: `src/streamfix73-b73.test.js` (9).

## Evidence
- Bytecode-read (javap -c -p, unchanged jar): `mn.a(sa)` for `mw` (EntityPlayerMP): `a(entity, 512, 2)` -> `a(sa,int,int,false)`, which clamps to `e`, then every entry gets `my.b(player)`, which returns for the player's own entry and otherwise runs the square test on `d/32` and `f/32` (lastScaledPosition, integer division).
- Bytecode-read (b72, reused): S21 -> `Chunk.onChunkUnload` removes the tile entities and entities of the column.
- Executed (earlier batches, reused): TrackerEntry square test and 4-block re-list (`tracker-reference.json`). No new Java probe: the entry code is the one already executed; the new facts are the table row (512, 2, false) read from bytecode.
- Recalled: the tab list (S38) is global, which is why far rows keep the name.

## Decisions and deviations
- Positions still travel every tick in the row. Native sends them at frequency 2 as S14/S18 packets, but the client copy (`PlayerBody.tick`) is fed whole rows and has no packet interpolation; the entry's cadence only decides membership. A packet stream for players would need a new client module (`client-ptrack`, like `client-itrack.js`).
- A tracked player whose column the viewer no longer holds is untracked at once. Native keeps the entity until the range test fails (the same gap as for mobs, see mpstream72); the client copy is dropped with the column, so without this the next tick would bring him back.
- `dimRespawn` snapshots are not cut (the first tick corrects them), as for items.

## Verification
- `node --test src/streamfix73-b73.test.js`: 9 pass. One at a time, all pass: mpstream72-b72 10, mptrackers71-b71 10, mpcadence72-b72 10, multiplayer 5, mpchunks71-b71 10, accounts 4, mpdispense-b61 15, mpend3-b66 4, mpend-b63 5, mpendwindow-b65 5, mphealth2-b61 8, mpitems-b59 10, mpnether-b61 7, mpvehicles-b61 10, player-throw-replay and redstone-ore. `node --check` on touched files ok. `npm run build` ok.
- Full npm test not run (batch rule). No browser checks.

## Follow-ups
- Only a browser shows: a remote player popping in and out at the square edge, a sign vanishing and returning with its column.
- Player position packets at frequency 2 with client interpolation (not done).
