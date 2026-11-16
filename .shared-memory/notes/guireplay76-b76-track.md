# Batch 76 guireplay76: remaining menu replays, Generate Structures, remote hardcore death

## Summary
- Generate Structures in Create World is now a working toggle (default ON) for the four Java world types; the record gets `mapFeatures: false` and generationVersion 21 (streamed, no structure generators; java-world.js already supported 21) when it is switched off. Browser landscapes (Meadow, Highlands, Island, Snowy) keep the button drawn Off and disabled because they have no structures (port addition). Re-Create restores the flag from the old record.
- GuiGameOver: `gameOverScreen({ remote })` shows "Leave server" (deathScreen.leaveServer) on the hardcore button when connected to a server; main.js passes `remote: !!multiplayer`, and the hardcore "Delete world" path (deleting the active record) is skipped on a remote server.
- Add Server: the Server Resource Packs label ended without the reset code; the executed label is "Prompt§r". Fixed.
- New src/guireplay76-b76.test.js replays Multiplayer, Add Server (new and existing), Direct Connect, Disconnected, Rename World, Yes/No at 320x240, 427x240, 200x150 (buttons: rect, label, enabled; strings: left edge, y, colour; text fields by the native text origin), plus Resource Packs and Sleep geometry.

## Evidence
- Executed: all native rows (gui-menus-reference.json). Bytecode-read (javap of bdb = GuiCreateWorld): field `s` starts true, button 4 flips it, `bcb.l` (enabled) is only written for the Allow Cheats and Bonus Chest buttons, so Generate Structures is never disabled; executed records confirm it enabled for Default, Superflat, Large Biomes, Amplified. Port-read: everything about the port screens.
- Screens not replayable as Gui screens: Resource Packs (needs IndexedDB and the DOM; only the layout function, title, info line and both button rects are compared), Sleep (Leave Bed is a fixed DOM button in main.js, checked by position math and CSS text; the chat field is the shared chat UI), generic GuiYesNo (the port has no free-standing screen; its death-screen quit question and delete-world confirmation are replayed, labels differ by design), GuiYesNo4 (Yup/Nope custom labels, no port counterpart).
- Known differences kept: Multiplayer draws no "Scanning for games on your local network" line; Resource Packs pack-row text is not replayed.

## Verification
- node --test src/guireplay76-b76.test.js (31 pass), gui-menus-b75.test.js, menu-screens.test.js, gui-screens.test.js, gui.test.js, hardcore.test.js, modal-dialogs.test.js, generation-gate.test.js, map-features-off.test.js, catalogue-consistency.test.js, mpping-b68.test.js all pass. npm run build passes. Full npm test not run (batch rule). No browser checks.

## Follow-ups
- A world created with Generate Structures off at generation 21 was not generated here (only the existing java-world.js gate and tests cover 21); the finite `java*` generation 14 has no "off" variant.
- Remote hardcore: the client does not yet learn the server's hardcore flag from the join packet, so "Leave server" only shows if `active.hardcore` is set.
- Resource Packs pack rows and the Multiplayer LAN scan line are not replayed.
