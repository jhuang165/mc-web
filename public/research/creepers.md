# Creepers, explosions and TNT — Minecraft Java 1.7.10

This adds three original classes: `EntityCreeper` (`xz`), `Explosion` (`agw`) and `BlockTNT` (`aob`). It also adds `EntityTNTPrimed` (`xw`) and gunpowder.

TNT is internal block 55 (original 46). Internal ids 53 and 54 are held as hidden placeholders for cactus and sugar cane, which are being added on another branch. Gunpowder is internal item 330 (original 289).

The rules are in `src/creeper.js` and `src/explosion.js`. The game wiring is in `src/entities.js`, `src/ai.js` and `src/main.js`. The renderers are `src/mob-renderer.js` and `src/tnt-renderer.js`.

## Creeper

**Entity data.** `EntityCreeper` has these values:

- Box 0.6 × 1.8 (eye 0.85 × height), 20 health and movement speed 0.25.
- A hurt sound of `mob.creeper.say` and a death sound of `mob.creeper.death`. There is no ambient sound.
- 5 XP, and `rand.nextInt(3)` gunpowder from `dropFewItems`.

**Saved fields.** Only `powered` (datawatcher 17) and `ignited` (datawatcher 18) are saved. `timeSinceIgnited` is not in the NBT, so a reloaded creeper starts its fuse again.

**Fuse.** The head of `onUpdate` does the following in order:

1. Stores `lastActiveTime`.
2. An ignited creeper sets state 1.
3. The first swelling tick plays `creeper.primed` (volume 1, pitch 0.5).
4. `timeSinceIgnited` moves by the state, with a floor of 0.
5. At the fuse of 30 it calls `world.createExplosion(this, x, y, z, 3 or 6 if powered, mobGriefing)` at its feet and is removed without drops.

**Falling.** `fall` pushes the fuse on by `distance × 1.5`, to at most 25.

**AI tasks:**

| Priority | Task |
| --- | --- |
| 1 | Swimming |
| 2 | `EntityAICreeperSwell` (mutex 1) |
| 4 | AttackOnCollide 1.0 |
| 5 | Wander 0.8 |
| 6 | Watch closest player (8) |
| 6 | Look idle |

**Targets:** nearest attackable player (priority 1, sight checked), then hurt-by (priority 2, no help).

**Swell task.** It runs while the creeper is swelling or its target is within 3 blocks (distance² < 9). Its `updateTask` releases the fuse when any of these holds:

- there is no target;
- the target is beyond 7 blocks (49);
- `EntitySenses.canSee` fails.

Otherwise it swells. It shares mutex bit 1 with AttackOnCollide, so a creeper that reaches you swells instead of hitting.

**Safe fall height.** `getMaxSafePointTries` is 3 without a target, otherwise 3 + (health − 1).

