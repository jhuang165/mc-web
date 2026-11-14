# Batch 68 summon2: native /summon coordinates, no mob cap, tracker clamp, revenge liveness

## Summary
- `src/multiplayer/server-summon.js`: coordinates are native. `summonHost` adds `summonPosition` (sender position + the world's origin, so `~` is native) and maps absolute and relative coordinates to the stored cell (`toLocal`; exported `nativeOrigin`, `toLocal`, `toNative` for `mpworldcmds`). `inWorld` tests the mapped cell (y 0..255 and inside the dimension's window). Overworld and Nether origin is 0; the End uses `originX/originZ` (256 or legacy 128 window).
- The mob cap refusal is gone. New mobs get `summonKeep`; the cull in `server-mobs.js` (one condition) skips them.
- Named place for `mppaintings`: `SUMMON_HOSTS` (push `(sim, player, dim, world) => ({ hanging })`) and the mutable `UNKEPT_ENTITIES` set. Giant stays outside `SUPPORTED`.
- `src/commands.js` (one line): `host.summonPosition` replaces `pos()` for `/summon` when a host defines it.
- `src/ring-events.js`: `trackerLimit(vd)`, `clampTrackRange`; `entity-tracker.js` derives `TRACKER_LIMIT` from it; `server-spawners.js` clamps the puff `sq` (dragon 160 becomes 144).
- `server-combat-tracker.js`: `KillCredit.tick(now)`; `server-stats.js` runs it at the top of `mobs.tick`, and `killer` no longer tests liveness. `mpsummon-b67.test.js` test 15 now ticks the victim between the attacker's death and the kill.
- Test: `src/summon2-b68.test.js` (8 tests).

## Evidence
- Bytecode-read: `mn.<init>` sets `e = oi.d()`; `oi.d` = `mq.b(s())` = `viewDistance * 16 - 16`; `oi.a(int)` (setViewDistance) only resizes the PlayerManagers, so the tracker limit is fixed when the world is built; `mn.a(sa,int,int,boolean)` uses `min(range, e)`. The tracker already clamped (144) from earlier batches; the gap was the spawner puff `sq` and the missing viewDistance link.
- Bytecode-read (b67 note): `sv.aX` has no alive check; `sv.C` drops a dead or 100-tick-old revenge target in the victim's tick. So native tests the attacker at the victim's last tick; now modelled (once at the top of the world tick, not per entity order).
- Recalled: CommandSummon uses `World.blockExists` (y 0..255 and a loaded chunk) and no spawn cap; the finite windows stand in for "loaded". Not re-verified by a probe.
- Not executed: no new Java probe.

## Verification
- `node --test src/summon2-b68.test.js`: 8 pass. One at a time: `mpsummon-b67` 15, `entity-tracker` 24, `ring-events` 6, `mpstats3-b65` 7, `mpstats2-b64` 10, `mpspawners2-b65` 9, `commands` 14, `summon-coverage` 7, `servercommands-b59` 11: all pass. Full npm test not run (batch rule). No browser check.

## Follow-ups
- Tag coordinates other than the position (leash X/Y/Z, painting TileX) are not mapped by the End origin; only the command position is.
- The server's view distance is the constant `VIEW_DISTANCE` (10); no server.properties value feeds the clamp.
- A mob count beyond the cap is only bounded by the tick cost; the client wire is not checked in a browser.
- The spawner egg and dispenser egg paths still refuse at `MOB_LIMIT` (not this track).
