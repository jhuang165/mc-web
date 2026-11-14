# Batch 72 riders72: rider falls, jockey search order, player step while riding

## Summary
- `src/mob-riding.js`: `beginRidden` no longer zeroes `fallDistance`; `endRidden` does, after the rider's update (also with no mount left). `freeChickenNear` picks by native list order (chunk x, chunk z, slice, insertion) and uses the child zombie's anchored `spawnBox`.
- `src/entities.js`: `seat()` calls `endRidden` for every rider; a mob passenger takes the falls its boat or cart queued (`takeVehicleFalls`).
- `src/vehicle-riders.js`: `passFall` / `takeVehicleFalls`. `src/boats.js`, `src/minecarts.js`: landing calls `passFall`. `src/vehicle-simulation.js`: `rider.fall` defaults its sound hook to `state.fallSound`. `src/main.js`: `vehicleState().fallSound` plays the sounds; the step distance and step sound need `!(rider.vehicle || mpRiding)` (`stepRiding`).
- New: `tools/probes/RidersProbe.java`, `tools/verify-riders72.mjs`, `public/research/riders72-reference.json`, `src/riders72-b72.test.js`. Docs: dated Batch 72 lines in `mob-riding.md`, `boats.md`, `minecarts.md`, `player-step.md`.

## Evidence
- Executed (RidersProbe on the unchanged classes): `updateRidden` on a dead mount turns fallDistance 5 into 0 for a zombie, a zombie on a chicken and an EntityPlayerSP; the real `EntityZombie.onSpawnWithEgg` child path over real Chunk lists (12 scenarios: chunk x/z, slice, insertion, ridden skipped, child box edges, out of box); real `Entity.moveEntity` of an EntityPlayerSP with and without `ridingEntity` (56 cases).
- Bytecode-read: `sv.ab` writes `R = 0` after `sa.ab`; `sa.ab` has no fall write; `sa.b(F)` passes the fall to `riddenByEntity`; `xi.a(double, boolean)` (boat) calls `b(R)` above 3; `yq.a(sy)` takes `list.get(0)`; `sa.d` offset 1541 tests `m == null` for the whole step block. `wg.b(F)` (chicken fall) is empty, so a chicken passes nothing to its rider.
- Gap verdicts: gap 1 (rider fall distance) found wrong: native zeroes it for living riders; only the order (after the update) changed. Gap 2 (silent boat/cart falls) closed for the single-player player and mob passengers. Gap 3 (jockey order) closed. Gap 4 (step while riding) closed.
- Recalled / not executed: the live-mount path of `updateRidden` (the bare probe world throws a NullPointerException in the rider's onUpdate), so only the dead-mount path ran; the Java fall sound itself was not executed (`EntityLivingBase.fall` sounds are the existing damage-fx.js port).

## Verification
- `node --test src/riders72-b72.test.js src/mob-riding.test.js src/boats.test.js src/vehicle-simulation.test.js src/vehicle-riders.test.js src/steps71-b71.test.js src/minecarts.test.js src/player-mount.test.js src/player-riding.test.js src/riding-nbt.test.js src/pistons5-b68.test.js src/player-throw-replay.test.js`: 201 pass, 0 fail. `src/interchange.test.js src/summon-coverage.test.js src/village-fight.test.js`: 24 pass.
- `node --check` on every touched `src/*.js`. `npm run build` result in the lead report. Full npm test not run (batch rule).

## Follow-ups
- A rider mounted while falling would natively spend its carried fall in its first own landing (not modelled; the port skips a rider's own move).
- The dedicated server's players riding server boats and carts get no fall sound hook; the mob passenger's fall happens at its own turn, not inside the vehicle's move.
- Only a browser could show the sound at the landing and the silent riding steps.
