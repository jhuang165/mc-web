# cmdtell b53 track

Branch `batch53-cmdtell` from 5ea7bb4d1. Evidence: **executed** = the unchanged 1.7.10 `ChatComponentText` (fq), `ChatComponentTranslation` (fr), `ChatStyle` (fn), `ClickEvent` (fh/fi) and `IChatComponent.Serializer` (fk) through `ChatComponentProbe` (8 new rows, tag `b53ct`, 23 rows in `chat-component-reference.json`). **bytecode-read**: `EntityPlayer.func_145748_c_` (yz.c_) = ChatComponentText of the team-formatted name with a ClickEvent(fi.e suggest_command, "/msg " + name + " "), no hover. **source-recalled (not executed, not in the client jar)**: CommandMessage, CommandBroadcast, CommandServerEmote, CommandBase.func_147176_a and NetHandlerPlayServer.processChatMessage; the probe builds the trees they build, so only the formatting/serialization of those trees is executed.

## Summary
- `/tell` (`/msg`, `/w`): the sender gets `commands.message.display.outgoing` (target's player component, message component), the target `commands.message.display.incoming` (sender's component), both gray italic translations. In one world the target can differ from the sender only for a command block (sender "@", target the player): the incoming goes through `host.broadcast` to the chat, the outgoing to the block's LastOutput. Self-target is still `commands.message.sameTarget`.
- Messages of `/tell`, `/say`, `/me` are `func_147176_a` trees: an empty ChatComponentText with the words as siblings joined by " " siblings; `/say` always expands `@p/@a/@r` to the matched player's component (names joined by ", " in an empty parent), `/tell` and `/me` only for a non-player sender; a token that matches nobody is `PlayerNotFound` (the selector-allowed flags are recalled from the source, unverified).
- Player chat: `chat.type.text` args are now (player component, plain string). The name carries the `/msg <raw name> ` click, so a click on a name in the chat window suggests it (`chatTextComponent(formatted, text, rawName)`; `main.js` passes `PLAYER_NAME`, one-token hunk). The formatted text of the line is unchanged ("<§rName§r> §rtext§r"); the JSON differs (clickEvent, string argument).
- `/say`, `/me` previously passed a plain-string name and a joined string; the formatted text now has the sibling `§r` structure shown by the rows (`[§rSteve§r] §r§rhi§r §rthere§r`).
- Death messages and the achievement broadcast still use string names (they are natively player components with the same click); left as is.
- Chunk load failure (3): not mirrored in the runtime stores. The port saves command blocks and carts as separate global lists, not as per-chunk NBT with tile-entity/entity lists, so no record can fail "a chunk": the loaders skip just that block or cart. Mirroring would mean discarding the chunk's block edits and regenerating, without an owner relation from record to chunk, for an input only a hand-edited save can produce (the port writes `serializeComponent` JSON and re-serializes on load).

## Verification
- `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node tools/verify-chat-component.mjs` (23 rows)
- `node --test src/cmd-tell-b53.test.js` (7), `src/chat-component-b52.test.js` (6; its old count assertion now skips the b53ct rows) and every test file importing commands/team-names/chat-component/command-block/command-host/chat/away-commands: 369 tests, 0 fail. `npm run build` once. No full `npm test`, no browser run.

## Follow-ups (proposed gap lines)
- `/tell`, `/say`, `/me` and chat trees come from recalled 1.7.10 source, not command-class bytecode; the selector-allowed flag of `/me` and `/tell` is unverified. Only the local player can be selected or whispered.
- Death messages, the achievement broadcast and the scoreboard still take plain-string player names (native: a player component with the `/msg` click).
- A command block or cart with an invalid LastOutput in a saved world is skipped alone (the port has no per-chunk NBT); only the region import fails the chunk.
