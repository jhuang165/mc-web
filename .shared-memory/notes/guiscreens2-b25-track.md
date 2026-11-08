# guiscreens2 (batch 25): GuiEditSign geometry, tick-driven delays, the toast, the disabled text field, GuiSelectWorld's error screen

## Summary
This track covers non-container GUI screens only. It does not claim full GUI parity. All native numbers below are bytecode-read (javap -c -p of the 1.7.10 client jar, nothing executed). `tools/verify-gui-screens.mjs` checks the jar's sha1, asserts constant runs in bfx, bmr, beh, bdc, bcw, bcd, bfh, bdh, bdx and bdt, and writes `public/research/gui-screens-reference.json`. `src/gui-screens.test.js` replays that file.

- **GuiEditSign:**
  - `signGuiGeometry` (`src/sign-layout.js`) derives placement from the drawScreen GL transforms: translate (w/2, 0, 50), scale -93.75, rotate 180, then lift -1.0625 and the renderer's own offsets.
  - The board is 93.75 x 46.875. Its top is at y 68.359 for a standing sign and 97.656 for a wall sign. The stick is 7.8125 x 54.6875. The text is at the board centre, 1.0417 GUI px per font px.
  - `sign-editor.js` paints at 8 canvas px per GUI px, placed inside the Gui screen.
  - The `> text <` blink is driven by the screen tick (`updateCounter / 6 % 2`). The 50 ms setInterval is gone.
- **Delays:** `Gui.tick()` (GuiScreen.updateScreen) is fed from both client tick loops in `main.js`: the running loop and the dead loop. Two hook lines were added.
  - GuiGameOver and GuiYesNo count 20 ticks there instead of 1000 ms of wall clock.
  - A GuiYesNo rebuilt by a later initGui has enabled buttons, as natively.
- **GuiAchievement toast:**
  - It is placed at native x = scaledWidth - 160 (ScaledResolution `ceil`), replacing CSS `right:0`.
  - Already matching the native code: the slide curve (quartic, `max(0, 1 - 4e)^4`, 36 px), the background region (96, 202) 160 x 32, and the text colours and positions.
- **GuiTextField:** this gains an `enabled` option. When disabled the text and caret are 0x707070 (0xE0E0E0 when enabled) and the field is read-only. GuiCommandBlock's Previous Output uses it, matching `bcd.c(false)` in bfh.
- **GuiErrorScreen:** GuiSelectWorld's `"Unable to load worlds"` + `e.getMessage()` case is added for the case where `readWorldShelf` fails at boot.
  - While the shelf is unreadable, `persist()` refuses to write, so a broken shelf is not overwritten with `[]`.
  - Cancel goes back to the title screen.
- **Catalogue:** GuiErrorScreen, GuiScreenWorking and GuiDownloadTerrain rows are added or corrected. There are now 0 Missing; the totals are 99 Partial and 25 Out of scope.
- **Research docs:** `modal-dialogs.md` (new batch 25 section) and `loading-screens.md` (the GuiSelectWorld error).

## Verification
- `npm test`: 4471 pass, 0 fail. `npm run build`: OK. `node tools/verify-gui-screens.mjs`: ok, with `MC_RESEARCH` pointing at the Desktop tools/research folder and no symlink.
- Live headless Chrome run: vite on port 5254, CDP on 9454, `--mute-audio`, master volume 0, 1280x720, GUI scale 3. Scripts and PNGs are in `artifacts/b25-guiscreens2/`.
  - `sign-standing.png`: board x 498-780, y 205-346; stick down to y 510. This equals 3 x the derived geometry.
  - `sign-wall.png`: board top at y 293, which is 3 x 97.66.
  - `sign-blink-0.png`: shows `> blink <`. Region hashes toggle about every 300 ms (6 ticks).
  - `achievement-toast.png`: toast at x ~801 = 3 x (427 - 160).
  - `command-block-output.png`: Previous Output span colour #707070 with shadow #1c1c1c, readonly, tabindex -1.
  - `error-screen.png`: "Unable to load worlds" / "Saved world Lost World is unavailable". Cancel goes to the title screen and the shelf is kept.
  - `death-early.png`, `death-released.png`: the buttons are disabled until about 1030 ms, then enabled.
  - No page errors.
- Nothing was compared pixel for pixel against a GL render of the real client.

## Follow-ups
- **GuiGameOver deviation:** natively, initGui disables the buttons and never resets the counter, so a resize after tick 20 soft-locks the screen. The port keeps them enabled after the release, on purpose.
- **Sign board texture:** face (2, 2, 24, 12) of `sign.png` is assumed to be the front. The sign's GL lighting and shading are not reproduced.
- **Port-only `#toast` notices** (main.js `toast()`): these have no native counterpart and keep their CSS placement. Only the GuiAchievement toast was ported.
- **Toast timing:** the toast still runs on wall-clock ms. This is native (`getSystemTime`), but it does not pause with the game.
- **Unreadable shelf:** the "Unable to load worlds" state lasts until reload; there is no retry. New worlds created in that state are not persisted.
- **GuiScreenWorking:** built (`workingScreen`) but never shown. Natively only the old-format conversion opens it, and the port has no such path.
- **Gui.tick while paused:** `Gui.tick` only runs while the world ticks or the player is dead. Natively, runTick calls updateScreen even when the game is paused. No current screen that pauses the game depends on this, but a future ticking pause screen would need a third hook.
