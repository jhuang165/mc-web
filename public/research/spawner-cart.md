# Spawner minecart (MinecartSpawner)

Evidence: `tools/probes/SpawnerCartProbe.java` run by `tools/verify-spawner-cart.mjs` against the 1.7.10 jar (xt = EntityMinecartMobSpawner, xu = its logic, agq = MobSpawnerBaseLogic, agr = WeightedRandomMinecart). Output: `spawner-cart-reference.json` (14 NBT cases, 11 scenarios, 1666 ticks).

## Verified against bytecode
- Cart type 4, entity id `MinecartSpawner`, display block mob_spawner (52), offset 6, no item; breaking drops a plain minecart.
- NBT: EntityId (absent reads as ""), Delay (absent 0); MinSpawnDelay gates MaxSpawnDelay and SpawnCount; MaxNearbyEntities gates RequiredPlayerRange; SpawnData becomes an entry with Weight 1 and Type = EntityId; SpawnPotentials entries read Weight 0 when absent; entry type `Minecart` is remapped by Properties.Type 0/1/2 (Rideable/Chest/Furnace), other values stay `Minecart`.
- Timing and rules: the logic ticks after the cart's own tick at floor(cart position), re-read every tick; spawn attempts, RNG calls, aux 2004 and the entity event fire at the floored position; SpawnData Properties (including Pos) are applied after the canSpawn check at the rolled position, yaw kept.
- Client: rotation, previous rotation and particles match the probe.
- `/summon MinecartSpawner {..}` without EntityId gives EntityId "" and Delay 0 (tag read), without a tag the constructor defaults (Pig, 20).
- CommandSummon: createEntityFromNBT, set location, spawn, then mountEntity in the Riding loop; a null mount ends the loop; Mob/Monster are abstract and fail.
- Renderer (boj): block then the spawner display entity with absolute world coordinates inside the scaled cart frame; implemented in `src/cart-spawner-display.js`.

## Approximate or gaps
- The spinning mob matrix and model are visual, not compared with native screenshots.
- Java region import carries every cart type since batch 13, the spawner cart through the block spawner reader ([level-dat](level-dat.md)); checked by an export→import round trip. Block spawner SpawnData/SpawnPotentials import and export work.
- SpawnData `Riding` chains inside spawners (block spawners and the cart) run in `src/spawner-riding.js`: `MobSpawnerBaseLogic.a(sa)`'s loop creates each `Riding` entity with `EntityList.createEntityFromNBT`, places it at the rider's x/y/z/yaw/pitch (a cart or boat mount also at the rider's y plus its own y offset), spawns it and calls `mountEntity`. An id `createEntityFromNBT` cannot make ends the chain (native sets the mount null); a later makeable id then dereferences null, which is a native `NullPointerException` (reported as `out.crashed`, the port does not throw). Mobs, boats and every cart type can be mounts (`EntityWorld.spawnerMount`, `structure-simulation.js spawnerVehicle`). `tools/probes/SpawnDataProbe.java` and `tools/verify-spawn-data.mjs` write [spawn-data-reference.json](spawn-data-reference.json) from the unchanged `MobSpawnerBaseLogic`/`EntityMinecartMobSpawner` (14 scenarios, 139 ticks: spider jockey, three-chain, unknown/missing ids, `Riding` that is not a compound, zombie on a cart, skeleton on a boat, mob on a chest cart, SpawnPotentials entries with `Riding`, counts) and `src/spawn-data.test.js` replays World.rand calls, state, delay, positions, angles and rides/ridden links tick by tick. The probe's world double returns no colliding entities, so the replay marks spawned mobs dead for the port's own spawn-blocking check (documented in the test). `/setblock ... mob_spawner {SpawnData:...}` reads the same keys into the live spawner (`command-host.js`); region export/import keeps nested `Riding` compounds (round trip tested).
- A zero total potential weight throws natively; the port keeps the existing SpawnData.
- Painting, ItemFrame and LeashKnot are not summonable. The Zombie `onSpawnWithEgg` path of SpawnPotentials was probed only with `Delay -1` (the probe double has no chunk for it); that part is bytecode-read, not replayed.
- A spawner mount only spawns when the world has room under the 40-mob cap `EntityWorld.spawnerMount` keeps; a refused mount ends the chain like a null `createEntityFromNBT`.
- The cart as extra collision for spawn checks is a port-side behaviour.
