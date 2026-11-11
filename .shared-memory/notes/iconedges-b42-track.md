# iconedges (batch 42 track)

Branch `batch42-iconedges`, cut from a41fdcff3 (0.70.0). Details: `public/research/atlas-stitcher.md`.

## Summary
- Atlas: the unchanged 1.7.10 Stitcher was executed (`tools/probes/StitcherProbe.java`, `tools/verify-stitcher.mjs`) over the block and item sprite sets. Blocks 512x256 / 349 sprites, items 256x256 / 212 sprites, identical for mip 0..4. The port's terrain atlas now uses the native positions (`src/atlas-layout.js`, `tileOrigin`, `tileRect` with the native 0.01 px uv inset). Mesher, particles, icons and tests were moved off the old 16-column grid math.
- Cube icons: `src/icon-cube.js` composes the bytecode-read renderItemIntoGUI matrices in float32. `rasterIcon` has a `gl` mode (pixel-centre test, top-left rule, binary coverage). Cube icons are 64x64 at scale 4 and always use the exact software path. The reference is `tools/probes/IconEdgeProbe.java`, an independent Java implementation (not the game's code, since Tessellator.draw needs GL), written by `tools/verify-icon-edges.mjs`. Executed: the probe. Bytecode-read: the GL call sequence. Derived: GL raster rules.
- Left cube face now uses tile face 1 (west) instead of 0; the top face never takes the slab/layer drop crop.

## Verification
- `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node tools/verify-stitcher.mjs` -> blocks 512x256 349 sprites, items 256x256 212 sprites.
- `node tools/verify-icon-edges.mjs` -> 54 face rasters.
- `node --test src/{atlas-upload,atlas-texels,atlas-layout,block-textures,chest-icon,icon-exact,icon-cube,first-person-pose,hanging,render-types,render-types-2,render-types-pos,mesh-worker,particles,block-animation,light-float,slab-light}.test.js`: 66 pass, 0 fail.
- `node --test $(grep -l "block-textures\|atlas-texels" src/*.test.js)` (26 files): 163 pass, 0 fail.
- No full npm test, no build, no browser. Load average 3.9 at the final run (about 8.6 earlier).

## Follow-ups
- Item atlas is recorded but unused by the port. water_flow/lava_flow (32 px), lava_still, fire layers, destroy stages, missingno are empty slots; leaves_*_opaque are not separate sprites. GL_MAX_TEXTURE_SIZE assumed 16384.
- Not modelled: mip LOD for icon texels, GL lighting shades (0.2/0.08 kept), hardware subpixel snapping.
- Top-face tile orientation is unverified. Flat and other icons keep the 64x70 layout and 4x4 edge coverage. CSS nearest-scales the 64x64 cube icon at other GUI scales.
- Other tracks using 16-column atlas math must use `tileOrigin` / `tileRect` (ATLAS_COLUMNS is now 32).
- The real renderBlockAsItem is not executed; a stub GL could execute it.
