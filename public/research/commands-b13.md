# Batch 13 commands: chat components, /tellraw, /achievement, /spreadplayers, /debug, /scoreboard

Target: Minecraft Java 1.7.10 (client JAR sha1 e80d9b3b…). This is not a parity claim. Each section separates what an original-class
probe verified from what was read from bytecode and what is approximate. Before batch 13 these five commands answered "not
available in this build". Now `commands.js` has an empty `UNSUPPORTED` set, and [the command catalogue](command-parity-catalogue.md)
lists all 32 integrated-server commands as Partial.

Evidence:

- [commands-b13-reference.json](commands-b13-reference.json) comes from `tools/probes/CommandsProbe.java` and `tools/verify-commands-b13.mjs`. It holds 242 records. `src/chat-component.test.js` and `src/commands-extra.test.js` replay them.
- [scoreboard-reference.json](scoreboard-reference.json) comes from `tools/probes/ScoreboardProbe.java` and `tools/verify-scoreboard.mjs`. It holds 225 records. `src/scoreboard.test.js` replays them.

Both probes run the unchanged client JAR's own classes (with the client's Gson 2.2.4) without starting a server or a GL context.

## Chat components and /tellraw

**Probed** (`chat-component.js`, `json-lenient.js`). The probe runs 122 /tellraw inputs through IChatComponent.Serializer. The inputs include lenient Gson 2.2.4 syntax, bad JSON and the `commands.tellraw.jsonException` root-cause text. The port matches each input on:

- the parsed tree;
- getFormattedText and getUnformattedText;
- per-part style codes, resolved click/hover events, and the serializer's JSON back.

It also matches:

- the 22 EnumChatFormatting names;
- the click and hover action names, including the ones not allowed in chat (open_file, twitch_user_info);
- FontRenderer widths (bold adds 1 px per glyph) and trimStringToWidth;
- 10 GuiNewChat.func_146237_a wraps, part by part.

`lang-en-us.js` is the full en_US.lang file, so translate components resolve the way the client resolves them. That includes the client-side rule that turns `%d`/`%.2f` into `%s`.

**Behaviour.** Hover tooltips (show_text, show_achievement, show_item) and clicks (open_url for http/https, behind the link prompt when Chat Links Prompt is on; suggest_command; run_command; shift-click inserts) follow GuiChat. A command block keeps the formatted text as LastOutput.

**Approximate:**

- A translation whose pattern fails would crash the native client. The port drops that message instead.
- The show_item tooltip uses the port's item names and tooltip lines.

## /achievement

**Probed:**

- StatList.func_151177_a lookups (12 cases);
- each achievement's StatBase.func_150955_j component, with its hover (33);
- the allStats order at its ends;
- the achievement chat line.

**Behaviour.** 1.7.10 has only `give`; any other first word does nothing. `give` accepts an achievement or a stat id, or `*` for all. Locked parents are unlocked root first. The feedback is `commands.achievement.give.success.one/all`.

**Approximate:**

- Batch 16 replaced the grouped order with the StatList registration order (`order` in `src/stats-data.js`, from `StatList.allStats` in the same JVM as the criteria record). All 803 completion positions replay from that run's order (`criteriaOrder` in `src/scoreboard.js`, a Java HashMap model). The shipped default matches over 700 positions; the rest is the craftItem run, whose order comes from an identity-hash HashSet of Items and differs between JVM runs, so it cannot be reproduced exactly.
- Item stats are named by the port's item names.

## /spreadplayers

**Probed:** CommandSpreadPlayers.func_110670_a and func_110668_a with a seeded java.util.Random on an allocated world (6 cases). That covers positions, iteration count, the average distance and the failure message.

**Behaviour.** Targets resolve to the one local player. With `respectTeams`, the player's scoreboard team (or no team) counts as the one team. The player lands at floor+0.5 on the top block + 1.

**Approximate:** with one player there is never a second target to separate. The "top block" uses the port's world height lookup.

## /debug

**Probed:** Profiler.getProfilingData on a filled profiling map (6 cases). The dump layout, the witty comments and the `debug/profile-results-<date>.txt` name pattern were read from CommandDebug with javap.

**Behaviour.** `start` turns profiling on from the next tick. `stop` reports seconds and ticks, then offers the result file as a download.

