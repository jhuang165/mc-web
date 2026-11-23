# portals97 (batch 97): mobs through Nether / End portals, leash, riders

## Summary
Not full parity; open items are at the end.
- **End arrival pitch (fixed).** `oi.a(sa, int, mt, mt)` puts an entity bound for the End at (100, 49, 0) with yaw 90 and pitch 0 before `copyDataFrom`, so the copy's saved Rotation pitch is 0. The port kept the source pitch on the mob record. `entity-portal.js endArrival(source, arg)` (End destination, not the End-exit spawn copy) is used by `dimension-live.js deliver` and `multiplayer/server-portal-travel.js arrive` to drop `rotationPitch`. Nether and Overworld trips keep the pitch (Teleporter keeps it); the End exit copy keeps it.
- **Audit, no change needed.** Native `copyDataFrom` = `old.writeToNBT; copy.readFromNBT; timeUntilPortal; teleportDirection`. For 25 real mobs the copy's compound equals the source's (apart from Pos, Motion, Rotation, Dimension, PortalCooldown), including health, absorption, effects, equipment and drop chances, CustomName(+Visible), PersistenceRequired, Fire/Air/FallDistance, hurt/attack times, Age/InLove, villager Offers, horse type/variant/armour/saddle/chest items, wolf/ocelot owner and sitting, sheep colour, creeper, slime, golem, bat, enderman. The port's record (import -> restore -> serializeOne -> drop transient -> restore) reproduces every key for 18 of those (no diff), so no record divergence was found.
- **Leash.** Native keeps the Leash tag (UUID or X/Y/Z) on the copy; the first leashed tick (`sw.bP`) finds the holder in the new world or, for a knot, finds or makes one at the saved X/Y/Z; otherwise the lead drops. The port already does this (b94 portals94, b93 server): player holder dropped as a lead item unless the player is in the destination box; knot and mob holders stay on the record and `leashRestore` decides. Executed: UUID and knot Leash tags survive the copy unchanged.
- **Riders (audit only).** `sa.b(I)` never touches riders; `World.removeEntity` (`ahb.e`) calls `riddenBy.mountEntity(null)` and unmounts the entity's own mount. The copy has no Riding link (`sa.f` does not read it). A rider (ridingEntity != null) never travels (`sa.C`); BlockPortal ignores any entity with a rider or vehicle. So a mob with a rider only travels if it had touched the portal before the rider mounted, and then the rider stays behind unmounted. The port skips ridden mobs entirely (`riding: true`); that differs only in that unreachable window (max portal time for non-players is 0, so the countdown ends the tick after the collision). Not changed.
- Files: `src/entity-portal.js`, `src/dimension-live.js`, `src/multiplayer/server-portal-travel.js`, `src/portals97-b97.test.js` (new), `tools/probes/Portals97Probe.java` (new), `public/research/portals97-reference.json` (new, 84 KB).

## Evidence
- **Executed (Portals97Probe, tools/research/portals97-probe/):** real mobs from `EntityList.createEntityByName` loaded from edited native compounds, sent through the real `Entity.travelToDimension` on the EntityPortalProbe world doubles: 25 mobs, `same` true for all; pitch 33 / -20 gives 33 / -20 for 0>-1, -1>0, 1>1 and 0 for 0>1.
- **Bytecode-read:** `sa.a(sa, boolean)`, `sa.e` (writes Riding of the mount), `sa.f` (no Riding read), `sa.b(I)`, `ahb.e(sa)` (unmounts rider and mount), `oi.a` (90.0f, 0.0f for the End).
- **Port-read:** server `arrive` and single-player `deliver` paths; leash restore.
- Rider split not executed (the world double's removeEntity is replayed in the probe only as the same unmount calls).

## Verification
- `node --test --test-concurrency=2 src/portals97-b97.test.js`: 3 pass; with `dimension-live.js` reverted: 1 fails (the End pitch).
- Regression: 44 test files (dimension-live, every portal/away/awaytracker/server-nether/server-mobs test and every test importing server-portal-travel, entity-portal or dimension-live), `xargs node --test --test-concurrency=2`: 891 pass, 0 fail. No build run (one new export, no new import path).
- `server-portal-travel.js` change is covered by code reading only (no importable server portal test for the pitch).

## Found wrong in the batch 96 list
- Nothing wrong.

## Follow-ups (still open)
- A ridden mob that already counted down in a portal (native: mount travels, rider dropped) is still held back in the port; practically unreachable.
- Browser-only: nothing seen in a browser.
