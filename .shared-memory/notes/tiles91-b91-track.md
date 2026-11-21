# tiles91 (batch 91): chest facing in block metadata, mob light readers

Branch `batch91-tiles91`, worktree `wt91-tiles`. Target is 1.7.10. This does not claim full parity.

## Summary

- **Chest facing is cell metadata** (`chest.js`, `block-registry.js`). New helpers: `chestFacing` (cell meta 2-5, else the record's `facing`, else 3), `writeChestFacing` (silent tracked `world.put` of the metadata plus the record copy; the setBlockMetadataWithNotify flags-2 write native settle/placement make), `migrateChestFacing` (a cell without 2-5 meta takes the record's facing) and `adoptChest` (a chest block saved without tile data takes its cell facing; only a cell with no facing gets `settleFacing`).
  - `settleFacing` and `placeChest` write the cell; the partner test (`facing === 4` / `=== 2`) reads the partner's cell via `chestFacing`.
  - Registry: `chest()` `to` uses the cell meta when 2-5 (then `state.facing`, then 3); `from(54|146, 2-5)` is `{ meta, exact: true }` with no state, other meta is the approximation 3 as before.
  - Readers moved to `chestFacing`: `chest-renderer.js` (also migrates when a chunk's chests are first drawn), `tile-sync.js` (`contChest` description; the replica writes the received facing into its cell too), `multiplayer/server-containers.js` (lids, join snapshot, `ensureChest` migrates or adopts), `main.js` load loop (`adoptChest`).
  - `region-import.js`: the facings map reads the cell meta; the `carried` special case is gone (a chest import is exact with no side state). `hopper-replay.js` keeps a chest's meta in the cell.
  - The record still stores `facing` (kept in sync by `writeChestFacing`) for one release so an older build reads the save; `command-host.blockAt`, `region-export` and `survival.serialize` need no change (they pass the record only as the registry's fallback).
- **Mob light readers** (`main.js`): `entitySub`, set once per tick right after `tickSurvival` (`sensorSky(survival.time, !survival.timeFrozen, rain, thunder).subtracted`, null in other dimensions), read through `entitySubtracted()` by `mobs.lightAt`, `mobs.isDaytime`, `mobs.lightSubtracted`, the ring mob wrap and the mob-spawner tile pass (`lightValue`). Effect: only with the clock frozen (doDaylightCycle off or `/time` frozen); see Found wrong.

## Evidence

- **Bytecode-read** (earlier batches, not re-run): `ajx` (BlockChest) keeps facing in metadata 2-5; `func_149954_e` and `onBlockPlacedBy` write it with `setBlockMetadataWithNotify` flags 2; `WorldServer.tick` (`mt.b`) calculates `skylightSubtracted` from the clock before `+1` and after the weather update, then random ticks, entities and tile entities (b88 tiles88).
- **Port-read:** `lighting.celestialAngle(t)` samples partial 0; `clock.celestialAngle(t, 1)` partial 1. Native at pre-step time T-1 reads (T-1+1)/24000 = the scene's sample at post-step T. So the scene's `subtracted` equals the native entity-pass value while the clock moves; with the clock frozen native is (T+1)/24000 and the scene's T/24000 lags one tick (differs exactly at a darkness step).
- **Executed:** none new.

## Verification

- `node --test --test-concurrency=2 src/tiles91-b91.test.js`: 6/6. Without `chest.js` and `block-registry.js` (stashed) the file fails to import (0 pass, 1 fail).
- One targeted run over 36 files (chest, registry, region import/export, tile-sync, tiles87-91, mpcontainers, bonus-world, chunk-store, command tests, hopper, ring-chests, residency, population): 251/252 on the first run, the one failure was the chunk-store test below, now 8/8. Second run over 12 files that read `scene.subtracted` / mob hooks (bed, ring-*, mob-spawner, redstone-live, weather, tiles88...): 167/167.
- `npm run build`: ok (once). `node --check src/main.js` ok. No browser checks.
- Old tests changed because they encoded the old non-native storage: `block-registry.test.js` round trip allows a chest's stray cell meta to come back as the exported facing (as the furnace since b90); `chunk-store.test.js` legacy migration: a chest at meta 0 with side-state facing 5 now comes back with meta 5 in the cell, a meta-0 trapped chest comes back 3, and the chest no longer returns `{ facing }` as side state.

## Found wrong in the batch 90 list

- "Mob entity updates in single player read `scene.subtracted`, one tick ahead of native at step ticks": wrong while the clock moves. The scene samples partial 0 at post-step time T, native samples partial 1 at pre-step T-1: the same fraction. The lag is the other way and only with a frozen clock (fixed here). The b90 spawner convention (previous tick, `sensorSky` at the pre-step time) is consistent with this.

## Follow-ups

- Random block ticks (trees, farming, fire, `wrapRandomTickLight`) and the sleep checks still read `scene.subtracted`; same one-tick lag with a frozen clock only. Not changed (not mob logic); the native random-tick pass reads the same `skylightSubtracted` as entities.
- `away-entities.js` computes its own `subtracted` from its clock; not compared with this convention.
- The dedicated server keeps its own darkness (b90); its chests still send the record facing in `contChest` as well as the block meta.
- Unloaded or never-redrawn chests keep the old record-only form until their chunk is drawn (single player) or `ensureChest` runs (server); readers fall back to the record, so nothing reads wrong.
- Browser-only: chest facing after loading an old save and after placing against walls and pairs; mob sun burning with `/gamerule doDaylightCycle false` at dusk or dawn.
