# mpobjects92 (batch 92): scheduled ticks and tile entities at their native point, sleep skip order, adoptSpawns with removals

## Summary
- **`world-tick.js`**: new `tickScheduledSystems` (falling's scheduled entries, farming, fluids, fire, then the live redstone engine's `beginTick`, `tickUpdates`, `endTick(true)`: block events and sensor scans, tile loop deferred) and `tickTileSystems` (hoppers, brewing, `redstone.updateTileEntities()`). `tickWorldSystems` is untouched (single player keeps its own flow).
- **`multiplayer/simulation.js`**: tick now runs `weather.updateWeather()` (timers), `sleep.worldTick()`, `tickScheduledSystems`, then `weather.tick(world, null, true)` (random ticks, bolts), the entity pass, `falling.tickEntities()`, maps, `tickTileSystems`, then `dispense.flush()` (tracker). `pistons.flush`, beacons stay after.
- **`multiplayer/server-nether.js`**: `tickScheduledSystems` before `weather.tickDimension`, `tickTileSystems` after the entity pass, before `dispense.flush()`.
- **`falling.js`**: `tickEntities()` split out of `tick()` (`tick({entities:false})` is the scheduled part). **`weather.js`**: `tick(world, player, timersDone)`.
- **`entities.js`**: `spawnsPending()` compares the list length AND the tail entity; `adoptSpawns` and both `noteMobSpawns` triggers use it, so a removal and a spawn in one turn (equal length) no longer hides the spawn.

## Evidence
- **Bytecode-read** `mt.b` (WorldServer.tick): `ahb.b` (weather timers), all-asleep check and time set, `d()` (wake), "mobSpawner" spawner, skylight `a(F)I` stored to `j`, then world time +1, "tickPending" `a(Z)` (tickUpdates), "tickBlocks" `g()`, chunkMap, village, portalForcer, `Z()` (block events). The skylight is computed AFTER the sleep skip and AFTER the spawner.
- **Bytecode-read** `ahb.h` (updateEntities): weather effects, then `removeAll(unloadedEntityList)`, then the entity loop by `size()` index; a dead entity is removed inside its own turn (`remove(i--)` after its update); tile entities after the loop. Removal is NOT deferred to the next tick for dead entities, only for unloaded ones.
- **Executed (port, node)**: the spy tests in `mpobjects92-b92.test.js`.

## Verification
- `node --test --test-concurrency=2 src/mpobjects92-b92.test.js`: 4 pass, 0 fail. With `entities.js` and `simulation.js` reverted: 3 fail (order, sleep capture, adopt), the Nether source pin passes (its change is in an unreverted file).
- Neighbours: 443 test files naming simulation, server-nether, world-tick, falling, weather, entities, DedicatedSimulation, adoptSpawns (`xargs node --test --test-concurrency=2`): 4946 tests, 4946 pass, 0 fail. No old test edited.
- No `npm run build`. No browser checks. MC_MPPERF modes compare the same code paths, so verify hashes stay equal; no recorded hash edited.

## Found wrong in the batch 91 list
- "`sleep.worldTick` stays after the `spawnDarkness` capture": native computes skylight after the skip, so the capture must follow the skip (now it does). The old order captured the night value on a skip tick.
- adoptSpawns "native removals are deferred to the start of the next updateEntities": only unloaded entities are; dead ones leave the list in their own turn.

## Follow-ups
- SpawnerAnimals (inside `mobs.tick`) still runs after the scheduled pass; natively it precedes tickPending. Needs a split of `naturalSpawn` from the walk.
- Scheduled entries still run system by system (falling, farming, fluids, fire, redstone), not as one tree sorted by time/priority/id as natively.
- The weather timers now run before `lastLightning`-free bookkeeping only in the server; client unchanged.
- Hopper/brewing tick order relative to the piston tile loop follows the port's old order, not tile add order.
