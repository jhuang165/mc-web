# awayshadow (batch 37)

## Summary
- **Health, hunger and effects in the shadow player.** Bytecode-read: `CommandEffect` only calls addPotionEffect/removePotionEffect/clearActivePotions; no other away-reachable command touches those fields. `dimension-live.js` `traceAway` samples now carry `[health, food, saturation, exhaustion, effects]`; state snapshots ignore those numbers (and air/timers), so they no longer fill the 300 cap while walking. `away-commands.js` follows the player's own change between samples as a difference, ticks the effects the commands gave, and returns `playerDelta` (net health/food/saturation/exhaustion, effects left with their remaining time, effects removed). `replayPlayerCommands` applies it with `applyPlayerDelta` (small `main.js` option change) and no longer re-runs `effect` entries. `/xp` still replays.
- **Scheduled ticks in unloaded columns.** Fluid, fire and falling entries were already held back (saved with their remaining delay, matching the chunk save). Redstone entries were not: they ran against refused writes. `away-world.js` `freezeUnloadedRedstone` holds them; `idle()` ignores held entries.
- **32-block rule per tick** for items, orbs, TNT, carts, boats, arrows, thrown projectiles, potions, rockets and falling blocks (`park` in `away-entities.js`); `entityTicks` has a fast path well inside the area.
- **Autosave phase:** documented only (the server's `tickCounter` is unknown; the page's tick counter at departure is used). No code change.
- Docs: `public/research/dimensions.md` "Batch 37".

## Verification
- Focused: away-shadow (new, 9), away-commands 16, away-world 10, away-entities, away-mobs, away-spawn, away-tick-tree, dimension-away (59 together), dimension-live, tick-tree-runtime, commands, command-selector, command-block (56): all pass. The full suite and `npm run build` were left to the lead. Load average 6-8 at the time.
- The new tick and entity tests fail on the unchanged code (checked by stashing the source changes).
- Browser (muted headless Chrome, port 5373, `artifacts/b37-awayshadow/away.mjs`): at departure health 10; blocks fired `effect @p 10 60 1` (regeneration II) at tick 20, `effect @p 1 600 0` (speed) at 40, instant health at 400, `effect @p 10 0` at 800; health set to 6 in the Nether. Trip 986 ticks. After return: all four SuccessCounts 1 with fire-time output, health 20, Speed with 11017 ticks left (not the full 12000), Regeneration removed, replay summary `byDelta 4`, no duplicate mob ids. Only a 404 resource message on the console.

## Follow-ups (proposed gap lines)
- Away trace: body samples are about a second apart; a health change that would kill the shadow is carried as a loss and the live player dies on return, not at the firing. Absorption changes beyond effect add/remove are not carried.
- `/xp` in the away run replays on the live player instead of a net delta.
- Scheduler calls from a loaded column into an unloaded one are queued and held (natively not queued); the 100-chunks-per-tick unload rate is treated as immediate.
- The autosave phase uses the page's tick counter at departure, not the server's `tickCounter` (reset when a world is opened).
