# Batch 57 chatmulti: commands and chat over several player records

## Summary
- `src/command-selector.js`: `selectPlayers(text, host)` runs PlayerSelector.c / oi.a over every record of `host.players()` (name, position(), mode, level), in join order, with the native filters, nearest-first sort by Entity.getDistanceSq from the origin, reverse for a negative count, cut to |c|, and @r shuffle then first c. Without `host.players` the single local player is the one record, so the single-player host is unchanged. `selectLocalPlayer` is now "exactly one match" (matchOnePlayer). New `expandsSelector` (ad.a(String): count != 1) and `selectsNobody` now silent only for expanding selectors.
- `src/commands.js`: `run` expands a count != 1 selector at the username index into one run per matched name (each failure reported separately). `/tell` resolves any online player by selector or name (`anyPlayer`), delivers the incoming line through `host.deliver(name, ...)` (falls back to `host.broadcast`). `/say` and `/me` words expand to every match, joined with ", " and " and ". Other commands keep acting on the local player only; a different online player gives a "not available in this build" error instead of acting on the wrong player.
- `/tell` message words are selector-expanded only when the sender is not a player (CommandMessage flag `!(sender instanceof EntityPlayer)`). The b56 note said every sender; the trio rows show a player sender keeps `@p` literal.
- `src/chat-multi.js` (new): `broadcastToAll`, `achievementComponent` (main.js now uses it for the achievement chat line), `serverChatCommand` for the dedicated server.
- `server/server.js`: a chat line starting with "/" goes through `serverChatCommand` (permission level 0: /tell, /me; /say and others answer with the permission text) and each line is sent only to its recipient; before, it was broadcast as plain chat. Plain chat is untouched. Death and achievement events do not exist server-side, so there is no call site yet; `broadcastToAll` is the helper for them.
- `/effect` Ambient: the port writes no Ambient tag anywhere (level-dat.js only reads it and reports it lost); `/effect` adds `{id, duration, amplifier}` with no ambient field, i.e. natively false (CommandEffect builds `new PotionEffect(id, ticks, amp)`). Gap closed, nothing to change; test pins it.

## Evidence
- Executed: the 336 trio rows of `public/research/cmd-chat-reference.json` (CmdChatProbe, b56) replayed in `src/chat-multi-b57.test.js`: all pass (tell, say, me from Alex, Steve, console, command block).
- Bytecode-read (javap on ad, oi, ln, z): `/tell @p[r=5]` from a command block. CommandHandler.a only expands a selector when `ad.a(String)` (count != 1) is true; @p and @r default to count 1, so the command runs with the raw text and `ad.a(sender, text)` (matchOnePlayer) gives null, then notFound. @a without c=1 expands, and zero matches run nothing. The b56 "unexplained divergence" is closed; the old silent rule for @p was wrong, and `command-selector.test.js` was updated.
- Bytecode-read: oi.a order (filters, sort by `ln` comparator, reverse, subList). Recalled: death/achievement broadcast to all players, the showDeathMessages gamerule gate.
- @r with several candidates is random and not replayed; the test checks only sizes.

## Verification
- `node --test` over chat-multi-b57, cmd-chat-b56, command-selector: 9 + 8 pass.
- Every test importing commands.js / command-selector / away-commands / commands-extra / command-block / chat-multi / server-handlers: 314 run, all pass after the command-selector test update. Plus achievements, multiplayer, server tests: 81 pass.
- `npm run build` ok. Full npm test not run (batch rule). No browser check.

## Follow-ups
- Death messages are not broadcast to other players on the server (no death events in the simulation); wire `broadcastToAll` when the server simulates damage. showDeathMessages is not read there.
- Remote targets for /give, /gamemode, /xp, /effect and the scoreboard commands are refused; only chat commands reach other players.
- The client prints server command lines as plain legacy text (no click or hover components on the wire).
