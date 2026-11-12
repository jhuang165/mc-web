# Batch 54 digabort track

Branch `batch54-digabort` (from 20bbab13b). Labels: executed = run on the real 1.7.10 classes; bytecode-read = read from the jar.

## Summary
- **Abort and crack packets in `src/server-dig.js`.** `createServerDig({ crack })` now reports `World.destroyBlockInWorldPartially` through `crack(cell, v)` (v = `(int)(damage * 10)`, float products; 10 for an air cell; -1 clears). New `abort()` is `ItemInWorldManager.cancelDestroyingBlock` (C07 status 1): it clears the digging flag and sends -1 at the LAST START cell (0,0,0 before any start), whatever cell the packet names; it does not reset `durabilityRemainingOnBlock` (so the next tick-side value is compared against the pre-abort one) and does not stop a delayed break. Start sends the stage (air: 10; bedrock: 0; instant block: none). Tick: the delayed-break branch cracks first, else the digging branch (air under the dig sends -1 and ends it). Finish: at 0.7 or more sends -1 then breaks; the delayed finish keeps the crack.
- **Client side of the abort.** `watchClientDig()` (main.js, end of `tickMining`) sends the abort through `serverTask` when the client's dig object disappears unfinished (button released, aim or tool changed, screen opened); a finished dig (`breakBlockPacket` with an accept check) marks it finished, so no abort follows. `player-edit-simulation.js` calls a new `digAbort` hook, and drops the stale `mining`, before a start while another dig is under way (PlayerControllerMP.clickBlock sends the abort first). Single player has no other player to receive the S25 crack packets (the digger is excluded), so only the timer state is observable in the port; the crack callback has no sink in main.js. Multiplayer digs still bypass the timer (src/multiplayer untouched).
- **Client instant / creative break before the queue: not done, documented.** The block is the one shared `world`; a visual-only early removal needs the mesh to differ from the world. `Scene.buildChunk` and the worker path (`snapshotRegion`) read `this.world` plus the light volume and neighbours' face culling, so hiding one cell means a second world view (or mutating the world early, which moves the server half ahead of the queue and breaks the b50 melee order). The cost is at most one tick (<= 50 ms) between the click and the walk that runs the queued break.

## Evidence
- Executed: `tools/probes/DigFinishProbe.java` extended with 20 `da-*` records (every tick a step; abort with no start, mid-dig, then restart or finish, other cell, in a delay, twice; second start; finish break/delay; air or a swapped block under the dig; tool swap; start on air, bedrock, tall grass; slow and fast blocks) via `tools/verify-dig-finish.mjs` -> `public/research/dig-finish-reference.json`, now 1741 records (the 1721 older ones are byte-identical). `src/dig-finish-b53.test.js` now also compares every `partial|v|x|y|z` event (folded runs: the count) with the model's crack callback, and replays `a:` ops.
- Bytecode-read: `mx.a(III)` finish (partial -1 only on the >= 0.7 branch), `mx.c(III)` (abort), `mx.a()` and `mx.a(IIII)`, as `mx.a` `ahb.d` calls.
- A float bug caught by replay: the stage must be `f(f(rate * n) * 10)` truncated (0.1F * 7 gives stage 7, not 8).
- Not run: S25 delivery to other players (`EntityTrackerEntry`/`PlayerManager` side), the range check and spawn protection.

## Verification
- `node --test src/dig-abort-b54.test.js src/dig-finish-b53.test.js src/block-clicks-b52.test.js src/block-clicks-b51.test.js src/player-mining*.test.js src/player-edit-simulation.test.js src/melee-order-b50.test.js src/block-actions-replay.test.js src/server-handlers*.test.js src/redstone-ore.test.js src/note*.test.js`: 112 pass. `npm run build` passes. Full `npm test` not run (batch rule). Probe regenerated with `MC_RESEARCH=<tools/research> node tools/verify-dig-finish.mjs`.

## Follow-ups
- A visual-only early removal of the client's instant/creative break needs a mesh-level cell override; one tick of delay remains.
- Multiplayer digs still bypass the timer; crack packets have no consumer outside the timer's own state.
