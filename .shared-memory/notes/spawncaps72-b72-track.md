# Batch 72 spawncaps72: spawn caps, spawn box, stem random, spawner subclasses

## Summary
- `src/entities.js`: new exported `SPAWN_RUNAWAY_GUARD` (5000, shared with the slime split guard). Replaced the 40 caps in `hatch`, `callReinforcement`, `spawnBaby`, `spawnSilverfishAt`, `spawnerHooks.createMob`, summoned mounts, the ocelot litter, and the natural-spawn `limit: 256`. The spawn box test (`blocked`) now counts `ender_dragon` and `ender_crystal`.
- `src/farming.js`: `growStem(..., random)`; `randomTick` passes the caller's random for stems. `stemRandom` stays as fallback for the legacy hash tick.
- `src/mob-spawner.js`: `countsAs` subtypes zombie/pigman, cow/mooshroom, skeleton/wither skeleton.
- `src/multiplayer/*` unchanged: `summonKeep` already exempts eggs and /summon from the server's `MOB_LIMIT` (80, a wire safety cap for natural spawns; kept and documented).
- Tests: `src/spawncaps72-b72.test.js` (6); `src/spawner-replay3.test.js` ocelot egg case updated (egg no longer capped).
- Docs: Batch 72 lines in natural-spawning, spawn-eggs, mob-spawner, stems-cake.

## Evidence
- recalled / earlier bytecode notes (mobfixes71 ym.B, researchdocs6): no native count test on eggs, summon, slime splits; preventEntitySpawning set in EntityLivingBase and EntityEnderCrystal; BlockStem.updateTick takes the world rand; MobSpawnerBaseLogic uses getEntitiesWithinAABB(class). No new Java probe was run.
- Wither skeleton as skeleton: same Java class EntitySkeleton (type 1), recalled.

## Verification
- `node --test src/spawncaps72-b72.test.js src/spawner-replay3.test.js src/spfarming-b69.test.js src/spawner-mobs-b71.test.js src/mob-spawner.test.js src/spawner-animals.test.js src/spawn-eggs.test.js src/mpsummon-b67.test.js src/summon2-b68.test.js` and neighbours: all pass after the replay3 edit (see final report). Full npm test not run (batch rule).

## Follow-ups
- Server natural spawning still stops at `MOB_LIMIT` 80 (wire safety); lifting it needs a tracker/wire budget review.
- Other `entities.length` caps in server-only modules (golems, wither) were not audited beyond the grep.
