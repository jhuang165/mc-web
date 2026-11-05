# Fireball mobs track handoff

Branch `batch6-fireball-mobs`. Details and gaps in `public/research/blaze-ghast.md`.

## Changed

- New: `src/blaze-ghast.js` (rules), `blaze-ghast-mobs.js` (updates, tasks, install), `fireballs.js` (flight, impact, punch), `blaze-ghast-renderer.js`, tests `blaze-ghast.test.js` and `blaze-ghast-world.test.js`, `tools/probes/BlazeGhastProbe.java`, `tools/verify-blaze-ghast.mjs`, `public/research/blaze-ghast-reference.json`.
- Tests edited: `spawn-eggs.test.js` (ghast egg now spawns) and `java-mobs.test.js` (JAVA_MOBS list).

## Merge hints (shared files, one-line hooks)

`entities.js` (import, talk, tick, per-mob loop, install at the end), `ai.js` (import, Brain branch, despawn list), `combat.js` (drops, XP, volume), `commands.js` SUMMONABLE, `mob-spawner.js`, `java-mobs.js` (JAVA_MOBS, health, ghast ExplosionPower), `region-export.js` (NAMES, NBT), `mob-renderer.js` (rigs, `r.fullbright`), `shadows.js`, `main.js` (ignite hook, projectiles merge, explodeAt flaming, dispense fireball), `living-simulation.js`, `explosion-simulation.js`, `survival.js` (FIRE_REASONS), `projectile-renderer.js`, `dispense.js` (fire charge), `player-actions.js`, `tools/import-vanilla-media.mjs` (regex only). Audio is not imported.

## Remaining

See the Gaps in `blaze-ghast.md`.

Tests: `npm test` 2185 tests, `npm run build` ok (one run showed a single failure that did not reproduce). No credentials stored.
