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

## Push out of blocks (0.21.2)

`EntityPlayerSP.onLivingUpdate` calls `func_145771_j` [blk.j(DDD)Z] right after the sneak ySize raise, so after `Entity.onEntityUpdate`'s water push and before the jump and `moveEntityWithHeading`. `pushOutOfBlocks` in `src/entities.js` ports it and `movementTick` calls it at the same point:

- Four points, in this order: (posX − w, minY + 0.5, posZ + w), (−, −), (+, −), (+, +), with w = width (float 0.6) × 0.35.
- A point acts when its cell or the cell above is `Block.isNormalCube` [aji.r(): opaque material, normal render, no power]. Glass, leaves, ice, TNT, chests, farmland and plants never push.
- It picks the nearest of −x, +x, −z, +z whose two cells (the point's level and one up) are both not normal cubes, by the point's fraction in the cell. Each later side must be strictly nearer, so ties keep x before z. There is no up or down choice, unlike `Entity.func_145771_j` (items, `src/item-entities.js`).
- It sets motionX or motionZ to ∓0.1F (0.10000000149011612) and leaves the other axis alone; a later point overwrites an earlier one. The return value is always false.
- `moveEntity` does not clip a box against a block it already overlaps, so the motion carries the player out. Friction then slows it as usual.

`tools/probes/PushOutProbe.java` calls the unchanged method at the four points and lists `aji.r()` for every original block id this build uses. `node tools/verify-pushout.mjs` (with `MC_RESEARCH`) writes `pushout-reference.json`: the normal-cube table plus 2,304 layouts, with the centre block (stone or glass) at the feet or head level, each side open, stone, or glass under stone, at several offsets and heights. `src/player-pushout.test.js` checks `normalCube` against the table and replays every layout exactly.

Browser check (muted, scratch "Push Check" creative world): stone placed in both of the player's cells at (35.5, 22, 80.5) with the sides cleared pushed the player out to (36.41, 22, 80.09), the box clear of the block, where it stopped.

## Gaps

- The finite world's x/z edge is a clamp at 0.31, which counts as a horizontal collision.
- The player does not collide with entity boxes (`World.getCollidingBoundingBoxes` also returns boats and minecarts, which do not exist here).
- Entity.moveEntity's block-collision callback (`func_145775_I`: cactus, webs, fire, portals) still runs through the existing per-system checks, not one callback.
