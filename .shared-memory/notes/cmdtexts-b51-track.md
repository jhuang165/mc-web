# cmdtexts b51 track

Branch `batch51-cmdtexts` from 119a6db93. Evidence: **executed** = the unchanged 1.7.10 `ChatComponentTranslation` (fr), `ChatComponentText` (fq), `ChatStyle` (fn) and `IChatComponent.Serializer` (fk) through `tools/probes/CmdTextsProbe.java` -> `public/research/cmd-texts-reference.json` (`tools/verify-cmd-texts.mjs`, tag `b51ct`, 10 rows). **Limit**: the jar is the client jar; CommandHelp, CommandBase and CommandGameRule are absent (grep of every class for their key strings found none), so the probe builds the component trees (key, arguments, style) those methods build, written from the 1.7.10 source, not from their bytecode. **bytecode-read**: `TileEntity.c(dh)` (aor) and `EntityList.a(dh, world)` (sg) call `readFromNBT` outside their try, so an exception from `agp.b(dh)` propagates; the executed `CmdOutputProbe` load rows already show `JsonSyntaxException` for "not json" and a truncated object.

## Summary
- Help header = translation `commands.help.header` (Integer args) styled dark_green; usage lines are plain `translate`; the first page footer is `commands.help.footer` green. The deprecated numeric id text is `commands.generic.deprecatedId` with the registry name, gray. The gamerule query and list are `ChatComponentText` (not translations; the JSON escapes `=` as `=`). The sender text keeps its colour codes; the component travels beside it (`say(text, component)`), so a command block's `LastOutput` now holds these JSON forms.
- `chat.type.admin`: `adminComponent(name, message)` = translation(name, message) gray + italic (`{"italic":true,"color":"gray","translate":"chat.type.admin","with":[name,{...}]}`), passed beside the existing `§7§o[name: text]` the command block sender prints to the ops.
- Invalid-JSON `LastOutput`: `normalizeLastOutput` throws `LastOutputError`. A command block (`restore`), a saved command cart (`Minecarts.fromJSON`) and an imported region tile are skipped instead of kept. Native drops more: the exception escapes the entity/tile read and the chunk load fails (not checked: the chunk provider's catch). `/blockdata` and `/summon` with an invalid LastOutput end in the generic exception.

## Verification
- `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node tools/verify-cmd-texts.mjs` (10 rows)
- `node --test src/cmd-texts-b51.test.js` (6) plus cmd-output-b50, command-block, commands, chat-component, away-commands, furnace-cart-b49, minecarts, commands-extra, region-import, command-block-screen: 90 pass, 0 fail (b50 load test changed: invalid JSON now throws). `npm run build` once. No full `npm test`, no browser run.

## Follow-ups (proposed gap lines)
- The help, deprecated-id, gamerule and admin component trees come from the 1.7.10 source, not CommandHelp/CommandBase/CommandGameRule bytecode (server classes absent from the client jar).
- The translated unformatted text of these components was not executed (the probe loads no language file).
- CommandGameRule's list uses `joinNiceString` natively; whether it separates with "and" before the last name is unverified (the port joins with ", ").
- An invalid `LastOutput` drops only that block or cart; natively the whole chunk fails to load.
- The chat window shows the sender text string; it does not draw the component (the component only reaches LastOutput/NBT).