**Ignition.** Lightning powers a creeper (`onStruckByLightning`, after Entity's 5 fire damage). Flint and steel used on a creeper does the following:

- plays `fire.ignite` at its position + 0.5, pitch 0.8–1.2;
- ignites it;
- wears the item by 1, except in Creative.

**Spawning.** Creepers spawn at night through the existing zombie/skeleton/spider ring. They are capped at 3 and need grass below and a free box. They persist with the world.

### Rendering

`RenderCreeper` uses `ModelCreeper` (`bhj`) with `entity/creeper/creeper.png` (64 × 32):

- **Head:** texture (0, 0), box −4, −8, −4, size 8³, on pivot (0, 4, 0).
- **Body:** texture (16, 16), size 8 × 12 × 4, on pivot (0, 4, 0).
- **Legs:** four 4 × 6 × 4 legs, texture (0, 16), on pivots (∓2, 16, ±4) in the model's d, e, f, g order.
- **Leg swing:** `cos(swing × 0.6662 [+ π]) × 1.4 × amount` through MathHelper's sine table.

In 1.7.10 the leg pivots are at `12 + 4`, so the legs end at model y 22 and the creeper stands two pixels above the ground. This is kept as in the original.

**Swell scale.** `preRenderCallback` scales x and z by `(1 + f⁴ × 0.4) × w` and y by `(1 + f⁴ × 0.1) / w`, where:

- w = `1 + sin(f × 100) × f × 0.01`;
- f is the clamped flash intensity `(last + (t − last) × partial) / 28`.

The scale is taken about the point 1.5078 above the feet (after `RendererLivingEntity`'s flip and before its translate), so swollen feet sink a little.

**White flash.** `getColorMultiplier` draws white at alpha `(int)(f × 0.2 × 255) / 255` on frames where `(int)(f × 10)` is odd. When the creeper is also hurt, the red and white passes are folded into one mix.

**Powered shell.** A powered creeper draws `ModelCreeper(2.0F)`: every box grown by 2 pixels on each side, using `creeper_armor.png`. The texture matrix is translated by `(ticks + partial) × 0.01` on u and v, with colour 0.5, additive blending (`GL_ONE, GL_ONE`) and lighting off.

**Shadow.** Size 0.5.

## Explosion

`explosionBlocks` follows `doExplosionA`:

- It casts 16 × 16 × 16 surface rays of strength `size × (0.7 + rand × 0.6)`.
- Each 0.3 step subtracts `(resistance + 0.3) × 0.3` and 0.22500001, where resistance is `getExplosionResistance(exploder) = resistance / 5`.
- Positions are collected in a Java 8 `HashSet` (`PositionSet` reproduces the bucket order across resizes), and the list is copied in that order.

`explosionImpact` is the entity half. For each entity within `2 × size` (the float `Entity.getDistance`):

- **Damage:** `(int)((impact² + impact) / 2 × 8 × 2size + 1)`, where `impact = (1 − dist) × getBlockDensity`.
- **Push:** `impact` along the unit vector from the centre to the eyes (posY + eye height).

How each kind of entity is handled:

- **Mobs.** A source with an attacker (the creeper itself, or the TNT's placer, from `getExplosivePlacedBy`) goes through `damage` with knockback from the attacker. A source without one goes through `hazard`.
- **Items.** They take damage against their 5 health.
- **Primed TNT.** It is only pushed.
- **The player.** Treated as `EntityPlayerMP`: posY at the feet, eyes 1.62 up. The player takes armour-reduced damage at Normal difficulty. Creative players are pushed but not damaged. The push is added to the controller's velocity outside `movementTick`.

`explodeBlocks` follows `doExplosionB(false)`:

1. Plays `random.explode` (volume 4, pitch `(1 + (r − r) × 0.2) × 0.7`).
2. For each listed non-air block, in list order, runs `dropBlockAsItemWithChance(1 / size)`. TNT is skipped (`canDropFromExplosion` is false).
3. Removes the block.
4. Primes TNT through `onBlockDestroyedByExplosion`, with a fuse of `nextInt(20) + 10`.

All random draws come from one `world.rand` stream. `main.js` applies the edits through `world.set`:

- chests and furnaces spill;
- farmland and crops update;
- the scene rebuilds in one batch;
- the edits persist with the world.

`mobGriefing` is always on, and no explosion is flaming (only ghast fireballs are).

## TNT

**Block.** `BlockTNT` uses `tnt_side`, `tnt_top` and `tnt_bottom`. It has hardness 0, the grass sound and Material.tnt, which is translucent, so TNT is an opaque cube but not a normal one. Fire encouragement/flammability is 15/100.

**Crafting.** Five gunpowder and four sand in an X craft one TNT. It appears in the Redstone tab, and in Search between bricks and the bookshelf, in registry order. Gunpowder follows the feather in Materials and Search.

**Lighting it.** TNT is primed in three ways:

- **Flint and steel:** `onBlockActivated`, without sneaking with an item. It primes at the block centre with the player as placer, plays `game.tnt.primed`, sets the cell to air and wears the item.
- **Fire:** burning TNT in `BlockFire.tryCatchFire` primes with no placer.
- **Explosions:** with a chained fuse.

**EntityTNTPrimed:**

- Box 0.98, yOffset 0.49, and a Math.random 0.02 heading with 0.2 up.
- Gravity 0.04, `moveEntity` with no step height, drag 0.98, and ground friction 0.7 with a −0.5 bounce.
- `fuse-- <= 0` explodes with strength 4 at posY.
- It is saved with its position, motion and fuse. The placer is not saved.

**Rendering.** `RenderTNTPrimed` swells the block by up to 30% over the last 10 ticks. On every other 5-tick period it draws an additive white copy at `(1 − (fuse − partial + 1) / 100) × 0.8`. The shadow is size 0.5.

## Evidence

`node tools/verify-creepers.mjs` compiles `tools/probes/CreeperProbe.java` against the original 1.7.10 JAR (SHA-1 `e80d9b3bf5085002218d4be59e668bac718abbc6`) and runs these unchanged classes:

- `Explosion`, `World` and `Block`;
- `EntityCreeper` and `EntityAICreeperSwell`;
- `EntityTNTPrimed` and `BlockTNT`;
- `BlockFire`;
- `EntityLiving`, `EntityLivingBase` and `Entity`;
- `ModelCreeper`, `RenderCreeper` and `RenderTNTPrimed` (facts only).

The World subclass keeps its blocks in a map. No game class is patched.

[creeper-reference.json](creeper-reference.json) holds 625 records:

| Records | Content |
| --- | --- |
| 1 | Facts |
| 54 | Palette resistances and `canDropFromExplosion` |
| 1 | Seeded 24 × 9 × 24 fixture |
| 48 | Seeded explosions: the affected list in order, the random state after the rays, sound pitch, drops, chained TNT, XP and removed counts |
| 18 | Damage/density/knockback cases over 3–6 targets each |
| 5 | Fuse scenarios: ignite, powered, swell, swell-release, dead |
| 36 | Fall cases |
| 34 | Swell task cases |
| 3 | TNT motion runs |
| 40 | Chain fuses |
| 2 | Priming |
| 200 | Creeper drop rolls |
| 159 | Block drop tables |
| 24 | ModelCreeper poses |

`src/explosion.test.js` (9 tests) and `src/creeper.test.js` (8 tests) replay all of them, and `src/fire.test.js` checks that burnt TNT primes.

The mining, shadow and inventory references were regenerated with TNT (original 46) and gunpowder (289) mapped:

- `mining-reference.json`: 3,168 cases;
- `shadow-reference.json`: TNT takes a shadow;
- `inventory-reference.json`: 63 cases, 0 mismatches.

The creeper, explosion and fuse sounds were imported with `tools/import-vanilla-media.mjs` and keep the manifest's Mojang/Microsoft credit.

## Known gaps

- The ocelot `EntityAIAvoidEntity` task is missing (there are no ocelots).
- Missing TNT triggers and drops:
  - burning arrows do not light TNT;
  - redstone does not prime TNT;
  - music-disc drops are not implemented.
- Missing explosion effects:
  - client explosion particles (`hugeexplosion`/`largeexplode`, `explode` and `smoke`);
  - Blast Protection;
  - XP orbs and arrows are not damaged or pushed.
- Fidelity limits:
  - `HashSet` bins never treeify, which the probe showed does not happen at these sizes;
  - a mob standing exactly at the attacker's x/z gets a random knockback heading;
  - the sound range is the browser's 20-block falloff, not 64 blocks.
- Creeper spawning uses the simplified night ring, not `SpawnerAnimals`.
- The placer of a primed TNT is not saved, so TNT reloaded mid-fuse explodes without an attacker.
