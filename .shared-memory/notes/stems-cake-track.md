# Stems and cake track handoff

Branch `worktree-agent-a3f139c4e938fc046`. Details in `public/research/stems-cake.md`.

## Changed

- New: `src/stems-cake.js` (rules), `src/stems-cake.test.js`, `tools/probes/StemCakeProbe.java`, `tools/verify-stem-cake.mjs`, `public/research/stem-cake-reference.json`, `public/research/stems-cake.md`.
- Shared files with small hooks: `world.js` (BLOCKS 159-161, isPlant, random tick, bounds, see-through), `block-registry.js`, `block-textures.js`, `scene.js` (stem and cake rendering), `farming.js`, `crops.js` (seeds plant stems), `player-edit-simulation.js` (cake placement and eating), `main.js` (one neighbour-pop line plus import), `survival.js`, `population-content.js`, `population-creative.js` (regenerated), `original-items.js`, `tools/inventory-replay.mjs`, `inventory.js` (crafting container return), `lighting.js`, `explosion.js`, `signs.js` (supplies the Material.isSolid table to the cake).
- Tests touched: `shadows.test.js` (ids 159-161 excluded), `recipe-catalogue.test.js` (287 recipes, 2578 offsets), `block-metadata-catalogue.md` regenerated.

## Merge hints

- `shadows.test.js` and `recipe-catalogue.test.js` counts will conflict with other tracks; re-add each track's share. Rerun `node tools/build-population-creative.mjs` and `node tools/build-block-metadata-catalogue.mjs` after merging.

## Remaining

See Gaps in `stems-cake.md`. Tests: `npm test` 2039 pass (one unrelated zombie-conversion test flaked once), `npm run build` ok. No credentials stored.
