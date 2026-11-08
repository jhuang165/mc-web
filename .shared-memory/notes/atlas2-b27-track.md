# atlas2 b27 track

## Summary
- GPU sub-rect atlas upload (`src/atlas-upload.js`, `block-textures.js`): changed animated tiles and mips 0-4 via batched `texSubImage2D`; 64 animated tiles: about 41-44 ms to about 8.3 ms per tick (SwiftShader); GPU readback 0 mismatches. `scene.js` got a 2-line hunk (import and `setUploader`), outside light code.
- Compass/clock pack paths verified headless (`tools/make-test-pack.mjs`); fixed the framed/dropped clock stuck on the raw strip (frame tag 0 collision, `maps-clock-live.js`).
- 3D Anaglyph ported at native points (`src/anaglyph.js`: upload hook; fog/sky/cloud via `anaglyphFog`; merge is channel masks; toggle refreshes resources). Legacy method behind `post.legacyAnaglyph`. `scene.js` hunks: import lines, hook install after `PostProcessor`, three conversions at fog/sky/cloud (the fog line is next to, not inside, light wiring).
- Overlays (underwater, pumpkin/inside block, fire): bytecode re-read, no differences; numbers in `fire-fx.md`.

## Verification
- `npm test` and `npm run build` in the worktree (counts in the final reply).
- Headless muted Chrome, port 5277, `?silent`: artifacts in `artifacts/b27-atlas2/` (bench-pack64.json, anaglyph-*.png, anaglyph-stats.json, pack-*/vanilla-* compass screenshots). Native vs legacy anaglyph mean abs diff 2.19/255.
- Overlay browser capture did not reach the water/block states; overlay claims rest on bytecode.

## Follow-ups
- Proposed gap lines: "Anaglyph does not convert RenderBlocks vertex colours (biome tints), the font colour table, sunrise colours or the DOM GUI."; "Overlay (underwater/pumpkin/fire) pixel capture against a native frame is still missing."
- Compare anaglyph against a native frame; port the RenderBlocks conversions in `tint()` (needs a remesh on toggle).
