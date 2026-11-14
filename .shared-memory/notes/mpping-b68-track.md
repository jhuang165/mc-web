# Batch 68 mpping: tab list ping, server list, GuiDisconnected

## Summary
- `src/multiplayer/server-ping.js` (new): `KeepAlive`, `ServerPings` (keep-alive every 40 ticks, S38 join/rotation/leave), `statusReply`, `handleStatus`.
- `src/multiplayer/client-ping.js` (new): `ClientPings` (answers keep-alive, S38 map), `pingServer` (status then probe), `rowState`, `pingAnimationRow`.
- `src/multiplayer/server-list-gui.js` (new): `ServerList` (localStorage `mc-web-servers`), `serverListScreen` (GuiMultiplayer), `addServerScreen`, `directConnectScreen`, `disconnectedScreen` (GuiDisconnected), layouts, `addressUrl`. Strings use `lang-en-us.js` keys through `tr`.
- Hooks: `server/server.js` (pings, pre-login status, `motd` option and `--motd` / `MC_WEB_MOTD`), `src/multiplayer/client.js` (`pings`, handled before buffering), `src/main.js` (`showMultiplayer` opens the list first; Join Server opens the sign-in screen for that address; tab list reads `multiplayer.pings`; both Disconnected screens).
- Wire messages: server to client `pingKeepAlive`, `pingList`, `pingStatusReply`, `pingProbeReply`; client to server `pingKeepAliveAck`, `pingStatus`, `pingProbe`. Status messages need no session and are handled before the join check, separate from any join refusal.
- Deviation: the list starts with the build's public server (native starts empty). Hide Address is not in 1.7.10 GuiScreenAddServer, so it is not offered.

## Evidence
- Bytecode-read: NetHandlerPlayServer (nh) keep-alive (`e - k > 40`, id `(int)ms`, `ping = (ping*3 + elapsed)/4`); ServerConfigurationManager (oi) S38 on login (1000 to others, all pings to the newcomer), logout, and the 600-tick rotation; NetHandlerPlayClient (bjb) S38 handling and `disconnect.lost`; bdf GuiDisconnected (title h/2-50 grey, message from h/2-30, button `gui.toMenu` at h/4+132, returns to the parent; callers use `connect.failed` while connecting); bfz / bge / bgc layouts (buttons, 305-wide 36-high rows, icon sprite, "Pinging...", "(no connection)", "Client/Server out of date!", `§4Can't connect to server.`); bdg / bde layouts; bjr status handling.
- Recalled: default motd "A Minecraft Server", player sample cap 12, resource pack mode cycle.
- Not executed: no Java probe (the rules are small and read directly).

## Verification
- `node --test src/mpping-b68.test.js`: 11 pass (includes a live server test). `node --test src/multiplayer.test.js`: 5 pass. `node --check` on touched files. Full npm test not run (batch rule).

## Follow-ups
- Only a browser could show the list rows, sprite alignment, hover tooltips and the Disconnected screen; none checked (batch rule).
- Server icon is supported on the wire (`favicon`) but the server has no option to load one yet.
- The pinging animation only redraws when a status arrives or the screen rebuilds.
