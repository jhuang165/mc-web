# mpobjects96 (batch 96): Nether / End lanes flush at mq.b's place; the village tick moves to mt.b's place

## Summary
- **`multiplayer/server-nether.js`** (`tickNether`, shared by the Nether and the End): after `weather.drain()` it runs `flushDimension` (lamp/rail diff, light flood once per merged box, `dropTiles` once per cell, then the `changes` / `chunks` / `tiles` of the tick message) and stores it in `n.flushed`; then `n.mobs.villageStep()`; then the block events and the entity pass. At the end of the tick `dimensionLitDiff` + `settleDimension` settle what the later passes changed (the world sees it at once); those cells go out in the NEXT tick's flush. `n.settled` mirrors the Overworld's `settled` set.
- **`multiplayer/server-dimensions.js`**: `netherMessage` no longer builds the message at the end; it uses `n.flushed` (empty when the dimension was not ticked). The Nether's put hook clears `n.settled` for the cell. **`server-end.js`**: same put-hook line (it ran `n.changes.set` only; the tests of the End did not need more).
- **`multiplayer/server-mobs.js`**: `villageStep()` runs `villages.tick()` and `siege.tick()` and sets `villageStepped`. **`entities.js`** `tickMobs` skips its own village/siege tick once when `villageStepped` is set (a direct `tickMobs` still ticks them). **`multiplayer/simulation.js`**: `this.mobs.villageStep()` right after `flushChanges`, before `tickBlockEvents`.
- New test `src/mpobjects96-b96.test.js` (3 tests).

## Evidence
- **Bytecode-read `mt.b`**: `a(Z)` tickUpdates, `g()` tickBlocks, `mq.b()`, then `wc.a()` (`ahb.A`, VillageCollection.tick) and `wb.a()` (`ahb.B`, VillageSiege.tick), then the `portalForcer` section (`ahp.a`), then `Z()` block events; the entity update follows. The Nether and End WorldServers run the same `mt.b`.
- **Port-read**: the village tick sat inside `EntityWorld.tickMobs` (after the entity pass's block events and the tracker update), the Nether/End message was built after the whole tick.
- **Executed (port, node)**: `mpobjects96-b96.test.js`. Observable case: a block event that changes a cell is seen by the village tick of the NEXT tick only (log order village, siege, event).

## Verification
- `node --test --test-concurrency=2 src/mpobjects96-b96.test.js`: 3 pass; with the source files reverted: 3 fail.
- Neighbours: 296 test files naming DedicatedSimulation, multiplayer/simulation, server-dimensions/nether/end, village or server-mobs (xargs node --test --test-concurrency=2): 3005 tests, 3005 pass, 0 fail. No old test edited.
- Incident: one command ran the whole suite by accident (a BSD `sed -i` without a suffix failed and the guarded `FILES` was set after `&&`); I stopped that run with TaskStop (my own task only), nothing else touched.

## Found wrong in the batch 95 list
- None.

## Follow-ups
- The villages' own door scan inputs (door blocks read at the tick) are the same data as before; a village door changed by a player edit in the action phase is still seen the same tick, as natively.
- `redstone.lit` field of the tick message is still the end-of-tick state.
- Browser-only: nothing seen; Nether/End pistons and falling blocks reach a client one tick later than before.
