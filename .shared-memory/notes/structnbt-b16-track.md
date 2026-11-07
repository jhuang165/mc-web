# structnbt track, batch 16 (branch b16-structnbt)

Changed: Fortress start and 15 piece ids in `structure-nbt.js`; `data/Fortress.dat` write (`structure-data.js` `fortressDataFile`, called from `region-export.js`) and live restore of imported starts (`fortress-restore.js`, 2 lines in `dimension-live.js`); witch hut created/populated reference and replay; JSON `bases` round trip for whole-save worlds (`whole-save-json.js`, `main.js` export/import wiring); CLI `--whole-save` (`whole-save-cli.js`, `tools/import-java-region.mjs`).

Probed (JDK 19, jar sha1 e80d9b3b...): `fortress-nbt-reference.json`, `temple-nbt-reference.json`. Bytecode-read only: Fortress.dat in root data/ (shared MapStorage), Seed/Chest/Mob field meanings.

Tests: `fortress-nbt`, `temple-nbt`, `fortress-restore`, `whole-save-json`, `whole-save-cli`, edits to `structure-nbt`, `structure-data` tests.

Shared files touched: `main.js` (import, exportWorld bases, importBlockworldData bases, toast), `region-export.js`, `dimension-live.js`.

Remaining: jungle temple populated flags not replayed in JS (unported redstone wire onBlockAdded); native fortress-6 reload flaked once; exported fortress starts are created state; bases round trip not browser-checked; ZIP export blockworld.json backup lacks bases.
