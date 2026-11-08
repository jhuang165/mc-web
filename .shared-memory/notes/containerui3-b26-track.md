# containerui3 (batch 26): Gui-drawn container slots, merchant and beacon hover, anvil key editing

## Summary
Never claim full parity. Follow-up to containerui2-b24.
- Slots: `slotDrawOps` / `slotDrawHtml` (`container-widgets.js`) follow `GuiContainer.drawSlot` and `drawScreen`. Items, counts, durability bars, the empty armour icon and the 0x80FFFFFF quads are drawn into `.container-draw` (`.gui-slot` per Slot). The slot `<button>`s are now transparent hit and focus targets (`data-container-slot`, aria-label kept). The pointer hit test is still `slotAt` (isPointInRegion, padded by 1). `main.js` `slotsHtml` and the slot loop in `refreshContainer` changed; input handling is untouched.
- Armour slot background icon: no longer drawn during a one-slot drag (drawSlot returns first). The hover quad is still drawn (drawScreen).
- Merchant arrows: sprite from `merchantArrowDraw` (bfw drawButton: u 176 / 188 hover / 200 disabled) using the GUI mouse position. CSS `:hover` removed.
- Beacon buttons: sprite from `beaconButtonDraw` (bfd drawButton: disabled 44, selected 22, hovered 66, else 0). CSS `:hover` removed. The disabled icon at opacity .5 (batch 24, unverified) is removed: bfd draws the icon quad with plain white.
- Anvil name field: new `src/text-field.js` `GuiTextField` ports `textboxKeyTyped`, `writeText`, `deleteFromCursor`, `deleteWords`, `getNthWordFromPos`, `setSelectionPos`, `setCursorPosition`. `container-widgets.js` routes keydown through it, completes copy / cut / paste through the clipboard events, and mirrors the model into the transparent `<input>`. A pointer press focuses the input and places the cursor by glyph widths (no drag selection, as native).
- Deviation: word shortcuts accept Control or Command on every platform (native `bdw.q()` is Command on a Mac, Control elsewhere).
- Evidence: javap of bex (drawScreen / drawSlot), bfw, bfd, bcd (textboxKeyTyped), bdw (isCtrlKeyDown) from the unchanged jar. Research doc: `public/research/container-screens.md` "Batch 26".

## Verification
- `npm test`: 4589 pass, 0 fail.
- `npm run build`: passes.
- Live: muted headless Chrome (vite :5266, `?silent`, master volume 0, 1280 x 800). Script and PNGs in `artifacts/b26-containerui3/` (`live-check.mjs`).
  - Inventory: 45 draw slots for 45 buttons; hover quad over the item (z 6), +1 unit past the edge still hits; the four armour icons show; with a diamond helmet held, press and a small move on the helmet slot leaves the slot with no icon and only the hover quad; a three-slot drag shows quads under the items (z -1).
  - Chest, furnace, anvil, villager, beacon opened.
  - Anvil: Ctrl+Left jumps 25 -> 21 -> 17, Shift+Left and Shift+Home select, Ctrl+A selects all, Backspace deletes the selection, Ctrl+Backspace deletes a word, Ctrl+Delete deletes the next word.
  - Beacon: hover sets column 66, the disabled button stays 44 and its icon is opacity 1.
  - Merchant: the summoned villager had one offer (both arrows disabled); hover set `data-hover=true` while the sprite stayed at the disabled column 200.

## Follow-ups
- Items are still DOM sprites (img / CSS mask layers), not a canvas draw; the enchant glint is the CSS approximation.
- Merchant arrow hover on an enabled arrow was only unit-tested (no villager with more than one offer was found live).
- Real copy / paste through the system clipboard was not driven in headless Chrome; the model-level keys are tested.
- The creative search field (`creative.js` TextField) still has its own partial key handling and could adopt `GuiTextField`.
- Beacon buttons and enchant options are not keyboard-activatable by Enter on a focused button (pre-existing).
