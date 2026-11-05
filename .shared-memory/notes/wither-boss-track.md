# Wither boss track handoff

Branch `batch7-wither-boss`. Details in `public/research/wither-boss.md`.

## Changed

- New: `src/wither-boss.js` (rules), `src/wither-boss-mobs.js` (AI, skulls, install), `src/wither-boss-renderer.js` (ModelWither, armour layer), `src/boss-bar.js` (reusable boss bar), test `src/wither-boss.test.js`, probe `tools/probes/WitherBossProbe.java`, `tools/verify-wither-boss.mjs`, `public/research/wither-boss-reference.json`, `public/research/wither-boss.md`.
- Small hooks (shared files touched): `entities.js`, `ai.js`, `combat.js`, `commands.js`, `java-mobs.js`, `java-mobs.test.js` (JAVA_MOBS key list), `region-export.js`, `main.js` (explodeAt blue flag, spawnWither hook, projectile list), `explosion.js`, `explosion-simulation.js`, `living-simulation.js`, `mob-renderer.js`, `projectile-renderer.js`.

## Merge hints

- `entities.js`: imports, `talk`, skull tick after the fireballs tick, `witherUpdate`/`witherPost` calls, `rangedAttack` branch, `installWither` after `installFireballMobs`. Keep all.
- `main.js` `scene.setProjectiles` line also takes `mobs?._skulls?.balls`; the dragon track can call `setBossStatus` from `src/boss-bar.js`.
- Item 2060 (nether star) and ids 2120-2129 unused; no new BLOCKS slot.

## Remaining

See the Gaps section of `wither-boss.md` (bn/e ordering, probe limits on post-invulnerability AI, effect damage on mobs, skull model orientation, particles/achievement, no browser check).

Tests: `npm test` 2939 pass, `npm run build` ok. The statistical test in `zombie-villager-reference.test.js` is flaky and unrelated. No credentials stored.
