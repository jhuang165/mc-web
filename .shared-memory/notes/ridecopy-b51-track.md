# ridecopy b51 track

Branch `batch51-ridecopy` from 119a6db93.

## Summary
- The boat the client player rides now splashes. `ObjectClient.mirrorRidden()` (`src/object-tracker.js`), called from `stepVehicle` after the boat copy's `splash()`, copies the live boat's x, posY, z, motion, yaw and pitch into the copy and clears its interpolation target while `tracker.hooks.rides(live)` is true (`main.js` sets it to `rider.vehicle === live`, one line in `bindObjectTracker`). The splash reads the state the copy had at the end of the previous tick (the start of this one), draws on the copy's own `Entity.rand`, and goes through `tracker.particle` to `scene.fx`.
- Why a mirror, not a second physics: 1.7.10 runs the full EntityBoat physics on the client for a ridden boat, with the same rider input the live boat already uses, so the live boat is the stand-in for the client's motion. The live boat's own particle list is still dropped (as in batch 50). Server-side vehicle physics is unchanged.
- Carts left alone: the ridden cart is still drawn from the live entity. Natively it is drawn from its interpolating copy, but the port seats the player and the camera on the live cart, so drawing the cart from the copy would lag it a few ticks behind its rider. Not changed (see follow-ups).

## Evidence (all bytecode-read; no probe executed)
- `bjb` (NetHandlerPlayClient, S1B attach, mode 0): when the mounted entity is the client player's, the boat gets `xi.a(false)` (setIsBoatEmpty false); a mount by another entity sets it true again (`xi.a(true)`).
- `xi` (EntityBoat): field `a` is isBoatEmpty, true in the constructor. `xi.h` runs the splash block (d3 > 0.26249999999999996, `1 + d3 * 60` particles) before `if (world.isRemote && isBoatEmpty)`, so the splash runs for every boat. The interpolation/coast branch is only taken when empty; a ridden client boat falls through to the full physics (buoyancy, rider moveForward/moveStrafing, moveEntity). `xi.a(DDDFFI)` (setPositionAndRotation2) for a non-empty boat only sets the 3-tick target when the packet is more than 1 block (squared) away, and the target counter `c` is read only in the empty branch, so a ridden boat never follows the S18 packets.
- `xl` (EntityMinecart): the remote branch of `h` (`ahb.E`) has no rider test; `a(DDDFFI)` always sets `d = i + 2`. A ridden cart interpolates like any other.
- Not executed: no Java probe of a moving boat copy. The splash formula itself was already compared in batch 50 (`knot-splash-b50.test.js`).

## Verification
- `node --test src/ride-copy-b51.test.js src/knot-splash-b50.test.js src/aim-copies-b49.test.js src/vehicle-render-b48.test.js src/object-tracker-vehicles.test.js` -> 58 pass, 0 fail. `node --check src/main.js`. Not browser-checked.

## Follow-ups
- A ridden cart should be drawn (and the player seated, and the camera placed) from its interpolating copy, as `updateRiderPosition` does natively; needs a rider placement change in `main.js` that this track did not make.
- The ridden boat copy has no physics of its own (mirror only): its enter-water bubbles and splash sound and a client-side crash are not modelled.
- Overlap: `src/object-tracker.js` (stepVehicle, one new method, header comment) and one `src/main.js` line overlap trackerqueue's claim; the hunks are additive.
