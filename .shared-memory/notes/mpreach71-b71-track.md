# Batch 71 mpreach71: pvp reach from posY, vehicle posY, away-run hopper carts, minecart tracker cadence

## Summary
- `src/multiplayer/server-pvp.js` `inReach`: both players' posY come from `serverPosY` (a sleeper is minY + 0.2); eye height stays 1.62 for the sight ray. Before, it used `position.y`.
- `src/multiplayer/server-vehicles.js` `act`: the reach target is the native posY field (`v.x, v.posY, v.z`) instead of a recomputed box centre. Numerically the same today (yOffset = height / 2 for boat 0.3 and cart 0.35, so the centre equals posY); it no longer depends on that coincidence.
- `src/away-world.js`: the away run's `Hoppers` host gets `cartAt` (`cartInventoryAt(ents.minecarts.carts, ...)`). Block hoppers in an away run now push into and pull from chest and hopper carts; the hopper cart in an away run already used that host. Ring hoppers in the live game use `main.js` `hopperTiles`, which had `cartAt` since b70; the server's hoppers (including its rings) had it too.
- `src/multiplayer/server-cart-track.js` (new, `CartTracker`): one `TrackerEntry` (the executed `EntityTrackerEntry` port) per server cart, range 80, frequency 3, velocity true. A cart's position fields are only released on a tick where the entry sends a position packet (ticks % 3 == 0, or airBorne, or its data changed; and the 4/32 block move, 4/256 turn, 60th tick or 400-tick teleport thresholds).
- `server-vehicles.js` `track()`: carts use the released position. Data fields (hit, damage, display, lit, fuse) go out at once as a state with the last released position and `cartMeta: 1`. A player that starts tracking a cart gets the released position. Boats are unchanged (the client snaps them).
- `src/multiplayer/remote-vehicles.js`: if the message has `cartCadence`, a cart state is applied at once (no second 3-tick wait on the client); `cartMeta` states do not set a new target. The 5-tick interpolation (3 + 2) is unchanged. Wire names: `cartCadence` (message flag), `cartMeta` (state flag).
- Tests: `src/mpreach71-b71.test.js` (10 tests).

## Evidence
- Bytecode-read: `sa.b(DDD)` (setPosition) puts the box minY at `posY - L + V` (L = yOffset, V = ySize). `xi` (EntityBoat) and `xl` (EntityMinecart) constructors set `L = N / 2` (height / 2). `sa.V` is only written by `sa.d` (moveEntity, `*= 0.4`) and `sa.a(DDDFF)` (`= 0`); neither class reads stepHeight (`W`), so ySize stays 0. posY = minY + yOffset exactly.
- Bytecode-read (b70, `nh.a(ja)`): distance from posY to posY, 36, or 9 without line of sight; a sleeper's posY is minY + 0.2 (`sleeper-eye.js`).
- Executed (existing probe): `tools/probes/TrackerVehiclesProbe.java` runs the unchanged `my` (EntityTrackerEntry) with range 80, frequency 3, velocity true on real `xl` carts; `public/research/tracker-vehicles-reference.json` holds the server entity state each tick (`inputs`) and every packet by tick (`rows`). The new test feeds those inputs to `CartTracker` and requires the released ticks to equal the ticks with S15/S16/S17/S18 for `cart0`, `cart1`, `cart3`, `cartTeleport`, `cartPush` (the isAirBorne push at tick 4 is set by the test, since the inputs do not record it). No new Java probe: the existing executed record already covers the cadence, so this reuses it. The recalled range-80 / interval-3 / velocity-true row is confirmed by the record's `range`, `freq`, `vel` fields.
- Executed (by test, not a Java probe): an away run with a hopper above a chest cart moves items into the cart; it fails with the `cartAt` line removed (checked).

## Verification
- `node --test src/mpreach71-b71.test.js`: 10 pass. `mpclicks-b70` 4, `carts-b70` 9, `mpvehicles-b61` 10, `mpvehicles3-b63` 13, `mpvehiclehits-b67` 8, `mpriding2-b62` 15: pass (one at a time).
- `node --check` on each touched file. Full npm test not run (batch rule). No browser check.

## Follow-ups
- Look-only packets release the full position too (up to 0.125 block off the last released one); a native look packet leaves the position alone. A relative-move packet is applied by the client as an absolute target here.
- `airBorne` (addVelocity) and `velocityChanged` are consumed by the server tracker now; the port's carts set them already (`minecarts.js`).
- Away-run droppers have no `transfer` host at all (a separate gap, not touched).
- Only a browser would show cart smoothness over the new 3-tick cadence, and a rider's camera on a cart.
