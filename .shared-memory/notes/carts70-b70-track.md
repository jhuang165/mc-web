# Batch 70 carts70: hoppers and cart inventories, client cart interpolation

## Summary
- `src/cart-inventory.js` (new): entity half of `TileEntityHopper.func_145893_b`. `cartInventoryAt(carts, x, y, z, pick)` returns an inventory adapter over a chest (type 1) or hopper (type 5) cart whose box strictly overlaps the cell; several carts: `pick(n)` (World.rand.nextInt). Slots with unmapped items refuse insertion.
- `src/inventory-transfer.js`: `containerAt` falls back to `host.cartAt(x, y, z)` when the cell has no inventory tile, and also after a chest closed from above (native `ajx.m` null then runs the entity search). Two lines.
- Hosts: `src/main.js` (`hopperTiles` gets `cartAt`, one import line), `src/multiplayer/server-container-ticks.js` (`cartAt` over `sim.vehicles.carts.carts`; the Nether and End use the same class with the swapped `sim.vehicles`). Hoppers, droppers (`containerAt`) and the hopper cart's own pull all use it.
- `src/multiplayer/remote-vehicles.js`: carts only. `cartSetPositionAndRotation2` stores the target and `turn = 3 + 2`; `cartClientStep` is the client `EntityMinecart.onUpdate` branch. The newest server state is taken at most every 3 client ticks (tracker interval). Boats and everything else still snap.
- Tests: `src/carts-b70.test.js` (9 tests). Probe `tools/probes/CartsB70Probe.java`, driver `tools/verify-carts-b70.mjs`, record `public/research/carts-b70-reference.json`. Doc lines updated in `public/research/minecarts.md`.

## Evidence
- Executed: `api.b(world, x, y, z)` with no tile entity: 11 cases (hopper and chest carts found; rideable and furnace carts, dead carts and the cells above and below not; an edge-straddling box found; two carts pick by `Random(2).nextInt(2)`). Executed: `xl.a(DDDFFI)V` then `xl.h()` on a client world (`ahb.E` true), three packets and a yaw wrap, position and rotation per tick.
- Bytecode-read: the selector `sm` is `instanceof IInventory && isEntityAlive`; the search runs on a null tile or on a chest whose `ajx.m` is null. `NetHandlerPlayClient` (`bjb`) passes increments 3 in both entity move/teleport handlers, so turnProgress is 5 (the brief's "+5" is 3 + 2). The client branch does not touch prev position; the world sets lastTickPos before each update.
- Recalled: the tracker interval 3 for minecarts (`EntityTracker.addEntityToTracker(EntityMinecart, 80, 3, true)`). Not bytecode-checked here.

## Verification
- `node --test src/carts-b70.test.js`: 9 pass. Related 21 files (hopper, carts, ring hoppers, dispense, container residency, mp vehicles, tracker): 167 pass, 0 fail. `node --check` on main.js, inventory-transfer.js, server-container-ticks.js.
- Full npm test not run (batch rule). No browser checks.

## Follow-ups
- Away-world (headless ring and away runs) hoppers have no `cartAt` yet: carts there are not found by block hoppers.
- The server sends a cart state every tick when it changes; the client throttles to every 3 ticks. A native-cadence server send would be closer. Only a browser would show the smoothness and any rider camera effect.
- Comparator signals from a hopper pushing into a cart come from the cart system's own query, not `changed`.
