# Partial-tick interpolation for mobs and XP orbs

Decoded with javap from the 1.7.10 JAR (obfuscated names in brackets). The game ticks at 20 Hz; the renderers receive `partial`, the fraction of the current tick elapsed (`accumulator / tick`, the value item entities already use).

## Entity state

`World.updateEntityWithOptionalForce` sets `lastTickPos = prevPos = pos` and the prev angles before each `onUpdate`; `RenderManager.func_147936_a` [bnn.a(Entity, F, Z)] draws at `lastTickPos + (pos - lastTickPos) * partial` and also seeds `lastTickPos = pos` while `ticksExisted == 0`. Mobs keep `px/py/pz` (as items do), `prevRotationYaw`, `prevRenderYawOffset`, `prevRotationYawHead`, `prevRotationPitch` and `prevLimbSwingAmount`, all refreshed at the start of `EntityWorld.tick`. Spawning, loading and `create` call `syncInterpolation`, so every prev field equals the current one. The transient fields are not serialized.

## RendererLivingEntity.doRender [boh.a(sv, DDDFF)]

- Body yaw is `interpolateRotation(prevRenderYawOffset, renderYawOffset, partial)` [boh.a(FFF)F: delta wrapped into [-180, 180), then `prev + partial * delta`], not `rotationYaw`; head yaw is the same for `rotationYawHead` and the model receives `headYaw - bodyYaw`. Pitch is a plain lerp.
- `limbSwingAmount = prev + (cur - prev) * partial` (capped at 1) and `limbSwing = limbSwing - limbSwingAmount * (1 - partial)`; children (`isChild`) multiply the swing by 3. Age is `ticksExisted + partial`.
- Death roll [boh.a(sv, FFF)]: `sqrt((deathTime + partial - 1) / 20 * 1.6)`, capped at 1, times `getDeathMaxRotation` (90).
- Hurt tint and `getBrightnessForRender` use the tick position, not the interpolated one, as before.

## Tick side

- `EntityLivingBase.moveEntityWithHeading` tail [sv.e(FF)]: `prevLimbSwingAmount = limbSwingAmount; limbSwingAmount += (min(sqrt(dx*dx + dz*dz) * 4, 1) - limbSwingAmount) * 0.4; limbSwing += limbSwingAmount`, in floats. `attackEntityFrom` sets `limbSwingAmount = 1.5`. Dying mobs keep running it so the swing stays continuous across tick boundaries.
- `EntityLiving.func_110146_f` [sw.f] calls `EntityBodyHelper.func_75664_a` [tr.a] for AI mobs: moving (`dx*dx + dz*dz > 2.5e-7`) sets `renderYawOffset = rotationYaw` and clamps the head within 75 degrees; idle, the body follows the head by at most 75 degrees, shrinking to zero after the head has stayed within 15 degrees for ten ticks. `EntityLivingBase.onUpdate` [sv.h] then shifts each prev angle by 360 until it is within 180 of the current one (`nearAngle`).
- `EntityXPOrb.onUpdate` [sq.h] increments `xpColor` and `xpOrbAge` every tick; orbs keep `px/py/pz` and `color`.

## RenderXPOrb [bnp.a(sq, DDDFF)]

Frame `getTextureByXP` [sq.f] (thresholds 3, 7, 17, 37, 73, 149, 307, 617, 1237, 2477; 16x16 cells of a 64x64 sheet), tint `r = (sin(t) + 1) * 0.5 * 255`, `g = 255`, `b = (sin(t + 4.1887903) + 1) * 0.1 * 255` with `t = (xpColor + partial) / 2` and `MathHelper.sin` (the 65536-entry table), channels truncated. The quad is 0.3 wide and spans y -0.25 to 0.75, so its centre sits 0.075 above the orb position (posY, 0.25 above the box bottom; before 0.21.4 the quad was drawn from the box bottom).

## Gaps

- Batch 69 (docs sweep): `ai.js` now ports `EntityMoveHelper`, `EntityLookHelper` (with `limitAngle`) and `EntityJumpHelper` (`MoveHelper` class, header of `ai.js`), so the turn-limit part of this line is stale for task-AI mobs; which mobs still use the instant-turn path was not audited. Older text: mob AI is still the simplified one: `e.yaw` turns instantly and `rotationYawHead` equals it (no `EntityLookHelper` or `EntityMoveHelper` 30 degree turn limit), so the head only trails the body through `EntityBodyHelper`. Pitch is always zero.
- Mob walking speeds now come from the 1.7.10 movement model (see `mob-movement.md`); a wandering pig's `limbSwingAmount` settles near 0.54.
- The zombie attack swing (`swingProgress` in `ModelZombie`) is not drawn, only the `ageInTicks` arm sway. The orb quad's 128 alpha is not applied.
- `deathTime` starts at 1 on the killing blow rather than on the mob's next tick, so the fall begins at most one tick early.
