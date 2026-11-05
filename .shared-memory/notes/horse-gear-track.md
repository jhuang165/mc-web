# Horse gear track handoff

Branch `batch6-horse-gear`. Details in `public/research/horse-gear.md`.

## Changed

- New: `src/horse-gear.js` (rules, HorseContainer), `src/horse-gear-live.js` (EntityWorld hooks, jump bar), `src/horse-gear-renderer.js` (leash, knot, plate), tests `horse-gear.test.js`, probe `tools/probes/HorseGearProbe.java`, `tools/verify-horse-gear.mjs`, `public/research/horse-gear-reference.json`.
- Shared files touched (small hooks): `src/main.js` (openHorse, inventory key, container class, HUD jump bar, renderer call), `src/container-ui.css` (horse-modal, jump-hud), `src/entities.js` (restore, leashTick, onDeath, install), `src/horse-live.js` (items, gui action, name tag), `src/ai.js` (persistent mobs do not despawn), `src/population-content.js` (lead item 2020, id map, recipe), `src/population-creative.js` (lead in tools tab and search), `src/player-edit-simulation.js` (leash and name tag hooks), `src/region-export.js` and `src/java-mobs.js` (Items, CustomName, Persistence, Leash NBT).
- Tests touched: `recipe-catalogue.test.js` (292 -> 293 checked recipes, 2628 -> 2630 offsets).

## Merge hints

- Item id 2020 is the only new id. The lead recipe sits before the golden apple recipe in `population-content.js`.
- `main.js` additions are one-liners plus `openHorse` next to `inventory()`.

## Remaining

See Gaps in `horse-gear.md` (lead pathing, unverified render geometry, knots not entities, no horse preview, nothing run in a browser).
