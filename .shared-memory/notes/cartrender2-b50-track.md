# cartrender2 b50 track

Branch `batch50-cartrender2` from ca6a447bf.

## Summary
- Display block by render type (`src/cart-display-shape.js`, wired in `MinecartRenderer.buildCustom`): the existing block-item path already draws stairs, fences, gates, walls, slabs, chests etc. in their item form. Added the flat branches of renderBlockAsItem: crossed squares (type 1: flowers, saplings, tall grass, mushrooms, reeds, web), crops (6), small stems (19), upright torches (2). Blocks with no renderBlockAsItem branch (fluids, fire, doors, rails, ladders, vines, wire, levers, repeaters, signs, beds, panes, lily pad, cauldron, brewing stand, cocoa, tripwire, pots, double plants, comparators) draw nothing instead of a cube.
- Client TNT cart smoke: `ObjectClient.step` spawns "smoke" at (x, y + 0.5, z), velocity 0, on each tick the copy's fuse is above 0 (via `particle`, so tests see it in `log`, main.js hooks it to the scene fx).
- Swell: natively RenderTntMinecart.func_147910_a does glScalef(swell) inside RenderMinecart's 0.75 / translate(0, offset/16) frame, so only the display block and the flash cube swell. The port scaled the whole cart body and drew the flash unscaled by 0.75. Now a `swell` group (positioned at the offset) holds the display, custom block and flash (0.75 cube); the cart model is unscaled.

## Evidence
- Executed: smoke count per tick of the batch 49 client-cart probe (`cart-display-reference.json` clientFuse column 3) replayed in the new test.
- Bytecode-read (`javap -c -p`): blm.a(aji, int, float) branches (types 0, 31, 39, 16, 26, 1, 19, 23 (empty), 13, 22, 6, 2, 10, 27, 11, 21, 32, 35, 34, 38; anything else draws nothing), boi (RenderMinecart: only render type -1 skipped, then scale 0.75, translate, func_147910_a), box (RenderTntMinecart), xv.h (smoke position and order), anu.g (stem item bounds, height 0.25).
- Not executed: the flat shapes' vertices (built from existing render-vessels helpers and the mesher's torch/crop maths, not compared against a probe); the inventory tint of tall grass/fern/leaves is not applied; the render-type id table (`NOTHING`, `CROSS`...) is by original block id from memory of the block registry, not generated from the classes.

## Verification
- `node --test src/cart-render2-b50.test.js` -> 4 pass. Targeted `node --test` over cart-*, object-tracker*, minecarts, vehicle-render-b48 -> 126 pass, 0 fail. Muted headless browser smoke (port 5582, master volume 0): carts showing stairs, fence, poppy, torch, water (nothing) and a TNT cart; screenshot `artifacts/b50-cartrender2/carts.png` (not committed). `npm run build` once. No full npm test.

## Follow-ups (proposed gap lines)
- Flat display shapes are unprobed (no ItemRenderProbe run for types 1, 6, 19, 2); tall grass/fern inventory tint missing; a ridden cart is drawn live.
- `object-tracker.js` was edited on one line (fuse smoke), overlapping the trackerids/knotsplash claims.
