# Bows, arrows and skeletons (ItemBow, EntityArrow, EntitySkeleton)

Ported from the unchanged 1.7.10 classes with `javap` (names are the obfuscated ones from `joined-1.7.10.srg`). Code: `src/bow.js` (bow release, arrow entity, skeleton shot), `src/arrow-renderer.js` (RenderArrow), `src/ai.js` (ArrowAttack, RestrictSun, FleeSun), `src/entities.js` (skeleton entry, drops, spawning, sunburn), `src/mob-renderer.js` (ModelSkeleton), `src/first-person*.js` and `src/player-renderer.js` (held bow), hooks in `main.js` and `scene.js`. Tests: `src/bow.test.js`. Evidence: `public/research/bow-reference.json`, written by `tools/verify-bow.mjs` from `tools/probes/BowProbe.java`.

## Evidence

`bow-reference.json` records the unchanged `zc` (EntityArrow) running in a JVM: 120 seeded `setThrowableHeading` cases, 41 skeleton-constructor cases (`zc(world, shooter, target, velocity, inaccuracy)` on constructor-less `yl` doubles), 144 player-constructor cases (`zc(world, shooter, power)`; the shooter is a `yl` double whose eye height is the 1.62 of `mw.g`, because `EntityPlayer` needs authlib and netty to load) and eight `onUpdate` flights (air, fast, lob, water, wall, slow wall, floor, and a 1,200-tick despawn) in a hand-built block world, with the position, motion, rotation, stuck state, shake and tile after every tick (ticks 1-6 and 1198 on for the long run). `src/bow.test.js` replays all of it through `src/bow.js` (headings to 1e-12 and float-exact angles; flights to 1e-9 with float-exact rotation). The file also stores the SHA-256 of every original class the port was read from and the client JAR's SHA-1.

| Class | Name | Used for |
| --- | --- | --- |
| `zc` | EntityArrow | launch, onUpdate, hit, pickup, NBT (probed) |
| `abm` | ItemBow | release power, use duration, sound, durability (bytecode only) |
| `yl` | EntitySkeleton | stats, sunburn, bow shot, drops, sounds (bytecode only) |
| `vd` | EntityAIArrowAttack | shot timer, range, power (bytecode only) |
| `vf`, `ue` | EntityAIRestrictSun, EntityAIFleeSun | daylight behaviour (bytecode only) |
| `bly` | ItemRenderer | first-person bow pull transform (bytecode only) |
| `blk` | EntityPlayerSP | FOV multiplier (bytecode only) |
| `bnb`, `bic`, `bos` | RenderArrow, ModelSkeleton, RenderSkeleton | models and textures (bytecode only) |

Pieces marked "bytecode only" were read from the disassembly and are checked in `bow.test.js` against hand-derived values, not against a running original.

## ItemBow (`abm`)
- Hold use to draw (`getMaxItemUseDuration` 72000, `EnumAction.bow`). It starts only in Creative or with an arrow in the inventory.
- Release (`onPlayerStoppedUsing`): `t` = ticks drawn, `f = t / 20`, `f = (f * f + f * 2) / 3` in floats. Below 0.1 nothing happens (3 ticks is the shortest shot); capped at 1. The arrow is `zc(world, player, f * 2)`; at `f == 1` it is critical. The bow loses 1 durability (384), `random.bow` plays at volume 1 and pitch `1 / (itemRand * 0.4 + 1.2) + f * 0.5`, and in Survival one arrow is taken (Creative arrows have pickup mode 2: they can be collected in Creative only, giving nothing).
- Icons: `bow_standby`, then `bow_pulling_0` (ticks > 0), `_1` (> 13), `_2` (>= 18).
- FOV: `EntityPlayerSP.getFOVMultiplier` takes `1 - (t / 20)^2 * 0.15` (t / 20 capped at 1), eased every tick `cur += (target - cur) * 0.5`, clamped to [0.1, 1.5] and interpolated by the partial tick. Sprint and flight FOV terms are not ported.
- First person (`bly.a`): after `scale(0.4)`, `rotate(-18, z)`, `rotate(-12, y)`, `rotate(-8, x)`, `translate(-0.9, 0.2, 0)`; with `f18 = ticks - 1 + partial` and the pull as above, a wobble `translate(0, sin((f18 - 0.1) * 1.3) * 0.01 * (pull - 0.1), 0)` once pull > 0.1, `translate(0, 0, pull * 0.1)` and a z stretch of `1 + pull * 0.2` about the bow's middle. `bow_pulling_*` textures swap with the stage.
- Third person: the held bow uses the `RenderPlayer` bow transform (`translate(-0.0625, 0.4375, 0.0625)`, `translate(0, 0.125, 0.3125)`, `rotate(-20, y)`, `scale(0.625, -0.625, 0.625)`, `rotate(-100, x)`, `rotate(45, y)`).

