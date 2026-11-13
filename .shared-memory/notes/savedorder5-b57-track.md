# Batch 57 savedorder5: Nether/End login order, mob on the player's mount, non-mob entities above y 256

## Summary
- `src/saved-order.js`: the chunk the player's mount is spawned into is ranked right after the view square (the login spawns the mount with World.spawnEntityInWorld, which loads that chunk and every entity in it before the mount). The mount itself stays last.
- `src/away-entities.js` (one call): the away run stamps its records with the Overworld spawn grid as the frame (`plan.spawn`, no player, no view square) unless `mobs.loadFrame` is set. Nobody is logged in there, so a reload has loaded only the grid.
- `src/boats.js`: `mount()` no longer refuses a boat that carries a mob. EntityBoat.interactFirst refuses only another player, so the click mounts and the old rider's link goes stale; World.updateEntities clears that stale pair, which frees the mob and the taker within a pass or two. The port frees the mob at once and seats nobody (returns false). Carts keep refusing (EntityMinecartEmpty refuses any rider). `src/vehicle-riders.test.js` had pinned the old refusal; updated.
- `tools/probes/SavedOrderLoginProbe.java` (switches `skipGrid`, `noPlayer`, `caseName`), `SavedOrderProbe.java` (kinds `boat`, `fall`), `tools/verify-saved-order.mjs` -> `public/research/saved-order5-reference.json` (tag b57so, 10 scenarios), replayed by `src/saved-order-b57.test.js`.

## Evidence
- Nether and End spawn grid, found wrong: bytecode-read `MinecraftServer.g` (initialWorldChunkLoad) runs its 25 x 25 loop for `worldServers[0]` only (level index 0, no increment). The Nether and End load chunks on demand only. main.js already passes `spawn: null` outside the Overworld, so no change was needed there. Executed: 4 `b57so-nether-*` rows (no grid; only the player's chunk and view square load; the mount's chunk loads with it).
- Overworld with nobody logged in: executed `b57so-away-grid` and `b57so-away-far` (grid order only; a chunk outside the grid is not loaded). This is what the away stamp now follows.
- Mob on the player's mount: bytecode-read `Entity.mountEntity` (sa.a(sa)) does not clear the old rider's link, and clears only the new rider's previous mount; `xi.c(yz)` (EntityBoat) refuses a player rider only; `xs.c(yz)` (cart) refuses any other rider; `ahb` entity loop: an entity with `ridingEntity` is skipped only while the mount is alive and `mount.riddenByEntity == entity`, otherwise `mount.riddenByEntity = null; entity.ridingEntity = null` and it ticks. Executed `b57so-stale-cow-in-cart`: the writer saves the cow with the cart nested and skips the ridden cart; the login reads the cow's nested cart and the player's Riding cart, so the cart is in the list twice. Not reachable in the port (it refuses; the boat case clears itself in a pass); the window of one or two passes where the player sits in the taken boat is not modelled.
- Non-mob entities above y 256: executed `b57so-high-kinds`, `-mixed`, `-mount` (item, boat, falling block, primed TNT, arrow, orb, cart at y -20..4000 through the real writer and reader). Every kind is saved and read back; they file in section 15 above y 256 and section 0 below y 0 (list order inside a section). The port's stamp reproduces that order for all kinds including boats and falling blocks (saved the way main.js does). Falling blocks in the away run are not stamped (`away-entities` has no falling system in its saved groups); live saves stamp them.
- Recalled: nothing relied on.

## Verification
- `node tools/verify-saved-order.mjs`: 7 + 13 + 9 + 10 + 10 scenarios; the b52/b53/b54/b56 references regenerate unchanged.
- `node --test src/saved-order-b57.test.js` 14/14.
- `node --test src/away-*.test.js src/dimension-away.test.js src/dimension-live*.test.js src/saved-order*.test.js src/streaming-*.test.js src/mob-riding*.test.js src/vehicle-riders*.test.js src/entities.test.js src/boats*.test.js src/vehicle-sim*.test.js src/flyturn-b51.test.js`: 432 tests, all pass after the vehicle-riders update.
- `npm run build` run once at the end. Full npm test not run (batch rule).

## Follow-ups
- Falling blocks saved by the away run carry no `ord`.
- The one-to-two pass window in which a player sits in a boat taken from a mob is not modelled.
- Chunks the player loaded after the login (by moving) are still ranked by first entity.
