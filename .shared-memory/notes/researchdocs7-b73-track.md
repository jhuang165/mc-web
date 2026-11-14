# Batch 73 researchdocs7: docs sweep of docs no earlier sweep covered

## Summary
Docs only. 30 files in `public/research/` got a "Batch 73 (docs sweep, 2026-11-14)" line (old text kept): enchanting, anvil, anvil-container, farmland, investigation, player-knockback, command-blocks, structure-population, structure-population-world, atlas-stitcher, textures-and-farming, chunk-nbt, chunk-preview, adventure-mode, world-spawn, ui-animation-experience, sound, debug-screen, giant, wolf, simulation, hanging-entities, bed, block-behaviour-audit, languages, mob-movement, cape-ears, ender-pearl-live, biome-decoration-audit, light-engine. No code, generators or catalogues touched. The earlier-listed docs (mob-riding, music, streaming and so on) already carry batch 70/71 lines, so I took the 30 docs with no sweep marker at all.

Stale claims found (all code reading): enchanting "not ported" list, anvil integration/glint, falling anvil damage, farmland mobGriefing, investigation hoes and gold tools, structure data save, terrain atlas and water_flow/lava_flow sprites, region files in chunk-nbt, map frames drawn, F3+C dialog, 36-slot inventory model.
Still true: death throw and bed/TNT knockback nudge absent, adventure/frame rule (not a gap), bonus chest torch metadata, sound-origin by event name, client-side `recheckGaps` pass.

## Evidence
Code reading only (grep of `src/` and `server/`); nothing executed, no bytecode read, no browser. Browser-only: item-hand motion, command block editor layout, F3+C dialog layout.

## Verification
`npm run build`: ok (7.25s). Full npm test not run (batch rule). No catalogue edits, so catalogue tests not rerun.

## Follow-ups (real code gaps still open, code reading)
1. No death throw on player death: no motion write in `src/survival.js` or `src/player-knockback.js` (native `EntityPlayer.onDeath`).
2. No `onFallenUpon` for item entities: only `src/farming.js` 25 path (players and mobs).
3. Stale header comment in `src/hanging-interaction.js` line 11 ("maps are not implemented"); maps render via `hanging-renderer.js`.
4. `src/structure-framework.js` 352 comment says MapGenStructureData is not modelled, but `structure-nbt.js` 303-314 and `structure-data.js` exist (comment only; check whether live starts are saved on the server).
5. Bonus chest torches placed with metadata 0 (`src/bonus-chest.js` 58), no `onBlockAdded` orientation.
6. Falling anvil damage to non-living targets unchecked (`src/falling.js` 217-218, `falling-damage.js`).
7. Client lacks the server's `recheckGaps` pass after height-map edits (`light-engine.md`, bytecode-predicted, not executed).
8. No numeral tooltip caller found for `enchantment.level.N` outside `enchanted-books.js`/`lang-en-us.js` (not confirmed; check item tooltips in `gui.js`).
