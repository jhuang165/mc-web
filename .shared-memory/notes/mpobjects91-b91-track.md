# mpobjects91 (batch 91): server tick order (weather, bolts, maps before the tracker flush), remote boat and cart shadows

## Summary
- **Tick order (`multiplayer/simulation.js`, `multiplayer/server-nether.js`).** `weather.tick(world)` (weather timers, mood, per-chunk lightning roll, ice/snow, the three random block ticks, then the bolts' own update), `lightning.tick()` and `weather.drain()` now run before `dispense.tick()` (the start of the entity pass), not after the tracker flush. The Nether's `weather.tickDimension` + `drain` likewise run before `n.dispense.tick()`. `maps.tick()` (ItemMap.onUpdate, the S34 updates) now runs just before `dispense.flush()` instead of after the settle passes.
  - Kept where they were (deviations, see Follow-ups): `sleep.worldTick()` (the all-asleep skip) and the `spawnDarkness` capture, because `spawnDarkness` is the value the NEXT tick's spawner pass reads and the skip must not change it; `tickWorldSystems` (scheduled updates, hoppers, redstone tail), `pistons.flush`, beacons.
- **Remote boat and cart shadows (`shadows.js`, `main.js`).** New `vehicleShadowCasters(list, spec, partial)`; `shadowCasters` adds the multiplayer client's `remoteVehicles.boats.carts` (SHADOWS.boat) and `remoteVehicles.carts.carts` (SHADOWS.minecart), cast at posY with height 0, as the single-player entries.
- **Remote XP orbs**: nothing to do. `syncMultiplayerOrbs` sets `xpOrbs.orbs` to the remote rows (with `x/y/z`, previous, `posY = y + 0.25`) and `shadowCasters` already walks `xpOrbs.orbs` through `objectViews`, so remote orbs already cast SHADOWS.orb (the b90 "no shadow" item was wrong, see below).

## Evidence
- **Bytecode-read** (`javap -c -p` on `minecraft-1.7.10.jar`):
  - `MinecraftServer.updateTimeLightAndEntities` (the tick method with the "timeSync" / "tick" / "tracker" sections): per world `mt.b()` (WorldServer.tick), then `mt.h()` (WorldServer.updateEntities), then `mt.r().a()` (EntityTracker.updateTrackedEntities).
  - `mt.b()` order: `ahb.b()` (weather, skylight), the sleep check `aib.b`, time, `d()`, "mobSpawner", chunk unload, "tickPending" (`a(Z)`, scheduled tickUpdates), "tickBlocks" (`g()`: lightning roll, ice/snow, random ticks), "chunkMap", "village", "portalForcer", then `Z()` (queued block events).
  - `mt.h()` calls `i()` then `ahb.h()` (updateEntities: weather effects such as bolts, entities, tile entities).
  - `RenderBoat` (`bne`) constructor: `d = 0.5F` (shadowSize), `e` untouched; `RenderMinecart` (`boi`): `d = 0.5F`; `RenderXPOrb` (`bnp`): `d = 0.15F`, `e = 0.75F`. These equal the existing SHADOWS table (b71); the table is unchanged.
- **Port-read:** `remote-vehicles.js` records carry `px/py/pz`, `x`, `posY`, `z` (cartClientStep, boatClientStep, the draw lists `carts.carts` / `boats.carts`); `syncMultiplayerOrbs`; `objectView` returns the plain row for an untracked object.
- **Executed (port, node):** the spy test below records the call order of one server tick.

## Verification
- `node --test --test-concurrency=2 src/mpobjects91-b91.test.js`: 4 pass, 0 fail. With `simulation.js` and `server-nether.js` reverted: 2 fail (tick order, Nether pin).
- Neighbours: 244 files naming `multiplayer/simulation`, `server-nether`, `shadows.js`, `DedicatedSimulation` or `main.js` (`grep -l ... | xargs node --test --test-concurrency=2`): 2317 tests, 2316 pass, 1 fail (`mplightning-b66` mob strike); after the edit below `mplightning-b66.test.js` 7 pass, 0 fail.
- Old test edited: `mplightning-b66.test.js` mob test. A bolt now updates before the mobs, and the test struck mobs that had never updated (port fire 0 -> 1 -> out in their first update). It now ticks once first so the mobs are in the running-world state (fire -1, the strike sets 8). Not a rule change: the strike, damage and fire numbers are untouched; only the fixture's mob age.
- No `npm run build` (one new named export only). No browser checks (track rules). MC_MPPERF verify modes compare the same code off / on / verify, so a native-order change keeps them equal; no recorded hash was edited.

## Found wrong in the batch 90 list
- "Native does random ticks, then tickUpdates" (mpobjects90 note): native `mt.b` runs "tickPending" (scheduled tickUpdates) BEFORE "tickBlocks" (random ticks). The port's scheduled systems (`tickWorldSystems`) still run after both and after the entities.
- "Remote ... XP orbs cast no shadow": they already do (see Summary).

## Follow-ups
- Native order not reached: scheduled tickUpdates (fluids, fire, redstone, falling spawn, farming) and the queued block events should run before the random ticks and before the entity pass; the port's `tickWorldSystems` stays after the entities because it also runs hoppers, brewing, the redstone tile loop and pistons that natively follow the entities. Splitting it is a separate change (shared RNG stream order and many tests).
- `sleep.worldTick` should precede the entity pass; kept after the `spawnDarkness` capture.
- `items.tick` / `serverItems.tickOrbs` / `chunkViews.tick` run before the packet handlers; native runs items and orbs inside updateEntities.
- Browser-only (not looked at): boat and cart copies' shadows on the multiplayer client, remote XP orb shadows.
