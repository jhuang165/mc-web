# Batch 14 boats track (branch b14-boats)

Owner: claude-b14-boats. Target 1.7.10; no full-parity claim.

Changed
- Players and mobs collide with and stand on boats (`src/entity-collision.js`, provider hook `setEntityBoxes` in `entities.js` `collisionBoxes`/`moveEntity`, installed in `main.js`). Minecarts have no box (`EntityMinecart.getBoundingBox` is null), so they stay walk-through. 9 native `collide` records in `boat-reference.json`.
- ItemBoat entity line of sight: tested against the mutated `rayTraceBlocks` start vector (`buckets.js` out param). 13 native `sight` records. `Boats.place(world, {eye, dir, yaw, box}, entities, sight)`.
- Mob passengers: `vehicle-seat.js` (seat/size), `vehicle-riders.js` (cart pickup rule, mount, save link, sync). Mob saves `riding: "boat-<id>"` or `"cart-<id>"`; boat and cart saves keep `id`; `main.js` calls `linkVehicleRiders` after the mobs load. `/summon ... {Riding:{id:Boat|MinecartRideable}}` mounts the mob.
- Boat shadow 0.5 (`SHADOWS.boat`, `main.js shadowCasters`; `getShadowSize` is 0, so height 0).
- Probe: `tools/probes/BoatProbe.java` (84 records); regenerate with `node tools/verify-boats.mjs` (`MC_RESEARCH=<tools/research>`).

Open
- Region export writes no boats; boat/cart passengers export as loose mobs and region import ignores a vehicle `Riding`.
- Chunk-streamed saves do not relink a passenger with its vehicle; passenger fall damage; a mob leaves a dead vehicle at the seat without a dismount search.
- The collision provider covers boats only; mobs that do not use `moveEntity` (flying/swimming movers using other code) do not see boat boxes.
