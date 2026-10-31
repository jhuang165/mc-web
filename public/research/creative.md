# Creative inventory (1.7.10)

The creative screen is a port of `GuiContainerCreative` (`bfl`), its `ContainerCreative` (`bfm`) and `CreativeSlot` (`bfn`), with tab data from `CreativeTabs` (`abt`). Code: `src/creative.js`; screen and input wiring: `openCreative` / `renderCreativeBody` in `src/main.js`; styles at the end of `src/container-ui.css`. Tests: `src/creative.test.js`.

## Evidence

`node tools/verify-creative.mjs` compiles `tools/probes/CreativeProbe.java` against the unchanged classes of the original client JAR (SHA-1 `e80d9b3b…`) and writes `creative-reference.json`. The probe:

- registers blocks and items (`Block.registerBlocks`, `Item.registerItems`);
- calls `registerBlockIcons` / `registerIcons` with an icon register that returns `null`, because some `getSubItems` (flowers, double plants) size their lists from icon arrays;
- lists each tab with `displayAllReleventItems`;
- repeats the search tab's source walk from `updateCreativeSearch`: every item with a creative tab in registry order, then one enchanted book per enchantment (book NBT is not recorded).

Original totals per tab: Building Blocks 141, Decoration Blocks 103, Redstone 26, Transportation 12, Miscellaneous 56, Search 606, Foodstuffs 28, Tools 33, Combat 45, Brewing 65, Materials 45, Survival Inventory 0. The browser lists only implemented items, in the original order, mapped through `MC_IDS` in `tools/inventory-replay.mjs`. The test checks every tab against the reference. Redstone, Transportation and Brewing are empty for now.

The click, scroll, key and drawing rules below come from the bytecode (javap). They are unit-tested, not probe-run.

## Layout

- The screen is 195 × 136. Backgrounds are `creative_inventory/tab_items.png`, `tab_item_search.png` and `tab_inventory.png`.
- Tab art (`tabs.png`, 28 × 32 at u = 28·column):
  - x = 28·column, plus the column number for columns 1–4; column 5 sits at 167.
  - The top row is at y = −28 (v 0, or 32 when selected). The bottom row is at y = 132 (v 64 / 96).
  - Icons sit at (x + 6, y + 9) on the top row and (x + 6, y + 7) on the bottom row.
  - Unselected tabs draw under the background; the selected tab draws over it.
- Click boxes (`func_147049_a`) are 28 × 32 and inclusive. Column 5's box starts at x = 169, two pixels right of its art. Rows span y −32…0 and 136…168.
- Tab names show as a tooltip over (x + 3, y + 3, 23, 27), with `isPointInRegion`'s one-pixel margin.
- The title is the tab name at (8, 6) in #404040. The survival tab has no title and no scrollbar.
- The scrollbar is a 12 × 15 sprite at (175, 18 + ⌊95·scroll⌋), u = 232, or u = 244 when the list fits.
- Search field (`GuiTextField`): at (82, 6), 89 wide, no background, white shadowed text, at most 15 characters. The cursor blinks every 6 ticks: `_` at the end of the text, otherwise a vertical bar.
- Survival inventory tab:
  - Player slots are wrapped in `CreativeSlot`. Armor sits at (9 + ⌊j/2⌋·54, 6 + (j mod 2)·27). The main inventory sits at (9 + 18·col, 54 + 18·row). The hotbar is at y = 112. Crafting slots move to −2000 (hidden).
  - The "Destroy Item" slot is at (173, 112).
  - The player figure uses `func_147046_a(43, 45, 20)`.
  - While correcting this, the survival inventory figure was rescaled to its original `(51, 75, 30)`.

## Behaviour

- **Grid.** It shows 9 × 5 of the tab's list. The row offset is `(int)(scroll·rows + 0.5)` with rows = ⌊n/9⌋ − 4.
  - The wheel moves one row per notch: `scroll -= sign/rows`, as Java float.
  - Pressing in the 14 × 112 track at (175, 18) drags the bar: `scroll = (y − 25.5)/97`.
- **Tabs.** A left press over a tab is consumed. Releasing the left button over a tab selects it. The selected tab is static, so reopening the screen returns to it.
- **Search.** T opens the search tab. Typing filters the list to items whose tooltip lines contain the text, ignoring case. Any slot click sets a flag, and the next key in the search tab clears the field first. In the search tab:
  - Hotbar digits act on the hovered slot first. Otherwise every key goes to the field, so E and Q type letters, and Esc still closes.
  - Item tooltips add the item's own tab name in bold blue as the second line.
- **`handleMouseClick` in item tabs.**
  - Clicking outside, or on no slot, throws the cursor (one item with the right button).
  - Grid slots:
    - Left-click copies 1, or a full stack with Shift.
    - Clicking with the same item adds 1 (left; Shift fills it) or removes 1 (right).
    - Clicking with a different item deletes the cursor.
    - Middle-click picks a full stack.
    - A number key copies a full stack to that hotbar slot.
    - Q throws a copy of 1, or a full stack with Ctrl.
  - Hotbar slots follow `Container.slotClick`, but shift-clicking clears them. Only hotbar slots take drags and double-click collection.
- **Survival tab.** Clicks go to the player's `ContainerPlayer`.
  - A click outside always throws the whole cursor. This is the original quirk: the one-item branch is skipped here.
  - Q over a slot drops 1, or the stack with Ctrl.
  - Clicking the bin deletes the cursor. Shift-clicking it empties the whole inventory and armor.
- Closing the screen throws a held stack.

## Differences

- Only implemented items appear. Tabs with no implemented items are empty but still selectable.
- The compass tab icon shows the first frame of its animation strip.
- The survival-tab player figure does not turn toward the pointer.
- The search field lacks clipboard shortcuts and Shift selection.
- Creative players can break bedrock (it is listed in Building Blocks), except the world floor at y = 0, which protects this finite world.
