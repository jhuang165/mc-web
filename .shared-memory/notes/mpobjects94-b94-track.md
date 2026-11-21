# mpobjects94 (batch 94): the tail of WorldServer.tick on the dedicated server (block events, portal-cache sweep); audit of the rest of mt.b

## Summary
- **`world-tick.js`**: `tickScheduledSystems` skips `redstone.endTick(true)` when `systems.eventsLater` is set; new `tickBlockEvents(systems)` runs it.
- **`multiplayer/simulation.js`, `multiplayer/server-nether.js`** (Nether and End): pass `eventsLater: true` and call `tickBlockEvents` after the random ticks, the weather bolts and `weather.drain()`, before the entity pass. Block events (and the sensor and plate scans that ride in `endTick`) used to flush right after the scheduled tree, before the random ticks.
- **`multiplayer/server-dimensions.js`**: `sweepTeleporters`; the Overworld teleporter's `removeStale` runs at the start of `afterTick` (before every player's portal check and the Overworld mob travel); the Nether/End sweeps stay after the Overworld's portal work and before the Nether's own tick. Previously all swept after the checks.
- Not touched: portal travel logic, perf fast paths, NBT, mob records (only the sweep call order in server-dimensions.js).

## Evidence
- **Bytecode-read `mt.b`** (WorldServer.tick), order after the sleep skip: mobSpawner (aho.a), chunkSource (`apu.d()`, unloadQueuedChunks), skylight, total time +1, tickPending (`a(Z)`), tickBlocks (`g()`: random ticks and lightning), chunkMap (`mq.b()`, PlayerManager.updatePlayerInstances), village (`wc.a()` VillageCollection.tick, then `wb.a()` VillageSiege.tick), portalForcer (`ahp.a(ays.I())`), then `Z()` (sendQueuedBlockEvents). Then MinecraftServer runs updateEntities, then the tracker.
- **Bytecode-read `ahp.a(J)`**: `if (t % 100 == 0)`, entries with `lastUpdate < t - 600` removed. The server's `sim.ticks % 100` and 600 limit already agreed; only the position was off.
- **Port-read**: a trip into the Nether uses the Nether WorldServer's Teleporter, swept in the Nether's tick, after the Overworld's entity pass; a trip into the Overworld (from the Nether, in the Nether's entity pass) finds the Overworld's cache already swept. The port ran the portal checks first for both.
- **Executed (port, node)**: `mpobjects94-b94.test.js`.

## Verification
- `node --test --test-concurrency=2 src/mpobjects94-b94.test.js`: 3 pass. With `simulation.js` and `server-dimensions.js` reverted: 3 fail.
- Neighbours: 187 test files naming server-dimensions, DedicatedSimulation, tickScheduledSystems, world-tick, server-nether, sendQueuedBlockEvents, removeStale (xargs node --test --test-concurrency=2): 1915 tests, 1915 pass, 0 fail. No old test edited.
- No `npm run build`, no browser checks.

## Audit results (what the server does vs mt.b)
- **Sieges / villages**: VillageSiege never spawns a zombie in 1.7.10 (siege-reference.json), so there is no spawn-before-or-after-entities effect; its Random is the village host's own `worldRandom`, separate from the server's weather Random, so draw order against the random ticks is unobservable. The Village tick (iron golem spawn, door scans) runs in `tickMobs` after the random ticks and before the entity walk, as natively. One residual: natively village/siege run BEFORE the block-event flush; here the flush is now earlier than the village tick (it cannot be split from `mobs.tick` without a refactor). Only a door moved by a piston in the same tick could see it.
- **Chunk unloading**: the server window is finite (128 x 128); `unloadQueued` is a no-op without a chunk-load tracker, and the residency model (b82) covers scheduled ticks only. Nothing unloads on the server, so its position relative to tickPending has no observable effect. Left as is.
- **Foreign tick source**: none needed. Server paths that schedule other kinds (command block, dispenser, detector rail, plates, buttons, lamps) go through `LiveRedstone.scheduleBlockUpdate`, which is the redstone source of the tree; fluids, fire and falling have their own. `importTileTicks` (foreign kinds) is region import only (single player), never loaded by the server.

## Found wrong in the batch 93 list
- None.

## Follow-ups
- **updatePlayerInstances position** (open, not fixed): natively `mq.b()` flushes the dirty-chunk block changes (S23 / S22) after tickBlocks, BEFORE updateEntities; changes made in the entity pass (falling block landing, endermen, mob grief, TNT, moving pistons finishing) go out in the NEXT tick's flush. The server collects every change in one `changes` map and sends the whole map at the end of the tick, so entity-pass changes arrive one tick early. Fixing it means splitting `changes` at the flush point (and its light update, `dropTiles`, tile descriptions); large blast radius over the many tests that read one tick's message, so left open. The per-player chunk streaming part of PlayerManager (`mq.d(mw)` after a move) is a different function and was already placed (b71).
- VillageCollection.tick / VillageSiege.tick sit inside `mobs.tick` (see above).
- Browser-only: nothing new is visible; a piston reacting to a random-tick-queued event moves one tick earlier on a client.
