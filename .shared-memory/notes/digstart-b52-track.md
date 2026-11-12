# Batch 52 digstart track

Branch `batch52-digstart` (from 8cd3f1725). Labels: bytecode-read = read from the jar, not run.

## Summary
- **Dig-start server half queued.** `applyPlayerEdit`'s survival dig start (C07 status 0, `ItemInWorldManager.onBlockClicked`) hands the dragon egg teleport, the note block click and the redstone ore touch to a new `serverTask` hook. main.js's `serverTask` pushes them as `{ fn }` entries on `pendingEdits` (network tick, arrival order); multiplayer, a running queue or a caller without the hook run them at once. The queued task reads the block at the cell when it runs (as the server does) and does nothing if it changed.
- **Dig finish re-checks the block.** `tickPlayerMining` passes the dug type to `breakBlock(p, creative, type)`; main.js's accept check refuses a finish whose cell no longer holds that type and resends the block (`scene.updateBlock`), as well as the existing range check. Creative and instant breaks are unchecked, like the server (it breaks whatever block is there).
- **Held dig: harness artifact, not a game bug.** In the batch 51 smoke a held button "never broke" `world.set(..., 3, ...)`. The port's internal ids are 1 = dirt, 3 = stone (2 grass), so id 3 is stone: bare-hand progress is 1/1.5/100 = 0.00667 a tick, 150 ticks (7.5 s), as on native stone without a pickaxe. A 2.2 s hold only reached ~0.3. Traced with a temporary `mineHeld`/`mining` getter (not kept): `mineHeld` true, `mining` set with `auto:false`, progress rising each tick, `pend` 0. With id 1 (dirt) a 1.2 s hold breaks it on 0.80.0.
- Kept at once (client side, `PlayerControllerMP.clickBlock`): swing, the dig state, sounds and hit particles. Natively the client also runs `Block.onBlockClicked` on its own world and the creative / instant destroy; the shared single world has only the server copy, so those stay with the queued server half.

## Evidence
- Bytecode-read: `bje` (PlayerControllerMP) `a(IIII)` clickBlock: creative sends C07 status 0 (`ji`) then destroys on the client; survival sends status 0, calls `aji.a(world,x,y,z,player)` (onBlockClicked) when damage is 0, destroys at once if relative hardness >= 1. No executed probe; tag `b52ds` unused.
- Executed (browser, port 5582, muted): held left button on dirt breaks it; a dragon egg punched through the queue left its cell and became a falling block, no page errors. Script `artifacts/b52-digstart/dig.mjs` (ignored artifact folder).

## Verification
- `node --test src/block-clicks-b52.test.js src/block-clicks-b51.test.js src/player-mining*.test.js src/player-edit-simulation.test.js src/melee-order-b50.test.js src/player-throw-replay.test.js src/block-actions-replay.test.js src/redstone-ore.test.js src/note*.test.js`: 86 pass. Updated existing tests: block-clicks-b51 (new break hook shape), redstone-ore (hook source), player-throw-replay (`serverTask` binding). Full `npm test` not run. `npm run build` once at the end.

## Follow-ups
- A client/server world split would let the client apply `onBlockClicked` and creative/instant destroy at once and the server confirm later.
- Native `blockRemoving` recomputes the server's own damage for whatever block is there (it can break a different, softer block); the port refuses instead.
- Smoke note: block ids in `__mc.world.set` are the port's own (1 dirt, 3 stone, 171 dragon egg).
