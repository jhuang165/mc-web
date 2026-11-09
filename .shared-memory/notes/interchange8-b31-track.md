# interchange8 (batch 31): foreign TileTicks, due-time model, mid-tick saves, float getInteger

## Summary
- Native record. The existing `TileTicksProbe` read scenarios (14, executed on the unchanged `AnvilChunkLoader` + `WorldServer`) already carry air, ids 200/999 and y -5/256/300: all are kept in the pending set; an unregistered id becomes air (id 0, scheduledTime 0, written back as `i 0, t -worldTime`). Due-time behaviour is bytecode-read (`mt.a(boolean)`, `ahb.b`): an entry whose cell has y outside 0..255 or sits in an unloaded chunk, or whose block is air or changed, is removed without ticking and not re-added. The batch 30 claim "dropped at due time, radius 0" is right.
- `src/tile-ticks.js`: `importTileTicks` now keeps everything the port cannot run in `out.foreign` (air or unregistered id as `{i:0, air:true}`, y out of range, blocks with no tick handler, ticks in the 2-column low border outside an area via a new `reach` option) instead of dropping them; dedupe key uses the native post-`getBlockById` id. New `ageForeignTicks` (t <= elapsed gone after elapsed >= 1; air written as -now) and `placeForeignTicks` (owned chunks whose box `[c*16-2, c*16+16)` holds the tick).
- Plumbing: record field `foreignTicks` (`world-import.js` RUNTIME_FIELDS + sanitiser, `dimension-live.js` DIM_KEYS, `mergeTickState` envelope, `whole-save-import.js` stamps the level time on every dimension, `region-import.js` passes level time, `reach`, report `ticks.foreign`), exported in `region-export.js regionSource`. No hunk in `main.js`, `scene.js`, `world.js`.
- Mid-tick save: the writer appends ThisTick entries (t <= 0) after the tree entries; the reader merges everything into the TreeSet. Modelled as plain due entries (replay test on the probe's write scenarios, including the ones with ThisTick entries). The port never saves mid tick.
- `intOf` float/double below -2^31 now wraps to MAX_VALUE like `floor_double` (bytecode-read `qh.c`, `qh.d`), not clamped to MIN_VALUE.
- Priority 5 items checked: lead held by another mob and knot leashes are already done (`relinkMobs`, `knotAt`); nothing left to change there. Nether/End TerrainPopulated=false population is neighbors3's.
- `tools/make-synthetic-save.mjs` platform now has a chest tick, an air tick (t -24000) and y 300 / y -3 ticks.

## Verification
- `npm test`: 4838 tests, 0 fail (before the synthetic-save tool edit); `npm run build` passes. `src/tile-ticks.test.js` 14 tests (was 9): full-native-pending replay (port lists + foreign = probe result for all 14 read scenarios), ThisTick replay, aging, placement, area import and export at world time 500 and 503, float getInteger.
- Synthetic round trip (after): TileTicks lost 0 in all dimensions (Overworld 234 of 234 identical, Nether 13, End 13); before this change the air, y 300 and y -3 ticks and the chest ticks were lost. A tick with an unregistered id is written back as air (native).
- No browser check: no UI or in-game behaviour changed (import/export only).

## Follow-ups (proposed gap lines)
- Foreign ticks are kept raw and aged on export, never run or listed in the live world; a played save loses those that came due, a save held unticked keeps them.
- Ticks outside an imported area beyond the 2-column low border are dropped at import (no imported chunk could save them).
- The 1000-entries-per-tick cap of `tickUpdates` is not modelled for the port's own lists.
- Item damage of stone-type variants without a port mapping in horse chests; fluid/fire/falling priority is not stored.
