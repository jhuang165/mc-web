# packs4 (batch 17, resource packs round 4)

Branch b17-packs4.

## Changed
- `src/block-textures.js`: `createBlockAtlas().animate(tick)`; strip block tiles with a `.png.mcmeta` animation section animate (frame rule = `texture-animation.js`, probed in batch 15; no new probe needed, 1.7.10 has no interpolate). Only changed tiles are redrawn in both canvases, upload only on change. Tiles without strips never fetch an mcmeta.
- `src/scene.js`: one line in `render()` calling `this.textures.animate?.(tick)`.
- `src/drop-renderer.js`, `src/hanging-renderer.js`: item frame tag in the pile/item key, so dropped items and item frames switch frames.
- `src/menu-panorama.js`: `preserveDrawingBuffer: true` so F2 composition can read the panorama canvas (`screenshot-compose.js` comment updated). Not browser-verified.
- Docs: `public/research/resource-packs.md`. Test: `src/block-animation.test.js`.

## Findings
- Vanilla 1.7.10 block mcmeta files: water_still/flow, lava_still/flow, portal, fire_layer_0/1 only (no command block or sea lantern animation).

## Remaining gaps
- No GPU sub-rect upload (full small atlas upload on change).
- Mob / third-person held items do not tick; invalid pack mcmeta keeps first frame instead of the missing texture.
- Panorama F2 fix and in-browser animation unverified.

## Proposed remaining-gaps text
- Item 8: "Block atlas tiles and dropped items / item frames animate from pack `.png.mcmeta` (batch 17); only mob and third-person held items still freeze on build, and the atlas re-uploads whole (not sub-rect) on a frame change."
- Item 9: "F2 composes the title panorama via `preserveDrawingBuffer` (batch 17, untested in a browser); other WebGL-in-DOM canvases would still come out blank."
