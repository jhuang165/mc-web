# awayents (batch 31)

## Summary
- Gate confirmed again from bytecode (`mt.h`: `P++ >= 1200` tested with the old value, so 1200 ticks run; `mt.i` resets `P` only inside `mt.h` while a player is present). Bytecode-read, no probe: a WorldServer probe needs a whole MinecraftServer.
- New `src/away-entities.js`: items, xp orbs, primed TNT (explosion via `applyExplosion`), minecarts and boats tick in the away run for the first 1200 ticks, using the live modules. Results are written back as whole saved lists (`drops`, `xpOrbs`, `tnt`, `minecarts`, `boats`) by `DimensionLive.finishAway`. Entities outside loaded columns, ridden vehicles, hopper/spawner/command carts keep their saved records.
- `away-world.js`: redstone hooks now see the entities; dispensers/droppers fire (items, TNT, carts, buckets, flint); projectile-needing dispenses put the stack back; command blocks are skipped (they would have thrown in the run).
- `away-plan.js`: columns holding saved entities count as work. `weather.js` `advance(n)`; `main.js` `advanceTicks` also advances weather; `dimension-live.js` advances the clock and weather for every trip's loading ticks.
- Docs: `public/research/dimensions.md` "Batch 31".

## Verification
- `npm test`: 4839 tests, 4838 pass, 1 failure (`silverfish.test.js` "live silverfish: chases the player..." 20 !== 19, random and load dependent; passes alone 4/4 runs, also without my changes). 7 new tests in `src/away-entities.test.js` (item fall/age/freeze, merge and despawn, TNT crater and fuse frozen after the gate, cart on rails and ridden cart kept, dropper and arrow dispenser, Weather.advance). `npm run build` passes.
- Muted headless Chrome (`artifacts/b31-awayents/smoke.mjs`, port 5331, `?silent`, `--mute-audio`): cart on rails, dropped cobble stack and a primed TNT (fuse 250) near spawn, 15 s in the Nether, return. Run: 334 ticks, 12 columns, 63 ms; TNT exploded while away, 9 item entities from the crater aged 94 ticks, the cart rolled to the crater edge, the 7-cobble stack in the blast was destroyed. One 404 console error (static asset).

## Follow-ups (proposed gap lines)
- Mobs do not move, fall, despawn or take explosion damage while away; arrows, thrown projectiles, rockets and hanging entities are not ticked.
- Dispenser/dropper dispenses that need a projectile system keep their stack; command blocks do not run while away; hopper, spawner and command carts and ridden vehicles stay frozen.
- Entities in columns not resident at departure do not tick (their records are kept).
- No probe confirms the 1200-tick counter; the entity order inside the run is the live player tick's, not WorldServer's loaded-entity list order.
