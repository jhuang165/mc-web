# Live enchanting table (Minecraft Java 1.7.10)

Internal block 86 is the append-only live mapping for original block/item 116 (`BlockEnchantmentTable`, id from `aks`). Right-clicking it opens a `ContainerEnchantment` screen. The roll comes from the already replayed `EnchantingTable` class in `src/enchantments.js` (see [enchanting](enchanting.md)). 1.7.10 has no lapis cost and no per-player seed, and neither is added here.

## What is live

- **Block.** `src/world.js` (`ENCHANTING_TABLE = 86`, 0.75 tall box through `blockHeight`/`blockBounds`, see-through for culling), `block-registry.js` (`fixed(116)`), `block-textures.js` (`enchanting_table_top/side/bottom`), lighting opacity 0, shadows (not a normal cube), projectile ray box, pickaxe mining at hardness 5, drops itself, explosion resistance 1200 (`explosion.js`). Creative lists it and the native recipe (book, 2 diamonds, 4 obsidian) crafts it.
- **Screen.** `src/enchanting-container.js` (`EnchantingContainer extends Container`) has the one item slot at (25, 47) with limit 1, three option buttons at (60, 14 + 19n) showing the slot levels, and the 36 player slots at (8, 84). `container-ui.css` draws `gui/container/enchanting_table.png`, including the three button states (disabled, enabled, hover) and the three level icons from the sheet.
- **Bookshelves.** `src/enchanting-table.js` reads the live world through the original `bookshelfPower` scan: each of the eight neighbours must have two air cells (torches, blocks and unloaded columns close the gap), and shelves count two blocks out plus the side cells of diagonals, at table height and one above, up to 32.
- **Rolls.** Every change of the item slot runs `onCraftMatrixChanged`, drawing `nameSeed` (one `nextLong`) and the three slot levels from the container Random. The container Random is the saved player-inventory `JavaRandom` (`inventoryRandom`), so rerolls survive saves. `markDirty` counts follow the original chain: a `Slot.putStack` rolls twice, a take or decrement once.
- **Paying.** `enchant(n)` calls `EnchantingTable.enchantItem`. It charges `experience.addLevels(-cost)` (the same level API as anvils) only when a list was built, books become enchanted books (original 403, live 365, with stored enchantments), and Creative skips the level check but still calls `addExperienceLevel(-cost)` like the original, which clamps at zero.
- **Closing.** The input item is dropped back to the player on close, the screen closes when the table disappears or the player is more than 8 blocks away (`canInteractWith`), and saving keeps the input stack (`pendingContainerStacks`).
- **Shift-click.** Slot 0 reverse-merges into the player slots; a player stack enters the table slot one item at a time, and a stack keeps its tag only when the count is 1 (the original loses the tag otherwise).

## Native evidence

`tools/verify-enchanting-table.mjs` runs `tools/probes/EnchantingTableProbe.java` against the pinned client JAR (`e80d9b3bf5085002218d4be59e668bac718abbc6`) and writes `public/research/enchanting-table-reference.json`. It records:

- the unchanged block object at id 116: class, render type, normal/opaque flags, hardness 5, explosion resistance 1200, light opacity 0, tool requirement, drops and the 0.75 bounds;
- the 37 slot positions, limits and `isItemValid` results, and 12 `canInteractWith` distances plus a removed table;
- 300 container cases. Each has a bookshelf fixture, a random inventory and cursor, a seeded container Random and 5 to 12 operations through the real `Slot`/`InventoryBasic` objects: `Container.slotClick` (click, shift-click, hotbar key), `enchantItem` and direct slot writes. After every operation the record holds the table stack, the cursor, the three levels, `nameSeed`, the player's level/total/progress and the 36 inventory slots. The final `nextInt` proves the same number of random draws.

`src/enchanting-container.test.js` replays all 300 cases (920 click operations, 663 direct slot writes and 939 enchant attempts, 183 of them accepted), and `src/enchanting-table.test.js` replays the block and reach records.

## Limits

- **Book and names (batch 10).** The table book, the GUI book and the `EnchantmentNameParts` option names are live; see [enchanting book](enchanting-book.md). The glyph shapes and the book texture are original, not the vanilla art.
- **No enchantment hover text.** 1.7.10 has none; the native screen shows no preview either.
- The book tile state is runtime only (not saved), and the table has no custom name.
- Enchantment effects on tools, weapons and armor follow whichever other work has landed; this change only creates the enchantments. The glint is not part of this change.
- `tools/verify-shadows.mjs` writes the anvil bounds as the full cube. The checked-in `shadow-reference.json` keeps the existing 0.125 anvil entry by hand next to the new table entry.
- The screen layout (title position, button states and colours) follows the `GuiEnchantment` bytecode and the sheet; it has not been compared pixel by pixel in a browser.
