# Batch 65 terrainatlas: HD resource packs for the terrain atlas

## Summary
- `src/terrain-layout.js` (new, pure): `terrainLayout(tiles, known, {maxSize, mip})`. With every tile at its vanilla size it returns the executed 512x256 layout (the old free-cell code for the three chest faces moved here unchanged). Otherwise it stitches all 349 native sprites at the pack's sizes with `stitcher.js` (unseen sprites keep their vanilla size, like the item sheets), puts the port-only tiles into free cells of that atlas (so native positions equal the executed Stitcher), and only stitches them in when nothing is free. The Stitcher gets the mip setting itself (as the probe's `bpv(..., mip)`); the levels uploaded are capped by the smallest sprite (`mipCap`). A pack that does not fit `GL_MAX_TEXTURE_SIZE` retries at half, quarter ... sprite sizes (min 16 px), then vanilla, instead of the native crash.
- `src/block-textures.js`: `TILE_ORIGINS`, `ATLAS_WIDTH/HEIGHT/ROWS` are live `export let` bindings; new `TILE_SIZES`, `tileSize`, `setTerrainSizes`, `terrainLayoutState`, `terrainMipCap`. `tileRect`/`tileAtUv` use each tile's size (0.01 px inset as `initSprite`). `createBlockAtlas` reads the pack images' frame sizes, re-lays out in `redraw()`, resizes canvas and both DataTextures, draws every tile 1:1 at its size (frameTile, chest faces, tints, Anaglyph, sub-rect uploads), builds mip chains per tile (so animated frames carry their chains at the pack size), caps levels by the smallest sprite, and makes inventory cube/flat icons from the HD bytes. `onRelayout` and `setMaxTextureSize` are new atlas members.
- `src/chunk-mesher.js`: the torch's pixel-unit uv scales by the tile size (the only direct `tileOrigin` user).
- `src/mesh-pool.js`, `src/mesh-worker.js`: new message `terrainLayout {sizes, maxSize, mip}` posted to a lane before its next job when the layout version changed; the worker runs the same stitch.
- `src/scene.js`: passes the GL max texture size, and on relayout marks every chunk dirty.
- Tests: `src/terrainatlas-b65.test.js` (vanilla layout pinned against the old code and the executed 349-sprite JSON, executed HD cases for native sets, port-only placement, mixed sizes and mip cap, size fallback, live uv, torch uv), `src/terrainatlas-dom-b65.test.js` (stubbed DOM: resize, notify, mip levels, reload back to vanilla).

## Evidence
- Executed: Stitcher positions/atlas sizes/mip limit for the HD cases (`stitcher-reference.json` hdCases, replayed over the 349 native names), vanilla blocks layout.
- Bytecode-read (earlier batches): Stitcher, initSprite. Recalled: that water/lava/fire are drawn from their own strips (scene.js `animated`/`opaque`), not the chunk atlas; they already take the strip's own size, so only `portal` and pack tiles animate inside this atlas.
- Not executed: the port-only chest faces have no native counterpart; their placement is a port decision.

## Verification
- `node --test` one file at a time: terrainatlas-b65 8, terrainatlas-dom-b65 1, stitcher-b64 5, item-atlas-hd-b64 6, atlas-layout 6, block-textures 2, block-animation 1, atlas-texels 6, mesh-worker 4, particles 9, item-render 6, rendering-b58 5, render-types 1, render-types-2 1, display-quads-b53 10: all pass. `npm run build` ok. `node --check` on each touched file. Full npm test not run (batch rule).

## Follow-ups
- Only a browser could show: HD pack tiles sharp and unshifted in chunks, held items, particles, icons; relayout remesh on pack switch; texture re-upload after resize; very large packs on real GL limits.
- Objects that bake `tileRect` at build time (cached held-item/drop meshes, hand models) may keep old uv until rebuilt after a pack switch; not audited. A chunk meshed by a worker with the old layout just before a switch is remeshed by the dirty pass but a late old result could land after it.
- `item-atlas.js` keeps its own blocks sheet stitched from the sprites it saw; natively one map. A shared helper (this module) could unify them (itemsprites2 side).
- Leaf `_opaque` variants are not separate sprites (the cell takes the larger of the two sizes). Unseen native sprites (destroy stages, flows) stay vanilla size, not pack size.
