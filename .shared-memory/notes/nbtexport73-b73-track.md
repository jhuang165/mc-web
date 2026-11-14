# Batch 73 nbtexport73: flower pot and fieldless tile entities in region import/export

## Summary
- `src/region-import.js`: `FlowerPot` tiles read `Item`/`Data` through `potFromNbt` into `record.pots` (restored by `restorePots`); `DLDetector` and `EnchantTable` tiles are counted as converted (they hold nothing the port stores). Imported pots are no longer in `tileEntities.lost`.
- `src/region-export.js`: every pot (original id 140), ender chest (130), enchanting table (116) and daylight sensor (151) cell writes its native tile entity. A pot writes `Item`/`Data` from `record.pots` or, with no record, from its block metadata (`potContentsOfMeta`); an empty pot writes 0/0 as native does.
- `src/nbtexport73-b73.test.js` (new, 3 tests).

## Evidence
TileEntity table (ids from the `TileEntity` static init, bytecode-read; fields from each class's `a(dh)`/`b(dh)` constants, bytecode-read):

| id | native fields | import | export |
|---|---|---|---|
| Furnace | Items, BurnTime, CookTime, CustomName | yes (no CustomName) | yes (no CustomName) |
| Chest | Items, CustomName | yes (trapped chest by block) | yes (no CustomName) |
| EnderChest | none | yes | yes (new) |
| RecordPlayer | Record, RecordItem | yes | yes |
| Trap / Dropper | Items, CustomName | yes (no CustomName) | yes |
| Sign | Text1-4 | yes | yes |
| MobSpawner | spawner logic fields | yes | yes |
| Music | note | yes | yes |
| Piston | blockId, blockData, facing, progress, extending | yes | yes |
| Cauldron (brewing) | Items, BrewTime, CustomName | yes (no CustomName) | yes (no CustomName) |
| EnchantTable | CustomName only | counted (new) | empty tile (new) |
| Airportal | none | yes | yes |
| Control | command logic | yes | yes |
| Beacon | Primary, Secondary, Levels | yes | yes |
| Skull | SkullType, Rot, Owner | yes | yes |
| DLDetector | none | counted (new) | empty tile (new) |
| Hopper | Items, TransferCooldown, CustomName | yes | yes |
| Comparator | OutputSignal | yes | yes |
| FlowerPot | Item, Data | yes (new) | yes (new) |

- bytecode-read: trapped chest signal is not saved. `TileEntityChest` writes only Items and CustomName; the signal is the runtime viewer count. The daylight sensor tile (`apa`) has no NBT methods; its power is block metadata, which the cell export already keeps (test asserts meta 7 returns).
- TileTicks: already exported (`i`,`x`,`y`,`z`,`t`,`p`) and imported for fluids, fire, falling blocks and redstone by `tile-ticks.js` (batch 29 evidence, `tile-ticks-reference.json`; `tile-ticks.test.js` redstone cases). The gap in `redstone-live.md` is closed by reading plus the new fluid round trip test. Executed this batch: the test round trip only, no new Java probe.
- recalled: the daylight sensor sets its metadata in its own tick (not re-read this batch).

## Verification
- `node --test src/nbtexport73-b73.test.js`: 3 pass.
- `node --test src/region-export.test.js src/region-import.test.js src/chunk-nbt.test.js src/tile-ticks.test.js src/flowerpots72-b72.test.js src/interchange-links.test.js src/imported-whole-save-dims.test.js src/stone-utility.test.js`: 153 pass.
- No new Java probe: `PotSweepProbe` already executed the native pot NBT. Full npm test not run (batch rule). Nothing checked in a browser.

## Follow-ups
- `CustomName` on chests, furnaces, dispensers/droppers, brewing stands and enchanting tables is dropped on import and never written (only hoppers keep a `name`). Needs a name field on those records and the container titles.
- Pot cell metadata is not set from `Data` on import (the port keeps the plant in `world.pots`).
- A world with a missing pot record and mismatched meta writes the meta-implied plant; native always has the tile.
