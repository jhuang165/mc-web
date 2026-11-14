# Batch 68 pistons5: carts and riders under a piston, server push damage order

## Summary
- `tools/probes/PistonCartProbe.java` + `tools/verify-piston-cart.mjs` -> `public/research/piston-cart-reference.json`: the unchanged 1.7.10 classes with live entities in `World.loadedEntityList`, so `World.updateEntities` runs entity `onUpdate` (EntityMinecartEmpty rail snapping, `updateRidden`) before the tile entity loop that pushes. 9 scenarios: cart on rails (resting, rolling, pushed by a stone), cart on bare ground, pig rider in a cart (bare, on rail, into a wall, lifted), pig rider in a boat.
- `src/pistons5-b68.test.js`: replays those scenarios in the port (RedstoneWorld, `installPistons`, `Minecarts`, `Boats`, `EntityWorld`, `endRidden`) and checks four server cases.
- `src/multiplayer/server-pistons.js`: (a) a pushed player's landing is queued and taken at the flush of the next tick (was at the push); (b) a riding player is now in the pushed-entity list and the blocker list (it was filtered out), its landing is ignored.
- No change to single-player code: it already matched.

## Evidence
- Executed (PistonCartProbe): a cart on rails is pushed with plain `Entity.moveEntity`; after the push the cart's own next `onUpdate` snaps it to the rail (minY +0.15) and keeps its motion (empty cart drag 0.96 per tick on the rail). The port's `Minecarts.tickOne` plus `pistonPushExtras` reproduce every position, motion, onGround and collision flag for carts and boats (gap 1 was a gap in the evidence, not in the port; found wrong as a defect).
- Executed: a rider is pushed separately (own `moveEntity` call, recorded: pig 101 gets its own 0.5625 move right after the cart's), blocked on its own box (cart 3.51 vs pig 3.55 against a wall at x 4), then the vehicle's `updateRiderPosition` puts it back on the next entity loop. The port's mob riders already behave so (mobs list plus `endRidden`). Boat rider sits 0.4 ahead of the boat and is pushed on its own, and the replay matches.
- Bytecode-read: `TileEntityPiston.a(float,float)` (func_145863_a) moves every entity from `getEntitiesWithinAABBExcludingEntity(null, box)` with `Entity.d(dx,dy,dz)`; there is no rider or vehicle test.
- Bytecode-read: `MinecraftServer.updateTimeLightAndEntities` per world: `WorldServer.tick`, `World.updateEntities` (entity loop `e`, then the tile entity loop `g`), tracker; then once after all worlds the "connection" section (`NetworkSystem.networkTick`, which handles C03) and "players". So the pushed player's C03 with the on-ground flag, and the fall damage it triggers (`EntityPlayerMP.updateFallState` is empty; `handleFalling` runs from the C03), is processed after the tile loop, at the earliest the same tick, and in practice the next. The server moves the player itself, so it now takes the landing at the next tick's flush (after that tick's tile loop, standing for the network phase). Recalled: the client's own push produces the on-ground C03 only on its next tick.
- Recalled: a rail under a pushed stone loses its support and drops; the redstone test world has no rail support logic, so no scenario covers a rail on a moving block.

## Verification
- `node --test src/pistons5-b68.test.js`: 12 pass (9 native replays, landing one tick later, cart on rails on the server, rider pushed then put back). Reverting the deferral makes the landing test fail.
- One file at a time: mppistons-b66 8, pistons4-b67 5, piston-live 193, pistonpush-b48 27, piston-order-b49 14, pistons 38, mpvehicles-b61 pass. `node --check` on touched files. `npm run build` ok. Full npm test not run (batch rule).

## Follow-ups
- The probe pig rider ticks its own gravity (vy -0.0784, onGround 0) that the replay does not model; only rider position and the mount link are asserted.
- A rail on top of a pushed block (support loss during the push) needs the game World's rail behaviour; not covered.
- Only a browser could show: a rider riding a pushed cart with client prediction, the seat flicker for one tick.
