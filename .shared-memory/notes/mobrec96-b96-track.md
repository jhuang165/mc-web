# mobrec96 (batch 96): executed records for cows, mooshrooms, pigs, chickens, sheep shears, bats

Branch batch96-mobrec96, cut from main 0e2854338 (0.124.0).

## Summary
- tools/probes/EndermanWolfProbe.java: flag B96 (`b96mr`); new types h (chicken, timeUntilNextEgg fixed to 6001) and y (chick); ops `holdd id count damage`, `agea idx age`, `egg idx ticks`; chicken flags [love, age, bu, bp, bq, br, bs, bt]; row element 13 = the player's held stack `[id, damage, count]`.
- tools/probes/EndermanWolfScenarios.java: `run96()` with 65 records (seeds 9901-9982): cows 9901-9916, mooshrooms 9921-9928, pigs 9931-9947, chickens 9951-9967, sheep shears 9971-9976, bats 9981-9982. Covers milk (bucket, bowl, shears on a mooshroom), saddle, lightning, egg laying, breeding (two to four animals), baby growth, panic, drowning, drops and the corpse tail, shears damage including the break at 237 and 238.
- tools/verify-endermanwolf.mjs: set b96mr, 65-record assert, four output files (each under 2 MB).
- public/research/enderman-wolf-b96mr-{,pig-,chicken-,sheep-}reference.json.
- src/enderman-wolf-replay.js: `reference96`, chicken types, new ops, held stack comparison (row 13), `use` order as in the player edit simulation.
- src/entities.js, src/experience.js, src/living-simulation.js, src/multiplayer/server-mobs.js, src/mooshroom-golem-live.js: the fixes below.
- src/mobrec96-b96.test.js: 70 tests.

## Evidence
- Executed: all 65 records replay with no divergence (real classes wh, wm, wo, wg, wp, we from minecraft-1.7.10.jar).
- Found and fixed (each was an executed divergence):
  1. Breeding XP: EntityAIMate.spawnBaby spawns ONE orb of nextInt(7)+1; the port split it into several orbs (cow 9902, pig 9932, chicken 9955). New `xpWhole` flag through emitLoot, experience.spawn, living-simulation and server-mobs.
  2. Shears break: ItemStack.damageItem past the maximum calls renderBrokenItemStack, one World.rand draw (break pitch). Missing for sheep (9972, 9976) and mooshroom (9927). Fixed in entities.js shear and mooshroom-golem-live.js.
  3. Baby growth (cow 9913, pig 9943, chick 9963): Entity.setSize widens the box from the minimum corner and nudges via moveEntity(oldWidth-width, 0, oldWidth-width): centre moves half the growth towards -x and -z, onGround false, the nudge counts toward the step sound distance. Added to ageAndLove.
- Probe artefact, not a port bug: pig-drown-9947 first diverged at tick 319 because the probe player drowned in the same pool; the player now stands outside.

## Verification
- `node --test src/mobrec96-b96.test.js`: 70 pass. With entities.js, experience.js, mooshroom-golem-live.js reverted: 56 pass, 14 fail (checked once).
- Targeted regression (208 test files naming spawnBaby, growingAge, shear, mooshroom, breed, xpOrbs, baby, the replay): `grep -lE "spawnBaby|growingAge|shear|mooshroom|breed|xpOrbs|enderman-wolf-replay|ageAndLove|baby" src/*.test.js | xargs node --test --test-concurrency=2`: 208 files, 3717 tests, 3717 pass, 0 fail.
- No old test was edited.
- Build not run (the only new import is JavaRandom in mooshroom-golem-live.js, already a module in the bundle).

## Found wrong in the batch 95 list
- "cow, pig, chicken breeding, bat, villager thin": cows, mooshrooms, pigs, chickens and two bat records are now recorded; the three divergences above were real.

## Follow-ups
- Villagers (trading, breeding, door use) are not recorded.
- Native leaves a count-0 shears stack in the slot after it breaks and a later use on a sheep still shears with it; the port empties the slot. The replay treats a count-0 stack as empty; the live path is unproven.
- Bats have only two records.
- Browser-only: sounds heard, the baby scale rendering, the egg and milk animations.
