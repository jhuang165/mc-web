# portals98 (batch 98): ridden mobs and portal travel

## Summary
Not full parity; open items are at the end.
- **Mount after touch (fixed, single player and dedicated server).** Native `sa.C` blocks a trip only when the entity's own `ridingEntity` is set; a rider (`riddenBy`) does not stop the countdown, it only stops BlockPortal / BlockEndPortal from starting one. So a mob that touched the portal and was mounted afterwards travels at the threshold (non-players: the tick after), the rider is unmounted by `World.removeEntity` and stays in the old world, and the copy has no rider link. The port skipped every mob with any link. Now `entity-portal.js mobLinks(e)` gives `{ riding, ridden }`: a riding mob still only counts down; a ridden mob goes through `EntityPortals.step` with `ridden: true` (no collision, countdown and trip as for ridden carts). Before the record is written the rider is let go: a player via `riderSneakOff` (single player, the same dismountEntity let-go as sneak / water) or `ServerVehicles.dismount` (server, new `ServerPortalTravel.unmount`); a mob rider via `mountEntity(rider, null)` (placed on top of the mount). Files: `src/entity-portal.js`, `src/dimension-live.js`, `src/multiplayer/server-portal-travel.js`.
- **Cooldown audit (no change).** Executed: setInPortal under a cooldown rewrites it to 300 then the tick counts down (299); a riding mob's cooldown counts down (5 -> 4) and never travels; the copy carries 300; the End portal ignores ridden and riding entities (batch 37 collide records); carts and boats already follow the ridden / riding / mount-after-touch records (b39, `ridden` flag in the port). Items have no riders. The port's `PortalState` matches.
- Files: also `tools/probes/Portals98Probe.java`, `public/research/portals98-reference.jsonl` (6 records), `src/portals98-b98.test.js`.

## Evidence
- **Executed (Portals98Probe, tools/research/portals98-probe/):** real EntityPig + EntityZombie / EntityPig, real `BlockPortal.onEntityCollidedWithBlock`, real `mountEntity`, real `sa.C`, real `sa.b(I)` on the Portals97Probe world doubles. touch-then-mount: traveled, rider `ridingEntity` null and left in the source world 0.9 above the mount, copy `riddenBy` / `ridingEntity` null, copy cooldown 300. mount-then-touch: `inPortal` stays false, no trip. riding-other: no trip, cooldown 5 -> 4. The dedicated server runs the same WorldServer classes; the single-player integrated server is the same code, so one record set covers both.
- **Bytecode-read:** `sa.C` tests only `sa.m`; `ahb.e` unmounts `l` then `m` (replayed in TW2).
- **Port-read:** the mount / rider fields in `horse-live.js riderSneakOff`, `server-vehicles.js dismount`, `mob-riding.js mountEntity`.

## Verification
- `node --test --test-concurrency=2 src/portals98-b98.test.js`: 7 pass; with `dimension-live.js` and `server-portal-travel.js` reverted: 3 fail (the two trips and the player let-go), 4 pass.
- Regression: 69 test files naming dimension-live, server-portal-travel, entity-portal, away-entities, server-dimensions, portals9x or mob-riding, via `xargs node --test --test-concurrency=2`: 585 pass, 0 fail. No build run (one new import of an existing module).

## Found wrong in the batch 97 list
- "Practically unreachable": it is reachable (mount a pig you just walked into a portal; the mob's countdown ends the next tick), so it is fixed.

## Follow-ups (still open)
- `away-entities.js` still treats any link as riding; an away run cannot mount a mob after a touch, so no difference is reachable there.
- The unmounted mob rider stands in the portal and starts its own countdown (as natively); the single-player player let-go lands via `riderSneakOff` (code-read; the let-go spot itself was executed in b89).
- Browser-only: nothing seen in a browser.
