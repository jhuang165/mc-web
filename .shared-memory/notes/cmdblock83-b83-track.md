# cmdblock83 (batch 83): command block LastOutput, the sender-as-player literal, client comparator count

## Summary
- **/gamemode from a block or cart keeps LastOutput.** `commandBlockSender.feedback(text, component, flags)` (command-block.js) skips `sender.print` when `flags & 1`. commands.js `feedbackFlags` already passed the flag (commands82). The admin line to ops is unchanged. This covers single-player blocks, server blocks (`runCommandLogic`), server and single-player carts and the away runs, because they all use `commandBlockSender`.
- **The target's "gameMode.changed" no longer reaches LastOutput.** `commandBlockSender.targetPrint` is new. A server host `deliver`s the line to the player-state base (the target when there is no redirect; the redirect has its own `targetPrint`). Single player prints it to the player. Before, it went through `say` into the block's LastOutput whenever the target was the base or local player.
- **The getCommandSenderAsPlayer literal.** commands.js has a new `senderNotPlayer()`: CommandException("You must specify which player you wish to perform this action on.", [], "player"). It replaces `playerNotFound()` at the four `host.isCommandBlock` throws: `targetArg` (gamemode, xp, clear, spawnpoint, achievement), kill, tp with 1 or 3 arguments, and setworldspawn with none. Those are the only commands.js edits. A named target that is not online is still `commands.generic.player.notFound` (getPlayer).
- **Client comparator prediction.** `ClientRedstoneView` (client-comparator.js) registers a 137 behaviour whose comparator reads `hooks.successCount(x, y, z)`. main.js `predictPlace` passes `successCount` from `redstoneRuntime.commandBlocks.get` (new, non-creating `get` on `installCommandBlocks`), which is the tile that `applyTiles` fills from S35. The count is unclamped.
- **GUI.** In `commandBlockScreen` the Previous Output text is `lastOutput != null ? unformatted(lastOutput) : command`, sliced to 32767. The label and the field draw when that text is not empty.
- **S35 check (port-read, no change):** `tile-sync.js commandOf` sends Command, SuccessCount, CustomName, LastOutput (only when not null) and TrackOutput, matching `agp.a(dh)`. `applyTiles` reads them as `agp.b(dh)` does: Command and SuccessCount always, the others only when present. Only output changes and MC|AdvCdm resend; a count-only run sends nothing (as native), so the client count can be stale.

## Evidence
- **Bytecode-read** (`javap -c -p`, 1.7.10 jar):
  - `bl.a(ac, aa, int, String, Object[])`: the rule gate for `agp` senders, then ops other than the sender with `aa.a(player)`, then the server log, then `if ((flags & 1) != 1) sender.a(new fr(key, args))`.
  - Every call to the 5-argument `y.a` is in `ar`, and `y.a(ac, aa, String, Object[])` passes `iconst_0`.
  - `y.b(ac)`: `instanceof mw`, else `new cg("You must specify which player you wish to perform this action on.", new Object[0])`. Its callers are `ae, ai, ap, ar, aw, bk (x2, guarded), bn, bp, bv`, found by scanning all classes.
  - `agp.a(fj)`: `"[" + HH:mm:ss + "] "` (raw constant bytes `5d 20`; javap trims the space), then appendSibling and `e()`. `agp.a(ahb)` does not clear LastOutput.
  - `bfh.b()` offsets 196-317 (the output field) and `bfh.a(IIF)` offsets 212-277 (label and field only when the text length is above 0). `fe.c()` joins `e()` over the component tree.
  - `gv` static table: state 3 is "gameMode.changed".
- **Port-read:** tile-sync.js S35 fields; server-command-blocks.js resend points.
- **Executed against the jar:** none this batch.

## Verification
- `node --test src/cmdblock83-b83.test.js` (new): 6/6 pass. All 6 fail with the four source files reverted.
- Batch 1 (22 files: away-ride, away-shadow, away-commands, chat-multi-b57, cmd-tell-b53, chat-component-b52, command-block-screen, commands-extra, cmd-args-b82, cmd-texts-b51, command-block, cmd-chat-b56, commands, cmd-output-b50, command-selector, command-tags, falling79-b79, gui-screens, furnace-cart-b49, mpcmd81/80/82): 163/164 on the first run. The failure was `away-commands.test.js`, which encoded the gap (kill from a block read "That player cannot be found"). It now expects the literal.
- Batch 2 (25 files, including away-commands again, servercommands-b59, serverbroadcast-b58, smallchecks2-b60, prediction5-b59, mpworldcmds-b68, mpcommands2-b60, polish, scoreboard, mpvehicles3-b63): 255/255 pass.
- No full `npm test` was run, and no browser checks were made.

## Follow-ups
- **Browser-only:**
  - The GUI shows the command in Previous Output for a block that has never output anything.
  - In single player, chat shows "Your game mode has been updated" after a block's `/gamemode @p`.
  - In multiplayer, the comparator click preview behind a command block with a count.
- The away run (away-commands.js) now prints the target's "gameMode.changed" to the away chat collector rather than into LastOutput. Whether the native player would see it depends on the away model and was not checked.
- A count-only run never resends S35, so the client count stays stale until the next output or edit. This matches native and was not changed.
