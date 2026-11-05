# Wither track (batch 6)

Branch `batch6-wither`. Handoff: mob heads and the wither skeleton are done; the Wither entity is a gap (see `public/research/wither.md`).

## Changed files
New: `src/skull.js`, `skull-bounds.js`, `skull-renderer.js`, `wither-skeleton.js`, `wither-rules.js`, `skull.test.js`, `public/research/wither.md`.

## Merge hints (shared files touched, one-line hooks)
`world.js` (BLOCKS[172] via skull-bounds.js, SEE_THROUGH, blockBounds, raycast), `scene.js` (skip 172), `block-registry.js` (172 -> 144), `original-items.js` and `tools/inventory-replay.mjs` (397 -> 2050), `survival.js`, `first-person.js` (itemTexture), `population-creative.js` (heads at the end of Decorations and in search), `player-edit-simulation.js` (ItemSkull branch), `block-break-simulation.js` (drop by tile), `main.js` (SKULLS save/load/onChange/renderer, `difficulty` in the edit state), `chunk-runtime.js` ('skulls'), `region-export.js`, `region-import.js`, `command-host.js`, `entities.js`, `ai.js`, `combat.js`, `mob-renderer.js`, `java-mobs.js`, `enchantment-effects.js`, `tools/import-vanilla-media.mjs`. Tests edited for the new mappings: `region-import.test.js`, `shadows.test.js`; `block-metadata-catalogue.md` regenerated.
The lead should supply `spawnWither` in the main.js edit hooks once an EntityWither exists. Nether star is 2060 (beacon track).

## Gaps
Wither entity, probe and reference JSON, helmet-slot heads (see wither.md).
