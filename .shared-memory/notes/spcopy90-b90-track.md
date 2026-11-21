# spcopy90 (batch 90): the copy keeps onGround through a portal trip, answers its S08 a network tick later, and sends one S08 for a broken mount

## Summary

Works through the two items batch 89 (spcopy89) left open for the integrated server's copy of the player. It does not claim full parity.

1. **onGround crosses the trip.** `ai.js PlayerView.arriveFrom` now copies `old.onGround`. `living-simulation.js` no longer overwrites the copy's onGround from the client's state while the copy has `left` the world or waits for a C06 (`hasMoved === false`). The first answered mw.i() therefore runs with the carried flag (ground or air friction), as natively. fallDistance and inWater were already carried (b88).
2. **The S08 is answered one network tick later.** New `PlayerView.answerFrom` (set by `setLocation(at, { late: true })`) and `server-process-player.js takeAnswer(p)`: an answer queued by an S08 of the current tick is taken from the next network tick on. `late` is used for the mount tick, the dismount, the first sleeping tick and a broken seat (`brokenMountLocation`). The arrival's S08 (sent in the old world's trip tick) and processPlayer's corrections keep their behaviour (they already queued for the next network tick). `awaitedRuns` and the walking branch of `entities.js serverPlayerUpdate` use `takeAnswer`. The riding-dead branch no longer processes the answer in the same tick.
3. **Found and fixed: a double S08 for a broken mount.** When the client's link ended a tick after the world-pass break (the riding-dead branch sent the S08 first), `PlayerView.update`'s `gone && remounted` sent a second one. `brokenSent` records the mount already announced.

## Evidence

- **Bytecode-read** (`javap -c -p`, `tools/research/minecraft-1.7.10.jar`):
  - `oi.a(mw,int)` (transferPlayerToDimension) putfields: `mw.ap`, `mw.K` only; `oi.a(sa,int,mt,mt)`: `sa.t` only; `ahp.a` / `ahp.b`: v/w/x and `sa.y` only. No write of onGround (`D`), none in `mw.a(DDDFF)` setPlayerLocation either. processPlayer returns at 681-688 when the trip cleared `r`, so `mw.D = packet` (1060, 1464) is not reached.
  - The S08 is sent from the server tick that calls setPlayerLocation; the client handles it in its next network processing (`bjb.a(fu)` answers), so the C06 reaches the next server network tick, and this tick's C03 meets `r == false` (offsets 31-87).
- **Port-read:** the b89 same-tick processing (`awaitedRuns` 2 runs on the tick of the mount; the riding-dead branch's inline answer); `living-simulation.js` line 95 overwrote onGround from the client every tick.
- **Executed** (port only, no 1.7.10 client): `src/spcopy90-b90.test.js`. The onGround test fails with the `arriveFrom` line removed (checked).

## Verification

- `node --test src/spcopy90-b90.test.js`: 5/5.
- 57 test files that import or name server-process-player, living-simulation, serverPlayerUpdate, PlayerView, arriveFrom, processPlayer, setLocation or `ai.player` (`--test-concurrency=2`): 583/583.
- `npm run build`: passes.
- Old tests updated because they encoded the compression (same-tick answer) or the double S08: `spcopy88-b88.test.js` (dismount: the first tick waits, the next answers; the riding-dead source pin), `spcopy89-b89.test.js` (hit cart, world-pass cart, mount tick, sleep tick, and a new assertion of one S08).

## Found wrong in the batch 89 list

- The riding-dead branch plus the later unseat sent two S08 for one broken mount (fixed, item 3).

## Follow-ups

- Browser-only: no rubber-band or visible hitch on mounting, sleeping, dismounting, a broken cart, a portal arrival.
- The arrival's answer still lands in the first new-world tick (native: the trip's S08 precedes that tick, so same-tick is right); but the port's trip spans several ticks that a real server thread would not.
- The copy's own onGround after a trip is the old copy's last one; the old copy's onGround is only refreshed by the network tick, as natively.
- `dimension-live.js awayIdle` dead `record.transit` read and the unguarded `ai.player` readers (b89 follow-ups) are untouched.
