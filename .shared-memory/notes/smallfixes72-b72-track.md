# Batch 72 smallfixes72: batch 71 small follow-ups

## Summary
- Step ySize (`src/main.js` step block): found wrong, no change. `motion.ySize` is already the decayed value when the step block runs. Probe extended (`tools/probes/StepBlockProbe.java` kind `ysize`, 24 new cases in `public/research/step-block-reference.json`).
- Climb stat (`src/main.js` `statsLive.tick`): `onLadder` is now `isOnLadder(world, x, y, z)` (ladder or vine at floor(minY), no `!flying`). Import changed from `countsVertical`. Step distance unchanged (ladder only).
- Away-run droppers (`src/away-world.js`): added `transfer: () => hoppers.host` to the redstone game host.
- Brewing flag: no code change (single player already one flag), documented.
- Tests: `src/smallfixes72-b72.test.js` (6). Docs: player-step.md, stats.md, ladders.md, dispense.md, brewing.md (Batch 72 lines).

## Evidence
- Executed: `StepBlockProbe` ysize cases: V after the move is 0.08 (0.2f * 0.4f); the step cell equals `stepBlock` at `endY - yOffset`.
- Bytecode-read: `yz.k` (addMovementStat) branch order water-material, inWater, `h_()` (isOnLadder), onGround; called unconditionally from `yz.e(FF)`. `sv.h_` compares the block with `ajn.ap` (ladder) and `ajn.bd` (vine). `sa.d` step test uses only `ajn.ap` (b71).
- By test: an away run with a powered dropper above a dropper fills it; fails with the `transfer` line removed (checked).
- Recalled: a native dedicated server does not aim-check block clicks (only distance).

## Verification
- `node --test src/smallfixes72-b72.test.js`: 6 pass. `node --check` on main.js, away-world.js. Scope check: `isOnLadder` is imported in main.js (line 88) and only used in `tickSurvival`. Full npm test not run (batch rule).

## Follow-ups
- Dedicated server aim gate reads the server's own brewing flag (native has no aim check); a fresh client can be refused on the upper part of a stand after the server's first collision pass.
- Only a browser would show the climb stat on vines and an audible step after a sneak drop.
