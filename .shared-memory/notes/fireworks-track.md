# Fireworks track handoff

Branch `batch6-fireworks`. Details and Gaps in `public/research/fireworks.md`.

## Changed

- New: `src/fireworks.js`, `fireworks-nbt.js`, `fireworks-live.js`, `firework-rocket.js`, `firework-particles.js`, `fireworks.test.js`,
  `tools/probes/FireworksProbe.java`, `tools/verify-fireworks.mjs`, `public/research/fireworks-reference.json`, `fireworks.md`.
- Item ids 2070 (star) and 2071 (rocket).

## Shared files touched (merge hints)

`original-items.js` (`...FIREWORK_ITEMS`), `population-content.js` (`installFireworkItems`), `survival.js` (`fireworksResult` after leather dye),
`inventory.js` (`sameTag`, `read`), `gui.js` (`fireworkLines`), `projectile-renderer.js` (kind firework), `player-edit-simulation.js`
(use hook), `dispense.js` (FIREWORK behaviour, ITEM.FIREWORK), `main.js` (rockets, fireworkFx, serialize, load, tick, setProjectiles, state,
dispenser host), `region-export.js` / `region-import.js` (tags), `tools/import-vanilla-media.mjs` (regex adds `fireworks`; importer not run).
`tools/inventory-replay.mjs` (MC_IDS gains 401:2071, 402:2070), `player-throw-replay.test.js` (binding `rockets: null`). `media.test.js` is untouched; re-run the importer after merge for the sounds.

## Remaining

See Gaps (skull id, /summon, star icon overlay, sounds import, no browser check).

Tests: `npm test` 2181 pass, 0 fail; `npm run build` ok. `population-creative.js` gained 2070 in the misc and search lists (creative.test.js, content-catalogue.test.js). No credentials stored.
