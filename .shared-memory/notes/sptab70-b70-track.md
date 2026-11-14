# Batch 70 sptab70: single-player Tab on the integrated flow, UserList order, /whitelist reload

## Summary
- `src/sp-tabcomplete.js` (new): `spTabComplete(text, {name, cheats, complete})`, the integrated server's MinecraftServer.func_71248_a. Single player now uses `RemoteTabCompletion` (request on Tab, common-prefix insert, cycling with the ", " list in chat line 1), answered synchronously.
- `src/multiplayer/server-tabcomplete.js`: integrated profile (`INTEGRATED_KEY_ORDER`, `INTEGRATED_BY_KEY`, `integratedCommandNames`): 31 common commands plus `/publish`, 35 lookup keys in HashMap order. `ALL_WORDS` exported.
- `src/multiplayer/client-tabcomplete.js`: `waiting` is set before `request()` (the single-player reply arrives inside it).
- `src/chat-ui.js`: untouched (the flow was already behind `hooks.remote()`). `src/main.js`: import plus the `remote`/`request` hooks (always remote; no connection means the local answer). `src/commands.js`: `complete(before, unchecked)`.
- `src/multiplayer/user-list-order.js` (new): `UserMap` (remembers its peak size), `hashKeyOrder`, `userListValues`, `userListKeys`. `server-tabcomplete.js` uses them for deop, pardon, pardon-ip, whitelist remove.
- `src/multiplayer/server-admin.js` (list code only): lists are `UserMap`s; `/whitelist reload` calls `reloadWhitelist()`; add and remove call `writeWhitelist()`; `whitelistFile = { read, write }` hook.
- `server/server.js` (one block): `admin.whitelistFile` reads and writes `whitelist.json` beside `server.properties` (the world file's directory).
- Probes: `tools/probes/TabProbe.java` (integrated profile, second handler), new `tools/probes/UserListProbe.java`; `tools/verify-tabcomplete.mjs` writes `integrated` and `userLists` into `public/research/tabcomplete-reference.json`. Tests: `src/sptab-b70.test.js` (6).

## Evidence
- Executed: getPossibleCommands on the integrated command set (32 classes, 35 keys; cheats off and on; 30 texts each); the sender follows EntityPlayerMP.a(int, String) (modelled in the proxy, see below). The dedicated records are byte-identical to batch 69. Executed: the real UserList subclasses (UserListBans `op`, UserListOps `oj`, UserListWhitelist `or`, IP list `nx`) with 40 puts and removals down to 6; the JS order matches at 5, 13, 26, 40 puts and after removals (the table does not shrink; `UserMap.peak` models it).
- Bytecode-read: `bl` constructor (31 common, then `MinecraftServer.X()` branch: 16 dedicated commands, else `/publish`); `mw.a(int, String)` (seed always on a non-dedicated server; tell, help, me always; otherwise op status, then level 4 `>=` required); `om` (UserList: `Maps.newHashMap()`, keys `a(Object)` = toString; profile lists key by `getId().toString()`; the name arrays iterate `values()`, the IP list's `a()` is `keySet().toArray`); `oi.a()` (func_152599_k) is an empty method in the base ServerConfigurationManager; `om` has no load method in the client JAR.
- Recalled: the dedicated player list overrides it to re-read `whitelist.json` (the loader is server-only); a missing file changes nothing; the file name `whitelist.json`.
- Found wrong or refined: the entry class names in the b69 note (`or`/`oj`) are swapped for ops and whitelist (ops = `oj`, entries `ok`; whitelist = `or`, entries `os`); the behaviour recorded there is unaffected. Single-player op level is 4 with cheats (recalled, `MinecraftServer.l()`).

## Verification
- `node --test src/sptab-b70.test.js src/mptabcomplete-b69.test.js src/mpadmin-b68.test.js src/commands.test.js src/chat.test.js src/commands-extra.test.js src/serverbroadcast-b58.test.js src/mpping-b68.test.js`: 81 pass. `src/accounts.test.js src/mpsurvival-b58.test.js`: 12 pass. `src/player-throw-replay.test.js`: 2 pass.
- `node --check` on every touched file; scope check: `spTabComplete` (import), `commands`, `commandHost`, `chatUi`, `multiplayer`, `PLAYER_NAME` are module scope in main.js. `npm run build` see the report. Full npm test not run (batch rule). No browser checks.

## Follow-ups
- Only a browser could show: the Tab key in the single-player chat box.
- `/banlist`, `/whitelist list` and `/op`-style listings still print insertion order; natively they also iterate the HashMap (not read here). `/whitelist add` name completion (PlayerProfileCache order) is still insertion order.
- Whitelist writes are not atomic and the file is not read at start-up (the save data is the source until a reload).
- Lists saved in `save()` are in insertion order, not HashMap order (affects only same-bucket order after a restart).
