# Languages and the unicode font

Target: Minecraft Java 1.7.10 (client sha1 e80d9b3b...). Not full parity; see the gaps below.

## Evidence

`tools/probes/LanguageProbe.java` runs the **unchanged** `bbu` (FontRenderer) and `brs` (Locale) classes from the jar through test doubles for `Minecraft`, `GameSettings`, `TextureManager` and `IResourceManager`. `tools/verify-languages.mjs` (needs `MC_RESEARCH`) asserts that `src/font-renderer.js` and `src/lang.js` agree with them and writes `public/research/languages-reference.json`:

- character widths for all 65536 characters with the unicode flag off and on;
- string widths for strings with unicode text, bold and section codes;
- the Locale parser, fallback order and unicode threshold on fixtures, and the unicode flag and key count of each of the 73 real language files.

`src/languages.test.js` replays the recorded rows. The structure of `GuiLanguage` (list sorted by code, "name (region)", Force Unicode Font button, no bidi button in 1.7.10) and `GameSettings` (`lang:`, `forceUnicodeFont:`) was read from bytecode, not probed.

## Rules

- Locale loads `["en_US", selected]`; later keys win, so a missing translation is English. Lines: skip empty and `#`, split at the first `=`, rewrite `%n$d` / `%f` style arguments to `%s`.
- Unicode flag: `Locale.isUnicode() || forceUnicodeFont`. `isUnicode` is more than 10% of the merged values' characters at or above 256, compared as floats (exactly 10% counts). The brief's "1%" is not what the bytecode does.
- Widths: ascii.png cells give `(int)(0.5 + (rightmost opaque column + 1) * 8 / cellWidth) + 1`; with the unicode flag, or for characters outside the 256 table, `glyph_sizes.bin` (signed byte; start = byte >>> 4, end = byte & 15, end > 7 reads as 0..15) gives `(end + 1 - start) / 2 + 1`. Space is 4, `§` is -1, bold adds 1 per visible glyph.

## In the game

- `npm run lang:fetch` (`tools/fetch-lang.mjs`) installs the 73 `.lang` files from the asset index into the ignored `public/lang/1.7.10/` with SHA-1 checks and writes `manifest.json`, following `tools/fetch-music-streams.mjs`. Without the manifest only English (US) is offered and the Language screen says so. The language files are Mojang's and are not committed.
- The Language screen (`src/menus.js`) lists languages sorted by code, marks the current one, and has Force Unicode Font. Choices persist in `options.txt` (`lang:`, `forceUnicodeFont:`).
- Selecting overlays the language onto the menu strings, command texts (chat translations), achievements and death messages at once (`src/lang-hooks.js`); keys missing in the file stay English.
- `public/media/1.7.10/font/glyph_sizes.bin` ships with provenance. The unicode glyph pages (`unicode_page_XX.png`, already shipped in `public/media/1.7.10/font/` with provenance entries) are drawn at half scale by `src/menu-ui.js` for menus, chat and books widths.
- Localization round 2 (batch 16): `stackName`/`displayName` (`src/item-names.js`) is the one display-name function: a custom (anvil/NBT) name first, then the selected language through the unlocalized item keys, then the baked English name. Used by the item tooltip, the held-item name popup, command output and the anvil. The keys (`src/item-keys-data.js`, 315 items, per damage) are probed: `tools/probes/ItemKeyProbe.java` runs `Item.getUnlocalizedNameInefficiently(ItemStack)` of the unchanged jar for every registered item/block-item and damage 0-15 (0-255 for the spawn egg), recorded in `public/research/item-keys-reference.json` by `tools/verify-item-keys.mjs`; the script also asserts that the jar's en_US value of each key equals the already-probed English display name (zero mismatches). Names the item class composes (potion 373, spawn egg 383) are not plain `key.name` lookups: potions use `item.emptyPotion`, `potion.prefix.*`, `<effect>.postfix` and `item.potion.name`; spawn eggs use `item.monsterPlacer.name` + `entity.<EntityList name>.name` (the entity names per damage are probed too). Those two compositions are bytecode-read (the English results are replayed against `item-names-reference.json`).
- Container titles and labels (`src/container-names.js`): Inventory, Crafting, Furnace, Repair & Name, Enchant, Chest, Large Chest, Ender Chest, Dispenser, Dropper, Item Hopper, Brewing Stand, Minecart, Villager (`entity.Villager.name`) and Beacon (`tile.beacon.name`) map from their default English title to the lang key (keys bytecode-read; the en_US values are checked equal to the English titles). A custom container name is left alone, except that one identical to a default English title is localized as well. Also through the language: potion tooltip lines (effect names, potency, `potion.empty`, `potion.effects.whenDrank`, attribute names), enchantment names, `item.unbreakable`, the attack damage line, bed messages and Leave Bed, and the Now playing line.
- A resource pack's `ascii.png` is measured with the same width computation; its `font/glyph_sizes.bin` replaces the shipped one.

## Gaps

- Item, block and container text is translated (above) but drawn in the HTML/TTF font; only DOM menus and chat use the bitmap/unicode renderer. Still English: `Durability:` (hard-coded in 1.7.10 too), the firework tooltip lines, `item.skull.player` heads, horse and trade GUI labels, achievement/statistics screens beyond b15, the creative tab labels, entity names in the F3/boss bar, and mob display names outside spawn egg names. Internal-only items with no 1.7.10 key keep their Title Case English name. Signs hold player text and are not translated in 1.7.10 either.
- No bidirectional reordering or Arabic shaping (Language.bidirectional is read but not applied).
- Underline, strikethrough, italic and random (`§k`) styles are not drawn with unicode glyphs.
- Characters whose `glyph_sizes.bin` byte is 0 draw nothing, as in the original.
