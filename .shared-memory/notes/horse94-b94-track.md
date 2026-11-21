# horse94 b94 track

## Summary
- Flaky `horse88-b88` "whole ridden ticks ... unsaddled" and `horse92-b92` rear tests: the TEST was wrong, the port is native. The horse's per-entity Random (seeded from Math.random) drove idle-talk rear and wander rolls the probe never recorded. Tests now stub `w.ai.think` and inject a `NoHit` Random via `setEntityRandom`.
- Player-rider input: native `mw.i` runs `sv.e`, which decays moveStrafing/moveForward by 0.98 on every C05 before the C0C overwrites them. The port skipped the decay. Fixed in `src/multiplayer/server-vehicles.js` (`decayRideInput`, applied in `takeRideOrQueue`).
- Non-sneak dismounts (mount setDead, rider setDead, mount killed, rider killed): the port already matched; new test pins them.

## Evidence
- Executed: `tools/probes/Horse94Probe.java` (player-rider scenarios steady, strafeBack, gap, gapQuiet, outOfRange, sneakRide; real `ahb.h()` dismount scenarios). Record: `public/research/horse94-reference.json`.
- Bytecode-read: `mw.a(FFZZ)` (C0C range checks), `mw.i` vs `mw.h`, `sv.e` decay, `ahb.a(sa,boolean)` tail link clearing.
- Port-read: `horse-live.js`, `mob-riding.js`, `entities.js` corpse branch.

## Verification
- `node --test --test-concurrency=1 src/horse94-b94.test.js` x25: 0 fail (12 tests each). Fails without the decay line (gap, outOfRange).
- `node --test --test-concurrency=2 src/horse88-b88.test.js src/horse92-b92.test.js` x40: 0 fail.
- Neighbours (`grep -rlE "server-vehicles|takeRideOrQueue|applyRide|riderInput|horse-live|mob-riding" src --include='*.test.js'`, concurrency 2): 414 tests, 1 old failure, fixed (below).
- `seat86-b86.test.js` encoded no-decay (it asserted the old value stays across a C05). Updated to the decayed values, which is the native behaviour.
- No full npm test, no build (no imports changed).

## Found wrong in the batch 93 list
- horse88/horse92 flakes were attributed to port randomness; the port is right and the tests were unseeded.
- seat86 "old value stays" expectation was wrong for C05 ticks.

## Follow-ups
- Not probed: mount enters water, lead pulls rider off, /kill on a real `mw` rider (needs server stubs for a real EntityPlayerMP death).
- Native: a dying horse with a saddled rider is movement-blocked (wi.bh); the port's corpse branch showed rare drift on the kill tick in a 3-tick test with live AI. Not root-caused; test stubs AI.
