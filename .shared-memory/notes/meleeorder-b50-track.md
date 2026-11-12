# Batch 50 meleeorder track

Branch `batch50-meleeorder` (from ca6a447bf). Labels: executed = real 1.7.10 classes run in a probe and replayed; bytecode-read = read from the jar, not run.

## Summary
- **Player packets run after the walk.** C02 (use entity), C07 and C08 are handled in `NetworkSystem.networkTick`, which `MinecraftServer.updateTimeLightAndEntities` calls after the worlds' `tick` and `updateEntities` (bytecode-read). main.js now routes the click entry points (key.attack, key.use, the use-hold repeat, touch buttons, the canvas click) through `clickEdit`. When a mob, cart, boat or hanging entity is aimed, or a throwable, exp bottle, boat or spawn egg is placed, the action is queued (with its aim) and run from `mobs.afterEntities`, chained after the piston tile pass and before the server player copy's update (the C02 reaches the queue before the C03 of the same tick). An attack's swing stays at once. Anything left runs at the tick's end (`runPendingEdits` next to `tickTiles`). Block edits and mining are unchanged.
- **`EntityWorld.kill(e, source)`** is now `attackEntityFrom(e, Float.MAX_VALUE, outOfWorld)` with no attacker: no recentlyHit, so no xp and no player-only drops unless a player hit it in the last 100 ticks; hurt window and sounds follow the normal path. Pass `{ player: true }` for the old player kill (four tests did). `/kill` in the port only kills the sender player (commands.js).

## Evidence
- Executed: `EntityListProbe` 88 -> 93 cases, tag `b50mo`: a cow dying in the walk next to a second cow a player hits at the same tick, before and after the walk (drop order flips), the same with a spawn right after the call, and an outOfWorld Float.MAX_VALUE hit leaves no orb. Old 88 records are byte-identical; `launches` restored from the old reference as in b48/b49.
- Bytecode-read / not verifiable: the jar is the client jar and has no command classes (no `CommandKill`), and `Entity` (sa) has no `onKillCommand` in 1.7.10 (no Float.MAX_VALUE constant in it). So "/kill accepts a selector" is not checked; the task's `onKillCommand` path is 1.8-era and was not used.

## Verification
- `node --test src/melee-order-b50.test.js src/player-throw-replay.test.js src/entity-list.test.js src/piston-order-b49.test.js src/hurt-drops-b49.test.js src/living-simulation-replay.test.js`: 134 pass. A wider targeted run (sheep, chicken, villager, slime-world, stats, hanging, bow, cave-spider, headless-columns, deathdrops-b48 and the main.js source tests) passes; tests updated for the new kill: cave-spider, bow, headless-columns, living-simulation-replay (builds its own death), entity-list count 93.
- Probe regenerated: `cd tools && MC_PROBE_LIBS=<netty-all-4.0.10.Final.jar> MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node verify-entity-list.mjs`. `npm run build` once. Full `npm test` not run.

## Follow-ups
- The live queue is checked by source tests and the executed probe order only; no browser check of a melee hit one tick later.
- Right-clicks on blocks (place, doors, containers) still apply before the walk; only entity-aimed and entity-spawning actions moved.
- `/kill` with a selector and CommandKill itself are not in the jar.
