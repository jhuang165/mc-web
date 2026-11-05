# Slime track handoff

Branch `worktree-agent-af5ebc33b0b557ae0`. Details in `public/research/slime.md`.

## Changed

- New: `src/slime.js` (rules), `src/slime-renderer.js`, tests `slime.test.js`, `slime-world.test.js`, probe `tools/probes/SlimeProbe.java`, `tools/verify-slime.mjs`, `public/research/slime-reference.json`, sounds under `public/audio/1.7.10/mob/slime/`.
- Shared files touched: `entities.js`, `combat.js`, `java-mobs.js`, `java-mobs.test.js`, `commands.js`, `mob-spawner.js`, `region-export.js`, `village-ai.js`, `mob-renderer.js`, `media.test.js` (audio count 274 -> 285), `tools/import-vanilla-media.mjs`, `public/audio/1.7.10/manifest.json`.

## Merge hints

- Manifest and `media.test.js` count conflict with other audio tracks; re-count after merging.
- `entities.js`: `mobScale(e)` replaces the baby `growingAge<0?.5:1` sites; `moveFlying` takes `e.moveStrafing||0`; `slimeTick` dispatch, `splitSlime`, `slimeSpawn`, spawner hook branch. `java-mobs.test.js` key list gains `Slime`.
- Other files that still size boxes by `growingAge` only (`projectiles.js` mobTargets, `explosion-simulation.js`, `witch-potions`) do not scale for slime size.

## Remaining

See Gaps in `slime.md` (magma cubes, spawn clock adaptation, silent attack sound, legacy worlds, renderer unverified).

Tests: `npm test` 2052 pass, `npm run build` ok. No credentials stored.
