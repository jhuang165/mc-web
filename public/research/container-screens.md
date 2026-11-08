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

## Batch 24 widgets
Widget geometry inside the panels is bytecode-read by `tools/verify-container-widgets.mjs` (javap of bex, bey, bcd, bfq, bfv, bfw, bez, bfd, bfc, bfb, bfa, bft, bfe; integer runs asserted per method) into `container-widgets-reference.json`, replayed by `src/container-widgets.test.js`:

- Slots: hit test is isPointInRegion padded by 1 (x - 1 <= mx < x + 17), first slot in list order (`slotAt`, was 16 x 16 DOM hit). Hover quad 0x80FFFFFF over item and count; split-drag quad the same colour under the item (drawRect before renderItem); a one-slot drag draws nothing in that slot.
- Anvil: name field is a no-background GuiTextField port (white with shadow, 0xFFD0D0D0 bar or "_", selection box, native scroll rule, click places the cursor by glyph widths); the `<input>` only takes keys. Cost line in glyphs at xSize - 8 - width, y 67, three shadow copies, or the two unicode-flag rects.
- Enchanting: rows v 185 / 166 / 204 by state, galactic name 0x685E4A / 0xFFFF80 / 0x342F25, glyph level at x 106 - width, y 9 (was page font at y 7); the 1.8-style option icons are gone.
- Beacon: tooltips through the 22 x 22 hit test as drawCreativeTabHoveringText (disabled buttons included), not browser `title`; payment icons draw no count.
- Book: laid out on the ScaledResolution width (`(width - 192) / 2`, buttons at `width / 2 - 100` / `+ 2`), re-laid out on resize.

## Batch 26 (containerui3)
- Slots: `container-widgets.js` `slotDrawOps` follows `GuiContainer.drawSlot` (bex.a(Slot)) / `drawScreen`. Items, counts, durability bars, the empty armour icon and the 0x80FFFFFF quads are drawn into `.container-draw` (`.gui-slot` per Slot at its x / y); the `<button>`s over it are transparent hit and focus targets keeping `data-container-slot` and `aria-label`. Order per slot as native: drag rect under the item, item, then (drawScreen) the hover quad over item and count for the `slotAt` hit, never for a disabled slot.
- Armour icon: drawSlot returns before the background icon when a one-slot split drag holds the slot (`dragSlots.size() == 1`), so the icon is not drawn then; the hover quad still is (drawScreen draws it after drawSlot returns).
- Merchant arrows (bfw `drawButton`): villager.png u 176, +12 when hovered and enabled, +24 when disabled; v 0 (next) or 19 (previous); hover is the Gui hit test on the GUI mouse position, not CSS. `merchantArrowDraw`.
- Beacon buttons (bfd `drawButton`): the sprite column is disabled 44, else selected 22, else hovered 66, else 0; the hit test (22 x 22) runs even when disabled. The icon quad is drawn with `glColor4f(1,1,1,1)`: the batch 24 opacity .5 on disabled icons was wrong and is removed. `beaconButtonDraw`.
- Anvil field: `src/text-field.js` `GuiTextField` ports `textboxKeyTyped` (bcd.a(char,int)): Ctrl+A/C/V/X, Backspace / Delete (word with Ctrl or Command), Home / End, arrows with Shift selection, `writeText`, `deleteFromCursor`, `deleteWords`, `getNthWordFromPos`. The `<input>` only mirrors the model; its own key editing is cancelled.

## Not verified / assumed
- Horse, donkey (chest) and villager screens were opened live in a world in headless Chrome (batch 24); the anvil, enchanting, beacon and book too. Nothing was compared against a running 1.7.10 client.
- Batch 26: nothing was compared against a running 1.7.10 client; the draw layer is DOM elements placed in GUI units, not GL.
- The galactic names stay a CSS mask (enchanting-book-live.js); the anvil field's mouse handling has no drag selection (native has none either). Word shortcuts accept Control or Command on every platform; native `bdw.q()` is Command on a Mac and Control elsewhere.
