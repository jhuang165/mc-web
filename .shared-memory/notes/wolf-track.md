# Wolf track handoff

Branch `worktree-agent-afde31fd7b7a835c1`, base c1d88ea. Details in `public/research/wolves.md`.

## Changed

- New: `src/wolf.js` (rules), `src/wolf-ai.js` (tasks and targets), `src/wolf-renderer.js` (ModelWolf), tests `wolf.test.js`, `wolf-model.test.js`, `wolf-world.test.js`, probe `tools/probes/WolfProbe.java`, `tools/verify-wolf.mjs`, `public/research/wolf-reference.json`, wolf sounds under `public/audio/1.7.10/mob/wolf/`.
- Small hooks: `entities.js` (type, pose, restore, damage, interact, talk, tick), `ai.js` (Brain branch, clock, despawn), `mob-renderer.js` (3 lines), `player-edit-simulation.js` (interact), `combat.js`, `mob-steps.js`, `shadows.js`, `java-mobs.js`, `region-export.js`, `commands.js`, `mob-spawner.js`, `population-runtime.js`, `tools/import-vanilla-media.mjs`.
- Tests touched by the change: `media.test.js` (audio file count 247 -> 267, will need re-merge when other tracks add audio) and `mob-steps.test.js` (wolf step row).

## Merge hints

- The audio manifest and the `media.test.js` count are the likely conflict with the other tracks.
- `ENTITY_TYPES`, `restore` and `create` in `entities.js` each got one wolf line; keep them on conflicts.

## Remaining

See the Gaps section of `wolves.md` (single-player owner, no spawn egg, no runtime animal spawning, arrows and explosions not tracked, simplified puppy feeding growth).

Tests: `npm test` 1865 pass, `npm run build` ok. No credentials stored.
