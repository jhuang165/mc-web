# awaytrip (batch 41)

## Summary
- Duplicate Nether mob id found and fixed (the `dupIds: 1` that netherload saw). Cause: `EntityWorld`'s constructor restored saved mobs with `nextId` counting up from 1. A record without an id (a mob that travelled through a portal: `dimension-live.js` `deliver` deletes the id) got `mob-<nextId>` at that moment, which repeated a saved id that the Nether list held further on or earlier with gaps (for example saved `mob-3`, `mob-5` plus an arrival: the arrival became `mob-3`). Reproduced in a node script and in the unit test.
- Fix (`entities.js`, 6 lines): before restoring, `nextId` starts above every saved `mob-N`; a restored mob whose id was already used in the list gets a new one. Unit-level only: ids stay "mob-N" per `EntityWorld` (not one counter across worlds as in native `Entity.nextEntityID`); within a world they now never repeat. A global cross-world counter was not attempted.
- Full-trip check of away portal delivery: `away-trip.test.js` runs the real `runAway` (pig, item, orb in a portal, 150 ticks), `finishAway` through a stub worker (real `deliver` and Teleporter), `viewRecord(-1)` + `deliverArrivals`, then loads the lists the way `main.js` does (`EntityWorld`, `ItemEntities.load`, `ExperienceOrbs`). Result: all three left the Overworld lists, each arrives once in the Nether, within a few blocks of the portal the Teleporter built, mob cooldown 300, new mob id above every saved id. No delivery bug found beyond the id one.

## Verification
- Focused: `away-trip.test.js` 1 pass, `dimension-live.test.js` 24 pass (one new), with `entity-portal`, `away-entities`, `entities` tests 81 pass in total. Both new tests fail with `entities.js` reverted. Full suite and build left to the lead.
- No browser run this time (the unit chain covers the same code path; `main.js` line 1423 builds the Nether `EntityWorld` from `record.entities`).
- Incident: `git stash` is shared between all worktrees. My `git stash` / `pop` swapped files with the gateitem worktree for a moment; I swapped them back (their 4 files and `gate-item.test.js` are in `wt41-gateitem` again). Tracks should not use stash.

## Follow-ups (proposed gap lines)
- Mob ids are per `EntityWorld`, not one global counter as native `Entity.nextEntityID`; items/carts/boats/orbs have their own counters too.
- The away trip check is a unit chain, not a player trip in a browser.
