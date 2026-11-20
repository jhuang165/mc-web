# Chat, commands and cheats (0.43.0)

Target: Minecraft Java 1.7.10. Nothing here claims full parity.

## Evidence

`tools/probes/CommandProbe.java` loads the original client jar (SHA1 e80d9b3bf5085002218d4be59e668bac718abbc6) by reflection,
`tools/verify-commands.mjs` adds javap bytecode assertions and writes `public/research/commands-reference.json` and the generated
`src/command-data.js`. The reference holds the 48 command classes (31 always registered, 16 dedicated-server only, 1 LAN), their names,
aliases, permission levels and usage keys, 70 `CommandBase` parse cases (parseInt, bounds, parseDouble, relative coordinates, booleans,
word matching), the item (315) and block (171) registry names, 57 entity names, potions, enchantments, game rules, and 414 en_US strings.
`src/chat.test.js` and `src/commands.test.js` replay it; the command tests also run the commands against a real `World`, `Survival`,
`Weather` and `Experience`.

## Chat (GuiChat / GuiNewChat)

Native-verified constants: 100 stored lines and 100 sent messages, 9-pixel lines, fade over the last 20 of 200 ticks with alpha
`(10 * (1 - age / 200))^2`, width 320 (+4 background), 20 lines focused and 10 unfocused, background alpha/2, input field at
(4, height - 12) on a 50 % black bar from (2, height - 14), text 0xE0E0E0, input limit 100, wheel scroll 7 lines, Page Up/Down, Up/Down
sent history, Tab completion that cycles and lists candidates. T opens, `/` opens pre-filled, Enter sends and closes, Esc closes.
Opening chat does not pause; the pointer is released and movement stops (the same `screen = "inventory"` state the sleep screen uses).
Plain messages print as `<Player> text`. Death and bed messages print through the same log (`showChatLine`). In bed the field is open
above the Leave Bed button, Enter sends without waking, Esc or Leave wakes (GuiSleepMP).
Approximated: ticks are wall-clock 50 ms steps, the chat scale/width/opacity options are the native defaults only (no options screen
entries), the player name is "Player".

## Cheats

World creation has Allow Cheats (GuiCreateWorld semantics from bytecode: off by default; switching the game mode sets it to creative on,
survival off until the button has been pressed by hand). Stored as `allowCommands` in the world record. Batch 69 (docs sweep): Hardcore mode exists now (`hardcore.md`), which is where the Hardcore-forces-off rule applies; the sentence "no Hardcore mode" is superseded. With cheats off only help, me, tell/msg/w and seed work; every other command
answers `commands.generic.permission` in red (EntityPlayerMP.canCommandSenderUseCommand). With cheats on the op level is 4.
A save without the flag reads as WorldInfo does: cheats on for a creative world, off for survival. Open to LAN applies the local game type/cheat/pause settings; browser socket hosting is not offered from the browser. Batch 69 (docs sweep): a dedicated multiplayer server exists (`server/server.js`, `src/multiplayer/`, op levels in `server-admin.js`), so "Java multiplayer remain unsupported" is only true for joining a real Java 1.7.10 server.

## Commands

Native-verified (names, aliases, permission, usage and feedback strings, argument parsing; the effect is on real game state):
help (paged, 7 per page), gamemode, defaultgamemode (stored only), gamerule, give, clear, kill, time, toggledownfall, weather
(CommandWeather timers and flags from javap), tp (with `~`; a bare number adds 0.5, y included), spawnpoint (used on respawn when no
bed spawn), setworldspawn, difficulty, effect, enchant, xp (L suffix), summon, setblock, testforblock, say, me, tell/msg/w, seed,
playsound, list, testfor (the local player).

