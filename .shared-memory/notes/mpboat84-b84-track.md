# mpboat84 (batch 84): the multiplayer boat copy's splash, the rider's own boat, the late joiner's spawn record

## Summary
1. **Splash draws on the boat copy** (`remote-vehicles.js` `boatClientStep`, new `fx` sink set by `main.js`): the tracked copy now draws, on its own `Entity.rand`, the water-entry splash (after its first update: the sound's two floats, 31 `bubble` and 31 `splash` at floor(minY) + 1, via `fx.js enterWater`) and xi.h's speed splash (1 + d * 60 `splash` when the horizontal speed d > 0.2625). Draws are consumed with or without a sink. The sound is silent on a client world.
2. **The rider's own boat** (`ownBoatStep`, `ownBoatPackets`, `RemoteVehicles.ride`): the rider's state carries `own: 1`, the entry's released position `tx/ty/tz`, the S12 `mx/my/mz`/`vs` and the position-packet count `rs`. `main.js` calls `remoteVehicles.ride(mpRiding, input)` before `tick()`. The copy runs `Boats.tickBoat` (buoyancy, rider steering, move, drag, splash draws) with the rider record built from the local input. Packets act as xi.a(DDDFFI) / xi.i: an S12 sets the motion; a position packet over 1 block away only sets motion = last S12; a nearer one is dropped; the position and angles are never set from packets.
3. **Late joiner** (`server-cart-track.js` `snap/join/forViewer`, `server-vehicles.js` `view.joins`): a viewer that starts tracking a cart or boat gets a state built as the S0E plus spawn S12: floor(pos * 32) / 32 (boats 0.3 high), the entity's rotation bytes, current motion. Which snapshot (before or after this tick's packets) follows the re-list that found it (entry's own: before; the viewer's: after). Later deltas land on the viewer's own serverPos (offset kept until an S18).

## Evidence
- **Bytecode-read** (javap -c -p, 1.7.10): `xi.h` (the particle loop before `ahb.E && a`; the remote branch; the full physics), `xi.a(DDDFFI)V` (isBoatEmpty true: increments = n + 5; false: squared distance > 1 sets increments 3 else returns; then targets and motion = velocityX/Y/Z), `xi.i(DDD)V` (setVelocity), `bjb.a(hx)` (S1B: the local player's boat gets setIsBoatEmpty(false), another rider's true), `sa.N` as in tracker83.
- **Port-read:** the S0E position is built from the entity (`floor(posX * 32)`), not from lastScaledPosition; the silent client splash sound (RenderGlobal.playSound empty, tracker83 note).
- **Not executed:** no Java probe was added; the existing `tracker-vehicles-reference.json` replay (tracker83 tests) still passes.

## Verification
- `node --test --test-timeout=600000 src/mpboat84-b84.test.js`: 8 pass, 0 fail.
- 48 neighbouring files (vehicle, tracker, remote-vehicles, chunk-view, mp*), `--test-concurrency=2`: 695 pass, 0 fail. `npm run build` passes. No full `npm test`, no browser.

## Follow-ups
- **Browser-only:** the splash particles of boat copies; the rider's boat steering feel and whether the boat and the (server-seated) local player stay together.
- **Deviation:** the local player is still seated from the server's boat; a copy over 2 blocks (squared 4) from the server's exact state is put back on it. Natively the player follows the client boat and nothing corrects it.
- After the local player leaves, native leaves isBoatEmpty false until another S1B; the port returns to the tracked following at once.
- The coast's onGround halving, and the client's own snow/lily-pad clearing (a no-op here), are not modelled.
