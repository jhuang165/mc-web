# Player pose track, batch 26 (2026-11-07)

## Summary
- Death roll: `PlayerRenderer.update` takes `deathTime`; the root rotation is `playerRootRotation(bodyYaw, death)` = Ry(180 - yaw) then Rz(min(1, sqrt((deathTime + partial - 1) / 20 * 1.6)) * 90), read from RendererLivingEntity.rotateCorpse (`boh.a(sv,F,F,F)`; `boh.a(sv)` returns 90). The hurt/death tint applies while `hurtTime > 0 || deathTime > 0` (boh tint branch). onDeathUpdate (`sv.aF`) calls setDead at deathTime 20, so the model is hidden from then on.
- main.js (minimal): the death screen now draws the model in third person until deathTime 20, passes `deathTime`, and ticks `playerBody` once per death tick so limb swing settles.
- Sleeping head: the forced `headYaw/headPitch = 0` is gone. `isMovementBlocked` (health <= 0 or sleeping) skips the old-AI rotationYawHead copy, the mouse is released, and renderYawOffset stays clamped, so `mobPose` of the unticked body gives the native frozen netHeadYaw and pitch.
- Sleeper shadow: `sleeperShadowCaster` (entity position, size 0.5, height 0.2). RenderManager calls doRenderShadowAndFire for every rendered entity, so it draws in first person too; it replaces the third-person caster while sleeping.
- Parity "Third person" row and third-person.md / bed.md updated: glint, dyed leather and pumpkin helmet were already ported; the view not being saved is native.

## Verification
- `npm test` and `npm run build`: see the final report for counts.
- New unit tests in `src/player-renderer.test.js` (death roll formula and clamp, frozen head, sleeper shadow).
- Muted headless Chrome on :5265 (`artifacts/b26-playerpose/pose.mjs`): sleeping with the head turned (head pivot y -0.80 rad, pitch -17 degrees, as the frozen body fields give); death in view 1: root z rotation 0.85, 1.52, then 1.571 (90 degrees), model hidden after deathTime 20. Screenshots: `sleep-head-outside.png`, `death-*.png`.

## Follow-ups
- No new Java probe; the constants come from javap reads only (no *-reference.json).
- Inventory paper-doll preview has no death/sleep states (not reachable natively).
- Dying while the player is walking: native keeps the physics going on the death screen; here the world waits.
- Cape and ears absent; held-item mesh still simplified.