Approximated:
- Adventure mode uses the build's existing adventure restrictions; full adventure parity remains open.
- /setworldspawn stores the point in the record but the world spawn search is unchanged.
- /setblock destroy drops like a break with the held tool; supported tile data tags are applied.
- /give and /summon accept supported data tags (below). /summon covers the entities the port has (Batch 69 docs sweep: this first list is the early set; the full coverage, 55 of the 57 EntityList registrations, is stated further down).
- /effect: instant health and harm apply directly; other effects use the port's Effects table.
- /tp and the player-name arguments accept `@p`, `@a`, `@r` and the local player name; radius/name/mode/level filters apply to that one player.

Game rules are stored for every name. keepInventory, naturalRegeneration, doDaylightCycle, doTileDrops, doFireTick, doMobSpawning,
mobGriefing and doMobLoot change behaviour at the native call sites (see [game rules](game-rules.md)); commandBlockOutput controls operator feedback from command blocks, independently of their Track Output flag.

Batch 13 added achievement, debug, scoreboard, spreadplayers and tellraw ([commands-b13.md](commands-b13.md)); no registered command is unsupported now. /publish changes local LAN settings and reports the browser networking limitation. Dedicated-server-only commands (op, ban,
stop, ...) are not registered, as in the native singleplayer.

## 0.43.0 data tags

`src/json-nbt.js` ports the 1.7.10 JsonToNBT parser, with 119 original-class cases in
[json-nbt-reference.json](json-nbt-reference.json) (zero differential mismatches).
Tag text is the remaining arguments joined with spaces. Give/summon tag errors and summon out-of-world/creation
failures are plain feedback; setblock/testforblock tag errors are thrown command errors. Only tile-entity block
arguments cause the latter commands to parse tags. Unknown setblock modes replace; destroy happens before the
same-block check. Testforblock compares compound subsets, with exact typed lists/arrays (`func_147181_a`).

Give applies supported ItemStack enchantments, stored enchantments, repair cost, display name/colour and Unbreakable.
Summon uses floor(x)+0.5, floor(y+0.5), floor(z)+0.5 as its relative base; a tag, including `{}`, skips
onSpawnWithEgg. Supported mob fields include rotation yaw, health, active effects, age/love, sheep colour/shearing,
zombie child/villager/cure state, villagers' professions/riches/offers, player-created golems, creeper power/ignition,
and the witch's held potion. Fire and bounded Motion apply after restoration. Container tile readers/writers are
shared with Java import/export (chests, furnace, dispenser/dropper, hopper, brewing stand); command blocks use Control tiles.

Explicit deviations: the native parser's empty-list-element hang becomes an error; decimal-to-float conversion uses
JavaScript Number followed by Math.fround, so an exceptionally close double-rounding tie can differ from Java Float.parseFloat.
Unknown keys are discarded with a gray `Not kept in this build: …` line. Mob effects/equipment are limited to the
build's live implementations; tagged summons do not gain spawn-egg equipment. `/summon` covers 55 of the 57 EntityList registrations (missing: Mob and Monster, which are abstract and fail natively). Batch 16 adds Painting (`Motive`, `Direction` over the legacy `Dir`, `TileX/Y/Z`), ItemFrame (`Item`, `ItemRotation`, `ItemDropChance`) and LeashKnot (`TileX/Y/Z`; the knot sits at the command position, as CommandSummon's setLocationAndAngles moves it after readEntityFromNBT) through the live hanging and knot code. A summoned hanging entity keeps facings 0 to 3 only; other `Direction` values are refused with a note, because the renderer cannot draw them. A summoned knot is a leash holder but cannot be clicked. A `Riding` compound mounts through the mob-riding API as `CommandSummon` does (a null mount
ends the chain); a mob on a non-mob pair spawns separately with a note. See [spawner cart](spawner-cart.md). Rotation pitch and arbitrary attributes/equipment remain unsupported.
This is partial command/NBT support, not full parity.

See [command blocks](command-blocks.md) for the new editor, rising-edge execution, sender and commandBlockOutput rule.

## Batch 17: /summon changes

