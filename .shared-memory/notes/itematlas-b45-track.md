# itematlas b45 track

## Summary
- Item atlas layout and uv are now recorded from the executed Stitcher. `tools/verify-stitcher.mjs` already ran the unchanged `Stitcher`/`TextureAtlasSprite.initSprite` for the item map (256x256, 212 sprites); it now also writes the item uv (`minU/maxU/minV/maxV`, 0.01 px inset) into `public/research/stitcher-reference.json` and generates `src/item-atlas-layout.js` (name -> [x, y, size]).
- `tools/probes/AtlasProbe.java` and `tools/verify-atlas.mjs` now also run the unchanged `TextureUtil.generateMipmapData` / `anaglyphColor` over every `textures/items/*.png` (563 textures in `atlas-reference.json`, was blocks only); `src/atlas-texels.test.js` checks the port's PNG decode, mip chain and anaglyph conversion of the shipped item sprites against it.
- The port draws item sprites from one item atlas (`src/item-atlas.js`): a 256x256 canvas texture laid out at the executed positions (scaled by sprite resolution for HD packs), each sprite a Texture sharing the atlas Source with `userData.st`, the native uv window (`itemSpriteUv`, float32 as `initSprite`). `pixelTexture` returns these for `/media/1.7.10/items/<laid-out name>.png`. `entityMaterial` (held, dropped, third-person, item frame, mob equipment), `glintMesh` and the projectile `worldMaterial` (`uvTransform`) apply the window to the geometry's 0..1 uv (ShaderMaterials ignore `Texture.matrix`); `uniforms.map.value` is an accessor so a swapped map moves the window. Resource refresh and the Anaglyph toggle reload the sprite images and re-upload the atlas.
- Cactus inventory icon (render type 13): `cactusIconQuads` in `src/icon-quads.js` (the executed `CACTUS_ITEM_QUADS`: full top and bottom, sides inset 1/16, no 90 degree turn) used by `boxIcon`; the icon raster equals the raster of the recorded Tessellator draws pixel for pixel (`icon-quads.test.js`).

## Verification
- `node tools/verify-stitcher.mjs`, `node tools/verify-atlas.mjs` (JDK probes, rerun; item-only changes in the reference files).
- `node --test src/item-atlas.test.js src/atlas-layout.test.js src/atlas-texels.test.js src/icon-quads.test.js src/item-render.test.js src/item-sprite.test.js src/hand-models.test.js src/item-entities.test.js src/icon-cube.test.js src/light-material.test.js src/render-types.test.js src/leather-items.test.js src/projectile*.test.js src/module-names.test.js`: 121/121. `npm run build` ok. Full suite not run.
- Muted headless Chrome (CDP, `--mute-audio`, `?silent`, vite port 5533, both closed): a held apple in a new world samples the right atlas cell, no page exceptions. Dropped sprites fell into water in that run and were not seen; item frames, glint, projectile particles and HD packs were not checked in a browser.

## Follow-ups (proposed gap lines)
- Item sprites sample the atlas with GL_NEAREST and no mip chain; native item mip levels (and the bleed between neighbouring cells they allow at range) are not modelled.
- An HD pack scales the 16 px cells up instead of re-running the Stitcher with mixed sprite sizes; animated item sprites (compass, clock, pack strips), skulls, spawn eggs, leather and potion composites, and block-atlas sprites used as items (flowers, torch, web, bars) still use their own textures and are not cells of the item atlas.
- The item atlas canvas is converted for 3D Anaglyph at upload by a canvas read, so translucent item texels round like other canvases (the per-image exact path is not used).
- Inventory icons (DOM images) are not atlas samples; only 3D sprite draws are.
- Pistons (16) keep the cube inventory icon.
