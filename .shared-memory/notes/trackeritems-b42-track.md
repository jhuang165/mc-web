# Batch 42 track: trackeritems

## Summary
- `src/object-tracker.js` (new): tracker table, S0E/S11 spawn packets, client entities and per-kind client physics for items, XP orbs, arrows, snowball/egg/ender pearl/potion/XP bottle, falling blocks and primed TNT. `objectView` gives renderers the client position.
- `src/entity-tracker.js`: object spawns, signed-byte rotation fields, no negative-zero velocity ints. `item-entities.js`, `experience.js`, `projectiles.js`: `remote` flag / eye-height parameter so the same simulators run as client entities.
- `main.js`: one tracker update per tick; drop, orb, arrow, projectile, falling, TNT renderers and shadows draw at client positions. Server logic untouched.
- Evidence: `tools/probes/TrackerItemsProbe.java`, `tools/verify-tracker-items.mjs`, `public/research/tracker-items-reference.json` (9 executed scenarios). Table and spawn rules marked bytecode-read in the reference. Doc: `public/research/natural-spawning.md` "Batch 42".

## Verification
- `node --test src/entity-tracker.test.js src/object-tracker.test.js src/item-entities.test.js src/xp-orbs.test.js src/experience.test.js src/projectiles.test.js src/bow.test.js src/falling.test.js src/entity-simulation.test.js src/explosion.test.js`: 128 pass, 0 fail.
- Load average at the end: 4.88 5.27 5.65 (`uptime`). Full `npm test`, `npm run build` and browser runs were not done (load rules); main.js wiring is syntax-checked only (`node --check`), not exercised in a browser.

## Follow-ups
- Gap: S1C metadata of tracked objects is read from live entities.
- Gap: client-side arrow and thrown hits against client mobs, snowball impact poof.
- Gap: fireworks, eyes of ender, fishing hooks, mob-launched potions still draw live positions.
- Gap: set `velocityChanged`/`airBorne` in item and orb `hurt()` and explosion pushes (S12 on knock).
- Gap: `falling.js` server step height 0.5 vs Java 0; falling data uses the JS block id.
