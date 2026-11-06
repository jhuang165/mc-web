# Mob spawners and cave spiders: Minecraft Java 1.7.10

This page covers four original classes:

- `MobSpawnerBaseLogic` (`agq`), run by `TileEntityMobSpawner` (`apj`, logic `apk`)
- `EntityCaveSpider` (`xy`)
- `RenderCaveSpider` (`bnf`)
- `TileEntityMobSpawnerRenderer` (`bmp`)

It does not claim full parity. The gaps are listed at the end.

The code lives in these files:

- **Rules:** `src/mob-spawner.js`, which is headless and has no imports.
- **Cave spider:** `src/entities.js` (`ENTITY_TYPES.cave_spider`, `onSpawnWithEgg`, `spawnerHooks`) and `src/spider.js` (`isSpider`, `soundType`, `caveSpiderPoisonTicks`).
- **Rendering:** `src/mob-renderer.js`.
- **Native evidence:** `tools/probes/MobSpawnerProbe.java` and `tools/verify-mob-spawner.mjs`. They write `public/research/mob-spawner-reference.json`.
- **Replay tests:** `src/mob-spawner.test.js` and `src/cave-spider.test.js`.

## Spawner logic

**Defaults** (before NBT is read):

| Field | Value |
| --- | --- |
| `spawnDelay` | 20 |
| `minSpawnDelay` | 200 |
| `maxSpawnDelay` | 800 |
| `spawnCount` | 4 |
| `maxNearbyEntities` | 6 |
| `requiredPlayerRange` | 16 |
| `spawnRange` | 4 |

**Activation.** The test is `World.getClosestPlayer(x + .5, y + .5, z + .5, 16)`, and it is strict: a player at exactly 16 is ignored and one at 15.99 activates the spawner. On the server a player's position is the feet. On the client it is the eye: `EntityClientPlayerMP` has `posY` = feet + 1.62.

**Server tick**, in this order:

1. A delay of -1 is reset.
2. A positive delay counts down and the tick returns.
3. Each of the 4 attempts does the following:
   1. EntityList creates the mob. An unknown `EntityId` returns at once: no rolls and no reset.
   2. It counts `getEntitiesWithinAABB(mob.getClass(), box)`. The box is `[x-8, y-4, z-8, x+9, y+5, z+9]`, tested with strict `intersectsWith` and `isAssignableFrom`. A Spider spawner therefore counts cave spiders, but a CaveSpider spawner does not count spiders. A count of 6 or more resets the timer and returns.
   3. It rolls the position: `x + (nextDouble - nextDouble) * 4`, then `y + nextInt(3) - 1`, then `z + ...`. The position is relative to the block corner, not the centre.
   4. It rolls `yaw = nextFloat * 360`.
   5. If `getCanSpawnHere` passes: `onSpawnWithEgg(null)`, `spawnEntityInWorld`, `playAuxSFX(2004, x, y, z, 0)` and `spawnExplosionParticle`.
4. Any spawn resets the timer.

**Timer reset.** The new delay is `min + nextInt(max - min)`, followed by `addBlockEvent(spawner, 1, 0)`. On the client, that event sets the delay to `minSpawnDelay`.

**Client tick.** Each tick does the following:

1. Spawns one smoke and one flame particle at `(float)x + nextFloat`, and likewise for y and z.
2. Decrements the delay.
3. Sets `prev = rot`.
4. Sets `rot = (rot + (double)(1000f / (delay + 200f))) % 360`.

**`getCanSpawnHere` for a monster.** The checks run at the floored `posX`, `minY` and `posZ`:

1. The difficulty must not be Peaceful.
2. `savedSky > entityRand.nextInt(32)` fails.
3. The block light value (read with `skylightSubtracted` 10 while `isThundering`) must be at most `entityRand.nextInt(8)`.
4. `checkNoEntityCollision` must pass. Living mobs, the player, minecarts and boats block a spawn.
5. There must be no colliding block or entity collision boxes. The spawner block itself is a full cube.
6. `isAnyLiquid` must be false.
7. `0.5 - getLightBrightness >= 0`. In floats, brightness 12 is 0.50000006, so this check passes at light 11 and below.

Animals use `EntityAnimal`'s rule: grass below, full light above 8, then the same collision checks.

**NBT.** The fields are `EntityId`, `Delay`, `MinSpawnDelay`, `MaxSpawnDelay`, `SpawnCount`, `MaxNearbyEntities`, `RequiredPlayerRange` and `SpawnRange`, all stored as shorts. `readFromNBT` reads them in groups:

- `MinSpawnDelay` brings `MaxSpawnDelay` and `SpawnCount`.
- `MaxNearbyEntities` brings `RequiredPlayerRange`.
- `SpawnRange` is read on its own.

