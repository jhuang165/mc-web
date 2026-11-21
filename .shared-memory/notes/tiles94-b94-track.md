# tiles94 (batch 94): away time shift applied at any live rule, budget-stop clock, dispenser/hopper/brewing facing audit

Branch `batch94-tiles94`, worktree `wt94-tiles`. Target is 1.7.10. This does not claim full parity.

## Summary

- `away-time-shift.js` (new): `awayTimeShift(result)`. `main.js` `awayResult` now does `survival.time += awayTimeShift(r)`; the `!survival.timeFrozen` gate is gone, so a run that turned `doDaylightCycle` ON from off keeps its positive shift. The run already counts the rule per tick.
- `away-commands.js` `skipTicks(n)`, called from `away-world.js` when `stopped === "budget"`: the ticks the run did not simulate move `gained` by `n * (rule now - rule at start)`. Decision: the trip's duration is the truth (the live clock already counts all of `plan.ticks`; natively the world keeps ticking while the player is away), so skipped ticks keep that assumption unless the run changed the rule, in which case they follow the rule as it stood when the run stopped. A run that never changed the rule returns 0, as before.
- Audit: dispenser/dropper facing + triggered bit already live in cell metadata (b90; `dispense.js` reads `getBlockMetadata & 7`); hopper facing/enabled live in metadata (`hopper.js`) and its record is items/cooldown/name only; brewing bottle bits are derived from the items (`brewingBits`, `bottleBits`) and written to the cell with flag 2, the record is items/brewTime/name. Only leftover: `imported-population.js` put `facing` on generated dispenser records; nothing read it and `Survival` drops it on load. Removed (`{ items }`). No migration needed (no runtime reader).

## Evidence

- Port-read: all of the above (survival.js tile constructors, hopper.js, dispense.js, brewing.js, region-import/export). Bytecode-read tick order from b93 not re-read. Executed: none new.

## Verification

- `node --test --test-concurrency=2 src/tiles94-b94.test.js`: 4/4; with away-world.js, main.js and imported-population.js at HEAD: 1/4 pass.
- Targeted (away-*, awaystore86, awaytracker, imported-population*, tiles8x/9x): 187/187. `node --check src/main.js` ok. No full test, no build, no browser.

## Found wrong in the batch 93 list

- Nothing wrong; the "not audited" item is now audited and mostly already native-shaped.

## Follow-ups

- Idle stop (`stopped === "idle"`) assumes no rule change in the unrun ticks.
- Browser-only: clock after returning from a trip that turned the rule on; dungeon dispenser direction in a freshly imported save.
