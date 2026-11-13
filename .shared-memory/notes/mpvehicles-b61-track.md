# Batch 61 mpvehicles: minecarts, boats and riding on the dedicated server

## Summary
- `src/multiplayer/server-vehicles.js` (new): `ServerVehicles`. It reuses the single-player `Minecarts` and `Boats` classes on the server. Wire keys are `c<id>` and `b<id>` because the two id spaces are separate.
  - Placing: a minecart item on a rail goes through `placeHeldMinecart`. A boat item goes through `Boats.place` on the server's own eye ray, also when the block ray misses.
  - Riding: C02-style use mounts (plain cart or boat). A furnace cart takes coal instead. A sneak, death or a broken vehicle dismounts. A boat rider's forward and strafe input steer the boat. The rider is seated each tick, and its own `movePlayer` is skipped.
  - Hits: a hit uses the held weapon's damage. Creative breaks the vehicle with no drop. Survival hits drop the item entities.
  - `spawnVehicle(kind, x, y, z)` is the hook for mpdispense. Kinds: `boat`, `minecart`, `furnace_minecart`, `tnt_minecart`.
  - Save and restore through `save()`. Nobody is aboard after a restart.
  - Sync: per player, vehicles within 80 blocks whose state changed.
- `src/multiplayer/remote-vehicles.js` (new): client copies. They are never-ticked stand-ins made by `Minecarts` and `Boats`, so `MinecartRenderer` and `BoatRenderer` work unchanged. Also holds `pick` for aiming.
- `src/multiplayer/server-achievements.js`: `onMinecart(p)` and `stopRiding(p)` feed `onARail`.
- `src/multiplayer/simulation.js`: short `// b61` hooks. They cover construction, add and remove player, `queueVehicle`, skipping `movePlayer` for a rider, the `veh` action, `vehicles.tick()`, the two `useHeld` calls in `edit`, the presence `riding` field, and `save()`.
- `server/server.js`: routes `vehUse` and `vehHit`, and sends `player.vehPackets`.
- `src/multiplayer/client.js`: `onVehicles` option, `vehicle(v, hit)` sender, and `vehicles` is kept in the message buffer.
- `src/multiplayer/presence.js`: passes `riding` to the remote player body so others see the rider seated.
- `src/main.js`: `// b61` hooks. They cover the `remoteVehicles` copies and renderers, the tick and draw, aiming and clicking a vehicle, and `mpRiding` for the own body.
- `src/mpvehicles-b61.test.js` (new): 10 tests.

New wire messages:
- `vehUse {v}` (client to server): right click on a vehicle.
- `vehHit {v}` (client to server): left click on a vehicle.
- `vehicles {set: [state], del: [keys]}` (server to client).
- Presence field `riding: "<key>"` (only while mounted).
- `PROTOCOL` is not bumped, all of this is additive.

## Evidence
- executed: `src/mpvehicles-b61.test.js` runs the real `DedicatedSimulation`, so the placing, mounting, rail carry, boat steering, hit and drop, diff message, save and restore, and client copies are executed against the single-player classes.
- bytecode-read: `yz.k(DDD)` (EntityPlayer.addMovementStat) in the 1.7.10 jar. A player riding any `xl` (EntityMinecart) whose `round(distance * 100) > 0` adds `distanceByMinecart`. The first riding move stores the floored start cell. `onARail` fires when the squared distance from that cell to the floored position is at least 1000000.0. Boats, pigs and horses add only their own distance. `Achievements.rideMinecart` already matches this.
- recalled: EntityMinecart.attackEntityFrom: a creative player's hit calls setDead with no drop, a survival hit breaks it past damage 40. The 6 block reach to the box centre follows the server handler's rule.

## Verification
- `node --test src/mpvehicles-b61.test.js src/mp*.test.js src/multiplayer*.test.js src/dedicated-beacon.test.js src/serverbroadcast-b58.test.js src/client-*.test.js src/minecarts.test.js src/boats.test.js src/boat-ride-b56.test.js src/aim-copies-b49.test.js`: 296 tests, 296 pass, 0 fail.
- `node --check` on every touched file: ok. Every new identifier in `main.js` (`remoteVehicles`, `aimedRemoteVeh`, `mpRiding`) is declared at module scope.
- `npm run build`: ok.
- Full npm test not run (batch rule).

## Follow-ups
- Chest and hopper carts need container windows. Command block carts are not connected either.
- Detector rails have no block hook.
- Pig riding with a carrot on a stick, and `flyPig`, are not done.
- Mob riders in carts and boats are not connected.
- Third-person seat height, sprint knockback and tool durability on vehicle hits are not done.
- Only a browser could show: the render pose of the copies, the camera while riding, how the seated rider looks to others, and the aim and click feel. None of this was run (no browser checks).
- mpanimals may touch the same handler area in `server/server.js` and `client.js`.
