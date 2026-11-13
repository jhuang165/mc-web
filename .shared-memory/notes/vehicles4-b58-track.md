# Batch 58 vehicles4: walk order, cart and dismount falls, horse status draws

## Summary
- `tools/probes/Vehicles4Probe.java` (extends `BoatCopyProbe`) and `tools/verify-vehicles4.mjs` write `public/research/vehicles4-reference.json` (tag b58v4, 19 records): `walk` (10), `cart` (4), `dismount` (5).
- `tools/probes/HorseCopyProbe.java` gained `status`; `tools/verify-horse-copy.mjs` writes the new `public/research/horse-status-reference.json` (tag b58hs, 5 horses x 90 ticks). The older reference files regenerate byte-identical.
- `src/horse-copy.js`: `horseCopyStatus(c, status)` draws a copy's status 2 / 3 on the copy's own Random; `stepHorseCopy` skips the living roll once the copy is dead.
- `src/entities.js` (small): `statusPitch(e, status)`; the two `clientSounds` pitches of a hit now come from the horse copy's Random when the tracker has a copy, else `statusPitchRandom` as before.
- `src/vehicles4-b58.test.js`: 32 tests.

## Evidence
- Executed (unchanged xi, xm, sv, wi): 
  - Walk order: real xi / xm copies that interpolate toward a packet each tick are ticked before or after the ridden boat copy. A crossing boat or cart, and a slower boat ahead, change the ridden copy's run depending on the order (final x differs between "first" and "last"). The port replays all 10 records at 1e-9 using the tracker's `clientList` order; a swapped order fails the replay (mutation check). `ObjectClient.clientBlockers` already reads the other copies' current boxes, and the joint walk steps copies in spawn-packet order (`joinSeq`), so the gap was test evidence, not missing code.
  - Cart rider: a minecart copy that interpolates down 9 or 12 blocks never calls the rider's fall (no sound, no attackEntityFrom, fall distance 0). Control: a server cart does (fall.big + step.stone, one attackEntityFrom). The port's copy has no rider-fall path (hook never called), as executed.
  - Dismount fall: after `sa.a(null)` on the client the player falls on foot; the fall distance counts from the dismount (a boat that fell 3 ticks first changes nothing; 2 blocks plays nothing; 9 and 12 play fall.big + step.stone). The stand-in moves the player (gravity 0.08, drag 0.98F), the real `sv.a(DZ)` updateFallState and `sv.b` fall run. The port's `movePlayer` plus `clientRiderFall` match y per tick and the sounds.
  - Horse status: status 2 draws `nextInt(3)` then two floats (no child term, the pitch is `(r - r) * 0.2 + 1`; cS and the rear are server only); status 3 draws two floats; a dead copy draws no living roll. Sound names by type (hit, death, donkey, zombie, skeleton) as before.
- Bytecode-read: `sv.ab` sets fallDistance 0 for a rider each tick; `wi.cS` is `if (!isRemote)`; `wi.aT` order (cS, nextInt(3), name); `my.a(List)` calls `b()` (sendMetadata) at the end of each branch of the entry update, after that branch's location packets.
- Gap (4), flag metadata delay: not found. Executed horseMeta (b56) already shows the S1C leaves in the entry update of the tick the flag changed; the lockstep port applies it in that update's packet phase and the copy's animation starts that client tick (test). Any further delay would be real-time network thread timing, which the lockstep port does not model for any packet.

## Verification
- `MC_RESEARCH=../tools/research node tools/verify-vehicles4.mjs` (19 records), `node tools/verify-horse-copy.mjs` (old references unchanged).
- `node --test src/vehicles4-b58.test.js`: 32 pass. Horse, entities, damage-fx, combat, entity-tracker, boat, object-tracker and ride tests (`src/horse*.test.js` and others): 545 pass, 0 fail. Full npm test not run (batch rule). No browser check.

## Follow-ups
- A dead horse copy's onDeathUpdate at deathTime 20 draws about 20 poof particles (gaussians and floats); executed, not ported (the record shows them at tick 79).
- The live horse's own hurt (`horseHurt`) still draws on the live Random for the server side; only the client status sounds moved.
- The dismount replay uses a stand-in for the player's motion (the real fall code, not the real EntityPlayerSP moveEntity).
- Mob copies, not only object copies, as movers in the walk are covered by the tracker's order, but only boats and carts were executed.
