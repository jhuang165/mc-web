# Block particles — Minecraft Java 1.7.10

Block particles now follow the original classes. The simplified debris in `WorldEffects.burst` (coloured cubes on a timer) is gone. `src/particles.js` has the logic and `src/particle-renderer.js` draws it. The crack overlay in `src/effects.js` is unchanged.

## What was ported

`EntityFX` (`bkm`) is the base for every particle.

- **Constructor (4 arguments).** The box is 0.2 × 0.2, with `yOffset` at half the height, so `posY` is the box centre. Colour starts at 1. `Entity.rand` then makes four draws, in this order: texture jitter x and y (`nextFloat * 3`), scale `(nextFloat * 0.5 + 0.5) * 2`, and lifetime `(int)(4 / (nextFloat * 0.9 + 0.1))` ticks, which is 4 to 40.
- **Constructor (7 arguments).** Each axis takes the given velocity plus `(float)(Math.random() * 2 - 1) * 0.4F`. The vector is rescaled to length `(Math.random() + Math.random() + 1) * 0.15F * 0.4`, and 0.1 is added upwards. That is five `Math.random` draws per particle.
- **`onUpdate`.** In order:
  1. `prevPos = pos`.
  2. The particle dies when `age++ >= maxAge`, but it still moves that tick.
  3. `motionY -= 0.04 * particleGravity`.
  4. `Entity.moveEntity`.
  5. Motion is multiplied by 0.98, and horizontal motion by a further 0.7 on the ground.
- **`moveEntity`.** The bounding box is swept along y, then x, then z against `World.getCollidingBoundingBoxes`. The position comes from the box: `posX`/`posZ` from its centre, and `posY` from its bottom plus `yOffset`. Motion is zeroed on a blocked axis, and `onGround` is set as in the original. A cobweb's `isInWeb` scales the next move by 0.25, 0.05 and 0.25 and clears the motion. A particle has no step height and no water handling, so it sinks through water.
- **`multiplyVelocity`.** x and z are multiplied by k, and y becomes `(y - 0.1) * k + 0.1`.
- **`multipleParticleScaleBy`.** `Entity.setSize` keeps the box's minimum corner. The particle's centre therefore moves on its first update; for the hit particle the shift is −0.04 on x and z.

`EntityDiggingFX` (`bld`):

- The icon is `Block.getIcon(0, meta)`, the bottom face.
- Gravity is `blockParticleGravity` (1.0 for every block in this build).
- Colour starts at 0.6 and the scale is halved.
- `applyColourMultiplier(x, y, z)` and `applyRenderColor(meta)` skip grass.

`EntityBlockDustFX` (`blc`) is `EntityDiggingFX` with the motion then set back to the given velocity. The five `Math.random` draws still happen.

`EffectRenderer` (`bkn`):

- **`addEffect`** keeps at most 4000 particles per layer and removes the oldest first.
- **`updateEffects`** updates every particle once per tick and then removes the dead ones.
- **`addBlockDestroyEffects`** makes 64 particles in a 4 × 4 × 4 grid at `(i + 0.5) / 4`. Each one moves away from the block centre and takes the block's colour multiplier.
- **`addBlockHitEffects`** makes one particle at a random point inside the block's bounds. That point is `bound + 0.1 + nextDouble * (size − 0.2)`, using `EffectRenderer.rand`. The particle is then moved to 0.1 outside the hit face (0 −y, 1 +y, 2 −z, 3 +z, 4 −x, 5 +x). It gets the colour multiplier, `multiplyVelocity(0.2)` and `multipleParticleScaleBy(0.6)`. It is called every tick that `Minecraft.sendClickBlockToController` sees the button held on a block, including Creative mode and the hit delay. A block broken that tick is already air, so it makes no particle.

`RenderGlobal` (`bma`):

- **`doSpawnParticle`** handles `blockcrack_<id>_<meta>` (an `EntityDiggingFX`) and `blockdust_<id>_<meta>` (an `EntityBlockDustFX`), each followed by `applyRenderColor`. It makes nothing when the view entity is more than 16 blocks away, or when the particle setting is Minimal. "Decreased" turns one call in three into Minimal using `World.rand`. A particle refused this way draws no `Math.random`.
- **`playAuxSFX(2006)`** is the landing dust. `d = min(0.2F + data / 15F, 10F)`, capped at 2.5, and the count is `(int)(150 * d)`: 40 particles for data 1, 70 for 4, 150 for 12 and 375 at the cap. Each particle draws an angle `randomFloatClamp(rand, 0, 2π)` and a spread `s = randomFloatClamp(rand, 0.75, 1)`. The velocity is (`cos·0.2F·s²·(d + 0.2)`, `0.2F + d / 100`, `sin·0.2F·s²·(d + 0.2)`), using `MathHelper`'s table sin and cos. Particles start at the top centre of the block. `data = ceil(fallDistance − 3)` comes from `EntityLivingBase.updateFallState`. That method only fires on landing with `fallDistance > 3`, when the block 0.2 below the feet is not air.

