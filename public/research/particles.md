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
- **Particle setting.** Since 0.22.7 Options has the 1.7.10 Particles choice (All, Decreased, Minimal), saved in this device's settings. See "Particle options" below for what is and is not covered.
- **Other particle types.** Block particles, the explosion/smoke families and (since 0.22.8) the particles.png and item-icon kinds of existing content are ported (see below). Kinds whose content doesn't exist here (portal, note, reddust, slime, snowshovel, cloud, enchantmenttable, fireworks, footstep, instantSpell, witchMagic, mobappearance and the others) are missing.
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

`VoxelScene` owns `explosionParticles` and the two-buffer `ExplosionParticleRenderer`, using the original imported sheets. The renderer uses this build's camera/light/fog pipeline. Since 0.22.8 they live in the shared EffectRenderer pool with every other particle (see below). No new assets were generated or imported.

## Particle options (0.22.7)

`src/particle-settings.js` ports the filter at the top of `RenderGlobal.doSpawnParticle` (`bma.b`). Decreased draws `World.rand.nextInt(3)` on every call, and a zero turns that call into Minimal. The draw happens before the exemptions, so distant and exempt particles still consume it. `hugeexplosion`, `largeexplode` and `fireworksSpark` are made before the range test and ignore both the 16-block limit and Minimal. Every other kind is refused beyond 16 blocks from the view entity or on Minimal, before any `EntityFX` constructor runs, so a refused particle draws no `Math.random` or `Entity.rand`.

- The filter covers `blockcrack` (sprint), `blockdust` (landing), small `explode` and `smoke` from client explosions, TNT fuse smoke, the large puffs from huge-explosion emitters and `snowballpoof`.
- Breaking and mining-hit particles go straight to `EffectRenderer.addEffect` in the original, so no setting removes them.
- `EntityRenderer.addRainParticles` (`blt.l`) does its own count change: Decreased halves the attempts (`>> 1`) and Minimal makes none. With no splash positions, the rain loop sound is skipped too. Drops that already exist keep updating.
- One client `World.rand` (a `JavaRandom`) is shared by block dust, explosion and snowball filtering. It is client-only, separate from the saved server `World.rand`, and not saved.
- Explosion bursts and fuse smoke now go through the same filter as other particles. The old per-call distance checks in `burst` and `tickPrimedTnt` are gone.

`ParticleProbe` now also runs the unchanged `RenderGlobal.doSpawnParticle` for seven kinds × three settings × distances 0, 16 and 16.0001 × seeds 0–7. That gives 504 `setting` records in [particle-reference.json](particle-reference.json) (529 records in total), each with the accepted flag and the exact `World.rand` state after the call. No render method or GL call runs. `src/particle-settings.test.js` replays all 504 records, including random consumption. It also checks that constructors are skipped, that Minimal keeps destroy/hit particles and all 48 huge-explosion puffs even out of range, that Decreased draws once per explosion attempt, and the rain counts and sound.

In-world browser acceptance covered the Options menu, persistence and runtime state, not counts of particles on screen. 0.22.8 closes the shared pool and adds the remaining kinds for existing content (next section).

## Shared EffectRenderer and the particles.png kinds (0.22.8)

`src/effect-renderer.js` is `EffectRenderer` (`bkn`): one pool of four layers keyed by `EntityFX.getFXLayer`. Layer 0 is the particles.png sheet, 1 the block atlas (digging, block dust and the huge-explosion emitter), 2 the item atlas (`snowballpoof`, `iconcrack`) and 3 the self-drawing particles (large puffs, Crit2FX). `addEffect` caps each layer at 4000 and drops the oldest. `updateEffects` walks layers 0 to 3 by index against the live size, so a particle added during the pass gets its first update in the same tick. The F3 count covers layers 0 to 2. Block particles, explosion/smoke, thrown-item poofs and everything below share it, and `VoxelScene.effectRenderer` is ticked once per client tick. `entityFX` is the shared `EntityFX` constructor: four `Entity.rand` draws, then the `Math.random` motion kick.

`src/fx.js` (`Fx`) is `World.spawnParticle` for the other names this build spawns. It applies the RenderGlobal filter, then the original constructor and `onUpdate` of `EntityBubbleFX`, `EntitySuspendFX`, `EntityAuraFX` (depthsuspend, townaura, happyVillager), `EntityCritFX` (crit, magicCrit), `EntityCrit2FX`, `EntitySpellParticleFX` (mobSpell, mobSpellAmbient, spell), `EntityFlameFX`, `EntityLavaFX` (with its smoke trail), `EntityRainFX`/`EntitySplashFX`, `EntityHeartFX` (heart, angryVillager), `EntityDropParticleFX` (dripWater, dripLava, with the splash on landing) and `EntityBreakingFX` (`iconcrack_<item>[_<meta>]`). Also ported: render-time scale (crit, heart, flame, lava), colour alpha (ambient spells 0.15), and the flame, lava and lava-drip brightness overrides.

Spawn sites wired:

- **Water entry** (`Entity.handleWaterMovement`): the splash sound at the original volume and pitch, then 1 + width × 20 bubbles and splashes. This covers the player, mobs, arrows, snowballs and eggs. An entity's first update only marks it wet.
- **In water:** arrows and thrown items emit four bubbles per tick, and critical arrows trail four `crit` per tick.
- **Combat and mobs:**
  - A critical melee hit spawns Crit2FX: three updates of up to 16 `crit` around the target.
  - Feeding an animal gives the 7 hearts of status 18. The love countdown, mating and baby hearts are server-only `spawnParticle` calls in single player, so the client doesn't show them, and the old client hearts are gone.
  - A mob's death poof is 20 `explode` at deathTime 20.
