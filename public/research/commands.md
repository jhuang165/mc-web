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
survival off until the button has been pressed by hand). Stored as `allowCommands` in the world record. This build has no Hardcore mode,
so the Hardcore-forces-off rule has nothing to apply to. With cheats off only help, me, tell/msg/w and seed work; every other command
answers `commands.generic.permission` in red (EntityPlayerMP.canCommandSenderUseCommand). With cheats on the op level is 4.
A save without the flag reads as WorldInfo does: cheats on for a creative world, off for survival. Open to LAN applies the local game type/cheat/pause settings; browser socket hosting and Java multiplayer remain unsupported.

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
- /give and /summon accept supported data tags (below). /summon covers the entities the port has (pig, cow, sheep, chicken, zombie, spider, cave
  spider, skeleton, creeper, villager, iron golem, silverfish, witch).
- /effect: instant health and harm apply directly; other effects use the port's Effects table.
- /tp and the player-name arguments accept `@p`, `@a`, `@r` and the local player name; radius/name/mode/level filters apply to that one player.

Game rules are stored for every name. keepInventory, naturalRegeneration, doDaylightCycle, doTileDrops, doFireTick, doMobSpawning,
mobGriefing and doMobLoot change behaviour at the native call sites (see [game rules](game-rules.md)); commandBlockOutput controls operator feedback from command blocks, independently of their Track Output flag.

Unsupported (red message): achievement, debug, scoreboard, spreadplayers, tellraw. /publish changes local LAN settings and reports the browser networking limitation. Dedicated-server-only commands (op, ban,
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
build's live implementations; tagged summons do not gain spawn-egg equipment. `/summon` covers 52 of the 57 EntityList registrations (missing: Mob, Monster, Painting, ItemFrame, LeashKnot; the first two
are abstract and fail natively). A `Riding` compound mounts through the mob-riding API as `CommandSummon` does (a null mount
ends the chain); a mob on a non-mob pair spawns separately with a note. See [spawner cart](spawner-cart.md). Rotation pitch and arbitrary attributes/equipment remain unsupported.
This is partial command/NBT support, not full parity.

See [command blocks](command-blocks.md) for the new editor, rising-edge execution, sender and commandBlockOutput rule.
