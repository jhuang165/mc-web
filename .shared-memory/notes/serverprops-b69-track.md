# Batch 69 serverprops: server.properties for the dedicated server

## Summary
- `src/multiplayer/server-properties.js` (new): Java Properties parser and writer, `PropertyManager` semantics (missing keys added with defaults, bad ints fall back and are written back), `ServerRules` (the rules the simulation reads), `resolveSettings`, `overridesFrom` (CLI flags and `MC_WEB_*` env vars override a value but are never written to the file), `loadServerProperties` (creates the file with the header and native defaults, or completes an existing one), `loadFavicon` / `faviconFromPng` (`server-icon.png`, must be 64x64), flight, hardcore and spawn-removal helpers.
- `server/server.js`: loads the file in the CLI block; max-players, "The server is full!", status `max`, motd, favicon, difficulty, gamemode, pvp, command blocks, op level, white-list, hardcore respawn hook. Welcome message adds `viewDistance` (the client does not read it yet).
- `src/multiplayer/simulation.js`: `this.rules`, hardcore flag (saved), force-gamemode on join, idle timeout, `blockProtected` in `edit` and dig start, `flightCheck` after movement, `hardcoreTick`, build height limit passed to `serverClick`.
- `src/server-handlers.js`: `limit` parameter (default 256) for the build height checks; `buildHeightMessage(limit)`.
- `src/entity-tracker.js`, `server-mob-entries.js`, `server-mobs.js`, `server-hanging.js`: view-distance sets the active chunk radius, the tracker limit (`v*16-16`) and the hanging range; spawn-animals / spawn-monsters / spawn-npcs gates (`sweepSpawns`, spawn pass flags, no seeded animals).
- `src/multiplayer/server-dimensions.js`: allow-nether false stops portal travel.
- Tests: `src/serverprops-b69.test.js` (19 tests).

## Evidence
- Executed: none. The client jar has no DedicatedServer (`lt`) or PropertyManager (`lq`), so no probe could run them. Tests replay my reading of the rules.
- Bytecode-read (client jar, `javap -c -p`): view-distance clamp 3..20 in PlayerManager and tracker limit `v*16-16`; "The server is full!" check in ServerConfigurationManager; spawn-protection call sites in NetHandlerPlayServer C07 and C08; allow-flight counter (more than 80 ticks, dy >= -0.03125, box grown 0.0625, -0.55) and kick text; allow-nether portal gating (counter not incremented); `WorldServer.a(Entity, boolean)` spawn removals for animals, water mobs and NPCs; hardcore ban source, reason and kick text; difficulty forced to Hard in hardcore; WorldSettings only built for a new level; build-height message in NetHandlerPlayServer.
- Recalled (not in the jar): the property key names and defaults (spawn-protection 16, max-players 20, difficulty 1, gamemode 0, view-distance 10, motd "A Minecraft Server", ...), the property file header and `Properties.store` format, `isBlockProtected` (dimension 0, ops present, non-op, Chebyshev distance), max-build-height rounding `trunc((h+8)/16)*16` clamped 64..256, `server-icon.png` 64x64 check and texts, op-permission-level, player-idle-timeout.

## Verification
- `node --test src/serverprops-b69.test.js`: 19 pass, 0 fail (run twice).
- `node --check` on every touched file: ok.
- `node --test src/server-handlers.test.js src/entity-tracker.test.js src/multiplayer.test.js src/multiplayer-refusal.test.js`: all pass after one fix (the MobTracker limit stays 144 by default; only the server sets `trackerLimit(view-distance)`, because the chunkGate probe changes the watch radius only).
- `node --test src/mpadmin-b68.test.js src/mpping-b68.test.js src/serverchunks-b67.test.js src/servercommands-b59.test.js`: 39 pass, 0 fail.
- `node --test src/mpmobs-b59.test.js src/mpmobs2-b60.test.js src/mpnether-b61.test.js src/mpnether2-b62.test.js src/mppaintings-b68.test.js src/summon2-b68.test.js`: 51 pass, 0 fail.
- `node --test src/mpnether3-b63.test.js src/mpend-b63.test.js src/mpend2-b64.test.js`: 20 pass, 0 fail.
- `npm run build`: ok (only the usual chunk size warning).
- Full npm test not run (batch rule). No browser checks (batch rule); `main.js` untouched.

## Follow-ups
- A newly created file carries native defaults, so a fresh server now starts with max-players 20, difficulty Easy and spawn-protection 16 (old flags defaulted to 8 players). An existing setup without a file gets these on first start; flags still override.
- The repo does not save a player's game mode, so a rejoin always gets the server mode (native keeps the saved mode unless force-gamemode).
- Object, vehicle and item trackers still use the 144 limit; `server-spawners.js` puff clamp still uses `VIEW_DISTANCE`.
- generate-structures and the hardcore flag are creation-time values; generation 9 has no structure generator.
- allow-nether false does not stop the Nether and End from ticking, it only blocks portal travel.
- The client ignores the welcome `viewDistance`, so its render distance is unchanged.
- The spawn-protection centre uses `world.spawn()` when `/setworldspawn` was not used (approximation of `getSpawnPoint`).
- `/setidletimeout` is not written back to the file; spawn-animals / spawn-npcs are removal sweeps, not changes in `server-use.js` / `server-dispense.js` (to avoid conflict with mpfixes69).
- Only a browser could show: the server list favicon and motd rendering, the build-height and flight kick messages on screen, and the visual effect of a short view distance.
