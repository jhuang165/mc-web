# Navigation and mob AI (1.7.10)

Ports the 1.7.10 navigation stack and drives pig, cow, sheep, chicken and zombie with it. Code: `src/pathfinding.js` (path finding), `src/ai.js` (tasks, helpers, senses), thin hooks in `src/entities.js` and `src/main.js`. Not full parity: see "Missing or different" below.

## Obfuscated names

| 1.7.10 class | obfuscated | here |
| --- | --- | --- |
| PathPoint / Path (heap) / PathEntity / PathFinder | `aye` / `ayd` / `ayf` / `ayg` | `PathPoint`, `Path`, `PathEntity`, `PathFinder` |
| PathNavigate | `vv` | `PathNavigate` |
| EntityMoveHelper / EntityLookHelper / EntityJumpHelper | `tv` / `tu` / `tt` | `MoveHelper`, `LookHelper`, `JumpHelper` |
| EntitySenses | `vw` | `Brain.canSee` (cached per tick) |
| EntityAIBase / EntityAITasks | `ui` / `uj` | `Task`, `TaskList` |
| Swimming, Panic, Mate, Tempt, FollowParent, Wander, WatchClosest, LookIdle, EatGrass, AttackOnCollide | `uf`, `uz`, `ua`, `vk`, `uh`, `vc`, `un`, `vb`, `ud`, `uq` | same names in `ai.js` |
| HurtByTarget / NearestAttackableTarget (base `vu`) | `vn` / `vo` | `HurtByTarget`, `NearestAttackable` |
| RandomPositionGenerator | `vx` | `findRandomTarget` |
| EntityLiving / EntityCreature / EntityAnimal | `sw` / `td` / `wf` | `Brain` (per mob, kept in a `WeakMap`, never saved) |

## Ported

- **PathFinder** (`ayg`): the A* search with the original open-set heap, `getSafePoint` (step up to one block, three-try drops, water/lava/fence/door/rail rules via `getVerticalOffset`), the float `distanceToSquared` cost and heuristic, and `createEntityPath` ending at the closest point when the goal is unreachable. Evidence: `tools/probes/PathProbe.java` runs the unchanged `ayg` on hand-built block worlds (open ground, walls, enclosures, one-block steps, cliffs, 2/4 block drops, water, lava, fences, doors, rails; pig, zombie, chicken, wide mobs; block and entity goals) and `tools/verify-pathfinding.mjs` writes `public/research/path-reference.json` (33 scenarios). `src/pathfinding.test.js` replays every scenario and requires the same point list.
- **PathNavigate** (`vv`): `getPathToXYZ`, `getPathToEntityLiving`, `tryMoveToXYZ/EntityLiving`, `setPath`, `onUpdateNavigation` (per-tick path following, the `width * width` waypoint radius, `removeSunnyPath`, the stuck check (more than 100 ticks without moving 1.5 blocks clears the path)), `canNavigate` (onGround or in water), the follow range (16, zombie 40) and `setAvoidsWater`.
- **MoveHelper / LookHelper / JumpHelper**: `limitAngle` 30 degrees for the body, `setAIMoveSpeed(attribute * multiplier)` which also sets `moveForward`, the jump condition (target block higher, horizontal distance squared < 1), look pitch/yaw limits, head easing to the body at 10 degrees a tick, the 75 degree clamp while a path exists. `rotationYaw` (Java degrees) is authoritative; `e.yaw` for rendering is derived from it at the end of each mob update.
- **EntityAITasks** (`uj`): priorities, mutex bits, `isInterruptible`, a tick rate of 3 (start/stop decisions every third tick, `continueExecuting` only in between). The task counter is derived from the saved `age` (`age - 1`), so timing survives save/load without storing task state.
- **Tasks and priorities** (animals: swim 0, panic 1, mate 2, tempt 3 where the animal has a breeding item, follow parent, eat grass (sheep), wander, watch closest (6 blocks), look idle; zombie: swim 0, attack on collision 2, wander 6, watch closest (8) 7, look idle 8; zombie targets: hurt-by 1, nearest player 2). The existing behaviour (love timers and baby spawn, panic when hit or burning, sheep grazing, zombie attacks and sun burning, chicken eggs/flapping) now goes through these tasks. Formulas (ranges, rolls, timers) are in the comments of `ai.js`.
- **RandomPositionGenerator** with `getBlockPathWeight`: ten `nextInt(2n) - n` offsets (x, y, z order), best weight wins; animals 10 on grass else brightness - 0.5; zombie 0.5 - brightness (light from the scene's light engine through `EntityWorld.lightAt`).
- **EntitySenses.canSee**: eye-to-eye block raycast, cached per tick. Mob eye height `height * 0.85`; the player (server side) eye height 0.12 from the feet.
- **Despawn and idle age** (`sw.w`/`bn`): an idle counter that resets within 32 blocks of the player; animals stop wandering at idle >= 100; zombies despawn beyond 128 blocks, or beyond 32 after 600 idle ticks with a 1 in 800 roll.
- **Revenge target**: `damage()` records it; it lapses after 100 ticks like `EntityLivingBase.func_142015_aE`.

## Evidence limits

- Path points are compared with the original. Helpers, tasks and task selection are unit-tested (`src/ai.test.js`) from the decompiled bytecode logic; they are NOT probed against the original classes. A single-update probe of `tv`/`tu` was not written.

## Missing or different

- Doors (opening or breaking), villagers, MoveTowardsRestriction, village tasks, and the pig's carrot-on-a-stick/carrot tempt and breeding are not present (the pig has no breeding item here).
- A global budget of 8 path searches per tick (`ai.budget`) and a search node cap (`nodeCap`, 30000 expanded points since batch 34, 6000 before; replays lift it) are deviations for browser frame time; the original has neither. A denied search simply tries again later. The only native bound on a search is the follow-range sphere around the target: a sealed target costs the walkable area inside it, about 5000 points (1.6 ms flat, 4.3 ms on terraced hills) at the zombie's range 40, so only multi-storey caves approach the cap.
- ChunkCache (batch 34, bytecode-read and pinned by the `b34-*` fight records): `World.getEntityPathToXYZ` / `getPathEntityToEntity` build a `ChunkCache` (radius `(int)(range + 8)` / `(int)(range + 16)` around the entity, whole chunk columns, air outside and for y < 0 or >= 256), but the PathFinder reads it only in its swimming start loop. The open/blocked test (`ayg.a` static, `func_82565_a`) reads `entity.worldObj`, so walls beyond the region still count and the search is not region-bounded; the port needs no cache.
- The zombie follow-range random bonus and the zombie igniting its target are not applied; the sun-burn rule remains the earlier approximation.
- `maxSafePointTries` assumes Normal difficulty.
- No entity-versus-entity collision, so mobs can overlap.
- Light for `getBlockPathWeight` falls back to a sky-exposure heuristic when no light engine is attached (tests only).
- `mob-movement.md` still says mobs hop when blocked "replacing pathfinding"; that is superseded by the jump helper and the navigator.

## Tests changed because of the new timing

Tasks only decide every third tick and a freshly created mob is not `onGround` until its first motion, so navigation needs a few ticks. `chicken.test.js`, `entities.test.js` and `sheep.test.js` now tick several times where they used to expect a first-tick reaction, graze tests set `age: 0` for the first-tick roll (the old `age % 3` gate ran after the increment), and the old head-snap-to-yaw test drives `rotationYaw` directly. These expectations were approximations of 1.7.10, not recorded behaviour.
