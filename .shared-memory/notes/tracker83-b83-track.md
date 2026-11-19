# tracker83 (batch 83): velocityChanged S12 on the wire, the boat and cart tracker entries, the fireball splash

## Summary

**Task 1: the velocityChanged S12.** spblast82's blast pushes set `velocityChanged`. Natively the tail of `my.a(List)` then sends S12 to every tracking player that tick, off the frequency beat, for any class.

| Lane | Before | Now |
| --- | --- | --- |
| Items, orbs (cadence `itrack`) | The server tracker rebuilt its stand-in from rows without the flag, so the S12 never went out. The client copy coasted on stale motion until the next beat. | Rows carry `vc: 1` (`simulation.js` itemList, `server-dimensions.js` list, `server-items.js` xpField). The flag is cleared once a tick after the row is built. `server-object-tracker.js` re-arms the shared stand-in for each player's entry (ObjectEntry clears it). `client-itrack.js` already applied `velocity`. |
| Rockets, eyes, arrows, thrown balls (`dispEnts`), hooks (`fishHooks`) | Exact per-tick snapshot rows; no tracker on the wire. | Unchanged. The pushed flight is already visible; the flag is never read on these lanes. |
| Carts | | The S12 goes out but is invisible natively: xl.h's remote branch only interpolates or re-sets the position and never moves by motion. Not released. |
| Boats | Plain state every tick: the copy snapped and had no S12. | See task 2. |

**Task 2: boats and carts in the `vehicles` message** (`server-cart-track.js`, `server-vehicles.js`, `remote-vehicles.js`, `server-chunk-view.js`):
- **Boats share the cart tracker:** EntityTracker range 80, frequency 3, velocity on.
- **The released state is what the client entity holds**, not the server's exact position:
  - The S0E sets serverPos = floor(pos · 32). S15/S17 add deltas, S18 sets it, and every position packet places the copy at serverPos / 32.
  - The 400-tick or long-jump S18 adds 1/64 to y.
  - S16/S17/S18 carry angle bytes (byte · 360 / 256); S15 keeps the rotation.
  - A new boat copy sits 0.3 high (the EntityBoat constructor's yOffset) until its first position packet.
- **Boat S12:** goes out as `mx/my/mz` with a running count `vs`.
- **Boat release count `rs`:** a position packet with an unchanged serverPos (the 60-tick forced S15) still re-aims the copy.
- **The boat client copy (`boatClientStep`)** follows EntityBoat with isBoatEmpty true:
  - The water push comes first.
  - setPositionAndRotation2 gives 3 + 5 increments toward the target, with motion = the last S12.
  - With no increments left it coasts: pos += motion, then 0.99F / 0.95F / 0.99F drag.
- **The rider's own boat** keeps the plain exact state. Natively that client runs the boat physics itself (isBoatEmpty false), which is not modelled.
- **The range re-list cadence is ported:**
  - The 80-block square is re-tested only when the vehicle's entry moved over 4 blocks, using lastScaledPosition / 32 (int division) from before its packets.
  - Or when the viewer moved over 4 blocks, joined, or got columns (new `vehicles` FRESH channel), using the scaled position after the packets.
  - An untracked vehicle's `del` goes one tick later (the S13 at the viewer's next update).
- **Before this, the 80 range was tested on the exact position every tick.** The executed boatFar boat was dropped at tick 58 instead of 72.

**Task 3: Entity.handleWaterMovement's splash for EntityFireball, its subclasses and the client copy** (new `src/fireball-splash.js`):
- **When it fires:** on entering water (not already inWater) and not on the first update (firstUpdate).
- **Sound:** `game.neutral.swim.splash`. Volume = min(1, sqrt(mx²·0.2 + my² + mz²·0.2)·0.2F) of the motion after the flow push. Pitch = 1 + (nextFloat − nextFloat)·0.4F.
- **Particles:** 1 + width·20 `bubble` (three floats each) and as many `splash` (two floats each), at floor(minY) + 1. This reuses `enterWater` in `fx.js`.
- **The server ball** (`fireballs.js` tickBall, `wither-boss-mobs.js` skull tickOne):
  - Draws on its own `b.rand`. Launched balls already have it; others get `new JavaRandom(Math.random seed)`.
  - Pushes the sound event, which becomes S29 on the dedicated server.
  - With `mobs.fx` (single player) it also draws the particles, on a second Random standing in for the integrated client copy's.