`Entity.onEntityUpdate` (`sa.C`) handles the sprint particle. While sprinting and not in water, it spawns one `blockcrack` per tick. In water is last tick's flag, because `handleWaterMovement` runs after this check. The block is the one at `floor(posY − 0.2 − yOffset)`. The particle starts at `posX + (nextFloat − 0.5) · width`, `minY + 0.1`, `posZ + (nextFloat − 0.5) · width`, with velocity `(−motionX · 4, 1.5, −motionZ · 4)`, before the 7-argument rescale. The draws come from the entity's own `Entity.rand`. `Entity.onUpdate` runs this before `onLivingUpdate` moves the entity, so the position and motion are the pre-move values.

`EntityDiggingFX.renderParticle` and `ActiveRenderInfo` (rendering):

- The four corners are `pos ± rotationX·s ± rotationYZ·s`, and so on, with `s = 0.1 × scale`. The position is interpolated from `prevPos` by the partial tick.
- The basis comes from the player's yaw and pitch, and is mirrored in the front F5 view.
- UVs are `getInterpolatedU/V(jitter / 4 × 16)` to `((jitter + 1) / 4 × 16)`, a 4 × 4-pixel window of the icon.
- Colour is quantised to `(int)(c × 255)`, as in `Tessellator.setColorOpaque_F`.
- Brightness is the lightmap value at `floor(posY − yOffset + height × 0.66)` (`Entity.getBrightnessForRender`).
- The layer draws after the opaque world with blending, depth writes off and an alpha test of 1/255, before water.

## Evidence and validation

`node tools/verify-particles.mjs` runs `tools/probes/ParticleProbe.java` against the unchanged classes from the 1.7.10 client JAR (SHA-1 `e80d9b3bf5085002218d4be59e668bac718abbc6`):

- `EntityFX`, `EntityDiggingFX` and `EntityBlockDustFX`
- `EffectRenderer`, `RenderGlobal`
- `Entity`, `Block`, `AxisAlignedBB`, `BlockWeb` and `BlockFarmland`

The probe runs these classes on a constructor-less `WorldClient` double. `World.getCollidingBoundingBoxes` calls each block's own `addCollisionBoxesToList`. The `Minecraft`, `GameSettings` and `RenderGlobal` instances are allocated without constructors. Small stubs stand in for `GameProfile`, `DisplayMode`, `LWJGLException` and `OpenGLException`, so that class loading succeeds. No LWJGL code runs.

[particle-reference.json](particle-reference.json) holds 25 records:

- **Block facts.** For all 90 block/metadata pairs of this build: icon name, gravity, render colour and bounds.
- **Destroy effects.** Stone, dirt in a pocket of stone and cobwebs, red wool, and ripe wheat.
- **Hit effects.** Four per side on all six sides of a floating stone, plus farmland, wheat and air.
- **Sprint particles.** Stone, grass, red wool and leaves, plus one out of range.
- **Landing dust.** Data 1, 4, 12 and 40, plus air.

Each record stores the `Math.random` state before the case and the `World.spawnParticle` calls. It also stores every new particle's fields and its `Entity.rand` state, and the position and `onGround` of every particle after each tick until it dies.

`src/particles.test.js` replays the records. Each `Entity.rand` and `Math.random` is set to its recorded internal state. The replay checks:

- the icon of every block in this build against `getIcon(0, meta)`;
- the fixed hit bounds;
- the spawn counts: 64 per destroy, 1 per hit, 1 per sprint tick, and 40, 70, 150 and 375 dust particles;
- each particle's position, motion, jitter, scale, lifetime, colour and box, to 1e-12;
- 3,814 particle-ticks of paths, to 1e-9. These include landing on stone and on farmland's full-cube collision, being slowed by cobwebs, and hit particles leaving the face.

The test also checks:

- the 16-block range, and that no `Math.random` is drawn when a particle is refused;
- the 4000 cap;
- the billboard corners, icon window, brightness cell and colour quantisation, against the bytecode formulas above.

`Tessellator` has a private constructor and an LWJGL static initialiser, so `renderParticle` itself could not be run. The rendering test checks the bytecode constants instead.

## Integration in this build

