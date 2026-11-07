# Books track, batch 18 (branch b18-books)

## Summary
- New native evidence: `tools/probes/BookGuiProbe.java` runs the unchanged GuiScreenBook (`bfe`) with the real FontRenderer (ascii.png + glyph_sizes.bin) and test doubles (Minecraft, GameSettings, TextureManager, net handler, LWJGL Keyboard/GL11 in `tools/probes/lwjgl-doubles/`, a real `yz` player). `tools/verify-book-gui.mjs` writes `public/research/book-gui-reference.json` (32 scenarios, 60 unicode wrap records); `src/book-gui.test.js` replays every step against `BookScreen` (state, buttons, drawn text and coordinates, sent stacks). `BookProbe` now records tag `keys` (cloning results), the old empty `BookGuiProbe` placeholder is gone from `verify-book.mjs`.
- Port fixes found by the replay: "Page x of y" was drawn 2 px too low (y 18 absolute, was 20); pasted text is now inserted raw like the original (no `§`/control stripping, CRLF to LF); title trimming uses Java `trim` (<= U+0020) for the Sign and Close enable rule and the sent title; a tagged stack without `pages` (renamed Book and Quill) starts with an empty page list, so typing does nothing until a page exists, as in the original; ctrl+V as a key char reads `clipboard()` (page mode only). `book-ui.js` now renders the shared `bookDrawList` (books.js) that the test checks.
- Glyphs above code 126: the port already used `getCharWidth` (ascii.png table + glyph_sizes.bin); the "width 6" gap text was stale. Now proven by 60 wrap records at 116/118/60 for both unicode flags.
- Author: `PLAYER_NAME` ("Player", `death-messages.js`) is the project-wide fixed local player name, now passed from `main.js` instead of a literal; documented as the session username equivalent. The probe shows the client takes the author from the player name, and the title screen shows `by <name>`.
- No generation tag in 1.7.10: probed for sent stacks (keys are `pages`/`author`/`title`/`display` only) and for RecipeBookCloning results; the port adds none (asserted).

## Tests
`npm test` 3897 pass / 0 fail; `npm run build` ok. New file `src/book-gui.test.js` (7 tests). Regenerate with `MC_RESEARCH=<dir> node tools/verify-book.mjs` and `node tools/verify-book-gui.mjs`.

## Probed vs bytecode-read
Probed: layout and draw calls, blink, keys, backspace/enter, limits (256 chars, 118 px, 50 pages), paste (via the private insert method), sign flow, button visibility and enabled rules, constructor page list, sent stacks, unicode wrapping. Bytecode-read: page arrow textures/hover, button drawing, bidi flag, server handlers MC|BEdit/MC|BSign, the real clipboard read.

## Remaining gaps
- No pixel comparison of the DOM page against a GL render; arrows/hover and the bidi flag are bytecode-read; ctrl+V uses the browser paste event; the server handlers are not probed (NetHandlerPlayServer needs a server double).

## Proposed replacement for remaining-gaps Priority 1 item 1
1. Book and Quill, Written Book and the book screen (items 386, 387; GuiScreenBook). Mostly done: items, recipe, cloning, tags, NBT and the edit/sign screen are probed against the unchanged GuiScreenBook (page wrap, indicator, cursor, keys, limits, paste, sign flow, buttons, sent stacks, real glyph widths; [books.md](books.md)); the author is the fixed local player "Player"; remaining: page-arrow hover/textures, bidi and the MC|BEdit/MC|BSign server handlers are bytecode-read, no pixel render comparison.
