# Batch 59 deathfx: the client copy's onDeathUpdate (corpse tilt and 20 poofs)

## Summary
- `src/death-fx.js` (new): `copyDeathUpdate(c)` counts deathTime on a dead client copy; at 20 it stops the copy (setDead) and draws the 20 "explode" particles from the copy's own Random (`burst`, the live path's helper), pushing them to `c.fx` as `{ particle, x, y, z, vx, vy, vz }`. `copyDeathAngle` is rotateCorpse's angle from the copy's deathTime. Dragon and crystal copies are skipped (own death code).
- `src/entity-tracker.js` (small): `ClientEntity` gains `width`, `deathTime`, `deathDone`; `step()` calls `copyDeathUpdate(this)` after the water check and before the interpolation; the tracker keeps the copy's width (entryOf, stepEntry); a rider copy now gets `dead` from its live mob (it was stale).
- `src/entities.js` (small): takeFx particles keep their velocities; the live `deathUpdate` still draws its 20 puffs on the live Random (server side) but spawns visible particles only when no client copy is tracked.
- `src/mob-renderer.js` (small): the copy's deathTime drives the corpse tilt (`clientAngles` overrides `death` when the copy counted).
- `tools/probes/DeathFxProbe.java`, `tools/verify-deathfx.mjs`, `public/research/deathfx-reference.json` (tag b59df): zombie, pig, piglet, horse, 26 ticks each.
- `src/deathfx-b59.test.js`: 14 tests. `src/vehicles4-b58.test.js`: one stale test title updated.

## Evidence
- Executed (unchanged sv.C on a client world double, logging Random, world recording spawnParticle): status 3 at tick 2 gives deathTime 1; deathTime 20 at tick 21 draws 20 particles (gaussian x3 at 0.02, then three floats scaled by the copy's width and height); no living sound roll once dead; the position is the one before the tick's interpolation. Sizes: zombie 0.6x1.8, pig 0.9x0.9, piglet 0.45x0.45, horse 1.4x1.6. The port replays all positions and velocities at 1e-9 and the draw strings exactly. The older horse-status record (90 ticks x 5) now replays in full, including tick 79, with the death update before the tail roll.
- Bytecode-read: sv.aF (`++aA`; at 20 the `!isRemote` xp part, setDead `B()`, then the particle loop); called from sv.C when health <= 0.
- Recalled: RendererLivingEntity.rotateCorpse formula (already in the port, damage-fx.js `deathTipAngle`). The single-player live path already drew the tilt and the burst from the live mob; the copy path is what changed.

## Verification
- `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node tools/verify-deathfx.mjs` (4 cases, 20 particles each).
- `node --test src/deathfx-b59.test.js src/vehicles4-b58.test.js`: 47 pass. Tracker, entities, horse, damage-fx, mob, squid, dragon and ride tests: 673 pass, 0 fail. Full npm test not run (batch rule). No browser check.

## Follow-ups
- Only the horse copy draws the living sound roll (nextInt(1000)) while alive; other mob copies do not, so their Random streams are not aligned with Java before death (the test replays those draws). Status 2 / 3 sound draws on the copy are still horse only; zombie and pig pitch draws come from the generic source.
- A browser check could show the poof position and the tilt timing against the live path (not done).
- The copy leads the live counter by about a tick (client counts from the status packet); the copy poof is therefore drawn one tick before the live mob is removed.
