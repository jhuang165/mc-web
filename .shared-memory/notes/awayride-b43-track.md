# awayride (batch 43)

## Summary
- Mounted pairs and chains (mob on mob, mob on cart or boat) and mobs on a lead now run in the away run as one unit when every member is inside the 32-block rule; otherwise the unit stays as saved. A saved `playerRides` or cart `rider: true` no longer freezes the entity (the player left; seat empty). Files: `src/away-entities.js`, `src/horse-gear-live.js` (away lead holder).
- Bytecode-read this batch: `td.bL` steps a lead only when holder world equals mob world, and `sw.bL` keeps a live holder. So a mob on the player's lead keeps the lead and runs, with no pull. The existing executed mount, jockey, vehicle, portal and leash probes cover the ticked code; nothing new was executed.
- 32-block rule: checked every list against `updateEntityWithOptionalForce` and the unload-mid-run case; equal except hanging entities, which were split by tile instead of `posX/posZ` (fixed). The copied-column limit remains.
- Shadow kill: `away-commands.js` records `playerDeath` (tick, traced dimension, position, inventory, experience, cause). New `src/away-death.js` puts the drops and orbs in that dimension's saved arrivals; `dimension-live.js` calls it; `main.js` `awayResult` empties the live inventory and experience (unless keepInventory) and kills through `Survival.damage`. Derived, not executed.
- Wall stamp: feeds only LastOutput times. Now `wall0` at departure and `wallStep` = measured ms per tick (`away-plan.js`, `dimension-live.js`, `away-commands.js`).

## Verification
- `node --test src/away-ride.test.js` 6 pass (new: jockey pair, far pair, player lead, mob on cart, shadow kill with drops and keepInventory, wall plan). Updated two old assertions (`away-entities.test.js` cart with player rider now rolls; `away-mobs.test.js` player-lead cow now runs).
- Related set (away-*, dimension-live, leash, leads2, leads3, leash-raw): all pass after those two updates; one roofed-zombie test failed once in the combined run and passed on rerun (not reproduced).
- Muted headless away trip (vite :5436, `artifacts/b43-awayride/away.mjs`, load average about 7 to 9): 355 of 355 ticks, 5 deliveries (pig, item, 3 orbs) once each into the Nether, no duplicate ids, the only console error the known 404. Full suite and build left to the lead.

## Follow-ups (proposed gap lines)
- A shadow death shows the death screen at the return, not at the tick; post-death live changes are not reproduced; commands after the death still queue on the shadow.
- The away run cannot tick an entity whose own column was not copied at departure.
- After a reload a mob on the player's lead is unleashed unless he is within 10 blocks (leashRestore), where a native live mob keeps the lead until it breaks by distance.
- Lead to a knot whose column is unloaded while the mob's is loaded is not modelled.
