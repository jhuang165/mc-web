# horse101 (batch 101) track note

Branch `batch101-horse101`, cut from main 776d5f8a4 (release 0.129.0).

## Summary (file by file)
- `src/multiplayer/server-vehicles.js`: the `dismount` message carries `yaw` and `pitch` (the player's own last input angles, `p.yaw` / `p.pitch`).
- `src/multiplayer/client-dismount.js`: `applyDismount` applies them through an optional `state.setLook` after each of the two S08s.
- `src/main.js` (code-read only, one hunk in the `onDismount` options): `setLook` sets `yaw` and clamps `pitch`.
- `src/multiplayer/client.js`: after `onDismount`, the client sends two `posLookAck` messages (one C06 per S08), only when it has a socket.
- `src/multiplayer/net-packet-ids.js`: `posLookAck` counted as id 6 (C06PacketPlayerPosLook), size SV[6]. `server/server.js`: one line accepts `posLookAck` (otherwise "Unknown message" closes the socket) and does nothing else.
- `src/offline87-b87.test.js`: one entry `posLookAck: "C06PacketPlayerPosLook"` in its class table (the table lists every serverbound kind; not a behaviour change).
- `src/horse101-b101.test.js`: 4 tests.

## Evidence
- Bytecode-read (b100 note, re-checked against the code path): S08 `fu` is built by `nh.a(x, y, z, mw.y, mw.z)` with the player's yaw/pitch; `bjb.a(fu)` (handlePlayerPosLook) sets position and rotation absolutely, then replies C06. Item 1 and 2 were native, so both are made. The look is the last one the client sent, so the snap is only the turning still in flight (b100 argued no-op; it is a real, small, native snap).
- Port-read (item 3): `buffer()` pushes every ordered message kind into `this.messages` in arrival order, the dismount included, so health, chat, slots etc. keep their order relative to the dismount (test). The only non-ordered part is the merged tick (position rows, block changes), which `start()` places around the dismount since b100. Other ordered kinds vs the merged tick are not native-ordered; the tick carries only latest-state rows, so I did not flush a tick per message (that would defeat the slow-device merge).
- Port-read: the port already sends `input` every tick, counted as C03 family id 3; the S08 reply is an extra C06 and is a separate message, not a second input (a second input would run the server's player step twice).

## Verification
- `node --test --test-concurrency=2 src/horse101-b101.test.js src/horse100-b100.test.js src/horse99-b99.test.js src/horse98-b98.test.js`: 18 pass, 0 fail.
- With `server-vehicles.js` and `client.js` reverted: horse101 2 pass, 2 fail.
- Neighbours (53 files naming client.js, server-vehicles, net-packet-ids, client-dismount): 425 tests, after the offline87 table entry all pass.
- `npm run build`: not run (no new imports).

## Found wrong in the batch 100 list
- "S08 yaw/pitch is a no-op": it is native and small; now modelled.

## Follow-ups
- Browser-only: nothing checked (the `main.js` setLook is code-read only).
- Open: other ordered messages vs the merged tick (see above).
