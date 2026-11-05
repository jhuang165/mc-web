# Squid and bat track handoff

Branch `worktree-agent-a1aad22eb1c384cc5`. Details in `public/research/squid-bat.md`.

## Changed

- New: `src/squid-bat.js` (rules), `src/squid-bat-mobs.js` (engine wiring, spawn pass), `src/squid-bat-renderer.js` (ModelSquid, ModelBat), tests `squid-bat.test.js`, `squid-bat-mobs.test.js`, probe `tools/probes/SquidBatProbe.java`, `tools/verify-squid-bat.mjs`, `public/research/squid-bat-reference.json`, bat sounds under `public/audio/1.7.10/mob/bat/`.
- Shared files touched (small hooks): `entities.js`, `ai.js`, `combat.js`, `mob-renderer.js`, `mob-steps.js`, `shadows.js`, `java-mobs.js`, `region-export.js`, `commands.js`, `tools/import-vanilla-media.mjs`, `media.test.js`, `public/audio/1.7.10/manifest.json`.
- Tests touched: `difficulty.test.js` (Peaceful test ignores bats and squid, which spawn on Peaceful), `java-mobs.test.js` (JAVA_MOBS keys), `media.test.js` (audio count 274 -> 285).

## Merge hints

- `manifest.json` diff is noisy (regenerated); re-run the media import after merging other audio.
- `entities.js` hooks: import line, ENTITY_TYPES entries, `pushable`, hurt/death sound, restore and create (`batHanging`), `talk`, breathe skip, tick `continue`, fall skip, spawn pass call. Keep them on conflicts.

## Remaining

See Gaps in `squid-bat.md` (reduced spawn pass, no spawner/egg, no visual check).

Tests: `npm test` 2050 pass, `npm run build` ok. No credentials stored.
