# Batch 17 decorate2 track

Branch b17-decorate2 (worktree b17/decorate2), based on b3316f1, app 0.46.0.

## Changed
- `tools/probes/PopulateChainProbe.java`: audit rows may carry a fifth field (1 = forced single-biome region via the unchanged `WorldChunkManagerHell`, `aie`); per-region Random stream for worldRand/lightBase (regions are independent, appendable, scannable); records carry `wellSlabs` (stone_slab:1 writes) and `melons`. `tools/verify-biome-audit.mjs` gets `AUDIT_REGIONS`, `AUDIT_SCAN` (candidate scan, writes nothing) and `AUDIT_OUT` (separate compile dir for parallel scans).
- `tools/probes/biome-audit-regions.json`: +10 forced regions (slots 10, 20, 151 x2 seeds; desert wells seeds 2091 and 3271; jungle melons forced slots 21 seed 136, 22 seed 120): 79 regions, 59 slots. `tools/find-biome-audit-regions.mjs --write` keeps forced rows. Reference regenerated.
- `src/forced-biome-manager.js` (research-only JS WorldChunkManagerHell), `src/biome-audit.test.js`: forced regions, native well/melon counts equal JS, signatures for 10/20/151 and melon in 21/22.
- Structures on: `tools/verify-structure-area.mjs` takes `STRUCTURE_AREAS_FILE` / `STRUCTURE_REFERENCE` (defaults unchanged); `tools/probes/biome-audit-structure-areas.json` (14 areas), `public/research/biome-audit-structures-reference.json`, `src/biome-audit-structures.test.js` replays all 14 exactly (starts, call/write hashes, provider Random, World.rand, chunk hashes, tiles, entities, carts, ticks, drops).
- Lily pad UV rotation: `src/lily-pad.js` (hash + corner table from bytecode `blm.o`), one block in `scene.js` `cube()`, `src/lily-pad.test.js` (16 Java-computed hash values). Underside half-brightness colour not ported. Not looked at in a browser.
- Docs: `public/research/biome-decoration-audit.md`; `biome-parity-catalogue.md` regenerated (slots 10/20/151 audited). Entity and gamerule catalogues show other tracks' generator drift and were left alone.

## Generation impact
None. Nothing in live generation changed (forced manager is unused by any version; probes, references and tests only); lily pad is rendering only. No generation 17. Finite generation 15 (task 5) NOT done: finite Java worlds at version 14 share `generationVersion >= N` branches in world.js with the streamed versions, and 15 means "superflat structures" on streamed worlds, so a finite 15 is not a clean one-line gate.

## Findings
- Slot 151 is JungleEdge M, slot 140 Ice Plains Spikes (already natural).
- Desert well: 12 slab writes; fires about once per 230 forced 6x6 regions (4 chunks each). None in 500 forced Desert Hills regions.
- A stronghold area in Extreme Hills M hit `structure redstone power from block 77 is unported` (stone button power read while a spring floods a stronghold door in `structure-population-area.js`); replaced by other stronghold biomes. Real gap, in structure code not decoration.
- Jungle temple decoration divergence (structure-area.md) not revisited.

## Tests
See final report; `npm test` and `npm run build` from this worktree.

## Remaining gaps
Desert Hills/Desert M wells, jungle temples with structures on, stone-button power in structure doors, underside lily colour, light engine fixtures, forced regions are synthetic terrain, finite generation 15, rows stay Partial.

## Proposed remaining-gaps decoration line
Decoration: native populate replayed in 79 regions over 59 slots (slots 10, 20, 151 via forced single-biome terrain), desert wells and jungle melons at chunk level, and 14 structure-on areas (villages, huts, pyramid, mineshafts, strongholds); open: Desert Hills/M wells, jungle-temple areas, light engine, finite generation 15 (legacy mutated-biome rule), rows stay Partial.
