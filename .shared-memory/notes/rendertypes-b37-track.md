# Batch 37 track: rendertypes

## Summary
- New native probe `tools/probes/RenderTypesProbe.java` runs the unchanged 1.7.10 RenderBlocks and Tessellator for render types 1, 2, 4, 6, 7, 8, 9, 10, 11, 13, 14, 18/41, 20, 23, 31, 39 plus irregular cubes, at AO off/on/smooth. `tools/verify-render-types.mjs` writes `public/research/render-types-reference.json` (354 fixtures, 28656 vertices). `src/render-types.test.js` replays it through `ChunkMesher.meshBlock`; vertex order within a quad is not compared (sets per face).
- Mesher fixes (`chunk-mesher.js`, `fluids.js`, `fences.js`, `lighting.js`, `block-textures.js`): doors always drawn and flat-lit, fence x bars, log/hay/quartz uv turns, fluid uv/two-sided sides/brightness/corner heights, crossed squares, torches, crops, double plants, slab, cake, stairs and stained glass culling, pumpkin and workbench faces, bed flat light.
- The six batch 36 culling neighbourhoods now match; `CULLING_KNOWN` is empty.
- Exact at 100% of recorded vertices for all types except the table in `public/research/post-shaders.md` (Batch 37): fences (36 and 12 native-only vertices), vine, bed (288/480), panes, lily pad.
- Goal 3 (slab light-0 rule) not done.

## Verification
Focused runs, one at a time, all passing: render-types 1, light-float 2, block-textures 2, atlas-texels 6, fence 6, fluids 32, lighting 9, mesh-worker 4, render-settings 10, anaglyph 5, doors-panes 8, stairs 14, stems-cake 6, shaped-blocks 13, crops 10, module-names 1. The full suite and the build were left to the lead.
Browser: muted headless Playwright (`artifacts/b37-rendertypes/smoke.mjs`, port 5371, load average 5.8): a new world loads and renders (screenshot `world.png`); the only console error is one 404 on a resource (not identified, no module error, likely a missing static asset). The check is a load check, not a visual comparison of each render type.

## Follow-ups (proposed gap lines)
- Port `renderBlockPane` (types 18/41) segment by segment; panes are 0 of 612 native vertices exact.
- Vine (106) quad structure, lily pad (111) quads and light, bed (26) uv and light still differ from native.
- Fence top and bar-end faces against opaque neighbours are drawn natively and culled in the port (invisible).
- Slab "light 0 re-queries the cell below" in `aji.c(ahl,x,y,z)` is not ported.
- Types not probed: 3 (fire), 5 (redstone wire), 12 (lever), 15 (repeater), 16/17 (pistons), 19 (stem), 21 (fence gate), 22 (chest), 24 (cauldron), 25 (brewing stand), 26 (end portal frame), 27 (dragon egg), 28 (cocoa), 29/30 (tripwire), 32 (wall), 33 (flower pot), 34 (beacon), 35 (anvil), 36 (redstone diode), 37+ (comparator, hopper, daylight).
