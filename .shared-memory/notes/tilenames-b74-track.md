# Batch 74 tilenames: CustomName on block entities

## Summary
- `src/tile-names.js` (new): `nameStoreOf`, `nameTileFromStack` (onBlockPlacedBy), `namedTitle`, `largeChestName`. Port block ids (chest 41, trapped 162, furnace 14, dispenser 115, dropper 132, hopper 133, brewing 134, enchant table 86).
- Record field `name` on `survival.chests/furnaces/dispensers/brewing` (hoppers already had it); enchanting table names in `survival.tableNames["x,y,z"]`. Saved and loaded in `survival.js` (`serialize`, constructor), only when set. A dispenser/dropper keeps an empty string (native `k_` is `name != null`); the other tiles need a non-empty name.
- Placement: `block-placement-simulation.js` copies a named held stack's `displayName` onto the new tile (anvil-renamed blocks keep their name). `block-break-simulation.js` drops a table's name with the block.
- Titles: `titleLocalized` flag on containers (chest via `openChest` -> `chest.js` large chest rule, furnace, dispenser, hopper, brewing, enchanting). `main.js` `shellTitle` skips translation when set (so a name equal to "Chest" stays as typed). Server: `openWindow` carries `title` plus `named: true` (S2D useProvidedTitle); `client-containers.js` sets `titleLocalized` from it.
- Server joins: `tableNames` added to the tile lists in `simulation.js`, `server-dimensions.js` (TILE_KEYS) and `server-nether.js` (TILE_SAVE).
- NBT: `region-export.js` writes `CustomName` for chests, furnaces, dispensers/droppers, hoppers, brewing (only when named) and enchanting tables (from `player.tableNames`); `region-import.js` reads it for all of them (`readContainerTile`, also used by command data tags) and for `EnchantTable` into `player.tableNames`.
- Tests: `src/tilenames-b74.test.js` (6). Probe: `tools/probes/TileNamesProbe.java`, `tools/verify-tile-names.mjs`, `public/research/tile-names-reference.json`.

## Evidence
- executed (TileNamesProbe on the unchanged jar): chest aow, dispenser apb, dropper apc, enchant table apd, furnace apg, hopper api, brewing aov: unnamed tile writes no CustomName; after setCustomName it writes it and reports named; readFromNBT reads a string tag, ignores a wrong-typed tag. Dispenser/dropper: `""` counts as named and is written; every other tile treats `""` as unnamed. InventoryLargeChest (ra): first half's name, else second's, else the constructor name.
- bytecode-read: BlockChest ajx, BlockFurnace ale, BlockDispenser akm, BlockHopper aln, BlockBrewingStand ajq, BlockEnchantmentTable aks `onBlockPlacedBy` call `add.u()` (hasDisplayName) then `setCustomName(add.s())`. EntityPlayerMP.displayGUIChest sends S2D with `getInventoryName()` and `isInventoryNameLocalized()`; displayGUIEnchantment sends its name or null with the flag from `!= null`. The ender chest has no name.
- recalled: GuiChest/GuiFurnace draw the provided title when the flag is set (not re-read this batch).

## Verification
- `node --test src/tilenames-b74.test.js`: 6 pass.
- 44 related files (region import/export, chest, hopper, brewing, container, block placement/break, nbtexport, dispenser, enchanting, dimension, chunk-runtime, command data, neg stacks, tilenames): 253 pass. `enchanting-container`, `mpbooks-b66`, `mpnether-b61`, `mpnether2-b62`, `mpnether3-b63`: 46 pass. `npm run build` ok.
- Full npm test not run (batch rule). `node --check` on every touched file. Nothing checked in a browser.

## Follow-ups
- Not seen in a browser: the named title in each GUI (single player and server).
- Names are not capped (native has no cap); the anvil's own cap applies at naming time.
- A table's name is not dropped by explosions (a new table placed there resets it); explosion code deletes chest/furnace records only.
- Chunk-resident saves keep `tableNames` in the metadata (not per column).
