# Batch 78 mphorse78: server horse leftovers

## Summary
- Temper prediction: `predictHorse` (multiplayer/animal-use.js) no longer reads or writes temper. It feeds with the cap assumed (health, growth, love uses only). A wild horse that a feed would use only through temper is left unclaimed, so no item is spent on a guess and the server's answer stands. Before, the copy assumed temper 0 and always ate the item.
- Rider's arrows: `Arrows.damageTarget` (bow.js, one guarded line after the burning-arrow `setFire`, as zc.h) refuses damage from a horse's own rider, so the arrow ricochets. Single player (rider = the shooter) and server (`a.owner.mount.rider === horse.rider`) alike.
- Rejoin in the Nether / End: `ServerDimensions.vehiclesOf(p)` names the dimension's `ServerVehicles`; `addPlayer` calls `horses.rejoin` on it, and the Overworld's `horses.logout` hands a Nether / End rider to that dimension's horses (server-nether-vehicles.js pin). The saved `riding` record is restored in the player's own dimension. `rejoin` no longer skips `saved.dimension`.
- Shutdown: `simulation.shuttingDown` (set by `close()` in server/server.js before sockets are terminated) makes `ServerHorses.logout` save `riding` but leave the horse in the world, the rider let down.
- Tests: `src/mphorse78-b78.test.js` (4).

## Evidence
- Bytecode-read `wi.c()` (EntityHorse.entityInit): watcher ids 16 (flags), 19 (type), 20 (variant), 21 (owner name), 22 (armour). No temper, so the client cannot know it.
- Bytecode-read `wi.a(ro, F)`: `ro.j()` (the damage source's entity) equal to the rider returns false; `rq.j()` (indirect, "arrow") returns the shooter, `rq.i()` the arrow. So a rider's own arrow is refused; EntityArrow then ricochets (existing port branch).
- Bytecode-read `MinecraftServer.stopServer` order: "Saving players" (`oi.j`: writePlayerData for each, `Riding` included, horse still in world), `oi.u` removeAllPlayers (`nh.c("Server closed")`: sends the kick and closes the channel, no `playerLoggedOut`), then "Saving worlds". So native keeps the horse in the saved world AND in `Riding`; the next login remounts a second copy. The port now matches that. Reasoned, not executed: that the netty disconnect never runs `onDisconnect` before the world save.
- Port-read: `ServerVehicles.removePlayer` ran the Overworld instance's `horses.logout` for every player, which finds nothing in a Nether / End horse list.
- Executed: the test replays Nether logout/login through `DedicatedSimulation`.

## Verification
- `node --test src/mphorse78-b78.test.js`: 4 pass. Related tests listed in the final reply.

## Follow-ups
- A shutdown leaves a duplicate horse after the rider's login (native does too); not de-duplicated.
- `client-horse.js` untouched. Single-player temper is unchanged (it is the real value there).
