# Batch 75 mppushgrid75: cell-bucketed candidates for the mob push scan

## Summary
- `src/push-grid.js` (new): `PushGrid` (8-block cells, indices kept in list order), `pushCandidates`, `markMoved`, `beginPushGrid`/`endPushGrid`, `pushGridConfig.mode` (`on`/`off`/`verify`, env `MC_PUSHGRID`). Used from 200 entities up.
- `src/entities.js`: `push` asks `pushCandidates(this.entities, e)` and falls back to the whole list on null; `tickMobs` brackets the loop with `beginPushGrid`/`endPushGrid`; the seat step calls `markMoved(rider)`.
- `src/mob-riding.js`: `setLocationAndAngles` (dismount) and `endRidden` call `markMoved`.
- `tools/bench-server-mobs.mjs`: `--state` takes `--seed --mobs --riders --pistons --rseed` (riders = skeleton on spider pairs, pistons powered and toggled every 20 ticks).
- `src/mppushgrid75-b75.test.js` (new), `public/research/server-performance.md` (new section).

## Evidence
- Executed: determinism hashes identical before and after (six scenes, listed in `server-performance.md`), also with `MC_PUSHGRID=verify`, which compares grid and full scan on every push.
- Executed: `MC_PUSHGRID=verify` over 316 + 271 existing tests (mobs, riders, village fights, pistons, replays, villagers, golems, leads, rings, server handlers): all pass, so no stale case was hit at their sizes (verify uses the grid from 2 entities up).
- Executed: 600 mobs 24.5 -> 18.3 ms/tick (paired, loaded machine). The native order claim (chunk-list order) is not what the old code did: `push` walked the flat entity array, and the grid keeps that array order, so behaviour is unchanged by construction. Native chunk-section order for this scan was not introduced (recalled: batch 72 `candidate-order.js` covers projectiles and picks only).

## Verification
- `node --test src/mppushgrid75-b75.test.js`: 4 pass. Targeted sets above under `MC_PUSHGRID=verify`: 316 and 271 pass, 0 fail. Full npm test not run (batch rule). No browser checks. `npm run build` see commit/final report.

## Follow-ups
- Line of sight (`rayTraceBlocks`, about 15%) is the next cost; not touched.
- Writers that move a mob during the loop but are not hooked (none found in the code read: teleports and piston pushes happen in their own turn or outside the loop) would be missed by the grid; `MC_PUSHGRID=verify` is the check to run when adding one.
- Not done: the player-versus-mob scan in `serverPlayerUpdate`, `ai.nearby`.
