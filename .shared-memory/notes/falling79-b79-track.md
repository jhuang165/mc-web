# falling79 (batch 79): falling-block leftovers

## Summary
- Tile reads: every tile kind (chest, furnace, dispenser, dropper, hopper, brewing stand, sign, spawner, skull, flower pot, command block, note block, jukebox, beacon, comparator) was landed natively and replayed against `src/falling-tiles.js`. Fixed: sign wrong-typed Text, spawner wrong-typed EntityId and gate keys (MaxNearbyEntities, SpawnCount, RequiredPlayerRange), command block wrong-typed Command (also fixes the region-import path via `readCommandBlock`). New `src/nbt-string.js` (Java `NBTBase.toString` emulation for `getString` on a non-string tag).
- Flowing fluids: native ItemBlocks 8, 9, 10, 11 are four distinct items. The port keeps one item per fluid (10, 42), so a `rawId` (8 or 10) on the stack and `flowing` on the falling record now round-trip the flowing ids (import, FallingBlocks save/restore, drop stack, export).
- Item Fire: an imported item records the saved `Fire`; `ItemEntities.load` remembers it as `loadedFire` and `serializeOne` writes it while `ticks === 0`, so export writes the native value (0) instead of the Age-derived -1. Once the item ticks the old rule applies again.

## Evidence
- Executed: `tools/probes/FallingBlock78Probe.java` (`Tiles79`, 401 tile rows and 4 drop rows) against the 1.7.10 jar; output in `public/research/falling-tiles79-reference.json`. Drop rows: blocks 8, 9, 10, 11 each drop `Nx1` of the same id.
- Bytecode-read: `xj.h` landing (merged compound, readFromNBT), `NBTTagCompound.getString`, `MobSpawnerBaseLogic.readFromNBT` gates.
- Port-read: the item-Fire export formula (`region-export.js`) and the ticked-item -1 rule (kept for ticked items).
- Documented non-mismatches: hopper fresh cooldown (native -1, port 0, equivalent), dispenser/dropper empty name, skull ExtraType uuid (profile cache), command LastOutput errors (native crashes, port leaves the tile fresh).

## Verification
- `node --test src/falling79-b79.test.js` (6 tests: replay of all rows, flowing ids, item Fire, flowing falling record).
- Targeted suites listed in the final report; `npm run build` once at the end. No full `npm test`, no browser.
- Changed `inventory.js` `read` (keeps `rawId`), `region-import.js` (stack `rawId`, drop `fire`), `region-export.js` (`rawId`, falling `flowing`), `item-entities.js`, `falling.js`, `falling-drops.js`, `java-objects.js`.

## Follow-ups
- region-import sign and spawner readers still use `getString` semantics for wrong-typed values (only the command Command was routed through `getStringAny`).
- A flowing-fluid falling block still lands as the port's still/flowing cell without the flowing state; only ids and drops round-trip.
- A flowing-fluid stack merges with a still stack of the same port id in the live inventory (`sameStackItem` ignores `rawId`).
- A ticked item with Fire > 0 is not saved by `serializeOne` (pre-existing).
