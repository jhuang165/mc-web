# Ladders — Minecraft Java 1.7.10

Version 0.20 adds `BlockLadder` (original ID 65, internal block 52). Ladders use the original `blocks/ladder.png` and are drawn the way `RenderBlocks.renderBlockLadder` (render type 8) draws them: one quad 0.05 off the wall, facing away from it, in the cell's own brightness with no face shading. They have Material.circuits, hardness 0.4, light opacity 0 and the wood dig/place sound. Their step sound is `step.ladder`. They are not opaque or normal cubes and do not block movement for pathfinding. They are not furnace fuel, and they drop themselves. Sticks in `S S / SSS / S S` craft three. They appear in Decoration Blocks and Search between the furnace and snow, in original registry order.

## Placement and support

`canPlaceBlockAt` needs a normal cube on one of the four horizontal sides. `onBlockPlaced` starts at metadata 0 and tests the walls in the order 2 (z+1), 3 (z−1), 4 (x+1), 5 (x−1). Each test runs while the metadata is still 0 or equals the clicked face. Clicking a wall therefore puts the ladder on that wall. Clicking the top or bottom of a block picks the last supporting wall in that order. `onNeighborBlockChange` drops the ladder when its wall stops being a normal cube. The collision and selection boxes are the same 0.125 plate against that wall. The player's ray, the selection outline, arrows and the bucket trace all use the plate. A ray through the open part of the cell goes on to the block behind it.

## Climbing

`EntityLivingBase.isOnLadder` tests the block at `floor(posX)`, `floor(boundingBox.minY)`, `floor(posZ)`. On a ladder, the land branch of `moveEntityWithHeading` does three things before the move:

- clamps horizontal motion to ±0.15F;
- caps falls at −0.15 per tick, or 0 for a sneaking `EntityPlayer`;
- clears the fall distance.

After the move, a horizontal collision while still on a ladder sets the vertical motion to 0.2. Gravity and drag then run as usual, so a climb rises 0.1176 blocks per tick. `Entity.moveEntity` counts the vertical part of a move towards the step distance only when the block 0.2 below the feet is a ladder, and then plays `step.ladder`. Zombies and other walking mobs use the shared `moveEntityWithHeading` in `src/entities.js`. Spiders keep their own wall-climbing flag (`EntitySpider.isOnLadder`). The player's controller in `src/main.js` applies the same clamp, sneak hold and climb.

A bucket's liquid replaces a ladder: `ItemBucket.tryPlaceContainedLiquid` only refuses solid materials, and Material.circuits is not solid. The ladder breaks with its drop. Flowing liquid cannot enter a ladder cell (`BlockDynamicLiquid.func_149807_p` lists ladders).

## Evidence and validation

`node tools/verify-ladders.mjs` runs these unchanged classes from the original 1.7.10 JAR (SHA-1 `e80d9b3bf5085002218d4be59e668bac718abbc6`) against a world double:

- `BlockLadder` (`als`) and `Block` (`aji`)
- `Entity` (`sa`) and `EntityLivingBase` (`sv`)
- `EntityZombie` (`yq`)
- `EntityPlayerSP` (`blk`) and `EntityPlayer` (`yz`)

[ladder-reference.json](ladder-reference.json) holds 95 records:

- block facts;
- four metadata bounds;
- 16 neighbour masks × 6 clicked faces of placement;
- 64 support checks;
- ten 40-tick player and zombie runs: climbing, sliding, sneaking, sneak-climbing, falling into a ladder, a fast horizontal fling and walking off.

`src/ladders.test.js` replays every record. It checks every tick's position, motion, `onGround`, `collidedH`, fall distance and step distance to 1e-9. It also covers item and recipe data, plate-only ray selection and bucket replacement.

The mining, shadow and inventory probes were regenerated with the ladder mapped:

- mining: 3,080 original-tool cases (a ladder has no effective tool);
- shadows: no entity shadow on a ladder;
- inventory: 63 cases, 0 mismatches, including the fuel and smelting registry entries.

All 453 JavaScript tests and the production build pass. Browser verification ran in a muted Ladder Check world:

- climbing rose 0.47 blocks per 200 ms and ended standing on the top plate;
- sliding fell 0.45 per 150 ms (0.15 a tick);
- sneaking held position;
- right-click placement on a wall gave metadata 3;
- removing the wall dropped the ladder as an item.

## Remaining limits

Full parity is unfinished. Vines, the other climbable block, do not exist yet. Zombies play `mob.zombie.step` on ladders in the original; this build has no zombie step sounds. The player still uses the simplified collision and step-sound controller rather than the native `moveEntity`. The step sound keeps its existing 1.667-block cadence and now counts ladder climbs. Liquid flow vectors (`getFlowVector`) treat every collision-box cell as a wall. The original only does that for materials that block movement, so water beside a ladder can push slightly differently. Natural ladders (strongholds, villages) need structures, which are absent.
