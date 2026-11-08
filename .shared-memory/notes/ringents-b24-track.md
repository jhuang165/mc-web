# Ring entities track (batch 24, branch batch24-ringents)

## Summary
- The headless ring now ticks item entities, xp orbs, arrows, `Projectiles` (snowballs, eggs, pearls, potions, golem and witch throws), primed TNT and falling blocks with the 1.7.10 `updateEntityWithOptionalForce` rule: +-32 blocks loaded, i.e. window or `ring.active` (`streaming-ticks.js` `ringEntityActive`). Pending sand/gravel ticks use +-0 (`ringTickActive`, window or `ring.holds`).
- `falling.js`: when a held ring column lacks its 32-block surroundings, sand takes BlockFalling's instant fall (to air, walk down, place with metadata 0).
- `entities.js` `dropFarEvents` keeps every far-mob event except a sound with no position. Death drops and xp from ring mobs become ring entities. Positioned sounds and particles are culled by the existing range filters.
- `headless-env.js` `residentOnly` keeps ring entities off screen (scene setFalling/setDrops/setProjectiles/setArrows; one `main.js` line for the xp renderer).
- `item-entities.js` adds a result-neutral 1-block cull before the merge box test, for speed.
- Native evidence: `tools/verify-ring-entities.mjs` runs javap on unchanged `ahb`/`mt`/`akx` and writes `public/research/ring-entities-reference.json`. The docs are natural-spawning.md "Round 6" and the parity.md line plus a reference entry.

## Verification
- `npm test`: 4358 pass, 0 fail. `npm run build`: OK.
- The equality replay in `headless-columns.test.js` runs 320 ticks in a ring world and in an all-resident world, and the per-tick logs and final columns match. Two control runs fail it at tick 0: restoring `entityActive`, and restoring the explode-only event filter.
- Node bench: 390 ring items plus 600 orbs, median 4.3 ms per tick, max 33 ms.
- Muted headless Chrome check (vite 5241, `?silent`, master 0), new world: 61 ring mobs. After 5 were killed and an orb was seeded, 14 ring orbs ticked (age 201 after 10 s). No long tasks, no page errors. Servers were stopped.

## Follow-ups
- Minecarts, boats and portal travel still use the window-only `entityActive`. Fireballs and wither skulls are ungated, as before.
- Redstone and fluids do not tick in the ring. Ring edits (instant falls included) get no mesh or light until resident.
- Ring particles use the 16-block fx cull, not native 64-block entity tracking. Loot pickup still runs for inactive mobs, as before.
- The rim instant fall is covered by a unit test, not by the equality replay. The cost figure comes from node plus one short browser sample, not a long play session.
