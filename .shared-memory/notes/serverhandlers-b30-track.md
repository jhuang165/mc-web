# Batch 30 serverhandlers track (branch batch30-serverhandlers, from 5f9862e, release 0.58.0)

## Summary
- Native evidence: `tools/probes/ServerHandlersProbe.java` runs the unchanged `nh` (NetHandlerPlayServer) with test doubles for the server, world, player entity, item-in-world manager and network manager (plus a netty `AttributeKey` double). `tools/verify-server-handlers.mjs` writes `public/research/server-handlers-reference.json` (41 book, 10 creative, 15 chat, plus held, sign, placement, digging and use-entity groups) with class hashes for nh, oi, ael, aem, jm. Run with `MC_RESEARCH=<tools/research> node tools/verify-server-handlers.mjs`.
- MC|BEdit and MC|BSign: 41 native cases (valid, invalid, wrong slot, oversized page, missing title, re-edit and re-sign of a written book). `applyBookEdit` and `applyBookSign` already matched all 41; they are now replayed in `src/server-handlers.test.js`.
- Creative drop limiter ported: `src/server-handlers.js` (`SpamCounter`, `creativeDrop`) used by `CreativeScreen.drop`. +20 per drop, the 11th drop in a tick is refused (counter 200), 1 per tick decay, an invalid stack never counts, slot sets never count. The counter outlives the screen (module level, lazy decay by the game tick clock passed as `tick`).
- Chat limiter ported (`chatPacket`): +20 per message or command, kicked once the counter is above 200 (the 11th message is still delivered first), 1 per tick decay. Native finding: the single-player owner is NOT exempt. `oi.g` exempts an op, the owner only when the world allows commands, or LAN allow-cheats; this equals `commandHost.cheats`, which the gate uses. A kick leaves to the title with a toast ("Kicked for spamming"). Also ported from the same handler: 100 character cut, whitespace-run collapse (tabs and newlines become one space, ends trimmed) and the "Illegal characters in chat" kick (section sign, control chars, DEL; counter untouched).
- Other nh checks, evidence vs port:
  - Held slot outside 0..8 ignored: replayed (`heldSlot`); the port selects slots only via keys 1-9 and scroll, so no mismatch reachable.
  - Sign text: line over 15 UTF-16 units or any disallowed char becomes "!?" (not truncated); `acceptLine` in signs.js already matched; replayed. Uneditable, someone else's or unloaded tile writes nothing: matches.
  - Placement: block centre to feet squared < 64, player must have moved, y >= 255 on top or y >= 256 any face refused with a chat message. Replayed as pure rules (`placementOutcome`); the port has no server round trip, so these are not enforced in play (client reach is lower than 8).
  - Digging: eye-offset squared <= 36 and y < 256 for statuses 0, 1, 2; status 3/4/5 have no distance check. Replayed (`digAllowed`), not enforced for the same reason.
  - Use entity: feet to feet squared < 36 with line of sight, < 9 without; attacking an item entity or oneself kicks ("Attempting to attack an invalid entity"). Replayed (`useEntityAllowed`). Not enforced: client reach (3 survival, 6 creative) can only exceed 3 where the server would also allow it, and the no-line-of-sight 3-block rule is not modelled.
- Mismatch fixed (bytecode-read, `bje.d()` and `blt` getMouseOver `bje.i()`): creative reach is 5.0 for blocks and 6.0 for entities (survival 4.5 and 3.0). The port had these swapped (6 for blocks, 5 for entities). Five constants changed in `src/main.js` (pick calls for blocks, mobs, carts/boats, hanging).
- Book bidi: `book-ui.js` already right-aligned bidi lines; the layout is now an exported pure `splitLayout` and a test covers flag on, off and the `font.bidi` default.
- Tiny `src/main.js` hunks: the `chatSpamGate` wrapper around the chat `submit` hook, `tick: () => tickCounter` for the creative screen, the import, and the reach constants.
- `src/leads3.test.js`: the b29 drop test's fake screen gained `tick: () => 0`.

## Verification
- `node --test` on server-handlers, leads3 and creative tests: 29 pass. Full `npm test`: 4788 tests, 4787 passed, 1 failed (leads3 fake screen without `tick`, fixed and re-run green; the others unaffected). Spawner timing test passed in the full run and alone. `npm run build` passes.
- No browser check (no GUI hunk beyond the hook); no sound was played.

## Follow-ups
- Proposed gap line: "NetHandlerPlayServer placement (8 blocks), dig (6 blocks from the eye) and use-entity (6 / 3 blocks) distance checks are replayed as pure rules but not enforced; there is no server round trip in single player."
- Proposed gap line: "Attacking an item entity or the player itself kicks natively; the port cannot aim at either."
- Proposed gap line: "Chat whitespace normalisation uses java Character.isWhitespace; non-breaking spaces are untested natively."
- A creative drop from the survival tab container (`player.drops`) does not go through `CreativeScreen.drop`, so it is not counted yet; natively it is the same packet.
- Multiplayer chat (`multiplayer.send`) is not gated.
