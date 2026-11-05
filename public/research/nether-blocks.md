# Nether, End and quartz building blocks

Scope: the Overworld-usable blocks and items of Minecraft Java 1.7.10 from the Nether and the End. There is no Nether or End dimension. This is not full parity.

| Internal block | Original | Block |
| --- | --- | --- |
| 150 | 87 | Netherrack |
| 151 | 88 | Soul sand |
| 152 | 121 | End stone |
| 153 | 112 | Nether brick |
| 154 | 113 | Nether brick fence |
| 155 | 114 | Nether brick stairs |
| 156 | 153 | Nether quartz ore |
| 157 | 155 | Block of quartz (metadata 0 plain, 1 chiseled, 2 pillar, 3/4 pillar on its side) |
| 158 | 156 | Quartz stairs |

Block id equals item id for 150-158. The nether brick item (original 405) is internal 520. The nether quartz item (406) already existed as internal 382. Stone slab damage 6 (nether brick) and 7 (quartz) use the existing stone slab (internal item 1103). Glowstone (89) was already implemented and is untouched.

## Method

`tools/probes/NetherBlocksProbe.java` runs the unchanged 1.7.10 classes (block registry objects 87, 88, 112, 113, 114, 121, 153, 155, 156, 43 and 44, CraftingManager, FurnaceRecipes, Entity.doBlockCollisions) over a map-backed World double; `tools/verify-nether-blocks.mjs` pins the client JAR SHA-1 and writes `nether-blocks-reference.json` (321 records: 11 block facts, 9 mining tables, 15 drop rows, 21 icon rows, 7 harvest histograms of 400 samples, soul sand boxes and 10 slowdown rows, 5 quartz placement rows, 2 stairs placement rows, 171 fence-connect rows, 48 fence shapes, 9 shaped recipes, 2 smelting rows). `src/nether-blocks.test.js` replays them. Run the verifier with `MC_RESEARCH=<dir with minecraft-1.7.10.jar>`.

## What is implemented

- Hardness, resistance, tool requirement (rock needs a pickaxe; soul sand does not and is dug faster with a shovel), drops and break sounds as probed. Every block drops itself; quartz ore drops one quartz, 2-5 experience, and Fortune and Silk Touch apply (`enchantment-effects.js`).
- Quartz block placement (`BlockQuartz.onBlockPlaced`: the pillar axis from the clicked side), `damageDropped` (axis 3/4 drops the vertical pillar), per-face icons and the quarter-turn on the side pillars.
- Soul sand: collision box 0.875 high, full selection box, and `onEntityCollidedWithBlock` motion x and z multiplied by 0.4 per overlapped cell for the player, mobs, items, boats and minecarts (`block-collisions.js`).
- Fire burns forever on netherrack (`fire.js`: no rain, burn-out or age-15 removal over netherrack).
- Nether brick fence connects to nether brick fences and solid blocks, not to wooden fences, and torches stand on it; render, collision and selection boxes match.
- Stairs 155 and 158 use the existing stairs code (placement, shape, boxes).
- Recipes: 4 items to a nether brick block, 6 blocks to 6 fences, the stair shape to 4 stairs, 3 bricks to 6 nether brick slabs, 3 quartz blocks to 6 quartz slabs, 4 quartz to a block, 2 quartz slabs to a chiseled block, 2 plain blocks to 2 pillars. Netherrack smelts to a nether brick (0.1 experience) and quartz ore to quartz (0.2).
- Names are the 1.7.10 `en_US` names. Saves, region import and export use the original ids and metadata (`block-registry.js`, `original-items.js`).

## Limits

- The Nether and the End dimensions, their generation, portals and Nether fortresses do not exist; these blocks only come from crafting, Creative and imported worlds.
- Fire over netherrack follows the decompiled `BlockFire.updateTick` branches but was not probed natively; `fire.test.js` was not extended.
- The Fortune II quartz histogram in the fixture is biased (a power-of-two `nextInt` bound over consecutive seeds); the test checks the support set instead of the counts.
- The direction of the quarter-turn on the side pillar texture is not native-verified (the quartz lines are almost symmetric).
- Ids 140-149 are hidden reserved placeholders in `BLOCKS` (another content track owns them); `block-registry.js` and several tests skip them. Remove the placeholders when those ids are filled.
- Shadow, stairs and explosion-resistance fixtures predate these ids; their own coverage is `nether-blocks.test.js`.
