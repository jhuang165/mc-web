# horse89 (batch 89): the sneak tick, the first air factor, a mount dying under the rider

Branch `batch89-horse89`. Owns `src/vehicle-simulation.js` and `src/horse-live.js`. Small local edits: one new line in `src/entities.js` (tickMobs), a helper plus four call lines and one line in `vehicleBlockers` in `src/structure-simulation.js`.

## Summary
1. **The sneak tick, in the native order** (`vehicle-simulation.js` `moveRidingPlayer`, `horse-live.js` `riderSneakOff`, `structure-simulation.js` `riderSneakOff`, `entities.js` one line).
   - Before: the client let the rider off at once in `moveRidingPlayer`, before the mount's update, and dropped the jump (C0B) of that tick.
   - Now: the sneak tick rides on normally. Sneak input is 0.3 * 0.98 forward, the jump counter runs and its C0B is sent. The rider is marked `sneakDismount`, and `sneakSeat` holds the live seat.
   - The mount then makes its update: the horse in `horseTick`, a pig in the tickMobs loop, carts and boats in `tickMinecart*/tickBoat*` (both the walked and the non-walked paths).
   - After that update the rider gets off (`dismount` from the old seat; the fallback is the moved mount's top). `released` carries the spot, and `finishVehicleTick` (or the next `moveRidingPlayer`) puts the client there.
   - If the flag is still set on the next client tick (the mount was not updated), the rider gets off at once, as before.
   - `vehicleBlockers` places a rider just let off at its spot for the pushes after the update. Before, it copied the client position (the seat) back over it.
2. **First ridden tick air factor** (`horseRideThink`): a record without `aiMoveSpeed` now gives jumpMovementFactor 0, not the speed attribute. Live records already had `aiMoveSpeed: 0` from `physics()`, so this only changes records that lack the field.
3. **A mount dead or removed under the player** (`releaseAtSeat`, used in `moveRidingPlayer`, `dispatchVehicleAction` and `finishVehicleTick`): the client stays at its seat and falls from there. Before, it went to `dismountSpot`. A dead rider still uses the old path.
4. **Buck** (`horseRunAround`): sets `released`, so the client now moves to the dismount spot too (the S08). Before, only the record moved.
5. **Boats and carts** (task 4): the dismount position rule already matched native. `sv.m`'s fallback is `boundingBox.minY + height` (not posY + height), and the port uses `bb[1] + height`. The search loop (dx -1..1, dz -1..0, int casts) also matches. What changed is the order (item 1): the fallback now reads the vehicle after its move on that tick.

## Evidence
- **Executed**: `tools/probes/Horse89Probe.java` via `tools/verify-horse89.mjs` writes `public/research/horse89-reference.json`. Scenarios (seeds 1, 6): `sneak`, `sneakJump` (C0B 100 on the sneak tick lands: vy 0.76076), `sneakStill`, `sneakCeiling` (fallback spot), `freshAir` (tick 0 jumpFactor 0, vz 0). It uses a real EntityPlayerMP, the real C0C handler mw.a(FFZZ) and the real yz.ab. `horse88-reference.json` tick 0 also shows jumpFactor 0.
- **Bytecode-read** (`javap -c -p` on the 1.7.10 jar):
  - `yz.ab` (updateRidden: `!isRemote && an()` -> a(null), b(false), return)
  - `yz.a(sa)` (mountEntity(null): `m(ridingEntity)` only when `!isRemote`)
  - `ahb.a(sa, Z)` (the rider's update right after the mount's onUpdate)
  - `mw.a(FFZZ)` (C0C: strafe, forward, jump, setSneaking)
  - `mw.a(sa)` (S1B, setPlayerLocation)
  - `sv.m` (dismountEntity search and fallback)
- **Port-read**: the `main.js` tick order: `moveRidingPlayer` -> `tickSurvival` (carts/boats, then `finishVehicleTick` in non-walked mode) -> tickMobs walk (horse, pig, walked carts/boats) -> `finishVehicleTick` after the walk. Also the `PlayerView` riding branch in `ai.js`.
- Boats and carts are not separately executed. Their order rests on the shared World / EntityPlayer bytecode.

## Verification
- `node --test --test-timeout=600000 src/horse89-b89.test.js`: 6/6 pass. On the old code, the first 5 tests failed 0/5 (checked before the cart/boat test was added).
- 48 targeted neighbour files (`--test-concurrency=2`): 771/772 on the first run. The one failure was `vehicle-simulation.test.js` SIM-01, which encoded the immediate cart sneak dismount (the gap). I updated it to run the cart update and then `finishVehicleTick`. Rerun: `vehicle-simulation.test.js` 45/45.
- `src/horse88-b88.test.js` sneak test updated (it encoded the gap: no C0B, immediate dismount). It now expects 1 C0B and the dismount in the mob tick. It passes in the neighbour run.
- `npm run build`: OK. The full `npm test` was not run (track rules).

## Follow-ups
- `PlayerView` (spcopy89, `ai.js`): the server copy sees the sneak dismount one tick later than native, because on the sneak tick its riding branch falls back to the reported position.
- A pig corpse (dying pig) with a sneaking rider falls back to the next-tick immediate dismount (the corpse path skips the new tickMobs line).
- The multiplayer server (`server-vehicles.js`, mpobjects89) keeps its own immediate sneak dismount. Not touched.
- Boat/cart sneak order is not executed. A probe like Horse89Probe for `xi` / `xl` would settle it.
- Browser-only (not checked): how dismounting feels on the sneak tick and a jump on that tick; no rubber-band after the dismount; falling from the seat when the mount dies or a cart/boat breaks; the client moving to the spot after a buck.
