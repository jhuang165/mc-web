# Sneaking, sprint input and player attacks (1.7.10)

Everything here comes from the unchanged 1.7.10 client JAR (sha1 `e80d9b3b...`, `tools/research/minecraft-1.7.10.jar`), read with `javap -c`. Names are the obfuscated 1.7.10 ones. Target is 1.7.10 only; no later-version heights, speeds or particles. This is not full parity.

## Sources

| Obf | Mojang-era name | Used for |
| --- | --- | --- |
| `sa` | Entity | `d(DDD)` moveEntity (edge loop, ySize decay, step sounds), `a(FFF)` moveFlying, `L` yOffset, `V` ySize, `R` fallDistance |
| `sv` | EntityLivingBase | `e(FF)` moveEntityWithHeading, `e()` onLivingUpdate (x0.98 input), `i(F)` setAIMoveSpeed |
| `yz` | EntityPlayer | `r(sa)` attackTargetEntityWithCurrentItem, `e()` onLivingUpdate |
| `blk` | EntityPlayerSP | `e()` onLivingUpdate (sprint rules, ySize 0.2 while sneaking), `an()` isSneaking |
| `bli` / `blj` | MovementInput / MovementInputFromOptions | `blj.a()` x0.3 input while the sneak key is down |
| `bje` | PlayerControllerMP | `onPlayerRightClick` sneak gate |
| `bop` | RenderPlayer | sneak pose, the -0.125 shift (other players only) |
| `blt` | EntityRenderer | no sneak code: the eye drop is ySize |

## Ported (src/player-movement.js, wired in main.js and entities.js)

1. Input. `blj.a()` multiplies moveStrafe and moveForward by 0.3 (double multiply narrowed to float) while the sneak key is down. `blk.an()` is `movementInput.sneak && !sleeping`, so Shift is also sneaking while creative-flying (it keeps meaning "descend" there and the horizontal input is x0.3). `moveInput` / `moveWeights` are exact float ports, including the x0.98F scale and the `max(1, hypot)` normalisation that `sv.e()` / `sa.a(FFF)` apply to the player like any living entity (this replaces the old `/max(1,len)*0.98`). Item use (eating) scales input by 0.2 as in `blk.e()`.
2. Sprint cancel. Sprinting needs forward input >= 0.8, food > 6 (or may-fly), no item use and no horizontal collision; double-tap window is 7 ticks. 0.3F * ... is below 0.8, so sneaking drops sprint for that reason alone (`PlayerMotion.update`). Sprint exhaustion in `tickSurvival` now follows `motion.sprinting`.
3. Edge safety. `sa.d(DDD)`: when `onGround && sneaking && this instanceof EntityPlayer`, the move is shortened with three while-loops against `getCollidingBoundingBoxes(box.getOffsetBoundingBox(dx, -1, 0))` (x alone, z alone, both) in 0.05 steps, snapping anything in [-0.05, 0.05) to 0. Only the move delta changes; motion is untouched. `sneakEdge` is the loop; `entities.js moveEntity` calls it for `e.sneaking`, and `main.js` calls it with a `collides` predicate for the player.
4. Eye drop. `blk.e()` raises `ySize` to at least 0.2 while sneaking; `sa.d` then does `ySize *= 0.4F` every move and places `posY = minY + yOffset - ySize`. So the eye sits 0.08 low as soon as Shift is held (no easing down) and recovers 0.08, 0.032, 0.0128... on release. `PlayerMotion.ySize/prevYSize/drop(t)` do this; the camera and the player model/shadow use it.
5. Model. `PlayerRenderer.update(..., {sneak})` (`bipedPose({sneak})` already existed) now gets `motion.sneaking`. In 1.7.10 the local player's model sits at feet minus ySize; the -0.125 shift in `bop` is only for non-local players, so it is not applied here.
6. Walking while sneaking on the ground. `sa.d` skips `distanceWalkedModified` (bob phase), step sounds and `onEntityWalking` when `isSneaking()`: `stepDistance` and the view-bob `walk` phase (`freezeWalk` in animation.js) do not advance.
7. Right click. `bje.onPlayerRightClick` activates the block only when `!isSneaking() || heldItem == null`. Crafting table, furnace and chest use that gate in `edit()`; a held item is placed or used against the block instead.
8. Attack (`yz.r`). Knockback level i = enchantment + (sprinting ? 1 : 0); when i > 0: `target.addVelocity(-sin(yaw)*i*0.5F, 0.1, cos(yaw)*i*0.5F)` with the sine table and Java floats (`EntityWorld.attack`, `extraKnockback`), then the player's motionX/Z *= 0.6 and sprint off (`main.js edit()`). This runs after `attackEntityFrom`'s own `knockBack`. Critical: `fallDistance > 0 && !onGround && !onLadder && !inWater && no blindness && not riding` and a living target makes damage `damage * 1.5F` before the invulnerability check (`isCritical`, `criticalDamage`). No critical sound exists in 1.7.10. Creative players now accumulate `fallDistance` too (the fall damage stays Survival only).

## Evidence

- `tools/probes/SneakProbe.java` + `tools/verify-sneak.mjs` write `sneak-reference.json` (144 cases): the unchanged `blk` on a constructor-less double and a finite stone platform, `sa.d` once on the ground with the sneak key up/down, and 40-tick walks (`setAIMoveSpeed(0.1)`, `sv.e(FF)`, moveForward 1 or 0.3F, x0.98F) at yaw 0/-45/-90 near the edge. `src/player-movement.test.js` replays them through `src/entities.js moveEntity` / `moveEntityWithHeading` to 1e-12; 24 of 66 single moves differ between sneaking and not.
- Unit tests with bytecode constants: 0.3F input, 0.98F scale, sprint toggle/cancel rules, ySize 0.2*0.4 = 0.08 and decay, crit 1.5F, knockback vector for sprint (i = 1) and sprint + Knockback I (i = 2), and `EntityWorld.attack` with `critical`.
- No attack probe: the vector and 1.5F are small enough to port from the bytecode directly.

## Missing / deliberate gaps

- Critical-hit particles (`EntityPlayer.onCriticalHit`, 1.7.10 spawns "crit" particles) are not drawn; the damage is.
- The Knockback enchantment does not exist yet; `attack(..., extraKnockback)` takes any level, main.js passes sprint only.
- Correction (0.21.1): 1.7.10 has no step-up `ySize` feed. `sa.d` only decays ySize, and refuses the 0.5 step while it is >= 0.05 unless sneaking on the ground ([player step](player-step.md)). Only `setPositionAndRotation` resets it to 0.
- Underwater tint, block picking and the camera in water do not use the sneak drop; only the eye position does.
- Cape and nameplate sneak effects are not ported; there is no touch sneak button.
- Creative flight is not a physics port: Shift stays "descend" and the horizontal input is x0.3.
- `onEntityWalking` is skipped while sneaking, but no block has such a hook here yet (no trampling).
- The probe uses yOffset 0 (posY = feet), as `MobMoveProbe` does; the 1.62 yOffset is only added in the game.
- `third-person.md` still says "No sneak pose ... not wired"; that is out of date, the pose is now fed by `motion.sneaking`.
