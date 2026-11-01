# Sprinting, sprint-jumping, flight and swimming (1.7.10)

Everything here comes from the unchanged 1.7.10 client JAR (sha1 `e80d9b3b...`, `tools/research/minecraft-1.7.10.jar`), read with `javap -c -p`. Names are the obfuscated 1.7.10 ones. The target is 1.7.10 only: later versions double the flying speed while sprinting and add an FOV-effects option, and neither exists here. This is not full parity.

## Sources

| Obf | Mojang-era name | Used for |
| --- | --- | --- |
| `blk` | EntityPlayerSP | `t()F` getFOVMultiplier; `e()V` onLivingUpdate (sprint start/stop, flight toggle, flying ±0.15, landing ends flight) |
| `yz` | EntityPlayer | `e()V` onLivingUpdate (flyToggleTimer `bq` countdown, `setAIMoveSpeed`, jumpMovementFactor `aQ` = speedInAir `bJ` (+30% sprinting)); `e(FF)V` moveEntityWithHeading (flying: flySpeed, motionY × 0.6); `bj()V` jump exhaustion |
| `sv` | EntityLivingBase | `e()V` onLivingUpdate (jumpTicks `bq`, liquid lift 0.04, ground jump); `bj()V` jump (0.41999998688697815, sprint push 0.2F); `e(FF)V` moveEntityWithHeading (water/lava/land branches, 0.16277136F / friction³); `c(Z)V` setSprinting (speed modifier) |
| `yw` | PlayerCapabilities | `a()F` flySpeed 0.05F, `b()F` walkSpeed 0.1F, `b` isFlying, `c` allowFlying |
| `blt` | EntityRenderer | `updateFovModifierHand` easing (already ported for the bow in `bow.js`) |

## Ported (`src/player-movement.js`, wired in `src/main.js`)

1. **Sprint speed.** The movementSpeed attribute base is `0.10000000149011612`; `setSprinting(true)` adds the "Sprinting speed boost" modifier `0.30000001192092896` with operation 2, so the value becomes ×1.3. `EntityPlayer.onLivingUpdate` hands it to `setAIMoveSpeed` as a float, and the ground acceleration is `aiMoveSpeed * (0.16277136F / friction³)` (`groundAccel`). In the air, jumpMovementFactor is `speedInAir` 0.02F, plus `speedInAir * 0.3D` while sprinting (`airAccel`, one float step below 0.026). Measured in the browser on flat grass: walking 4.31 blocks/s, sprinting 5.61 (formula 4.317 / 5.612).
2. **Sprint start and stop** (unchanged from 0.14): a double tap of forward within 7 ticks on the ground, or the sprint key (Ctrl, `keyBindSprint`), with forward ≥ 0.8, food > 6 or allowFlying, no item use, no blindness; it stops below 0.8 forward, on a horizontal collision or without food. While playing, Ctrl+letter shortcuts are kept from the browser (Ctrl+W can still close the tab in some browsers; the double tap works everywhere).
3. **Sprint jump.** `jump()` sets motionY 0.41999998688697815 and, sprinting, pushes 0.2F along the facing (`sprintJumpPush`); `EntityPlayer.jump` adds 0.8F exhaustion sprinting, 0.2F otherwise. `jump()` does not clear onGround, so the jump tick still moves with ground friction and acceleration (the old controller used air values, which slowed sprint-jumping). Measured: 6.8 blocks/s after two jumps and still rising toward the ~7.1 steady state, jump height 1.25, a jump every 12 ticks.
4. **Jump delay.** `sv.e()` counts `jumpTicks` down; holding jump on the ground jumps only at 0 and sets it to 10; releasing the key resets it to 0 (`PlayerMotion.jump`). In water or lava a held jump adds 0.03999999910593033 to motionY instead of jumping, even when standing on the bottom.
5. **Field of view.** `getFOVMultiplier`: 1, ×1.1F flying, ×(movementSpeed / walkSpeed + 1) / 2 in doubles (×1.15 sprinting), then the bow draw term. `updateFovModifierHand` eases toward it by half each tick and `getFOVModifier` interpolates by the partial tick (`fovMultiplier` feeds the existing `easeFov`). Measured at FOV 75: 86.25 sprinting, 82.5 flying, 94.87 sprint-flying.
6. **Creative flight.** The toggle is now tick-based like `blk.e()`: a fresh jump press with allowFlying arms `flyToggleTimer` 7, a second fresh press while it runs toggles flight, and `yz.e()` counts it down after the toggle (so the presses must be at most six ticks apart). Flying, the sneak and jump keys add −0.15 / +0.15 to motionY; `yz.e(FF)` replaces jumpMovementFactor with flySpeed 0.05F (not doubled by sprinting in 1.7.10), runs the living move with air friction 0.91F, then sets motionY to 0.6 × its value before the move. Touching the ground ends flight. Measured: 10.9 blocks/s horizontally (formula 0.98 × 0.05 / 0.09 × 20), 4.5 blocks/s vertically. Water no longer pushes a flying player (`isPushedByWater`).
7. **Swimming.** The water branch of `moveEntityWithHeading` uses `moveFlying(0.02F)` whatever the ground or sprint state (the old controller used the ground acceleration on the bottom), then motion × 0.800000011920929 and motionY − 0.02 (in that order). Lava is × 0.5 then − 0.02. Both now get the 0.30000001192092896 step-out when blocked horizontally with a clear, dry spot 0.6 higher. Holding jump rises 0.1 block a tick at the steady state.

## Evidence

- `src/player-movement.test.js`: attribute and acceleration constants, terminal walk/sprint speeds, the 10-tick held-jump cadence, the six-tick flight double tap, flying vertical drag (0.225 a tick) and horizontal speed, and the FOV multipliers including the bow term.
- Browser check (muted, isolated "Sprint Check" Creative world): the speeds, FOV values, flight landing and swim-up figures above.
- No original-class probe yet: `getFOVMultiplier` needs the attribute map built by the player constructor. The constants were read directly from the bytecode listed above.

## Remaining differences

- The player still uses the simplified main.js collision (no 0.5 step-up, no exact `moveEntity` box sweep), so speeds against walls and on slopes can differ.
- `isInWater` used the block at feet + 0.6 until 0.22.9, which switched to `handleMaterialAcceleration` on the contracted box ([particles](particles.md)).
- Sprint running particles are in [particles](particles.md); no speed/slowness potion terms in the FOV, no hunger-based sprint stop message.
