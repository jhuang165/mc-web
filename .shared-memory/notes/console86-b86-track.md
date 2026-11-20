# console86 (batch 86): the console sender, offline mode and /netstat on the dedicated server

## Summary
- `Dedicated84Probe` now runs the dedicated commands from the console sender too: the MinecraftServer double itself, whose real `b_()` is "Server" and whose `a(int, String)` is true, so it has every level. It runs every form in base, lists, levels and offline, every form in offline mode for Alex, nine extra offline name cases, and 18 /netstat sub-command forms for console, Alex and Steve.
- The reference now has 1979 run rows and 0 crashes. The tab rows are still 64. The old 1401 rows and the tab rows are unchanged. Console rows: 540 (lists 144, base 135, levels 126, offline 135). Offline rows: 270.
- The port now has a console:
  - `ServerSocial.consoleCommand(line)` runs a line as the "Server" sender at level 4, position 0, 0, 0, in world 0. Its own lines go to `social.log`. The ops the command allows get the chat.type.admin notice; native has no "not the sender" skip for the console. A player-only operation from the console throws "You must specify which player you wish to perform this action on." (`y`).
  - A player's admin notices now also go to the server log (`bl.a`: `if sender != server`). The console's own notices do not.
  - `server/server.js` reads stdin lines with readline, queues the non-blank ones, and runs them after `social.drain()` in the tick. The log prints the unformatted text.
- Offline mode: `server.properties` `online-mode` is now honoured (`resolveSettings().onlineMode`, then `adminOptions.onlineMode`, then `ServerAdmin.onlineMode`). `ServerAdmin.profile(name)` lowercases the name. If the directory misses and the server is offline, it uses `{ uuid: offlineUuid(lower), name: lower }`. Only /op, /ban and /whitelist add resolve profiles. /deop, /pardon and /whitelist remove match entries by name; ban-ip and kick need an online player.
- /netstat:
  - A player still gets "Command is not available for players".
  - The console gets the NetworkStatistics texts: "reads: N, writes: N", `total-read-count`/`total-write-count`+N, `PacketStat(id){totalBytes=.., count=.., averageBytes=..}` for hottest/most/packet-read/packet-write, "Packet id is missing", "Packet X not found!" and "Unrecognized: X".
  - `server.js` records every WebSocket message both ways in `admin.netStats` under id 0.
- The replay harness moved from `src/dedicated-cmds-b84.test.js` to `src/dedicated-cmds-replay.js`, so both tests share it. Player rows now also compare the server log. Its directory knows Alex, Steve, Eve and Herobrine, as the probe's repository does.

## Evidence
- Executed (probe on the unchanged classes): all 1979 rows. The 675 console and offline rows (outside "partial") and the server log of every player row replay at 0 mismatches.
- Bytecode-read:
  - `bl.a(ac, aa, int, String, Object...)`: receivers, the `sender != server` log, flag 1
  - MinecraftServer `b_()`, `a(int, String)`, `a(fj)` (logs `fj.c()`) and `f_()`
  - `ns.a(String)` (Locale.ROOT lowercase) and `ns.a(MinecraftServer, String)` (the offline profile when `Y()` is false)
  - `yz.a(GameProfile)` ("OfflinePlayer:" + name)
  - `bb` CommandNetstat, `eu`/`ex`/`ey`/`ew`, the decoder `ez` and encoder `fa`
  - `y` getCommandSenderAsPlayer's text
- Recalled, not in the client jar: DedicatedServer's stdin reader and pending-command queue, run after the tick; a native offline login taking the offline UUID of the typed name.
- Port-read: the port's logins use account ids, and its WebSocket messages have no packet ids.

## Verification
- `node --test --test-timeout=600000 src/console86-b86.test.js`: 37 pass, 0 fail.
- `node --test --test-timeout=600000 src/dedicated-cmds-b84.test.js`: 17 pass, 0 fail. It now also checks the server log.
- Neighbours, run with `--test-concurrency=1`, 302 tests, 0 fail:
  - serverprops-b69, serverprops2-b70, mpadmin-b68, mpadmin71-b71, serverbroadcast-b58, servercommands-b59, mptabcomplete-b69, sptab-b70, pvp-b63, accounts
  - multiplayer, cmd-exec-b83, cmdblock83-b83, mpmisc74-b74, mpplayerfx75-b75, mpcmd80/81/82, mpscoreboard-b64, mpsummon-b67, summon2-b68, mpworldcmds-b68, worldflags77-b77
  - mpsettings72-b72, multiplayer-refusal, mpstate-b59, mpping-b68, mpstream72-b72, mptrackers71-b71
- `npm run build`: passes.
- Regenerate: `MC_PROBE_LIBS=<netty-all-4.0.10.Final.jar> MC_RESEARCH=<repo>/tools/research node tools/verify-dedicated-cmds.mjs` (about 3 s).
- No old test encoded the fixed gaps. The only source-text test on an edited file, pvp-b63 on server.js, still matches.

## Follow-ups
- Offline logins: joins still authenticate by account, so an offline-mode entry only matches a player whose account id is that UUID.
- /netstat packet ids: the port has one message type stream, so every message counts under id 0.
- The partial-saving rows stay unreplayed; the port has one world save.
- `command-parity-catalogue.md` (generated) still lists /netstat as Out of scope. Regenerate it in a docs sweep.
- Browser-only: nothing. The console is a terminal on the server process; no client UI changed.
