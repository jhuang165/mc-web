# Batch 64 trackertransient: transient tracker entries and rain as wet for client copies

## Summary
- `src/tracker-transient.js` (new): `transientIds(born, trackers, lists)` returns the ids of entities that spawned since the last tracker pass, are `dead`, were never listed and have no entry.
- `src/entities.js` (one line in `EntityWorld.joined`, the spawn hook of items, orbs, arrows, thrown entities, rockets, falling blocks, carts, boats, hangings): pushes the entity to `tracker.born`. `src/entity-tracker.js`: `MobTracker.born`; `jointUpdate` (the live path) adds then removes a transient's id in the HashSet among the tick's new entries, in id order; the plain `beginTick` path does the same; `idleUpdate` (away) clears `born` (the trace's ghosts own that case).
- `src/copy-teleport.js` `copyRainWet`, `src/copy-talk.js` (`copyLivingPre` 6th argument `rained`), `src/entities.js` (`moveClient` passes `this.clientRained`), `src/main.js` (one line: `mobs.clientRained` = `canLightningStrikeAt`, Overworld only). A dry enderman copy in the rain now takes the wet branch (teleport, scream flag cleared).
- Research: `TrackerDeadProbe` cases `transient11`, `transientTwo`, `transientMid` (reference regenerated; the older cases are unchanged). `MobCopies2Probe` blocks `rainfeet`, `rainhead`, `raindry` (3 seeds x 60 ticks); 9 records appended to `mobcopies2-reference.json` (585; the 576 old ones untouched, as in b63).
- Tests: `src/trackertransient-b64.test.js` (19). `mobcopies3-b63.test.js`: its per-tick replay now skips every `transient*` case, and the old gap test is renamed (still true for the away ghost model).

## Evidence
- executed: TrackerDeadProbe runs the real `World.updateEntities` with a real EntityTrackerEntry in a real HashSet. `transient12`: the 13th entry (a spawn dead in the same tick) doubles the table and reorders ids above 15. `transient11`: 10 live + 1 transient never reaches 13, no change. `transientTwo`: the second transient finds the table already doubled. `transientMid`: a persistent child (12th) and a transient (13th) in one tick double the table, where the child alone would not. All replayed through the port's `MobTracker` (`serverTick` and `jointUpdate`) after every tick.
- executed: MobCopies2Probe overrides `ahb.y` (canLightningStrikeAt) on the client world double; the real `Entity.isWet` (`sa.L`) asks it. `rainfeet` / `rainhead`: the copy teleports every tick and the draws match; the asked cells are the feet cell, then `floor(y + height)` (3 seeds). `raindry`: the cells are asked, answered no, no teleport. Replayed draw for draw.
- bytecode-read: `sa.L` = `!inWater && !y(floor x, floor y, floor z) && !y(floor x, floor(y + N), floor z)` negated (the field `ac` is inWater).
- executed (found): the dry probe copy that fell from y 8 started drawing `nextInt(100)` on landing, until it rolled 0. The fall hurt the copy and `ya.a(ro, float)` (attackEntityFrom) set its scream flag; the port does not run client-side fall damage on a copy, so it never sets it. The rain records avoid it (raindry and rainhead start on the ground; rainfeet teleports first). Not fixed.
- recalled (unverified): 1.7.10 has no XP orb merging, so "an orb merged on spawn" is not a case; in the port nothing merges orbs either.
- recalled: `Entity.moveEntity` plays `random.fizz` and sets `fire = -fireResistance` for a wet burning entity; the copy's own `fire` is zeroed each tick, so rain on a copy is invisible there. The burning flag a copy follows is watcher 0 from the server only, so rain does not clear it natively (the b63 follow-up wording "burning flag clear should see rain" has no effect on `isBurning` for a copy).

## Verification
- `MC_RESEARCH=.../tools/research node tools/verify-tracker-dead.mjs`: ok. `verify-mobcopies2.mjs` was run to a scratch file; only the 9 new records were taken.
- `node --test src/trackertransient-b64.test.js src/mobcopies3-b63.test.js`: 30 pass.
- Related run: tracker-*, trackeridle, trackerorder, trackerphase, entity-tracker, object-tracker*, entity-list, mobcopies2-b61, singleleft-b62, enderman*, away-order-b50, awaytracker-b60: 583 tests, all pass (before the joint test was added).
- `node --check` on every touched src file. `clientRained` is set in main.js in the same function as `mobs.wet`; `weather`, `world` and `canLightningStrikeAt` are in scope there (the line above uses them).
- `npm run build`: ok. Full npm test not run (batch rule). No browser check.

## Follow-ups
- A transient mob (spawned and dead inside one tick) and the away worker's transients are not modelled; mobs have no spawn hook (`noteMobSpawns` sees them a tick late) and the worker's trace keeps ghosts only for entities it sampled. Transient orbs/items of an away run are therefore still missing.
- The transient add happens at the pass, in id order with the tick's new entries, not at the exact spawn moment; a transient between two persistent spawns in the same tick can double the table one add earlier or later than native only when the 13th entry is that very spawn (the final order is unaffected for java8 resizes).
- Client-side fall damage on a copy sets the enderman's scream flag natively (found above); the copy's `fire`/fizz on rain is not drawn.
- The client world's rain strength is the port's single `weather` (same timers as the server; natively the client lerps its own strength from S2B). Browser only: seeing an enderman copy teleport when it starts raining.
