# Maps and clock track handoff

Branch `batch6-maps-clock`. Details in `public/research/maps-clock.md`.

## Changed

- New: `src/clock.js`, `src/maps.js`, `src/map-colors.js`, `src/map-colors-data.js`, `src/maps-nbt.js`, `src/maps-clock-live.js`, `src/maps-clock.test.js` (9 tests), `tools/probes/MapsClockProbe.java`, `tools/verify-maps-clock.mjs`, `public/research/maps-clock-reference.json` (286 records).
- Shared hooks (small): `main.js` (MapsClock, tick, save/load, `maps` in edit state), `player-edit-simulation.js` (empty map branch before bow), `first-person.js` (clock frame texture and key), `inventory.js` (`onMapCrafted` in `CraftingSlot.finish`), `survival.js`, `original-items.js`, `population-content.js` (items, clock recipe, map recipes), `population-creative.js` (2080 after 700 in the tools tab and search order), `region-export.js`, `region-import.js`, `tools/inventory-replay.mjs` (347:2080, 358:2081).
- Test expectations: `merchant-ui.test.js`, `region-import.test.js`, `recipe-catalogue.test.js` (293 recipes, 2630 offsets).

## Merge hints

- Recipe counts and `population-creative.js` conflict with other tracks; recompute and regenerate catalogues after merging.
- Item ids 2080 and 2081 only.

## Remaining

See Gaps in `maps-clock.md` (no first-person map render, decorations drawing, item-frame maps, other dimensions; nothing browser-verified).
