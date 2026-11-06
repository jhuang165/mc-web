# Non-player entities in portals (1.7.10)

Native evidence: `tools/probes/EntityPortalProbe.java` (run by `tools/verify-entity-portal.mjs`, needs a JDK and `MC_RESEARCH`) drives the unchanged 1.7.10 `Entity.onEntityUpdate`, `setInPortal`, `travelToDimension`, `BlockPortal` / `BlockEndPortal` collisions, `ServerConfigurationManager.transferEntityToWorld` and the entity NBT. Output: `entity-portal-reference.json` (83 records: 10 traces, 8 collisions, 30 transfers, 30 travels, 5 NBT). `src/entity-portal.test.js` replays it. Not full parity.

## What the original does

- The portal part of `Entity.onEntityUpdate` runs only on the server, and only while the server allows the Nether. `inPortal` is set by the Nether portal block's collision (only when the entity has no rider and no vehicle). Each tick: if `inPortal`, a rider-less entity counts `portalCounter` up to `getMaxInPortalTime()`, then sets `timeUntilPortal = getPortalCooldown()` and calls `travelToDimension(dimension == -1 ? 0 : -1)`; otherwise the counter falls 4 per tick. `timeUntilPortal` falls 1 per tick. While it is above 0, `setInPortal` only resets it to the cooldown.
- A plain `Entity` has max in-portal time 0 and cooldown 300, so a mob, item or orb travels on the tick after the collision. A Survival player needs 80 ticks (cooldown 10); a Creative player travels at once.
- The End portal block calls `travelToDimension(1)` on collision at once: no counter, no cooldown test, no cooldown written. From the End the argument 1 means the exit to the Overworld spawn.
- `travelToDimension` removes the entity, moves the old object through `transferEntityToWorld` (x/8 or x*8, then the Teleporter; the End uses (100, 50, 0), yaw 90, motion 0 and the 5x5 platform), then builds a copy from the entity's NBT (rotationYaw % 360, `PortalCooldown` and the teleport direction copied) and spawns it. Leaving the End uses the world spawn, `getHeightValue`, and keeps yaw, pitch and motion; no Teleporter runs.
- `PortalCooldown` is saved as an int; `portalCounter` is not. The probe's write/read/copy round trip is exact for 0, 1, 10, 299, 300.
- A leashed mob that travels loses its holder (the holder UUID is not in the new world): a lead item drops there. Tamed wolves use `EntityAIFollowOwner` against their owner in the same world, so they never follow the player; the browser also unloads the old dimension.

## How the port does it

- `src/entity-portal.js`: `EntityPortals.step` runs once per physics tick after the mob/item/orb simulation, in the original order (portal update first, then the collision of the same tick). `placeAfterTravel` is the pure arrival: `transferTarget` + the existing Teleporter, or the End exit to the spawn column.
- `DimensionLive.tickEntities` (called from `main.js` after `tickLivingSimulation`) removes the traveller from the live list and queues its arrival. Only one dimension is loaded, so the arrival is computed against a read-only peek of the target (terrain generator + that dimension's saved edits, one Teleporter per target kept while the player stays put) and stored in `root.portalArrivals[targetDimension]` = saved entities, drops, orbs and the blocks the Teleporter built (portal frames, End platform).
- When that dimension is next opened, `applyWrites` merges the inbox into the record's `entities` / `drops` / `xpOrbs` and applies the blocks; `storedRecord` clears the inbox once the view is stored. The player's own arrival peek sees pending blocks. `travel()` waits for flights in progress before saving.
- Mobs keep `portalCooldown` (300 after a Nether portal) in their record, and arrive with the Teleporter's motion (`portalMotion`). Items and orbs save the cooldown too, so an arrival inside a portal does not bounce back.
- Skipped: mobs with a rider or vehicle, dead mobs, `ender_dragon`, `ender_crystal`, entities outside the ticking area.

## Gaps

- Boats, minecarts, arrows and other projectiles, falling blocks, TNT, paintings, and anything not a mob/item/orb do not use portals.
- A traveller is lost if the page closes before its asynchronous arrival finishes (a few hundred ms), and unloaded dimensions are not simulated: a mob waits in the inbox until the player goes there.
- The original has one persistent Teleporter Random per world; each target peek here seeds a new one, as the player path already does.
- Overworld arrival height and portal search use terrain only (no population, structures or unsaved columns); the finite Overworld is approximated.
- The Java-side export of `PortalCooldown` is unverified. `main.js` still drops saved Overworld entities in a world without saved population, which would drop arrivals into it.
