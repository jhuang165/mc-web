# leafcolor b53 track

Branch `batch53-leafcolor` from 5ea7bb4d1.

## Summary
- Executed (tag `b53lc`): `tools/probes/LeafColorProbe.java` calls the real `Item.getColorFromItemStack` (adb.a(add, int), passes 0 and 1) for every registered item id 1..4095 x damage 0..15, next to `Block.getRenderColor` (aji.i), render type and `renderItemIn3d` (blm.a(int)); `tools/verify-leafcolor.mjs` -> `public/research/leafcolor-reference.json`. Tinted block items: grass block 2 (stack colour white, block 7cbd6b), leaves 18 (basic 48b518 / pine 619961 / birch 80a755 by meta&3, stack == block), leaves2 161 (48b518), tall grass 31 (meta 0 white, 1/2 7cbd6b), vine 106 (48b518, not the grass colour), lily pad 111 (208030), double plant 175 (item colour 7cbd6b only for metas 2 and 3; block white). Stems have no block item.
- Bytecode-read render paths: RenderItem (bny) dropped item and item frame: a 3D block item (blm.a(type)) goes through `renderBlockAsItem(block, meta, 1.0)` (useInventoryTint is true), a flat one uses `getColorFromItemStack`; GUI `renderItemIntoGUI` sets glColor from the stack but `renderBlockAsItem` overwrites it with `i(meta)` (stack colour is for flat items); ItemRenderer (bly) held item uses the same two branches. So leaves in every path are `i(meta)`; the grass block's top alone is i(meta) (lead correction), sides white and with no overlay (the overlay is only added by the world renderer).
- Fixed in `src/block-textures.js` (item atlas, `terrainMode` false): leaf tiles bake FOLIAGE_BASIC (0x48B518) instead of `itemFoliageColor()` (5bab46; export kept in biome-colors); the vine bakes FOLIAGE_BASIC instead of the grass colour; the grass side no longer gets the overlay in the item atlas (held, dropped, GUI and frame grass blocks now show plain grass_side sides). The lily (208030), grass/tall grass/fern/double-plant tiles (7cbd6b) were already right.

## Evidence
Executed: item colour sweep (315 ids swept). Bytecode-read: paths in bny/bly/blm. Not seen in a browser.

## Verification
`node --test src/leaf-color-b53.test.js src/displayfx-b52.test.js src/biome-colors.test.js src/atlas-texels.test.js src/snow-integration.test.js` -> 39 tests (see final run in the report). `node tools/verify-leafcolor.mjs` regenerates the reference.

## Follow-ups
- Tall grass meta 0 (white natively) shares the tinted `tallgrass` tile; only matters for a /give of 31:0.
- Sugar cane block tile `reeds` is still baked grass in the item atlas (only the cart display reads it, via the terrain atlas).
- Browser look of the plain grass sides and the new leaf tone is unchecked.
