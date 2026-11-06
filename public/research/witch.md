# EntityWitch (Minecraft Java 1.7.10)

Evidence: `tools/probes/WitchProbe.java` runs against the unchanged 1.7.10 jar (SHA1 e80d9b3bf5085002218d4be59e668bac718abbc6);
`tools/verify-witch.mjs` checks the record counts and class hashes and writes `public/research/witch-reference.json`;
`src/witch.test.js` replays it. Obfuscated names: yp EntityWitch, zo EntityPotion, adp ItemPotion, aen PotionHelper, bim ModelWitch, bpb RenderWitch.

## Native-verified (replayed from the reference)
- Attributes: 0.6 x 1.8, max health 26 (not 20), speed 0.25, attack damage 2, follow range 16, eye 1.53, talk interval 80.
- Tasks: Swimming 1, ArrowAttack 2 (speed 1.0, interval 60, range 10), Wander 2, WatchClosest 3 (8, player), LookIdle 3; targets HurtByTarget 1, NearestAttackable 2 (player).
- Drinking: the five chained rolls on Entity.rand (water, fire, health, speed), the 32-tick drink, the -0.25 speed penalty, the held-potion effects on finish.
- Throwing: potion choice (harm, slowness, poison, weakness), spawn offset, aim (dy + dist * 0.2), velocity 0.75, inaccuracy 8, no throw while drinking.
- Damage: own damage 0, magic damage scaled by 0.15. Drops (table of 8, count nextInt(3)+1, looting), held potion equipment drop 0.085, experience 5 (+1+nextInt(3) with a held item).
- EntityPotion.onImpact: 4 x 2 x 4 box, distSq < 16, factor 1 - sqrt/4 (1 direct), harm/heal amounts, undead inversion, timed durations, the >20 tick rule, undead immune to regeneration/poison. Gravity 0.05.
- ModelWitch boxes, hat chain and the nose sway (noseAngles); texture `textures/entity/witch.png`.

## Live in the game
Witch mob (`src/witch.js`, `witch-potions.js`, `witch-renderer.js`; hooks in entities.js, ai.js, combat.js, mob-effects.js, mob-renderer.js, projectiles.js,
population-runtime.js, region-export.js NAMES, mob-spawner.js). Swamp-hut `{type:'Witch'}` records now spawn live witches. Saved as entity id `Witch`.
Potion flight reuses the throwable flight of `projectiles.js` (kind `potion`, gravity 0.05) in a second Projectiles instance (`mobs.potions`).
Effects go through `mob-effects.js` (slowness, instant health, fire resistance, water breathing, weakness, poison were added) and, for the player, survival damage and poison.
Item ids of this build: 384 glass bottle, 385 potion.

## Approximated or missing
- Player motion is treated as 0 when the witch leads its throw.
- The player takes splash harm and poison; slowness and weakness now feed player speed, FOV and melee damage through status-effects.js (see player-knockback.md); witch potions on the player are otherwise unchanged.
- No potion break particles; the glass sound `game.potion.smash` is emitted but the asset index has no witch sounds (`mob.witch.*`), so the witch is silent.
- Potions cannot be obtained or brewed; there is no glass bottle recipe. The held/thrown sprite has no potion tint, and the held potion is not drawn in 3D.
- Only the eight potion values the witch uses are implemented, not PotionHelper.
- Natural spawning is a low-rate night clock on grass (one witch cap), not the weighted SpawnerAnimals pass; the swamp-hut witch comes from the structure records.
- Thrown potions in flight are not saved. The held potion is not exported to region files.
- The live thrown-aim gaussian is unseeded; flight is replayed from seeded evidence only for the deterministic parts.
- Full parity is not claimed.
