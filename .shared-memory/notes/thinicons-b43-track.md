# thinicons b43 track

## Summary
- Non-cube block icons (ITEM_BOXES items and the dragon egg) now rasterize the executed renderBlockAsItem boxes through the GL pixel-centre edge path with the native renderItemIntoGUI matrix (`src/icon-quads.js`, `boxModelView` in `src/icon-cube.js`). Turned (types 0, 31, 39, 26, 16) and un-turned types (stairs, fence, gate, beacon, anvil, wall, egg, cactus) are handled per item.
- Item ids that map to blocks (1103 and the other ItemBlock/ItemSlab/ItemMultiTexture ids) fold to the block id (`itemBlockId` in `src/item-boxes.js`) for icons, hand, third-person hand and drops.
- Chest family (54, 146, 130): new probe `tools/probes/ChestItemProbe.java` executes the unchanged chest item path with the stub GL11 (now with scale, push/pop and display lists). `tools/verify-chest-item.mjs` writes `public/research/chest-item-reference.json` with class hashes. `src/chest-item-model.js` holds the transform prefix and the model boxes; the port raster matches the native raster pixel for pixel.
- Flat sprite icons use the GL pixel-centre edge model (`softIcon(..., true, 70)`).
- Cube top face now follows the executed uv rule (old orientation was inconsistent with it).

## Verification
- Focused tests, run one command at a time: icon-quads, item-render, gate-item, icon-exact, icon-cube, chest-icon, atlas-texels, render-types-2, module-names: 35/35. block-textures*: 2/2. The 37-file set that references block-textures, first-person, atlas-texels, render-shapes, drop-renderer, player-renderer, item-boxes or chest-renderer: 320/320.
- Muted headless Chrome (Playwright, `--mute-audio`, `?silent`, master volume 0): an icon grid at 192 px and the inventory GUI. Slabs, carpet, plates, stairs, fence, gate, beacon, anvil, chests, egg and cubes all look right. The only console error was one 404 resource load (not investigated).
- The full suite and the build were left to the lead.

## Follow-ups (proposed gap lines)
- Chest hand/drop model uv orientation is not compared against native; only the GUI icon is.
- Cactus (13) and piston (16) item hand models were not separately checked against native.
- Item sprites in the hand (3D extruded) were not touched.
- The one 404 in the browser console was not traced.
