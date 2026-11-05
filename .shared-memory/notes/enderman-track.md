# Enderman track handoff

Branch `worktree-agent-aa894c818d5693758`, base a52d71b. Details in `public/research/enderman.md`.

## Changed

- New: `src/enderman.js` (pure rules), `src/enderman-live.js` (world adapter, tick, hurt hook, spawn), `src/enderman-renderer.js` (ModelEnderman), tests `enderman.test.js`, `enderman-live.test.js`, probe `tools/probes/EndermanProbe.java`, `tools/verify-enderman.mjs`, `public/research/enderman-reference.json`, enderman sounds under `public/audio/1.7.10/mob/endermen/` (17 files).
- Shared files touched (small hooks): `entities.js` (type, HOSTILE, TRANSIENT, aiMoveSpeed boost, hurt/death/living sound, hurt hook, restore/create fields, tick, spawn call, step height 1), `ai.js` (task branch, path weight, despawn list), `combat.js` (pearl drop; XP is already 5), `bow.js` and `projectiles.js` (`{ projectile: true }` extra on mob damage), `main.js` (one line `mobs.look = { yaw, pitch }`), `mob-renderer.js` (3 lines), `shadows.js`, `commands.js` (SUMMONABLE), `java-mobs.js` (+ `java-mobs.test.js` key list), `region-export.js` (NAMES, carried/carriedData), `mob-spawner.js`, `tools/import-vanilla-media.mjs` (`endermen` in the sound regex), `media.test.js` (audio count 274 -> 291), `public/audio/1.7.10/manifest.json`.

## Merge hints

- Audio manifest and the `media.test.js` count conflict with other tracks; regenerate the manifest and recount.
- `entities.js` imports `enderman-live.js`, which does not import `entities.js` back (rng is passed in).
- `java-mobs.test.js` lists `JAVA_MOBS` keys; other tracks adding mobs touch the same line.

## Remaining

See Gaps in `enderman.md` (ring-clock spawning, task AI instead of legacy flow, pumpkin helmet unreachable, renderer pose not probe-replayed, no browser check).

Tests: `npm test` 2054 tests, all pass on the final run (`zombie-villager-reference.test.js` "convert replays" failed once in an earlier full run and passed on 4 reruns: random-seeded, not an enderman path). `npm run build` ok. No credentials stored.
