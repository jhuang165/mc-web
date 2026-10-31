# Snowballs (EntitySnowball, EntityThrowable, ItemSnowball)

Ported from the unchanged 1.7.10 classes with `javap` (names are the obfuscated ones from `joined-1.7.10.srg`). Code: `src/projectiles.js` (rules), `src/projectile-renderer.js` (drawing), hooks in `main.js` (`throwSnowball`, tick, save/load) and `scene.js`. Tests: `src/projectiles.test.js`; `tools/probes/SnowballProbe.java` produced the heading reference numbers in the test.

## Item use
- `aed.a` ItemSnowball.onItemRightClick: take one unless Creative (`yw.d`), `random.bow` at volume 0.5 and pitch `0.4 / (rand * 0.4 + 0.8)`, spawn `zj(world, player)` server side. `random.bow` is not in this build's sound manifest, so the call is silent until the clip is imported.
- `bao.am` Minecraft.rightClickMouse swings only when a block's `onBlockActivated` consumes the click (crafting table, furnace, chest here). A throw never swings; the equip animation resets (`bly.c`, equippedProgress = 0) only when the stack changed, so Creative throws neither swing nor dip.

## Launch (`zk` EntityThrowable constructor, `zk.c` setThrowableHeading)
- Size 0.25 x 0.25, yOffset 0. Position: eye (the integrated server's `mw` reports 1.62), then x -= cos(yaw) * 0.16f, y -= 0.10000000149011612, z -= sin(yaw) * 0.16f (float `MathHelper` sin/cos tables, `yaw / 180f * 3.1415927f`).
- Motion 0.4f along the view: (-sin yaw cos pitch, -sin pitch, cos yaw cos pitch) in floats, then heading(velocity 1.5f, inaccuracy 1.0f): normalise with the float sqrt, add `Random.nextGaussian() * 0.007499999832361937 * inaccuracy` for x, y, z in that order, multiply by velocity; yaw/pitch = `(float)(atan2 * 180 / 3.1415927410125732)`.
- This build's yaw/pitch are radians: Minecraft yaw = 180 - yaw degrees, pitch = -pitch degrees.

## Per tick (`zk.h`)
1. lastTickPos = pos; `Entity.onUpdate` (previous rotation, water check, kill below y -64); ++ticksInAir.
2. `ahb.a(Vec3, Vec3)` = `func_147447_a(false, false, false)` from pos to pos + motion: the 201-step cell walk that moves the start vector to each entry point, then `Block.collisionRayTrace` (`aji.a`) using `Vec3.getIntermediateWith*` (epsilon 1.0000000116860974E-7) and `AxisAlignedBB.calculateIntercept` (`azt.a`). Air and water never collide (`canCollideCheck(meta, false)`); everything else does, with ray bounds: farmland 15/16, crops 1/4, tall grass 0.1-inset, chest 1/16-inset, torch `BlockTorch.collisionRayTrace` box `[0.4, 0, 0.4, 0.6, 0.6, 0.6]` (floats). The end of the entity sweep is the block hit.
3. Entities in `box.addCoord(motion).expand(1, 1, 1)` that `canBeCollidedWith` (not dead; dying mobs count) are tested with `box.expand(0.3f)`; the thrower is skipped while `ticksInAir < 5`; nearest wins (`d1 < d0 || d0 == 0`). A ball that starts inside an expanded box only registers it when the segment leaves through a face.
4. A hit calls `zj.a` onImpact: `attackEntityFrom(DamageSource.causeThrownDamage, 0)` (3 for blazes; none here), eight `snowballpoof` particles at the ball's position before it moves, then `setDead`.
5. Otherwise pos += motion; rotation eases 0.2 of the way to the heading (+-360 wrap loops, floats); drag 0.99f (0.8f when `isInWater`) and gravity 0.03f.
- Water test: `box.expand(0, -0.4, 0).contract(0.001)` is inverted for a 0.25-tall box, so a ball is "in water" only for water in the cell at floor(y) while frac(y) is in [0.151, 0.599).
- `inGround` is never set by 1.7.10 (the 1200-tick despawn is vestigial), so balls fly until they hit something or fall below -64.

## A 0-damage hit (`sv.a` attackEntityFrom, `yz.a`)
- Still counts unless the target is dead or `hurtResistantTime > 10`: hurt flash, hurt sound, `knockBack` away from the thrower (not along the ball's path). Health is unchanged. `EntityAnimal` sets flee 60 and clears love before `super`, even for a rejected hit. `EntityPlayer` returns false for 0 damage, so a ball that falls on its thrower is spent without effect.
- `entities.js` `attack` models the same simplified knockback; `thrownHit` copies it.

## Particles (`bju` EntityBreakingFX over `bkm` EntityFX)
- 0.2 box, yOffset 0.1; jitter `rand.nextFloat() * 3` x2, scale `(rand * 0.5 + 0.5) * 2 / 2`, life `(int)(4 / (rand * 0.9 + 0.1))`; motion `+-0.4` kick per axis rescaled to `f * 0.4` (+0.1 up). Update: age, `motionY -= 0.04`, `moveEntity`, 0.98 drag, 0.7 horizontally on the ground. Drawn as a camera-facing quad of half-size `0.1 * scale` showing a quarter-size window of the icon, light from `floor(posY - 0.1 + 0.2 * 0.66)`.
- `effects.js` bursts are block-coloured cubes and not equivalent, so particles live in `projectile-renderer.js`.

## Rendering (`bod` RenderSnowball)
Billboard of the item icon at 0.5 scale about the box's centre; normal (0, 1, 0) in the quad frame so the two item lights apply as in GL. `Render.shadowSize` stays 0: no shadow.

## Simplified or omitted
- Splash sound and the four bubbles when a ball is in water; flowing-water push (still water only).
- Blaze damage; zombies' revenge-target (none of the hit effects depend on it here).
- Saved balls restore Pos/Motion/Rotation only (vanilla also stores the vestigial in-ground fields); particles are not saved.
- Hurt sound volume follows the existing mob events (0.6).
