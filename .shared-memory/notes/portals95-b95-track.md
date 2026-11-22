# portals95 (batch 95): real-load reset of mob transients and item pickup delay; minecart subtype NBT audit

## Summary
Not full parity; open items are at the end.
- **Real load vs in-session rebuild.** `EntityWorld` takes a 5th constructor argument `{ reload }` (default false) that is passed to `restore(e, { resetTransient: reload })` for the saved list. `main.js launch` sets `realLoad = !tripArrival` (a world open from the title screen is not a portal trip; trips carry `tripArrival`), so page load / world open resets the port-only transients (`TRANSIENT_MOB`), while portal trips, away runs and dimension switches keep them (awaytracker-b60 untouched). The dedicated server builds `ServerMobs` once from the saved world at start, so it passes `reload: Array.isArray(saved)`.
- **Item load.** `ItemEntities.load(records, read, time, { reload })`: on a real load the pickup delay is 0 and the saved hover is ignored (random, as `new xk(world)`); otherwise both are read as before. `main.js` passes `realLoad`; `server-items.js` and the server Nether pass `reload: true` (server start). The portal-arrival `arriveLive`/`server-portal-travel` item loads are unchanged.
- **Minecarts.** `Minecarts.fromJSON` dropped `customDisplay / displayTile / displayData / displayOffset` that `serializeOne` writes (so a custom display tile was lost on reload and across a portal); now passed to `initVariant`. A furnace cart's `Fuel` was clamped to >= 0; it is a short read as is (negative stays, `c > 0` is the only test, coal adds 3600 to it): `cart-variants.js initVariant` and `region-import.js` no longer clamp.
- Files: `src/entities.js`, `src/main.js`, `src/item-entities.js`, `src/minecarts.js`, `src/cart-variants.js`, `src/region-import.js`, `src/multiplayer/server-mobs.js`, `server-items.js`, `server-nether.js`, `src/portals95-b95.test.js` (new).

## Evidence
- **Bytecode-read:** `xk.a(dh)` (EntityItem.readEntityFromNBT) reads Health, Age, Owner, Thrower, Item only; no PickupDelay in 1.7.10 (that key is 1.8). `xk(ahb)` leaves `b` (delay) at 0 and sets hover `c` random. So a reload natively gives delay 0 (the batch 94 follow-up was right). `xl.a/b` (CustomDisplayTile, DisplayTile, DisplayData, DisplayOffset, CustomName), `xp` (Slot, Items), `xq` (PushX, PushZ, Fuel short, no clamp), `xv` (TNTFuse, written always, read when present), `xr` (TransferCooldown, read unconditionally; no Enabled key), `xn` (agp.a/b), `xt` (agq.a/b).
- **Port-read:** which launches are trips (`tripArrival`), that `ServerMobs` / `ServerItems` / `buildNetherInside` are built only at server start.
- **Not Executed:** no new probe; field lists are from bytecode.

## Verification
- `node --test --test-concurrency=2 src/portals95-b95.test.js`: 3 pass; with the four source files (entities, item-entities, minecarts, cart-variants) reverted: 3 fail.
- Regression: 403 test files (every test naming dimension-live, mob-transient, away-, awaytracker, summon, item-entities, minecarts, cart-variants, server-mobs/items/nether, region-import, DedicatedSimulation), `xargs node --test --test-concurrency=2`: 4211 pass, 0 fail. No build run (no new import).

## Found wrong in the batch 94 list
- Nothing wrong; the "item load() reads the saved delay" follow-up was confirmed native-different and is fixed for real loads.

## Follow-ups (still open)
- Hopper cart `TransferCooldown` missing from a hand-written /summon tag: native reads 0, the port keeps -1 (both are <= 0 so the first tick behaves the same); left.
- The dedicated server's own cart records (server-nether-vehicles) were not checked for custom display tile.
- Browser-only: that a title-screen world open resets mobs while a portal trip keeps them (only the `tripArrival` branch is read, not run in the game).
