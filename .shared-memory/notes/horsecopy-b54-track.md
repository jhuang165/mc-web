# horsecopy b54 track

Branch `batch54-horsecopy` from 20bbab13b.

## Summary
- The ridden saddled horse's client copy is now packet-driven (`followLive` is no longer applied to riders). `main.js` `seatOnCartCopy` seats the player on the copy (`copySeat`, `src/horse-copy.js`) for horses and pigs. The copy's angles follow the rider's look (`steerHorseCopy`, called from `EntityWorld.moveClient` when `c.steered`; `mobs.riderLook` supplies the native-degree yaw and pitch).
- The premise "the client steers and jumps the horse" was only half right. Natively the client copy takes the rider's yaw and half its pitch, and nothing else: the movement under `!worldObj.isRemote` and the jump power (`wi.w(I)`) are the server's. So the copy neither moves nor jumps; its position is the packets'. An unsaddled ridden horse's copy keeps ordinary client physics.
- A rearing horse's rider also shifts 0.7 * rearAmount along the body yaw (`wi.ac()`); the port only had the 0.15 lift. Added to the live seat and the copy seat (`rearSeat`).
- Drawn dismount (S08 after S1B): natively `EntityPlayer.mountEntity(null)` runs `dismountEntity` (`sv.m`) on the server, S08 carries that spot, so the client jumps from the copy's seat to it. Carts and boats already did this (`Minecarts.dismount`); horses and pigs left the rider at the seat. `dismountSpot` (extracted from `Minecarts.dismount`) now also serves `horseSeats.dismount`. The run-around buck keeps its executed placement (`landing = false`).
- Mount jump: the S08 after S1B lands on the server's position and nothing moves a player onto a mount, so the visible jump is the first seating onto the copy; with the horse seated from its copy that is now drawn.

## Evidence
- Executed: `tools/probes/HorseCopyProbe.java` (unchanged `wi.e(F,F)` and `wi.ac()` on a client world double, `ahb.E` true) via `tools/verify-horse-copy.mjs` -> `public/research/horse-copy-reference.json`: 8 `steer` scenarios (forward, turning past 360, look up, a directly written jump power), 20 `rear` rows. Replayed by `src/horse-copy-b54.test.js`. The unsaddled client case is not recorded (the double has no client chunk provider).
- Bytecode-read: `nh`'s C0B handler is the only caller of `wi.w(I)`; `yz.a(sa)` (dismountEntity only when `!isRemote`, no setLocationAndAngles), `mw.a(sa)` (S1B, then setPlayerLocation), `sv.m(sa)` (search, same as the cart's `VehicleProbe` executed one). The rearing amount on the copy uses the live horse's `rearAmount` (the copy's own animation of the synced flag differs only by the watcher's delay).

## Verification
- `node --test src/horse-copy-b54.test.js src/horse.test.js src/horse-world.test.js src/horse-ride-b47.test.js src/ride-mounts-b53.test.js src/ride-cart-b52.test.js src/ride-copy-b51.test.js src/player-mount.test.js src/minecarts.test.js src/boats.test.js src/vehicle-simulation.test.js src/vehicle-riders.test.js src/tracker-mounts.test.js src/pig-saddle.test.js src/horse-gear.test.js src/entity-tracker*.test.js src/tracker-*.test.js` -> 372 pass, 0 fail. `npm run build` ok. `tracker-mounts.test.js` updated (the ridden unsaddled horse's copy trails). Not browser-checked.

## Follow-ups
- The copy's own rearing animation and the horse's client leg animation are not modelled (the live `rearAmount` stands in).
- The horse run-around buck places the player at the mount's x/z with the seat's y (executed b47h record) although a server player would run `dismountEntity`; the record and the bytecode disagree, unresolved.
- No executed record of the dismount search for a horse or pig (the cart's is executed); the horse and pig landing is bytecode-read.
- A ridden unsaddled horse's client physics is unprobed.
