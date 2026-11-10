# awayrun6 (batch 36)

## Summary
- **Player trace while away.** `dimension-live.js` `traceAway` records the trip: a position/dimension sample about every second and a state snapshot whenever the player's serialized state changed (bounded). `plan.trace` and `plan.tickBase` go to the worker. `away-commands.js` `syncShadow` moves the shadow player to the sample in force at each firing and applies what the player changed between snapshots (inventory count differences, experience gained, game mode) on top of earlier commands' effects. `@p[lm=..]`, `@p[m=..]`, `clear`, `give` therefore see the state at firing, not the return state.
- **Return no longer re-runs give/clear on the return state.** That would have been wrong with a trace (a `clear` that found nothing at tick 20 took what he found later; seen in the first browser run). The run returns `inventoryDelta` (shadow inventory vs the last trace snapshot) and `replayPlayerCommands` applies it as one net change for shadow-run give/clear; other queued commands still replay, and fire-time SuccessCount/LastOutput are kept.
- **`/spawnpoint @p` (no coordinates)** uses the target's block position from the trace at firing (`mw.f_`: floor x, floor(y + 0.5), floor z; forced, bytecode-read). No-argument form fails for a command block natively (already ported). `src/commands.js` `spawnpoint` read the sender's position and `floor(y)`; it now reads the target's position with the +0.5 rounding (live fix: a command block's `/spawnpoint @p` used the block position).
- **`/setworldspawn` mid-run** (bytecode-read `ms.b`, `mt.a`, `MinecraftServer.tick`): the area never grows; at the next `tickCounter % 900 == 0` autosave chunks outside the new spawn area unload. Ported with `areas` + `plan.tickBase` in `away-world.js`.
- **Per-write fluid notification** in the away world (`fluids.writers` + flush per run).
- **Entities tick only when every chunk within 32 blocks is loaded** (`ahb.a(sa, true)` / `ahb.b(IIIIII)`, bytecode-read). New `entityTicks` in `away-world.js`, used at plan time for all entity lists and per tick for mobs and hanging entities.
- Docs: `public/research/dimensions.md` "Batch 36". Small hooks in `main.js` (two extra options to `replayPlayerCommands`) and `dimension-live.js`.

## Verification
- Focused: away-commands 16, away-world 10, away-entities (with the new 32-block test), away-mobs, away-spawn, away-tick-tree, dimension-away, commands, command-selector, command-block (77 together), dimension-live and tick-tree-runtime (27): all pass. The full suite and `npm run build` were left to the lead. Load average was about 5 at the time of the runs.
- Browser (muted headless Chrome, port 5373, `artifacts/b36-awayrun6/away.mjs`): blocks `clear @p diamond` at tick 20, `clear` at 700, `spawnpoint @p` at 900, bare `spawnpoint` at 910; in the Nether the player picked up 2 diamonds about 8 s in and walked 4 blocks. After the return: first clear failed (nothing yet), second removed 2 items, `spawnpoint @p` set (11, 71, 9) = his block position at tick 900, bare `spawnpoint` gave "That player cannot be found", diamonds 0, replay summary `byDelta 2`. Only a 404 resource message on the console.

## Follow-ups (proposed gap lines)
- The trace is sampled about once a second (position, and state changes within a second merge); health, hunger and effects are not carried into the shadow; experience drops take the snapshot's value.
- Scheduled ticks in a column that unloads mid-run keep running with refused writes instead of being re-queued; the 100-chunks-per-tick unload rate is treated as immediate.
- Items, orbs, TNT, carts, boats, arrows and thrown projectiles are tested for the 32-block rule only at plan time, not as they move.
- `/setworldspawn` with no arguments from a command block: the live command uses the sender position; natively `getCommandSenderAsPlayer` (not re-checked here, the class was not found by string search).
- `tickCounter` phase for the autosave is the game's tick counter at departure, not the server's.
