# horse98 (batch 98) track note

Branch `batch98-horse98`, cut from main 3dd97fce9 (release 0.126.0).

## Summary (file by file)
- `src/multiplayer/server-vehicles.js`: `dismount(p, native = false)`. A mountEntity(null) (the sneak of a mob, cart or boat rider, the mob's buck, a rider in water) queues a `dismount` message on `p.dimOut` (`{ type: 'dismount', x, y, z, vehicle }`, the spot the rider was put on). Every other let-go (a vanished mount, a death release via `release`, a logout) sends nothing. The mark is the call's `native` flag or the rider's `released` (set by `riderSneakOff` and the buck); `dismount` clears `released` so it cannot leak into a later let-go, and `removePlayer` clears it first.
- `src/multiplayer/server-nether-vehicles.js`: its `v.dismount` wrapper dropped the second argument (found when the cart test failed); now forwards `native`.
- `src/multiplayer/server-survival.js`: the rider-in-water dismount passes `native = true`.
- `src/multiplayer/net-packet-ids.js`: `CLIENTBOUND.dismount = 8` and a `CLIENT_PACKETS.dismount` bundle: S08 (34 bytes), S1B (10), S08 (34), in that order, counted through the existing `writePackets` -> `netStats.write` loop in `server/server.js` (no new counting path). The message is flushed with the other `dimOut` messages (`dimensions.flush`), before that player's next tick message. The client ignores an unknown type (`client.js` apply has no branch for it), so it carries state-less information for the wire and `/netstat`; the client still learns the position from the tick row as before.
- `src/offline87-b87.test.js`: one entry added to its `CLIENTBOUND_CLASS` table (`dismount: "S08PacketPlayerPosLook"`) so its all-kinds id check covers the new kind. The test did not encode wrong behaviour.
- `tools/probes/Horse98Probe.java` (copy of Horse95Probe; `Horse98Probe` = pig under the rider, `Horse98Probe horse` = horse; run from git-ignored `tools/research/horse98-probe/`), `public/research/horse98-reference.json` (22 KB).
- `src/horse98-b98.test.js`: 8 tests.

## Evidence
- Executed (Kill97Probe dismount97, batch 97): the packets of `mw.a((sa) null)`: S08, S1B(mode 0, player, -1), S08. Bytecode-read order `yz.a(sa)` S08, `hx` S1B, `nh.a(DDDFF)` S08. Sizes from the executed PLAY_FRAME table (S08 34, S1B 10).
- Bytecode-read: native sends them for every mountEntity(null) on an EntityPlayerMP; the vanished-mount, death and logout paths do no mountEntity(null) (`ahb.h` just clears `ridingEntity`), so they stay silent.
- Executed (Horse98Probe, real `wo`/`wi`, `mw`, `ahb`, block 9): a rider is unlinked in `sv.C` once its eyes (feet + `mw.g()` 1.62) are under the surface. Pig (seat feet 0.175, eyes 1.795): dry never, 1 deep stays, 2 deep and 4 deep unlinked in tick 0. Horse (seat 0.7, eyes 2.32): dry never, 1 and 2 deep stay, 4 deep unlinked in tick 0; walking into a 4-deep pool unlinks at tick 10. The port (dedicated server, pig, 1 and 2 deep; scratch run for the dry seat 10.175 and the test) matches. The pig case is now Executed, not Port-read; no port divergence.
- Executed (probe correction): the horse95 probe copied `yz`'s yOffset 1.62 onto its player (`mw` sets 0 in its constructor and `e_`, bytecode-read), so its posY was feet + 1.62 and its eyes counted 1.62 twice; the horse95 records of rider y (e.g. 1.795 for the pig) were eye-shifted. The horse95 unlink verdicts for the 4-deep walk-in still hold (re-run, tick 10).
- Port-read: horse in water via the existing `horseSeats.dismount`; the water spot (`dismountSpot` accepts a water cell under the candidate, minecarts.js) was not run against a probe with water cells.

## Verification
- `node --test --test-concurrency=2 src/horse98-b98.test.js`: 8 pass, 0 fail. With the four source files reverted (copied aside, `git checkout`): 5 fail, 3 pass (the dismount counts, the sneak cart and pig messages, the stale-mark test, the water message test).
- Neighbours (42 test files naming server-vehicles, net-packet-ids, server-nether-vehicles, server-survival, writePackets, vehicles.dismount, sneakDismount, dimOut; one xargs run): 371 pass, 1 fail in two runs (the first run also failed `offline87-b87` "each plain message kind's id", fixed by the table entry above). The remaining failure is the known `horse89-b89` sneak-tick flake: alone it passes 3 of 3.
- `npm run build`: not run (no imports changed in `src/` beyond the existing modules).

## Found wrong in the batch 97 list
- "The dedicated server has no S08 or S1B on the wire": true for the wire message and `/netstat` (fixed), but nothing was wrong with state.
- The horse95/Horse97 probe seat heights: the 64.1 (open) vs 64.7 (ceiling) horse seat difference is not explained by this work; see Follow-ups.

## Follow-ups
- Open: the seat-height difference of the probe horse (64.1 open vs 64.7 under a ceiling) is not explained; the Horse98Probe fix of yOffset (0, not 1.62) is a lead for a probe that copies `yz` fields (the dismount97 probe may have it too).
- Open: the client does not act on the `dismount` message (it still follows the tick row); native S08 would teleport the client and S1B clear its ride.
- Open: S08 carries x, y, z only on the port wire (no yaw, pitch, onGround); counted at the native 34 bytes.
- Open: the dismount spot with water cells was not run against a probe.
- Browser-only: nothing checked.
