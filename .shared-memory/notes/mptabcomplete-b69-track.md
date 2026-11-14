# Batch 69 mptabcomplete: chat tab completion over a connection, animated "Pinging..."

## Summary
- `src/multiplayer/server-tabcomplete.js` (new): the server's answer to C14. `tabComplete(text, ctx)` follows MinecraftServer.func_71248_a; `possibleCommands` follows CommandHandler.getPossibleCommands (names and aliases in java.util.HashMap order, permission by op level; argument completion with no permission check); admin completions (op, deop, ban, ban-ip, pardon, pardon-ip, banlist, whitelist, kick); /say, /me, /tell complete player names at every word; every other argument list reuses `commands.js` `complete`. `socialTabComplete(social, id, text)` is the glue.
- `src/multiplayer/client-tabcomplete.js` (new): `RemoteTabCompletion`, GuiChat's real flow (request on Tab, common-prefix insert on reply, then cycling with the ", " list in chat line id 1).
- `src/commands.js`: `complete` reads `host.playerNames()` (default: the one local player) and skips its permission gate when `host.tabUnchecked`. Single player is unchanged.
- `src/chat-ui.js`: `hooks.remote()` chooses the connected flow; `tabReply(options)`; `resetTab()`.
- `src/main.js` (2 lines), `src/multiplayer/client.js` (1 line), `server/server.js` (import + 1 line).
- `src/multiplayer/server-list-gui.js`: pinging sprites follow `Date.now()` (every 50 ms, rows still pinging only, stops on close or when the rows are gone) without rebuilding the screen.
- Wire names: `tabReq {text}` (client to server), `tabReply {options}` (server to client).
- `tools/probes/TabProbe.java`, `tools/verify-tabcomplete.mjs`, `public/research/tabcomplete-reference.json`, `src/mptabcomplete-b69.test.js`.

## Evidence
- Executed: CommandHandler.getPossibleCommands on the 47 command classes the dedicated server registers (ServerCommandManager constructor order, /publish excluded), levels 0 to 4, 18 texts each: names, aliases, HashMap order (JDK 19), permission filter, argument lists of gamemode, difficulty, weather, time. The JS replay matches every record. The probe stubs MinecraftServer, its player list and the ban lists with Unsafe (integrated classes stand in for the dedicated ones, which are not in the client jar).
- Bytecode-read: GuiChat func_146404_p_, func_146405_a, func_146406_a (the first Tab only sends; the reply inserts the common prefix of all strings unless it equals the text from the word start to the end; otherwise cycling starts), NetHandlerPlayServer.func_147341_a, MinecraftServer.func_71248_a (slash drops, only a single word gets "/" back; split limit -1), z.b (no permission call in the arguments branch), the tab methods of ban, kick, op, deop, pardon, pardon-ip, banlist, whitelist, say, me, tell.
- Recalled: the order of UserList names (a HashMap keyed by UUID) is not emulated (insertion order). /ban, /ban-ip, /pardon need the list "enabled" flag (true on a dedicated server).
- Found: native completion lists commands in hash order, not sorted (the single-player `complete` still sorts and has no prefix step). Native shows `netstat` (level 0) and aliases `w`, `msg`, `?`; they are listed here too, though /netstat itself still answers "unavailable".

## Verification
- `node --test src/mptabcomplete-b69.test.js`: 15 pass.
- `node --test src/commands.test.js src/chat.test.js src/mpping-b68.test.js src/commands-extra.test.js src/chat-multi-b57.test.js`: 47 pass. `node --test src/mpadmin-b68.test.js src/serverbroadcast-b58.test.js`: 20 pass.
- `node --check` on every touched file; `npm run build` passes. Full npm test not run (batch rule). No browser checks.
- Scope check: `chatUi` (const, line ~2050) and `multiplayer` (module `let`) are module scope in main.js; the new hook lines run inside callbacks.

## Follow-ups
- Only a browser could show: the Tab key flow in the real chat box and the pinging sprite moving.
- Single-player Tab still uses the old synchronous flow (sorted list, no common-prefix step); it could use `RemoteTabCompletion` with `possibleCommands` for parity.
- The list-gui animation uses a 50 ms interval where native redraws per frame.
- UserList name order, `/whitelist reload`, `/netstat` remain open.
