# boatseat85 (batch 85): the rider follows his own client boat

## Summary
1. **No more snap** (`remote-vehicles.js` `ownBoatStep`): the b84 "put back on the server's state past 2 blocks" is removed (`OWN_RESYNC` gone). The local player sits on the copy: `RemoteVehicles.seatOf(key)` (vehicleSeat, feet at -0.5) is applied in `main.js` after `remoteVehicles.tick()` (position, previous, velocity from the copy), and `applyMultiplayerTick` no longer overwrites the position/velocity from the server row while `seatOf(self.riding)` is non-null. The camera follows `position`, so it follows the copy.
2. **Dismount keeps isBoatEmpty false**: `ride()` now only clears `seated`; the copy stays `own` (full physics, no rider input, tracker states read through `ownBoatPackets` with tx/ty/tz = x/y/z) until `noteRiders(keys)` sees another player's riding key newly point at that boat (S1B attach by another rider = setIsBoatEmpty(true)); then it returns to the tracked following.
3. **Snow layer / lily pad clearing** applies to the copy: xi.h's clearing loop has no isRemote guard; the copy's hook now sets the client world cell to air and calls `cleared` (main.js remeshes with `scene.updateBlocks`). The onGround halving was already in `Boats.tickBoat` and runs for the own copy. The crash branch on a client (`!isRemote`) only skips both break and drag, as ported.

## Evidence
- Bytecode-read (javap xi.h offsets 1224-1317, 1388-1517; bjb.a(hx)): the clearing loop (ahb.f for snow aC, ahb.a(III Z) breakBlock for lily bi, then E=false) sits on the non-remote path with no world.isRemote test; bjb.a(hx) calls xi.a(boolean) only when the attach type is 0 and the vehicle is a boat (false for the local rider, true for another); type-0 with vehicle -1 changes nothing.
- Port-read: the S1B of another rider = the presence row's `riding` key turning new; ahb.a(IIIZ)'s aux 2001 break particles/sound and dropBlockAsItem on a client world are not drawn (silent / no drops).
- Not executed: no Java probe.

## Verification
- `node --test src/mpboat84-b84.test.js`: 9 pass (the b84 snap test replaced; two new tests: seat / no snap / stays own / noteRiders, snow clearing). 17 neighbouring files: 243 pass, 0 fail.

## Follow-ups
- Browser-only: the feel of the rider and camera on the copy; whether server dismount teleport (S08 equivalent) lands correctly relative to the kept copy.
- The player's own C03 while riding (EntityClientPlayerMP.sendMotionUpdates) is not ported: the port sends inputs only and the server seats the rider from its own boat.
- Lily pad break particles (aux 2001) on the client are not drawn.
