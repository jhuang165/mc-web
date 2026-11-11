# Batch 42 renderexec track

## Summary
Branch `batch42-renderexec`. Two executed records and the fixes they forced.

1. Item geometry executed. `tools/probes/ItemRenderProbe.java` runs the unchanged `RenderBlocks.renderBlockAsItem` for every 3D-item render type with the real Tessellator; `tools/probes/gl/GL11.java` shadows LWJGL's GL11 (not on the probe classpath) to record translate, rotate, colour and the vertices at `glDrawArrays`. Record: `public/research/item-render-reference.json` (0.6 MB), `tools/verify-item-render.mjs`, test `src/item-render.test.js` (6 tests).
   - Stair, fence, gate item boxes: exact (the gate was bytecode-read in batch 41).
   - Port differences fixed: beacon base box y0 (0.00625 -> 0, `BEACON_ITEM_BOXES`); `boxItemGeometry` used the full tile for every face, now `itemBoxUv` (executed crop, whole-texture rule for boxes outside the block); the anvil item (facing 0 boxes whatever the damage, base tile except the top of box 4, `anvilUv(0, ...)`); non-cube items in the hand, dropped and third-person (`blockItemGeometry`, `ITEM_BOXES`: slabs, farmland, plates, buttons, snow, trapdoor, enchanting table, end frame, daylight sensor, carpet, cake, wall, fence).
2. Render-types-2 at other positions. `RenderTypes2PosProbe` (+ `tools/verify-render-types-2-pos.mjs`, `public/research/render-types-2-pos-reference.json`, 4.4 MB, 320 fixtures, 58212 vertices); `src/render-types-2.test.js` now replays both records. No hash/float/modulo bug in these blocks. One lighting bug: `cellPacked` ignored `getSkyBlockTypeBrightness`'s y clamp (y<0 -> 0, neighbour reads clamp to 0..255), wrong light on slabs/stairs/etc. at y 0 and 255. Fixed in `src/lighting.js`. The probe World hid the same clamp (`W.b` override); `RenderTypes2PosProbe.W2` restores it and `RenderTypesPosProbe` uses it, so `render-types-pos-reference.json` was regenerated (same seed).
3. render-normal.js dedupe: not done (not trivially safe in the time left).

Evidence: executed for everything above. Bytecode-read: only the reasoning about ahb.a/ahb.b clamps (javap of the unchanged class, then confirmed by the executed record).

## Verification
Targeted, one file at a time (node --test): item-render 6/6, gate-item 3/3, render-types-2 1/1 (both records), render-types-pos 2/2 (704 fixtures, regenerated), render-types 1/1, light-float 2/2, block-light 3/3, slab-light 4/4, lighting 9/9, stems-cake 6/6, mesh-worker 4/4, module-names 1/1, block-textures 2/2, fence 6/6, anvil-blocks 4/4, anvil 6/6, player-renderer 26/26, leather-items 2/2, food-items 10/10, zombie-door-player 1/1. Probes: `MC_RESEARCH=... node tools/verify-render-types-2-pos.mjs` (320 fixtures), `verify-item-render.mjs` (397 items, 48 failed = chests), `verify-render-types-pos.mjs` (704). No full `npm test`, no build, no browser. Load average 4.5-11 during the work.

## Follow-ups
- Inventory icon rasterization (block-textures.js `iconRaw`) keeps its own `drop` list and flat-sprite list: wood slab, farmland, plates, buttons, carpet, trapdoor icons are full cubes there while the executed boxes are thinner; dragon egg icon is flat but native is a 3D layered model. Left to the icon track.
- Hand/drop/third-person only see block ids below 256 (and the gate item id); item ids that map to blocks (1103 stone slab and similar) still draw cubes there.
- Held and dropped items were not looked at in a browser.
- `render-normal.js` still duplicates `redstone.js`'s renderAsNormalBlock flags.
- The dragon egg item and chest items are not boxes (own render paths), unchanged.
