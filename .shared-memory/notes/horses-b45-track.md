# Horses track, batch 45

## Summary
Horse feeding, breeding, foals and spawn rolls had no executed records. The EndermanWolf probe now has a b45 mode (`EW_SET=b45`, seeds 7001+) that runs the unchanged EntityHorse (wi) with 88 scenarios and records the horse row as `[love, growingAge, type, variant, tame, temper, maxHealth, speed, jump, health]`, the non-listed spawned horses (foals), and the `onSpawnWithEgg` init draws. Reference: `public/research/enderman-wolf-b45-reference.json`; replay: `src/horse-spawn-b45.test.js` (one test per record).

Scenarios: 40 single spawns plus 6 herds (type, variant, attribute rolls, GroupData passed on), seven foods (sugar, wheat, apple, bread, hay block, golden carrot, golden apple) on tame, foal and wild horses, love and breeding (horse x horse, horse x donkey and donkey x horse giving mules, donkey x donkey, hurt, wild partner, three horses, a second breed after cooldown), foal growth.

Port fixes (all matched against executed records):
- Golden carrot/apple on a tame adult sets love whenever `d()==0` (no already-in-love check); temper rises only below max; a wild horse with an unused food (hay) rears and keeps the stack.
- Child max health is the plain double mean `(a + b + roll) / 3`, no float rounding; child health stays at the constructor's 53.
- Horse `canMateWith` ignores love, but EntityAIMate.continueExecuting needs the partner in love (`horseCanMate` in `horse-live.js`, used by `Mate` in `ai.js`).
- Foal growth: `rx.e` ages after the AI; `wi.a(boolean)` rescales each tick with `ci()`; `Entity.setSize` plus `moveEntity(oldW-newW, 0, oldW-newW)` when wider (`resizeBox` in `entities.js`); `mobScale` for horses is `growthScale`; horse size is the float 1.4 x 1.6.
- The rear sound (`wi.cJ`, `bg()` pitch) draws the horse's own rand twice, not the world's (found via a stream desync in `feed-wild-170`: three rears shifted the idle-sound roll by one tick).
- Bytecode-read only (not executed in a probe): none new beyond the rules above, which all have records.

Shared files touched (minimal): `src/entities.js` (resizeBox, horseCanMate dep, spawn anchorBox, growth hook after the aging line), `src/ai.js` (Mate partner check for horses), `src/slime.js` (`mobScale` for horses).

## Verification
- `EW_SET=b45 MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node verify-endermanwolf.mjs` (from `tools/`): 88 records.
- `node --test src/horse-spawn-b45.test.js`: 88 pass.
- `node --test src/horse*.test.js src/enderman-wolf-b4*.test.js src/entities.test.js src/ai.test.js src/leads*.test.js src/attributes*.test.js src/eye-height.test.js src/java-mobs.test.js src/mob-*.test.js src/slime*.test.js`: 505 pass, 0 fail.
- `npm run build`: passes. The full `npm test` was not run (batch rule). The b42-b44 references were not regenerated; their replays pass.

## Follow-ups
- Horse growth `moveEntity` nudge does not model wall collisions (open space only in records).
- Run-around-like-crazy with a rider, skeleton/zombie horse types in spawn rolls, and the eat/angry sound lists are not in the probe's recorded sounds.
- Horse loving a mule/donkey foal's inherited temper and armor/chest slots after breeding have no records.
