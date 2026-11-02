# PLAN-03b handoff: native block metadata classification

Classifies all 171 blocks x 16 raw metadata values (2,736) from the unchanged 1.7.10 classes.

- `node tools/verify-block-metadata.mjs` (needs `MC_RESEARCH`, JDK) runs `tools/probes/BlockMetadataProbe.java` (native Block/ItemBlock methods against the PlantProbe World double), reads javap bytecode of each block class chain, and writes `public/research/block-metadata-reference.json` (classification logic in `tools/block-metadata-classify.mjs`, deterministic).
- `node tools/build-block-metadata-catalogue.mjs` regenerates `public/research/block-metadata-catalogue.md` from the JSON plus the live `fromOriginal` browser mapping. `tools/build-content-catalogue.mjs` no longer writes that file.
- `src/block-metadata-catalogue.test.js` checks reference/catalogue consistency without a JDK. It also compares the md to a render using the current `src/block-registry.js`, so changing the browser mapping requires re-running the builder.

Categories: semantic 853, alias 628, invalid 2 (double_plant 6/7 icon AIOOBE), unclassified 1253. Alias means identical probed surface and no unprobed metadata-reading override (conservative). Unclassified mostly means tick/neighbor/activation/drop overrides read metadata and were not executed.

Open: entity-based placement (onBlockPlacedBy), neighbor/position-dependent icons and bounds, tile-entity state, tick/update/activation behavior, comparator and tile-entity blocks on the stub world, persistence. No browser parity is claimed.
