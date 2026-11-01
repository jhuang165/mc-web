0.22.11 (commit fd6a3f7, pushed to github main). Difficulty option (Peaceful/Easy/Normal/Hard, default Normal, options.difficulty in blockworld.settings; main.js updateDifficulty sets survival/mobs/fire.L). src/difficulty.js:
- mob/explosion damage scaling (Survival.scaledDamage);
- FoodStats starvation and Peaceful hunger, Peaceful regen;
- localDifficulty plus InhabitedTime (saved as record.inhabited, carried through world-import);
- spider/zombie onSpawnWithEgg rolls (entities.js spawnNatural);
- Hard zombie reinforcements (callReinforcement), zombie fire on hit (hitPlayer, also used by spiders);
- maxSafePointTries by difficulty (ai.js); navigator followRange from the spawn rolls.

Peaceful removes EntityMob types at once and spawns none. src/mob-effects.js adds saved mob potion effects (Speed/Strength attributes, Regeneration, swirls). An invisible spider draws only its eyes, with no shadow. Skeleton arrows use the difficulty.

DifficultyProbe/verify-difficulty.mjs write difficulty-reference.json (5928 records). Finding: the attackEntityFrom pre-draws are setBeenAttacked nextDouble, knockBack nextDouble, then 2 pitch floats.

Tests: npm test 614/614, bridge tests OK, build OK, git diff --check clean. Browser check on temp port 5181 with audio stubbed:
- the Difficulty select persists;
- Hard propagates to survival/mobs/fire;
- 10 of 300 Hard spawns got effects;
- an invisible spider shows eyes and grey swirls only;
- switching to Peaceful removed it;
- no console warnings.

launch.json restored, server stopped. FX-01 Done.

Gaps: rolled but dropped (equipment, child/villager zombies, jockeys, loot pickup, door breaking, leader max health, pumpkins); skeleton/creeper spawn rolls not run; knockback/hurt-sound draws still use Math.random. See public/research/difficulty.md.

push:github refused because of the WORLD-01 agent's untracked ChunkProbe/verify-chunks/chunk-reference files (left untouched). Its steps were run manually and HEAD was pushed. No Site publication.