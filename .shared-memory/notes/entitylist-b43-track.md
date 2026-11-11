# Batch 43 entitylist track

## Summary
- **One list order for more kinds.** `EntityWorld.tickMobs` now walks arrows, thrown entities (snowballs, eggs, pearls, potions the player throws), items, XP orbs, primed TNT and falling blocks in the same insertion order as the mobs and fireballs, as `World.updateEntities` walks `loadedEntityList`. `mobs.walks` (`entityWalkers`, `src/entity-simulation.js`) names the six kinds; `EntityWorld.joined(e, kind)` stamps a spawn; `withBalls` merges by stamp; a spawn during the pass joins the pass; `reap` after the walk. `finishEntitySimulation` runs the rest of the old segment (item pickup, thrown-entity effects and events, mob events, arrow pickup) and then the object tracker.
- **Per-kind plumbing.** `tickOne` and `reap` extracted from the old loops (`item-entities.js`, `bow.js`, `projectiles.js`, `experience.js`, `falling.js`, `entity-simulation.js` `tickOneTnt`); the old `tick()` methods loop over them, so every non-walked caller (tests, the away run) is unchanged. `joined` hooks at the spawn sites; `main.js` wires them and skips the old fixed-order calls when walked.
- **Native evidence.** `tools/probes/EntityListProbe.java`, `tools/verify-entity-list.mjs`, `public/research/entity-list-reference.json` (15 executed records on the unchanged `EntityItem`, `EntityXPOrb`, `EntityTNTPrimed`, `EntityArrow`, `EntityCow` with the AI list off, plus a player shell for orb pickup). Replayed exactly by `src/entity-list.test.js` / `src/entity-list-replay.js` (13 records; the 2 arrow-cow records are executed but not replayed).
- **Doc.** `public/research/blaze-ghast.md`, section "Batch 43".

## Verification
- Probe run: `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node tools/verify-entity-list.mjs` -> 15 scenarios.
- Focused tests, one at a time: entity-list 17/17, entities 21/21, entity-simulation 4/4, entity-simulation-replay 1/1, living-simulation 4/4, living-simulation-replay 1/1, fireballs-b42 20/20, fireballs-native 28/28, fireballs-b41 11/11, away-trip 1/1, away-entities 10/10, away-mobs 10/10, dimension-live 23/23, dimension-ticks 7/7, entity-portal 27/27, experience 6/6, xp-orbs 5/5, falling 7/7, falling-damage 6/6, item-entities 10/10, bow 30/30, projectiles 20/20, explosion-entities 5/5, explosion-simulation 2/2, entity-tracker 24/24, object-tracker 13/13, module-names 1/1. Full suite and build left to the lead.
- Node tick time (`artifacts/b43-entitylist/bench.mjs`, 300 items + 150 orbs + 60 arrows + 30 cows; load average 14 to 21): release 0.71.0 source 2.34 to 2.64 ms/tick, walked 2.40 to 2.58. Profile: the merge is about 0.03 ms/tick.
- Muted headless Chrome (`artifacts/b43-entitylist/tps.mjs`, port 5438, `?silent`, `--mute-audio`): walks = item, arrow, thrown, tnt, orb, falling; spawned items stamped and ticking; 160 ticks in 8.00 s in the Overworld and in the Nether. One console 404 for a resource (not identified).
- Vite on 5438 stopped; nothing left running.

## Follow-ups (proposed gap lines)
- Minecarts, boats and hanging entities still tick on their own lists, outside the walk.
- The away run (`away-entities.js`) ticks mobs, orbs, rockets, items, thrown entities and arrows per kind with no stamps; sharing the order needs stamps in saved records.
- Potions, golem snowballs and wither skulls tick in the `tickMobs` prelude before the mobs, not in list order.
- Arrow-hits-cow: records executed (order changes where the cow ends) but no replay, since the port has no cow with AI off.
- Player item pickup (`collectItems`) keeps array order (equal to list order among items).
