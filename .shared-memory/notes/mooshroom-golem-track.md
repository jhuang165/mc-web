# Mooshroom and snow golem track handoff

Branch `batch5-mooshroom-golem`. Details and Gaps in `public/research/mooshroom-golem.md`.

## Changed

- New: `src/mooshroom.js`, `src/snow-golem.js` (pure rules), `src/mooshroom-golem-live.js` (EntityWorld wiring, tasks, snowballs), `src/mooshroom-golem-renderer.js`, `src/mooshroom-golem.test.js`, probe `tools/probes/MooshroomGolemProbe.java`, `tools/verify-mooshroom-golem.mjs`, `public/research/mooshroom-golem-reference.json` (141 records).
- Shared files touched with small hooks: `entities.js` (types, breed item, sound and fall and talk skips, tick, ranged attack, install call), `ai.js` (snow golem tasks, path weight), `combat.js` (animals, volume, drops, xp), `mob-renderer.js`, `spider.js`, `mob-steps.js`, `shadows.js`, `player-edit-simulation.js` (optional-call mooshroom hook), `buckets-simulation.js`, `main.js` (jack o'lantern, golem balls), `commands.js`, `region-export.js`, `java-mobs.js`, `population-runtime.js`.
- Tests touched: `mob-steps.test.js` (mooshroom row).
- Item ids: none used (bowl, stew, milk, snowball and red mushroom already exist).

## Merge hints

- `entities.js` ENTITY_TYPES and the bottom `installMooshroomGolem(EntityWorld)` line, plus `SUMMONABLE` and `NAMES`, are one-line additions; keep both sides on conflicts.
- `mob-steps.test.js` expected map must list every track's step rows.

## Remaining

See Gaps in `mooshroom-golem.md` (runtime mooshroom spawn rule, build and poof particles, approximate mushroom and pumpkin placement, unverified in a browser).

Tests: `npm test` 2114 pass, `npm run build` ok. No credentials stored.
