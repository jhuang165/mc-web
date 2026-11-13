# Batch 57 displaypixel: display lighting pixel check, held-item lighting, block item sprite sweep

## Summary
- `src/light-material.js`: the entity shader now clamps after the tint: `min(1, tint * (0.4 + 0.6 * sum N.L))`, as fixed-function lighting with glColorMaterial does. Before, it read `tint * min(1, lit)`, so any tinted face lit above 1 (top faces: a minecart display block at brightness 0.37, leaves and grass block items in hands and drops) was too dark (up to 39 levels). `vDiffuse` is capped at 2 (not 1) so the unlit regex replacements in `hanging-renderer.js` and `player-renderer.js` still match. Untinted entities read the same.
- `src/flat-block-items.js` (new), `src/first-person.js` (`itemTextureRaw`), `src/block-textures.js` (`flatBlockTileUrl`, lily pad in `flatIcon`): block items whose render type fails `renderItemIn3d` are sprites. The port drew ladder, rail, powered/detector/activator rail, lily pad, vine, mushrooms, dead shrub, fern, tall grass (untinted media file), double plants and the stained glass pane as cubes in hands, drops, item frames and third-person hands. They are now sprites of the tinted item atlas tile (PNG data URL, cleared with the icon cache). The hopper block item is the item atlas sprite `hopper`. The inventory icon of the lily pad was a cube too; now flat.
- `tools/probes/DisplayPixelProbe.java`, `tools/verify-display-pixel.mjs`, `tools/probes/displayquads/.../GL11.java` (added glLight, glLightModel, glColorMaterial, glShadeModel recording), `tools/verify-display-pixel-render.mjs`, `tools/display-pixel/harness.{html,js}`, `src/display-pixel-cases.js`, `src/display-pixel-b57.test.js`, `public/research/display-pixel-reference.json`, `public/research/display-pixel-render.json`.

## Evidence
Executed (real 1.7.10 classes): `Item.getItemFromBlock`, `Block.getRenderType`, `RenderBlocks.renderItemIn3d`, `Block.getItemIconName` for blocks 1..255 (170 records; only the hopper and the skull return an icon name); `RenderHelper.enableStandardItemLighting` GL calls: lights 0 and 1 at (0.2, 1, -0.7) and (-0.2, 1, 0.7) normalised, diffuse 0.6, light ambient 0, model ambient 0.4, `glColorMaterial(FRONT_AND_BACK, AMBIENT_AND_DIFFUSE)`.
Port pixels (headless Chrome 157, swiftshader, `--mute-audio`, vite port 5704, killed afterwards): 264 cases through the real `entityMaterial`, `createLighting` lightmap texture and `shadeDisplay`: drops/frames (glColor 1), minecart display (0.37), a tinted leaves block with and without 0.37, six face normals, five light cells, two lightmap states, and 24 held-item views. All within 0.5 of a level of texel * min(1, glColor * lit) * lightmap texel. The old shader differed by 26.9 (cart) and 38.8 (tinted item). These are port pixels against formulas; no native pixels were captured (no LWJGL). The GL lighting equation and 8-bit rounding are recalled, not executed.
Bytecode-read: `ItemRenderer.renderItemInFirstPerson` (bly.a(float)) rotates by the interpolated pitch (x) then yaw (y), calls `RenderHelper.enableStandardItemLighting`, pops, then reads `World.getLightBrightnessForSkyBlocks(floor(posX), floor(posY), floor(posZ), 0)` and sets the lightmap coordinates. `BlockHopper.getItemIconName` returns "hopper" (aln.O()).

## Verification
- `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node tools/verify-display-pixel.mjs` (171 records); `node tools/verify-display-pixel-render.mjs 5704` (264 cases).
- `node --test src/display-pixel-b57.test.js`: 8 pass.
- Tests importing light-material, first-person, block-textures, drop-renderer, item-boxes, hanging-renderer, player-renderer, held-sprite: 379 pass, 0 fail.
- Full npm test not run (batch rule). Build: see the track report.

## Follow-ups
- Held light: the lights are executed-equal (the player's yaw rotation turns the two lights into each other, so the sum is unchanged). The cell is the port camera's floor (interpolated eye) against the native current-tick posY; a mismatch only mid-tick at a cell border. Not changed.
- The hopper inventory icon is still the cube (the inventory path draws block items through `iconRaw`); held, dropped and framed hoppers are the sprite.
- The tall grass item sprite now carries the grass tint for metadata 1 and 2; metadata 0 (dead shrub) is port id 83 and untinted, native white.
- Fluids, fire, cocoa, crops have native ItemBlock ids with no way to get them; left as is.
- No native pixel capture of a display; lightmap values come from `lighting.js`, already executed in earlier batches.