- Hanging entities accept any byte `Direction` (4, 5, 127, -1 all spawn; native `setDirection` only sets yaw = dir * 90, `onValidSurface` has no table lookup). The port keeps the byte, guards its renderer lookups, and NBT export writes `Direction` only (no `Dir`) outside 0..3. A value like `128b` overflows to a string, so the `Dir` fallback applies. Probed in `summon-reference.json` (`tools/probes/SummonProbe.java`, real CommandSummon).
- Summoned leash knots are pickable, interactable and attackable like placed knots (stand-in entity `mob-9xxxxxxxx` in horse-gear-live.js `knotEntity`). A summoned knot's tile stays (0,0,0), so several share one tile for `knotAt`.
- Absolute coordinates without a decimal point get +0.5 (as native), which the summon reference records.

## Batch 82 (2026-11-18): argument forms and Tab completion, executed

`tools/probes/CmdArgsProbe.java` (run by `tools/verify-cmd-args.mjs`) executes the 32 unchanged integrated-server command classes through `ICommandSender`. It writes `cmd-args-reference.json` with 142 Tab texts and 265 processCommand forms, and `src/cmd-args-b82.test.js` replays them. Corrections to the notes above:

- /gamerule never creates an unknown rule. The set and query forms of an unknown name notify `commands.gamerule.norule`; neither throws. The query is a ChatComponentText of the name with " = " and the value appended as siblings.
- /gamemode's success lines use notify flag 1, so the sender gets no copy. In single player the owner sees only "Your game mode has been updated".
- /difficulty's argument is the `options.difficulty.*` translation ("Hard"). /seed and the /testforblock success go to the sender only.
- /testforblock looks up blocks with Block.getBlockFromName. Its failed.tile arguments are the en_US localized names. /setblock's unknown block is `commands.give.notFound`.
- /enchant checks the held item before the enchantment id. /effect takes ids from 1 up, and its "clear" is case-sensitive. /tp with 5 or more arguments does nothing. /help maps -1, 1.5 and 2147483648 to `commands.generic.notFound`.
- Tab completion:
  - defaultgamemode, spawnpoint (indexes 0 and 1) and clear (items) gain lists;
  - help, testfor, playsound and the effect "clear" word have no completion;
  - the item, block and entity lists use the registries' native order, and setblock index 5 lists replace, destroy and keep.

Batch 84 dedicated84 (2026-11-19): the dedicated-server-only commands are now executed. `tools/probes/Dedicated84Probe.java` runs the real `ServerCommandManager` and the real op, ban, ban-ip, banlist, pardon, pardon-ip, whitelist, kick, list, stop, save-all, save-on, save-off, setidletimeout and netstat classes (the jar also has `netstat`) against real user lists and a real profile cache, with a double for the DedicatedServer and its world list (645 rows in `dedicated-cmds-reference.json`, replayed by `src/dedicated-cmds-b84.test.js`). Corrections: `/list` is op-only for a player (`EntityPlayerMP.a`); ban-ip, pardon-ip and kick reject a one-character argument; `whitelist list` counts playerdata files as the second number; `save-all flush` prints the raw keys `commands.save.flushStart` and `commands.save.flushEnd`; a player running `netstat` gets "Command is not available for players". Recalled, not executed (the dedicated classes are not in the client jar): lists' lanServer flag, default max players 20, the `server.properties` persistence and the whitelist file reload.

Batch 86 summon86 (2026-11-19): an untagged `/summon` runs onSpawnWithEgg(null) before spawnEntityInWorld (bytecode-read `bu.b` 274-301; executed, `tools/probes/Summon86Probe.java` -> `summon86-reference.json`, 10 kinds, per World.rand seed). The extras it makes, an ocelot's two kittens, a spider jockey's skeleton and a chicken jockey's chicken, therefore join the world list ahead of the summoned mob, while their entity ids follow its own. The port now does the same for the command path; SpawnerAnimals and the spawn egg still spawn first. World.rand after the command, the fleece colour, the profession, the zombie child/villager flags and the kitten age match on every recorded seed. `Entity.writeToNBT` (`sa.e`, no subclass overrides it) writes `Invulnerable` for every kind: the browser save and the Java import and export now keep it for items, XP orbs, paintings, item frames, boats, carts and mobs, and an invulnerable summoned leash knot refuses hits (knots are never saved, `su.d`). Items keep a summoned or hit `Health` across a save (export: `(short)(byte)health`). `/summon` now also reads an orb's `Age` and an item's `Owner`/`Thrower`.

