# containerui2 (batch 24): widgets inside the container screens, live horse/villager screens, book width

## Summary
Never claim full parity. Follow-up to containerui-b22. The screens still render as DOM; this batch moves the widgets inside them to bytecode-read geometry, colours and draw order.
- New `src/container-widgets.js`:
  - `slotAt`: the GuiContainer hit test, padded by 1. It is used by `main.js` `at()` and replaces the 16 x 16 `elementFromPoint` hit.
  - `slotShown`: a one-slot split drag draws nothing in that slot.
  - The anvil cost line and name field.
  - The enchanting option rows.
- Slot quads (`container-ui.css`):
  - The hover quad is 0x80FFFFFF over the item and its count. This is the same byte as the old `.5`, because Chrome stores the alpha as 128 either way.
  - The split-drag quad moved under the item; it was an `:after` drawn over it.
- Anvil:
  - The `<input>` is transparent and only takes keys, selection and the clipboard. `#anvil-name-draw` draws the no-background GuiTextField: white glyphs with a shadow, the 0xFFD0D0D0 bar or "_", and the selection box.
  - Scrolling follows the native `setSelectionPos`. It keeps native's overshoot: when the cursor lies past the visible run, native draws no caret and draws an inverted box at the end. The bytecode confirms this, but nobody has seen it in a live Java client.
  - A click places the cursor by glyph widths.
  - The cost line is drawn in glyphs: three shadow copies, or the two rects when the unicode flag is set.
- Enchanting:
  - The row v value is set by state (185 / 166 / 204) and the hover comes from the GUI mouse position, not CSS `:hover`.
  - The name tint is set inline.
  - The level is drawn in glyphs at x 106 - width, y 9 (it was page font at y 7).
  - The 1.8 option icons are removed.
- Beacon (`pyramid-gui.js`):
  - `beaconTooltip` runs a 22 x 22 hit test. It draws the tooltip through the slot tooltip box and includes disabled buttons; browser `title` became `aria-label`.
  - The payment icons no longer show a stray yellow "0" count. A stale regex in `refreshBeacon` was causing it.
- Book (`book-ui.js`, `container-screens.js`):
  - The layout uses the ScaledResolution width instead of a fixed 320, and is redone on resize.
  - The buttons use `trunc(width / 2)`.

## Native evidence
- Bytecode-read: `tools/verify-container-widgets.mjs` checks the jar sha1 and asserts integer-constant runs in `javap -c -p` for 13 classes (bex, bey, bcd, bfq, bfv, bfw, bez, bfd, bfc, bfb, bfa, bft, bfe). It writes `public/research/container-widgets-reference.json`, which also records each class's sha256.
- I also read `bcd.f()` (drawTextBox: the selection is clamped to the visible length and drawn when `k != j`), `bcd.a(III)` (mouseClicked) and `bey` initGui (no setFocused; the field is enabled from slot 0).
- Merchant arrows and crosses, beacon geometry and horse backgrounds already matched the bytecode, so their CSS did not change.

## Verification
- `npm test`: 4360 pass, 0 fail. This includes the new `src/container-widgets.test.js` (6 tests) and the updated `src/lang-keys.test.js`.
- `npm run build`: passes.
- `node tools/verify-container-widgets.mjs` (with `MC_RESEARCH` set to the jar folder): passes.
- Live run in headless Chrome:
  - Setup: vite on port 5242, CDP on 9442, `--mute-audio`, master volume 0. I created a new survival world with cheats on.
  - Screens opened:
    - The villager (merchant) screen, by right-clicking a summoned villager.
    - A tame horse and a chested donkey, by sneak + right-click.
    - An anvil, an enchanting table and a beacon on a 3x3 iron base.
    - A book and quill, at 1280x800 (scale 3, width 427) and 1001x700 (scale 2, width 501).
  - Results:
    - Hover one unit past a slot edge still highlights the slot.
    - The split drag shows quads under the items.
    - The anvil name and cost are drawn as glyphs.
    - The enchant hover row is v 204 and the level sits at left 100 for "2".
    - The beacon tooltip reads "Speed".
  - Screenshots and the driver (`live-check.mjs`) are in `/Users/programming-xcode/Desktop/mc-web/artifacts/b24-containerui2/`. Both servers are stopped.

## Follow-ups
- Slots are still DOM buttons, not Gui-drawn quads. Merchant arrows and beacon buttons still use CSS `:hover` on the button rect (the same rect as the native test).
- The galactic option names are still a CSS mask. The anvil field's key editing (word jumps, shift selection) is the browser's, not `GuiTextField.textboxKeyTyped`.
- A disabled beacon button's icon is drawn at opacity .5. This is unverified against bfd.
- The armour slot's background icon still shows during a one-slot drag, where native draws nothing in that slot.
- The tutorial toast covers the top right of the screens, as before.
- Nothing has been compared pixel by pixel with a running 1.7.10 client.
