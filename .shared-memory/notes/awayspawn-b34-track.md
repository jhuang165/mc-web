# awayspawn (batch 34)

## Summary
- Spawning while away settled by bytecode-read (aho.a, agq.f/agq.g, mt.b): the Overworld player list is empty, so nothing spawns and no spawner ticks. No spawning added; `src/away-spawn.test.js` pins it.
- `src/away-commands.js`: player-acting commands from command blocks and carts are queued in firing order and replayed on return (`replayPlayerCommands`, called from `main.js` `awayResult`) through the live command host, with native SuccessCount and LastOutput. /tp prints the native text and discards the move; /kill fails natively from a block. `command-host.js` `give` honours `this.giveDrop`.
- `away-world.js` uses the shared `TickTree` (`attachTickTree`), `away-light.js` counts lit furnaces.
- Live fix: no-match selector at a username index is silent (`command-selector.js`, `commands.js`).
- `away-plan.js` carries the wall clock; `dimension-live.js` passes `root` to `awayResult`.

## Verification
- Focused tests: away-commands 9, away-spawn 3, away-tick-tree 1, command-selector, commands, other away tests: all pass. Full `npm test` and `npm run build`: see the final report.
- Browser (muted headless Chrome, port 5361, `artifacts/b34-awayspawn/away.mjs`): a command block giving `/give @p diamond` on a clock while the player is in the Nether. After return the inventory had 3 diamonds and the block had the native SuccessCount and LastOutput.

## Follow-ups (proposed gap lines)
- Away player commands replay at return, not at fire time; block SuccessCount is stale during the run; cart replay only updates saved records; timestamps are estimates.
- spawnpoint and difficulty from away commands stay skipped; sky light is open-sky only; `@f` NPE edge not ported.
- Probable live bug: `world-tick.js` never calls `rt.tickEnd` (block events, tile entities, pistons) when `tickTree` is set. Needs a fix in `world-tick.js`/`tile-ticks.js` (out of this track's scope).
