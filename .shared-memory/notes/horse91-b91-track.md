# horse91 (batch 91): executed boat and cart sneak order, a mob rider on a saddled horse

Branch `batch91-horse91`. Files: new `tools/probes/Vehicle91Probe.java`, `tools/verify-vehicle91.mjs`, `public/research/vehicle91-reference.json` (14 records, 186 KB), new `src/horse91-b91.test.js`; `src/horse-live.js`, `src/entities.js`.

## Summary
1. **Boat and cart sneak order is now Executed, and the port already matched it.** `Vehicle91Probe` rides a real EntityPlayerMP (ServerPlayerProbe) on the unchanged `xi` (boat) and `xs` (empty cart) in BoatProbe's world: per tick the real C0C handler `mw.a(FFZZ)`, the mount's `h()`, the real `yz.ab()` when the rider is linked and sneaking, then the mount's `ac()`. 7 boat records (forward, coast, bank, beached, turn, enclosed, never sneaking) and 7 cart records (rail, railStill, fall, slope, forwardKeys, pit, never). In every record the mount makes its full move on the sneak tick with the rider's input (boat accelerates or coasts with the sneak input), the rider is released on that same tick, and the spot is the one `dismountEntity` finds from the rider's seat of the previous tick (+1 block, fallback on the moved mount's top). No source change was needed for items 1 of the task: the b89/b90 order in `structure-simulation.js`, `vehicle-simulation.js` and `server-vehicles.js` replays all 14 records in single player (`moveRidingPlayer` + `tickBoatSimulation`/`tickMinecartSimulation`) and the 7 no-forward-key records on the dedicated server (`DedicatedSimulation`, C0C with `k`).
2. **A mob on a saddled horse** (`horse-live.js` `steeringRider`, `entities.js` three horse-AI sites): the port steered only for a player rider record, so a saddled horse under a zombie/skeleton rider kept running its own AI. Now a living mob rider (`riddenBy`) steers and blocks the AI like a player does, with its `rotationYaw`/`rotationPitch` and its `moveForward`/`moveStrafing` times 0.98.

## Evidence
- **Executed**: `vehicle91-reference.json` (above). On the sneak tick the player's own `collideWithNearbyEntities` is not run by the probe.
- **Bytecode-read**: `wi.e(FF)` (offsets 0-21: `l instanceof sv` and `cu()`), `wi.bh()` (`l != null && cu()`), `wi.ae()` is `sa.ae` (height * 0.75), `wi.ac()` calls `wf.ac` then the rear shift. `sv.m(sa)` loop (dx -1..1, dz -1..0, `(int)posY` then `(int)posY - 1`) equals `dismountSpot`.
- **Port-read**: mob rider input after its own last update is AI value * 0.98 (the port's rider walk does not run, so the decay is applied in `steeringRider`); the rider's yaw/pitch are its record's. Not executed: no probe with a mob rider on `wi`.
- Vanilla 1.7.10 cannot make this without commands/NBT (no skeleton horsemen, jockeys are spider/chicken only), so only the command/NBT path is covered. A pig has no equivalent: its steering task requires `instanceof EntityPlayer` with a carrot on a stick (not re-read this batch).

## Verification
- `node --test src/horse91-b91.test.js`: 23/23 (14 SP, 7 dedicated, 2 mob rider). With `entities.js` and `horse-live.js` stashed, the zombie-rider test fails (22/23); the 21 vehicle tests pass without source changes (nothing to fix).
- 76 neighbour files (horse*, mphorse*, mpriders*, mpriding*, mpvehicle*, seat86, ride87, vehicle*, player-riding, spcopy*, pig-saddle*, mob-riding*, zombie*, attributes2, boats, minecarts, mpobjects*), `--test-concurrency=2`: 758/758.
- Reference regenerated with `node tools/verify-vehicle91.mjs`. `npm run build` and full `npm test` not run (no imports of new modules; track rules).

## Found wrong in the batch 90 list
- Nothing wrong: "boat and cart sneak order only bytecode-read" is now executed and agrees.

## Follow-ups
- Entity-list order: the port always pushes the released rider's vehicle after the vehicles update (a player-after-vehicle order). Natively the released player pushes the vehicle (`applyEntityCollision`, 0.05) in the same tick only if it is listed after the mount; a player listed first is `continue`d that tick. The replay test drops that push on the sneak tick. Left open (affects every player push, needs list-order modelling).
- The mob-rider horse: rider input values, the rider's yaw following the mount (`updateRidden`) and the rear shift of `wi.ac()` for a mob rider (the seat ignores rearing) are not executed.
- Mounting tick on the dedicated server: a forward key sent with the mounting tick reaches the boat one tick late (C0C is read before C02 mounts); not compared with native.
- Browser-only (not checked): how the sneak dismount from a boat or cart feels in multiplayer.
