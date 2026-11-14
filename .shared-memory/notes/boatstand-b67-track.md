# Batch 67 boatstand: players and mobs stand on boats on the dedicated server

## Summary
- Single player was already done (batch 57 era): `main.js` installs `boatBoxProvider` through `setEntityBoxes`, so the player and mobs stand on and bump into boats and walk through carts (`boats.test.js` replays the executed `collide` records). The "cannot stand on boats" line in `entity-parity-catalogue.md` is stale for single player (the lead may edit it; I did not).
- The dedicated server had no provider: a server player or mob fell through boats. Fixed.
- `src/entities.js`: new `setWorldEntityBoxes(fn)`, a second provider called as `(box, mover, world)` in `collisionBoxes`, separate from `setEntityBoxes` and from `setMovingBoxes` (pistons4 merges beside it).
- `src/entity-collision.js`: `registerBoatWorld(world, boats)` and `worldBoatBoxes`; boats are found by the world the mover walks in, so the Overworld, Nether and End each use their own boats.
- `src/multiplayer/server-vehicles.js`: the constructor registers its world's boats and installs the provider (one import line each, one hook line).
- `src/boatstand-b67.test.js`: 11 tests.

## Evidence
- Executed: `public/research/boat-reference.json` `collide` records (BoatProbe on the unchanged `xi`/`xm` classes: stand on a boat, walk into its side on x and z, step, raised boat, rise from below, edge walk-off, fall and walk through a minecart). The new test replays all 9 through a `ServerVehicles` world with `moveEntity`. No new probe was written: these records already are the player box against a boat and a cart; a mob uses the same `moveEntity` path.
- Bytecode-read (earlier batches): `ahb.a(sa, azt)` adds `other.getBoundingBox()` then the mover's `getCollisionBox(other)`; `EntityBoat.getBoundingBox` returns its box, `EntityMinecart`'s returns null. `Entity.getCollisionBox` is null for players and mobs, so the cart/boat `getCollisionBox` rules only decide for a vehicle mover (already in `Boats`/`Minecarts` through the entity list `ServerVehicles.afterRiders` passes).
- Recalled: nothing.

## Verification
- `node --test src/boatstand-b67.test.js` 11 pass. One at a time: boats 92, minecarts 6, mpvehicles-b61 10, mpvehicles3-b63 13, player-physics 9, vehicle-simulation 45, mobpush-b46 23, boat-collide-b57 31, away-vehicles 4; all pass. `node --check` on touched files ok; `npm run build` ok. Full npm test not run (batch rule). Not browser-checked.

## Follow-ups
- A boat that moves under a standing entity does not carry it (native does not either, except by pushes); not probed on the server.
- Only a browser would show a remote player standing on a boat as seen by another client (the copy is the client's own movement).
- Server mobs: the shared `moveEntity` path is used, but no test drives a server mob into a server boat; the executed records cover the box rule.
