# awayedge (batch 45)

## Summary
- **Uncopied columns (gap 2).** `src/away-world.js` `entityTicks`: an entity within 8 blocks of a column that is loaded natively (the spawn area, which stays loaded in the Overworld: `ms.b`, already modelled by `loadedChunk`) but that the run has no copy of is held, like an entity outside the copy. A mob can no longer step into an uncopied (air) column. Columns outside the spawn area are still covered by the real 32-block `checkChunksExist` rule. The 8 blocks are a port bound; the native number is 32 and cannot be applied to columns the worker has no terrain for. Spawn chunks staying loaded was already ported in batch 30, nothing to add.
- **One entity walk (gap 3).** `src/away-entities.js` builds `entityWalkers` for item, arrow, thrown, tnt, orb, falling, potion, golemBall, skull and knot (cart, boat and hanging removed), sets `mobs.walks`, `joined` stamps on items, orbs, projectiles, arrows, primed TNT (`watchJoin`) and falling blocks (`away-world.js`), and runs `mobs.tick` once, then the post-walk drains (mob events, thrown-entity events and hatchlings, arrow drain), rockets, carts, boats, hanging. Every walked tick keeps the 32-block check. `src/entities.js` is not edited. Carts, boats, hanging entities and rockets stay outside the walk: their `finish` functions push the player, which the away run lacks.
- **Death screen (gap 1).** Kept at the return; the native sequence and why a closer match is impossible without a live worker are written in `public/research/dimensions.md` "Batch 45". No code change.
- Native evidence: nothing new executed. The walk order is the live `entityWalkers`, which `entity-list-reference.json` (probe-executed) replays; the 32-block rule was bytecode-read in batch 43.

## Verification
- `node --test src/away-*.test.js src/dimension-away.test.js src/dimension-live.test.js src/dimension-ticks.test.js src/entity-list.test.js src/entities.test.js src/headless-columns.test.js`: 178 pass, 0 fail.
- New: `away-columns.test.js` (edge hold) and `away-entities.test.js` (debris ticks in the pass of the explosion, which fails on the old order: 18 vs 19), 8 repeat runs pass.
- No build run (worker code ships to the browser; the lead's build covers it), no browser check.

## Follow-ups (proposed gap lines)
- Carts, boats, hanging entities and rockets in the away run still tick after the walk, so a rider mob follows its cart a tick late.
- The edge hold (8 blocks) is a port bound; a mob in a copied column near the edge of the copy stops where natively it would walk on terrain the worker does not have.
- The shadow kill still shows the death screen at the return, not at the tick.
