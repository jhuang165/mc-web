# Pumpkin Pie, Enchanted Golden Apple and monster egg variants

Evidence: `tools/probes/FoodItemsProbe.java` runs against the unchanged 1.7.10 client classes; `node tools/verify-food-items.mjs`
(needs `MC_RESEARCH` and a JDK) asserts the facts and writes `food-items-reference.json`, which `src/food-items.test.js` replays.

## Bytecode-verified (run, not read)
- Pumpkin Pie (original 400): ItemFood(8, 0.3), 32 eat ticks, stack 64, Food tab, common rarity, not always edible, no potion. From food 0, eating gives food 8 and saturation 4.8. Shapeless recipe: pumpkin, sugar, egg (any order, 2x2 or 3x3); pumpkin and sugar alone give nothing.
- Golden Apple (322): heal 4, saturation 1.2, always edible, Regeneration II 100 ticks at probability 1.0. Eating damage 0 adds Absorption I (2400 ticks) first, then the base potion roll. Rare (aqua name), no glint.
- Enchanted Golden Apple (322:1): epic (light purple name), glint. Eating adds Absorption I 2400, Regeneration V 600, Resistance I 6000, Fire Resistance I 6000 and no potion roll. The display name is "Golden Apple" for both damages. `getSubItems` lists 322:0 then 322:1.
- Recipes: eight gold blocks around an apple give 322:1, eight gold ingots give 322:0, eight gold nuggets give nothing.
- Monster eggs (97): decorations tab, hardness 0.75, six sub-blocks, names "Stone/Cobblestone/Stone Brick/Mossy Stone Brick/Cracked Stone Brick/Chiseled Stone Brick Monster Egg", per-metadata icons (over 5 is stone), quantityDropped 0, damageDropped 0, silk-touch stack and `func_150195_a`/`func_150197_b` mappings.

## Read from bytecode, not run
- `StructureStrongholdPieces.Stones.selectBlocks` only emits monster egg metadata 2 (below 0.2 cracked brick, 0.5 mossy, 0.55 egg 2, else stone brick). 97:3-5 therefore appear only when a silverfish hides in mossy, cracked or chiseled brick, or through Creative and `/give`. No stronghold wiring change was needed.
- 1.7.10 has no "Overpowered" achievement (it arrived in 1.8), so none was added.

## Port notes
- Pumpkin Pie uses internal id 2130 (mapped from original 400 in `ORIGINAL_ITEMS` and `MC_IDS`); the enchanted apple is internal item 372 with damage 1. The shaped matcher yields damage 0 only, so the gold-block grid is a small hook (`foodCraftingResult`).
- Eating honours `alwaysEdible`, passes the eaten stack's damage to the effect table, and the Survival effects are now linked so Absorption grants its 4 absorption points (this also applies to the Absorption potion).
- Monster egg item damage is preserved on placement (block id 68 added to the placement metadata limit).

## Approximate
- Eat sounds, burp, and the potion effect particles for the new effects use the existing generic handling; they were not probed.
- Glint and rarity rendering follow the existing item glint path; no pixel comparison was done.
