# mpobjects93 (batch 93): SpawnerAnimals at its native place, one scheduled-tick tree per server dimension

## Summary
- **`multiplayer/server-mobs.js`**: new `spawnStep()` (difficulty sync + `spawnPass()`, sets `spawnStepped`); `tick()` skips its own pass once when the flag is set, so a direct `tick()` (tests) still spawns.
- **`multiplayer/simulation.js`**: `this.mobs.spawnStep()` now sits between `sleep.worldTick()` and `tickScheduledSystems`; builds `this.tickTree = attachTickTree({fluids, fire, falling, redstone: {redstone, tickBegin}})` right after the redstone restore (the pending lists are loaded by then; `attach` renumbers them in tree order) and passes it to `tickScheduledSystems`.
- **`multiplayer/server-nether.js`** (Nether and End share it): same `spawnStep()` before the scheduled pass, same per-dimension `n.tickTree`.
- **`world-tick.js`**: `tickScheduledSystems` skips the redstone `beginTick/tickUpdates` pair when a `tickTree` is given (the tree's redstone source already began, took and ran the entries); `endTick(true)` unchanged.
- Single player is untouched (it already used the tree; `ServerMobs` is server-only).

## Evidence
- **Bytecode-read** `mt.b` (from the batch 92 note): sleep check, SpawnerAnimals, chunk unloading, skylight, time, tickPending, tickBlocks. The port's spawner already reads the previous tick's skylight (`spawnDarkness`), so moving it earlier changes no light input; it still follows the sleep skip.
- **Port-read** `tile-ticks.js TickTree`: takes the due entries of all sources by (delay, priority, creation id), cap 1000, as the single TreeSet; the same code the single-player game runs (batch 33 onward).
- **Executed (port, node)**: `mpobjects93-b93.test.js`.

## Verification
- `node --test --test-concurrency=2 src/mpobjects93-b93.test.js`: 4 pass. With `simulation.js` and `server-mobs.js` reverted: 3 fail, 1 pass (source pin on the Nether file, unreverted).
- Neighbours: see the lead reply for the count of the 289 related test files run.
- No `npm run build`, no browser checks.

## Found wrong in the batch 92 list
- None.

## Follow-ups
- The tree has no `foreign` source on the server (no ForeignTicks list exists there), so scheduled ticks of other block kinds (none are scheduled by the server today) would need one.
- Redstone entries in unloaded columns are deferred by the redstone engine itself, not frozen in time as the other kinds are (as in single player).
- Every system keeps its own `time` counter; they advance together in the tree's `begin`, so delays agree.
- Browser-only: nothing new is visible; spawn timing differs by at most one tick in what a client sees.

## Late additions
- `tickScheduledSystems` also drains `redstone.thisTick` after the tree: an entry deferred earlier (column not resident, mpcmd82 residency) is released by `retryDeferred` in a later tree tick but the tree only runs entries it took that tick; without the drain it never ran (caught by `mpcmd82-b82.test.js`).
- `mpobjects92-b92.test.js` order test edited: it spied `fluids.tick` / `fire.tick` / `redstone.tickUpdates`, which the tree path no longer calls; it now spies each system's `beginTick` (same order assertions, the encoding was structural, not native).
- Neighbour run: 289 files naming simulation / server-nether / world-tick / server-mobs / tile-ticks / spawnPass / attachTickTree: 2747 tests, 2745 pass; the 2 failures were the b92 order test (fixed above) and `horse92-b92` "unsaddledRear" (a timing-dependent failure under load; passes alone, 24/24, unrelated pure physics).
