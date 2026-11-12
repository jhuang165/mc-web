# cmdoutput b50 track

Branch `batch50-cmdoutput` from ca6a447bf. Evidence: **executed** = unchanged 1.7.10 `CommandBlockLogic` (agp, via EntityMinecartCommandBlock xn) and `IChatComponent.Serializer` (fk) through `tools/probes/CmdOutputProbe.java` -> `public/research/cmd-output-reference.json` (`tools/verify-cmd-output.mjs`, 14 output rows, 8 load rows). **bytecode-read**: agp.a(fj)/a(dh)/b(dh), GuiCommandBlock bfh (shows `func_145749_h().getUnformattedText()`), fk field order.

## Summary
- Native `LastOutput` = `ChatComponentText("[HH:mm:ss] ").appendSibling(component)` serialized: `{"extra":["msg"],"text":"[hh:mm:ss] "}`; a translation is `{"extra":[{"translate":"k","with":[...]}],...}`, red errors `{"color":"red","translate":...}`, usage nests `with:[{"translate":"commands.tp.usage"}]`; number args are strings (`"64.0"`), style keys order bold,italic,underlined,strikethrough,obfuscated,color before extra/text; Gson html-escapes `< > & = '` and U+2028/9 (`serializeComponent` now does too).
- `commandBlockSender.print(text, component)` / `feedback(text, component)` builds that component; `commands.js` `feedback`, `fail` (red translation, nested usage), `commands-extra.js` send and `commands-scoreboard.js` notify pass the component beside the text. Text-only messages become a ChatComponentText (a leading `§x` colour becomes the style colour). `tp` coordinates pass Double strings (`64.0`). /say writes nothing to the sender (native: broadcast only). TrackOutput false keeps LastOutput null and writes no NBT key (executed).
- The stored string is also the NBT `LastOutput` and cart watcher 24 (unchanged plumbing).
- Loading: `normalizeLastOutput` (chat-component.js) parses and re-serializes like `fk.a` on load (block restore/NBT read, cart `initVariant`): old `{"text":"[t] msg"}` becomes the bare string `"[t] msg"` as native writes it back; `""` is null. Invalid JSON throws natively (JsonSyntaxException ends the load); the port keeps the string (documented difference).
- GUI Previous Output shows the component's unformatted text (translations through the language table), old and new shapes alike. Fix: the GUI no longer hides a loaded LastOutput when TrackOutput is false (bfh has no such check).
- Existing tests adapted to read the component text (`away-commands`, `command-block`, `furnace-cart-b49`).

## Verification
- `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node tools/verify-cmd-output.mjs`
- `node --test src/cmd-output-b50.test.js` (10) plus all command/chat/cart/summon/scoreboard/polish/object-tracker test files: 290 pass, 0 fail. `npm run build` ok. No full `npm test`, no browser run.

## Follow-ups (proposed gap lines)
- Other sender texts still go as plain text with a leading colour code (help pages, `deprecatedId` gray, gamerule query): native sends translations/texts with their own styles; the stored JSON for those uses ChatComponentText.
- `chat.type.admin` op feedback to other players is still the formatted string.
- Invalid-JSON `LastOutput` is kept rather than aborting the load.
- The translated GUI text was checked against the port's language table, not executed (the probe loads no language file).
