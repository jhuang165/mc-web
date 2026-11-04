# Brewing stand (Minecraft Java 1.7.10)

Block 134 (original 117, item 1134). Evidence shared with potions.md (`potions-reference.json`, `src/brewing.test.js`).

## Native-verified
- TileEntityBrewingStand: 4 slots (bottles 0-2, ingredient 3), `BREW_TIME` 400, canBrew, brewPotions (list-equality semantics), `brewItem` reset, bottle bits `1 << slot`, sided slots (top ingredient, sides bottles, bottom bottles), comparator `calcRedstoneFromInventory`.
- ContainerBrewingStand slot layout and shift-click rules; bubble heights [29,24,20,16,11,6,0], arrow 28 px.
- Save/export: tile id `Cauldron`, `BrewTime` short, `Items`; `brewItem` is not saved.
- Recipe: blaze rod + 3 cobblestone (`" B ","CCC"`).

## Live
Placement, collision boxes, drops, block light 0.125, GUI (`brewing-modal`), per-tick processing of every loaded stand, metadata bottle bits, comparator notification, spill on break and explosion, Java region import/export.

## Approximated
- Selection box is the full 14/16 slab (native 0.875 top); the model uses diagonal sprite planes for bottles.
- Stands are processed only in ticking chunks; the hopper track consumes `accessibleSlots/canInsertItem` in brewing.js.
