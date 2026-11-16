# Batch 76 mpwatched76: which values force the server entity tracker's send

## Summary
- `server-player-tracker.js` `watcherSig` now includes the score (`experience.score`, watcher 18): a score change forces the off-beat location send and S1C, as `DataWatcher.hasChanges()` does.
- The shared player entry gets `ridingEntity` from `p.mount`, so the entry runs the native riding branch (S1B(0), look packets only, `ridden`): a rider sends no move packets and the first send after dismount is a teleport (y + 1/64 lift already modelled). Rows of riders stay live as before.
- Sleeping and riding are NOT watched values (gap text was wrong on both); nothing added for them.
- Tests: `src/mpwatched76-b76.test.js` (3).

## Evidence
- Bytecode-read (javap -c -p, unchanged 1.7.10 jar): `yz.c()` (EntityPlayer.entityInit) registers watcher 16 (byte), 17 (float, absorption), 18 (int, score); `yz.bD/c(I)/s(I)` read, set, add watcher 18; `yz.v(I)` (addExperience) calls `s(I)` (addScore) first. Index 16 is only touched by the bit-1 flag accessors (cape), no sleeping bit: sleeping is a plain field and reaches viewers via S0A/S0B, never via S1C. Riding is `Entity.m` (ridingEntity), not in the DataWatcher.
- Bytecode-read `my.a(List)`: S1B(0) when `w != m` or (`m != null` and `ticks % 60 == 0`) before the block; block runs on `ticks % c == 0 || al || z().a()`; riding branch (`m != null`) sends only S16 look (|dyaw| or |dpitch| >= 4), refreshes d/e/f, sets `x` (ridden), then S19 head; non-riding branch has the velocity check gated by `u` (0.02 squared threshold, zero-motion special case) before the position packet; tail sends S12 through `b(ft)` when `sa.H` (velocityChanged) and clears it. All match `TrackerEntry.sendLocation`.
- Bytecode-read `bll` (EntityOtherPlayerMP): `e()` (onLivingUpdate) never calls moveEntity; it only reads motion for cameraYaw/cameraPitch (first-person bob). So a remote PLAYER copy's own velocity moves nothing natively: the interpolated position stream is the whole model. Mob copies already use S12 in `remote-mobs.js` ClientEntity; items in `client-itrack.js`.
- Executed: nothing new (entry is the executed TrackerEntry).

## Verification
- `node --test src/mpwatched76-b76.test.js` 3 pass; mpplayerfx75-b75 9, mptrack74-b74 6, streamfix73-b73 9, mpstream72-b72 10, mpriders73-b73 6, mpvehicles-b61 10, mpvehicles3-b63 13, mpcadence72 10 earlier run: all pass. No full npm test, no browser.

## Follow-ups
- Watcher 16 bit 1 (cape hidden, set by client settings C15) is not in `watcherSig`; skin/cape display options are not modelled server-side.
- Player S12 on velocityChanged (knockback) is not emitted; no visible effect on remote copies (see `bll.e`), but the owner's own S12 is a separate path.
- The port's viewers of a rider still get live rows; native copies move with the mount client-side. Unchanged.
