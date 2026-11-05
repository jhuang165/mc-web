# Nether-gen track handoff

Branch `batch6-nether-gen`. Details in `public/research/nether.md`.

## Changed

- New: `src/nether-generator.js`, `src/nether-portal.js`, `src/nether-portal-live.js`, `src/nether-wart.js`; tests `nether.test.js`, `nether-portal-wart.test.js`; probes `NetherProbe.java`, `PortalWartProbe.java`; verifiers `tools/verify-nether.mjs`, `tools/verify-portal-wart.mjs`; evidence `nether-reference.json`, `portal-wart-reference.json`; docs `public/research/nether.md`.
- Slots: BLOCKS 164 (portal) and 170 (wart) overwritten in place.

## Merge hints (shared files touched, all small)

- `src/world.js`: BLOCKS entries, bounds hook (`blockBounds` branches for 164 and 170).
- `src/block-registry.js`: one MAP line `164: same(90), 170: same(115)`.
- `src/block-textures.js`: portal and wart stage tiles and blockTile branches.
- `src/scene.js`: imports, `this.portal` animated material, portal mesher + `portalBlock`, wart via `crops`, portal uv in `render`.
- `src/lighting.js`: emission 11 for 164, opacity 0 for 164 and 170.
- `src/main.js`: `NetherLive` construction (line ~895) and import.
- `src/player-edit-simulation.js`: small hook (see diff).
- `src/display-ticks.js`: import and one `else if (b === 164)` branch.
- `tools/import-vanilla-media.mjs`: `portal\/` in the sound regex (importer not run; `media.test.js` unchanged).
- Tests adjusted for the new ids: `shadows.test.js` (exclude 164, 170), `item-names.test.js` (INTERNAL_ONLY 170); regenerated `public/research/block-metadata-catalogue.md`.
- main now has `portalPigmanSpawn` (nether-melee.js): wire it or `portalSpawnPosition`, not both.

## Remaining

See Gaps in `public/research/nether.md` (no dimension switch, no portal travel, no live pigman spawn, missing portal sound file, fortress, display tick unverified).