**Approximate:** there is no integrated server, so the sections are the browser's own tick phases (main.js), not MinecraftServer's.

## /scoreboard

**Probed.** The probe runs 191 scripted lines through the real CommandScoreboard.processCommand. It overrides only getScoreboard, with a fresh Scoreboard per script and a plain, non-player sender. The scripts are objectives, players, teams, order, empty and slotsOnly. For each line the port matches:

- every chat line (colour plus text);
- every notifyAdmins message;
- every thrown error text.

The one exception is `players list <name>`. Its entry order comes from a HashMap keyed by object identity, so it is random natively too; the test compares those lines as a set.

Messages and errors:

- WrongUsageException texts are wrapped in `Usage: …`. This includes `objectives.add.wrongType` and `teams.option.noValue`.
- `tooLong`/`displayTooLong` (SyntaxErrorException) and plain CommandExceptions are shown as plain red text.
- Team option names are lower-cased in messages.

After each script the port also matches the scoreboard state:

- HashMap iteration order for objectives, score holders and teams (`java-hash.js` models Java 8 HashMap);
- getSortedScores (stable ascending);
- ScorePlayerTeam.formatPlayerName;
- the display slots;
- the ScoreboardSaveData.writeToNBT bytes of `data/scoreboard.dat`. They are equal in 5 of 6 scripts. In the sixth (order), the per-player score order is identity-hashed natively, so they are equal after regrouping.

The probe also confirms these rules:

- **Criteria.** The 803 criteria keys match the native key set. `health` is the only read-only criteria.
- **Team colours.** EnumChatFormatting.getValueByName is an exact lower-case match: `Dark_Red` works; `darkred`, `dark-red` and `grey` do not.
- **Other rules:** getValidValues, joinNiceString, and no length limit on player names.

**Read from bytecode, not run:**

- **Sidebar** (GuiIngame `bbv`):
  - More than 15 scores, or none, draws nothing. There is no `#` filter.
  - Width is the larger of the title and `name: §cscore`.
  - Rows go up from `height/2 + size*9/3`. Row backdrop is `0x50000000`; the title row is `0x60000000`, with a 1 px line under it.
  - Text colour is `0x20FFFFFF`, without shadow.
- **Tab list:** `§e` + score, right-aligned at `cellX + colWidth - 17`, drawn only when more than 5 px remain after the name. A list-slot objective makes the list appear even for a lone player.

`verify-scoreboard.mjs` asserts these constants in the class file. `scoreboard.js` sidebarLayout and `player-list.js` scoreCell implement them, and tests cover them.

**Other behaviour:**

- `@p[team=…]` (equalsIgnoreCase, `team=` for no team) and `score_<obj>` / `score_<obj>_min` selectors. A missing objective fails; reading a score creates it, as natively.
- `teams join <team>` / `teams leave` without names act on a player sender, but not on a command block.
- Chat, the death message and the achievement line use the team-formatted name (prefix + name + suffix). The sidebar and Tab use it too.
- Live criteria (`scoreboard-live.js`):
  - every stat increment adds 1 to that stat's criteria;
  - every achievement trigger counts, even when the achievement is locked or already unlocked;
  - `deathCount` counts deaths;
  - `totalKillCount` counts kills, and `playerKillCount` counts player kills;
  - `health` = ceil(health + absorption), sent only when the sum changes and resent after respawn.
- The scoreboard is saved per world in the record (`scoreboard`).
- The Java export writes `data/scoreboard.dat`. The region importer reads it from the data files and keeps it whole.

**Approximate or not applicable:**

- **Criteria order.** The completion order of the 803 criteria differs from native at 30 positions. The set is the same.
- **Stat increments.** A stat criteria rises once per port `Stats.increment` call. That matches EntityPlayerMP.addStat only where the port increments a stat at the same call sites, with the same granularity, as native.
- **belowName.** It can be set and is saved, but nothing draws it. Natively it shows only on other players' name tags, and there is no other player.
- **friendlyfire and seeFriendlyInvisibles.** They are stored and saved, but have no effect: there is no second player.
- **Tab score.** The Tab score column reads a missing score as 0 and does not add it to the saved scoreboard. Natively the score is created, but only in the client's copy.
- **Integrated-server details.** Scoreboard packets, multiplayer sync and other players' scores do not exist in the port.
