# Mob hurt, death, rewards and pushing (0.22.12, 0.22.13)

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
- **Experience.** At death tick 20, a mob hit by the player in the last 100 ticks drops experience: animals 1 to 3, monsters 5, and a skeleton 1 to 3 more for its bow. Children give none. The orbs drop in every game mode, and Creative players collect them too (since 0.22.13). The 20 `explode` particles follow.
- **Death timing.** A mob killed by a hit counts its first death tick on its next update. A mob killed by fire or drowning counts it in the same update. A dying mob still burns, slides on its knockback and is pushed.
- **Pushing.** Each living mob pushes every pushable entity whose box meets its own box grown by 0.2 horizontally. The push is 0.05 along the square root of the larger axis distance, and nothing happens within 0.01. Mobs push the player's box but never move the player; the player's own update pushes nearby mobs away.
- **Sun burning.** Adult zombies and skeletons in daylight above brightness 0.5 with open sky catch fire for 8 seconds when `nextFloat × 30 < (brightness − 0.4) × 2`, checked before the AI as in `onLivingUpdate`.

## Gaps

- Looting is not ported (there are no enchantments).
- Creepers killed by a skeleton draw the record roll, but this build has no records.
- Revenge targets come only from player hits; mobs do not retaliate against other mobs.
- Mobs are updated in this build's entity list order, not the original's chunk order, so pushes between three or more mobs can land in a different order.
- Every skeleton is assumed to hold a bow; spawn equipment rolls are not run.

## Suffocation

`suffocation-reference.json` (218 records, regenerate with `node tools/verify-suffocation.mjs`) is recorded from the unchanged client by `tools/probes/SuffocationProbe.java`: `Block.isNormalCube` for 38 ids, `Entity.isEntityInsideOpaqueBlock` over position sweeps for ten entity sizes (stone fully swept; glass, leaves, water, slabs and others for the player, zombie, pig and chicken), and 78 tick sequences through `EntityLivingBase.onEntityUpdate`.

- `isEntityInsideOpaqueBlock` samples eight corners (width * 0.8, 0.1 tall) at the eye (`height * 0.85F` for mobs; the server player uses posY + 1.62F, sneaking or not) with `isNormalCube`. Leaves, glass, water, snow layers, TNT, farmland, cactus, chests, ladders and torches do not count; stone, sand, gravel, clay, bedrock, soul sand and dirt do. `world.js` `normalCube` already agreed, so no new predicate was added (`src/suffocation.js`).
- A living, inside entity takes `DamageSource.inWall` 1.0 each update through the hurt pipeline: no armour, no Creative, no damage during 60 ticks of spawn protection, a hit every 10 ticks. A larger hit during the window deals only the difference (the player previously refused it; `Survival.damage` now tops up). Mob replays include sounds, hurt resistance and death ticks (`src/suffocation.test.js`).
- Not ported: slabs, stairs and fences (their native values are recorded). The void exception to spawn protection and the "suffocated in a wall" death text are covered under [Player hurt rules](#player-hurt-rules).

## Player hurt rules

`player-damage-reference.json` (116 records, regenerate with `node tools/verify-player-damage.mjs`) is recorded from the unchanged classes by `tools/probes/PlayerDamageProbe.java` on the real `EntityPlayerMP`, with a zombie for comparison. `src/player-damage.test.js` replays it through `Survival` (`src/survival.js`) and `src/death-messages.js`.

| Case | Records | What is checked |
| --- | --- | --- |
| hits | 30 | Hit runs on the player and a zombie: fresh hits, top-ups (including at the last window tick), refused hits, fatal top-ups and fresh kills. Each hit's return value, health, resistance, hurt time, last damage and world events (statuses, sounds at the entity, sounds the player sends to others) are recorded, plus the death message from the real `CombatTracker`. The final hit is each of ten sources, alone or 12 ticks after a zombie hit |
| protection | 77 | One 4.0 hit from each of 11 sources in Survival, with spawn protection (60 and 1), in Creative with and without protection, and in iron armour with and without protection |
| void | 9 | `Entity.onEntityUpdate` at fixed heights around −64 for the player (protected, Creative, armoured) and a zombie |

- **Top-ups send no hurt status.** On the server, `attackEntityFrom` only sends status 2 and plays the hurt or death sound when the hit opens a window (`flag`). The player's `playSound` is `playSoundToNearExcept`, so the player never hears the server's sound. It hears status 2 instead (`EntityLivingBase.handleHealthUpdate`: `game.player.hurt`, volume 1, pitch `(r − r) × 0.2 + 1`). Status 3 comes from `onDeath` and plays `game.player.die`. So the player hears nothing for a top-up, hurt then death for a fresh kill, and only the death sound for a top-up kill. The zombie records show the same on the server: a top-up kill sends `status|3` alone. This build used to play the hurt sound whenever health dropped, at volume 0.8.
- **Top-ups still shake the camera.** `EntityPlayerSP.setPlayerSPHealth` (`blk.n`, read with javap, not run) sets `hurtTime = maxHurtTime = 10` whenever the synced health drops, top-ups included. `Survival.hurtTime` now drives the hurt camera tilt, the damage flash and the third-person tint. The server-side window (`hurtTicks`) no longer does.
- **Spawn protection.** `EntityPlayerMP.attackEntityFrom` refuses every source while `field_147101_bU > 0`, unless it is `DamageSource.outOfWorld`. The PvP fall exception applies only on a dedicated server. `EntityPlayer.attackEntityFrom` then refuses Creative players unless the source `canHarmInCreative`, and only `outOfWorld` can. The void also bypasses armour: a void hit takes the full 4 even in iron armour.
- **The void.** `Entity.onEntityUpdate` calls `kill()` when `posY < −64` (exactly −64 is safe). `EntityLivingBase.kill` is `attackEntityFrom(outOfWorld, 4)`. The hurt window gates it, so the player takes 4 every 10 ticks and dies at tick 40 from full health, in every mode. It comes after the fire and lava hits and before `inWall`. `Survival.tick({ outOfWorld })` does this, and main.js passes `position.y < -64`. In practice the path is not reached yet, because main.js still moves a player below y 1 back to spawn and `world.get` returns lava below y 0. In addition, main.js only opens the death screen for Survival players, so a Creative void death would need that check changed.
- **Death messages.** `EntityPlayerMP.onDeath` broadcasts `CombatTracker.func_151521_b` to chat (1.7.10 has no `showDeathMessages` rule). `GuiGameOver` shows only "You died!" and the score. When the last hit is not a fall, the message is `death.attack.<type>`. The `.player` form, naming the last attacker, is used when that key exists, and the records confirm it for drowning, lava, fire, burning and cactus after a zombie hit. `inWall`, `starve` and `outOfWorld` have no `.player` form. This build therefore shows "Player suffocated in a wall", "Player starved to death" and "Player fell out of the world" as a single chat line at the `GuiNewChat` position (bottom left, 50 % black, fading after 10 s, under the death screen's gradient). Other causes show no message yet, because the attacker and fall state of the combat tracker are not kept. There is no account name, so "Player" stands in.

### Gaps

- Looting is still not ported, because this build has no enchantments.
- Death messages for falls (`death.fell.*`), mob and projectile kills, and the `.player` forms need the combat tracker's attacker and fall history.
- The void cannot be reached yet (the safety teleport below y 1, lava below y 0), and Creative void deaths open no death screen.
- The client hurt timing (`setPlayerSPHealth`) was read from bytecode but not executed, and the chat line uses wall-clock time instead of the 200-tick counter.

