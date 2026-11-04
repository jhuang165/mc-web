# Leather armor dyeing

`src/leather-dye.js` ports the 1.7.10 `RecipeArmorDyes` shapeless special recipe for the four leather armor pieces. One armor stack and at least one dye can appear anywhere in the crafting grid. Other items, two armor pieces, or a grid without dye do not produce a result. Taking the result consumes one item from each occupied input slot and produces one armor item.

The output is a copy of the armor stack with the `display.color` tag set. A prior color is included as one of the color samples only when the armor already has a color tag; undyed armor does not contribute its default tan. Dye RGB values come from the original `EntitySheep` color table in the matching reverse `ItemDye` order. The recipe averages RGB channels with Java integer division, computes the average maximum channel, then applies the native float scaling and truncation.

## Native evidence

`tools/probes/LeatherDyeProbe.java` invokes unchanged `RecipeArmorDyes.matches` and `getCraftingResult`, `ItemArmor`, `InventoryCrafting`, `ItemStack`, and the registered dye/sheep colors from the pinned 1.7.10 JAR. Run `MC_RESEARCH=../tools/research node tools/verify-leather-dye.mjs` from `game/` to regenerate [`leather-dye-reference.json`](leather-dye-reference.json). Its 324 result records cover all 16 single dyes, all 256 pairs, all dyes mixed into black, white and `0x123456` armor, and four rejected grids. `src/leather-dye.test.js` replays every recorded case.

Browser ItemStacks store this supported tag as `color` (a 24-bit integer). It participates in copies, splits, merge identity, inventory saves, Java region import/export, chest-minecart JSON import and the anvil/enchantment stack adapters. Inventory icons and worn armor tint their base layer and keep the overlay untinted. Held/dropped item tint and cauldron washing remain unfinished. Unknown ItemStack tags remain outside the supported set.
