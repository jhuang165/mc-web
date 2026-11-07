# Batch 15 interchange track (claude-b15-interchange)

Branch `b15-interchange` (worktree `b15/interchange`, based on main 01887b4).

## Done
- Region export writes `Boat` and nests a ridden boat or cart as its rider's `Riding` compound (a ridden vehicle is not a chunk entity: `Entity.writeToNBTOptional` is `sa.d`, riddenByEntity check). `region-export.js`: carts and boats go through the existing `built` Riding nesting.
- Region import reads `Boat` (free or as a mount) and vehicle mounts in `Riding` chains (`boatFromNbt`, `importVehicle` in `region-import.js`); riders get `riding: "boat-<id>"` / `"cart-<id>"` with ids from 1000000.
- Probes: `tools/probes/RidingNbtProbe.java` (4 chains) and `VillagerNbtProbe.java` (3 villagers, real MerchantRecipe objects), `tools/verify-riding-nbt.mjs` -> `public/research/riding-nbt-reference.json`; replay in `src/riding-nbt.test.js` (5 tests).
- Found already done and now verified/documented: fireballs and thrown potions in browser saves and region export/import (the gap text was stale); villager import with Offers (the doc said it did not exist); chunk-streamed relink works because `joinRuntime` rejoins all columns before `linkVehicleRiders` (tested).

## Remaining
- The player's own boat/cart (`rider: true`) still exports as a loose vehicle, not the player's `Riding`; level.dat player import does not read `Riding`.
- Entity `UUIDMost`/`UUIDLeast` are not written for any entity.
- SpawnData `Riding` chains for spawner carts.
- Ids for imported vehicles are only set when they carry a rider; a whole-save importer merging several areas must keep the 1000000+ ids unique.
