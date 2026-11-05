# Beacon track handoff

Branch `batch6-beacon`. Details in `public/research/beacon.md`.

## Changed

- New: `src/pyramid.js` (rules, tile store, installers), `pyramid-live.js` (80-tick tick), `pyramid-renderer.js` (beam), `pyramid-container.js` (ContainerBeacon), `pyramid-gui.js` (GuiBeacon markup), `pyramid.test.js`, probe `tools/probes/BeaconProbe.java`, `tools/verify-beacon.mjs`, `public/research/beacon-reference.json`.
- Tests touched: `recipe-catalogue.test.js` (292 -> 293 recipes, 2628 -> 2630 checks), `region-import.test.js` (unsupported-block example 138 -> 115, since the beacon is mapped now).

## Merge hints (shared files, small hooks)

- `world.js` (BLOCKS[173], SEE_THROUGH), `block-registry.js` (`173: fixed(138)`), `lighting.js`, `explosion.js` (RESIST[173]), `block-textures.js` (tile, icon), `scene.js` (`beacon()` and dispatch), `main.js` (state, save/load, onChange, tick, render, container hooks, `useBeacon`), `player-edit-simulation.js` (right-click opens the screen), `command-host.js` (/setblock and tileAt via `env.beaconTile`), `chunk-runtime.js` and `region-export.js`/`region-import.js` (`beacons`), `population-content.js` (items, materials, recipe), `original-items.js` and `tools/inventory-replay.mjs` (399 -> 2060, 138 -> 173; keep identical), `population-creative.js` (regenerate with `tools/build-population-creative.mjs`), `block-metadata-catalogue.md` (regenerate with `tools/build-block-metadata-catalogue.mjs`), `container-ui.css`.
- `item-names`, `media` and the sound importer were not touched (no new sounds).
- Count-style tests (`recipe-catalogue`, creative lists) will conflict with other tracks; recompute them.

## Remaining

See Gaps in `beacon.md` (ambient flag, achievement, browser verification of the beam, icon and GUI).

Tests and build: see the track report. No credentials stored.
