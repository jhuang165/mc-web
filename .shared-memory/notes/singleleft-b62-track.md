# Batch 62 singleleft: frozen entities, tracker ghosts, enderman copy wet teleport

## Summary
- Saved order: `src/saved-order.js` gets `isFrozen(e)` (a WeakSet filled by freeze, cleared by thaw) and `createOrder`: a reloaded rider gets its id first and then each mount of its chain, though the loaded list follows sections.
- Frozen guards (one-line `isFrozen` / `liveOrder` filters): item-entities (merge, pickup, explode), experience, projectiles, falling, hanging (also arrow targets), bow (arrow explode and pickup), explosion-simulation (vehicles, TNT, mobs), minecarts and boats (others, pushes), structure-simulation, entity-simulation, village-host (counts), main.js (3 `mobTargets` calls use `liveOrder`).
- Tracker: `away-trace.js` rows carry ids; a flag (`airBorne`, `velocityChanged`) is cleared after each sample so later rises count; `finish()` returns `ghosts` ([id, first, last]) of entities that were sampled and are gone; `entity-tracker.js idleUpdate` keeps ghost entries in the HashSet order (`dropGhosts`); `away-entities.js` samples hanging entities and knots.
- Mob copies: new `src/copy-teleport.js`; `copyLivingPre` (copy-talk.js) draws nextDouble, nextInt(64), nextDouble when a copy enderman is wet, after the 12 portal draws and before the scream roll, and moves the copy on a successful `teleportTo` (128 portal particle draws). `entities.js moveClient` passes `this.world` (one-line hook).
- Research: `SavedOrderLoginProbe` block `saved-order9`, `verify-saved-order.mjs` -> `public/research/saved-order9-reference.json`; `MobCopies2Probe` block `watertp` -> `mobcopies2-reference.json` (570 records).
- Tests: `src/singleleft-b62.test.js` (10), `mobcopies2-b61.test.js` now replays the whole Enderman water record.

## Evidence
- executed: rider/mount ids (saved-order9, 4 scenarios): rider n, mount n+1 in file order.
- executed: wet teleport draws, success move and positions (watertp, 3 seeds x 160 ticks, all 16/784-draw ticks match).
- bytecode-read: ya.e order (attack branch, 12 portal draws, `if (L() || al())` teleportRandomly, scream roll); ya.k scan rules.
- recalled: ghost entries change the HashSet order because the table never shrinks (b61 model, not re-probed); flag clear after tracker send.
- Found: the two records `water` LavaSlime and Squid are not reproducible between probe runs (unseeded randomness), so the 567 old records were kept byte-for-byte and the 3 `watertp` records were inserted after them. Re-running verify-mobcopies2.mjs rewrites those two.
- Wither armour draws: already modelled and replayed in b61 (`wither` case); nothing added.

## Verification
- `node --test` on 132 related test files (items, orbs, explosion, carts, boats, hanging, village, away, tracker, saved-order, mobcopies, mobsounds, mpmob*, singleleft): 1587 tests, 1586 pass; the one failure (`mpmobs-b59` 40-mob timing) passes alone (10/10), a load flake.
- `node --check` on every touched file: ok. `main.js` new identifier `liveOrder` is imported at module scope (line 287); `mobs` was already in scope there.
- `npm run build`: ok.
- Full npm test not run (batch rule).

## Follow-ups
- A burning enderman copy (isBurning branch) is not modelled; the copy keeps no fire flag.
- Destination test ignores other entities' boxes; copy particles and sounds are draws only.
- Burning/wet copy still follows the server's position packets afterwards (increments not reset).
- Only a browser would show the visible effect of a copy teleporting in water, and frozen-entity behaviour in a real streamed world.
