# Batch 81 potspacks81: pot drops of the stored stack, undrawn pot items, pot Data in S35, removing broken packs

## Summary
- Pot records (`src/stone-utility.js`) now hold two shapes:
  - A drawn plant: `{ id, damage }`, plus `data` when the exact native Data differs from the drawn plant's damage (b79).
  - An undrawn item: `{ id: 0, damage: 0, item, data, stack? }`. `item`/`data` are the tile's Item and Data. `stack` is the port stack of that ItemStack, absent when the port has no such item.
- `potFromNbt(tag, itemOf)`:
  - Any natively registered Item is kept (`nativeItemRegistered`, the 315 ids of the executed smallchecks sweep). Item 0 and unregistered ids are an empty pot.
  - Items the client does not draw become undrawn records. That covers stone, reeds, seeds, double plants, records and swords, and also a red flower, dandelion or tall grass with negative Data, which the client cannot draw (it was "empty" before).
  - `itemOf` is `region-import.js` `itemFromOriginal`. `region-import.js` and `falling-tiles.js` pass it. `stone-utility.js` keeps no runtime imports.
- Break and pick (`potStack`, `potDropEntry`, `potDrops`, `potPick`) give the tile's `ItemStack(Item, 1, Data)`:
  - A negative Data is 0, as in the ItemStack constructor.
  - A Data the catalogue has no variant for loads as the plant's or item's port stack at damage 0 with `rawDamage = Data`. This is the existing java-mobs.js convention, and `region-export.js` `stackNbt` writes it back as the native Damage. Examples: red flower 12 -> `{44, 0, rawDamage 12}`, tall grass 9 -> `{83, 0, rawDamage 9}`, record 2256:1.
  - An item the port lacks (carrots 141, potatoes 142, end portal 119, double slabs 43/125, farmland 60, lit furnace 62, spawner 52) drops nothing and picks nothing (`{id: 0}`), but still exports unchanged.
  - Pots holding an undrawn item are full (`potUse` refuses a plant), and `chunk-mesher.js` draws only the pot (no code change; `potPlantOf(0)` is null).
- Break paths:
  - `block-break-simulation.js` and `population-blocks.js` use `potDropEntry`, which passes `rawDamage` as makeStack metadata (`tags`).
  - `main.js` PopulationBlocks' `drop` callback now forwards `d.tags` to `makeStack`. This is a one-token edit.
- `inventory.js` `sameStackItem` now compares `rawDamage`. `ItemStack.isItemEqual` compares the damage, so red flower 12 no longer merges into poppies. This also applies to the horse-chest `rawDamage` stacks.
- Save and population: `serializePots`/`restorePots`/`setPotContents` copy the new fields. `validPotRecord` accepts either shape, and `population-runtime.js` restorePots uses it.
- S35 (`src/tile-sync.js`):
  - `potOf` adds `data`, and `item`/`stack` for undrawn records, to the pot description. A plain plant keeps the old `{kind, action 5, x, y, z, id, damage}` shape.
  - The client applies it in its own function, `applyPotTile`, which validates through `validPotRecord`. The `applyTiles` branch only calls it, so mpcmd81's S35 command-block edits merge separately.
- Resource packs (port choice, `src/resource-packs.js` `unlistedPackNames`/`deleteUnlistedPacks`, `src/resource-packs-ui.js`):
  - Stored packs that no longer load are unlisted (b80), as natively, so they have no row.
  - Natively the file sits in the resourcepacks folder until removed there.
  - The screen now shows a notice once on load when such packs exist. Delete pressed twice with the pointer off the pack rows removes all of them and drops their names from the saved selection. Nothing is reapplied, since applyPacks already skipped them.
  - The native two-button layout is unchanged.
- Docs: dated Batch 81 lines in `public/research/stone-utility-blocks.md` (a correction of the b80 line) and `public/research/resource-packs.md`.

## Evidence
- Executed (existing rows, replayed):
  - `pot-sweep-reference.json` potNbt rows (20). Every registered row now imports, and `potNbtOf` returns `out`. Unregistered 6000 and -5 are empty with out `[0, 0]`.
  - `smallchecks-reference.json` sweep: 315 registered ids, which equals the potSweep `items: 315`.
- Bytecode-read (this batch):
  - `apf` TileEntityFlowerPot: `b(dh)` writes `Item` = `adb.b(item)` and `Data`; `a(dh)` reads `adb.d(Item)` and Data with no check; `m()` is `new gf(x, y, z, 5, nbt)`.
  - `bjb.a(gf)` NetHandlerPlayClient.handleUpdateTileEntity: action 5 on an `apf` calls `readFromNBT`.
  - `add.<init>(adb,II)`: a damage below 0 becomes 0.
  - `ald.a(ahb,III,aji,int)` breakBlock: `new add(item, 1, data)`.
  - `ald.d`/`ald.k`: the pick item and damage come from the tile.
- Port-read:
  - `itemFromOriginal` returns null for damages with no variant.
  - The `rawDamage` export convention (`region-export.js` stackNbt, `advanced-tooltip-id.js`).
  - `makeStack` keeps metadata fields.

## Verification
- `node --test src/potspacks81-b81.test.js`: 7 pass, 0 fail. Coverage:
  - the registered set, and the potNbt rows through import, save and export;
  - undrawn pots (full, no plant drawn, drop and pick);
  - rawDamage drops and makeStack/sameStackItem;
  - the S35 round trip from a server World to a client World over JSON;
  - `deleteUnlistedPacks` on memoryStore;
  - source checks for the main.js, region-import, break paths and pack UI wiring.
- Old tests that encoded the gap were updated:
  - `flowerpots72-b72.test.js`: stone 1:0 is now kept undrawn; an import is either drawn or carries `item`.
  - `potspacks79-b79.test.js`: 38:-1 is kept undrawn, and the 38:12 drop carries `rawDamage: 12`.
  - `potspacks80-b80.test.js`: 31:-1 is kept undrawn, and the 31:9 drop carries `rawDamage: 9`.
  - `falling79-b79.test.js`: the native pot side passes `itemFromOriginal`.
- Neighbours: 47 files that import or source-match the edited modules (`--test-concurrency=3`) gave 436 tests, 435 pass and 1 fail. The fail was `falling79-b79.test.js` "every landed-tile row replays": its expected side built native pots with `potFromNbt` without the item resolver, so the stone and double plant pots, now kept, lacked their `stack`. It now passes `itemFromOriginal` and gives 6 pass, 0 fail. `block-break-simulation.test.js` was not run: earlier tracks report it spinning under batch load.
- `npm run build`: passes (only the existing chunk-size warning).
- Full npm test not run (batch rule). No browser check.

## Follow-ups
- Pots lose their plant on any removal other than a player break or a support loss. Natively `breakBlock` runs on every block change on the server, so an explosion, water washing a pot away, or /setblock also drops the plant. `explosion.js` returns only the pot item, and `world.js` deletes the record. blast81 owns explosion.js, so it was left alone.
- Pick block of a rawDamage pot gives the plain plant (`inventory.pick` takes id and damage only), where native picks `Item:Data`.
- `rawDamage` stacks: whether the multiplayer item/inventory wire carries `rawDamage` was not traced. Placing one places the damage-0 variant (native would place metadata = Data for ItemMultiTexture flowers).
- An empty pot with a stored Data and Item 0 or an unregistered id exports `Data 0`; natively the Data int is kept. This is cosmetic.
- Browser-only: the pack screen notice and Delete-off-rows removal, an undrawn pot rendering only the pot, and a client seeing the server's exact pot Data after a resend.
