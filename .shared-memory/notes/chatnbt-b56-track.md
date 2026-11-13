# chatnbt b56 track

Branch `batch56-chatnbt` from 626a467c3 (0.84.0).

## Summary
- Hover NBT: `src/item-component.js` now builds a compound (id, Count, Damage, tag) from the tags the port carries (ench, StoredEnchantments, RepairCost, display Name/color, Unbreakable, Explosion, Fireworks, pages, author, title) and prints it with `nbtText`, a port of NBTTagCompound/NBTTagList.toString: HashMap iteration order (Java 8 bucket order, insertion order inside a bucket), quoted unescaped strings, number suffixes b/s/L/f/d, Java float formatting, "[1,2,]" int arrays, `0:`-indexed lists. Lore, SkullOwner, CustomPotionEffects and map tags are not carried by the port, so they are not printed.
- /tell, /say, /me (src/commands.js) now follow the executed CommandHandler:
  - /say passes the plain sender name (string) to chat.type.announcement, not the clickable component; an empty first word is the usage error (CommandBroadcast tests args[0].length).
  - /me, /say and /tell expand @p/@a/@r in the message for every sender (they were gated to command blocks for /me and /tell).
  - A usage error is the red usage translation itself. CommandHandler.a(ac, String) wraps processCommand in an inner catch of CommandException; commands.generic.usage only covers failures outside it. This changes the text of every usage error ("Usage: " prefix removed, as 1.7.10 prints "/give <player> ..."). Earlier probes (ScoreboardProbe, ChatComponentProbe, CmdOutputProbe) wrapped usage themselves from recall; their tests now strip or replace that wrapper.

## Evidence
- Executed: `ChatRarityProbe` nbt rows (10 stacks, 3 raw compounds incl. 13 and 25 keys) into `public/research/chat-rarity-reference.json`; replay in `src/chat-nbt-b56.test.js`.
- Executed: `tools/probes/CmdChatProbe.java` runs the real CommandHandler `z.a(ac, String)` with the real az (tell), ah (say), an (me) and ad (PlayerSelector) on a server double: three Unsafe-allocated EntityPlayerMP (Alex 0.5,64,0.5 level 5 survival; Steve 10.5; Bob 200.5 creative; Alex and Steve in team red) with a recording NetHandlerPlayServer, a real Scoreboard, plus console and command-block stub senders at 0,0,0. 510 records (trio and solo scenarios) in `public/research/cmd-chat-reference.json` via `tools/verify-cmd-chat.mjs`.
- Replay: `src/cmd-chat-b56.test.js` runs the 174 solo rows (only Alex online) through the port; 173 match. The trio rows are not replayed (the port is single-player); @r with several candidates is not recorded (random shuffle).
- Bytecode-read (not run): the exception-table order in CommandHandler.a that explains the bare usage text.
- Port ids are not vanilla ids; the nbt rows use the original ids through item-names originalOfLive.

## Verification
- `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node tools/verify-chat-rarity.mjs` and `node tools/verify-cmd-chat.mjs` (same env).
- `node --test` over every src test that matches chat-*, cmd-*, commands*, team-names, combat-tracker, death-messages, gui, command-block, away-commands: 135 pass. Wider set (every test importing commands.js, item-component, command-block, chat-component, commands-*): 313 tests, 1 failure (scoreboard.test.js usage wrapper) fixed, scoreboard.test.js then 18 pass. `npm run build` ok. No full `npm test`, no browser.

## Follow-ups
- Open divergence, unexplained: from a command block, `/tell @p[r=5] hi` with Alex out of range printed commands.generic.player.notFound to the sender in the executed run, while other empty matches (name, m, lm, team) were silent. The port keeps the silent rule; the row is excluded in cmd-chat-b56.test.js.
- Multiplayer: whisper and selectors for other players need the server path; the trio rows are the evidence to replay there.
- Other recalled commands (task 3) were not touched.
