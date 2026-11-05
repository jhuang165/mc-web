# Eye of ender track handoff

Branch `batch5-eye-of-ender`, base 3e2786a. Details in `public/research/eye-of-ender.md`.

## Changed

- New: `src/eye-of-ender.js` (rules), `src/eye-of-ender-live.js` (flying eyes and use), `src/end-portal-renderer.js`, `src/eye-of-ender.test.js` (12 tests), `tools/probes/EyeOfEnderProbe.java`, `tools/verify-eye-of-ender.mjs`, `public/research/eye-of-ender-reference.json` (297 records).
- Shared hooks (small): `world.js` (BLOCKS 149, bounds, SEE_THROUGH, raycast, solidBlock), `main.js` (EyesOfEnder, renderer, save/load, tick, projectile list), `scene.js` (mesher skip), `player-edit-simulation.js` (eye branch before bow), `lighting.js`, `explosion.js`, `block-registry.js`, `original-items.js`, `population-content.js` (items, materials, recipes at end of installPopulationRecipes), `projectile-renderer.js`, `region-import.js`, `region-export.js`.
- Tests and generated files touched: `item-names.test.js` (tile.null.name allowed for hidden 149), `shadows.test.js` (skip 149), `recipe-catalogue.test.js` (290 recipes, 2612 checks), `player-throw-replay.test.js` (`eyes: null` binding), `tools/inventory-replay.mjs` (381:1960), regenerated `population-creative.js`, `block-metadata-catalogue.md`, `item-parity-catalogue.md`.

## Merge hints

- Recipe and catalogue counts will conflict with other tracks; recompute and regenerate catalogues after merging.
- Keep `149: fixed(119)` in `block-registry.js` and the `main.js` `eyes` binding in the edit state.

## Remaining

See Gaps in `eye-of-ender.md` (no End dimension or portal travel, no generated-start stronghold lookup, approximated portal renderer, nothing browser-verified).

Tests: `npm test` 2117 tests, 2116 pass on first full run; the one failure (iron golem melee test) passed on rerun, unrelated and flaky. `npm run build` ok.
