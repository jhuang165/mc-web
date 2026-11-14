# Batch 72 mpsettings72: the whole C15 ClientSettings on the dedicated server

## Summary
- `src/multiplayer/server-settings.js` (new): `clientSettingsMessage(options)` (client), `applyClientSettings` (stores language, view distance, chat visibility, chat colours, difficulty; sets the b71 hide-cape flag), `chatDelivered` (S02 filter), `chatSendAllowed`.
- `server/server.js`: hooks only. `send()` drops `chat` messages the recipient's visibility hides; `settingsClient` handler (malformed values throw, so the socket is refused); the `chat` handler returns early for HIDDEN players.
- `src/multiplayer/client.js`: `clientSettings(options)`. `src/main.js`: the three `capeSettings` calls (two joins, `saveOptions`) now call it. The server still accepts the old `capeSettings`.
- `tools/build-settings-catalogue.mjs` row text (chat visibility, colours, show cape) and the regenerated `settings-parity-catalogue.md`.
- New wire name: `settingsClient {language, view, chat, colours, difficulty, cape}`.

## Evidence
- Bytecode-read (javap on `iu`, `mw`, `nh`): C15 order is language (max 7 chars), view distance byte, chat visibility byte (`table[id % 3]`), chat colours, difficulty byte (`table[id % 4]`), show cape.
- Bytecode-read: `EntityPlayerMP.func_147100_a` stores language, chat visibility and colours; the view distance is computed (`256 >> n`) and dropped; difficulty is applied only for the integrated-server owner, never on a dedicated server; show cape sets the hide-cape flag.
- Bytecode-read (whole jar searched): nothing reads the stored language or chat colours. So the gap "strip colour codes when off / translate server messages" is wrong: the 1.7.10 server does neither. Colours and translation stay client-side. The view distance is also ignored (our own `server-chunk-view.js` uses the server rules, unchanged).
- Bytecode-read: `NetHandlerPlayServer.sendPacket` drops every S02 for HIDDEN, and for SYSTEM when the packet's flag is false (player chat). `processChatMessage` answers HIDDEN with red `chat.cannotSend` before the command branch and before the spam counter, but that answer goes through the same `sendPacket` filter, so the hidden player never sees it. We therefore refuse silently (same visible result). Hidden players also cannot run commands.
- Recalled: which native lines use flag false (player chat only); here a line with a sender `name` is player chat, everything else a system line.
- Executed: node tests only.

## Verification
- `node --test src/mpsettings72-b72.test.js`: 4 pass (includes a live two-player server: one hides chat, then SYSTEM, then a malformed message). With `src/catalogue-consistency.test.js src/content-catalogue.test.js src/mpcapes-b71.test.js src/chat-options.test.js`: 24 pass.
- `node --check` on every touched JS file; the `main.js` hooks only call `client.clientSettings(options)` / `multiplayer.clientSettings(options)` with identifiers already in scope.
- Single-player options for chat visibility and colours already exist and the chat log honours them (`chatDelivered`, colour stripping in `chat.js`).
- Full npm test not run (batch rule). No browser check.

## Follow-ups
- A hidden-chat player's own `tabReq` replies are not gated (native does not gate C14 either; recalled).
- Language is stored but there is no translation of server messages (native has none).
