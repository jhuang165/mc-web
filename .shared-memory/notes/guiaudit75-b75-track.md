# Batch 75 guiaudit75: executed GUI menu probe and replay

## Summary
- Built an executed probe (tools/probes/GuiMenusProbe.java, Scenarios.java, LWJGL doubles in tools/probes/gui-doubles) that runs the real 1.7.10 `initGui` and `drawScreen` of about 40 screen variants with a fake Minecraft at 320x240, 427x240 and 200x150, recording `buttonList` and `drawString`. Output: public/research/gui-menus-reference.json (tools/verify-gui-menus.mjs).
- src/gui-menus-b75.test.js replays those records against the port screens (menus.js, modal-dialogs.js) through src/gui-record.test-helper.js. Differences must equal a documented allow-list per case.
- 13 Partial rows in public/research/gui-parity-catalogue.md now cite executed evidence: GuiControls, GuiCreateWorld, GuiGameOver, GuiIngameMenu, GuiMainMenu, GuiOptions, GuiScreenOptionsSounds, GuiVideoSettings, GuiSelectWorld, GuiLanguage, GuiShareToLan, ScreenChatOptions, GuiConfirmOpenLink.
- Found wrong and fixed: Difficulty hidden in Options without a world (native always shows it); Controls key list width 235 (native 252, entries were 9 px right); Open to LAN enabled on a remote server (native disabled).

## Evidence
- executed: every native position, label, enabled state and string in gui-menus-reference.json (bao subclass, real bbj, recording bbu).
- bytecode-read: the older gui-screens-reference.json; rows not probed here (Multiplayer, ResourcePacks, AddServer, ServerList, Disconnected, Error, Working, SleepMP, RenameWorld, YesNo) are recorded in the JSON but not replayed against the port.
- Known differences left in the allow-lists: Export World, Import/Export/Endless (port additions); Broadcast, Snooper, Touchscreen, Multiplayer, Realms, Quit, Generate Structures drawn disabled (browser limits); remote hardcore Leave server wording.

## Verification
- executed: node --test src/gui-menus-b75.test.js (57 pass), menu-screens.test.js, gui-screens.test.js, gui.test.js, catalogue-consistency.test.js, content-catalogue.test.js.
- Full npm test not run (batch rule).
- Only a browser could show the actual rendering of the moved Controls entries and the Options Difficulty button.

## Follow-ups
- Replay Multiplayer, ResourcePacks, AddServer, DirectConnect, Disconnected, SleepMP, RenameWorld and YesNo against the port using the existing reference rows.
- Generate Structures toggle is an open limitation.
