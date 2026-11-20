# spcopy87 (batch 87): the single-player server copy sees boats, rides, sleeps and owns the fall damage

## Summary

Batch 86 (spcopy86) left three things open for the integrated server's copy of the player (`ai.js` PlayerView, `entities.js` `serverPlayerUpdate` / `processPlayer`). This track closes them.

1. **Entity boxes in the copy's collision lists.** Correction to spcopy86's follow-up, which said the d28 / d32 lists were blocks only. `entities.js collisionBoxes` already calls the global entity-box provider for any mover. `main.js` installs `boatBoxProvider(boats)` there, so in the browser the copy's `mw.d` move and its d28 / d32 tests already saw boats. Only the test harnesses had no provider. The new tests install it and show two things:
   - walking, jumping and standing on a boat (on land and floating) needs no correction;
   - a packet into a boat's body is put back with the boxes and kept without them.

   Correction to the task premise: a minecart has no box. `xl.J()` (EntityMinecart.getBoundingBox) returns null, and `xl.h(sa)` returns the other's box only when that other `S()` (canBePushed). A player is not pushable that way: `sa.h` is null for the player as the mover, so a player walks through carts natively. Nothing was added for carts.
2. **The riding and sleeping branches.** `PlayerView.branch` is set in `update()`:
   - `walk`;
   - `riding` (`nh.a(jd)` 94-300);
   - `sleeping` (301-359);
   - `direct` for the mount, dismount, bed, login and respawn ticks, dead copies and `placed` harnesses.

   `riding`: the packet's position is not read.
   - `serverPlayerUpdate` seats the copy on the live mount through the new `EntityWorld.serverSeat`. In `main.js` that runs `vehicleSystem(...).updateRiderPosition(rider.vehicle)` with the rider saved and restored (`mw.m.ac()`). A host without one falls back to the client's reported spot.
   - It takes the packet's onGround, runs `mw.i()` there and puts the copy back on the seat.
   - It sets `accepted` (o/p/q) to the seat.
   - It zeroes the motion and fallDistance (updateRidden).

   `sleeping`: `mw.i()`, then back at `accepted` (o/p/q from sleepInBedAt's placement). The packet is not read and there is no handleFalling.
3. **Fall tracking (`mw.b(DZ)`).** The copy has its own `fallDistance` and `inWater`. `server-process-player.js` has two functions for them.
   - `handleFalling`, called at the end of `processPlayer`, ports `yz.a(DZ)` → `sv.a(DZ)` → `sa.a(DZ)`:
     - `handleWaterMovement` at the landing position zeroes fallDistance (`if (!M()) N()`);
     - on the ground, `fall(R)` with `R := 0`;
     - otherwise, when dy < 0, `R := (float)(R - dy)`.
   - `copyFall` deals the damage as EntityPlayer.fall does: none in Creative or when dead, `ceil(R - 3 - jump boost)` through `damage-fx.js landingEffects`, and the fall combat site.
   - `updateFallResets` runs in `serverCopyUpdate` (the copy's `mw.i()`, whose own move counts no fall because `mw.a(DZ)` is empty). It applies `sa.C`'s lava halving, `handleWaterMovement` and the ladder branch's zeroing of R, and `setInWeb`. `processPlayer` also zeroes R on the web that `mw.d` entered.

   `serverPlayerUpdate` sets `p.fallOwner = !p.placed`. `player-environment.js landPlayer` then skips its damage, as `EntityClientPlayerMP.attackEntityFrom` (`bjk.a(ro,F)` returns false) takes none. The sounds, the landing dust and farmland trampling stay on the client. Other changes:
   - Respawn resets the copy's R.
   - The ender pearl hook zeroes it (`zm` onImpact sets `sv.R := 0` before its 5 damage).
   - Mount falls stay with the vehicle code. `rider.fall` passes on a cart's fall (Entity.fall) and `rider.fallHit` a horse's (EntityHorse.fall, `ceil(R*0.5 - 3)`). The copy's R is 0 while riding, so nothing doubles.

Hay and slime (bytecode-read): `onFallenUpon` is overridden only by `aky` (BlockFarmland) in 1.7.10. BlockHay keeps Block's empty one, so a hay bale takes nothing off a fall; the cushion is a later version's. There is no slime block in 1.7.10's registry or in the port's `BLOCKS`. The test asserts that hay gives the same damage as stone and that no slime block exists.

## Evidence

- Bytecode-read (`javap -c -p`, 1.7.10 jar):
  - `nh.a(jd)` 94-300 (riding: angles from the packet if `jd.k()`, `mw.m.ac()`, `mw.D = jd.i()`, `mw.i()`, `mw.V = 0`, `mw.a(seat, f3, f4)`, `mw.m.ac()`, `oi.d(mw)`, o/p/q, `mt.g(mw)`, return), 301-359 (sleeping: `mw.i()`, `mw.a(o, p, q, yaw, pitch)`, `mt.g(mw)`, return) and 1464-1506 (`mw.b(mw.t - d3, jd.i())`).
  - `mw.a(DZ)` is empty. `mw.b(DZ)` → `yz.a(DZ)` → `sv.a(DZ)`, then `sa.a(DZ)`.
  - `yz.b(F)` (allowFlying returns, the stat at >= 2), then `sv.b(F)`.
  - The writers of `sa.R`: `sa.C` (lava × 0.5), `sa.N`, `sa.as`, `sv.e(FF)` ladder, `sv.ab` (updateRidden), `sa.f(dh)`.
  - `bjk.a(ro,F)` returns false.
  - `wi.b(F)`.
  - `zm` onImpact.
  - `ahb.a(sa, azt)`: block boxes, then entities in the box grown by 0.25 (the mover excluded), `other.J()` if it intersects, and `mover.h(other)`.
  - Scans of every class: `J()` returns a box only in `xi` (EntityBoat), and `xl.J()` is null. `onFallenUpon` is overridden only in `aky`.
- Port-read: `collisionBoxes` / `setEntityBoxes` / `boatBoxProvider` (boats are already in the copy's lists in the browser), the `main.js` tick order (client move → tickSurvival → mobs.tick → serverPlayerUpdate → vehicle finish), `vehicle-simulation.js` `rider.fall` / `fallHit`, `horse-live.js` and `minecarts.js` `updateRiderPosition`.
- Executed (port only, no 1.7.10 client): the new tests drive `player-physics.js movePlayer` and `player-environment.js finishPlayerMovement` into the copy, plus the port's Boats, Minecarts and horse.

## Verification

- `node --test --test-timeout=600000 src/spcopy87-b87.test.js`: 8/8 pass.
  - Boats: walking, jumping and standing on a boat on land and floating, with no correction. A move into a boat's body is put back with the boxes and kept without them.
  - Falls, each with exactly the native damage once, from the copy, and no S08: a 14-block drop, the same onto hay (equal damage), onto a boat, into water (0), down a ladder column (0, with the copy counting more than 10 before the ladder) and onto a ladder's foot. Also: no slime block exists.
  - The copy's R follows the client's own. `handleFalling` units: counting, a single landing, Creative, dead.
  - A `placed` harness keeps the client's damage.
  - Minecart: the copy is on the live seat (which differs from the client's lagging seat), takes the angles, and its motion and R are 0. The cart's 10-block landing reaches the rider once (7). After the dismount and a walk there is no stale damage and no correction.
  - Horse: on the live seat, and the horse's landing gives `ceil(R*0.5 - 3)` once.
  - Sleeping: the copy stays at the bed spot against drifting packets, counts no R, and walks again after the wake's setLocation.
  - Mutation check: restoring the client's landing damage fails the falls test (double damage).
- Neighbours: 85 files, concurrency 2, 905/905 pass. They are the files that reference `ai.player`, PlayerView, `serverPlayerUpdate`, `landPlayer`, `finishPlayerMovement` or `server-process-player`; the source-text scans of main / entities / player-environment / ai; the `readdirSync` scanners (skins73-b73, module-names, skintex75, sounds73); and the vehicle-simulation, horse-world and boats tests. No old test needed updating.
- `npm run build`: ok (only the existing chunk-size warning).
- No full `npm test` and no browser checks.

## Follow-ups

- Browser-only: no rubber-banding while standing or jumping on boats, riding carts and horses, or lying in a bed in a real session. The damage timing (now a network tick after the client's landing in the same game tick) and the hurt flash and sound on a fall.
- A floating boat bobs by about 0.01. A player whose feet it lifts inside its box falls into it (moveEntity ignores boxes it already overlaps). Once more than 1/16 deep, the copy's `!flag1` test puts it back, which native would do too. The test holds the settled boat still. Whether this rubber-bands in play is boatcheck87's / a browser question.
- Still client-side, natively server-side: farmland trampling (`aky.a` from `sv.a(DZ)`), the 2006 landing dust and the fall stat (`yz.b(F)`).
- The S08 / C06 wait of the mount, dismount and bed `setPlayerLocation` is not modelled; those ticks are still `direct`.
- Mobs that run between the mount's move and the network tick read the old seat. `oi.d(mw)` (chunk watch) is not ported.
- Dimension travel builds a new EntityWorld (a new copy, R = 0). In the transition tick, `survival.serverPlayer` can still name the old copy, so a landing exactly then would deal no damage.
