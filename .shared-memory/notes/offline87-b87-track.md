# offline87 (batch 87): offline-mode logins, /netstat packet ids and the partly-off saving rows

## Summary
- Offline logins: with `online-mode=false`, a signed-in account now joins as the offline profile of its name: `ServerAdmin.loginProfile(account)` gives `{ uuid: offlineUuid(name), name }` (case kept). Online mode keeps the account id.
  - That UUID is the player's `resumeKey`. It keys the refusal checks (ban, whitelist, op pass), the saved player in `savedPlayers`, the tamed owners and `/list uuids`.
  - `server.js`'s account directory, the port's stand-in for the profile repository, answers with the same login profile. So /op, /ban and /whitelist add made before a first join match the joining player.
  - A name with no account still resolves natively: the lowercased offline profile (b86).
- Saved player data key: online = account id (`savedPlayers` key and `ops.json` uuid); offline = `UUID.nameUUIDFromBytes("OfflinePlayer:" + name)`. Switching a server's mode therefore starts every player fresh and leaves old list entries unmatched, as natively.
- Credentials: the session token stays in the join message only. Nothing new is logged. The live tests capture `console.log/error/warn` and the server log and assert that no session token, password, password hash or salt appears.
- /netstat: `src/multiplayer/net-packet-ids.js` maps each WebSocket message kind to the native packet id it stands for. Both directions are covered, with handshake, status and login ids sharing the 100 slots as in the one native NetworkStatistics.
  - `server.js` records reads after the JSON parse (ez counts only registered ids) and writes in `send`.
  - Kinds that cover several native packets pick by content: `blocks` (S23 for one cell, else S22), `mobs` (its first packet), `vehicles`, `sb`, `edit` and `use`.
  - The `tick` bundle counts once, under S18.
  - Port-only kinds (`pickup`, `windowInventory`, `invBroke`) and unknown types are not counted.
- Partial saving rows: `ServerAdmin.levelSaving` is one flag per WorldServer (Overworld, Nether, End).
  - /save-off and /save-on set every flag and report a change if any world changed (bi.b/bj.b).
  - `autosave` is now a getter/setter over the Overworld flag. The port has one save file.
  - The 4 partial rows replay at 0 differences. `dedicated-cmds-b84.test.js` no longer skips them, and the harness compares every world's flag.
- `command-parity-catalogue.md` was regenerated with `node tools/build-surface-catalogue.mjs`. The generator now also counts the ServerAdmin-only commands (`ADMIN_COMMANDS`). /netstat is Partial with a b86/b87 note, and 16 of 16 dedicated commands exist.
- `public/research/commands.md`: a dated batch 87 correction paragraph.

## Evidence
- Executed with `tools/probes/Offline87Probe.java`; `node tools/verify-offline87.mjs` writes `public/research/offline87-reference.json`. It needs `MC_PROBE_LIBS=<netty-all-4.0.10.Final.jar>`; trove4j and authlib 1.5 are found under the launcher libraries.
  - `nn.a(GameProfile)` (NetHandlerLoginServer.func_152506_a) for 10 names. Alex and alex differ. All match `offlineUuid`.
  - `yz.a(GameProfile)`: a name-only profile gives the offline UUID; a complete one keeps its id.
  - `eo` (EnumConnectionState) maps, class names via joined-1.7.10.srg: HANDSHAKING 1/0, PLAY 24/65, STATUS 2/2, LOGIN 2/3.
- Executed (existing Dedicated84Probe rows): the 4 "partial" rows (world 0 saving off, worlds 1 and 2 on).
- Bytecode-read:
  - `nn.c()`: an incomplete profile gets `a(profile)`, then `oi.a(SocketAddress, profile)`, `oi.f(profile)` and `oi.a(ej, mw)`.
  - `oi.f`: "You logged in from another location" by `yz.a(profile)` UUID.
  - The `yz` constructor: the entity UUID is `a(profile)`.
  - `ayq.a(yz)`/`b(yz)`: `playerdata/<aB() uuid>.dat`.
  - `fa`/`ez`: (id, frame bytes) into `eu`; unregistered ids throw first.
  - `bi.b` (save-off).
  - MinecraftServer's 900-tick autosave: `oi.j()` (all player data) and then `a(Z)`.
- Port-read: logins authenticate an account session and then take the profile. The port keeps one save file for all dimensions.

## Verification
- `node --test --test-timeout=600000 src/offline87-b87.test.js`: 9 pass, 0 fail. It covers the reference, the profiles, every id against the executed maps, content-picked ids, server.js read-type coverage, the partial rows, and live offline, online and /netstat servers.
- `node --test --test-timeout=600000 src/dedicated-cmds-b84.test.js`: 17 pass, 0 fail, now including the partial rows.
- Neighbours, `--test-concurrency=1`, 258 tests, 0 fail:
  - console86-b86, dedicated-cmds-b84, mpadmin-b68, mpadmin71-b71, mpping-b68, accounts, multiplayer, multiplayer-refusal
  - serverprops-b69, serverprops2-b70, pvp-b63, mptabcomplete-b69, sptab-b70, mpbooks-b66, mpplayerfx75-b75, servercommands-b59
  - catalogue79-b79, catalogue-consistency, settings-catalogue, skins73-b73, mpstate-b59, mpsettings72-b72, serverbroadcast-b58, mpmisc74-b74
- Old test updated: `dedicated-cmds-b84.test.js` no longer leaves out the "partial" setup. The replay harness's `saving` field is now the per-world array.

## Follow-ups
- Natively the 900-tick autosave runs `saveAllPlayerData` even with saving off. The port's save timer skips the whole save while /save-off is on (bytecode-read, not changed).
- /netstat bytes are JSON lengths, not VarInt frames. A bundled message counts once: the tick holds S03, S22/S23 and weather besides the S18 poses.
- Offline mode still requires an account sign-in. The port does not accept an unauthenticated typed name, so the typed name is the account name.
- An account renamed while online keeps its old UUID until it logs in again. Offline, the new name is a new player, as natively.
- Browser-only: nothing. No client code changed.
