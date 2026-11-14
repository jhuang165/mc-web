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
- Batch 70 (docs sweep): the selection claim is wrong in both halves. `BREWING_SELECTION` (`brewing.js`, used by `world.js` `blockBounds`) is `[0, 0, 0, 1, 0.875, 1]`. Bytecode (`ajq`, BlockBrewingStand): `addCollisionBoxes` sets the post box (0.4375..0.5625 x 0..0.875), adds it, then calls `g()` (setBlockBoundsForItemRender) which sets `(0, 0, 0, 1, 0.125, 1)` and adds the base; the block has no `setBlockBoundsBasedOnState`, so the shared bounds, which are what the outline and the ray trace use, stay at the 0.125 base slab after any collision query near a stand, and are the unit cube before the first one. Native therefore outlines (and can be aimed at) a 1/8-high slab in practice, not a 0.875-high box. Open: this port selects the taller box, so a stand can be targeted and broken by aiming at its post. Not changed here (it alters targeting and was not probed; bytecode-read only).
- Stands are processed only in ticking chunks; the hopper track consumes `accessibleSlots/canInsertItem` in brewing.js.
- Batch 71: executed (`tools/probes/BrewingBoundsProbe.java`, `public/research/brewing-bounds-reference.json`, replayed in `src/hudfx-b71.test.js`): the unchanged `ajq` returns the unit cube for a selection or collision-box query before any collision pass, and the 0.125 base slab after the first `addCollisionBoxesToList` (the pole is a collision box only). The port now follows that: `brewingSelection()` in `brewing.js` is the full cube until `collisionBoxes`/`collisionBoxList` touch a stand cell, then the slab. The state is one flag shared by every stand, as the one Block instance is natively. The 0.875 `BREWING_SELECTION` is gone. Caveat: the dedicated server process keeps its own flag, so a client that has not yet had a collision pass can aim at the upper part of a stand that its server already treats as a slab (not exercised).

- Batch 72: the selection flag is one module-level `brewingShared` per JS context. Single player has one context for the integrated simulation and the client view, matching the one Block instance of an integrated server, so nothing to share. A dedicated server and its client are separate processes, as separate JVMs natively; the port's server aim gate (`raycast` in `simulation.js`) reads the server's own flag, which native does not do (it checks only reach), so that gate can disagree with a fresh client. Not changed.
