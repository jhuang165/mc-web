# Saddled pigs and the carrot on a stick (Minecraft Java 1.7.10)

Evidence: `tools/probes/PigSaddleProbe.java` runs the unchanged original classes (`wo` EntityPig, `ub` EntityAIControlledByPlayer, `adt` ItemSaddle, `abp` ItemCarrotOnAStick, `add` ItemStack) on the HorseProbe/MobMoveProbe world double: stone below y 0 and an optional wall at z >= 2. `tools/verify-pig-saddle.mjs` writes `public/research/pig-saddle-reference.json` (client sha1 e80d9b3b..., class digests included). Record counts: facts 1, interact 9, saddle 9, steer 7, ride 10, use 10, drops 36, nbt 2, nbtMissing 1. `src/pig-saddle.test.js` replays them and then drives the live path (EntityWorld, the seat, ai.js and the edit dispatcher).

## Rules (src/pig-saddle.js)

- Task list (`wo.<init>`): swim 0, panic 1.25 at 1, ControlledByPlayer (0.3) at 2, mate 3, tempt carrot on a stick 4 and tempt carrot 4, follow parent 5, wander 6, watch the player (6 blocks) 7, look idle 8. `ub` has mutex 7, so swimming (priority 0, mutex 4) and panicking (1, mutex 1) block steering.
- `ub.a` (shouldExecute and continueExecuting): the pig is alive, the rider is a player, and the boost runs or the rider holds a carrot on a stick (`wo.bE`).
- `ub.e` (updateTask): the pig turns half the way to the rider's yaw, at most 5 degrees a tick. Speed ramps by 1 % of the gap to 0.3. A boost adds `speed * 1.15 * sin(t / max * pi)` and ends after `max` ticks. The move is `moveEntityWithHeading(0, speed)` from inside the AI, after a jump check one block ahead along the dominant axis. The jump check needs no stair or slab underfoot, a free block ahead at the feet and clear headroom over pig height plus rider height. Outside Creative, at half speed or more and not boosting, a 0.006 roll on the pig's Random damages the stick by 1. A stick used up becomes a fishing rod carrying the old tag.
- `ub.h` (isControlledByPlayer): not boosting and speed above 0.09. `ub.g` (boost): `nextInt(841) + 140` ticks on the pig's Random.
- ItemCarrotOnAStick (original 398, internal 2100): stack 1, 25 durability, held full 3D. Recipe: a fishing rod over a carrot (`"# ", " X"`), checked by `recipe-catalogue.test.js`. Right-click while riding a controlled pig with at least 7 durability left boosts and costs 7. Damage 18 boosts and survives at 25; damage 19 does nothing.
- ItemSaddle: `itemInteractionForEntity` returns true for any pig. An adult unsaddled pig is saddled, plays `mob.horse.leather` at 0.5 / 1.0 and takes one saddle; Creative works on a copy, so nothing is used up. `hitEntity`, which runs once an attack lands, does the same and returns true, and it uses up the real stack, also in Creative.
- EntityPig.interact: EntityAnimal.interact comes first. A carrot at age 0 feeds the pig and the player does not mount. Otherwise a saddled pig with a free seat, or with this player in it, mounts the player. Holding a saddle on a saddled pig answers true at the item step, so the player does not mount.
- Drops (`wo.b(boolean, int)`): pork (cooked when burning) `nextInt(3) + 1 + nextInt(1 + looting)`, then the saddle when saddled. NBT `Saddle` (byte) is read by `/summon` and written by region export; a missing tag means no saddle.
- Rider seat: `Entity.getMountedYOffset` is height * 0.75 (0.675), and the rider's feet sit at posY + 0.675 - 0.5. `Entity.fall` passes the fall to the rider, so a ridden pig falling hurts the player too.
- A pig whose `aiMoveSpeed` is 0 does not move when ridden. This is vanilla: the value is transient and comes from the last move-helper speed, so a pig straight after a world load stands until it has wandered once.

## Live wiring

- `src/ai.js` builds the native task list for pigs; `ControlledByPlayer` calls `controlTick`, and its move runs `EntityWorld.moveWith` (the walk tail with step sounds, the world edge, landing and fall).
- `src/pig-saddle-live.js`: saddle use and hit, the pig mount through the horse seat system (`horse-live.js`, pig offset), the stick boost, the AI's stick wear (hotbar redraw, broken-tool report).
- `src/player-edit-simulation.js`: the saddle runs after the leash (EntityPlayer.interactWith order), the pig mount runs after feeding declines, the stick runs on a right-click with nothing aimed, and the saddle hit runs after a landed attack.
- Renderer: RenderPig's saddle pass draws ModelPig(0.5F), with every box inflated by 0.5, using `pig_saddle.png`.
- HUD (GuiIngame.renderPlayerStats): when riding a living mount, that mount's hearts replace the food row. There are `(int)(maxHealth + 0.5F) / 2` of them, at most 30, in rows of 10 at `right - i * 8 - 9` going up 10 pixels a row. Sprites are the container (52, 9), full (88, 9) and half (97, 9). A cart or boat draws no food row. Air bubbles sit on the armour row's y, so they lift with extra heart rows. The jump bar shows for any ridden EntityHorse (`EntityPlayerSP.isRidingHorse`).

## Gaps

- The flyPig achievement (a fall over 5 blocks while riding) is not tracked; there are no achievements.
- Rider fall damage uses the existing cart rider hook (`ceil(distance - 3)`), without the player's Jump Boost or the fall sounds.
- Lightning turns a saddled pig into a pigman through the existing `pigStrike` (nether-melee-live.js); the pig is removed without drops, as setDead does, and the rider is dismounted because the vehicle is gone. Not probed for the saddle case.
- The saddle layer and the mount hearts were checked in the browser once; they are not pixel compared with the original client.
