# Modal dialogs (batch 21 modalfont)

Target: Minecraft Java 1.7.10. Evidence label for every native claim below: **bytecode-read** (javap -c -p of the unchanged client jar, nothing executed, no probe). Positions are in `modal-dialogs.json` and pinned by `src/modal-dialogs.test.js`. This does not claim full GUI parity.

The DOM `modal()` helper of `main.js` is now used only by the container screens (`openContainer`) and the written-book screen. Every other call site was rebuilt in `src/modal-dialogs.js` as a `menu-ui.js` Gui screen: FontRenderer glyphs, GuiButton widgets, the `gui.button.press` click, GUI-scale units.

| Call site (old modal) | Native counterpart | Status |
| --- | --- | --- |
| `die()` "You died!" / "Game over!" | GuiGameOver (`bdc`) | native layout: gradient 0x60500000 -> 0xA0303030, title scaled 2x centred at (w/2/2, 30), score at y 100 ("Score: " + yellow), hardcore info y 144, 200 x 20 buttons at h/4 + 72 / + 96, buttons enabled after 20 ticks, keyTyped empty |
| Death "Title screen" / "Delete world" confirmation | GuiYesNo (`bcw`) from `bdc.actionPerformed` id 1 | native: line 1 y 70, 150 x 20 buttons at h/6 + 96, 20 tick delay; Escape = displayGuiScreen(null), which with a dead player opens a new GuiGameOver |
| Sign editor (`openSignEditor`) | GuiEditSign (`bfx`) | title y 40, Done 200 x 20 at (w/2 - 100, h/4 + 120) native; the canvas position inside the screen is assumed |
| Export World | none | PORT-ONLY, not native; glyph font, GuiIngameMenu-like rows (assumed) |
| `notes()` build notes | none | PORT-ONLY, not native; glyph text in a scroll area, Done at h - 27 (assumed); no element triggers it today |
| delete-world confirm, rename, share to LAN, confirm link, error screen | GuiYesNo, GuiRenameWorld, GuiShareToLan, GuiConfirmOpenLink, GuiErrorScreen | already Gui screens before this batch (`menus.js`, `loading-screen.js`) |
| containers, written book | GuiContainer family, GuiScreenBook | not modal-dialogs; still the DOM shell (containers) / its own bitmap layout (book) |

Behaviour fixes that came from the bytecode: the non-hardcore "Title screen" button now asks the quit question first (id 1 opens the GuiYesNo in both modes; before, it left immediately); "Respawn" on that question respawns; Escape does nothing on the game over screen (before, no key handling); Escape on the quit question returns to the game over screen.

Non-native by design: Export World and the notes page; `deathScreen.leaveServer` (remote servers only) is not applicable.
