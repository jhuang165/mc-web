# Redstone ore (BlockRedstoneOre)

Target: Java 1.7.10. Evidence: `tools/probes/RedstoneOreProbe.java` run by `tools/verify-redstone-ore.mjs` on the unchanged client classes (`amz` BlockRedstoneOre, original ids 73 unlit and 74 lit; internal `REDSTONE_ORE` 64 and `LIT_REDSTONE_ORE` 65). It writes `redstone-ore-reference.json` (884 records: 2 facts, 480 touch, 2 tick, 400 harvest). `src/redstone-ore.test.js` replays it. Full parity is not claimed.

## What the bytecode and probe show

- `onBlockClicked`, `onEntityWalking` and `onBlockActivated` all call the private `func_150185_e`: first the reddust sparkle (`func_150186_m`), then `World.setBlock(lit ore)` (metadata 0) only when the block is the unlit ore. A lit ore sparkles and stays as it is: it is not refreshed and nothing is scheduled (`tickRate` is 30 but never used).
- `func_150186_m` is the same routine the lit ore's `randomDisplayTick` runs: six faces, each point random in the cell and pushed 0.0625 out of its face when that neighbour is not an opaque cube; a point spawns only when it lies outside the cell on some axis (the lower test reads `y < 0`, so the down-face point never spawns; an open ore gives 5 particles). `World.rand` supplies every `nextFloat`. The port's `oreSparkle` already matched; the 480 touch records confirm positions bit for bit (colour arguments are 0, 0, 0).
- `onBlockActivated` returns false (`Block`'s default). `PlayerControllerMP.onPlayerRightClick` therefore goes on to the held item's `onItemUse`: a block held in hand is still placed against the ore, and the ore lights up at the same time. Sneaking with an item skips the activation.
- `updateTick` (a random tick; only the lit ore sets `setTickRandomly(true)`): the lit ore becomes unlit ore; the unlit ore does nothing. No particles.
- Light: lit ore `getLightValue` 9 (`setLightLevel(0.625F)`), unlit 0, opacity 255 both. The port's `lightEmission` already had `65 -> 9`, and `scene.updateBlocks` relights when old and new emission differ, so the swap changes the light.
- Drops: `getItemDropped` redstone dust; `quantityDropped` is `4 + nextInt(2)`, `quantityDroppedWithBonus` adds `nextInt(fortune + 1)`; `dropBlockAsItemWithChance` then drops XP `1 + nextInt(5)` because the dropped item differs from `Item.getItemFromBlock(this)` (the lit ore has no ItemBlock at all, the probe's `itemOfBlock` is 0). `createStackedBlock` returns the unlit ore, so Silk Touch on either block gives unlit ore. These already live in `enchantment-effects.js` (rules 73/74, replayed here against the new reference) and `population-content.js` (the plain path).

## Live wiring

- `src/redstone-ore.js`: `touchRedstoneOre` and `randomTickRedstoneOre`; `PopulationBlocks.touch` and `.randomTick` delegate to it.
- Left click (Survival, first click of a hit, not when mining already started): `player-edit-simulation.js` hook `touchRedstoneOre`. Creative breaks the block without `onBlockClicked`.
- Right click: same hook before the item is used, when the player is not sneaking with an item; the flow continues to placement.
- Walking: the player's step tail in `main.js` (the `distanceWalkedOnStepModified` branch, cell `floor(y - 0.2)`) and `mobStepEvents` `onWalk` for mobs (`mobs.onEntityWalking`). This replaces the old behaviour that lit the block under the feet on every frame and on every click (including Creative and block-placement clicks), without particles.
- Particles use the shared `World.rand` (`scene.explosionParticles.worldRandom`) and `scene.fx`.

## Gaps

- Mobs on paths that do not go through `Mobs.moveWith` (flying, swimming and other custom movers) do not call `onEntityWalking`. Minecarts, boats and thrown entities do not trigger it either (they cannot in 1.7.10 except where `canTriggerWalking` is true).
- The player step distance uses the port's 1.667 threshold and grounded gate rather than a float `distanceWalkedOnStepModified`, and the cell is `floor(y - 0.2)` without the sneak `ySize`.
- The integrated server's separate client and server `World.rand` copies are one stream here. Ore touched while loading or from a block-event path (pistons, dispensers) is not covered.
- The reference does not re-probe hardness or harvest level (`mining-reference.json` already holds them: hardness 3, iron pickaxe).
