# portals96 (batch 96): dedicated server cart records, hopper cart TransferCooldown, server item / orb / boat records

## Summary
Not full parity; open items are at the end.
- **Hopper cart TransferCooldown (fixed).** `cart-summon.js summonCart` now sets `cooldown` = the tag's TransferCooldown, or 0 when absent (also a tagless /summon); `region-import.js cartFromNbt` the same. A fresh cart (dispenser, item) keeps the constructor's -1. This covers /summon on both single player and the server (`server-summon.js` uses `cartTypeOfSummon` / `summonCart`).
- **Server cart custom display on the wire (fixed).** The server's save and portal records already carry the display (`variantJSON`, `Minecarts.fromJSON`, batch 95), but `vehicleState` (the `vehicles` message) never sent watchers 20-22, so a client copy always drew the type's own block. `server-vehicles.js vehicleState` adds `dr` (raw watcher 20) and `dof` (offset) when the cart has a custom display; `remote-vehicles.js` applies them (`dispRaw`, `dispOffset`, `dispOn`) on the copy.
- **Audit, no change needed.** Server carts use `Minecarts.fromJSON` / `serializeOne` for the restart (ServerVehicles constructor, Nether and End via `buildNetherVehicles`) and for portal arrival (`server-portal-travel.js arrive`), so chest / hopper items, hopper cooldown, TNT fuse, spawner and command data, furnace Fuel and push, custom display and CustomName follow the batch 95 single-player fixes. Server items: restart loads with `reload: true` (Overworld, Nether, End), portal arrival loads a record without delay / hover (age, health, thrower, owner kept). Orbs: Age, Health (&255), Value, Fire, motion, UUID kept; colour, target and bb not saved. Boats: Entity fields only. All consistent with native.
- Files: `src/cart-summon.js`, `src/region-import.js`, `src/multiplayer/server-vehicles.js`, `src/multiplayer/remote-vehicles.js`, `src/portals96-b96.test.js` (new).

## Evidence
- **Bytecode-read (batch 95, xr.a(dh)):** TransferCooldown is read with getInteger unconditionally, so absent = 0; CommandSummon builds entities through createEntityFromNBT (readEntityFromNBT runs even with no data tag). xl.a/b: CustomDisplayTile, DisplayTile, DisplayData, DisplayOffset; DataWatcher 20-22 go to the client.
- **Port-read:** which module each server path uses (listed above); that `vehicleState` lacked the display fields.
- **Not Executed:** no new probe.

## Verification
- `node --test --test-concurrency=2 src/portals96-b96.test.js`: 3 pass; with the four source files reverted: 3 fail.
- Regression: 362 test files (names matching server-portal, server-vehicles, remote-vehicles, cart-summon, region-import, summon, dimension-live, server-nether, DedicatedSimulation, cart-variants, minecarts), `xargs node --test --test-concurrency=2`: 3814 pass, 0 fail.
- No build run (no new import).

## Found wrong in the batch 95 list
- "The dedicated server's own cart records were not checked": the records themselves were already right (same `Minecarts` code); the real gap was the client wire state, fixed here.

## Follow-ups (still open)
- Browser-only: that the remote copy actually draws the custom block (the renderer reads `cart.display` from `vehicleViews`; the multiplayer client path from `remote.carts` into it was code-read, not run).
- Nothing found wrong in server item / orb / boat records; a Nether / End first built mid-session from no saved data has nothing to reload.
- The `ids` of portal-arriving orbs come from the module counter (`new ExperienceOrbs([rec])`), as before; not shown to collide.
