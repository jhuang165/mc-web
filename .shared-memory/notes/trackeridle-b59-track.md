# Batch 59 trackeridle: the tracker ticks that run while the player is in another dimension

## Summary
- `src/entity-tracker.js`: `MobTracker.idleCatchUp(mobs, size, ticks)` runs `idleUpdate` for `ticks` silent ticks (a trip past 482400 ticks runs `1200 + (ticks - 1200) % 481200`, the same phase).
- `src/entities.js`: `EntityWorld.idleTrack(ticks, keep)` makes the tracker and catches up the kept mobs only.
- `src/dimension-live.js`: `finishAway` records `awayIdle = { ticks: rawTicks, spawn }` (all ticks of the trip, not the 72000 cap); `takeIdle()` hands it out once; `travel` clears it first.
- `src/main.js` (two lines): when the Overworld is opened on a return (`record.transit`), mobs whose chunk is in the spawn area (`inSpawnArea`, 128 blocks) get `idleTrack(awayTicks)`. The other mobs enter at the first real tick, age 0, as chunk-loaded entities do.
- `src/trackeridle-b59.test.js` (new, 5 tests).

## Evidence
- Bytecode-read (javap, unchanged 1.7.10 jar): `MinecraftServer` world loop runs `mt.b()`, `mt.h()`, then `mt.r().a()` (EntityTracker.updateTrackedEntities) for every WorldServer with no player test.
- Bytecode-read: `ms.b(x, z)` (unloadChunksIfNotNearSpawn) keeps a chunk loaded only when `provider.e()` (canRespawnHere) is true and its centre is within 128 blocks of the world spawn. `aqp` (Nether) and `aqr` (End) return false; the base provider and `aqq` (Overworld) return true. So the Nether and the End keep nothing loaded without a player: their start at the arrival (age 0) is right, and the b58 follow-up is wrong for them. Only the Overworld spawn area keeps ticking.
- Bytecode-read: `mt.h` returns after 1200 idle ticks (entities freeze); the tracker tick above keeps running.
- Executed (existing): tracker-joint-reference.json (b58 dimAge cases) is what `idleUpdate` already replays; `idleCatchUp` is the same tick repeated (test 1) and its long-trip reduction equals the full run (test 2; a wrong period fails it). The forced-teleport counter resets after passing 400, so it has period 401, which is why the reduction is not 1200.
- Recalled/assumed: an Overworld entity tracked before the departure has an age before the trip too; the port does not keep it (a world open starts every entry at 0), so the phase is the trip's ticks only.

## Verification
- `node --test src/trackeridle-b59.test.js` -> 5 pass; mutation (reduction period 24000) fails test 2.
- `node --test src/tracker*.test.js src/dimension-live.test.js src/dimension-away.test.js src/away-world.test.js src/away-trip.test.js src/entity-tracker*.test.js src/trackeridle-b59.test.js` -> 180 pass, 0 fail.
- `npm run build` run once (see report). Full npm test not run (batch rule). No browser checks.

## Follow-ups
- Mobs only: the Overworld's objects (items, arrows, carts, boats, hangings) in the spawn area are not caught up (they need the joint lists of `idleUpdate`).
- Entities are caught up at their final state, not the state they held on each tick of the first 1200 ticks, so the last sent position and motion of an entity that moved during the trip can differ from native until its next update. Frozen entities (after 1200 ticks) are exact.
- The loading screen ticks of the return itself are not added; mobs that entered the loaded area from the away run (spawned there) get the full trip age instead of their own.
- Needs a browser look: a mob kept in the spawn area sending its first updates on the native phase after a Nether round trip.