- **The multiplayer copy** (`fireball-copy.js` stepBallCopy, angle copies with the `water` hook):
  - Draws the particles on its own Entity.rand.
  - Its sound is silent, since RenderGlobal.playSound is empty.

Old tests updated because they encoded the gaps:
- `mpcadence72-b72.test.js`: a 40-degree cart yaw now reads 39.375 (the S16 byte 28 · 360 / 256), not 40.
- `mpfx80-b80.test.js` ballRun: the server ball with an fx now draws the 8 + 8 entry splash. This client has only `wet`, so the comparison leaves that burst out and asserts it separately.
- `mpvehicles-b61.test.js`: walking away deletes the boat one tick after the untrack.

## Evidence
- **Executed (existing reference):** `public/research/tracker-vehicles-reference.json` (TrackerVehiclesProbe, unchanged `my`, `xi`, `xl`, `bjb`). `src/tracker83-b83.test.js` replays the following through ServerVehicles.track → RemoteVehicles.apply/tick:
  - boatGlide, boatPush, boatTeleport, boatSplash and boatFar: position and motion match every tick exactly, and presence matches (boatFar leaves at 72).
  - cart0, cart1, cart3, cartTeleport and cartPush: position matches exactly.
- **Bytecode-read** (`javap -c -p` on the 1.7.10 jar):
  - EntityTracker `mn.a(sa)`:
    - hook 64/5/true
    - arrow 64/20/false
    - balls 64/10/false
    - eye 64/4/true
    - rocket 64/10/true
    - item 64/20/true
    - boat and cart 80/3/true
    - TNT 160/10/true
    - orb 160/20/true
  - The `my.a(List)` tail: `if (sa.H) { b(new hy(e)); sa.H = false }`, every tick, all associated players.
  - The re-list: `getDistanceSq(lastX, lastY, lastZ) > 16`.
  - `xl.h` remote branch: interpolation only.
  - `sa.C` calls `N()` at offset 467 and clears `firstUpdate` at 623.
  - `sa.N`:
    - Box: expand(0, −0.4, 0).contract(0.001).
    - The splash guard is `!ac && !f`.
    - Draw order: sound, bubbles, splashes.
  - `sa.O` returns "game.neutral.swim.splash"; ze, zg, zi and zp override neither N nor O.
- **Port-read:**
  - The one-tick S13 delay for vehicles (TrackerItemsProbe's client destroy handling and EntityPlayerMP's destroyedItemsNetCache, as the object tracker already does).
  - Server WorldManager.spawnParticle is empty, so the server ball only draws its Random.

## Verification
- `node --test --test-timeout=600000 src/tracker83-b83.test.js`: 19 pass, 0 fail. Mutation checks each make the matching tests fail:
  - Dropping the per-entry re-arm (2 fail).
  - Testing range on the exact position every tick (2 fail).
  - Dropping the firstUpdate guard (2 fail).
- Combined targeted run (`--test-concurrency=2`, 54 files: the new test, cart, boat, vehicle, object-tracker, item, blast, ball, fireball, blaze/ghast, wither, chunk-view and multiplayer neighbours): 832 pass, 0 fail.
- `npm run build`: passes (only the usual chunk-size warning).
- No full `npm test`, and no browser checks.

## Follow-ups
- **Browser-only:**
  - Items, orbs and boats visibly thrown by a blast on a multiplayer client.
  - A boat copy coasting and interpolating smoothly between 3-tick packets.
  - The fireball and skull splash particles in single player and on multiplayer copies.
  - The splash sound's loudness on the client.
- **Not modelled:**
  - The boat copy's own splash particles and sound draws on the multiplayer client.
  - The rider's own boat physics on its client (isBoatEmpty false).
  - A late joiner gets the last-released state rather than a fresh S0E at the current serverPos, and its yaw bytes.
  - Old-server rows without the tracker field (ball copies without `t`) draw no splash.
  - The skull and build-made balls' Random is seeded from Math.random, not a recorded seed.
- Rockets, eyes, arrows, thrown balls and hooks still have no tracker lanes on the wire: they are exact per-tick rows.
