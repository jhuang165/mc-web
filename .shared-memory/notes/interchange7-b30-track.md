# interchange7 (batch 30): TileTicks probe, comparator signal, horse chest items, unusable Leash

## Summary
- TileTicks native probe (`tools/probes/TileTicksProbe.java`, `tools/verify-tile-ticks.mjs`, `public/research/tile-ticks-reference.json`, 24 scenarios): unchanged `AnvilChunkLoader` read and write on a real `WorldServer`. `src/tile-ticks.js` now tree-orders by time, priority, load order (`treeOrder`), reads ints with getInteger semantics (`intOf`), and shares `tileTickRows` with the exporter.
- Real bug found: the native writer box is `[c*16-2, c*16+16)`; batch 29 had +18. Fixed in `spreadTicks`, region-export and tests.
- Comparator `OutputSignal`: imported (`Comparator` tile, int, getInteger) into the live redstone `comparators`, merged across chunks, restored and exported for blocks 149/150 (`region-export.js`, `region-import.js`, `tile-ticks.js`).
- Ticks outside a 1x1 chunk box: native drops a tick whose own chunk is unloaded at its due time (bytecode-read, radius 0 in `mt.a`). The port's import-time drop matches that; only the not-yet-due period differs. Tallied as `outsideArea`.
- Horse chest Items (`HorseItemsProbe`, `horse-items-nbt-reference.json`): counts 0 and negative kept, above 64 lowered to 64, unknown id clears the slot, slots only 2..size-1, negative Damage reads 0. `java-mobs.js horseNbtFields`, `horse-gear.js cleanItems`, `itemStackFromNbt` match.
- Unticked unusable Leash tag: `gearNbtFields` keeps the original tag as `leash.raw` (base64 NBT wrapper); `gearFieldsFrom` keeps it; export writes it back instead of the player UUID. Once `leashRestore` drops the lead, the record has no leash, as natively.
- Priority: only repeaters and comparators schedule with a priority (full jar scan); fluid, fire, falling always 0. Observable only in foreign saves; kept for load ordering only, exported as 0.
- No hunks in `main.js`, `scene.js`, `entities.js`. One small hunk in `horse-gear-live.js` (`gearFieldsFrom` keeps `raw`).

## Verification
- `npm test`: 4785 tests, all pass; `npm run build` passes.
- New tests: `tile-ticks.test.js` (9), `horse-items-nbt.test.js` (2), `leash-raw.test.js` (2); `leads2.test.js` adjusted for the extra `raw` key.
- Synthetic round trip, before (5f9862e) and after: TileTicks identical, Overworld 162/162, Nether 9/9, End 9/9 in both; only the order of sample "added" lists differs. Import ms 13494 before, 16187 after (load noise). The synthetic save has no comparators; that path is covered by the unit test only.
- Evidence is bytecode-read plus unchanged-class probes (`TileTicksProbe`, `HorseItemsProbe`).

## Follow-ups
- Proposed gap lines for remaining-gaps.md:
  - Ticks on air, unknown ids or y outside 0..255 are not kept (native keeps and rewrites them).
  - Fluid, fire and falling tick priority is not stored; order between kinds at the same time and priority is not kept (separate lists).
  - A save taken mid tick (ThisTick list) is not modelled.
  - Item damage of stone-type variants without a port mapping is not preserved in horse chests.
  - `intOf` for a float or double below -2^31 is not probed.
  - Ticks outside a 1x1 chunk box are dropped at import instead of at the due time.
