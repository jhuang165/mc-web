# Batch 74 mptrack74: player position cadence, client interpolation, dimRespawn cut

## Summary
- `src/multiplayer/server-player-tracker.js`: one shared master `TrackerEntry` per target player and dimension (range 512, frequency 2, as natively one entry per entity) runs `sendLocationToAllClients` once per server tick. The sum of its move/look/teleport packets is the position every viewer holds; tracked rows in the `players` list carry that released position (decoded to blocks and port radians, `ySize` 0) instead of the live one. So a row's position changes at most every 2nd tick, in 4/32 steps, with the 60th-tick move and the 400-tick teleport resync. A riding player keeps his live row. The viewer's own row stays live. Membership (per-viewer entries) is unchanged.
- `src/multiplayer/client-ptrack.js` (new): `newInterp` / `stepInterp`, EntityOtherPlayerMP.setPositionAndRotation2 with 3 increments (yaw by wrapped difference). `presence.js` feeds `PlayerBody.tick` and `entry.state` (aim, tags) from it; a rider snaps.
- `src/multiplayer/server-dimensions.js`: the `dimRespawn` world goes through `playerTracker.snapshot(p.id, ..., to)`, so players outside the arriving player's tracked set are `far` list entries. `snapshot` now also uses the released positions.
- Wire: no new names.
- Tests: `src/mptrack74-b74.test.js` (6).

## Evidence
- Bytecode-read (b73, reused): `EntityTracker` row for EntityPlayerMP is (512, 2, velocity false).
- Executed (earlier batches, reused): `TrackerEntry.sendLocation` packet cadence against the unchanged `my` (`tracker-reference.json`, `TrackerVehiclesProbe`). No new probe: the entry code is the one already executed.
- Recalled: EntityOtherPlayerMP uses setPositionAndRotation2 with 3 increments (the same call the mob copies use, executed for mobs in b41).

## Deviations
- No forced off-beat sends for a jump (isAirBorne) or a data watcher change (sneak, item in use).
- Head yaw is the body yaw (S19 head packets are not modelled).
- The S18 teleport y + 1/64 offset is not applied.
- Native creates the shared entry when the player enters the world tracker; here it starts at the first tick message in the dimension.
- Positions travel in the row; only the cadence is native, not the packet encoding.

## Verification
- `node --test src/mptrack74-b74.test.js`: 6 pass. One at a time: streamfix73-b73 9, mpcadence72-b72 10, mpstream72-b72 10, mptrackers71-b71 10, mpnether-b61 7, multiplayer 5 pass.
- Full npm test not run (batch rule). No browser checks.

## Follow-ups
- Only a browser shows the remote walk smoothness and latency feel (about 2 ticks of cadence plus up to 3 of interpolation, as native).
- Forced sends and head packets.
