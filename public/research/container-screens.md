# Container screens (batch 22)

Evidence labels: bytecode-read = javap of the unchanged 1.7.10 jar; headless-measured = DOM geometry in headless Chrome at 854x480 (GUI scale 2); assumed = not from the jar. Numbers live in `container-screens-reference.json` and are pinned by `src/container-screens.test.js`.

## What changed
The player inventory, crafting table, chests (also ender and trapped), furnace, dispenser/dropper, hopper, brewing stand, enchanting table, anvil, beacon, villager trading, horse inventory and the creative inventory, plus the written book, no longer open inside the page `modal()` dialog. `modal()` is gone. `containerShell()` in `main.js` hosts them through `src/container-screens.js`:

- Background: `drawDefaultBackground` gradient 0xC0101010 to 0xD0101010 over the whole display (bytecode-read, bdw.c_), as the `#modal.gui-shell` CSS.
- Panel at `guiLeft = (scaledWidth - xSize) / 2`, `guiTop = (scaledHeight - ySize) / 2`, int division of the ceil'd scaled size (bytecode-read, bex.b()); recomputed on resize.
- No title bar, no close button, no `h2`. Titles and the "Inventory" label are glyph text, 0x404040, no shadow, at the offsets in the reference JSON (bytecode-read). Centred titles use `xSize / 2 - getStringWidth / 2`.
- Escape or the bound inventory key closes (GuiContainer.keyTyped, bytecode-read); this was already how `main.js` routed keys, and a focused anvil text field keeps the inventory key.
- Item tooltips, slot logic and panel art are unchanged.

## Fixes found on the way
- The furnace screen drew its "Inventory" label as a page-font CSS `:before` pseudo-element; it is now the glyph label.
- Creative tab switching set the title with `textContent` (page font); it now redraws the glyph label.
- Beacon "Primary Power" / "Secondary Power" were left-aligned page-ish text; they are now drawCenteredString glyph text at x 62 / 169, y 10, 0xE0E0E0 with shadow (bytecode-read).
- The book moved to the same host: a plain GuiScreen with the gradient, the 320 unit box at x `(scaledWidth - 320) / 2`, y 0.

## Not verified / assumed
- Horse and villager screens were not opened live in a world (the shell code path is the same); chest, furnace, inventory, workbench, dispenser, hopper, brewing, enchanting, anvil, beacon, creative and the book were measured headless.
- The book layout still assumes a fixed 320 unit width (book-ui.js), not the real screen width.
- The anvil cost line, the enchanting book and option text, and the beacon/merchant widgets keep their earlier DOM hosts.
