# Block atlas layout and cube icon edges (batch 42, iconedges)

Target 1.7.10. Parity is not claimed; this lists what was executed and what was derived.

## Stitched atlas layout (executed)

`tools/verify-stitcher.mjs` runs the unchanged client `Stitcher` (bpv, Holder bpw, Slot bpx) and `TextureAtlasSprite.initSprite` (bqd) through
`tools/probes/StitcherProbe.java`, over the sprite sets the executed `Block.registerBlockIcons` / `Item.registerIcons` register
(`TextureMap.registerIcons`: every non-air block, destroy_stage_0..9 and itemframe_background (bytecode-read names), missingno last).
`public/research/stitcher-reference.json` holds the result: block atlas 512x256 with 349 sprites, item atlas 256x256 with 212 sprites. The layout
is the same for mip levels 0..4. `src/atlas-layout.js` is generated from it.

The port's terrain atlas uses the native positions (`TILE_ORIGINS`, `tileOrigin`); tiles the port has but the game does not (and slots the port
leaves empty) take free 16 px cells. Sprite uv is `TextureAtlasSprite.getMinU/getMaxU` with the 0.01 px inset (`initSprite`, float32):
`tileRect(index)` returns it by default, `tileRect(index, 0)` the geometric span. Mesher, particles and icons read positions only through
`tileOrigin` / `tileRect` / `tileAtUv`. Tests: `src/atlas-layout.test.js`.

Not done: the item atlas is recorded but the port keeps drawing item icons from its own sheets; water_flow/lava_flow (32 px), lava_still, fire layers,
destroy stages and missingno are empty in the port atlas; leaves_*_opaque are not separate sprites; GL_MAX_TEXTURE_SIZE is assumed 16384.

## Cube icon edges

`RenderItem.renderItemIntoGUI` for a render type 0 block: the GL11 call sequence is bytecode-read (not executed; `Tessellator.draw` needs GL).
`src/icon-cube.js` composes it in float32 like the GL matrix stack; `tools/probes/IconEdgeProbe.java` composes it independently and rasterises the
three visible faces (west x=0, south z=1, top) with pixel-centre sampling, no MSAA, nearest texel, for scales 1..6 and drops 0/8/14.
`public/research/icon-edge-reference.json` is its output (`node tools/verify-icon-edges.mjs`); `src/icon-cube.test.js` compares the port's
`rasterIcon` in `gl` mode (pixel centre inside the face parallelogram, top-left tie rule, binary coverage, full texel alpha) pixel for pixel.
Executed: the probe. Bytecode-read: the call sequence and the GL projection (`glOrtho(0, W, H, 0, ...)`, one GUI pixel = `scale` pixels).
Derived: GL rasterization rules (pixel centre, top-left). Not modelled: mip LOD choice, GL lighting shades (0.2 / 0.08 stay as in the port),
hardware subpixel snapping, depth test (the three faces never overlap on screen). The old icons were approximations (matrices off by up to a pixel,
4x4 coverage); the west face now uses tile face 1 instead of 0. The top face's tile orientation is kept from the port and not verified independently.
Cube icons are rasterised at scale 4 (64x64) and scaled by CSS at other GUI scales; flat and other icons keep the 64x70 layout.
