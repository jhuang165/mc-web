# Ocelot track handoff

Branch `batch5-ocelot` (worktree `wt5-ocelot`). Details and Gaps in `public/research/ocelots.md`.

## Changed

- New: `src/ocelot.js` (rules), `src/ocelot-ai.js` (tasks), `src/ocelot-spawn.js` (approximate jungle spawn), `src/ocelot-renderer.js` (ModelOcelot), `src/ocelot.test.js`, probe `tools/probes/OcelotProbe.java`, `tools/verify-ocelot.mjs`, `public/research/ocelot-reference.json`, `public/research/ocelots.md`.
- Shared files touched (each a few lines): `entities.js` (type, pose, restore, create, hurt, talk, interact, tick, spawn egg, `ocelotInteract`, `ocelotSitsOn`), `ai.js` (Brain branch, creeper avoid, despawn), `wolf-ai.js` (extracted `tameableTasks`, shared Sit/Leap/FollowOwner), `mob-renderer.js` (import and dispatch), `combat.js`, `shadows.js`, `chest.js` (`world.ocelotOnChest`), `main.js` (3 hook lines after `mobs.lightAt`), `player-edit-simulation.js`, `commands.js`, `mob-spawner.js`, `region-export.js`, `java-mobs.js`, `java-mobs.test.js` (key list and an Ozelot test), `tools/import-vanilla-media.mjs` (`cat` in the regex only).
- No item ids used (1980-1984 untouched). Version not bumped.

## Merge hints

- `entities.js`, `ai.js`, `mob-renderer.js`, `commands.js`, `mob-spawner.js`, `region-export.js` and `java-mobs.js` get one-line additions next to the wolf lines; keep both sides. The `JAVA_MOBS` key list in `java-mobs.test.js` must include every track's name.
- `media.test.js` is unchanged; if sounds are imported later the count rises with the `mob/cat` files.

## Gaps

See `ocelots.md`: no worldgen spawning, no `mob.cat.*` audio files yet, bytecode-derived avoid/pathing, kitten feeding growth, no visual check.

Tests: `npm test` and `npm run build` passed at commit time (see the final report for counts). No credentials stored.
