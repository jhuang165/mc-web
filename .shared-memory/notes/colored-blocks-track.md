# Colored and storage blocks track

Status: gameplay, rendering, textures, tests and catalogues done on this branch; no browser run (rules forbade it). Not full parity.

- Internal ids 140-148 (stained glass, pane, carpet, hay, coal, lapis, emerald, sponge, jack o'lantern), items 1140-1148. Logic in `src/colored-blocks.js` (no imports, to avoid a cycle with world.js and doors-panes.js).
- Evidence: `public/research/colored-blocks-reference.json` from `tools/verify-colored-blocks.mjs` (run with MC_RESEARCH). Replay: `src/colored-blocks.test.js`. Write-up: `public/research/colored-blocks.md`.
- Shared lines touched: world.js (BLOCKS, re-export, SEE_THROUGH, blockBounds, solidBlock), doors-panes.js, block-registry.js, original-items.js, inventory-replay MC_IDS, region-import VARIANT_DAMAGE, survival.js, population-content.js, mining.js, block-placement-simulation.js, lighting.js, shadows.js, projectiles.js, explosion.js, bed.js, fences.js, fire.js, enchantment-effects.js (silk damage), scene.js (ice pass, carpet box, pane meta), block-textures.js, main.js (pick, carpet pop-off).
- Regenerated: population-creative.js, block metadata catalogue, shadow-reference.json, item-parity-catalogue.md.
- Gaps: pane group rule, block sounds, structure NOT_OPAQUE, neighbour brightness, live visual check.
