# Flowing water (1.7.10)

Code: `src/fluids.js` (`Fluids`, `flowVector`, `flowAngle`, `liquidHeight`, `waterAcceleration`), the metadata array in `src/world.js`, `liquid` and `updateBlocks` in `src/scene.js`, the water push in `src/item-entities.js` and `movementTick` in `src/main.js`. Tests: `src/fluids.test.js`.

Everything below was read from the bytecode with javap: `akr` BlockDynamicLiquid, `ant` BlockStaticLiquid, `alw` BlockLiquid, `ahb`/`mt` World/WorldServer, `ahs` NextTickListEntry, `blm` RenderBlocks, `sa`/`xk` Entity/EntityItem. No later-version formula is used.

## Evidence

`node tools/verify-fluids.mjs` compiles `tools/probes/FluidProbe.java` against the unchanged client JAR (SHA-1 `e80d9b3b…`) and runs the original `akr`, `ant` and `alw` classes in 12 seeded scenarios (14 x 8 x 14 stone-shelled boxes with terraces, pools, sources placed and removed, stone placed and removed). The only test double is a minimal `ahb` (World) that replays `setBlock`, `setBlockMetadataWithNotify`, `notifyBlocksOfNeighborChange` and the WorldServer tick list. The script checks `src/fluids.js` against it for every tick of every scenario (a grid hash after each of 120 ticks, the pending tick count at the end, and `getFlowVector` / `getFlowDirection` of each water cell, 1,440 ticks and 1,232 vectors), and records the result in `fluids-reference.json`. `src/fluids.test.js` replays that file. Item push, rendering heights and the entity box are ported but not run against the JAR.

## Metadata

`World.meta` is a byte per cell next to `data`. Water is block 10 and its metadata is the level: 0 source, 1 to 7 flowing, 8 to 15 falling (8 plus the level it fell from). Blocks 8 (flowing) and 9 (still) are one block here: a still block is a flowing one with no pending tick, which is what `ant.a` (onNeighborBlockChange) and `akr.n` (set stationary) make of them.

Saves keep the existing `edits` list. A tracked edit is stored as `block | meta << 8`, so a plain block id (every old save) reads as meta 0. Generated water is level 0, a source, so `generationVersion` stays 3 and old worlds load unchanged. `restore` refuses a block above the table, a negative value or a meta above 15. An older build refuses a save that holds levels (the values are above its block table). The tick list is not saved (the original stores TileTicks); `Fluids.wake()` on load schedules every water cell on or next to an edit, and a settled one rests again after one tick.

## Rules ported

- `akr.a` updateTick (water branch). `l` is the raw level. If `l > 0`: the lowest neighbouring level comes from `akr.a(ahb, x, y, z, int)` (checkAdjacentBlock: level -1 is ignored, level 0 counts a source, 8 and up count as 0); the new level is that plus 1, or -1 if it would be 8 or more; water above gives 8 (or above + 8); two or more adjacent sources over a solid block or a source make it 0. A changed level either removes the block (`setBlockToAir`) or sets the metadata without notifying (flag 2), schedules a tick and notifies the neighbours. An unchanged level turns the block still. Then: if the cell below can take water it gets level `l` (`l + 8` if under 8); otherwise, if `l == 0` or the block below is blocked, the cell spreads to the directions chosen by `akr.o`, at level `l + 1` (1 for falling water), and not at all when that is 8.
- `akr.c` and `akr.o` (func_149808_o): a direction costs 0 if the cell beyond has nothing solid under it, else the fewest steps (recursing to depth 4, never back the way it came) to such a cell, 1000 if none; the directions with the lowest cost flow. Sources and non-solid cells that are level 0 water are skipped.
- `akr.p` isBlocked: doors, signs, ladders and reeds exist in 1.7.10 but not here; the rest is `Material.blocksMovement`, which is this build's `World.solid`. `akr.q`: water never flows into water.
- `akr.h` flows into a cell: `Block.dropBlockAsItem` on what was there (torches, wheat and tall grass here: the `wash` callback, which `main.js` turns into the usual item drops), then `setBlock(water, level, 3)`.
- Scheduling: `World.scheduleBlockUpdate` (`mt.a(IIILaji;II)`) uses a HashSet keyed on cell and block, so a cell already waiting keeps its time. `mt.a(Z)` takes the first `min(size, 1000)` entries ordered by time then creation, stops at the first one in the future, and removes and runs each in turn (an entry that is still in the set blocks a duplicate). `BlockLiquid.tickRate` is 5 for water. `onBlockAdded` (`akr.b`) schedules; `notifyBlocksOfNeighborChange` visits x-1, x+1, y-1, y+1, z-1, z+1.
- `alw.f` getFlowVector and `alw.a(ahl, x, y, z, awt)` getFlowDirection (-1000 for no flow, otherwise `atan2(z, x) - pi/2`); `Vec3.normalize` rounds the length to a float and returns zero under 1e-4. `alw.b(I)` height percent, `(min(level, 0 if 8+) + 1) / 9` in float.
- `blm.a(IIILawt;)F` getLiquidHeight: four cells around the corner in floats, water above gives 1, source and falling water weigh 11, flowing water 1, non-solid cells 1. `renderBlockLiquid` draws the top from the still or (when moving) the flowing texture rotated by the flow direction (`sin` / `cos` from the MathHelper table), from both sides, with the four corner heights lowered by 0.001 and the sides using those heights.
- `ahb.a(azt, awt, sa)` handleMaterialAcceleration: every water cell the box reaches whose surface (`y + 1 - percent`) is at or under `floor(maxY + 1)` adds its flow vector; the sum is normalised and times 0.014 is added to the motion. `EntityItem` passes its own box; other entities pass the box shrunk by 0.4 at top and bottom (`azt.b` with a negative y expands the other way) and by 0.001 on every side (`sa.N`). The player gets it unless flying.

## Differences

- Lava does not exist in this build; every lava branch (tick rate 30, hardening, fizz sound, lava next to water) is left out.
- Cells outside the world (sides, the sky and the bedrock plane) count as solid; the original always has chunks loaded there.
- Mobs are not pushed: `entities.js` moves them with its own damping instead of motion and drag, so an added 0.014 would not mean what it does in the original.
- `Farming.nearWater` still reads block 10, so flowing water hydrates soil like any water.
- Every flowed cell becomes a save edit; `restore` accepts at most 100,000 edits, so a flood larger than that cannot be saved.
- Sounds for flowing water and the fizz of water meeting lava are not played.
