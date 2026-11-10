# teleporter (batch 38)

## Summary
- Record 0 fixed (goal 1). `Teleporter.makePortal` exits the whole rotation loop after one failed rotation (`continue label274` targets the height loop). The port tried the next rotation and found a different site. Fixed in both scans of `src/dimensions.js`; the test replays all steps of all 8 cache records (no slice).
- One Random per world (goal 2). The shared cache entry (`DimensionLive.exitCache`) now carries `Random(worldSeed)`; the player's `arrive` and the entity `shareTeleporter` use it. Test: the peek Teleporter's random is the cache's random.
- Ridden carts and boats (goal 3). Native: a ridden vehicle never starts the portal countdown (BlockPortal ignores it), but one already counting down travels and the player is dismounted and stays (`removeEntity` -> `mountEntity(null)`). `tickEntities` now does that (`Minecarts.dismount`), the copy carries no rider. Helper `vehicleDeparture` in `entity-portal.js`.
- Away-run carts and boats (goal 4). `away-entities.js` runs `EntityPortals` for the run's carts and boats and returns `portalTravel`; `finishAway` delivers them into the destination's inbox. Test in `away-entities.test.js` (a cart and a boat on portal blocks leave; a cart elsewhere stays) and in `entity-portal.test.js` (finishAway delivers to the Nether inbox). Limits in loading-screens.md "Batch 38 portals".
- Clock (goal 5). Bytecode-read: `DerivedWorldInfo` set-total-time and set-time are empty, so total time advances only in the Overworld tick, every server tick, with no pause for loading. The port's total time is root-level and already carries across dimension views; the loading screens' ticks were missing. `main.js` `advanceTicks` now adds them to `mobs.worldTicks`.

## Verification
Focused: `entity-portal.test.js` 26 pass, `dimension-live.test.js` 21 pass, `dimensions.test.js` + `away-world.test.js` + `module-names.test.js` (with dimension-live, 40 total) pass, `away-entities.test.js` 8 pass. Browser (muted headless Chrome, port 5384, load 6.5, `artifacts/b38-teleporter/cart.mjs`): a cart in a lit Overworld portal got the player mounted as soon as its inPortal flag was set; the cart left, the player was dismounted and stayed; then the player's own `travel(-1)` arrived at the same portal and the cart was in the Nether's list; no page errors. The full `npm test` and `npm run build` were left to the lead.

## Follow-ups (proposed gap lines)
- Away-run mobs, items and orbs do not travel through portals (only carts and boats do); delivery happens at the end of the run with the return's total time.
- No executed probe for a ridden-then-travelling cart (the rule is bytecode-read plus the executed `onUpdate` countdown); a probe that mounts a rider mid-countdown would pin it.
- The loading-screen clock advance is only checked in the browser (no unit test of `advanceTicks`).
