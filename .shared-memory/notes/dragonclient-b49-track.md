# dragonclient (batch 49)

## Summary
The client Ender Dragon copy now runs its own `updateDragonEnderCrystal` (`ClientEntity.crystalUpdate`, `src/entity-tracker.js`) and the beam is drawn from it.
- Target: dropped when its crystal copy is gone; otherwise health +1 on every 10th client `ticksExisted` while below 200 (client's own data watcher value; the server's S1C overwrites on its changes). Then `rand.nextInt(10) == 0` picks the nearest crystal copy (strictly nearer wins) whose 2x2 box meets the dragon box grown by 32.
- Crystals are tracked at 256 (clamped), frequency Integer.MAX_VALUE, no velocity. Their copies no longer get client physics (they would have fallen), tick `innerRotation` (+1, rolled from the copy's own `rand.nextInt(100000)`) and `age`.
- `animateDragon` reads `client.dragon.healer`, not the live dragon's.
- Living sound: already drew `nextInt(1000)` and pitch floats on the copy; it stays silent (RenderGlobal.playSound is empty). Verified by the draw counts below.

## Evidence
Executed (`TrackerMountsProbe` cases `b49dc0..2`, real unchanged `xa`, real `wz` server crystals tracked by `my`, `wz` copies from the S0E type 51 packet, S13 -> setDead): per tick the copy's target, health, ticksExisted, the draw count and last raw value of its `Entity.rand`, each crystal copy's innerRotation. 0 crystals; 1 crystal that blows up at tick 50; 2 crystals with the dragon flying so the nearest changes. 80 ticks each.
Bytecode-read: `xa.bP` (both sides, only the dead-crystal head attack is `!isRemote`), `bjb.a(fw)` type 51, `mn.a(sa)` crystal tracking (256, MAX, false), `wz.h` (client also writes fire in the End: not modelled), `ahb` `++ticksExisted`. The probe world's `getEntitiesWithinAABB` is a double; the chunk-walk order (x, z, y slice) is bytecode-read only and matters only for exact distance ties.

## Verification
- `node tools/verify-tracker-mounts.mjs` regenerated the reference (17 cases; the other cases are unchanged apart from the squid's unseeded `squidInit` roll, which the test reads from the record).
- `node --test src/dragon-client-b49.test.js`: 5/5 (mutations of the heal clock and the dead-target drop each fail it).
- 254/254 over tracker-mounts, entity-tracker, dragon*, object-tracker*, end, ring-events, dimension-live, serverplayer-b47, living-simulation, vehicle-render-b48. A node smoke with a live crystal in `EntityWorld`: copy stays at y 100, dragon copy targets it. `npm run build` ok. No full `npm test`, no browser check.

## Follow-ups
- A removed crystal's (or mob's) S13 destroy is flushed one tick late natively; the port drops the copy at once (the probe's PMP queues it at once too).
- The beam's texture scroll uses the crystal copy's `age`; the native renderer source is not in the jar, so whether it is the dragon's or the crystal's ticksExisted is unverified.
- The client crystal copy's End fire placement (`wz.h`, not `isRemote`-guarded) is not modelled.
- No browser check of the beam from the copy.
