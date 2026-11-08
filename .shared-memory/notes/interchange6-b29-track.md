# interchange6 (batch 29)

## Summary
- Saved TileTicks are imported and exported. New `src/tile-ticks.js`; glue in `region-import.js`, `region-export.js`, `whole-save-import.js`.
- Fluid (8-11), fire (51) and falling (12, 13, 122, 145) ticks go to the port's envelopes; redstone-engine blocks go to `record.redstone.pending` with priority; powered repeaters go to `redstone.lit`.
- Export writes all four lists with original ids and `t = delay`, `p` kept for redstone, and copies border ticks into the neighbour chunk (native box `[chunk*16-2, chunk*16+18)`).
- Export now prefers the stored `orig` state for unedited cells; runtime wins only for tracked farmland, furnaces with a tile record, and repeaters when a lit set exists.
- Populate fuzz (about 60 seeds, about 2900 populate calls): no missing exact cell, no `skipped.unmapped`. Documented as "none seen".
- Goal 4 documented in `public/research/region-import.md` (bytecode-read): native hellRNG depends on provider history; End populate uses time-seeded World.rand.
- Shared-file hunks: `src/redstone-runtime.js` (restore pistons separately when the import's `redstone` has none, 1 line) and `src/world-import.js` ("redstone" in RUNTIME_FIELDS plus `sanitizeRedstone`). dimrules2 also edits world-import.js, so expect a small merge conflict there. No hunks in main.js, scene.js or entities.js.

## Verification
- `npm test`: 4746 tests, 4746 pass (one earlier run showed 1 failure that did not repeat on rerun; not identified). `npm run build` passes.
- Synthetic round trip: TileTicks identical Overworld 0/162 -> 162/162, Nether 0/9 -> 9/9, End 0/9 -> 9/9. Changed-cell kinds 27 -> 21; platform drift (farmland 5->7, repeater 94->93, water 3->9) gone.
- Native evidence is bytecode-read (javap of mt, ahs, aqv, ara) plus the existing ChunkNbtProbe reference. No new Java probe run for ticks.

## Follow-ups
- Run a native probe that loads a chunk with TileTicks through the unchanged `func_147446_b` and compares the pending list.
- Comparator OutputSignal import; priority for fluid/fire/falling ticks (port has none).
- Ticks outside a 1x1 whole-save chunk box are dropped.
- Proposed remaining-gaps lines:
  - Saved TileTicks round trip for fluids, fire, falling blocks and redstone blocks; priority kept for redstone only; ids the port does not schedule are dropped and tallied.
  - Native Nether populate depends on the provider's hellRNG history (provideChunk reseed with a coordinate hash, no world seed); the importer uses a fresh-provider model.
  - Native End populate uses time-seeded World.rand; the importer's per-chunk seed is a model.
