# Batch 69 mpmaps: maps on the dedicated server

## Summary
- `src/multiplayer/server-maps.js` (new): `ServerMaps` uses the single-player `mapStore`. Empty-map use (`useEmpty`), the per-tick `ItemMap.updateMapData` pass for held maps in every dimension, S34 packets to holders, item-frame packets to every player of the frame's dimension, save field `maps`, `leave` drops the player's MapInfo. Also exports `packetInfo`, `drainDirty`, `mapPacket` (the MapInfo.getPacket cadence).
- `src/multiplayer/client-maps.js` (new): `applyMapMessage`, `applyMapPayload` (validated), `connectMaps`, `disconnectMaps`. Sets `mapStore.remote = true` on the client.
- `src/maps.js`: `MapStore.remote`; `mapOnCreated` does nothing on a remote store. `src/maps-clock-live.js`: `worldContext` takes dimension and an origin (End window offset); `MapsClock.tick` returns early on a remote store.
- Hooks: `simulation.js` (construct, tick, save, player leave, empty-map use with and without a block target), `client.js` (buffers `mapData`, calls `onMaps`), `main.js` (connect, disconnect, no map reload on a dimension trip).
- Crafting clone and zoom work through the existing `survival.craftingResult` path with the server's store; no extra code.
- Wire name: `mapData` (message type, `{ maps: [{ id, b: [bytes] }] }`). No other new names.
- No frame edits in `server-hanging.js`.

## Evidence
- Executed: `tools/probes/MapPacketProbe.java` on the unchanged 1.7.10 classes writes `public/research/map-packet-reference.json` (MapInfo.getPacket records: scale record, icon list, column cadence, dirty merge, frame resend). Driven by `tools/verify-map-packets.mjs`. Map rules in `maps.js` were already executed (`maps-clock-reference.json`).
- Bytecode-read: `EntityPlayerMP.onUpdateEntity` sends a packet per map slot each tick; `EntityTrackerEntry` frame map update every 10th entry tick over all players of the world (not only trackers), with `onFrame`.
- Recalled: ItemEmptyMap creative size restore; End window native = local + origin.
- Found wrong: the single-player comment "players tracking it" for frames; native iterates all world players.

## Verification
- `node --test src/mpmaps-b69.test.js`: 16 pass, 0 fail.
- Regression, one at a time: `maps-clock.test.js` 9, `player-throw-replay.test.js` 2, `mppaintings-b68.test.js` 12, `dedicated-beacon.test.js` + `multiplayer-refusal.test.js` 11, `multiplayer.test.js` 5; all pass.
- `node --check` on every touched file; the `main.js` identifiers are imported at module scope (lines 186, 228).
- `npm run build` passes. Full npm test not run (batch rule).
- Only a browser could show: the held map and frame map rendering from received data, and the map staying intact across a dimension trip on a real server.

## Follow-ups
- The client trusts the page's global `mapStore`; two servers in one page session are not separated beyond `leaveMultiplayer`.
- No real-socket test of `mapData`; tests cover the simulation and the client apply function.
