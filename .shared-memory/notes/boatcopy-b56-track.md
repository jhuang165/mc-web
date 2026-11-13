# Ridden boat copy, batch 56

## Summary
- The boat the client player rides is no longer a mirror of the live boat. `ObjectClient.rideBoat` (src/object-tracker.js) runs the copy's own physics every tick from the rider's input (the live rider's yaw, moveForward, moveStrafing), through `Boats.tickBoat` with `boat.remote` set. Native: S1B calls `setIsBoatEmpty(false)`, so `xi.h` skips the `isRemote && isBoatEmpty` interpolation branch.
- `remote` follows EntityBoat's `!isRemote` guards: no break on a collision above 0.2 (and that tick applies no drag, as natively) or on a fall above 3, no drops, no neighbour-boat push, no lava or fire (fire counter zeroed), the wobble counters stay the data watcher's, a snow layer or lily pad clear calls `tracker.clientClear` (none in the game: the shared world was already cleared by the live boat).
- Position packets on a ridden copy (`place`, xi.a(DDDFFI) with isBoatEmpty false): ignored unless the target is over 1 block (squared) away; then 3 unused increments and the motion goes back to the last S12. The copy is never corrected by packets.
- Seat and view: `boatSeat(copy)` (0.4 ahead along the copy's yaw, posY + mounted offset) seats the client player (`seatOnCartCopy` in main.js, small hunk), and the ridden boat is drawn, aimed and hit from its copy (`shownOf`, `vehicleTargets`). `rideCopy` now returns boat copies too.
- Dismount: `EntityPlayer.mountEntity(null)` skips `dismountEntity` on a client world, so the client player keeps the seat position until the server's S08 puts it at the `dismountEntity` spot; the port's server-spot dismount already matched (the one-tick intermediate is not drawn).
- Two real bugs in `Boats.tickBoat`, found by the executed record: lily pads are not obstacles for an EntityBoat (BlockLilyPad adds no box for it; the port stopped the boat at a surface pad), and the snow layer / lily pad corner clear runs BEFORE the move, not after (clearing also resets collidedHorizontally). Both affect the live (server) boat.
- Break on collision speed: new executed server cases (exactly 0.2 keeps the boat, 0.2000001 breaks it with 3 planks and 2 sticks, a diagonal crash). The port already matched.

## Evidence
- Executed (unchanged 1.7.10 classes): `tools/probes/BoatCopyProbe.java` kind `ride` (12 records, 40-160 ticks) via `tools/verify-boatcopy.mjs` -> `public/research/boat-copy-reference.json`. The client world double is the remote BoatProbe world (ahb.E true) with the client player mounted through `sa.a(sa)` and `xi.a(false)`; per tick: boat state, seat after `xi.ac`, sounds, particles, clear calls, the rider's fall distance, plus the dismount. Scenarios: forward, diagonal and strafe, reverse and coast, turning, beach, fast crash, fall from 9, fall into water, lily pads and snow, flowing water, S12 and S18 packets (near and far).
- Server: `BoatProbe` new `crash-edge-*`, `crash-diagonal-breaks`, `crash-ridden-edge` in `boat-reference.json` (verify-boats.mjs).
- Bytecode-read: the `!isRemote` guards of xi.h and xi.a(DZ), `xi.a(DDDFFI)` packet rule, `EntityPlayer.mountEntity`, `xi.c(yz)` (interactFirst mounts only on the server), the order of the corner clear in xi.h.

## Verification
- `node --test src/boat-ride-b56.test.js src/boat-copy-b54.test.js src/boats.test.js src/ride-copy-b51.test.js src/ride-cart-b52.test.js src/object-tracker-vehicles.test.js src/vehicle-render-b48.test.js` all pass; the wider set `grep -lE "boats\.js|object-tracker\.js|boat" src/*.test.js | xargs node --test` -> 816 pass, 0 fail. `node --check src/main.js`, `npm run build` ok. Full `npm test` not run. Not browser-checked.
- The b51 / b52 / b48 / vehicles tests that pinned the mirror (live stand-in, no seat copy, live box) were rewritten for the new behaviour.

## Follow-ups
- Other entities' boxes (boats, mobs) are not obstacles on the copy (`tickBoat` gets an empty list); the rider's client `Entity.fall` call is only counted (its sound is not played).
- The probe world has no `World.updateEntity` (unloaded chunk skip); block reads bypass the chunk provider, so a ridden copy in an unloaded client chunk is not recorded.
- The copy and the live boat now run from the same input but the copy starts from the lagged copy state at mount, so they drift apart as natively; no server correction exists. The S1B/S08 one-tick intermediate positions are not drawn.
- Entity push and the server's own player position handling for a mounted player (C03/C0C) are not modelled.
