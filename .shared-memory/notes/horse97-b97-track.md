# horse97 (batch 97) track note

Branch `batch97-horse97`, cut from main b5fa6dc3d (release 0.125.0).

## Summary (file by file)
- `src/death-ride.js` (new): `startDeathRide`, `tickDeathRide`, `releaseDeathRide`. A player who dies on a mount keeps the seat through the death ticks (single player). Release goes through `releaseAtSeat` (now exported from `vehicle-simulation.js`), not `detachPlayerVehicle`.
- `src/main.js` (code-read only, not importable): `die()` calls `startDeathRide(vehicleState())` instead of `detachPlayerVehicle` (marks `rider.dead` so a save writes no `playerRides`); the dead-screen tick calls `tickDeathRide(v, deathTime)` before `++deathTime` and skips `deadBodyTick()` while seated; `respawnPlayer` calls `releaseDeathRide`. This is about four lines, more than the two-line target (die, the tick, the body skip, the respawn each needed one).
- `src/multiplayer/server-vehicles.js`: `riderInput` keeps a dead cart or boat rider linked through `deathTime <= 20` like the horse and pig rider (batch 96), released the tick after; zero input and no sneak dismount, except that a boat rider on the kill tick itself (`deathTime` 0) keeps its last input. `release(p)` frees a cart or boat (`v.rider`, `rider.vehicle`) without a spot search.
- `tools/probes/Kill97Probe.java` (copy of Kill96Probe with a real `xi` boat and `xs` rideable cart; `-Ddismount97=1` runs the mountEntity(null) records). Run from git-ignored `tools/research/horse97-probe/`.
- `public/research/kill97-reference.json` (75 KB), `dismount97-reference.json` (small).
- `src/horse97-b97.test.js`: 22 tests.

## Evidence
- Executed (Kill97Probe, real `mw.a(ro)`, `ahb.h`, `xi`, `xs`): boat and cart riders behave exactly as the batch 96 horse and pig riders. Linked through deathTime 1..20, unlinked by `ahb.h` the tick after deathTime 20, the player y unchanged (no spot search, no teleport). After `ahb.f` (respawn removal) mid-animation a cart rider is unlinked at once; a boat clears only its own `riddenByEntity` that tick (the player's `ridingEntity` stays, the player entity is gone). A killed mount unlinks the rider at once and the player stays put.
- Executed (variant 3, boat on a water pool, C0C forward for ticks 0-2, kill on tick 3): the boat's vz grows +0.0017/+0.0038/+0.0041 on ticks 0..2 and +0.0043 on the kill tick 3 (the rider still has its old moveForward in the world tick), then only the 0.99 drag from tick 4 on (`mw.i`'s onLivingUpdate zeroes the input for a dead rider). A cart takes no input. The port matches (new test).
- Executed (dismount spot, `mw.a((sa) null)`, 16 records): spot = last clear (dx -1..1, dz -1..0) cell with a solid top under it at rider y + 1, else the mount top; the port's `dismountSpot` reproduces all 8 open and ceiling records (horse, pig, boat, cart; horse ceiling 65.6 = 64 + 1.6, pig 64.9). The world double's block collision is coarse, so the walls-around and wall-east records add nothing beyond open (kept in the JSON, not asserted).
- Executed (packets of the same call): S08 (`setPlayerLocation`, twice, same spot: once inside `sv.m`/dismountEntity, once at the end of `mw.a(sa)`), and S1B(mode 0, player id, vehicle -1) between them. Order from bytecode: `yz.a(sa)` (S08), `hx` (S1B), `nh.a(DDDFF)` (S08).
- Bytecode-read: `xi.h` takes `sv.be`/`sv.bd` of a linked `sv` rider (xi 881-996), so a dead rider still steers on the kill tick.
- Port-read: the water dismount spot for a horse or pig is the existing `horseSeats.dismount` -> `dismountSpot`; the dedicated server carries the dismount as per-player state (`riding` key disappears, position), not as S08/S1B packets.

## Verification
- `node --test --test-concurrency=2 src/horse97-b97.test.js`: 22 pass, 0 fail. With `server-vehicles.js` and `main.js` reverted: 6 fail (the four server cart/boat death tests, the kill-tick input test, the main.js contract), 16 pass; checked by copying aside and `git checkout`.
- Neighbours (59 files naming server-vehicles, vehicle-simulation, riderInput, releaseAtSeat, server-survival, detachPlayerVehicle, sweep-use75, death-ride; one `xargs node --test --test-concurrency=2` run): 694 pass, 1 fail. The failure is a flake: `horse89-b89.test.js` "the sneak tick: the horse makes its ridden move..." fails about 2 runs in 6 on UNCHANGED code too (checked with my files checked out), passes alone most runs. Not touched.
- `npm run build`: ok (once).

## Found wrong in the batch 96 list
- Single-player `die()` did not just detach at once: `detachPlayerVehicle` also ran the landing-spot search (`dismount`), so a killed rider moved to the spot beside the mount, which native never does. Now seated, then released at the seat.
- "Dying cart and boat riders unprobed": probed, same as horse and pig.

## Follow-ups
- Open: the dedicated server has no S08 or S1B on the wire for a dismount (state only); the native S08, S1B, S08 order is recorded but not modelled as packets.
- Open: the pig/horse spot is verified with coarse block collision only (no wall-blocked records); a seat-height difference between the probe horse (64.1 on open ground, 64.7 under a ceiling) was not explained.
- Not fixed: a boat's `riddenByEntity` clears on the respawn removal while the player's own link stays (probe artefact, no effect).
- Browser-only: the dead player drawn seated on the horse/boat/cart during the death animation in single player, and the thrown body no longer sliding while seated; the main.js lines are code-read only.
