# atlas3 b35 track

## Summary
- Atlases from exact pixels: `src/atlas-pixels.js` (new) plus `block-textures.js`. The item and terrain atlases are `DataTexture`s filled from decoded PNG bytes (fetched beside the Image, `decodePng`); no 2D canvas rounding on translucent pixels. Canvas path remains per tile only as a fallback (undecodable PNG, failed fetch) and for icons. Mips are built per tile from the raw sprite; Anaglyph (item atlas) converts each level, then multiplies the float tint (no byte rounding). The upload hook skips arrays flagged `__agDone` (`anaglyph.js`).
- Native probe `tools/probes/AtlasProbe.java` + `tools/verify-atlas.mjs` -> `public/research/atlas-reference.json` (unchanged `bqi.a(int,int,int[][])` and `bqi.a(int[])`, 349 jar block textures, mip settings 0/1/4). Test hashes match every level.
- Real bug found and fixed: `render-settings.js` `mipLevel` was off by one on some texels (Java float arithmetic and two different expressions for the opaque and transparent branches).
- Chunk vertex colours are Tessellator bytes (`(int)(c*255.0f)`, bytecode-read of `bmh.b`): `Mesher.colors()` quantises `shade` (main and worker path).
- Goal 3 re-check: vertex-colour, font-table and sunrise Anaglyph conversions were already ported (batches 28 to 30); stale header comment in `anaglyph.js` fixed. No WorldProvider branch exists.
- Touched: `atlas-pixels.js` (new), `block-textures.js`, `anaglyph.js`, `render-settings.js`, `chunk-mesher.js`, `mesh-region.js` (one line), tests `atlas-pixels.test.js` (new), `post-shaders.md`. `scene.js` untouched.

## Verification
- Focused: `node --test src/atlas-pixels.test.js` 6/6; render-settings, block-animation, block-textures, anaglyph*, atlas-upload, texture-animation, mesh-worker all pass. A full `npm test` was started but killed (exit 144) at test 1049 of the run with no failure printed; it was not re-run on the lead's throttle request, and `npm run build` was not run. The lead runs both after merge.
- Browser (muted headless Chrome, SwiftShader, vite 5365, `artifacts/b35-atlas3/check.mjs`, `result.json`, `off.png`, `on.png`): GPU readback of item and terrain atlas, levels 0-4, Anaglyph off / on / off: 0 mismatching bytes (terrain compared with the converted CPU data when on); `ice` tile (256 translucent px) equals the decoded PNG. Screenshots show the expected red/cyan output. One optional-resource 404 in the console.
- Not measured: the native TextureMap stitched layout (port keeps its 16-column grid; evidence is per sprite level), pixel comparison of whole frames against a native frame.

## Follow-ups (proposed gap lines)
- "Atlas icons (DOM item and block icons) are still drawn through a 2D canvas (premultiplied rounding on translucent pixels)."
- "Chunk vertex colour byte quantisation matches Tessellator, but AO and light products upstream are computed in doubles, not Java floats."
- "Atlas layout is a fixed 16-column grid, not the Stitcher layout; per-sprite pixels and mips match, positions do not."
- Item atlas tint is baked per level (native: GL multiplies the vertex colour at draw time); HD pack tiles are nearest-sampled to 16 px.
