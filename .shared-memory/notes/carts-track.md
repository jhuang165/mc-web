# Carts track handoff

Branch `batch6-carts`. Details in `public/research/minecart-variants.md`.

## Changed

- New: `src/cart-variants.js` (rules, items, NBT), `src/cart-hopper.js`, `src/cart-block-renderer.js`, `src/cart-summon.js`, `src/carts.test.js`, `tools/probes/CartsProbe.java`, `tools/verify-carts.mjs`, `public/research/carts-reference.json`, `public/research/minecart-variants.md`.
- Edited: `minecarts.js`, `minecart-renderer.js`, `region-export.js`, `world-import.js`, `original-items.js`, `survival.js`, `vehicle-simulation.js`, `structure-simulation.js`, `dispense.js`, `redstone-runtime.js`, `creative.js`, `command-host.js`, `tools/inventory-replay.mjs`, `recipe-catalogue.test.js` (checked recipes 292 to 295, total 2628 to 2676).

## Shared hot files touched

- `main.js`: dispenser cart hook uses `spawnCart`, new `cartHost`, `openContainer(container, kind)`, container guard, `minecarts` on the command host.
- `commands.js`: SUMMONABLE spreads `CART_SUMMON`.
- `region-export.js`: cart entity ids and variant NBT.

## Merge hints

Item ids 2090-2093; `ORIGINAL_ITEMS` and `tools/inventory-replay.mjs` `MC_IDS` must match (both spread `CART_ORIGINAL_ITEMS`). No BLOCKS slots, no version bump.

## Remaining

See Gaps in `minecart-variants.md` (command block cart entity and GUI, spawner cart, hopper model approximated, nothing checked in a browser).
