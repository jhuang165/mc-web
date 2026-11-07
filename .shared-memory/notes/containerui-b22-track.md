# containerui track, batch 22

## Summary
- Every container screen and the written book now open through a native GuiContainer shell (`src/container-screens.js`, `containerShell()` in `main.js`) instead of the page `modal()` dialog, which is removed. Gradient 0xC0101010 to 0xD0101010, panel at guiLeft/guiTop, glyph title and "Inventory" labels in 0x404040, no title bar or close button, E/Esc close as before.
- `container-ui.css`: `#modal.gui-shell` rules. `minecraft-ui.css`: the furnace page-font "Inventory" `:before` removed. `bitmap-text.js`: `.gui-label` added to `drawLabels`' default selector. `main.js` hunks: import line, the decoration label spans dropped, `modal(...)` replaced by `containerShell(...)`, `closeModal` disposes the shell, creative title via `drawLabel`, beacon labels via `drawBeaconLabels`, `openBook` host.
- No change to package.json, PROJECT.md or remaining-gaps.md.

## Native evidence
Bytecode-read (javap on classes bex, bdw, bfu, bfj, bfi, bfr, bfy, bfs, bfg, bfq, bey, bez, bfv, bft, bfl, bfe): xSize/ySize, every drawString position and colour, the default background gradient, initGui origin math, keyTyped. All in `public/research/container-screens-reference.json`. Headless-measured: guiLeft/guiTop and label offsets for 12 screens at 854x480. Assumed: book width (320 units), nothing else new.

## Tests
`npm test` and `npm run build`: see the final handoff for the counts. New `src/container-screens.test.js` (10 tests: gradient, sizes vs JSON, origin math at several sizes, label offsets, beacon centring, key action, markup escaping, routing audit of main.js, CSS). `modal-dialogs.test.js` call-site audit now expects zero `modal(` uses.
Headless Chrome (port 5191, --mute-audio, server stopped): inventory, chest, furnace, plus workbench, dispenser, hopper, brewing, enchanting, anvil, beacon, creative and book measured. Screenshots in `/Users/programming-xcode/Desktop/mc-web/artifacts/b22-containerui/`.

## Remaining gaps
- Horse and villager screens not opened live in a world.
- Book still lays out on a fixed 320 unit width; anvil cost line, enchanting extras and merchant/beacon widgets keep their DOM hosts and the DOM panel textures (slots are DOM buttons, not Gui slots).
- Slot hover highlight and drag overlays are CSS approximations of the 0x80FFFFFF quad.

## Proposed remaining-gaps lines
- Container screens and the book open in a native GuiContainer shell (gradient background, guiLeft/guiTop, glyph labels, no page-font chrome; bytecode-read, headless-measured); horse and villager were not opened live, and the book assumes a 320 unit width.
