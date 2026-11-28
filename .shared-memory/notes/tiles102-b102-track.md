# tiles102 (batch 102): tile entity NBT edge tags replayed against the real tile classes; spawner long Weight and empty flower pot Data fixed

Branch `batch102-tiles102`, worktree `wt102-tiles`. Target is 1.7.10. This does not claim full parity.

## Summary
- `src/spawner-data.js`: the `int()` reader of a SpawnPotentials entry (`Weight`, `Properties.Type`) accepted only JS numbers, so a long tag (BigInt) read as 0; it now reads through `nbtGet(..., NBT.INT)` (getInteger of any numeric tag: long wraps, double saturates, string 0).
- `src/stone-utility.js`, `src/region-import.js`, `src/tile-sync.js`, `src/setblock-tags.js`: a flower pot whose `Item` is 0 / unregistered / not an int keeps the `Data` it read (TileEntityFlowerPot.readFromNBT sets Data whatever Item is, writeToNBT writes both). New `emptyPot(data)`; empty records carry `data`; `potNbtOf` writes it; the Java import now pushes an empty record (before, it pushed nothing, so the block metadata's plant appeared and export wrote that plant's Item instead of Item 0); S35 description and `/setblock` keep the Data.
- `src/region-export.js`: the inline skull, beacon and mob spawner tile writers are now exported (`skullTileNbt`, `beaconTileNbt`, `spawnerTileNbt`) and used by `payload`; no behaviour change, it makes them testable.
- New: `tools/probes/Tiles102Probe.java`, `public/research/tiles102-reference.json` (193 records, 4 did not load), `src/tiles102-b102.test.js`.

## Evidence
- Executed (Tiles102Probe, real `aor.c` / `aor.b`, unchanged 1.7.10 jar classes, 193 records): spawner Delay / Min / Max widths (byte..double, string), EntityId int / empty / missing, SpawnData with and without EntityId, SpawnPotentials Weight (negative, zero, short, long, string, missing, max), Properties string / with id key, Type missing / int, extra keys, two entries, field widths; beacon Primary / Secondary / Levels widths and values (-1..100, ids 0..99); brewing stand slots (0..127, negative, dup, short / int / missing Slot), BrewTime widths, CustomName; flower pot Item and Data widths, 21 item ids, Data -70000..70000 on a flower and a sapling; skull SkullType / Rot widths and byte ranges; comparator widths; enchanting table CustomName; furnace slots and CustomName; hopper TransferCooldown widths, slots, names. The 174 rows for spawner, beacon, skull, pot, brewing, hopper, furnace written by the port after import now equal the native compound exactly; comparator and enchant table rows match through `intOf` / `getString` reads.
- Native result: all widths of Delay etc. are written as short, a string Delay reads 0; a pot with an unknown Item still writes the Data it read (the two bugs above were found by this replay).
- Port-read: the `region-import.js` pot hunk (the empty record push) needs a chunk with a pot block and is not run by the replay; the unit test covers the store / save / sync / `restorePots` path. Skull Owner rows (4) did not load in the probe (needs the MinecraftServer stub); tiles96 / tiles97 already cover Owner.

## Verification
- `node --test --test-concurrency=2 src/tiles102-b102.test.js`: 11/11. With `spawner-data.js` reverted: 9 pass, 2 fail (spawner rows, long Weight). The pot change is not revert-checked (the revert removes an export the test imports).
- Targeted run of 143 files naming spawner-data, stone-utility, region-import/export, tile-sync, setblock-tags, mob-spawner, flowerpot, cart-summon: 1722 tests, 1721 pass, 1 fail. The failure was `nbtexport73-b73` (pot import expected 1 record, got 2): my change, the import pushed an empty record for every empty pot. Fixed: the empty record is pushed only when the block metadata would imply a plant or the Data is nonzero (`region-import.js`). Re-run: `nbtexport73-b73` + `tiles102-b102` 14/14, and 8 pot / import / tile-sync files 65/65. The import hunk with a metadata plant and an empty tile is code-read only (no chunk test).
- `npm run build`: not run (no new imports to browser entry points beyond module-to-module). No full `npm test`, no browser.

## Found wrong in the batch 101 list
- None.

## Follow-ups
- Browser-only: none.
- Dedicated server pot record (`server-save.js`) was not audited for the empty record `data` field; it uses the shared `serializePots` / `restorePots`, so it follows by code reading only.
