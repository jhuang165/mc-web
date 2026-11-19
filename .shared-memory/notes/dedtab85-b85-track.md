# dedtab85 (batch 85): dedicated-command tab rows, admin-notice levels, console and saving leftovers

## Summary
- The 64 recorded tab rows now replay through `socialTabComplete` (Alex, op 4): all 64 already matched (a native `null` reply and the port's `[]` both send nothing).
- `Dedicated84Probe` gained a `levels` setup: Alex op 4, Lou op 4, Kay op 3, Eve op 2, Ivy op 1, Steve non-op all watch every command, run by alex, kay, eve, ivy, lou, steve (816 new rows; reference now 1401 run rows, 0 crashes; the old 645 rows unchanged).
- Divergence found and fixed: `ServerCommandManager.func_152373_a` (bl.a(ac, aa, int, String, Object...)) sends the gray italic `[name: message]` only to receivers that are not the sender, are ops (`oi.g`), AND satisfy the command's own `canCommandSenderUseCommand(receiver)` (`aa.a(yz)`). The port told every op. Now `ServerAdmin.run` asks `ctx.ops(need)` and the generic command path (`server-broadcast.js`) filters by the running command's permission (recorded in `canUse`, which `commands.js` calls just before executing).
- `commandBlockOutput` only gates notices when the sender is a command block (`agp`); the sender's own line is skipped when the flag bit 1 is set (already ported). A rcon sender (`ov`) needs `MinecraftServer.m()`; none exist in the port.

## Console and offline/partial rows (recorded, not ported)
- The port has no console: `ServerAdmin.run` is only reached from `ServerSocial.command` (player chat); `MC_WEB_OPS` ops are players with level 4. No startup command or admin API acts as the console, so the console rows stay unreplayed. Native console rows: sender name "Server", chat.type.admin goes to every op the command allows, no console echo of the sender's own line.
- Partial saving (executed): `save-on` succeeds unless no world is disabled, `save-off` succeeds unless every world is disabled; `save-all` saves every world regardless of the flag. The port has one world and one `autosave` flag, whose behaviour equals the all-same rows (replayed).
- Offline mode (executed): a name the repository knows still resolves to its real profile; an unknown name becomes an offline profile (`UUID.nameUUIDFromBytes("OfflinePlayer:"+name)`, name lowercased) for op, ban and whitelist add; `ban-ip Nobody` still fails (needs an online player). Not ported: the port authenticates by account, so `online-mode` is only a listed property and ids are always account ids.

## Evidence
- executed (probe): the 816 new rows and the 64 tab rows. bytecode-read: `bl.a(ac, aa, int, String, Object[])` receiver conditions.

## Verification
- `node --test --test-timeout=600000 src/dedicated-cmds-b84.test.js`: 17 pass (new tab group; "levels" rows replayed with Ivy/Kay/Lou), 0 fail.
- Neighbours (b59, b68, b71, b58, b69, b83 and others touching server-broadcast): 113 pass, 0 fail.
- Probe regenerated with `MC_PROBE_LIBS=<netty-all-4.0.10.Final.jar> MC_RESEARCH=.../tools/research node tools/verify-dedicated-cmds.mjs` (netty 4.1 fails).

## Follow-ups
- Console sender rows need a console in the port (none planned).
- Offline-mode lookup only matters if the server ever accepts non-account logins.
