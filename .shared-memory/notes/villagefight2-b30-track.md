# villagefight2-b30 track (batch 30, branch batch30-villagefight2)

## Summary
- Village fight replay now matches the native rows for every tick of all 7 recorded scenarios, with exact positions (no tolerance), health, targets and Random draws. Batch 29 first diverging ticks were 114, 241, 322, 232, 322.
- Tick 114: probe bug. The village3 double's `World.rayTraceBlocks` returned null, so natively a villager saw through the closed door. `VillagerProbe.World.realRays` (set only by VillageFightProbe) runs the real ray trace; the port was right.
- Death ticks: `deathUpdate` draws g g g f f f x 20 even without `fx` (`burst(null, ...)` in `src/fx.js` draws and spawns nothing).
- Drift: `moveEntity` keeps each mob's last bounding box (WeakMap in `src/entities.js`, reused only while it matches x/y/z and size), so `x = (minX + maxX) / 2` carries native rounding. Golem lift is the double 0.4000000059604645 (`src/village-ai.js`, bytecode-read `wt.n`).
- Skeleton: `Brain.syncCombatTask` (`src/ai.js`) follows the held slot (bow id 261: ArrowAttack, else AttackOnCollide 1.2), removed and re-added last at priority 4. `unarmed` is gone; the replay gives probe skeletons empty equipment.
- Extra fixes found by new probe records: WatchClosest's nearest-entity query lists dying mobs until deathTime 20 (`Brain.nearby(..., dying)`); Peaceful hostiles run one full tick and are removed at its end (`peacefulGone` in `EntityWorld.tick`, `removedHealth` field).
- New probe records: `villagers-flee-two-zombies` and `peaceful` (record field `difficulty`). Reference regenerated (7 records).
- entities.js hunks (small): `moveEntity` kept box (`keptBox`, `boxes`), `deathUpdate` burst without guard, Peaceful `peacefulGone` (declaration, the replaced block, the end-of-loop line). `src/fx.js`: `fx?.spawn`. No main.js or scene.js changes. A hook for awayticks should not conflict.

## Verification
- `npm test`: 4778 pass, 1 fail (the flaky "a natural spawn tick stays cheap on a streamed world" under load; rerun alone passes). `npm run build` ok. `src/village-fight.test.js` pins no divergence for every record (4 tests); `src/revenge-target.test.js` has a skeleton combat-task test.
- Native evidence: probed on the unchanged 1.7.10 jar (`MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node tools/verify-village-fight.mjs`): the corrected rays, the death-tick draws, the flee and peaceful records. Bytecode-read: `wt.n` (0.4000000059604645d), `un` (WatchClosest), EntitySkeleton.setCombatTask.

## Follow-ups
- Proposed remaining-gaps line: "Village fight replay: all 7 probed scenarios match tick for tick. Not probed: several skeletons shooting (arrows are never ticked by the double), 3+ zombies, Hard, bow-wielding probe skeletons, a hit on a removed (isDead) mob."
- The combat task is re-read on the skeleton's next AI tick, not at each equipment write (setCurrentItemOrArmor); a same-tick swap by a command differs by one tick.
- The kept bounding box is a heuristic (valid while it sits on x/y/z); other code that moves mobs by writing e.x/e.z is detected and rebuilds as setPosition does. Players and items keep their own paths.
- Hits on a removed mob are not replayable (the port drops it from the list; native `attackEntityFrom` still works on an isDead entity).
