# Batch 67 pistons4: server piston follow-ups

## Summary
- `src/moving-boxes.js`: new per-world provider (`setWorldMovingBoxes(world, fn)`); `movingBoxes(box, world)` uses it before the single global provider. `entities.js`, `item-entities.js`, `minecarts.js` pass `world` (one-token edits). Single player is unchanged (it never registers a per-world provider).
- `src/multiplayer/server-pistons.js`: (1) registers `collisionBoxes` for its world, so server players, mobs, items, carts and boats collide with block 130 through the existing `moveEntity` path (no change to `movePlayer`, so `boatstand` merges separately). (2) A push that lands a player calls `landPlayer` at once (fall damage; Creative skips it). (3) Passes `minecarts`/`boatSystem` (`ServerVehicles.carts` / `.boats` already have `.carts` and `.move`, so no shim was needed beyond getters), mobs and players as cart/boat blockers. (4) `flush()` now sends every live tile a player in range has not been sent (WeakSet per player; leaving range forgets it), so a late join or range entry gets a mid-move tile.
- `src/piston-push.js`: `vehicleBlockers` also reads `game.players()` (server players block a pushed cart/boat).
- `simulation.js` and `server-nether.js`: pass `vehicles: () => ...` into the `ServerPistons` context (one word each). No new wire messages.

## Evidence
- Bytecode-read (javap, 1.7.10 jar): `EntityPlayerMP` (mw) `updateFallState` (a(DZ)V) is empty; `handleFalling` (b(DZ)V) calls `EntityPlayer.updateFallState`. So natively a tile push does no fall damage on the server; the damage arrives with the next C03 on the ground, from the server's fall distance. Here the server moves the player itself, so the damage is taken at the landing push (same total, applied one tick earlier). Single player already did this (`land` in main.js).
- Executed: existing piston-live collision boxes (193 tests) are the box source; the new tests run the server tick.
- Recalled: Single player already installed the same boxes via `setMovingBoxes` in `redstone-runtime.js`; reused, not copied.

## Verification
- `node --test src/pistons4-b67.test.js`: 5 pass (collision boxes per world, moveEntity stopped at the head face 0.5 into the cell, landing damage, cart and boat pushed, late client gets the tile once).
- One at a time: mppistons-b66 8, piston-live 193, pistonpush-b48 27, piston-order-b49 14, pistons 38, mpdispense-b61 15, mpvehicles-b61: all pass. `node --check` on touched files; `npm run build` ok. Full npm test not run (batch rule). No browser checks.

## Follow-ups
- A cart/boat tile test uses a cart on bare ground; carts on rails and a rider in a pushed cart are untested.
- A tile already seen stays marked while its player stays in range across a dimension change (rare; tiles last 2 ticks).
- Only a browser could show: standing on and being carried by a moving block with client prediction, the late-joined tile drawn mid-move, piston sounds.
