# Difficulty (0.22.11)

Options has a Difficulty setting: Peaceful, Easy, Normal (the default) or Hard. It is the EnumDifficulty id that 1.7.10's `GameSettings.difficulty` holds, saved with the other settings in `blockworld.settings`. As in singleplayer, it applies to whichever world is open, and changing it takes effect at once.

`tools/probes/DifficultyProbe.java` and `tools/verify-difficulty.mjs` run the unchanged 1.7.10 classes and write [difficulty-reference.json](difficulty-reference.json): 5,928 records, with the sha256 of every class used. `src/difficulty.test.js` replays them, along with the rules as wired into the game.

| Case | Records | What is checked |
| --- | --- | --- |
| local | 256 | `World.func_147462_b` (local difficulty) by difficulty, moon phase and inhabited time, in float math |
| player | 224 | `EntityPlayer.attackEntityFrom`: which sources are scaled and by how much |
| starve, exhaust | 28, 12 | `FoodStats`: when starvation stops, and hunger never dropping on Peaceful |
| spider | 1,800 | `EntitySpider.onSpawnWithEgg`: the jockey roll and the Hard group effect from `World.rand` |
| potion | 8 | Speed, Strength, Regeneration and Invisibility on a spider: attribute values, liquid colour, healing ticks and the swirl draws |
| zombieHit | 480 | `EntityZombie.attackEntityAsMob`: setting the target on fire |
| zombieSpawn | 2,400 | `EntityZombie.onSpawnWithEgg`, every roll in its original order, on both random streams |
| reinforce | 720 | `EntityZombie.attackEntityFrom`: the reinforcement roll and the 50-spot search |

## Rules in the game

- **Damage to the player.** Mob melee and explosions (creepers and TNT) are scaled:
  - Peaceful: 0 (the hit does not count; explosion knockback still applies);
  - Easy: amount / 2 + 1;
  - Normal: unchanged;
  - Hard: amount × 3 / 2.

  Arrows, falls, fire, lava, drowning and starvation are not scaled.
- **Hunger.** On Peaceful, exhaustion still drains saturation but never food. Starvation stops at:
  - Easy: 10 health;
  - Normal: 1;
  - Hard: never (it can kill).
- **Peaceful regeneration.** The player heals 1 every 20 ticks (`ticksExisted % 20 * 12 == 0`); the food bar does not refill (that came after 1.7.10).
- **Monsters on Peaceful.** None spawn. Zombies, skeletons, spiders and creepers already in the world are removed on their next tick (`EntityMob.onUpdate` setDead), with no death animation, drops or experience.
- **Local difficulty.** This is the chunk's inhabited time plus the moon factor, as `World.func_147462_b` computes it.
  - Inhabited time follows `PlayerManager`'s 8000-tick passes and is saved with the world as `inhabited`.
  - The view radius covers the whole 8 × 8-chunk world, so one counter stands for every chunk.
- **Spider spawns.** On Hard, `World.rand.nextFloat() < 0.1 × local difficulty` gives the spider one permanent effect: Speed (2 in 5), Strength, Regeneration or Invisibility.
  - Effects are saved with the mob (`ActiveEffects`).
  - The swirls take the effect's liquid colour and are rarer while invisible ([particles](particles.md)).
  - Speed multiplies the move speed by 1.2 and Strength the attack damage by 2.3. Regeneration heals 1 every 50 ticks.
  - An invisible spider draws no model, shadow or hurt tint, only its eyes, as RendererLivingEntity and RenderSpider do.
- **Zombie spawns.** `onSpawnWithEgg` sets the knockback resistance, follow range (with the "Random zombie-spawn bonus" above 1) and the leader's reinforcement bonus. The navigator and target search use that follow range.
- **Zombie reinforcements (Hard).** A zombie that takes a counted hit while its target is the player may spawn another zombie, with chance equal to its `spawnReinforcements` attribute (0 to 0.1 at birth, +0.5 to 0.75 for a leader).
  - Up to 50 tries, 7 to 40 blocks out on each axis.
  - A spot needs a solid top below, block light below 10, no entity, no block boxes and no liquid.
  - The new zombie spawns at the block corner, targets the player, and both zombies lose 0.05 chance.
  - The total stays within the 40-mob cap.
- **Burning zombies.** A burning zombie with an empty hand that hits the player sets them on fire for 2 × id seconds, with chance id × 0.3.
- **Path tries.** `getMaxSafePointTries` takes off (3 − id) × 4 from a targeting mob's tries.
- **Skeleton arrows.** Damage gains id × 0.11, and the spread is 14 − id × 4.
- **Fire.** Spread chance adds id × 7; lightning sets fire only on Normal and Hard.

## Gaps

Each of these rolls is drawn, so the random streams stay in step, but its result is dropped:

- mob equipment and its enchantments (rolling an enchantment ends the zombie replay, as `diverged`);
- loot pickup;
- child and villager zombies, and chicken and spider jockeys;
- door breaking (zombies here do not break doors);
- the leader's extra max health;
- Halloween pumpkins.

Other gaps:

- Skeleton and creeper spawn rolls (follow-range bonus, skeleton equipment) are not run.
- Reinforcements only answer hits whose target is the player.
- Hurt sounds and knockback in this build draw from `Math.random`, not from the zombie's own Random, so live games do not reproduce the original's exact reinforcement spots. The replay does.
- Hard-only content that this build lacks is missing: cave spider poison, wither effects, villager conversion, and the Hardcore lock.
