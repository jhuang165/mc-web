# tiles93 (batch 93): the away clock follows /time and doDaylightCycle, chest record facing fallback removed

Branch `batch93-tiles93`, worktree `wt93-tiles`. Target is 1.7.10. This does not claim full parity.

## Summary

- `away-commands.js`: the run's world clock now lives here (`state.clock` pre-step, `step`, `pre`, `gained`; `beginTick(n)`, `endTick()`, `now()`). `beginTick` reads doDaylightCycle (the increment of the tick) and fixes the pre-step time before tickUpdates; `/time` moves `clock`; a `/gamerule doDaylightCycle` from a command block changes the NEXT tick's increment. The returned `timeShift` adds `gained` (ticks the clock moved beyond or short of what the trip assumed), so a rule turned off mid-run no longer leaves the saved time too far ahead. `now()` (the command-block clock) no longer assumes a clock that always moves.
- `away-entities.js`: `beginTick()` snapshots the tick's darkness and increment; `endTick()` advances; `shiftTime` only moves the clock. A `/time` shift anywhere in tick n (command block or tile pass) first reaches tick n+1; before, a shift made after `ents.tick` was subtracted out of the next tick's read too. Standalone use (tests) keeps the old self-advancing tick.
- `away-world.js`: loop calls `cmds.beginTick`, `ents.beginTick`, `cmds.endTick`, `ents.endTick`; the daylight sensor reads the angle at `cmds.now()` and the darkness from the tick's pre-step time (still `daylight-sensor-time.js`); the retroactive `worldTimeAt` (it re-read the rule for the whole run) is gone.
- `chest.js`: `chestFacing` reads only the cell metadata (3 if not 2-5). `main.js`: at load, every chest record runs `migrateChestFacing` once (the renderer repeats it for chunks that load later). The record `facing` is still saved (export, older builds) but is no longer read at runtime.
- Tests changed: `tiles91-b91` (asserted the removed fallback), `tiles92-b92` (shift model needs `beginTick`; source regexes), `tiles88-b88` (source regex of the sensor call). Mechanism, not native behaviour, was encoded.

## Evidence

- Bytecode-read (b88, b92): `WorldServer.tick` computes skylightSubtracted, then the +1 (world time only under doDaylightCycle), then tickUpdates, entities, tile entities. `CommandTime`/`CommandGameRule` run in tickUpdates, so their effect first reaches the next tick's computation. Not re-read this batch.
- Port-read: command-host `setTime/addTime`, `away-commands.js` `now`.
- Executed: none new.

## Verification

- `node --test --test-concurrency=2 src/tiles93-b93.test.js`: 6/6; with the four source files at HEAD: 0/6.
- 35 targeted files (away-*, awaystore86, awaytracker, chest*, tiles8x/9x, tile-sync/tile-edits and others naming chestFacing or away-commands): 252/252. `node --check src/main.js` ok. No full test, no build, no browser.

## Follow-ups

- Main's `awayResult` applies `timeShift` only when the live clock is not frozen at return; an away run that turns the rule ON from off adds a positive shift that is skipped then (main.js, out of scope).
- A run that stops on the wall budget does not count the ticks it skipped in `gained`.
- Optional audit of other tile facing records (dispenser, dropper, hopper, brewing) not done.
- Browser-only: a chest in an old save drawn facing the right way; sensors after a mid-run `/time`.
