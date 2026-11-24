# tiles100 (batch 100): numeric tag widths and extra keys inside ench / Explosion / Fireworks survive a load/save

Branch `batch100-tiles100`, worktree `wt100-tiles`. Target is 1.7.10. This does not claim full parity.

## Summary
- `src/item-tags.js` (shared): new helpers `setRawForm`, `rawFormTag`, `flagTag`, `sameNbt`, `shortOf`, `enchantEntryRaw`, `enchantEntryMap`; `rawForms` joins `RAW_MAPS` (so `readItemTags`, `cloneItemTags`, `sameItemTags` carry it). `map_is_scaling` reads/writes through it.
- Design: a modelled tag read in a non-canonical form keeps the tag as read. `stack.rawForms {Unbreakable, map_is_scaling, Explosion, Fireworks}` (raw `{t,v}`), and `raw` on an enchantment entry `{id, lvl, raw}`. The raw tag is written back only while the modelled value still equals what it reads as (flag nonzero-ness, `Explosion` / `Fireworks` model, entry id/lvl as getShort), so an edited stack writes the canonical byte / short form. Gameplay reads are unchanged.
- `src/region-import.js` (`readItemTag`): ench / StoredEnchantments entries keep `raw` when not exactly `{id short, lvl short}`; Unbreakable keeps its tag when not a canonical byte 0/1.
- `src/region-export.js` (`stackNbt`): enchantment entries via `enchantEntryMap`, Unbreakable via `flagTag`.
- `src/fireworks-nbt.js`: reading/writing Explosion and Fireworks keeps the compound as read (unknown keys, other widths); `readFireworks` split out.
- Copy points: `src/inventory.js` (`read` keeps entry `raw`; `samePairs` compares it, a raw entry does not merge with a canonical one as NBT differs), `src/mob-equipment.js` (`enchPair`, `skullFields` also copies `rawForms`; three `{id, lvl}` copies use `enchPair`), `src/mob-equipment-live.js` (`pairs`), `src/minecarts.js` (`itemTagsNbt` entries, Unbreakable, map_is_scaling).
- Shared-file changes, all small: `inventory.js`, `mob-equipment.js`, `mob-equipment-live.js`, `minecarts.js`.
- New: `tools/probes/Tiles100Probe.java`, `src/tiles100-b100.test.js`.

## Evidence
- Executed (Tiles100Probe, real `aor.c` / `aor.b` through a Chest, 18 records): Unbreakable and map_is_scaling as byte 5 / short / int / long / float / double, ench `{id int, lvl int}`, `{id long, lvl byte}`, extra key in an ench entry, extra key in a StoredEnchantments entry, Explosion with int Type / Flicker and an extra key, Fireworks with extra key and an Explosions entry with extra key: all 18 written back identical to the input (width and extras kept). Probe output is under `tools/research/tiles100-probe/` (ignored); no JSON reference committed.
- Port-read: RepairCost is only modelled as int (other types are raw since batch 99), so no width loss there.

## Verification
- `node --test --test-concurrency=2 src/tiles100-b100.test.js`: 4/4. With `item-tags.js`, `region-export.js`, `fireworks-nbt.js` reverted the file fails at import (0 pass), so it is a weak revert check; the assertions themselves compare the written tags with the input.
- Targeted run of 353 files naming region-import/export, item-tags, fireworks-nbt, inventory, minecarts, mob-equipment, command-tags, enchant: 3536 tests, 3534 pass. Two failures: `command-tags.test.js` (/give ench entries deepEqual `{id,lvl}`; the entry now also carries `raw`, so the assertion maps to id/lvl; the test encoded no wrong behaviour, only the entry shape, edited line 25) and `mpnether3-b63.test.js` Nether experience orbs (passes alone, flake, unrelated).
- `npm run build`: not run (no new imports in entry points; the new imports are module-to-module).
- No full `npm test`, no browser.

## Follow-ups
- Not done (scope 3 partly): single-player item-frame, dispenser and mob-equipment copies were checked by code reading only (skullFields / enchPair / inventory.read / readContainerTile -> readItemTag); no test per tile type beyond the stack-level copy test. Other `{id, lvl}` rebuilds elsewhere (anvil, enchantments.js) drop `raw` on purpose (modified stack).
- The dedicated server wire / `world-import.js` item copies were not audited for `raw` / `rawForms`.
- Browser-only: none.