- `VoxelScene` owns `scene.particles` (a `ParticleSystem`) and `scene.particleRenderer`. `setWorld` clears them.
- `main.js` makes the calls in the original order:
  - Each tick: the sprint particle (`spawnRunningParticles`, guarded by `motion.sprinting`) just before `movementTick()`, then `scene.particles.tick(world)` after it.
  - Inside the tick: hit effects from the `tickMining` wrapper, and landing dust from `tickSurvival`'s landing branch.
  - Block breaks: `breakBlock`, a sheep eating grass, and a bucket replacing a plant call `destroyBlock`.
  - Each frame: `scene.particleView` is set to the player's yaw, pitch and front-view flag.
- The renderer is one pooled buffer of up to 4000 quads. Its vertex attributes (position, UV, colour, light) are rewritten each frame for live particles only.

## Remaining differences

- **Leaf tint.** The block atlas already bakes the biome colour into `leaves_oak` and `tallgrass`, so this build's colour multiplier is white for every block. Destroy and hit particles therefore match. A `blockcrack` or `blockdust` on leaves (sprinting on, or landing on, leaves) should use `getRenderColor` = 0x48B518. Here it uses the biome foliage colour instead.
- **Spawning between ticks.** A particle spawned between ticks, such as a Creative break from a click, is drawn once at its spawn point before its first update. In the original, `clickMouse` runs inside the tick, before `updateEffects`.
- **Landing dust timing.** In the original, landing dust is a server event that reaches the client in the next packet batch. Here it spawns in the same tick.
- **Particle setting.** The setting is fixed at "All", so there is no option UI for it.
- **Other particle types.** Block particles and the explosion/smoke families are ported (see below). Flame, splash, bubbles, crit, portal, item-break and the others keep their existing or missing implementations.
- **Collision.** There are no entity bounding boxes (boats and minecarts don't exist here). Particles use the shared `collisionBounds`, including full-cube farmland, inset cactus and ladder plates.
- **Farmland for the player.** Since 0.21.1, the player and particles both use the original full-cube farmland collision; its render/selection height remains 15/16.
- **Hit bounds.** Hit particles use this build's selection bounds (`rayBounds`), which the original's block bound fields equal after the ray trace.
- **Precision.** Floating-point arithmetic follows the bytecode's float/double widening. The billboard basis uses `MathHelper`'s sin table.


## Explosion and smoke particles (0.22)

`src/explosion-particles.js` ports `EntityExplodeFX` (bka), `EntitySmokeFX` (bkv), `EntityLargeExplodeFX` (bki) and `EntityHugeExplodeFX` (bkj). It shares the block particle collision sweep through `moveParticleEntity` and `collisionBounds`.

- Small explosion particles use the original three 0.05F motion jitters, random grayscale/scale/lifetime, 0.004 rise, 0.9F drag, animated eight-frame sprite and ground friction.
- Smoke uses the base EntityFX motion ×0.1 plus the requested motion, random dark grayscale and lifetime, 0.004 rise, 0.96F drag, the blocked-rise horizontal boost, ground friction and initial scale growth.
- Large puffs stay still for 6–9 ticks, use 15 frame transitions over the original 4×4 explosion sheet, grayscale and scale from the original constructor, and the render method's lightmap brightness 240.
- Huge emitters spawn six large puffs per tick for eight ticks, with positions `(r.nextDouble() - r.nextDouble()) * 4` and shrinking puff size. Update ordering follows EffectRenderer's sprite/emitter/custom layers.
- Client `doExplosionB(true)` emits the centre and paired small explosion/smoke calls for every affected position. Client random is separate from server ray/drop random. TNT emits smoke at posY + 0.5 until its fuse expires.

`tools/probes/ExplosionParticleProbe.java` and `tools/verify-explosion-particles.mjs` produce [41 original-class records](explosion-particles-reference.json): 32 constructor/lifetime/collision cases (four classes × eight fixtures: open, wall, ceiling, web, ground, cactus, farmland, ladder), eight client blast call sequences and a TNT fuse-smoke sequence. `src/explosion-particles.test.js` matches constructors and every tick exactly, plus checks frame/UV formulas, 48-puff emission, caps and clear. Render frames/UVs are bytecode-derived; the OpenGL renderer is not probe-run.

`VoxelScene` owns `explosionParticles` and the two-buffer `ExplosionParticleRenderer`, using the original imported sheets. The renderer uses this build's camera/light/fog pipeline. Layer caps are separate from existing block and thrown-item particle pools; full particle-setting UI and a single shared native EffectRenderer remain unfinished. No new assets were generated or imported.
