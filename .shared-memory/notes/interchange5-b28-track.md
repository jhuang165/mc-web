# Batch 28 interchange5 (claude, 2026-11-08)

Branch `batch28-interchange5` from 7b67a97 (0.56.0). Worktree `wt28-interchange5`.

## Summary
- Nether and End chunks saved with TerrainPopulated=false are populated at import (`src/imported-population-dims.js`, `dimension` option of `populateImportedColumns`, hook in `whole-save-import.js`):
  - Same native trigger (`populationPlan`), `ChunkProviderHell.populate` with one persistent provider (constructor-state hellRNG carried across calls), fortress starts searched over the 4-chunk window, `ChunkProviderEnd.populate` with a per-chunk seed; End spikes/dragon become entity records.
  - A populate that needs an uncached stored chunk is retried with the generator RNGs rolled back (`mark`/`reset`), which the Overworld path does not need.
- Native probe `tools/probes/InterchangeDimPopulateProbe.java` + `tools/verify-interchange-dim-populate.mjs` -> `public/research/interchange-dim-populate-reference.json` (9 scenarios, 406 native populate calls through the unchanged `Chunk.populateChunk`). Order, flags, every chunk hash, spawners, chest counts, End entity positions and scheduled-tick counts match.
- Stored-cell overlay: optional `orig` list on column records (JSON `o`), written by the importer (`ColumnSink`) and by populate, read by populate first and by the Java export for fluids. Level-0 flowing fluid, hardened lava with a level and chest facing round-trip; old records stay readable. Helper `src/stored-overlay.js`.
- Kept populate records: animals, villagers (entity records), swamp-hut pots, fire ticks (`fireTicks`), sand/gravel ticks (`fallingTicks`), liquid ticks. Only ticks of other blocks are dropped (none occurred in any scenario).
- Furnace lit state: furnace records carry optional `lit` (saved block id 61/62); `scene.setFurnaces` and the export use `lit ?? burn > 0`; `Survival.tickFurnaces` deletes `lit` when the burn flag flips (negstacks3 owns tick behaviour; my hunk is 3 lines: `const burning`, and one `delete` line).
- Shared-file hunks: `src/scene.js` (1 line, `setFurnaces`), `src/survival.js` (load copies `lit`, tick hunk), `src/region-import.js` (write passes the original key, furnace `lit`), `src/region-export.js` (overlay for fluids, `lit`). `src/dimension-live.js` is untouched.
- Synthetic save: Nether chunk (-1,-2) and End chunk (-1,-1) are now unpopulated.

## Verification
- Native: `node tools/verify-interchange-dim-populate.mjs` (needs the jar in MC_RESEARCH): all asserts pass. Unchanged native classes ran (aqv, ara, atd, apx); nothing here is only bytecode-read except the earlier javap reading of the populate order.
- Modelled, not native: the populating Nether provider is a fresh one (server restart state), World.rand is `Random(0)` in both Java and the port (natively time-seeded), End World.rand is seeded per chunk.
- Synthetic round trip (`tools/roundtrip-synthetic-save.mjs`): before, `DIM-1 61:3 -> 62:3`, `DIM1 61:3 -> 62:3` and `overworld 10:0 -> 11:0 x216` appeared; after, none of them. Nether populated 1 chunk (124 cells), End 1 chunk. Overworld pigs 18 -> 26 (8 populate animals kept).
- Tests: `src/imported-population-dims.test.js` (11), `src/imported-whole-save-dims.test.js` (4), plus existing suites; final counts in the commit message and lead report.
- Not done: muted headless Chrome check (see below if run).

## Follow-ups
- Proposed gap lines for `remaining-gaps.md`:
  - Done (batch 28): imported Nether/End TerrainPopulated=false chunks populate at import (probe-verified call order, hashes, tiles, entities, ticks); stored cells keep level-0 flowing fluid and chest facing through the `orig` overlay; populate animals, villagers, pots and fire/falling ticks are kept; imported furnaces keep their saved lit state.
  - Remaining: TileTicks of saved chunks are still only counted; the Nether populate model uses a restart-state hellRNG and a fixed World.rand (natively time-dependent); End population uses a per-chunk seed; the overlay is applied on export only for fluids (chest facing, moisture, repeaters stay with their runtime records).
  - Remaining: a populate that needs a block with no exact cell is skipped whole (none seen for Nether/End).
- Overlay entries are created for every farmland, chest and furnace of an imported chunk; fine for sparse worlds, a farmland-heavy save grows `orig` by 4 bytes per cell in JSON backups.
