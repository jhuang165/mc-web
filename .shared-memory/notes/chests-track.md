# Chests track handoff

Branch `worktree-agent-a7b202f52cd6b5d73`. Details in `public/research/chests.md`.

## Changed

- New: `src/chest-blocks.js`, `src/chests.test.js`, `tools/probes/ChestsProbe.java`, `tools/verify-chests.mjs`, `public/research/chests-reference.json`, `public/research/chests.md`.
- Shared files touched (small hooks): `chest.js` (kind-aware pairing), `chest-renderer.js` (kind textures, ender path), `world.js`, `lighting.js`, `block-registry.js`, `block-textures.js`, `original-items.js`, `tools/inventory-replay.mjs`, `population-content.js`, `population-creative.js`, `explosion.js`, `particles.js`, `doors-panes.js`, `enchantment-effects.js`, `redstone-runtime.js`, `survival.js`, `block-placement-simulation.js`, `player-edit-simulation.js`, `inventory-transfer.js`, `main.js`, `region-export.js`, `region-import.js`.
- Tests touched: `recipe-catalogue.test.js` (287 checked, 2592 offsets), `region-import.test.js` (unmapped block now 138, not 130), `shadows.test.js` (162/163 excluded), regenerated `block-metadata-catalogue.md`.

## Merge hints

- Internal ids 162 and 163 and items 1940/1941. Keep `isChestBlock` in place of `=== CHEST` on conflicts.
- Creative lists and the recipe-catalogue counts will conflict with other tracks; re-count.

## Remaining

See Gaps in `chests.md` (ender recipe needs eye of ender, EnderItems import, portal particle hookup, icons).

Tests: `npm test` 2042 pass, `npm run build` ok. No credentials stored.
