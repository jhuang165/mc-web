# Player collision and step-up (1.7.10)

Since 0.21.1 the player controller (`movementTick` in `src/main.js`) moves through the same `Entity.moveEntity` [sa.d] port as mobs (`moveEntity` in `src/entities.js`). It replaces the earlier per-axis bisection, which had no step-up.

## Ported

- Axis order y, x, z against `World.getCollidingBoundingBoxes`. The player box is 0.6 × 1.8 with float width/height, and the scan starts one block low. `AxisAlignedBB.calculate{X,Y,Z}Offset` clips each axis.
- `stepHeight` 0.5 (EntityLivingBase). When a horizontal move is blocked and the entity is on the ground (`onGround`, or this move's y was clipped while falling), the move is retried from the start box: up 0.5, then x and z, then back down 0.5. The step result is kept only if it covers at least as much horizontal distance.
- Step condition from the bytecode: `stepHeight > 0 && grounded && (sneakEdge || ySize < 0.05F) && (x or z clipped)`. `sneakEdge` is the sneaking-player-on-the-ground flag of the edge loop (`instanceof EntityPlayer`). `ySize` is read after the `ySize *= 0.4F` at the top of `moveEntity`. So for one tick after releasing sneak (ySize 0.2 × 0.4 = 0.08) the player cannot step unless still sneaking.
- 1.7.10 does not feed ySize from steps. The only other write is `setPositionAndRotation` [sa.b(DDDFF)], which resets it to 0. There is no eye glide up steps; the older claim in [sneaking](sneaking.md) was wrong.
- `onGround`, `collidedHorizontally` and the motion zeroing on clipped axes come from the move. The sneak edge loop and the web slowdown shorten the move, not the motion, as before.
- `BlockFarmland.getCollisionBoundingBoxFromPool` [aky.a(ahb,III)] is a full cube, though farmland renders and selects 15/16 high. `collisionBounds` in `src/world.js` returns it. `collides`, mob/player movement, item entities and arrows use it (`bow.js` and `particles.js` already special-cased it). So the player cannot walk onto farmland without jumping, as in the original, and stands at y + 1 on it.

## Evidence

`tools/probes/PlayerStepProbe.java` runs the unchanged EntityPlayerSP [blk] through `Entity.moveEntity` and `moveEntityWithHeading`. The world is the `PlantProbe` map-backed double, whose collision list calls the original `Block.addCollisionBoxesToList`. Obstacles: stone, dry and wet farmland, a chest, a ladder, and snow layers with metadata 0–5 and 7.

`node tools/verify-playerstep.mjs` writes `playerstep-reference.json`. It needs `MC_RESEARCH` pointing at the JAR directory. It holds 589 cases:

- 572 single moves: dz 0.1–0.7, ySize 0/0.1/0.12/0.2, on or off the ground, with or without the sneak key;
- 17 walks of 30 ticks, including farmland in front of a one-block riser.

`src/player-step.test.js` replays every case through `src/entities.js` and requires 1e-12 agreement. It also checks that snow layers 1–4 are walked onto while 5, 7, farmland, stone and the chest are not. `EntityPlayer.getAIMoveSpeed` returns the movementSpeed attribute (0.1) and ignores `setAIMoveSpeed`, so the walks use the walking speed only.

The browser check (muted, scratch "Step Check" creative world): walking +z rose to y + 0.375 on a 3/8 snow layer and y + 0.5 on a 4/8 layer, stepped down after each, and stopped at z = 88.7 (box edge flush) before a 5/8 layer and before farmland. A jump then landed on farmland at y + 1.

## Gaps

- No `EntityPlayerSP.pushOutOfBlocks` [func_145771_j]: a player inside a block (falling sand, a block placed in the head) is not pushed out at 0.1 a tick, and `moveEntity` lets the box leave an overlapping block freely.
- The finite world's x/z edge is a clamp at 0.31, which counts as a horizontal collision.
- The player does not collide with entity boxes (`World.getCollidingBoundingBoxes` also returns boats and minecarts, which do not exist here).
- Entity.moveEntity's block-collision callback (`func_145775_I`: cactus, webs, fire, portals) still runs through the existing per-system checks, not one callback.
