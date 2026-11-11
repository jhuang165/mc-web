# globalids (batch 42)

## Summary
- Probe `EntityIdProbe.java` (executed): one static `Entity.nextEntityID` for all worlds and classes, starts at 0, `hashCode`/`equals` = id. Bytecode-read: tracker `HashSet` order follows the id hash; `getEntityByID` is an `IntHashMap`; orb retarget uses `entityId % 100`. Record: `public/research/entity-ids-reference.json`.
- `src/entity-ids.js` (`EntityIds`, `bindIds`): one counter shared by `EntityWorld`, `Minecarts`, `Boats`, `Hanging`, `ExperienceOrbs` (optional `ids`). `main.js` has one for the page (every dimension load, `reserveRecord` first); `finishAway` passes `plan.idBase`; `away-entities.js` builds one counter for the run's lists. Save format unchanged; saved ids kept; duplicates renumbered; `EntityWorld` no longer burns one id per restored mob.
- `/xp` by a command block runs on the shadow at firing; `xpOps` applied once on return (`away-commands.js`, `main.js` passes `xpOps`).
- Off by one: run tick n sees total time `T0 + n + 1` (bytecode-read `mt.b` order); `now()` fixed.
- Shadow kill: documented only (native death happens in the Nether at the firing; port applies the loss at return).
- 32-block rule and ridden mobs: documented, not fixed. `dimensions.md` has a "Batch 42" section.

## Verification
- `node --test src/entity-ids.test.js` 6 pass (new).
- `node --test src/away-commands.test.js` 18 pass (2 new: `/xp` xpOps, clock offset).
- Related set (entities, away-trip, dimension-live, away-entities, entity-portal, minecarts, boats, hanging, experience, command-tags, vehicle-riders, away-commands): 222 pass before the `/xp` and clock edits; after them away-commands, away-world, away-trip, away-entities, dimension-live 61 pass. Load average 5 to 14. No full `npm test`, no build, no browser.

## Follow-ups
- The tracker's `HashSet` iteration order by id (trackeritems track) is not reproduced.
- Items, arrows, projectiles, fireballs, rockets, TNT, falling blocks carry no id; port counter starts at 1, not 0.
- Shadow kill place/time, ridden and out-of-rule entities while away.
- Away run `wall` stamp still uses `ran * 50` (not changed).
