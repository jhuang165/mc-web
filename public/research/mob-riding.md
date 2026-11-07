# Mob riding, jockeys and door breaking

A mob can ride another mob: a skeleton on a spider (a spider jockey), a baby zombie on a chicken (a chicken jockey). Zombies that carry the break-door task lean on a closed wooden door and, on Hard, remove it. This is Minecraft Java 1.7.10 behaviour, not later versions, and it does not claim full parity: see Gaps.

## Evidence

`tools/probes/MobRidingProbe.java` and `tools/verify-mob-riding.mjs` run the unchanged 1.7.10 classes (`Entity` sa, `EntityLivingBase` sv, `EntityLiving` sw, `EntitySpider` yn, `EntityZombie` yq, `EntitySkeleton` yl, `EntityChicken` wg, `EntityAIBreakDoor` tz, `EntityAIDoorInteract` uc) and write [mob-riding-reference.json](mob-riding-reference.json): 1,683 records with the client jar's SHA-1 and each class's sha256. `src/mob-riding.test.js` and `src/zombie-door.test.js` replay every record. Run it with `MC_RESEARCH=<tools/research> node tools/verify-mob-riding.mjs` (needs a JDK).

| Case | Records | What is checked |
| --- | --- | --- |
| seat | 72 | the rider's position after `updateRiderPosition`: spider, cave spider, chicken (at six body yaws) and zombie as a mount, skeleton and zombie (adult and child) as riders; the rider's body yaw |
| dismount | 72 | `mountEntity(null)`: the rider stands at the mount's x, minY + height, z with its own yaw and pitch |
| cycle, remount | 2 | a mount the rider already carries is refused; a second `mountEntity` releases the first mount |
| chicken | 8 | `IsChickenJockey`, experience (10 for a jockey), `canDespawn` (a jockey nobody rides), egg laying, the NBT tag |
| chickenRead | 1 | reading `IsChickenJockey` |
| spiderJockey, spiderJockeyCount | 291, 3 | `EntitySpider.onSpawnWithEgg(null)` per seed and difficulty: the rider (mounted, position, yaw, pitch) and the next value of World.rand; 57 riders in 6,000 seeds at each difficulty |
| chickenJockey | 1,200 | a child `EntityZombie.onSpawnWithEgg` (group data forced to a child) with no chicken, one free chicken, and one chicken that is already ridden: who mounts, the new chicken's place, yaw and age, both random streams afterwards |
| canBreakDoors | 1 | the `CanBreakDoors` tag round trip |
| breakDoor | 32 | `EntityAIBreakDoor` shouldExecute, then continueExecuting and updateTask for each tick against a wooden door: start, tick count, counter, every crack stage, aux effects 1010, 1012 and 2001 and the block removal, per difficulty (0 to 3) and seed, plus a zombie that has not collided and one with no path |
| griefing | 1 | gamerule `mobGriefing` false: the task does not start |

## Riding

