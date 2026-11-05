# Dragon track handoff

Branch `batch7-dragon`. Details and Gaps in `public/research/dragon.md`.

## Changed

- New: `src/dragon.js` (pure rules, verified), `src/dragon-mobs.js` (EntityWorld adapter, spawn helper), `src/dragon-renderer.js` (ModelDragon rig), tests `dragon.test.js` (9), `dragon-world.test.js` (5), `dragon-renderer.test.js` (3), probe `tools/probes/DragonProbe.java`, `tools/verify-dragon.mjs`, `public/research/dragon-reference.json` (169 records), `public/research/dragon.md`.
- Shared files touched (one-line hooks): `src/entities.js` (import, `entityHit` part pick, `pushable`, tick loop line before the crystal line, `installDragonMobs` call), `src/commands.js` (`EnderDragon` in SUMMONABLE), `src/region-export.js` (name map), `src/mob-renderer.js` (import, rig dispatch, dispose), `src/shadows.js` (shadow row), `tools/import-vanilla-media.mjs` (`enderdragon` in the sound regex; the importer was not run).

## Merge hints

- Keep the `entities.js` lines on conflict; the dragon tick line must stay before the `health <= 0` branch.
- Run `tools/import-vanilla-media.mjs`, then update the audio counts in `media.test.js`.
- Lead TODOs: call `spawnDragonIfAbsent(world, mobs)` when the End chunk (0,0) is populated; connect `dragonBossStatus(e)` to `boss-bar.js`; consume the `dragonPush` event in main.js for the player's wing knockback.

## Remaining

See Gaps in `dragon.md` (renderer unverified, no death rays, boss bar and spawn not wired, projectile routing approximate).

Tests: `npm test` 2943 pass, `npm run build` ok. No credentials stored.
