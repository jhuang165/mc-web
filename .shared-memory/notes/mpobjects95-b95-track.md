# mpobjects95 (batch 95): the chunk-update flush (mq.b) moves before the entity pass on the dedicated server (Overworld)

## Summary
- **`multiplayer/simulation.js`**: the tick message's block changes (`changes`, `chunks`, `tiles`) are now built by `flushChanges()`, called after `weather.drain()` and before `tickBlockEvents`, the entity pass and everything after. Changes made later in the tick (block events such as pistons, mobs, falling blocks, TNT, hoppers, beacons, lamp diff) stay in `this.changes` and go out in the NEXT tick's flush. `settleChanges()` runs the light flood and `dropTiles` for those at the end of the tick (the world sees them at once, as natively); a `settled` set (cleared by any later `put` of the cell) prevents re-flooding at the next flush. `dirtyTiles` is split the same way (descriptions go with the flush they belong to). `litDiff` advances `beforeLit` so the lamp/rail diff is attributed to the flush after it.
- New test `src/mpobjects95-b95.test.js` (3 tests).
- Not touched: the Nether/End lanes (`server-dimensions.js` `afterTick` still builds one message at the end of their tick), `redstone.lit` field (still end-of-tick state), per-player chunk streaming.

## Evidence
- **Bytecode-read `mt.b`**: after `g()` (tickBlocks) comes `mq.b()`; before `ahp.a` and `Z()` (sendQueuedBlockEvents). `mq.b` iterates the dirty `mr` instances calling `mr.b()` (sendChunkUpdate) and `mr.a()`, then clears the list. Block events (`Z()`) and the entity pass therefore land in the next flush.
- **Port-read**: previously one `changes` map flushed at the very end of `tick()`.
- **Executed (port, node)**: `mpobjects95-b95.test.js`.

## Verification
- `node --test --test-concurrency=2 src/mpobjects95-b95.test.js`: 3 pass; with `simulation.js` reverted: 2 fail, 1 pass (the same-tick case).
- Neighbours: 186 test files naming DedicatedSimulation or multiplayer/simulation (xargs node --test --test-concurrency=2): 1678 tests, 1678 pass, 0 fail. No old test edited.

## Found wrong in the batch 94 list
- None.

## Follow-ups
- Nether/End lanes still send entity-pass changes in the same tick (open).
- `VillageCollection.tick` / `VillageSiege.tick` still inside `mobs.tick` (item 2, not done: with the flush now before the village tick and the block events, the only observable difference left is a door changed by a piston event the same tick).
- Browser-only: nothing seen; pistons and falling blocks reach a client one tick later than before.
