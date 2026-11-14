# Batch 65 mpspawners2: server spawners finished (client effects, Riding chains, spawner minecarts, delay sync)

## Summary
- `src/multiplayer/server-spawners.js`: `tickSpawners` now takes the dimension's `vehicles` (ServerVehicles). It runs each spawner with its own context: `createMob` refuses a kind outside `SUPPORTED` and now also a SpawnData `Riding` chain with a mob mount outside `SUPPORTED` (`chainSupported`; the rolls are spent, nothing spawns). A Riding minecart or boat is made in the dimension's `vehicles` (`spawnVehicle`, reusing `spawnerVehicle`). Spawner minecarts (type 4) tick here too (`liveCartSpawners`), and carts and boats block spawns. The hooks collect effects: `spawnParticles` (aux 2004), `blockEvent` (event 1, or a cart's status 1) and `explosionParticles` (status 20); `sendSpawnerFx` queues them on `p.dispOut` as `dispFx` events.
- `src/multiplayer/client-dispense.js`: three new `dispFx` event kinds (no new top-level message type, so `client.js` routing is untouched): `spawnerBurst {x,y,z}`, `spawnerDelay {x,y,z,v?}` (`v` = 'c<id>' for a cart), `spawnerPuff {x,y,z,w,h}`.
- `src/multiplayer/client-spawners.js` (new): `applySpawnerDelay` (agq.b(1): the copy's delay becomes minSpawnDelay) for a block spawner or a remote cart copy.
- `src/main.js` (small): three hooks in `makeRemoteDispense`; the multiplayer branch of `movementTick` now calls `tickSpawnersClient` (smoke, flame and the display mob's spin, over the described spawners and `remoteVehicles.carts`); the render pass draws the display mob of the server's spawner carts. Before this, `tickSurvival` (where the client branch lived) never ran over a connection, so no smoke, flame or spin appeared at all.
- `simulation.js`, `server-nether.js`: one `vehicles:` argument each on the `tickSpawners` call (the End uses the Nether's code).
- Wire: `dispFx` events `spawnerBurst`, `spawnerDelay`, `spawnerPuff` only.

## Evidence
- Bytecode-read (`javap -c -p`, jar SHA1 e80d9b3b): `agq.g` client branch (ahb.E true) draws smoke and flame and the server branch is the rest; `agq.j` ends with `a(1)`; `agq.b(int)` sets `b = g` (delay = minSpawnDelay) only when id is 1 and the world is remote, so the listed "block event 1 with the delay" is wrong: no delay value travels. `apk.a(int)` = `world.addBlockEvent(x,y,z,mob_spawner,id,0)`; `mt.c(IIILaji;II)` sends it with `sendToAllNear(..., 64.0, dim)`. `mp.a(yz,IIIII)` (WorldManager.playAuxSFX) = `sendToAllNearExcept(player, x,y,z, 64.0, dim, S28(id,x,y,z,data))`; `oi.a(yz,DDDDILft;)` tests same dimension and strict `dx*dx+dy*dy+dz*dz < range*range`.
- Bytecode-read: `xt` (EntityMinecartMobSpawner) has no data watcher; `xu.a(int)` is `world.setEntityState(cart, (byte)id)`, `xt.a(byte)` calls `agq.b(int)`. So the client never learns a spawner cart's EntityId: a native client copy shows a Pig. The port matches that (the copy has the default Pig).
- Reused executed rules: `updateSpawner`, the Riding loop (`spawner-riding.js`, spawn-data-reference.json), `summonCart` type 4.
- Recalled: the S19 status goes to the cart's trackers (the port uses the 80-block horizontal tracker range of `server-vehicles.js`); entity status 20 goes to the mob's trackers (the port sends it within 64 blocks).
- Executed in node tests: `src/mpspawners2-b65.test.js` (a control run with `villager` added to `SUPPORTED` spawned 12 mobs, so the refusal test is real).

## Verification
- `node --test src/mpspawners2-b65.test.js`: 9 pass, 0 fail.
- One at a time: `mpnether3-b63` 9 pass; `mob-spawner` 26, `spawner-cart` 33, `spawner-replay2` 8, `spawner-replay3` 8, `mob-spawner-block` 4, `tile-sync` 4, `mpdispense-b61` 15, `mpvehicles-b61` 10: all pass, 0 fail.
- `node --check` on `main.js`, every `src/multiplayer/*.js` and the new test: clean. Identifiers read by the `main.js` hooks (`spawners`, `remoteVehicles`, `burst`, `spawnerBurst`, `cartSpawnerDisplayEntity`, `tickSpawnersClient`, `scene`, `position`, `PHYSICS`) are module-level imports or lets, or in scope of the existing neighbouring lines.
- `npm run build`: ok (6.64s).
- Full npm test not run (batch rule). No browser check (batch rule).

## Follow-ups
- Only a browser would show the smoke and flame, the spin and the burst; the hooks in `main.js` have no test of their own.
- `/summon` of a spawner minecart is not available on the dedicated server (no server `/summon`); carts arrive through a Riding chain or saved world data only. Spawner minecarts keep their 1.7.10 Pig display on clients.
- The mob's own status-20 puff and the 2004 burst are sent at the tick of the spawn; a client that has not yet received the mob copy still draws them (same as native, where they are separate packets).
- Spawner effect events are capped at 64 per player per tick.