- A mount and its rider are two ordinary mobs. The runtime joins them with non-enumerable references (`ridingEntity` on the rider, `riddenBy` on the mount) in `src/mob-riding.js`; `mountEntity` follows `Entity.mountEntity`, cycle check included.
- Seat: `mount.y + height * 0.75 + rider.getYOffset()`. A skeleton's `getYOffset` is -0.5, a zombie's 0. Neither spider overrides `getMountedYOffset`. A chicken seats the rider at `(x + 0.1F sin, y + height * 0.5F + yOffset, z - 0.1F cos)` from its body yaw and gives a living rider its body yaw. The reference matches to the last bit.
- Tick order: the mount updates, then its rider (`ridingOrder`). The rider's tick runs the AI only (a skeleton still shoots, a zombie still decides who to chase); its own movement does not run and its motion is zeroed. After the tick the seat snaps the position and the rider turns half way (at most 10 degrees a tick) with the mount's yaw and pitch change, as `Entity.updateRidden` does.
- A rider and its mount do not push each other. Damage, knockback and fire apply to each separately, as natively.
- A dead mob frees its rider where it sits, after the death animation (`isDead`); a mount that leaves the world does the same.
- A zombie on a chicken that has a target hands its path to the chicken at speed 1.5 each tick (`EntityZombie.onLivingUpdate`); the navigator treats it as able to navigate off the ground. A rider skeleton or zombie draws its legs raised (`ModelBiped.isRiding`).
- Saving: a rider's record has `riding`, its mount's mob id; loading rebuilds the pair and drops an id nothing carries (a full serialize and reload restores the pair and seating, `mob-riding-nbt.test.js`).
- Region interchange (bytecode-read, `sa.e`/`sa.c`/`sa.d` and `AnvilChunkLoader.loadEntities`): `Entity.writeToNBT` nests the mount as a `Riding` compound inside its rider (`writeMountToNBT` writes it whatever rides it), and `writeToNBTOptional` returns false for a mob that has a rider, so a chunk lists only the top rider of each chain; a rider-ridden mount is never a chunk entity of its own. Export does exactly that (`region-export.js`: mounts are nested, chains of any length, cycles cut). Import reads a chunk entity, then each nested `Riding` compound as another mount (the loader's `mountEntity(mount)` chain), and rebuilds a linked pair of records (`riding` = the mount's generated id). A mount that is not an importable mob is counted as lost and its rider stays unmounted. Players riding mobs are not in chunks (the player's own NBT holds the pair), so player-ridden mounts are not exported.
- Dismount rules (bytecode-read): `EntityLivingBase.onEntityUpdate` (`sv.C`) ends its water block with `isRiding() && ridingEntity instanceof EntityLivingBase -> mountEntity(null)`, so a rider whose head is in water steps off onto the mount's top (`EntityWorld.breathe`). `World.updateEntities` (`ahb.h`) and `updateEntityWithOptionalForce` (`ahb.a`) let go of a mount or rider that is dead or no longer linked, on both sides (`releaseDead`); `setDead` itself dismounts nothing. `World.removeEntity` (`ahb.e`) calls `mountEntity(null)` on both the rider and the mount before `setDead`.
- Falls: `Entity.fall` hands the mount's fall to its rider, so a skeleton on a spider takes the same fall damage as a mob (`EntityWorld.fall`), and the player on a pig takes it with Jump Boost and the fall sounds.

## Jockey spawns

- **Spider jockey.** `EntitySpider.onSpawnWithEgg` rolls `World.rand.nextInt(100) == 0` before the Hard potion effect. A skeleton appears at the spider's place and yaw (pitch 0), runs its own `onSpawnWithEgg`, is spawned, then mounted. In the Nether it takes the original's wither-skeleton roll. The cave spider's override has no jockey. The rider's gear is replayed from the native `Random` state: `InterchangeProbe` reads the unseeded skeleton Random through `Unsafe`, runs the LCG backwards by the drawn count and replays `onSpawnWithEgg` with a counting Random subclass (171 jockeys recovered, 0 failures); `src/interchange.test.js` replays the gear, drop chances, loot and next draw.
- **Chicken jockey.** A child zombie rolls 5 %: the first free chicken (alive, nobody riding it) in the zombie's box grown by 5, 3, 5 becomes a jockey and is mounted; with no chicken in range nothing else happens. Otherwise 5 % more: a new chicken at the zombie's place and yaw, its own `onSpawnWithEgg`, flagged as a jockey, spawned and mounted.
- A chicken jockey lays no eggs (the egg timer does not run), gives 10 experience with no random draw, and despawns by the normal rules only while nobody rides it. The flag is saved as `chickenJockey`.

## Door breaking

- `EntityAIBreakDoor` is the zombie's priority 1 task. `setBreakDoorsAItask(true)` adds it at the end of the list; `false` removes it. A zombie gets it from the `CanBreakDoors` roll (`rand.nextFloat() < local difficulty * 0.1`, drawn after the chicken roll) or by being a leader zombie. The flag is saved as `canBreakDoors`. The constructor lets the navigator path through closed doors for every zombie.
- Start: the zombie collided horizontally, has a path that is not finished, and a closed wooden door lies at the head-level cell of one of the next two path points within 1.5 blocks (or at its own cell); gamerule `mobGriefing` is on. Iron doors are never targets.
- Run: while the counter is at most 240, the door stays closed and the zombie is within 2 blocks of the cell. Each tick: a 1 in 20 roll on `Entity.rand` plays aux 1010 (`mob.zombie.wood`); the counter rises; every tenth of 240 is a crack stage (0 to 10, drawn with the mining overlay, one per breaker, expiring after 400 ticks). When the counter reaches 240 on Hard, the block becomes air, aux 1012 (`mob.zombie.woodbreak`) and 2001 (block break sound and particles) follow. The door's other half goes through the usual door neighbour rules: found at head height (the upper half), the lower half comes off as an item. On Easy and Normal nothing breaks and the cycle starts again.
- Aux sounds play at volume 2 with pitch `(r - r) * 0.2 + 1` from the client random, as the wither's block breaking does.

## Leader zombies

`zombieSpawnRolls` already draws the leader (5 % of local difficulty): reinforcement chance plus 0.5 to 0.75, and a max-health bonus of 1 to 4 times (a multiplying modifier on 20). The reinforcement bonus was live; now the max health is kept as `maxHealth` (saved, validated, up to 2048) and used where a mob's cap matters (loading a record, the regeneration clamp). The spawn does not set the health, as in the original: a leader starts at 20 of a larger maximum. Batch 20 stores the bonus as the native AttributeModifier ("Leader zombie bonus", operation 2 on generic.maxHealth, amount 1 to 4; operation 0 on zombie.spawnReinforcements) in `e.modifiers`, written to and read from the `Attributes` NBT list for zombies and zombie pigmen (probed: `interchange-reference.json`, 72 leader records; the read-back max health equals the written value and health stays 20). The Random spawn bonus modifiers (knockback, follow range) are stored too; the baby speed boost stays the baby flag. Leaders also break doors. The Hard reinforcement itself (`attackEntityFrom`, 50 tries, charge of -0.05 on both zombies) was already live; see [difficulty](difficulty.md).

## Batch 18: saved flag and interchange

`CanBreakDoors` is now written to Java region exports from the zombie's break-door flag (it was always 0) and read back on import and `/summon` (`setBreakDoorsAItask(tag.getBoolean("CanBreakDoors"))`), so rolled and leader zombies keep the door task across interchange (`java-mobs.test.js`). The break timing, the Hard-only removal, the 1/20 `mob.zombie.wood` roll, the crack stages and the aux events 1010, 1012 and 2001 were already probed above (32 records); the task never breaks iron doors. Pigmen run the same `EntityZombie.onSpawnWithEgg` roll natively (the draw is consumed here) and, as of batch 19, store the flag and export it (see below); the task itself never runs on them natively.

## Batch 19: pigmen and the walking zombie

`EntityPigZombie` (`yh`) extends `EntityZombie`: `yh.a(sy)` runs `yq.a(sy)` (the same CanBreakDoors roll and leader bonus) and then `setVillager(false)`, and `yq.a(dh)` / `yq.b(dh)` read and write `CanBreakDoors` for it. But `yh.bk()` (isAIEnabled) returns false, and `EntityLivingBase.onLivingUpdate` only calls `updateAITasks` when `bk()` is true, so no `EntityAI*` task, the break-door task included, ever runs on a pigman. Probed natively (`ZombieDoorWalkProbe`, 2 records: tag read, tag written, `bk()` on both classes; `zombie-door-walk-reference.json`): the pigman now stores the rolled flag, saves and loads it (`entities.js`), exports it to and imports it from Java regions and `/summon` (`CanBreakDoors`, previously always 0), and runs no door task. A leader pigman's max-health bonus is not stored (the port keeps `maxHealth` for zombies only).

The zombie's full door walk in a ticking world is probed and replayed: see [village](village.md#batch-19-a-zombie-walking-a-door-path-probed).

## Gaps

- A rider's own movement is not run, so its collision flags, fall distance and step sounds are not reproduced: the rider's fall distance stays 0 (the original lets the rider's accumulate; not probed). A zombie jockey cannot trip the door task through its own collision.
- The chicken search takes the first free chicken in the world's mob order; the original takes the first of its chunk-ordered entity list.
- Portals: native `Entity.travelToDimension` (`sa.b(int)`) does not call `mountEntity(null)` itself, but the Nether portal block, `BlockEndPortal` and `Entity.onEntityUpdate` all skip an entity with a rider or a vehicle, so a jockey never travels (`removeEntity` would dismount it). `DimensionLive.tickEntities` now treats `ridingEntity`/`riddenBy` as riding too (before, only the horse-seat `rider`/`vehicle` fields counted, so the mount of a spider jockey could leave alone). Tested in `entity-portal.test.js`.
- Not probed with a ticking world: `Entity.updateRidden` (`sa.ab`) zeroes the motion and runs the rider's whole `onUpdate`, so natively a rider's own `moveEntity` still runs and its `fallDistance` keeps growing by about 0.078 a tick (nothing in `mountEntity` or `updateRidden` resets it; only the rider's own landing would consume it). This port skips the rider's movement and zeroes `fallDistance`, which only differs if the rider would land on its own.
- The crack overlay is a full box as for the player's mining, not the block's own shape; the door's open-state shape is ignored.
- The skeleton rider's equipment is replayed by `EquipmentProbe`, not here (its random stream is unseeded natively before a spawn).
- Sneaking players, horses and boats (players cannot ride mobs through this path; pigs and horses keep their own player-rider code) are outside this runtime.
- The child zombie's baby size and the chicken jockey's drawn pose were not compared with the original's rendering.
