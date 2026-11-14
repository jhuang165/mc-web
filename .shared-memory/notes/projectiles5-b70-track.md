# Batch 70 projectiles5: arrow pickup and fireball punch pick executed

## Summary
- `src/bow.js`: `Arrows.collect` default `take` now asks `survival.inventory.add(makeStack(ARROW))`, so Creative with a full inventory still collects a mode-1 arrow (native `addItemStackToInventory` answers true there; nothing is added). It used `Survival.add`'s stored count, which is 0.
- `src/fireballs.js`: `Fireballs.pick` rewritten to the `EntityRenderer.getMouseOver` entity loop: float `Vec3.distanceTo`, strict nearer-than-block test, border 1.0 on the entity's real box (`boxOf`), optional `viewerBox` candidate prefilter, eye-inside quirk. New optional 5th argument; old callers still work.
- `src/multiplayer/server-mobs.js` `punchBall` passes the viewer box (0.6x1.8, or the sleeper box).
- New: `tools/probes/ArrowPickupProbe.java`, `FireballPickProbe.java`, `tools/verify-arrow-pickup.mjs`, `tools/verify-fireball-pick.mjs`, `public/research/arrow-pickup-reference.json` (300 records), `fireball-pick-reference.json` (2400 scenes + class records), `src/projectiles5-b70.test.js`.
- Docs: Batch 70 lines in `public/research/blaze-ghast.md` and `bows.md` (stale gap lines named, executed references listed); Arrow and Fireball catalogue rows in `tools/build-content-catalogue.mjs`, regenerated.

## Evidence
- Executed: `EntityArrow.onCollideWithPlayer` on a real EntityPlayer/InventoryPlayer for arrowShake 0-8, inGround, canBePickedUp 0-2, Creative, five inventories. Only `EntityPlayer.onItemPickup` is recorded (it casts the world to WorldServer). "Pickup delay" is `arrowShake`; the call is a no-op while it is above 0.
- Executed: `canBeCollidedWith` (large true, small false), `getCollisionBorderSize` 1.0 for both, ball boxes, `AxisAlignedBB` expand/intercept/isVecInside, `Vec3.distanceTo`. Found: distance is float (`MathHelper.sqrt_double`).
- Bytecode-read (composed in the probe, not run natively): the `getMouseOver` entity loop and reach rules (3 / 6, block distance, search box viewer.addCoord(look*reach).expand(1,1,1)); the arrow trigger box (player grown 1, 0.5, 1).
- Found wrong: the gap "server pick not executed" is closed for the geometry; the port's pick had float-distance and candidate-box differences, now fixed. The listed Punch and large-ball gaps in the docs were already closed in earlier batches.

## Verification
- `node --test src/projectiles5-b70.test.js` (4 pass). With fireballs-b41/b42/b43, fireballs-native, blaze-ghast, blaze-ghast-world, mpprojectiles-b62, mpprojectiles2-b63, b62-lead, bow, projectiles4-b69: 202 pass. catalogue-consistency + content-catalogue: 6 pass.
- `node --check` on server-mobs.js. `npm run build` run once at the end. Full npm test not run (batch rule).

## Follow-ups
- Candidate order of `getEntitiesWithinAABBExcludingEntity` (chunk order) is not reproduced; matters only for several balls at equal distance.
- The client mouse state, block ray and the arrow trigger box are not executed. Only a browser could show the punch feel and pickup sound.
