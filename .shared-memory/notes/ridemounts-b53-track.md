# ridemounts b53 track

Branch `batch53-ridemounts` from 5ea7bb4d1.

## Summary
- A ridden pig is now seated from its client copy. `MobTracker` no longer calls `followLive` for a ridden pig (the copy is packet-driven as natively; a ridden horse's copy still follows the live horse, since the horse's client steering is not ported), and `seatOnCartCopy()` in `src/main.js` (small hunk plus one import) seats the player at copy x, y + `PIG_MOUNTED_OFFSET` - 0.5, z. The server seat and the sneak dismount stay on the live pig (`updateRiderPosition` before the dismount, as for carts). The horse keeps its live seat because its copy equals the live horse.
- A boat copy runs `Entity.handleWaterMovement` (`ObjectClient.waterMovement`, `src/object-tracker.js`) before its splash: flow push on the copy's motion, and on entering water (not the first update) the "game.neutral.swim.splash" sound call (logged only; a client plays none) plus 1 + width * 20 "bubble" and as many "splash" particles from the copy's own `Entity.rand`. Applies to every boat copy, ridden or not (the ridden copy mirrors the live state afterwards).
- Mounting or dismounting a moving cart: not modelled separately. See evidence.

## Evidence (all bytecode-read; no new probe)
- `sa.N` (handleWaterMovement): box `expand(0, -0.4, 0).contract(0.001)` in water; `if (!inWater && !firstUpdate)` plays `O()` ("game.neutral.swim.splash", xi does not override) with volume min(1, sqrt(mx^2 * 0.2 + my^2 + mz^2 * 0.2) * 0.2) and pitch 1 + (nf - nf) * 0.4, then loops `i < 1 + width * 20` for "bubble" (3 floats each, y speed - nf * 0.2) and again for "splash" (2 floats each) at floor(box.minY) + 1. No isRemote test. `sa.C` (onEntityUpdate) calls it; `xi.h` begins with `invokespecial sa.h`, before the wobble and the splash block. `bma.a(String,DDDFF)` (RenderGlobal.playSound) is empty, so the copy's sound is silent.
- Pig seat: `sa.ab`/`ahb.a(sa, boolean)` order as in batch 52; the batch 43 executed `ridePig` record and the batch 45 scan (no client path reads riddenByEntity) say the client pig is packet-driven.
- Mount jump: `mw.a(sa)` (EntityPlayerMP.mountEntity, both mount and dismount) sends S1B then `setPlayerLocation(server pos)` (S08); `sa.a(sa)` (mountEntity) with null sets the client at the mount copy's posX, minY + height, posZ, then S08 overrides it with the server spot; a mount does not move the client at all. So the client's only visible jump on mounting is the first `updateRiderPosition` snapping it onto the copy's seat, which `seatOnCartCopy` already does at the next seating, and the dismount lands on the server's spot, as the port's live-seat dismount does. The one-tick S08 intermediate (client at the old server position) is not drawn.

## Verification
- `node --test src/ride-mounts-b53.test.js src/ride-cart-b52.test.js src/ride-copy-b51.test.js src/aim-copies-b49.test.js src/vehicle-render-b48.test.js src/object-tracker-vehicles.test.js src/object-tracker.test.js src/knot-splash-b50.test.js src/tracker-mounts.test.js src/pig-saddle.test.js src/player-mount.test.js src/minecarts.test.js src/boats.test.js src/horse.test.js src/entity-tracker*.test.js src/tracker-*.test.js` -> 283 pass, 0 fail. `node --check src/main.js`; `npm run build` ok. `tracker-mounts.test.js` was updated: the ridden pig's copy now trails the live pig. Not browser-checked, no probe.

## Follow-ups
- The ridden horse's client copy still follows the live horse (client steering and jump of `wi.e(FF)` not ported), so its seat is the live seat. Its rearing lift on the client copy is unmodelled.
- The boat copy's water flow push changes the motion of an unridden copy between S12 packets; no executed record covers a boat copy in flowing water.
- The S08 teleport after S1B (mount and dismount) is not drawn as a one-tick jump.
