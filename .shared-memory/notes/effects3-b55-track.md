# effects3 batch 55 track (branch batch55-effects3, from be55d463b)

## Summary
- **PotionEffect.combine for mobs and the player, ambient flag included.** Stronger amplifier replaces amplifier and duration (old ambient flag stays); equal amplifier takes the longer duration; every other case (weaker, or equal and not longer) a non-ambient add clears the old ambient flag. `addMobEffect` gained an `ambient` argument; `Effects.add` (player) keeps `ambient` (beacons already pass it) and refills Absorption on any re-add (onChangedPotionEffect removes then re-applies the modifier).
- **isPotionApplicable in addMobEffect** (`isPotionApplicable` exported from `src/mob-effects.js`): undead refuse Regeneration (10) and Poison (19); spiders and cave spiders refuse Poison only. Applies to every path through addMobEffect (splash, witch, wither hits, spider poison, `/effect` on mobs, tests). Splash victims carry an `applicable` callback (`src/witch-potions.js`, `src/witch.js`).
- **One undead set.** Executed result: zombie (villager included), skeleton (both types), pigman and wither are UNDEAD; the horse class has no override, so zombie and skeleton horses are UNDEFINED (the earlier port treated them as undead for the wither's target selector and effect inversion: corrected, including `witherIsUndead`). Giant is UNDEFINED. Silverfish is ARTHROPOD (`creatureAttribute` fixed). The witch splash set (zombie, skeleton only) now uses the same set.

## Evidence
- Executed (`tools/probes/MobEffects2Probe.java` tags b55attr, b55comb, b55inst via `tools/verify-mob-effects.mjs` -> `public/research/mob-effects-reference.json`, 196 records): getCreatureAttribute / isEntityUndead / isPotionApplicable for ids 0..24 on 28 kinds plus horse types 0..4; 72 random addPotionEffect sequences with ambient flags (Pig, Zombie, Spider, CaveSpider, Skeleton, WitherBoss); Potion.affectEntity instant branch on 396 cases. Replayed by `src/mob-effects-b55.test.js`.
- Bytecode-read only: callers' use of combine (beacon, golden apple, `/effect`, potions) go through the same addPotionEffect; not each executed separately.

## Verification
- `node --test` on every test file mentioning mob-effects, status-effects, witch, enchantment-effects, wither-boss-mobs or creatureAttribute (71 files): 899 pass, 0 fail. `npm run build` ok. Full `npm test` not run (lead).
- Updated expectation: wither-boss.test.js (zombie horse is not undead).

## Follow-ups
- HashMap order is still the Java 8+ one (probe JDK 19); Java 6/7 bucket order differs (documented, not changed).
- `/effect` on the player replays combine through Effects.add but gives no ambient flag (native passes false); the splash instant branch is replayed by formula, not through a live splash on the witch table for amplifiers other than instant damage I.
