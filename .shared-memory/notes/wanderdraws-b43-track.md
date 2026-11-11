# Batch 43 track: wanderdraws (enderman and wolf Entity.rand draws)

## Summary
- Enderman: runs the native EntityCreature flow (`td.bq`/`td.bQ`, then `sw.bq`) via `legacy-creature.js` (`legacyThink` gained an optional `hooks.findPlayerToAttack`, `rotationYawHead = rotationYaw`, eye height `f(1.62)`; all generic and small) with `ya.e()` ahead of it (`enderman-live.js endermanTick/endermanThink`, `enderman.js` face before the stare check, `chaseTimer++ >= 30`). Enderman task list removed from `ai.js`; body yaw uses the `sv.f` path (`LEGACY_BODY` in `entities.js`). Bytecode-read plus replayed.
- Wolf: its tasks and the sheep's draw on Entity.rand (`ai.js`). Fixes: Beg is bone-if-untamed else favourite meat (`ty.a`, bytecode-read); Leap uses a float length; the wolf no longer drops a dead target itself; a tamed wolf's hit sets `recentlyHit` 100.
- Real bug found: `enderman-live.js` used `toOriginal(...)?.id` but it returns `[id, meta]`, so endermen never picked up blocks live. Fixed; `floorBelow` worlds count y < 0 as solid.
- Replay: draw burning, 0.5-block window and sound filter removed; every tick, field and draw (nextDouble as `d`) compared. b42: 59 of 59 records, all 11270 ticks exact. New `enderman-wolf-b43-reference.json` (17 records, `b43wd-` prefix: long idle wanders, 4 carry runs with 4 picks and 3 sets, wolf idle, beg for bone and meat, follow incl. teleport and sitting). Probe: `hold` op, `EW.d` setBlock, `EW_SET=b43` in `tools/verify-endermanwolf.mjs`.
- Tests adjusted: `enderman.test.js` chase (first attempt on the 31st tick), `sheep.test.js` (seeds Entity.rand with zeros), `enderman-wolf-b42.test.js` (full coverage asserted).

## Verification
Focused only, one command at a time (load average 14 to 33 on a shared machine): enderman, enderman-live, wolf, wolf-world, wolf-model, ocelot, sheep, ai, enderman-wolf-b42 (60), enderman-wolf-b43 (18): 177 pass, 0 fail. legacy-ai, mob-steps, eye-height, silverfish, pigman-jockey, zombie-wander: 158 pass. village-fight*.test.js: 203 pass. entities, combat, combat-tracker, mob-griefing, leash, leads2/3, mob-riding, mob-nbt, weather, dyes, attributes2/3, entity-portal, falling-damage, spawner-animals, interchange-spawn, dimension-spawning, zero-stacks, living-simulation-replay, chicken: 272 pass. Full suite and build left to the lead. No browser used.

## Follow-ups (proposed gap lines)
- Cow, pig and other passive mobs still draw their tasks on the world rng, not Entity.rand (only chicken, sheep, wolf done); no records for them.
- Enderman records cover only open flat ground, water and one dirt/grass patch; no carried-block render, no other carriable blocks, no enderman in caves/doors/leaves.
- b43 reference is 6.9 MB (doubles are logged); trim scenario lengths if size matters.
- Wolf scenarios: no wolf mating, no feeding or taming, no stairs/doors pathing.
