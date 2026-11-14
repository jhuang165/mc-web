# Batch 69 catalogues3: catalogue rows refreshed for batches 67-68

## Summary
- `tools/build-surface-catalogue.mjs`: GUI rows GuiMultiplayer, GuiScreenAddServer, GuiScreenServerList, GuiDisconnected, GuiErrorScreen, GuiPlayerInfo, and support rows ServerListEntryNormal, ServerListEntryNormal$1, ServerSelectionList (now Partial) and ServerListEntryLanScan / LanDetected (Out of scope: LAN discovery). Command catalogue: the hand-written "only /list" sentence and the "out of scope" sentence now compute from SERVER_COMMANDS (15 of 16 dedicated commands exist; only /netstat is Out of scope); dedicated row text names the admin commands file.
- `tools/build-settings-catalogue.mjs`: key.playerlist row mentions the ping bars over a connection.
- Regenerated every catalogue builder (content, surface, parity, recipe, settings, block-metadata); only command, gui and settings catalogues changed.
- Entity rows Painting, ItemFrame, LeashKnot already describe `server-hanging.js` (batch 68): checked, no change. Status-count lines are computed, not hand-written, except the command sentence fixed above.

## Evidence
- Code-read: `src/multiplayer/server-list-gui.js` (serverListScreen, addServerScreen, directConnectScreen, disconnectedScreen, gui.toMenu, disconnectHeading), `client-ping.js`, `main.js` onClose/player list `multiplayer.pings`, `src/server-broadcast.js` SERVER_COMMANDS, `servercommands-b59.js` SERVER_WORLD_COMMANDS (includes list), `.shared-memory/notes/mpping-b68-track.md`, `mpadmin-b68-track.md`. /netstat is in no command set. ServerListEntryNormal$1 as the ping thread is recalled from the class layout, not re-read.

## Verification
- `node --test src/catalogue-consistency.test.js src/content-catalogue.test.js` 6 pass; settings-catalogue test pass. Full npm test not run (batch rule).

## Follow-ups
- GuiConnecting row left as is (still no separate screen). Research docs (parity.md) were not touched.
