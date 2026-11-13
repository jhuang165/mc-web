# Batch 61 mpnether: the Nether on the dedicated server

## Summary
- `src/multiplayer/server-dimensions.js` (new): `ServerDimensions`. Builds a second finite world (8 x 8 columns) for the Nether on first use, filled from `DimensionWorld.generateTerrainChunk` (about 1.1 s once, blocks the tick once). Per-player `dimension` and `world`. Portal timer (`PortalState`, 80 ticks Survival, 1 Creative) and trip (`transferTarget` scale 8 about the world middle 64,64, target kept 24 blocks inside the edge, `Teleporter` with `placeInExistingPortal` radius 128 and `makePortal`, one Teleporter per dimension with `removeStale`). `within(p, fn)` swaps `sim.world/items/changes/farming/trees/containers/redstone/tileEntities` so a Nether player's dig, place, drops and windows hit the Nether. Flint and steel (`useItem`), the `portal` achievement, save and restore of the Nether edits, signs, skulls and each player's dimension. Death in the Nether respawns in the Overworld (wraps `ServerSurvival.respawn`).
- `src/multiplayer/client-dimensions.js` (new): `FiniteDimensionWorld` (finite, no streaming, Nether rules: no sky, height 128, Hell biome) and `restoreDimensionReplica`.
- `simulation.js`: small hooks (constructor, addPlayer, savePlayer, save, snapshot(playerId), presence(dimension), within around survival tick and actions, p.world for blocks and void spawn, crack and sound dimension filters, flint hook in `edit`). `server-achievements.js` and `server-items.js`: per-dimension biome, beacon and aux filters. `server/server.js`: `snapshot(id)`, `broadcast(message, alt)` per-dimension tick, `dimensions.flush` sends `dimRespawn` before the next tick. `client.js`: `restoreReplica` delegates Nether snapshots; `dimRespawn` handling (queues later messages until `start()`). `main.js`: `multiplayerDimension` (the trip path), `onDimRespawn`, `fire.ignite` sound, join chat line. `dimension-live.js`: `host.remote()` stops the local portal trip, End portal and entity portals on a dedicated-server world.
- Wire messages: `dimRespawn` (server to client: `dimension`, `world` snapshot with `dimension`, `self`). Welcome snapshots of a player saved in the Nether carry `world.dimension`. Tick messages are per dimension (same type `tick`).

## Evidence
- bytecode-read: `EntityPlayerMP.travelToDimension` (mw.b) awards `pc.y` = `achievement.portal` on every trip except to or from the End (`pc.C` theEnd, `pc.D` theEnd2). `oi.a(mw,int)` sends S07 Respawn then re-syncs inventory and health.
- executed (earlier batches, reused): the Teleporter, PortalState and transferTarget rules (`dimensions.js` reference tests). New executed checks are the JS tests below; no new Java probe this batch.
- recalled: the 8x coordinate scale and the 80/1 tick timers match the single-player code that already carries probe evidence.

## Verification
- `node --test src/mpnether-b61.test.js`: 7 pass.
- `node --test src/mp*.test.js src/multiplayer*.test.js src/dedicated-beacon.test.js src/server*.test.js src/dimension-live.test.js src/dimension-rules.test.js src/entity-portal.test.js src/nether-portal*.test.js`: 840 pass, 0 fail.
- `node --check` on every touched file; `npm run build` passes. Full npm test not run (batch rule).
- Scope check: the identifiers `multiplayerDimension` reads (`openingWorld`, `tripLoading`, `mpWindow`, `remoteItems`, `requestedPickups`, `remoteOrbs`, `xpOrbs`, `aimedRemoteMob`, `keys`, `$`) are module-scope in `main.js`.
- Only a browser could show: the real world swap (`launch` on a Nether replica: lighting, fog, sky, music), the loading screen, the portal overlay, remote players appearing after a trip.

## Follow-ups
- Nether mobs: none (the Nether has no mob view; Overworld mobs do not see a Nether player). Pigmen, ghasts, blazes and fortress spawners are open.
- Not in the Nether: fluids, fire spread, falling blocks, redstone, containers (chests do not open), XP orbs (quartz XP is lost), light volume, random ticks. Nether items are not saved. Beacons and spawner tiles there are not saved.
- The Overworld message of the trip tick still lists the traveller (built before the trip); the client ignores it.
- Eat/burp sounds of a Nether player are tagged by the player's dimension only for eat/drink; burp has no player and goes to Overworld listeners.
- The End (`theEnd`, `theEnd2`, dragon, end portal) is not connected; `FiniteDimensionWorld` is Nether-only and `ServerDimensions.arrive` handles only 0 and -1.
- `claim_work` was refused (the lead holds a broad claim); no filesystem locks were involved.
