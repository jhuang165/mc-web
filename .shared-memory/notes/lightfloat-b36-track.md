# lightfloat b36 track

## Summary
- Native evidence for RenderBlocks colours: `tools/probes/LightFloatProbe.java` + `tools/verify-light-float.mjs` run the unchanged `blm.b` (render type 0 blocks) with the real Tessellator over 168 random neighbourhoods at AO 0/1/2 and record vertex colour ints, brightness ints and the per-block `aji.m/I/l/n` tables with class hashes (`public/research/light-float-reference.json`, 11160 vertices).
- `src/light-float.test.js` replays them through the new `ChunkMesher.meshBlock` and compares vertex colour bytes and light coords exactly: 10776 vertices, 0 differences. It also checks the four block tables for all ported blocks below id 179.
- Real bugs fixed (details in `public/research/post-shaders.md`, "Batch 36"): wrong AO-solid and corner-open block sets, neighbour-brightness blocks read a sixth cell (below) in `lighting.js`, `mesh-region.js` and `away-light.js`, emitters took the AO path, east/west AO corner fallback edge, half-slab vertex side, and the partial-bounds path interpolating top and bottom faces.
- Float: AO sums, shade and tint products are `Math.fround`ed as the bytecode does. No fixture byte changed from the old double sums.
- DOM icons: an icon with a translucent face texel (ice, stained glass, stained glass panes) is composed from exact tile bytes (`atlas-texels.js` `rasterIcon`, `encodePngStored`) instead of the premultiplied 2D canvas. Opaque icons keep the canvas path. Anaglyph (":ag") works as before.
- Touched: `src/chunk-mesher.js` (`meshBlock` split out of `meshColumn`, flat path for emitters), `src/lighting.js`, `src/mesh-region.js` and `src/away-light.js` (neighbour brightness, two lines each), `src/atlas-texels.js`, `src/block-textures.js`, `public/research/post-shaders.md`; new `src/light-float.test.js`, `src/icon-exact.test.js`, the probe, verify script and reference JSON.

## Verification
- Native probe run with `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research` (client SHA1 asserted): 168 fixtures, 11160 vertices.
- Focused tests, one at a time, all passing: `light-float` 2/2, `icon-exact` 4/4, `lighting` 9/9, `render-settings` 10/10, `block-light` 3/3, `mesh-worker` 4/4 (it failed 2/4 until `mesh-region.js` got the same neighbour-brightness fix), `native-light` 32/32, `native-light-ring` 16/16, `streaming-light` 2/2, `streaming-light-native` 8/8, `streaming-light-ring` 7/7, `light-slicing` 3/3, `away-commands` 13/13, `block-textures` 2/2, `atlas-texels` 6/6, `anaglyph` 5/5, `anaglyph-gui` 4/4, `anaglyph-gui2` 5/5.
- Meshing time (`artifacts/b36-lightfloat/mesh-bench.mjs`, 8 columns, fancy, median of 9; load average 22 to 26 on a shared machine, so noisy). Base: AO0 81.5/69.7 ms, AO1 127.9/124.2, AO2 114.9/105.1. New: AO0 60.0/77.2, AO1 123.8/112.5, AO2 127.2/112.6 (two runs each). Within the 10 percent band given the noise.
- Browser (headless Chrome `--mute-audio`, `?silent`, vite 5374, `artifacts/b36-lightfloat/icons-check.mjs`, `icons-anaglyph-check.mjs`, `icons.png`): stained glass pane icon 3364/3364 pixels equal the decoded PNG texels; with Anaglyph on 3364/3364 equal the converted texels and the icon url is tagged `:ag`; ice and stained glass cube top faces equal the PNG texels. The canvas atlas drifted by 1 on 246 ice texels and 256 pane texels before. One unattributed 404 console message during load (not from icons).
- Full suite and build left to the lead.

## Follow-ups (proposed gap lines)
- Face culling differs from `shouldSideBeRendered` in six probe neighbourhoods (stained glass beside another colour, slab and cake beside partial hiders); `hides` still treats glass as opaque.
- The probe covers render type 0 only; stairs, fences, fluids, cactus, doors, torches and the other render types are still unprobed for vertex colours and light ints.
- Cube icon edges use 4 x 4 coverage, not the canvas's exact anti-aliasing, and only icons with translucent face texels take the software path; anvil, stair, fence, chest and bed icons stay on the canvas.
- The slab "light 0 re-queries the cell below" rule in `aji.c(ahl, x, y, z)` is not ported (the fixtures never hit it with a nonzero result).
- Light-affecting blocks whose emission depends on state (lit furnace, powered repeater) are checked through their lit flag, not the table.
