# Batch 61 mobcopies2: client copies' water, status, potion, wither and scream draws

## Summary
- `tools/probes/MobCopies2Probe.java` and `tools/verify-mobcopies2.mjs` (new): run the unchanged 1.7.10 mob classes on a client world double with logging Randoms (the entity's and the world's). Scenarios: `water` (28 mobs dropped into a pool, 420 ticks), `wither` (3 charge/health pairs), `status` (28 mobs x 19 statuses, plus 40 ticks for the focus pairs), `potion` (watcher 7 set, plain/ambient/invisible), `scream` (enderman watcher 18, 300 ticks). Output: `public/research/mobcopies2-reference.json` (tag `b61mc2`, 567 records).
- `src/copy-water.js` (new): the splash on entering water (also the second one inside the move), the air count, Respiration `nextInt`, and the 8 drowning bubbles at air -20, on the copy's own Random.
- `src/copy-status.js` (new): `copyStatus` (zombie/pigman 16, witch 15, wolf/ocelot/horse 6/7, love 18, villager 12/13/14, wolf 8) and `copyWolfShake` (the per-tick shake sound and splash draws).
- `src/copy-meta.js` (new): the watched values a copy reads (air, potion colour, invisible, enderman screaming, wither invul and health) and the potion swirl draws. They travel in the existing `meta` S1C and in the spawn packet. No new message types.
- `src/entity-tracker.js`: `TrackerEntry.lastMeta`, `watched()` carries the values at the spawn, `sendLocation` sends one `meta` for changes, `ClientEntity.apply` applies them, `ClientEntity.step`/`stepRider` take a fourth `living` hook that runs after the death update (potion swirl, then the living roll, as in `sv.C`).
- `src/entities.js`: `clientEnvironment` does the splash and air; `moveClient` runs `copyLivingPre` first and the second splash after the move; new `clientLiving`, `copyState`, `statusRand`; `breathe` now keeps an iron golem's air and honours Water Breathing; love hearts, zombie remedy sound and villager 13 draw on the copy's Random; wolf shake start, witch 15 and tame 6/7 call `copyState`.
- `src/copy-talk.js`: `copyLivingPre` (enderman particles and scream roll, blaze) runs before the move; the wither draws the armour roll on the client world's Random and the charge particles; the enderman follows its own watcher 18, not the live `screaming` flag.
- `src/witch.js`: `witchDrink` also returns `magic` (the 7.5E-4 roll hit). `src/village-ai.js`: villager particles use the copy's Random. `src/multiplayer/remote-mobs.js`: one argument added so remote copies still run the roll (`living` hook).
- Tests: `src/mobcopies2-b61.test.js` (new); `src/mobsounds-b60.test.js` updated for the new order and the watcher-driven scream.

## Evidence
- executed: every row of the reference JSON (water splash and bubbles, air per tick, wither charge and armour draws with the world Random, status draws, potion swirl, scream clearing itself, wolf shake ticks). The test replays them: water by stepping `ClientEntity` with `EntityWorld`'s own hooks on a pool, with position and motion reset to the recorded values each tick.
- executed: the iron golem never drowns (air stays); the giant's eye stays above the pool so its air stays 300; status 20 and the golem statuses 4/11 draw nothing on any class; the zombie-villager class has no per-tick conversion particle of its own (only the potion swirl).
- bytecode-read: `ya.e` runs its particles and the `nextInt(100)` scream roll before `super.e()` (the move); `sv.C` order (splash, air, death, swirl, living roll); `wt.j` returns the air unchanged.
- recalled: Water Breathing skips the air step in `sv.C`; a client holds no effects for a mob, so a copy ignores it.

## Verification
- `node --test src/mobcopies2-b61.test.js src/mobsounds-b60.test.js`: 158 pass, 0 fail.
- Related targeted tests (tracker, away, witch, wither, wolf, zombie-villager, enderman-wolf, horse, squid, client-predict, deathfx, mpmobs, object-tracker): 1026 pass, 0 fail.
- `node --check` on every touched file; no change to `src/main.js`.
- `npm run build`: see the final report.
- Full npm test not run (batch rule). No browser check was done.

## Follow-ups
- Found, not modelled: an enderman copy in water draws `nextDouble, nextInt(64), nextDouble` every tick (teleportRandomly after the wet damage runs on the client too). A successful teleport also moves the copy and spawns portal particles; the probe world had no valid target, so only the failed path is recorded.
- Copy particle positions are still not made (draws only). The live path shows the visible ones.
- The squid copy keeps its own order (roll before air); the ghast, blaze, wither and bat copies match the water draws but never reach the pool.
- Browser only: that the visible splash, bubbles and status particles still look right with the copy's Random driving the love hearts and villager particles.
