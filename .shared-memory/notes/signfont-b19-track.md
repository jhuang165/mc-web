# Batch 19 signfont track

## Summary
- `src/sign-font.js` (new): canvas FontRenderer. `layoutString` (pure: ops per glyph, § colours, bold/italic/underline/strike/obfuscated, ascii.png vs unicode-page choice by the unicode flag, float pen) and `drawFontString` (cuts glyphs from the live ascii.png / unicode_page images, tinted per colour, cached; redraws when an atlas loads or resources refresh). Reuses `font-renderer.js` geometry; nothing forked from `bitmap-text.js`.
- `sign-renderer.js` drawSignText and `sign-editor.js` drawSignGui now use it (colour 0, no shadow, x = -getStringWidth / 2 int division, y = k * 10 - 20, `> text <` on the edited line). Sign texture key includes font.version, the unicode flag and the atlas version, so language / forceUnicodeFont / resource pack changes redraw signs. Text plane widened 90 -> 150 font px so wide unicode lines are not clipped.
- `font-renderer.js` glyphHtml: bold second copy offset is 0.5 px with the unicode flag (renderStringAtPos `f = unicodeFlag ? 0.5 : 1`), was always 1.
- `Durability: x / y`: 1.7.10 hardcodes it (ItemStack.getTooltip ldc "Durability: "; en_US.lang has no `item.durability`), so nothing to translate; asserted in a test. Other tooltip strings (Unbreakable, attributes, potion lines, enchantments, "by author", fireworks) already use lang keys.

## Native evidence
- Probed (executed): `tools/probes/SignFontProbe.java` runs the unchanged FontRenderer (bbu) over 19 sign lines for both unicode flags; `tools/verify-sign-font.mjs` writes `public/research/sign-font-reference.json`. Output in `<research>/signfont/`.
- Bytecode-read: bmr (TileEntitySignRenderer), bfx (GuiEditSign), bbu glyph/bold code, add (ItemStack.getTooltip strings). GuiEditSign has only the 15-char and isAllowedCharacter checks; no 90 px limit exists.

## Tests
`src/sign-font.test.js` (6 tests). `npm test` 4001 pass, `npm run build` ok.

## Browser check (headless Chrome, muted, port 5192, new creative then survival world; screenshots in `<research>/signfont/screens/`, not committed)
- Tooltip box with enchantment, blank line, blue attack line and advanced `Durability: 150 / 250` (F3+H): box size, padding, shadowed lines OK.
- Hotbar counts 64 / 16 / 3: right aligned to x+17, bottom aligned; held-item name; XP level 30 with black outline copies plus green; F3 panel: all rendered, no defects found needing a CSS change.
- Placed sign: edit screen and world plane show ASCII, accented Latin, CJK, Cyrillic, 15 x W line exactly filling the board.
- Observations, not fixed: the Singleplayer world list title "Select World" overlaps the Import/Endless buttons; the "Taking Inventory" toast's second text line spills below its box; the "Drag to look..." hint is page-font DOM text. Italic/strike/underline signs were only unit-tested, not viewed.

## Remaining gaps
- Sign italic/underline/strike/obfuscation drawn only in unit tests (no browser view); GL antialiasing differs (nearest canvas scaling at 4.17 px per font px in the edit screen).
- Edit screen layout still approximate; no multiplayer sign packet.

## Proposed remaining-gaps lines
Signs: world plane and edit screen are drawn with the FontRenderer glyph pages (ascii.png and unicode pages, unicode flag, § styles, pack fonts); widths probed natively, glyph drawing bytecode-read; edit-screen layout is approximate. `Durability:` is hardcoded English in 1.7.10 and stays English.
