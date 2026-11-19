# commands82 (batch 82): audit of the command catalogue's Partial rows

## Summary

`tools/probes/CmdArgsProbe.java` runs the 32 unchanged 1.7.10 integrated-server command classes through `ICommandSender`. It uses the CmdChatProbe double, plus a WorldServer, the command manager on `MinecraftServer.o` and `mx.b`. It records three things:

- Tab completion for 142 texts (`z.b`).
- 265 processCommand forms: the thrown CommandException, the notifyAdmins calls with their flags, and the sender's chat.
- The block unlocalized names.

`tools/verify-cmd-args.mjs` writes `public/research/cmd-args-reference.json` and `src/block-unlocalized-data.js`. `src/cmd-args-b82.test.js` replays the reference against `createCommandRunner` and `spTabComplete`.

Fixed in `src/commands.js`, one handler at a time:

| Command | Fix |
| --- | --- |
| /difficulty | The argument is the `options.difficulty.*` translation. |
| /tp | Five or more arguments do nothing. Players in different dimensions get `commands.tp.notSameDimension` (server host `dimensionOf`). |
| /effect | The id is parsed with a minimum of 1. "clear" is case-sensitive. |
| /enchant | The id is bounded 0..255. Checks run in the native order: noItem, notFound, cantEnchant, then the level. This uses a new `enchantCheck` in `command-host.js` and `servercommands-b59.js`. |
| /seed | Goes to the sender only. |
| /gamerule | Unknown rules give the `norule` notify; no custom keys are created. The query is built from sibling components. |
| /gamemode | Notify flag 1 means the sender gets no copy. `server-broadcast.js` feedback honours `flags & 1`. "self" means the target is the sender. The mode is a component. |
| /setblock | An unknown block gives `commands.give.notFound`. |
| /testforblock | Lookup uses `Block.getBlockFromName`. The failed.tile names are Block.getLocalizedName through `translateKey` (the client's language in single player, as LanguageManager swaps StringTranslate; en_US on the Node server). Success goes to the sender only. |
| /help | Number and notFound handling follow MathHelper.parseIntWithDefault. |

Tab completion changes:

- **New lists:** players for defaultgamemode index 1 and spawnpoint indexes 0 and 1; items for clear index 1; replace, destroy and keep for setblock index 5.
- **Removed:** help, testfor, playsound and effect "clear" no longer complete.
- **Ordering:** items are listed from id 256 up, then blocks, each by id. Blocks are by id. The 57 EntityList names are in HashMap order. Gamerules are sorted as a TreeMap.

The catalogue generator (`tools/build-surface-catalogue.mjs`, CMD_B82) now gives every one of the 47 Partial rows a dated "verified / fixed / missing" note, and the catalogue is regenerated. The "plus custom keys" note for /gamerule was wrong and is corrected. `public/research/commands.md` has a batch 82 section.

## Evidence

- **Executed** (`cmd-args-reference.json`): every Tab row, and every processCommand row the double could run (250 of 265). The JDK and the jar sha256 are recorded in the reference.
- **Bytecode-read:**
  - CommandTeleport `notSameDimension` is guarded by `if_acmpeq` on `mw.o`.
  - CommandGameMode uses flag 1.
  - getCommandSenderAsPlayer (`y.b`) throws PlayerNotFound with the literal text "You must specify which player you wish to perform this action on.".
- **Correction to b51:** the b51 `gameruleQuery` row came from the sources, not from an execution, and was a single text. The executed class appends siblings. `src/cmd-texts-b51.test.js` is updated to match.
- **Not the game in the double, so skipped with reasons in the test:**
  - The y-range rows for summon, setblock and testforblock (the double's blockExists is always true).
  - The achievement rows (no AchievementList).
  - The tellraw malformed-JSON texts (the probe's Gson appends " path $..").
  - Rows that crash: kill, tp moves, clear on the inventory, debug stop.

## Verification

Targeted only; no full `npm test` and no browser checks.

- `node --test src/cmd-args-b82.test.js`: 4/4 pass.
- 33 command-related test files, first run: 300 of 304 pass. The 4 failures were tests that encoded the old gaps, now updated. After that, the 4 updated files pass 43/43 and 9 server and command files pass 104/104. The updated tests:
  - `commands.test.js`: /gamemode has no "Set own game mode" line.
  - `servercommands-b59.test.js`: "Hard" and "Peaceful".
  - `mpworldcmds-b68.test.js`: "is Wool (expected: Stone)".
  - `cmd-texts-b51.test.js`: the gamerule siblings.
- 14 other neighbouring files: 152/152 pass.
- Catalogue tests: 7/7 pass.

## Follow-ups

- **mpcmd82 area, not touched:**
  - A command block running /gamemode should not record the success line as LastOutput (`command-block.js` and `server-cart-commands.js` feedback should honour flag 1).
  - getCommandSenderAsPlayer's literal message for command-block senders.
- **Not executed:** kill, the tp moves, clear on a real inventory, the achievement give Tab, the scoreboard criteria Tab, and the y-range checks. A probe with a real world and net handler would cover these.
- **Dedicated-server commands (ban, op, ...):** not re-executed this batch. Their Tab completion is bytecode-read from batch 69.
- **Browser-only:** how chat Tab cycling shows the new lists (summon now includes Mob and Monster; the item list is reordered), and single player's /gamemode chat showing only "Your game mode has been updated".
