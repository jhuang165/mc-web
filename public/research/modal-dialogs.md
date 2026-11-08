# Modal dialogs (batch 21 modalfont)

Target: Minecraft Java 1.7.10. Evidence label for every native claim below: **bytecode-read** (javap -c -p of the unchanged client jar, nothing executed, no probe). Positions are in `modal-dialogs.json` and pinned by `src/modal-dialogs.test.js`. This does not claim full GUI parity.

Batch 27 audit: `main.js` has no `modal()` call left (the container screens moved to `src/container-screens.js` and the written book to `book-ui.js` in batch 22; `grep 'modal(' src/*.js` finds only comments). The `#modal` element remains only as the host of the GuiContainer shell (`main.js` shell open/close, batch 22); no dialog is built in it. Every dialog was rebuilt in `src/modal-dialogs.js` as a `menu-ui.js` Gui screen: FontRenderer glyphs, GuiButton widgets, the `gui.button.press` click, GUI-scale units.

| Call site (old modal) | Native counterpart | Status |
| --- | --- | --- |
| `die()` "You died!" / "Game over!" | GuiGameOver (`bdc`) | native layout: gradient 0x60500000 -> 0xA0303030, title scaled 2x centred at (w/2/2, 30), score at y 100 ("Score: " + yellow), hardcore info y 144, 200 x 20 buttons at h/4 + 72 / + 96, buttons enabled after 20 client ticks (batch 25: counted on `Gui.tick`, not the wall clock), keyTyped empty |
| Death "Title screen" / "Delete world" confirmation | GuiYesNo (`bcw`) from `bdc.actionPerformed` id 1 | native: line 1 y 70, 150 x 20 buttons at h/6 + 96, 20 tick delay; Escape = displayGuiScreen(null), which with a dead player opens a new GuiGameOver |
| Sign editor (`openSignEditor`) | GuiEditSign (`bfx`) | title y 40, Done 200 x 20 at (w/2 - 100, h/4 + 120) native; board, stick and text placement derived from the drawScreen GL transforms (batch 25, see below) |
| Export World | none | PORT-ONLY, not native; glyph font, GuiIngameMenu-like rows (assumed) |
| `notes()` build notes | none | PORT-ONLY, not native; glyph text in a scroll area, Done at h - 27 (assumed); no element triggers it today |
| delete-world confirm, rename, share to LAN, confirm link, error screen | GuiYesNo, GuiRenameWorld, GuiShareToLan, GuiConfirmOpenLink, GuiErrorScreen | already Gui screens before this batch (`menus.js`, `loading-screen.js`) |
| containers, written book | GuiContainer family, GuiScreenBook | not modal-dialogs; still the DOM shell (containers) / its own bitmap layout (book) |

Behaviour fixes that came from the bytecode: the non-hardcore "Title screen" button now asks the quit question first (id 1 opens the GuiYesNo in both modes; before, it left immediately); "Respawn" on that question respawns; Escape does nothing on the game over screen (before, no key handling); Escape on the quit question returns to the game over screen.

Non-native by design: Export World and the notes page; `deathScreen.leaveServer` (remote servers only) is not applicable.

## Batch 25 guiscreens2 (bytecode-read; numbers in `gui-screens-reference.json`, written by `tools/verify-gui-screens.mjs`, pinned by `src/gui-screens.test.js`)

- GuiEditSign (`bfx.drawScreen`, `bmr`): `glTranslatef(w/2, 0, 50)`, `glScalef(-93.75, -93.75, -93.75)`, `glRotatef(180, 0, 1, 0)`, the block rotation
  (undone), `glTranslatef(0, -1.0625, 0)`, then the renderer at (-0.5, -0.75, -0.5) with f1 = 0.6666667 (wall: extra -0.3125). Under the orthographic
  GUI projection this puts the 93.75 x 46.875 board at y 68.359 (standing) or 97.656 (wall), the 7.8125 x 54.6875 stick at y 115.23, and the text
  origin at the board centre at 1.0417 GUI px per font px, lines at k * 10 - 20. The edited line shows `> text <` while `updateCounter / 6 % 2 == 0`
  (updateScreen `++`), now on the client tick instead of a 50 ms interval. Board texture face (2, 2) is assumed to be the front.
- GuiGameOver / GuiYesNo: the 20-tick delays count `updateScreen` calls (`Gui.tick`, fed from both client tick loops in `main.js`). Native
  GuiGameOver.initGui disables the buttons without resetting the counter, so a resize after tick 20 leaves them disabled for good; the port
  keeps them enabled after the release (deliberate deviation). A GuiYesNo rebuilt by a later initGui has enabled buttons, as natively.
- GuiAchievement (`beh`): x = scaledWidth - 160, `d = elapsed / 3000` (hint clamped at 0.5), slide `e = 2d` mirrored, `max(0, 1 - 4e)^4`,
  `y = -(int)(e * 36)` (quartic). Background `achievement_background` (96, 202) 160 x 32; title (30, 7) 0xFFFF00, name (30, 18) white, no shadow;
  hint drawSplitString at (30, 7) width 120. The toast still uses wall-clock milliseconds, as `Minecraft.getSystemTime` does natively.
- GuiTextField (`bcd`): enabledColor 0xE0E0E0, disabledColor 0x707070; GuiCommandBlock calls `setEnabled(false)` on Previous Output, so the
  port draws it (and its caret) 0x707070, read-only and out of the tab order.
