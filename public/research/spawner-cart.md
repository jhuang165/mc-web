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
- SpawnData `Riding` chains inside spawners are handled natively but not ported.
- A zero total potential weight throws natively; the port keeps the existing SpawnData.
- Mobs cannot ride carts or boats, so such a Riding pair spawns separately. Painting, ItemFrame and LeashKnot are not summonable.
- The cart as extra collision for spawn checks is a port-side behaviour.
