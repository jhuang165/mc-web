# Nether melee track handoff

Branch `batch6-nether-melee`. Details in `public/research/magma-pigman.md`.

## Changed
- New: `src/nether-melee.js` (rules), `src/nether-melee-live.js` (pigman anger, think, lightning glue), `src/magma-cube-renderer.js`, tests `magma-pigman.test.js` and `magma-pigman-world.test.js`, probe `tools/probes/MagmaPigmanProbe.java`, `tools/verify-magma-pigman.mjs`, evidence `public/research/magma-pigman-reference.json` (41 records).
- Small hooks in shared files: `entities.js`, `combat.js`, `slime.js`, `java-mobs.js`, `region-export.js`, `commands.js` (SUMMONABLE), `mob-renderer.js`, `weather-simulation.js`, `tools/import-vanilla-media.mjs` (regex only), `java-mobs.test.js` (expected key list).

## Merge hints
- `entities.js` hooks: ENTITY_TYPES, HOSTILE, restore/create, attackEntityFrom (pigmanHurt), fireproof guard, aiMoveSpeed boost; keep them on conflicts.
- `combat.js` rare-drop roll is one shared nextInt(200) roll for zombie and pigman; keep it single.
- Audio is not imported: run the media import for `magmacube|zombiepig`; `media.test.js` counts may need updating then.
- Wire `portalPigmanSpawn` into BlockPortal when the Nether exists. No item ids or BLOCKS slots used.

## Remaining
See the Gaps section of `magma-pigman.md` (no natural spawning, adapted pigman AI timing, baby pigmen, sword sprite, sounds not imported).

Tests: `npm test` 2191 pass, `npm run build` ok. No credentials stored.
