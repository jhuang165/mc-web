# Batch 58 serverbroadcast: death and achievement broadcasts, operator commands on other players, chat as components

## Summary
- `src/server-broadcast.js` (new): `ServerSocial` (chat, `command`, `death`, `award`, `drain`, per-player `playerOps`), `chatMessage`/`chatDisplay`/`playerChatMessage` (S02 shape: `json` is the serialized component, `text` the legacy line, plain chat keeps `name`/`text`), `voidDeathComponent`, `SERVER_COMMANDS`.
- `server/server.js`: builds a `ServerSocial`; plain chat and "/" lines go through it; `social.drain()` after each tick; `ops` option and `MC_WEB_OPS` (comma list of player names) name operators. Default is no operators, as before.
- `src/multiplayer/simulation.js`: a player below y -64 queues `{type:'death'}` in `simulation.events`; unlocked achievements ride in `savePlayer` / `addPlayer` (`achievementsSaved`).
- `src/commands.js`: with `host.forPlayer(name)` the commands give, clear, xp, effect, gamemode, enchant, spawnpoint, tp, achievement run on the named online player (same handler over a host whose state operations are the target's; the sender keeps print/feedback). `tp <player> <player>` uses `host.positionOf`. `gameMode.changed` goes to the target. `host.unsupported` answers "not available on this server" for operator commands the server cannot run. Without `forPlayer` nothing changes.
- `src/player-op.js` (new), `src/main.js`, `src/multiplayer/client.js`: `playerOp` messages (give, clear, xp, levels, effects, gamemode, kill) are applied to the client's own state (whitelisted, validated). The client prints server chat from the component JSON, sends "/" lines to the server (it used to refuse them), and does not print its own death line after a server /kill.

## Evidence
- Bytecode-read (javap, 1.7.10 client jar, which contains the integrated server classes): `mw.a(ro)` (EntityPlayerMP.onDeath) begins with `oi.a(fj)` of the combat tracker message for every player, no gamerule test. The jar's GameRules (`agy`) lists nine rules, none is showDeathMessages: the gap's gate does not exist in 1.7.10 (found wrong; the rule is from 1.8).
- Bytecode-read: `pg.a(yz, ph, int)` (StatisticsFile.func_150873_a): after the base addStat, an achievement that read 0 with amount > 0 sets the dirty flag and, when `MinecraftServer.at()` is true (base returns true; the dedicated override reads announce-player-achievements, recalled), sends `chat.type.achievement` (player component, achievement component) through `oi.a(fj)` to every player.
- Bytecode-read: `aw.b` (CommandKill) calls `b(ac)` (the sender as a player) and never reads the arguments, so `/kill <name>` natively kills the sender. The brief's "/kill with a player name" is wrong; the test pins it.
- Bytecode-read: `bl` (CommandBase.func_152373_a): the sender gets the message; other ops get `chat.type.admin` (sender name, message) gray italic. `sv.G` (outOfWorld 4.0 at y < -64) and the creative bypass of outOfWorld for the void death.
- Executed: only the existing component serializer/parser round trip (chat-component tests); no new Java probe. A probe of StatisticsFile needs a MinecraftServer instance, which the client jar cannot build.

## Verification
- `node --test src/serverbroadcast-b58.test.js`: 10 pass. Every test file importing commands, command-selector, chat-multi, multiplayer, server, simulation or command-host: 1004 run, 1004 pass after the wire-shape fix. `npm run build` ok. Full npm test not run (batch rule). No browser check.

## Follow-ups
- Deaths other than the void fall and /kill (damage, fall, mobs) do not exist on the server, so they are not broadcast; a client's own non-server death is still shown only to itself.
- Achievements are only awarded by `/achievement give` (and `ServerSocial.award`); no gameplay trigger exists server-side. The client also keeps its own local achievement toast and chat line.
- `/clear` reports only the nine hotbar slots the server knows; `/give` does not keep NBT, `/enchant` and `/spawnpoint` on the server are refused, `/tellraw`, `/summon`, `/time` and the scoreboard commands are "not available on this server".
- Operator status comes from `MC_WEB_OPS` names; account admins are not operators automatically. The live ledoge0 server was not touched.
- The client side of `playerOp` is unit-tested (player-op.js) but not run in a browser.
