# Mob hurt, death, rewards and pushing (0.22.12)

`tools/probes/CombatProbe.java` and `tools/verify-combat.mjs` run the unchanged 1.7.10 classes and write [combat-reference.json](combat-reference.json): 1,113 records, with the sha256 of every class used. `src/combat.test.js` replays them through `EntityWorld` (`src/entities.js`), with the rules in `src/combat.js`.

| Case | Records | What is checked |
| --- | --- | --- |
| hurt | 1,008 | `EntityLivingBase.attackEntityFrom`, `onDeath` and `onDeathUpdate` for the pig, cow, sheep, chicken, zombie, skeleton, spider and creeper (adults and animal children). Each seeded scenario is a run of hits from the player, a mob, a skeleton arrow, fire, lava, falls and drowning; health, motion, limb swing, hurt time, resistance, last damage, recently-hit, sound volume and pitch, every drop, the experience split and the next value of both random streams are compared |
| push | 96 | `collideWithNearbyEntities` and `applyEntityCollision` for every pair of mob types at 6 offsets, including a dead mob: exact motions and boxes |
| pushable | 8 | `canBePushed` for living and dead mobs, the player, items, orbs, arrows, TNT and falling blocks |
| split | 1 | `EntityXPOrb.getXPSplit` as `onDeathUpdate` uses it |

## Rules in the game

- **Hurt resistance.** A hit sets `hurtResistantTime` to 20 and `hurtTime` to 10. While hurt time is above 0, a hit no larger than the last one is refused, and a larger one deals only the difference, with no sound, flash or knockback.
- **Hit order.** An animal starts fleeing (and leaves love mode) even if the hit is refused. Then come the limb swing (1.5), resistance, `damageEntity`, revenge and the 100-tick recently-hit timer for a player hit, `setBeenAttacked`, knockback from the attacker, then the hurt or death sound. A zombie then calls reinforcements on Hard ([difficulty](difficulty.md)).
- **Random streams.** `setBeenAttacked` (not for drowning), knockback resistance, sound pitch, every drop roll and the death burst draw on the mob's own `Entity.rand`. The knockback nudge uses `Math.random`, as the original does. Animal experience draws on `World.rand`.
- **Sounds.** Cows play at volume 0.4 and other mobs at 1. Pitch is `(nextFloat − nextFloat) × 0.2 + 1`, or + 1.5 for a child.
- **Armour.** The zombie's 2 natural armour points cut melee, arrows, explosions, lava and fire blocks to 23/25. Falls, burning, drowning and generic damage bypass armour.
- **Drops** (no looting), one item entity per item:
  - pig: 1 to 3 porkchops;
  - cow: 0 to 2 leather and 1 to 3 beef;
  - chicken: 0 to 2 feathers and 1 chicken;
  - sheep: its wool, unless sheared;
  - zombie: 0 to 2 rotten flesh;
  - skeleton: 0 to 2 arrows and 0 to 2 bones;
  - spider: 0 to 2 string, plus an eye (1 in 3) after a player hit;
  - creeper: 0 to 2 gunpowder.

  Meat is cooked when the mob dies burning. After a player hit, a skeleton drops its bow with chance 0.085, worn by a random amount. Also after a player hit, a zombie has a 5 in 200 rare drop: an iron ingot, carrot or potato. Children drop nothing.
- **Experience.** At death tick 20, a mob hit by the player in the last 100 ticks drops experience: animals 1 to 3, monsters 5, and a skeleton 1 to 3 more for its bow. Children give none. The 20 `explode` particles follow.
- **Death timing.** A mob killed by a hit counts its first death tick on its next update. A mob killed by fire or drowning counts it in the same update. A dying mob still burns, slides on its knockback and is pushed.
- **Pushing.** Each living mob pushes every pushable entity whose box meets its own box grown by 0.2 horizontally. The push is 0.05 along the square root of the larger axis distance, and nothing happens within 0.01. Mobs push the player's box but never move the player; the player's own update pushes nearby mobs away.
- **Sun burning.** Adult zombies and skeletons in daylight above brightness 0.5 with open sky catch fire for 8 seconds when `nextFloat × 30 < (brightness − 0.4) × 2`, checked before the AI as in `onLivingUpdate`.

## Gaps

- Looting is not ported (there are no enchantments).
- Creepers killed by a skeleton draw the record roll, but this build has no records.
- Suffocation (`inWall`) damage is not ported.
- Revenge targets come only from player hits; mobs do not retaliate against other mobs.
- Mobs are updated in this build's entity list order, not the original's chunk order, so pushes between three or more mobs can land in a different order.
- Every skeleton is assumed to hold a bow; spawn equipment rolls are not run.
- In Creative, kills drop no experience orbs (`main.js`). The original drops them in every game mode.
