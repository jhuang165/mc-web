# Batch 65 trackertransient2: transient mobs, away transients, fall scream, burning copy in rain

## Summary
- `src/tracker-transient.js`: `noteGoneMobs(world, before, after)`. Mobs have no spawn hook, but they leave the list in one place (`EntityWorld.tick`'s end-of-tick filter). A removed mob that no tracker ever listed is a mob that spawned and went inside one tick. It is marked `transientGone` and pushed to `tracker.born` (live) or `traceBorn` (away worker). `transientIds` accepts `transientGone` as well as `dead`.
- `src/entities.js`: three short hooks: `joined` also pushes to `this.traceBorn`; the end-of-tick filter calls `noteGoneMobs`; `moveClient` passes the landing to `copyFallScream`. `clientEnvironment` zeroes `fallDistance` in water (Entity.handleWaterMovement) and `moveClient` sets `c.living` so a landing in water cancels the fall, as moveEntity already does for living entities.
- `src/away-trace.js`: `AwayTrace.born` (the world's `traceBorn`), `noteTransients` at each sample (an entity born and dead/gone in the tick, never sampled, not alive), `finish()` returns `transients: [[id, tick]]`, `transientsAt(trace, i)`. `src/away-entities.js`: `mobs.traceBorn = trace.born`. `src/away-track.js` passes `transient` per tick; `src/entity-tracker.js` `idleUpdate(..., transient)` adds and removes a once-only key among the tick's new entries, in id order. `ClientEntity.fallDistance` starts at 0 (it was undefined, NaN after the first fall).
- `src/copy-talk.js`: `copyFallScream` (enderman copy, landing above 3 blocks sets `screaming`).
- Research: `MobCopies2Probe` blocks `fallhigh`, `fallshort`, `fallnone` (3 seeds x 60 ticks each) and `rainburn` (3 x 60): 12 records appended to `mobcopies2-reference.json` (597; the 585 old ones untouched).
- Tests: `src/trackertransient2-b65.test.js` (22).

## Evidence
- executed (item 3): a dry enderman copy dropped from y 8 or y 3.5 lands, then rolls `nextInt(100)` every tick (scream set); dropped from y 3.0 it never does. The landing tick itself has no extra draw on the copy's Random (the fall sound goes to the world's). So the port needs only the flag, and the draws replay for 60 ticks, 9 records. EntityEnderman.attackEntityFrom sets the scream before its super call, and the client side of the super call refuses (recalled, consistent with the records).
- executed (item 4, found wrong): a burning zombie copy (watcher 0 bit 0) in rain at every y for 60 ticks never plays `random.fizz` and draws nothing for rain. bytecode-read: `sa.C` (onEntityUpdate) sets `fire = 0` on a client entity every tick; `sa.d` (moveEntity) plays `random.fizz` only for `isWet() && fire > 0`, and sets `fire` inside the move only when NOT wet. So a copy never fizzes and rain never extinguishes it. Nothing to draw; the gap is closed by a test, not code. The `burning` flag a copy follows is watcher 0 from the server and rain does not clear it.
- executed (item 1): TrackerDeadProbe `transient*` cases are entity-agnostic (the real World.updateEntities removes any dead `sa`, a mob included), so the b64 records already cover a mob. The new tests replay `transient12`, `transientTwo`, `transientMid` with the transient as a `mob-N` through `noteGoneMobs` and `serverTick`.
- executed (item 2): the same records replayed through `AwayTrace` + `idleUpdate`. `transient12`, `transientTwo`, `transient11` match after every tick. `transientMid` is not replayed this way: its probe ids are not in spawn order (the transient 33 spawns after the child 40) and the replay adds a tick's new entries in id order, which is spawn order for real entities (ids only rise).
- recalled: nothing new.

## Verification
- `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node tools/verify-mobcopies2.mjs` to a scratch file; only the 12 new records were taken.
- One at a time: `trackertransient2-b65` 22, `trackertransient-b64` 19, `mobcopies3-b63` 12, `mobcopies2-b61` 50, `singleleft-b62` 10, `trackerorder-b61` 7, `awaytracker-b60` 5, `away-entities` 11, `entity-tracker` 24, `mobsounds-b60` 108, `horse-copy-b54` 6, `trackeridle-b59` 5, `trackerphase-b58` 10, `tracker-spawn-b57` 10, `tracker-mobs-b56` 10, `away-order-b50` 12, `enderman` 14, `tracker-joint2-b53` 13: all pass.
- `node --check` on every touched src file. No main.js change. Full npm test not run (batch rule). No browser check.

## Follow-ups
- The mob hook sees a mob only when it is removed unlisted; a mob spawned and removed by some path other than the tick's end filter (the villager infection splice, the frozen-mob sweep) is not reported. Both act on mobs that were already tracked, in practice.
- The away replay adds transients in id order with the tick's new entries, not at the exact spawn moment (as in the live path since b64).
- A transient in the worker is detected from `dead`/`transientGone` at the sample; an item merged away in the same tick it spawned is covered, a kind the worker does not list and does not flag `dead` is not.
- Browser only: an enderman copy visibly screaming after falling.
