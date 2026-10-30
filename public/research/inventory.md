# Inventory, containers and armor (0.7)

Version 0.7 replaces the aggregate item-count inventory with the 1.7.10 `InventoryPlayer` model: 36 main slots (0–8 hotbar, 9–35 main), four armor slots and a cursor stack. Every stack carries its own count and item damage, so durability belongs to each tool or armor piece rather than to its item type.

## What is ported

- `InventoryPlayer`: `addItemStackToInventory` (fill matching stacks, then the first empty slot; damaged items take an empty slot; the return value reflects only the last pass), `consumeInventoryItem`, `decrStackSize`, `damageArmor` and creative pick-block (`func_146030_a`, including the held-tool guard).
- `ItemStack.damageItem`: an item breaks when damage exceeds its maximum, so a 59-use wooden tool lasts 60 uses. Creative players take no wear.
- `Container.slotClick` modes 0–6: left/right click, shift-click (`transferStackInSlot` with the retry loop), hotbar keys, creative clone, the drop key, drag splitting (left even shares, right one each) and double-click collecting.
- `ContainerPlayer`, `ContainerWorkbench` and `ContainerFurnace` slot layouts and shift-click routes. Furnace input and fuel are plain slots, so any item may be placed by hand, as in 1.7.10.
- `SlotCrafting`: taking a result consumes one item per grid cell; shift-clicking crafts until the grid runs out (and loses leftovers when the inventory is nearly full, as the original does). `CraftingManager` repairs two damaged items of one kind with a 5% bonus.
- `GuiContainer` mouse and key rules: press/release pairing, 250 ms double-clicks, drag previews (with the yellow overfill and remainder counts), shift double-click, keys 1–9 and Q / Ctrl + Q over the hovered slot, and throwing the held stack by clicking outside. Closing a screen throws the cursor and crafting-grid items; they land ahead of the player and can be picked up after 40 ticks.
- `RenderItem` durability bars and `ItemStack.getTooltip` lines, including the F3 + H advanced `Durability: x / y` line.
- `ItemArmor` for leather, chain, iron, gold and diamond pieces, `EntityLivingBase.applyArmorCalculations` (damage × (25 − armor) / 25 for blockable damage) and armor wear of max(1, damage / 4) per piece. Falls, drowning and starvation bypass armor. The HUD shows armor points above the hearts; cows drop 0–2 leather.

## Evidence

`tools/verify-inventory.mjs` copies the unchanged classes out of the original client JAR (SHA-1 `e80d9b3bf5085002218d4be59e668bac718abbc6`), registers blocks and items, and runs `tools/probes/inventory-scenarios.txt` through `InventoryProbe.java`. The player and world are constructor-less test doubles that record dropped and broken stacks instead of spawning entities. The same script runs through `tools/inventory-replay.mjs`. [inventory-reference.json](inventory-reference.json) records the 53 original outputs: 52 scripted cases plus every mapped item's fuel time and smelting result. `src/inventory.test.js` replays them without a JDK. Guava, log4j-api and commons-lang3 supply utility code only; two different version sets produced identical results.

Comparing against the originals fixed four tables: coal ore and diamond ore smelt, bookshelves and wooden tools burn, and clay blocks smelt into hardened clay, which this build now includes.

## Still different

- The creative inventory is a searchable picker for the selected hotbar slot, not the tabbed `GuiContainerCreative`.
- Dropped and thrown items are recoverable piles, not physical item entities.
- Mouse handling is ported from `GuiContainer` bytecode and unit-tested, not run against the original GUI class.
- Armor is not drawn on the player, and pumpkins and skulls cannot be worn. Leather armor cannot be dyed, and the held leather item in first person is untinted.
- Chests, hoppers, dispensers, enchanting, anvils and brewing containers are not implemented.
