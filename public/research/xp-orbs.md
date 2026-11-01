# XP orb physics (1.7.10, since 0.21.4)

`ExperienceOrbs` in `src/experience.js` ports `EntityXPOrb` [sq] from the 1.7.10 JAR. It replaces the earlier per-axis movement with a guessed pull, bounce and pickup.

## Ported

- **Spawn** [sq(ahb, DDDI)]: a 0.5 × 0.5 box with yOffset 0.25, so posY is the box centre. rotationYaw takes one `Math.random()`, then motion is `(float)(r * 0.2 - 0.1) * 2F` sideways and `(float)(r * 0.2) * 2F` up. Spawn points follow the callers:
  - `Block.dropXpOnBlockBreak` uses the block centre.
  - `SlotFurnace` uses (posX, posY + 0.5, posZ + 0.5) of the player.
  - Mob death, breeding and the player's death use the entity's feet.
  - Explosions use the block centre, as before.
- **onUpdate** [sq.h], in order:
  1. `Entity.onEntityUpdate`. `EntityXPOrb.handleWaterMovement` only pushes along the water flow with the unshrunk box. It never sets `inWater` and never puts the orb out, so only rain counts as wet. Then the fire countdown (onFire 1 when the counter is a multiple of 20), lava (lava 4, `setFire(15)`) and the void below −64.
  2. Gravity: motionY −0.03.
  3. Lava in the orb's cell throws it up at 0.2 and sideways at (r − r) × 0.2F, with `random.fizz` (0.4, 2 + r × 0.4).
  4. `func_145771_j` [sa.j] at the box centre. This is now `entityPushOut` in `src/entities.js`, shared with items. Unlike items, the result does not set noClip.
  5. Player search: when `xpTargetColor < xpColor − 20 + entityId % 100`, an orb with no target, or whose target is more than 8 blocks away, takes the closest player within 8 blocks (distance squared < 64 from the orb's posY to the feet).
  6. Pull: d = (target − orb) / 8, aimed at feet + `EntityPlayerMP.getEyeHeight` (1.62F). Server orbs aim at the server player; the client player's 0.12F applies only to its own copy. When |d| < 1, the orb gains d / |d| × (1 − |d|)² × 0.1.
  7. `moveEntity` with stepHeight 0, then the [block collision tail](player-step.md).
  8. Friction 0.98F, or block slipperiness × 0.98F on the ground. Vertical drag 0.98, and on the ground motionY × −0.9.
  9. xpColor and xpOrbAge go up by 1; the orb dies at age 6,000.
- **Damage** [sq.a(ro, F)]: 5 health, truncated per hit, dead at 0. Hits keep counting within the tick, so lava then fire leaves −2.
- **Pickup** [sq.b_(yz)]:
  - The player collides with orbs (any game mode, while alive) using its box grown by (1, 0.5, 1); the overlap test is strict.
  - Pickup needs `xpCooldown` [yz.bt] at 0. It then sets the cooldown to 2, plays `random.orb` at volume 0.1 and pitch 0.5 × ((r − r) × 0.7 + 1.8), and adds the value.
  - `EntityPlayer.onUpdate` counts the cooldown down before the collision, so the player takes one orb every other tick.
  - The orb's own pickup delay [sq.c] is never set by any 1.7.10 class, so it is always 0 and there is no delay.
- **Level-up sound** [yz.a(I)]: each level gained that is a multiple of 5 plays `random.levelup` at (level > 30 ? 1 : level / 30F) × 0.75F. It only plays if the last one was more than 100 ticks of `ticksExisted` ago. Earlier builds played it at 0.4 in place of the orb sound.
- **Saves** keep the position, motion, value, age, health, fire and onGround, like the entity's NBT. xpColor, the search state and the target are not saved. Older saves' remaining `life` becomes age 6000 − life.
- **Rendering**: `RenderXPOrb` and the shadow now use posY (box bottom + 0.25). Earlier builds drew the orb 0.25 too low.

## Evidence

`tools/probes/XpOrbProbe.java` builds the unchanged `EntityXPOrb` on a map-backed World double that extends `World` directly, so `isMaterialInBB` and `handleMaterialAcceleration` are the original methods. It sets the motion, entityId and rand, then calls `onUpdate` for up to 120 ticks. The target is an `EntityPlayerSP` whose `getEyeHeight` returns `EntityPlayerMP`'s 1.62F (EntityPlayerMP itself needs netty to load).

`node tools/verify-xporbs.mjs` (with `MC_RESEARCH`) writes `xporb-reference.json`. It holds 19 cases:

- drop, rest, ice slide, wall, ceiling;
- pulls from 3, 5.7 and 6.9 blocks, out of range, from above, a player who leaves at tick 30, and touching range, with entityId 0–120;
- still lava, a lava edge, a water stream, fire, two cactus cells;
- inside stone, centred and off-centre.

`src/xp-orbs.test.js` replays every tick exactly: position, motion, onGround, fire, health, death, xpTargetColor, the target, and each attackEntityFrom and playSound call. The probe caught the push-out speed's `0.2F` and `0.1F` float constants, which the item port had computed in double; items now use the shared, corrected function.

Browser check (muted, scratch "Ladder Check" Creative world): 25 XP spawned 4 blocks away burst into 17, 7 and 1 orbs. They landed, took a target 20 ticks in (the id-based delay), and were pulled in and picked up one at a time; XP went 0 → 17 → 18. The 7 orb fell into a pit more than 8 blocks away, so its target was dropped, and it stayed there. No console errors.

## Gaps

- Pickup runs after the orbs move, as for items. The server handles the player's movement packet before the world's entity tick, so the original order within a tick may differ.
- One player only. Orbs keep aiming at the player's death position until respawn, as the original keeps a dead player in `playerEntities`.
- Kill-reward eligibility (`recentlyHit`, Creative kills) is unchanged. Orbs are not damaged by explosions.
- `ticksExisted` for the level-up throttle restarts on load, not on respawn.
