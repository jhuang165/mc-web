# awayticks (batch 30)

## Summary
- Native rules read from bytecode (no probe): spawn area (chunk centre within 128 blocks of the world spawn) stays loaded with no Overworld player; `tickUpdates` always runs; entities/tile entities run only 1200 ticks after the last player leaves (`mt.h` counter `P`); random ticks, spawning and sieges need players. Written up in `public/research/dimensions.md` "Batch 30".
- New `src/away-plan.js` (pure: spawn-area test, column selection, plan), `src/away-world.js` (headless run: Fluids, Fire, FallingBlocks, redstone runtime, hoppers, brewing, furnaces on a Superflat shell World built from copied live columns), `src/away-worker.js`.
- `src/dimension-live.js`: `beginAway`/`finishAway`/`endAway`, trip ms timing, clock catch-up (`advanceTicks`). `src/world-storage.js`: `writeChunkColumns`. `src/main.js`: host `ticks`, `chunks`, `advanceTicks`, one `dims.endAway()` line in `openWorld`.
- Away ticks = physics ticks away + loading ms / 50 (cap 72000, 4 s wall budget). The result patches the saved root and the edited columns are stored before the Overworld opens.
- Not touched: `scene.js`, `weather.js`, `entities.js`, `remaining-gaps.md`.

## Verification
- `npm test`: 4783 tests, 0 failures (6 new in `src/away-world.test.js`). `npm run build` passes.
- Muted headless Chrome (`artifacts/b30-awayticks/smoke.mjs`, port 5312, `?silent`, `--mute-audio`): lit furnace (16 ore, 16 planks, cook 109) and a water source near spawn, 30 s in the Nether, return. Away run: 657 ticks, 9 columns, 68 ms in the worker; furnace 3 ingots smelted (cook 109 -> 197, burn 291 -> 203), water cells in a 25 x 25 x 17 box 181 -> 281. Return trip loading 5.4 s; long tasks while away 62 ms and 102 ms (Nether), 80 ms on return. One 404 console error (a static asset, not from this change).

## Follow-ups (proposed gap lines)
- Away run does not move mobs, items, minecarts, boats, TNT or fire spread by weather; the native entity gate (1200 ticks) is only applied to the tile entities.
- Dispensers/droppers do not fire while away; note blocks, jukeboxes and command blocks do not run.
- Tile entities outside the container window and spawn-area columns outside the 8 x 8 resident window at departure do not advance (their ticks wait).
- Weather timers are not advanced by the loading screen (only `survival.time`); the unwatch path that queues chunks for unload is assumed, not read; no probe confirms the 1200-tick counter.
- The away run starts when the player returns; starting it earlier (or streaming the result) would hide its latency on very large machines.