Batch 86 console86 (2026-11-19): the console sender and offline mode are executed and ported. `Dedicated84Probe` now also runs every dedicated form from the console (the MinecraftServer itself: `b_()` "Server", `a(int, String)` true, so every level) in the base, lists, levels and offline setups, every form in offline mode (`Y()` false) for a player, and the /netstat sub-commands (1979 run rows, 0 crashes; 540 console rows, 270 offline rows; the old rows unchanged). Executed facts: the console's notice (`bl.a`) goes to every op the command allows and is not echoed to the log a second time; a player's notice also goes to the log (`a(fj)` logs the unformatted text); in offline mode `PlayerProfileCache` lowercases the name and, when the repository misses, `ns.a(MinecraftServer, String)` gives the offline profile `UUID.nameUUIDFromBytes("OfflinePlayer:" + lowercased name)` with the lowercased name, for /op, /ban and /whitelist add only (bytecode-read and executed; /deop, /pardon and /whitelist remove match entries by name, ban-ip and kick need an online player). /netstat (bytecode-read `bb`, `eu`/`ex`/`ey`, executed on an idle server): a player gets "Command is not available for players"; the console gets "reads: N, writes: N" for no argument, `total-read-count`/`total-write-count` + N, `PacketStat(id){totalBytes=.., count=.., averageBytes=..}` for packet-read/write, hottest (most bytes) and most (most packets), "Packet id is missing", "Packet X not found!" and "Unrecognized: X". The port: `ServerSocial.consoleCommand` (server/server.js queues stdin lines and runs them after the tick), `online-mode` in `server.properties`, and /netstat over the WebSocket traffic. Port differences: the WebSocket messages have no packet ids, so every message counts under id 0; logins stay account-authenticated with account ids (not offline UUIDs); the command-parity catalogue's /netstat "Out of scope" row is stale. Replayed by `src/console86-b86.test.js` (675 rows, 0 mismatches).

Batch 87 offline87 (2026-11-20): corrections to the batch 86 port differences. Executed with `tools/probes/Offline87Probe.java` (`node tools/verify-offline87.mjs`, writes `offline87-reference.json`): `NetHandlerLoginServer.func_152506_a` gives a name-only login the profile (`UUID.nameUUIDFromBytes("OfflinePlayer:" + typed name)`, typed name), case kept (Alex and alex differ); `EntityPlayer.func_146094_a` makes the profile id the entity UUID (the `playerdata/<uuid>.dat` key, bytecode-read `SaveHandler`); `EnumConnectionState` has 1 handshake, 2+2 status, 2+3 login and 24+65 play packet classes. The port: with `online-mode=false` a signed-in account joins as the offline profile of its name (`ServerAdmin.loginProfile`), and that UUID keys the refusal checks, the saved player, the tamed owners and /list uuids; online mode keeps the account id. The account directory (the port's stand-in for the profile repository) answers with that same login profile, so /op, /ban and /whitelist add before a first join match (natively the repository is Mojang's, which can give an online UUID on an offline server; the port has no such second authority). A name with no account still gets the lowercased offline profile, as natively. /netstat now counts each WebSocket message under the native id of the packet it stands for (`src/multiplayer/net-packet-ids.js`); bundled messages count once (the tick under S18), bytes are JSON lengths, and port-only messages are not counted. The partly-off saving rows replay too: `ServerAdmin.levelSaving` keeps one flag per world, and /save-off and /save-on report a change when any world changed (bytecode-read `bi`/`bj`). The command-parity catalogue is regenerated: /netstat is Partial. Replayed by `src/offline87-b87.test.js` and `src/dedicated-cmds-b84.test.js`.
