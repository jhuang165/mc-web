# Batch 70 serverprops2: server.properties follow-ups

## Summary
- `server-vehicles.js`: the `vehicles` message range is `min(80, rules.trackerLimit)` (EntityTracker `v*16-16` clamp). `server-spawners.js`: `tickSpawners` takes `viewDistance`; the puff `sq` and the spawner cart status range use it. `simulation.js` and `server-nether.js` pass `rules.viewDistance`.
- `server-dimensions.js` `netherMessage`: with allow-nether false the Nether and End are not ticked.
- `simulation.js`: a player's game mode is saved as `player.gameMode` and restored on rejoin unless force-gamemode (no tag: the server mode, as before).
- `server-properties.js` `protects`: the spawn-protection centre for a native world (`nativeSpawn`) is the WorldInfo spawn in local coordinates, not `spawn()`'s random placement. New `saveProperty`.
- `/setidletimeout` writes `player-idle-timeout` back (`ServerAdmin.onIdleTimeout`, hooked in `simulation.js`, `server.js` sets `rules.persistIdleTimeout`).
- Test: `src/serverprops2-b70.test.js` (6 tests).

## Evidence
- Executed: none (the jar has no DedicatedServer or PropertyManager; only tests replaying the readings).
- Bytecode-read (jar, `javap -c -p`): `MinecraftServer.v()` (world tick) skips world index i > 0 unless `w()` (getAllowNether), so with allow-nether false the Nether and the End are loaded but never ticked; `mw.a(dh)` / `mw.b(dh)` read and write `playerGameType`, and the read is skipped (server game type used) when `MinecraftServer.ap()` (force-gamemode) is set; `MinecraftServer.d(int)` (func_143006_e) only stores the idle int; `h()` (generate-structures) is read only to build `WorldSettings` for a new level.
- Recalled: `DedicatedServer` overrides `func_143006_e` to set the property and save; the vehicle (80), item (64) and object ranges and that PlayerManager radius clamp are from batch 68/69 notes.

## Findings per item
1. Closed for the vehicle message, the spawner puff and the cart status. Items and orbs are not range-limited at all on the server: `itemsField` and `xpField` send every item and orb to every player of the dimension (items cap 300). Native tracks items at 64 and orbs at 160 (both clamped). Filtering them needs a per-player item list on the wire; left open. There is no server object tracker (`ObjectTracker` is the client's).
2. Not changed. The server world is finite (8x8 chunks) and the welcome snapshot sends every column; native PlayerManager radius only matters below view-distance 8 or far from the centre. A real change needs incremental column streaming (protocol). The client still ignores the welcome `viewDistance`.
3. Found wrong: the repo ticked the Nether and End. Now they do not tick with allow-nether false (portal travel was already blocked). A player saved in the Nether stays frozen there, as natively (the player entity is updated by the world tick).
4. Closed.
5. Fixed for native worlds (generation 18). The server's default generation 9 has no WorldInfo spawn; its `spawn()` is a deterministic dry-land search, kept.
6. Closed (override of the jar's setter recalled).
7. No change: generation 9 has no structure step; mineshafts come with generation 11, all structures with 14, and a saved world keeps its generator. The flag stays a creation-time value.

## Verification
- `node --test src/serverprops2-b70.test.js`: 6 pass.
- `node --test` on serverprops2-b70, serverprops-b69, mpadmin-b68, mpspawners2-b65, mpnether-b61, mpnether3-b63, multiplayer, summon2-b68: 73 pass, 0 fail. `npm run build`: ok. `node --check` on every touched file: ok. Full npm test not run (batch rule). No browser checks.

## Follow-ups
- Per-player item and orb tracking ranges (item 1).
- Incremental column streaming by view distance, and the client using the welcome `viewDistance` (item 2).
- Only a browser could show the effect of a short view distance on distant carts and puffs.
