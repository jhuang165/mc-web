# Batch 59 servercommands: world commands, whole-inventory /clear, /enchant and /spawnpoint on other players, server achievement triggers

## Summary
- `src/servercommands-b59.js` (new): `worldHost(sim)` (time, weather, toggledownfall, gamerule, difficulty, defaultgamemode state on the DedicatedSimulation), `playerHost` (per-player `setSpawnpoint`, `enchant` validated on the server's held stack and sent as a playerOp), `serverInventory(player)` (the slot lists /clear walks: `survival.inventory.main` and `armor`, so it covers the full inventory as soon as mpitems fills it, else the hotbar), `installServerRules` (process-wide GameRules source follows `/gamerule`).
- `src/server-broadcast.js`: `SERVER_COMMANDS` gains time, weather, toggledownfall, difficulty, gamerule, defaultgamemode, list, tellraw, spawnpoint, enchant. The command host gets the world properties, `listPlayers`, `printTo`. `/clear` uses `serverInventory`. `drain()` awards the pickup achievements; `openInventory(id)` awards Taking Inventory. Non-operators may run `/list`.
- `src/commands.js`: `/list` shows the online players with the real max (20) and `uuids`; the dedicated-only `/list` is found when the host has `listPlayers`. `src/commands-extra.js`: `/tellraw` goes to the named player when the host has `printTo` (singleplayer unchanged).
- `src/multiplayer/simulation.js` (small hooks): `gameRules`, `difficulty`, `newPlayerMode` saved and loaded; `doDaylightCycle false` stops the clock; per-player `spawnpoint` saved with the player and used for the void-death respawn; a collected item queues `{type:'pickup'}`.
- `server/server.js`, `src/multiplayer/client.js`, `src/main.js`, `src/player-op.js`: `openInventory` message (client sends it where the local achievement triggers), `enchant` playerOp (validated ints), rules source installed.

## Evidence
- Bytecode-read (javap, 1.7.10 jar): CommandTime `bz` day 1000, night 13000 (the existing numbers are right). CommandListPlayers `ay`: `commands.players.list` (online, max) then `oi.b(uuids)` names line; it is registered by the dedicated server only (group "dedicated" in command-data.js).
- Bytecode-read: `nh.a(is)` (processClientStatus) triggers `pc.f` = openInventory on the server player, so openInventory is server-side in 1.7.10. `xk.b_` (EntityItem.onCollideWithPlayer) triggers mineWood (logs `ajn.r`, `ajn.s`), killCow (leather), diamonds, blazeRod and diamondsToYou (thrown by another player). `aax`/`aak` (crafting/smelting slots) trigger the crafting and smelting ones; those windows are client-side here. `mw` (EntityPlayerMP) holds exploreAllBiomes, portal, theEnd, theEnd2. `yd`, `yl`, `wf`, `ua`, `xc`, `sw` hold the mob and pig ones.
- Recalled: in 1.7.10 `/difficulty` is not pushed to connected clients (the S41 packet is 1.8), and `/defaultgamemode` without force-gamemode only sets the mode of new players.
- Executed: only the node tests below (no new Java probe; the commands are bytecode-read texts already in commands-reference.json).

## Verification
- `node --test src/servercommands-b59.test.js`: 11 pass. 18 related files (commands, commands-extra, serverbroadcast-b58, chat-multi, selectors, cmd-*, command-block, multiplayer, mpsurvival, mp-dig, mpeating, away-commands, accounts): 143 run, 142 pass, the one failure (a b58 test that pinned `/time` as refused) was updated and passes. `npm run build` ok. Full npm test not run (batch rule). No browser check.

## Follow-ups
- Hotbar stacks reach the server as count 64 without NBT (`cleanHotbar`), so the server's `/clear` count is lossy until mpitems lands inventory authority; `/enchant` conflicts with enchantments already on the stack are seen only by the client (it ignores the op).
- `diamondsToYou` is not awarded (the item entity has no thrower name). Crafting, smelting, kills, breeding, biomes, portals stay client triggers (no such systems on the server).
- `/setworldspawn`, `/summon`, `/testfor`, scoreboard and other commands are still "not available on this server". The server reads game rules for the time clock and via GameRules readers; the difficulty is stored but no server system reads it.
- Not run in a browser: the client sending `openInventory`, and applying the enchant playerOp.