**Random streams.** Each part of the logic draws from a different stream:

| Logic | Original stream | Port stream |
| --- | --- | --- |
| Server branch | `World.rand` | `weather.random` (pass it as `ctx.random`) |
| Client branch | `WorldClient.rand` | `scene.explosionParticles.worldRandom` |
| `getCanSpawnHere` | The new mob's `Entity.rand` | `entityRandom(mob)` |
| `onSpawnWithEgg` for a Spider | `World.rand` (1 draw on Normal) | `World.rand` |
| `onSpawnWithEgg` for a CaveSpider | None | None |

## Cave spider

- **Size and stats:** 0.7 × 0.5 and 12 health. Speed 0.8, damage 2 and follow range 16 are inherited.
- **Inherited behaviour:** the legacy AI (`spiderThink`), climbing, web immunity, the `mob.spider.*` sounds, string and spider eye drops, and 5 XP. The melee height test uses the cave spider's own height of 0.5.
- **Poison:** `attackEntityAsMob` applies Poison with amplifier 0 after a successful hit. It lasts 140 ticks on Normal and 300 ticks on Hard. Easy and Peaceful apply nothing.
- **Spawn rolls:** `onSpawnWithEgg` returns its argument without calling super. There is no follow-range roll, no jockey roll and no effect (that is the original's `EntityLiving` base; subclasses add their own, see [mob-riding](mob-riding.md)).
- **Spawning:** spawners only. Natural spawning never produces a cave spider.
- **Rendering:** `cave_spider.png` with a 0.7 model scale. The shadow is `1.0 * 0.7`, and the eye pass is the spider's.

## Spawner renderer

The display mob is the logic's cached entity, which is never ticked. Its transform is built in this order:

1. `translate(x+.5, y, z+.5)`
2. `translate(0, .4, 0)`
3. `rotateY((prev + (rot-prev)*partial) * 10)`
4. `rotateX(-30)`
5. `translate(0, -.4, 0)`
6. `scale(.4375)`

The mob is then drawn with yaw 0 and the spawner block's lightmap.

`spawnerMobMatrix(s, partial)` returns this transform as a column-major 4×4. `spawnerDisplayEntity(s, partial)` returns an entity for `MobRenderer.update`, which honours `displayMatrix` and `lightPos`.

## Evidence

The probe runs the unchanged classes against the 1.7.10 client JAR (SHA-1 `e80d9b3b…`). It uses a world double, an LCG exposing the `World.rand` state, and a seeded `EntityCaveSpider` subclass that only logs `getCanSpawnHere`. Class SHA-256 values are listed in the reference.

The reference holds 33 records:

- **1 facts record.**
- **8 poison records:** difficulties 0 to 3, for the cave spider and the spider.
- **2 egg records.**
- **22 scenarios.** Their names describe them:
  - Dark open floor.
  - A player at 16 and at 15.99.
  - No player.
  - Light 15, block light 4 and sky light 15.
  - Crowded with 6, edge touching, edge overlapping, and 6 spiders not counted.
  - Encased in stone, and water.
  - Peaceful and Easy.
  - The real classes: plain, crowded on Hard, a Spider spawner counting cave spiders, and a Spider spawner.
  - An unknown id.
  - The client (with a block event at tick 120), and the client out of range.

The tests replay every tick exactly:

- The delay.
- The `World.rand` state and draw count.
- Each AABB query and its count.
- Each `getCanSpawnHere` attempt: its seed, position, yaw and result.
- The spawned positions.
- Aux 2004 and block events.
- The client rotation, previous rotation and particles.
- The NBT after the run.

The render constants are checked from the `bnf` and `bmp` bytecode, because the probe does not load LWJGL.

## Gaps

- `SpawnPotentials` and `SpawnData` are not supported, including their weighted roll and custom NBT. No generator here writes them.
- A spawner can only spawn entity types the port has: `CaveSpider`, `Spider`, `Zombie`, `Skeleton`, `Creeper`, `Pig`, `Cow`, `Sheep` and `Chicken`.
- `createMob` refuses a mob beyond the 40-mob save cap. The attempt's rolls are still spent, but nothing spawns.
- If no `ctx.blockEvent` is supplied, the client delay reset is applied in the same tick. The original sends it with about one tick of latency.
- Spider and chicken jockeys now spawn through `onSpawnWithEgg`, natural and spawner alike; see [mob-riding](mob-riding.md).
- The display mob's random head yaw is not reproduced. In the original it is `Math.random() * 2π` degrees.
- The thunder light branch is covered only by a unit test, not by a native scenario.
- Boats and minecarts block a spawn only through the `extraCollision` hook.
