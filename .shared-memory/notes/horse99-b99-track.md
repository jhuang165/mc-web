# horse99 (batch 99) track note

Branch `batch99-horse99`, cut from main 8df1376b7 (release 0.127.0).

## Summary (file by file)
- `src/multiplayer/client-dismount.js` (new): `applyDismount(message, state)`: S08, S1B, S08 on the client state: ySize 0, velocity 0, position AND previous position at the spot, the ride cleared.
- `src/multiplayer/client.js`: new `onDismount` callback; `apply` routes a `dismount` message to it (only when ready; a message arriving during terrain loading is dropped, the tick row carries the state as before).
- `src/main.js` (code-read only, 2 lines): import, and `onDismount` in the `DedicatedClient` options calling `applyDismount` with `position`, `previous`, `velocity`, `motion` and a `mpRiding` setter. Single player is untouched.
- `tools/probes/Horse99Probe.java` (copy of Kill97Probe, extra record fields; run from git-ignored `tools/research/horse99-probe/`), `public/research/horse99-reference.json`.
- `src/horse99-b99.test.js`: 4 tests.

## Evidence
- Bytecode-read: `bjb.a(fu)` (handlePlayerPosLook): `yz.V` (ySize) = 0, motion v/w/x = 0, `yz.a(DDDFF)` setPositionAndRotation, C06 reply; the first S08 also seeds `p/q/r`. S1B (batch 97 executed packet order S08, S1B, S08) clears ridingEntity. Before: the client got the spot only from the next tick row, so previous = the seat and velocity = spot - seat for one tick, ySize from the row. Now previous = spot and velocity 0 at once.
- Executed (Horse99Probe, real `wi`, `mw.a(sa)`, `ac()`): the rider's seat is 64.7 (ae() 1.2, `ad()` -0.5) for an adult horse and 64.1 (ae() 0.6) for a foal. `wi.a((sy) null)` (onSpawnWithEgg) makes a foal at random (growing age -24000): 11 of 48 horse records in 12 runs, on any ground (open, walls, ceiling). The 64.1 open vs 64.7 ceiling gap of batch 97/98 was that random foal landing on the first (open) record, not the ceiling. No port divergence: `horse.js` `mountedOffset` (height * 0.75 * growthScale(age)) gives 1.2 and 0.6 (test).
- Not modelled: the C06 reply to S08 (single-player-style position is server-authoritative in this port).

## Verification
- `node --test --test-concurrency=2 src/horse99-b99.test.js src/horse98-b98.test.js`: 12 pass, 0 fail.
- Neighbours (20 files naming multiplayer/client.js, via xargs): 144 pass, 0 fail.
- `npm run build`: ok (once).
- Fails-without-fix: not run by revert; `client-dismount.js` is new (tests 1 and 2 cannot import without it) and the routing test needs the `client.js` branch (no `onDismount` option existed).

## Found wrong in the batch 97/98 lists
- "Seat height 64.1 vs 64.7 unexplained / ceiling effect": it was the random foal, not the ceiling.
- "The client ignores `dismount`": fixed; the port's tick row differed only in previous position, velocity and ySize.

## Follow-ups
- Browser-only: nothing checked (the main.js lines are code-read only).
- Open: S08 carries x, y, z only on the port wire (no yaw/pitch); the C06 reply is not modelled.
