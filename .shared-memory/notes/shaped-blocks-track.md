# Shaped blocks track (wood slabs, fence gates, trapdoors, cobblestone walls)

Branch: this worktree. Research page: `public/research/shaped-blocks.md`. Native reference: `public/research/shaped-blocks-reference.json` (`node tools/verify-shaped-blocks.mjs`, needs `MC_RESEARCH`).

## What changed
- New `src/shaped-blocks.js` (pure rules, no runtime imports) and `src/shaped-blocks.test.js` (replays the reference).
- Internal ids: 165 wood slab, 166 double wood slab, 167 fence gate, 168 trapdoor, 169 cobblestone wall; items 1165/1167/1168/1169.
- `world.js`: 25 `reserved` placeholder BLOCKS (140-164) + 5 entries, `SEE_THROUGH` additions, `wallSolid`, hooks in `blockBounds`, `collisionBounds`, `collisionBoxes`, `collisionBoxList`, `solidBlock`/`World.solid` (open gate), raycast partial bounds.
- `block-registry.js`: MAP 165-169, length check ignores reserved.
- Small hooks: `block-textures.js`, `scene.js` (`shaped()` mesher), `population-content.js` (items, materials, recipes incl. daylight sensor, drops, crafting results, `POPULATION_ITEMS` 126/107/96/139), `block-placement-simulation.js`, `player-edit-simulation.js`, `redstone-runtime.js` (`installShapedBlocks`), `main.js` (pick block), `fences.js` (gate), `mining.js`, `explosion.js`, `rails.js`/`display-ticks.js`/`doors-panes.js` (top wood slab is a solid top), `torches.js` (wall), `lighting.js`, `shadows.js`.
- Tests adjusted: `recipe-catalogue.test.js` (212 -> 217 checked, 1998 -> 2018 samples), reserved-skips in block-registry, block-sounds, chunk-store, fence, rails, shadows (139 rows), item-names.
- Regenerated: `population-creative.js`, `item-parity-catalogue.md`, `block-metadata-catalogue.md`.

## Merge hint
The reserved placeholders (140-164) exist only so this branch keeps `BLOCKS` contiguous; when the other tracks' real blocks land there, drop `reserved` handling or keep it for unused slots. Re-run the creative and catalogue generators after merging.

## Remaining
No browser check was done (no dev server). Render models are unverified against the native renderer; silk touch missing; no shadow-probe rows for 165-169.
