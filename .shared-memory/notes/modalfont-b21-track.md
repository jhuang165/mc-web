# modalfont track, batch 21

## Summary
- `modal()` DOM dialogs rebuilt as Gui screens in new `src/modal-dialogs.js`: GuiGameOver (normal and hardcore) with its GuiYesNo quit question, the sign editor chrome (GuiEditSign title/Done), Export World and the build notes page (both port-only, flagged). `main.js` hunks: import line, `die()` tail replaced by `showGameOver()` / `respawnPlayer()` (body moved unchanged, the onclick recursion became a call), `chooseExport`, `notes()`, one `openSignEditor` call. `modal()` now has 3 users (definition, `openContainer`, `openBook`).
- Bytecode fix: GuiGameOver id 1 opens GuiYesNo in a normal world too (the port left immediately), Escape on the game over screen does nothing, Escape on the confirmation re-opens GuiGameOver (Minecraft.displayGuiScreen with health <= 0). Buttons wait 20 ticks on both screens.
- `sign-editor.js`: the DOM Done button moved into the host (`show(title, html, { done })`). `menu-screens.css`: game-over gradient, HUD hiding, notes scroll classes. `notes-content.js` holds the old notes text as data.
- No change to package.json, PROJECT.md or remaining-gaps.md.

## Native evidence
Bytecode-read (javap, jar classes bdc GuiGameOver, bcw GuiYesNo, bfx GuiEditSign, bdh GuiErrorScreen, bao.displayGuiScreen): positions, strings, delay, key handling, confirmClicked branches; all in `public/research/modal-dialogs.json`. Inferred: `a.o` in the score string is EnumChatFormatting.YELLOW (enum order). Not probed: no JVM probe was written (the screens need a Minecraft instance and GL).

## Tests
`npm test` 4168 pass / 0 fail (new `src/modal-dialogs.test.js`, 10 tests: layout vs JSON at four GUI sizes, hardcore.js agreement, routing of every screen with a fake Gui, delay timing, Escape/Enter, export busy/failure paths, main.js call-site audit). `npm run build` ok.
Headless Chrome (--mute-audio, vite port 5183, stopped, harness page deleted): game over, hardcore, quit confirm, export and notes screens at 854x480 (GUI scale 2). Screenshots in `/Users/programming-xcode/Desktop/mc-web/artifacts/b21-modalfont/`. Not run: a live death in a real world, the sign editor in a world, an actual Java export.

## Remaining gaps
- Container screens (`openContainer`) still use the `modal()` DOM shell; the book screen keeps its own layout.
- Sign canvas placement inside GuiEditSign is assumed (board is the ModelSign at scale 93.75; not derived), and the sign canvas size ignores scale 93.75 geometry.
- Export and notes layouts are assumed. The notes page has no trigger element.
- The 20 tick delay is wall-clock (50 ms per tick from the first frame), not the client tick counter. Death screen HUD hiding is CSS `body:has`.

## Proposed remaining-gaps lines
- Page-font `modal()` dialogs: GuiGameOver, its GuiYesNo quit question, the sign editor title/Done, Export World and the notes page now use FontRenderer glyphs and native positions (bytecode-read); Export and notes are port-only layouts; containers still use the DOM modal shell.
