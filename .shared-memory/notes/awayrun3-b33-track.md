# awayrun3 (batch 33)

## Summary
- New `src/away-commands.js`: command blocks and command minecarts run in the Overworld away run through `createCommandHost`; player-targeting commands are skipped and counted. `src/command-selector.js` gained a small `playerElsewhere` branch (world-restricted selectors give the silent zero).
- New `src/away-light.js`: block light for away mobs, replacing open-sky-only `mobs.lightAt`.
- `src/away-entities.js`: ender pearls tick and die on impact (no thrower teleport); leash knots on fences in ticked columns tick; command carts join.
- `away-plan.js`, `away-world.js`, `dimension-live.js` (`finishAway`) and `main.js` (`awayResult` hook) carry the plan and result; time, weather, rules and chat apply on return.
- Native evidence: bytecode-read with javap (CommandHandler.a, PlayerSelector.c, BlockCommandBlock.updateTick, EntityEnderPearl.onImpact). Nothing was executed.

## Verification
- Focused: `node --test src/away-commands.test.js src/away-mobs.test.js` 16 tests, 16 pass. Full `npm test`: 4907 tests, 4907 pass, 0 fail. `npm run build`: ok..
- Browser (muted headless Chrome, port 5351, `artifacts/b33-awayrun3/away.mjs`): a command block with a scheduled tick 200 ticks out, plus a pearl in flight, then Nether and back. 525 ticks ran in 300 ms; gold block was placed, SuccessCount 1, LastOutput "Block placed", pearl count 0, commands run 1 / skipped 0, light 2 floods 66 ms. Only console error was one 404 (not from the away code).

## Follow-ups (proposed gap lines)
- Away commands that act on the player (give, tp, xp, gamemode, effect, ...) are skipped, not queued for return.
- Away worldspawn changes do not move the run's area; sky light is open-sky only; lit furnaces do not emit.
- Pearl-hit knockback uses the pearl position.
- Live port prints "Player not found" for a no-match selector at the username index; original is silent.
