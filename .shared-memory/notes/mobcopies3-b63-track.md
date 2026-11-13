# Batch 63 mobcopies3: burning enderman copy, boat boxes in its teleport, tracker death order re-probed

## Summary
- `src/copy-meta.js`: watcher 0 bit 0 as `burning` (the live mob's `fire > 0`) in the copy meta (S0F spawn and S1C), applied to `c.burning`. Sent for every living mob; only the enderman reads it.
- `src/copy-teleport.js`, `src/copy-talk.js`: `copyLivingPre` takes the wet branch when `inWater || burning`, and the branch clears the copy's scream flag first (`setScreaming(false)`), so a wet or burning screaming copy no longer draws the `nextInt(100)` roll. `copyTeleportEnv(world, boatBoxes)`: the destination test also counts boat copy boxes.
- `src/entities.js` (one argument on the `copyLivingPre` call), `src/main.js` (one line: `mobs.clientBoatBoxes` from `objectTracker.vehicleTargets()` boats).
- Research: `MobCopies2Probe` blocks `burntp` (3 seeds x 100 ticks) and `wetscream` (3 x 60) -> 6 records added to `public/research/mobcopies2-reference.json` (576; the 570 old ones are untouched, see the b62 note on the two unseeded records). New `tools/probes/TrackerDeadProbe.java` + `tools/verify-tracker-dead.mjs` -> `public/research/tracker-dead-reference.json` (4 cases).
- Tests: `src/mobcopies3-b63.test.js` (12).

## Evidence
- executed: burntp: a dry enderman copy with watcher 0 = 1 runs `nextDouble, nextInt(64), nextDouble` and the teleport every tick. Replayed draw for draw.
- executed: wetscream: the 100-roll runs only while the copy is dry; no roll once wet.
- executed: TrackerDeadProbe runs the real `World.updateEntities` (ahb.h) with entities that die and spawn children, and a real `EntityTrackerEntry` in a real `HashSet` as the add/remove hook (what `mn.a(sa)` / `mn.b(sa)` do). Cases dying, spawned, wave: the port's ghost model (AwayTrace ghosts + `idleUpdate`) gives the executed order after every tick. So the b61/b62 "ghost entries" model is confirmed, including the rule that a dead entity is already out of the set in the tick it dies.
- executed (found): `transient12`, an entity spawned and dead inside one tick doubles the table (13th entry) and changes the order of ids above 15 for good. The worker never samples it, so there is no ghost for it. Not fixed (needs a spawn hook in every subsystem of the worker); the test pins the gap.
- bytecode-read: `sa.al` isBurning = `!immune && (fire > 0 || (isRemote && getFlag(0)))`; `sa.C` sets `fire = 0` on a client and `setFlag(0, fire > 0)` on the server; `ya.e` order: drown damage, pickup/place, particles, (server only: daylight teleport), `if (isWet() || isBurning()) { target = null; setScreaming(false); aggressive = false; teleportRandomly }`, scream roll; `ya.k` asks `ahb.a(sa, azt).isEmpty()` and `ahb.d(azt)`; `ahb.a(sa, azt)` adds `getBoundingBox` of entities (EntityBoat only, entity-collision.js, executed b57) and the mover's `getCollisionBox` (null for an enderman). `ahb.h` removes a dead entity right after its own tick (untrack before the tracker pass).
- recalled: nothing new.

## Verification
- `MC_RESEARCH=.../tools/research node tools/verify-tracker-dead.mjs`: ok. `verify-mobcopies2.mjs` was run to a scratch file; only the 6 new records were taken.
- `node --test src/mobcopies3-b63.test.js`: 12 pass. Related: 13 files (enderman, entity-tracker, mobcopies2, mobsounds, object-tracker*, singleleft, tracker-order, trackerorder, horse-copy, boat-copy) 299 tests, all pass after updating the `meta` expectations in mobcopies2-b61 (new `burning` key); a wider glob run (every test mentioning meta, copy-, mobcopies, singleleft, trackerorder, mobsounds): 5601 tests, 5600 pass, the one failure being that meta test, fixed. `npm run build`: ok.
- `node --check` on src/main.js, src/entities.js. `objectTracker` is module scope in main.js; `mobs` is the function-scope variable the neighbouring `mobs.wet` line uses.
- Full npm test not run (batch rule). No browser check.

## Follow-ups
- Transient entities (spawned and removed within one tick) leave no ghost; see above.
- Rain as `isWet()` for the copy (client rain strength and canLightningStrikeAt) is not modelled; only water.
- A burning copy's flames still draw from the live mob; copy particles and sounds are draws only (accepted).
- Browser only: a burning enderman visibly teleporting and the copy staying in step with the server's position packets.
