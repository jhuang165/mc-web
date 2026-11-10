# awayrun5 (batch 35)

## Summary
- Native finding (bytecode-read): away player commands DO select the player in the Nether/End for plain `@p/@a/@r` or a name (only r/rm/x/y/z selectors are world-limited), so they act on him at fire time. Batch 34 already matched the selection rule; this batch makes the effect visible at fire time.
- `src/away-commands.js`: a shadow player (Survival + Experience from `plan.player.state/experience`, provided by `main.js` `awayPlayer` via `dimension-live.js`) runs each queued command when the block fires. SuccessCount/LastOutput are fresh, comparators and later commands see earlier ones (give then clear, xp then `@p[lm]`, gamemode then `@p[m]`). The queue still replays at return.
- `/spawnpoint` with 4 absolute integers sets `playerSpawn` (returned in `r.world`); no-coordinate form is skipped (position in the other dimension unknown). `/difficulty` is applied to the run's mobs and returned (`r.difficulty`, applied in `main.js` `awayResult`). `/setworldspawn` is returned and applies to the next trip (run area does not move). Documented in `public/research/dimensions.md` Batch 35.
- `src/commands.js` `spawnpoint` now follows `CommandSetSpawnpoint` (bp.b, bytecode-read): 0/1 args own position, exactly 4 absolute integers, other counts usage.
- `src/away-light.js` `skyAt`: sky light under cover (column top-down opacity, lateral fixed-point spread), used by `away-entities.js` `lightAt`.
- 1200 idle counter executed: `tools/probes/IdleCounterProbe.java` on the unchanged `mt` class (Unsafe instance), `public/research/idle-counter-reference.json`.

## Verification
- Focused: away-commands 13, away-world 7, away-entities, away-mobs, away-spawn, away-tick-tree, commands 14, command-selector all pass (60 + commands). The full suite was NOT run to completion in-track (lead throttle; the lead runs it after merging). One earlier full run, before the throttle, reported 5025 pass / 1 fail but its output was tailed, so the failing test was not identified; the related files (dimension-away, difficulty, dimension-live, dimension-rules, headless-columns, ring-light, ring-ticks, leads3) all pass when run alone (81). `npm run build` not run.
- Browser (muted headless Chrome, port 5361, `artifacts/b35-awayrun5/away.mjs`): while in the Nether, blocks fired give 3 diamonds, clear diamond (success, removed 3), spawnpoint, difficulty hard, and a second clear (failed, none left). After return: SuccessCounts matched fire-time values, replay agreed (3 applied, 2 succeeded, 1 failed), diamonds 0, difficulty setting 3.

## Follow-ups (proposed gap lines)
- `/spawnpoint` without coordinates is skipped in the away run; the shadow player starts from the return state, not the per-firing state.
- `/setworldspawn` while away does not move the current run's loaded area.
