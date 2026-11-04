# Item and block display names

Status: native-verified for every original item/block-item and damage subtype; browser-only items approximated (Title Case).

## Evidence

`tools/probes/ItemNameProbe.java` (run by `tools/verify-item-names.mjs` against `tools/research/minecraft-1.7.10.jar`, SHA1 e80d9b3b...)
calls `ItemStack.getDisplayName` (`add.s`) for `Item.getItemById` ids 1-4095 after `Block.registerBlocks`/`Item.registerItems`.
`StringTranslate` (`de`) loads `assets/minecraft/lang/en_US.lang` from the JAR, so the strings are the real lookup. Damage 0-15 for every
item, 0-255 for spawn eggs, 0-32767 for potions (`ItemPotion.getItemStackDisplayName`: the "Splash" prefix, effect names, the prefix
names such as "Awkward Potion", "Water Bottle"). Output: `public/research/item-names-reference.json` (315 items, 41 distinct potion
names) and the generated `src/item-names-data.js` (damage-indexed names, trimmed after the last distinct name).

## Port

- `src/item-names.js` maps a browser item id to its original id/damage (`src/original-items.js`, the table region import and the anvil
  use, moved out of `region-import.js`, which re-exports it; otherwise `block-registry.js` `toOriginal`) and reads the native name.
  `applyNativeNames(ITEMS)` runs once in `survival.js` after the item installers and rewrites each item's `name` and `variants`.
  `stackName(stack, ITEMS)` is the one lookup for a stack: a stored `displayName` (anvil rename, written NBT) stays exactly as is,
  potions use `potions.js` `potionName` (checked against all 32768 damage values), everything else is the variant/name.
- Routed through it: item tooltips (`gui.js` `tooltipLines`, inventory, creative, merchant), the held-item name, the hotbar aria
  labels, the anvil default-name comparison, the F3 target line (`ITEMS[id].name` first) and `RECIPES[].name`.
- Container titles were already the lang strings ("Large Chest", "Repair & Name", "Enchant", "Item Hopper", ...).
- `BLOCKS[].name` in `world.js` is an internal key (`'Dandelion'`, `'Red flower'`, `'Iron block'` are looked up by name) and was not
  changed; no player-visible text reads it any more except the F3 fallback for blocks without an item.

## Notes from the jar

Some lang strings differ from what players remember: white wool is "Wool" (damage 0), both pressure plates are "Pressure Plate", both
buttons "Button", dirt damage 1 is "Dirt" (no coarse dirt in 1.7.10), `Bricks Slab`/`Stone Bricks Slab` are the slab subtype names, dye
damage 0 is "Ink Sac" and 15 "Bone Meal", potion level/duration is a tooltip line, not part of the name.

## Browser-only items (Title Case, no 1.7.10 item)

Wheat stages 0-7 (ids 31-38), Sugar Cane block (54), Glowing Redstone Ore (65, no ItemBlock), the Wooden/Iron Door blocks (97/98; the
items 470/471 are native), Powered Redstone Comparator (128), Piston Moving Block (130), the Brewing Stand block (134; item 1134 is
native) and the Bed block (138; its item maps to original 355 "Bed"). Small words (of, and, with, the, in, on, a, an) stay lower case,
as in "Block of Redstone", "Flint and Steel", "Minecart with Chest".

## Tests

`src/item-names.test.js`: reference replay for every creative-inventory stack that has a browser item (379), every variant of every
mapped browser item, all 32768 potion damages, anvil/empty `displayName` pass-through, the browser-only list and a no-lower-case-word
scan of every item and variant name. Regenerate with `MC_RESEARCH=<tools/research> node tools/verify-item-names.mjs`.
