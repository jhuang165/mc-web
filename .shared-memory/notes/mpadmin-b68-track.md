# Batch 68 mpadmin: dedicated-server administration commands

## Summary
- `src/multiplayer/server-admin.js` (new): `ServerAdmin` with ops, bans, IP bans, whitelist, profile cache and idle timeout; runs /op /deop /kick /ban /ban-ip /pardon /pardon-ip /banlist /whitelist (on/off/list/add/remove/reload) /stop /save-all /save-on /save-off /setidletimeout. Lists are saved in `DedicatedSimulation.save()` under `admin`, in the native file shapes (ops.json, banned-players.json, banned-ips.json, whitelist.json, usercache); ops are keyed by account UUID.
- `src/multiplayer/simulation.js`: constructs/saves `admin`, records the profile and idle clock on join/leave.
- `src/server-broadcast.js`: names added to `SERVER_COMMANDS`; `isOp` also accepts /op entries; `opLevel(name)`; operator `canUse` now also needs level >= command permission (MC_WEB_OPS names are level 4, so nothing changes for them); admin commands are intercepted before the single-player runner.
- `server/server.js`: join refusal (banned, whitelist, IP ban, native texts, sent as the close reason), client IP (X-Forwarded-For only when the peer is loopback), kick/stop/save hooks, idle kick, `/save-off` skips the timer and shutdown save, options `adminOptions` and `onStop`; env `MC_WEB_OP_LEVEL`, `MC_WEB_WHITELIST`.
- Tests: `src/mpadmin-b68.test.js` (10). Catalogue regenerated.

## Evidence
- Bytecode-read (javap on the 1.7.10 jar): command classes bc, aj, ag, af, be, bd, ax, cc, av, bh, bi, bj, bt, bo (arg counts, failure/success keys, "Kicked by an operator.", "You are banned from this server.", "You have been IP banned."); oi.a(SocketAddress, GameProfile) order and texts ("You are banned from this server!\nReason: ", "\nYour ban will be removed on ", "You are not white-listed on this server!", "Your IP address is banned from this server!\nReason: "); BanEntry default reason "Banned by an operator."; JSON field names; nh "You have been idle for too long!"; /op uses MinecraftServer.l() (op-permission-level).
- Recalled: op-permission-level default 4, white-list default false (dedicated classes are not in the client jar). No Java probe run (the lists are plain data; no executed reference JSON).

## Verification
- `node --test src/mpadmin-b68.test.js` 10 pass. Also servercommands-b59, mpcommands2-b60, serverbroadcast-b58, server-handlers, accounts, multiplayer, multiplayer-refusal, catalogue tests pass. Full npm test not run (batch rule).

## Follow-ups
- Not a browser check: the client shows the kick/ban text only through the WebSocket close reason (123 bytes max, truncated); a browser run would show how it renders.
- Behind a tunnel the IP is the forwarded one; a spoofed header from a non-loopback peer is ignored.
- /save-off skips the shutdown save as native does; /whitelist reload is a no-op (lists live in the save). No tab completion for the admin commands. Idle activity is an approximation (non-input messages, key presses, view turns).
- Names must be known (joined once or an account) for /op /ban /whitelist add, like the native profile cache.