## EntityArrow (`zc`)
- Size 0.5 x 0.5, yOffset 0. Player arrow: eye (1.62), 0.16 to the side, 0.1 down, aimed along the view and sent through `setThrowableHeading(velocity = power * 1.5, inaccuracy = 1)`; mob arrow: shooter eye (`height * 0.85`) minus 0.1, one block towards the target, aimed at a third of the target's height with a lob of 0.2 x the horizontal distance (`zc` constructor; returns when the horizontal distance is below 1e-7).
- `setThrowableHeading`: normalise with the float sqrt, add `nextGaussian() * (nextBoolean() ? -1 : 1) * 0.0075 * inaccuracy` per axis (gaussian before boolean), scale by velocity.
- `onUpdate`: previous position and angles, water/fire/lava, the stuck check (the block it stuck in must still contain the arrow's point), shake countdown. Stuck arrows count `ticksInGround` and die at 1200; if the block changed the arrow drops with `rand * 0.2` of its motion. Flying arrows trace `world.func_147447_a(pos, pos + motion, false, true, false)` (blocks with a collision box only), then sweep entities in the swept box grown by 1 with a 0.3 grown box; the shooter is skipped for the first five ticks; nearest wins.
- Entity hit: damage `ceil(speed * damage)` (2 base), plus `nextInt(damage / 2 + 2)` when critical; a burning arrow sets the target on fire for 5 s; the arrow is used up with `random.bowhit` (pitch `1.2 / (rand * 0.2 + 0.9)`). A hit that deals no damage (hurt cooldown) bounces the arrow back at a tenth of its speed. Players in Creative are never hit (`disableDamage` drops the whole hit, block included).
- Block hit: motion becomes the vector to the hit, the arrow backs off 0.05 along it, shake 7, `random.bowhit`, the crit flag clears.
- Rotation eases a fifth of the way to the heading with the +-360 wrap loops, drag 0.99 (0.8 in water), gravity 0.05.
- Pickup (`onCollideWithPlayer`, player box grown by 1 / 0.5 / 1, after the shake): mode 1 gives an arrow when it fits, mode 2 only in Creative; `random.pop` at 0.2. Skeleton arrows (mode 0) cannot be collected.
- Saved: tile, inTile, inData, shake, inGround, pickup, life, damage and base Entity data, up to 300 arrows. The shooter and the critical flag are not saved, as in NBT.
- `RenderArrow`: `arrow.png`, two tail plates and four shaft quads (36 vertices), `rotate(prevYaw lerp - 90, y)`, `rotate(prevPitch lerp, z)`, the shake term, `rotate(45, x)`, `scale(0.05625)`; no shadow; lit at y + 0.33.

## EntitySkeleton (`yl`)
- 0.6 x 1.8, 20 health, speed 0.25, spawns at night with zombies (this build: own 240-tick clock, cap 3, grass ring at 24 blocks), holds a bow, drops `nextInt(3)` arrows then `nextInt(3)` bones, 5 XP, `mob.skeleton.say/hurt/death` sounds (the clips are imported; `mob.skeleton.step` is not played).
- AI (`yl` constructor / `setCombatTask`): Swim 1, RestrictSun 2, FleeSun 3 (speed 1), ArrowAttack 4 (speed 1, min 20, max 60, range 15), Wander 5, WatchClosest 6 (8 blocks), LookIdle 6; targets HurtByTarget 1 (no call for help), NearestAttackableTarget 2 (player).
- ArrowAttack (`vd`, mutex 3): moves towards the target until it has seen it for 20 ticks within range, looks at it, and when the timer hits 0 shoots if the target is in range and seen; power is distance / range clamped to [0.1, 1]; the next shot is `floor(distance / range * (max - min) + min)` ticks away.
- Shot (`attackEntityWithRangedAttack`): velocity 1.6, inaccuracy `14 - difficulty * 4` (6 on Normal), damage `power * 2 + nextGaussian * 0.25 + difficulty * 0.11` drawn from the skeleton's own random before the sound pitch `1 / (rand * 0.4 + 0.8)`. The damage is a projectile source: not scaled by difficulty, armour still applies.
- Daylight: RestrictSun sets the navigator to avoid sky-lit cells; FleeSun for a burning skeleton under open sky tries ten cells within +-10 / -3..+2 / +-10 for one that cannot see the sky and has a negative path weight; `onLivingUpdate` sets the skeleton on fire for 8 s with chance `(brightness - 0.4) * 2 / 30` per tick when the brightness is above 0.5 and it can see the sky (no helmet). Water or rain puts it out.
- Despawn rules and `getBlockPathWeight` are the zombie's (`EntityMob`).
- Model (`bic`): the zombie model's proportions with 2-wide arms and legs (`skeleton.png`, 64 x 32), arms raised like the zombie's, the bow drawn in the right hand with the player's held-bow transform.

## Gaps
- Version 0.18 adds [spiders](spiders.md) as a Survival string source, making the bow recipe obtainable.
- No critical-hit particles, no water bubbles from arrows, no arrow-in-body display and no pickup fly-to animation (`onItemPickup`).
- No third-person drawing pose (`aimedBow` arm raise) or use-stage icon in third person.
- No Power, Punch or Flame enchantments (the bow cannot be enchanted here); arrows deal no knockback to the player; Knockback from `knockback > 0` is ported for mobs but unreachable.
- No skeleton armour or helmet, no wither skeletons, no spider jockeys, no skeleton step sounds, no skeleton-vs-mob targeting.
- Skeletons spawn on a simplified clock and ring, already holding a bow; the zombie's sunburn remains the earlier approximation while the skeleton's follows `yl.e`.
- Difficulty is fixed at Normal (2); hit and damage paths, `ItemBow`, `EntitySkeleton` and the AI timers are not run against the original class, only derived from its bytecode.


## Explosion knockback (0.21.6)

Arrows now receive `Explosion.doExplosionA` knockback, including while embedded. Damage is ignored by the inherited `Entity.attackEntityFrom`, but the push still applies. Their blast direction uses posY at the box bottom with `Entity.getEyeHeight = 0`. The existing arrow tick releases an embedded arrow only when its block changes; the blast does not reset shake, pickup rules or embedded state. See [non-living entity blast evidence](creepers.md) (72 original arrow targets among 216 non-living targets).
