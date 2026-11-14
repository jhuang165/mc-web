# Batch 73 mpriders73: server rider falls, server arrow pickup box, carried rider fall

## Summary
- New `src/multiplayer/server-rider-fall.js` (`serverRiderFall`): the server rider's `fall` is the single-player `syncRider` fall (ceil(distance - 3 - Jump Boost), CombatTracker fall entry, `landingEffects`), with the sounds sent as S29 (`sim.soundsOut`, `except: null`) and `addFallStat` (EntityPlayer.fall counts from 2 blocks, not in Creative). `src/multiplayer/server-vehicles.js`: `riderOf` uses it (it was a bare `damage(ceil(d - 3))` with no sounds, no Jump Boost); new `ridingBox(p)` (cart, boat or pig box, null on foot or dead).
- `src/multiplayer/server-dispense.js` `collectArrows`: one-line change, passes `ridingBox(p)` of the lane's vehicles (`dimState(dim).vehicles` for the Nether/End) as the fourth argument of `Arrows.collect`. `bow.js`, `projectiles.js`, `entity-simulation.js` not touched (mobcells73 neighbours).
- Gap 3 (carried fall of a mounting rider): no code change, found wrong (see Evidence).
- Probe/data: `tools/probes/MountFallProbe.java`, `tools/verify-mountfall73.mjs`, `public/research/mountfall73-reference.json`. Test: `src/mpriders73-b73.test.js` (6).

## Evidence
- Executed (MountFallProbe, unchanged classes): `Entity.moveEntity` of an EntityPlayerSP with fallDistance 5, stone 0.03 below the feet, with and without `ridingEntity`: dy 0 never sets onGround and never calls `EntityPlayer.fall`, fallDistance stays 5; the gravity step dy -0.0784 lands and calls fall(5). With the floor 0.2 below, neither lands.
- Bytecode-read: `Entity.updateRidden` (sa.ab) zeroes motionX/Y/Z before `onUpdate`; `EntityLivingBase.updateRidden` (sv.ab) writes `fallDistance = 0` after it; `Entity.mountEntity` (sa.a(sa)) writes only the yaw/pitch deltas and the link, no fallDistance; `EntityLivingBase.moveEntityWithHeading` (sv.e) calls `moveEntity` (offset 620) before the gravity subtraction (offset 703). So a rider's own move is always (0, 0, 0) and cannot land: the carried fall is zeroed in the same updateRidden without being spent. The port (zero at the seat) is already right; the batch 72 follow-up was wrong.
- Bytecode-read: `EntityPlayer.playSound` (yz.a(String, float, float)) calls `World.playSoundToNearExcept(this, ...)`. Natively the rider's own client plays its predicted fall sound and others get S29. The dedicated client predicts no riding fall, so the server sends the sound to everyone in range, the rider included (recalled: the native total audio is the same).
- Recalled: pickup box `union.expand(1, 0, 1)` for a ridden entity is the batch 72 port (`ArrowTriggerProbe`); this track only wires the server vehicles to it. The native condition is a not-dead `ridingEntity` (boats and carts included), as in single player.

## Verification
- `node --test src/mpriders73-b73.test.js`: 6 pass. `src/riders72-b72.test.js src/projectiles6-b72.test.js src/mpvehicles-b61.test.js src/mpvehicles3-b63.test.js src/mpprojectiles-b62.test.js src/mpvehiclehits-b67.test.js src/vehicle-simulation.test.js src/vehicle-riders.test.js`: 104 pass. `src/mpprojectiles2-b63 mpriding2-b62 mpstats-b63 mpstats2-b64 mpstats3-b65`: 46 pass.
- `node --check` on touched files. `npm run build` once. Full npm test not run (batch rule).

## Follow-ups
- A mob passenger still takes a vehicle's fall at its own turn, not inside the vehicle's move.
- Only a browser (two clients) could show the fall sound at a boat or cart landing on the server.
