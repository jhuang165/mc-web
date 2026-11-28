# console102 (batch 102) track note

Scope: dedicated server packet model and `/netstat`: same-dimension respawn sequence, death S19(3) to trackers, exact swing gate, per-tick self packets audit. Claims: Executed / Bytecode-read / Port-read. No browser checks, no new probe.

## Summary (file by file)
- `src/multiplayer/net-packet-ids.js`: `abilities` bundle: with `m.respawn` it counts S39, S07, S08, S05, S1F, S03, (S2B x3 while raining), S30, S2F(cursor), S1F. `healthHurt` counts two S19 when `hurt` and `die` are both set. `playerPackets` counts S19 for row `died` after the hurt's S19.
- `src/multiplayer/server-survival.js`: `respawn` adds `respawn: { rain }` (non-enumerable `slots`, so nothing extra goes on the wire) to the abilities message when the player is in the Overworld (Nether/End respawns are a `dimRespawn`).
- `src/multiplayer/simulation.js`: both presence builders carry `died` (vitals.die, one tick like `hurt`); `p.swingTick?.()` before the swing countdown.
- `src/multiplayer/server-swing.js`: explicit swingProgressInt / isSwingInProgress counters (`p.swingState`), advanced by `p.swingTick()`; exact for any end.
- `src/console101-b101.test.js`: harness line now calls `q.swingTick()` (the gate needs the tick the real loop makes); behaviour asserted is unchanged.
- `src/console102-b102.test.js`: 3 tests.

## Evidence
- Bytecode-read (`oi.a(mw,int,boolean)`): setGameType (S39), S07 (hs), S08 (nh.a DDDFF), S05 (ig), S1F (ia), `oi.b(mw,mt)` = sendWorldInfo (S03 ih; S2B gv 1/7/8 if raining), addPlayer, spawn entity, `mw.d_` = S30 + cursor S2F, `setHealth`. An invalid bed sends S2B(0) before S08 (already counted as `sleepMsg`).
- Bytecode-read (`mw.l_`): S1F when experienceTotal != lastExperience; the new player's lastExperience is -99999999, so a second S1F follows; S06 likewise (counted by the existing `health` message).
- Bytecode-read (`sv.ba/bb`): swing condition and counter as in the b101 note. Death S19(3) is `setEntityState(3)` in onDeath, after the hurt's status 2; to trackers and the victim.
- Port-read: the victim's own S19 was one packet per `healthHurt` message; hurt+die in one tick is two natively.

## Verification
- `node --test src/console102-b102.test.js src/console101-b101.test.js`: 7 pass; console102 test with net-packet-ids and server-swing reverted: 3 fail.
- Regression: 40 files naming net-packet-ids, server-swing, abilities, serverSurvival, healthHurt, dimOut or `.respawn(`: 300 tests, 300 pass.
- `npm run build` not run (no import added).

## Found wrong in the batch 101 list
- Nothing wrong; item 3's "accepts at count 0" is now exact.

## Follow-ups
- Item 4 audit not done beyond this: S03 every 20 ticks, `health` S06 and window S30/S2F already counted; S1F from XP changes counted via `playerOp` only (no per-update total diff).
- Respawn: the new player's chunk S26 bulks are not counted (the port client resends nothing); the second S1F comes in the bundle, not at its exact order position. `dimRespawn` (portal / Nether respawn) still lacks S08, S1F, S03, S30 records.
- Two C0A in one tick both pass natively (progress -1); port counts one S0B.
- Browser-only: nothing visible changes.
