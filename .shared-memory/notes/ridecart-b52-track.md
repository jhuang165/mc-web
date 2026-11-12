# ridecart b52 track

Branch `batch52-ridecart` from 8cd3f1725.

## Summary
- The minecart the client player rides is drawn from its client copy (`shownOf`, `vehicleTargets`, `aimBox` in `src/object-tracker.js`: only a ridden boat still stands in the live entity), and the player is seated from the copy: `seatOnCartCopy()` in `src/main.js` runs after each `finishVehicleTick` and sets `position` to copy x, posY - 0.3 - 0.5, z (new `rideCopy`). The camera, player model and shadow therefore trail the live cart a few ticks, as natively.
- Server side untouched: the live cart's physics and the rider seat in `moveRidingPlayer` stay on the live cart. One line in `src/vehicle-simulation.js` re-seats the rider on the live cart before a sneak dismount, so the dismount spot is not computed from the trailing copy seat.

## Evidence (bytecode-read, no new probe)
- `ahb.a(sa, boolean)`: an entity with `m` (ridingEntity) set runs `ab()` (updateRidden); a mount's own update runs first and its rider is updated right after (`updateRiderPosition`). `xl.h` interpolates a ridden cart like any (batch 51). The copy interpolation itself was executed earlier (`TrackerVehiclesProbe`).
- Browser smoke (muted, port 5581, `artifacts/b52-ridecart/smoke.mjs`): riding a cart at ~0.36/tick on rails, the seat z equals the copy z every sample and trails the live cart by about 1.4 blocks (3-4 ticks), seat y = copy y - 0.8. The screenshot is not informative (camera looked at a block).

## Verification
- `node --test src/ride-cart-b52.test.js src/aim-copies-b49.test.js src/ride-copy-b51.test.js src/vehicle-render-b48.test.js src/object-tracker-vehicles.test.js src/player-mount.test.js src/minecarts.test.js src/boats.test.js` -> pass, 0 fail. `node --check src/main.js`.

## Follow-ups
- Mounting and dismounting while moving: the client position jump on S1B/teleport is not modelled. Horses and pigs as mounts still seat from live. The ridden boat is still a live mirror.
