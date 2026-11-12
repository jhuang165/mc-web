# Batch 53 digfinish track

Branch `batch53-digfinish` (from 5ea7bb4d1). Labels: executed = run on the real 1.7.10 classes; bytecode-read = read from the jar.

## Summary
- **The server's own dig timer.** New `src/server-dig.js` models `ItemInWorldManager` (mx): a tick count (curblockDamage), the status-0 start (initialDamage and cell), the status-2 finish (`rate * (ticks + 1) >= 0.7` breaks whatever block is at the cell; below that and with no delayed break waiting it remembers the cell) and the tick-side delayed break (breaks when `rate * (ticks since start + 1) >= 1`, ends if the cell turns to air). The handler resends the block (S23) whenever the cell is not air after status 2.
- **main.js.** `tickServerDig` runs in the walk's `afterEntities` before the queued packets (the player's update precedes the network tick; the tick end runs it when no walk did, guarded by `serverDigTicked`). A finished survival dig now calls `serverFinishDig` (range check, then the timer; refused or delayed digs resend the block with `scene.updateBlock`) instead of batch 52's "cell type changed" refusal. A softer block now breaks, a harder one is left and resent. The rate is `playerMiningState(survival, block, heldId(), clientEyeInWater(), grounded).progress` for the block at the cell as it is when handled. `player-edit-simulation.js` calls a new `digStart` hook (queued through `serverTask`) when a non-instant survival dig starts.
- **Client half of a dig start (not modelled).** `PlayerControllerMP.clickBlock` runs `Block.onBlockClicked` and the creative/instant destroy on the client world. With one shared world those are the queued server half; the visible difference is at most one tick (<= 50 ms) of delay for an instant block (tall grass, torch, flower) or creative break, because the block stays until the walk. An immediate visual removal with resend would need a client copy of the cell; left as is.

## Evidence
- Executed: `tools/probes/DigFinishProbe.java` (real EntityPlayerMP in Survival, real inventory and `Block.getPlayerRelativeBlockHardness`, real `mx` over a world double) via `tools/verify-dig-finish.mjs` -> `public/research/dig-finish-reference.json`, 1721 records (`b53df`): 13 blocks x 4 tools x ground/air x 16 finish times, 45 swapped-block cases, other cell, no start, after abort, air while digging, restart during a delay, double finish, instant starts, cracks. `src/dig-finish-b53.test.js` replays every record through `server-dig.js`.
- Bytecode-read: `nh.a(ji)` (the handler sends S23 after status 2 and 1 when the block is not air; no S23 after status 0 unless the start is refused); `mx.a(III)`, `mx.a()`, `mx.a(IIII)`, `mx.c(III)`.
- Not run: the 6-block range check and spawn protection (ported before in server-handlers.js), harvest drops, partial-crack packets (the port draws its own client cracks).

## Verification
- `node --test src/dig-finish-b53.test.js src/block-clicks-b52.test.js src/block-clicks-b51.test.js src/player-mining*.test.js src/player-edit-simulation.test.js src/melee-order-b50.test.js src/player-throw-replay.test.js src/block-actions-replay.test.js src/redstone-ore.test.js src/server-handlers*.test.js src/note*.test.js`: 107 pass. Source-matching regexes updated in block-clicks-b51/b52 and melee-order-b50. Full `npm test` not run.

## Follow-ups
- A finished dig now breaks the block with the server's damage; the abort packet (status 1) and the crack packets are not modelled (an abort leaves the delayed break running, as natively).
- The client's instant break and creative destroy still wait for the queue (one shared world).
- Multiplayer digs are not routed through the timer.
