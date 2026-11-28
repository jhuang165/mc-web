# horse102 (batch 102) track note

Branch `batch102-horse102`, cut from main 5b89c24c3 (release 0.130.0).

## Summary (file by file)
- `src/multiplayer/server-pos-look.js` (new): `sendPosLook` (queues a `posLook` message with x/y/z and the player's yaw/pitch on `p.dimOut`, expects one reply), `expectPosLook(sim, p, n)`, `ackPosLook`, `awaitingPosLook` (movement gate, 40-tick fallback so a silent client is not ignored forever).
- S08 sites now covered: `/tp` (`src/server-broadcast.js` teleport; replaces the old `look` playerOp, which only existed for `/tp <player> <target>`, now every /tp sends S08 with the player's yaw/pitch), ender pearl landing (`server-dispense.js`), bed lie-down and wake-up (`server-sleep.js`), respawn (`server-survival.js`, after the S39), portal arrival (`server-dimensions.js`, one expected C06, answered when the client applies `dimRespawn`), join (`server/server.js` expects one C06; the client answers after the welcome), dismount (`server-vehicles.js` now expects its two C06).
- `src/multiplayer/client.js`: `posLook` is queued like `dismount` (order kept around the merged tick), applied through the existing `playerOp look`, answered with one `posLookAck`; `dimRespawn` and the welcome are answered with one `posLookAck` each.
- `src/multiplayer/net-packet-ids.js`: `posLook` counts S08 (id 8); `welcome` and `dimRespawn` now include their S08.
- `src/multiplayer/simulation.js` (item 2): `input()` ignores controls/look while the last S08 is unanswered (inventory/slot adoption still runs).
- `server/server.js`: `posLookAck` releases the gate.
- Tests: `src/horse102-b102.test.js` (5). Old tests updated because they encoded the missing S08: `abilities100-b100` (S39 before S08, not last), `console88-b88` (welcome/dimRespawn bytes + 34), `console89-b89` (record lists include 8).

## Evidence
- Bytecode-read: `nh.a(DDDFF)` (setPlayerLocation) sets hasMoved false, stores the target in o/p/q, calls `mw.a(DDDFF)` and sends `fu(x, y+1.62, z, yaw, pitch, flags=false)` (no relative flags in 1.7.10). `nh.a(jd)` (C03): hasMoved false until a packet whose x/z equal the target (y delta^2 < 0.01) arrives; only then is the move processed.
- Bytecode-read: callers of `nh.a(DDDFF)` outside nh: `mw.b(int)`, `mw.a(III)` sleepInBedAt, `mw.a(ZZZ)` wakeUpPlayer, `mw.a(sa)` mountEntity, `mw.a(DDD)` setPositionAndUpdate (/tp, pearl), `oi.a(ej, mw)` join, `oi.a(mw, int, boolean)` respawn, `oi.a(mw, int)` portal transfer. Inside nh three more (the "moved wrongly" and invalid-move re-teleports).
- Port-read: the port's client sends controls and look, never a position; the server simulates the step itself. A stale `input` therefore cannot carry a stale position, but its look overwrote the S08's look, and its controls ran a step from the old pose. The gate fixes that.
- Port-read: no "moved wrongly" S08 exists, because no client position is trusted; left out (not invented).

## Verification
- `node --test --test-concurrency=2 src/horse102-b102.test.js src/horse101-b101.test.js src/horse100-b100.test.js`: all pass.
- Without `simulation.js` and `net-packet-ids.js` changes horse102: 3 pass, 2 fail.
- Neighbours (80 files naming the touched modules): 674/678 first run; the 4 failures were the three old tests above (updated, 13 pass) and one that passes alone.
- `npm run build`: not run (new module imports only node-free code).

## Follow-ups
- Open: same-dimension respawn sends no S07 in the port (only the S08 is added); `mw.b(int)` (travelToDimension) S08 not separately modelled; the 3 S08 inside `nh` (invalid move) have no port analogue.
- Browser-only: nothing checked; the client look application goes through the existing `main.js` `look` playerOp.