- **Player:**
  - Drowning gives 8 bubbles at air -20.
  - Poison or Hunger swirl `mobSpell` particles in the effect colour (`PotionHelper.calcPotionLiquidColor`) half the ticks.
  - Eating throws 5 `iconcrack` crumbs every fourth tick from count 25, and 16 on finishing. The eat sound uses the original volume/pitch roll; drinks play `random.drink`.
  - A breaking tool throws 5 crumbs.
- **Bone meal:** 15 `happyVillager` sparkles up to the block's maxY (sapling 0.8, crops 0.25, otherwise 1).
- **Rain:** `EntityRainFX` drops now collide like other particles, replacing the old surface-only drop. Rain over lava makes `EntitySmokeFX` instead.
- **Display ticks** (`src/display-ticks.js`, `WorldClient.doVoidFogParticles`): each tick, 1000 cells within 15 blocks of the viewer from the client World.rand run `randomDisplayTick` with one fresh Random.
  - Torches (5 facings) and the lit furnace give smoke and flame.
  - Fire gives three `largesmoke` over a solid or burnable floor, otherwise two by each burnable neighbour, plus the 1-in-24 `fire.fire` crackle. This replaces `Fire.ambient`.
  - Water gives `suspended` in still or falling cells and the `liquid.water` gurgle in flowing ones.
  - Lava under air gives `lava` pops with `liquid.lavapop`, plus `liquid.lava`.
  - Water and lava drip below a stone-topped ceiling.
  - Leaves drip while raining.
  - Air below y 8 rolls the void-fog `depthsuspend`.
  - The three liquid sounds were imported with their asset-index hashes (203 clips).

`tools/probes/FxProbe.java` (extending ParticleProbe) and `tools/verify-fx.mjs` write [79 original-class records](fx-reference.json) (88 since 0.22.9):

- 31 constructors through `RenderGlobal.doSpawnParticle`, with every update until death or 140 ticks, in five fixtures (open, water pool, ceiling, lava pool, high ceiling). The Math.random and rewound Entity.rand states are recorded.
- Crit2FX.
- Five water entries, including the first-update skip.
- Feeding hearts and the death poof.
- 15 potion runs: five effect sets × normal, ambient and the player yOffset, 40 ticks each.
- Four crumb rotations.
- Four bone-meal blocks.
- 14 display-tick scenarios with 1,602 seeded runs, including calls, sounds and the Random state after each.
- Three void-fog loops.

`src/fx.test.js` replays them all exactly. The exception is gaussian velocities (hearts, death poof, bone meal), which are compared within 1e-16, because `JavaRandom.nextGaussian` uses `Math.log` where Java has `StrictMath.log`. The replay exposed and fixed the ambient-potion roll: Java's `&=` draws `nextInt(5)` even when the first roll failed. The browser check (scratch world, audio off) covered feeding hearts, the death poof, Crit2FX crits, potion swirls in the Hunger colour and bone-meal sparkles, rendered through the shared pool with no console errors.

## 0.22.9

- **Player death poof.** The client player never runs `EntityPlayer.onDeath` (only the server copy shrinks to 0.2), so it stays 0.6 × 1.8. On the death screen `EntityLivingBase.onDeathUpdate` counts `deathTime`; at 20 it spawns 20 `explode` from the eye position. While dead only that counter and the particle pool tick, and the camera rolls by `EntityRenderer.hurtCameraEffect`'s 40 − 8000 / (deathTime + partial + 200) degrees.
- **Player water test.** Entering water and swimming now use `handleMaterialAcceleration` on the contracted box (the same test as mobs) instead of the cell at feet + 0.6. Air and the underwater dig penalty use `Entity.isInsideOfMaterial(water)` at the eye: the eye's cell must be water and the eye below (j + 1) − (percent(meta) − 1/9). Air uses EntityPlayerMP's 1.62 eye above the feet; mining uses the client eye.
- **Mob air.** Mobs breathe like `EntityLivingBase.onEntityUpdate`: with the eye (height × 0.85) inside water the air counts down from 300 without Respiration; at −20 it is set to 0, eight bubbles spawn around the feet with the mob's motion, and the mob takes 2 drowning damage. Out of water it resets to 300.
- **Living sounds.** The 160-tick mob sound timer is replaced by `EntityLiving`'s roll: each tick `nextInt(1000) < livingSoundTime++` plays the living sound and resets the counter to −80 (hostile) or −120 (animals). Cows play at 0.4 volume; pitch is (rand − rand) × 0.2 + 1, or + 1.5 for babies. Creepers roll and reset but have no sound. The roll draws from the entity Random every tick, which the drowning replay needs.
- **Leaves drip.** The display tick now gets `World.canLightningStrikeAt` for the cell above, and the probe runs it.

FxProbe adds three leaves cases (rain, rain over stone, dry; 420 seeded runs), five `isInsideOfMaterial` sweeps over water levels 0, 1, 3, 7 and 8, and a 25-tick drowning run of `EntityLiving.onEntityUpdate` with `attackEntityFrom` recorded: 88 records, all replayed. Browser check (scratch world, audio stubbed): a pig sealed under water counted down, bubbled and lost 2 health at −20; the player sank with swim physics in a pool; on death the camera rolled and 17 particles became 34 at deathTime 20; respawn reset the roll. No console errors.

Still open:

- Mob potion effects: nothing in this build gives mobs effects, so they have no swirls.
- GL drawing formulas (billboards, UV inset, brightness) come from bytecode, not from a probe run.
- Particles spawned between ticks are drawn once before their first update.
