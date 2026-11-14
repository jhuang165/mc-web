# Batch 66 atlasunify: one blocks map, uv rebake on a layout change

## Summary
- `src/item-atlas.js`: `bindTerrainAtlas(atlas)` (called by `scene.js` after `createBlockAtlas`). A block sprite (`/media/1.7.10/blocks/<tile>.png` that is a terrain tile) is now a sibling DataTexture sharing the grey `terrain` atlas Source, with `userData.st` from `TILE_ORIGINS`/`TILE_SIZES`/`spriteUv` (HD sizes included), filters and mip levels mirrored by getters, and disposed together with the terrain texture. `blockSpriteUv/Transform` read the same cells. The item sheet stays separate. Without a bound atlas (tests, no DOM) the private blocks sheet still works.
- `src/block-textures.js`: removed `flatBlockTileUrl` and `flatTileImpl` (no caller or test left); added `onTerrainRelayout(fn)` and `terrainLayoutVersion()`.
- New `src/uv-rebake.js`: `trackUv`, `trackCubeUv`, `trackUvArray` re-run a geometry's uv fill on every layout change (weak registry). Used by `first-person.js` (block cube, cactus, box lists: held, dropped, drop cache, minecart contents), `player-renderer.js` (held and armour-slot cubes), `mob-equipment-renderer.js` (pumpkin head), `enderman-renderer.js` (carried block), `hanging-renderer.js` (item frame planks), `cart-display-shape.js` (hopper shape).
- Per-frame builders (chunks via dirty pass, falling blocks, particles) already read the layout each use. Cached with a key: `scene.js` moving block cache `sig` now starts with the layout version (uv lookup only; mppistons neighbour), `screen-overlays.js` inside-block quad rebuilds when the version changes.
- Late worker result race: `scene.js meshRequest` records the layout version at send and drops (`current: false`) a result meshed under an older one; the relayout already marks the column dirty, so it is meshed again.
- Anaglyph of tinted sprites: no change needed (see Evidence).

## Evidence
- Bytecode-read: `bny` (RenderItem) and `bly` (ItemRenderer) never reference `blt.a` (EntityRenderer.anaglyphEnable) nor the `(30r+59g+11b)/100` transform; their glColor4f sites take the raw colour. Only RenderBlocks (`blm`, cubes) converts the multiplier. So the item tint is raw and only the texture is converted at upload (TextureUtil.anaglyphColor). The port does the same: the terrain DataTexture bytes convert in the GL upload hook (`anaglyph.js`), the tint stays unconverted. The b65 follow-up worry is wrong.
- Recalled: native `TextureMap` of blocks is one map for chunks and items.

## Verification
- `node --test` one at a time: atlasunify-b66 6, terrainatlas-b65 8, terrainatlas-dom-b65 1, itemsprites2-b65 5, item-atlas 4, item-atlas-hd-b64 6, stitcher-b64 5, block-textures 2, block-animation 1, item-render 6, atlas-layout 6, atlas-texels 6, cart-render2-b50 4, display-quads-b53 10, display-cubes-b54 5, gate-item 3, hand-models 6, heldrender-b63 3, icon-quads 8, player-renderer 26, rendering-b58 5, model-faces 1, minecarts 6, first-person-pose 3, held-pose 2: all pass. Full npm test not run (batch rule).

## Follow-ups
- Only a browser could show: the sibling textures sampling the terrain DataTexture correctly (shared Source, mirrored mip levels, `isDataTexture` upload path, re-creation after `terrain.dispose()` on relayout or mip change), held/dropped flat block items with HD packs, Anaglyph look of tinted sprites.
- Not unit-tested (needs a scene): moving block `sig` and the `meshRequest` layout drop; both are one-line guards.
- Item textures created before `bindTerrainAtlas` keep the private blocks sheet (scene is built first in practice).
- Tinted flat item inventory icons still use the span mask path.
