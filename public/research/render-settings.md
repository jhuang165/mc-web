# Video render settings (1.7.10)

Evidence is the 1.7.10 client JAR (obfuscated names: bbj GameSettings, bao Minecraft, blt EntityRenderer, bma RenderGlobal, blm RenderBlocks, bny RenderItem, bno Render, bpz TextureMap, bqi TextureUtil). Code: `src/render-settings.js`, `lighting.js`, `scene.js`, `block-textures.js`, `sky.js`, `weather*.js`, `drop-renderer.js`. Tests: `src/render-settings.test.js`.

Saved device settings: `graphics` (true = Fancy), `ao` 0..2, `clouds`, `mipmapLevels` 0..4, `anisotropic` 1..16. Defaults match GameSettings: Fancy, Smooth Lighting Maximum, Clouds on, Mipmap Levels 4, Anisotropic Off.

## Verified against bytecode
- Fast graphics: leaves use the `*_opaque` textures and are opaque cubes, a leaf face next to another leaf is culled (BlockLeaves). Translucent layers draw as one blended pass rather than the colour-mask depth pre-pass. Rain/snow radius is 5 instead of 10, and rain splash strength is halved (EntityRenderer). Entity shadows draw only in Fancy. Sprite items are flat billboards (+-0.3 copies, yaw 180 - playerViewY) rather than extruded slabs.
- Smooth Lighting: RenderBlocks picks the flat path at ao 0 (one neighbour-cell brightness per face, shades 0.5/1/0.8/0.6). At ao 2 a block whose bounds are not a full cube takes the partial path (bilinear interpolation of the cell-corner values by the bounds); otherwise the full path is used, so Minimum and Maximum differ only for such blocks. Changing the option rebuilds chunk meshes.
- Clouds: GameSettings.shouldRenderClouds is `renderDistanceChunks >= 4 && clouds`. The toggle was not wired before; it is now.
- Mipmaps: TextureMap mipmaps each sprite on its own; generateMipmapData averages 2x2 texels in gamma 2.2 when the sprite has no fully transparent texel, otherwise skips transparent texels, divides by 4 and zeroes alpha below 96. Min filter is NEAREST_MIPMAP_LINEAR when levels > 0, mag NEAREST. 16 px tiles on 16 px offsets never bleed up to level 4.

## Approximated or limited
- Fast clouds: flat layer of 8 block texels at alpha 0.8, without culling; geometry follows the bytecode loosely and was not compared pixel by pixel.
- The vignette is Fancy-only natively; the port draws none, so there is nothing to switch.
- Mipmaps cover the block atlas only. Items, entities, particles and GUI textures stay unmipmapped. Level 0 output is pixel-exact (no mip data, linear filtering unchanged).
- Mipmap level 4 is the native default, so the distant-terrain look differs from earlier builds; set Mipmap Levels to OFF for the old look.
- Anisotropic filtering needs EXT_texture_filter_anisotropic and is clamped to the GPU maximum; it applies to the block atlas only.
- three.js user mip levels use immutable storage, so the atlas texture is recreated whenever the level count changes.
- Mesher differences are covered by lighting-level unit tests (flat/partial faces) rather than full chunk-mesh tests, which need a WebGL scene.
