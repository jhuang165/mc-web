# Batch 56 displaylight track (display blocks and items)

Branch `batch56-displaylight`, from 626a467c3 (0.84.0). Target is 1.7.10; no parity claim.

## Summary

Changed in the port:
- Minecart display blocks are now multiplied by Entity.getBrightness (renderBlockAsItem multiplies its glColor by the brightness it is given). A burning cart is drawn at 15728880.
- Entity light (carts, item frames, dropped items) is sampled at floor(feetY + height * 0.66) and read as World.getLightBrightnessForSkyBlocks(x, y, z, 0): no mesher slab rule (an entity in a dark slab cell reads 0) and no emission of the cell's own block. New `LightVolume.packed(x, y, z, emissive, mixed)` flag; `Scene.entityBrightness`.
- Item frame light sampling now uses 0.66 of the frame box height. Dropped items sample at box bottom + 0.25 * 0.66 (was 0.17) from the entity's own position, not the interpolated one.
- Display id 90 (nether portal) draws a cube (renderType 0), no longer "none". Ids with no 1.7.10 block (0, 165-169 and above 175) are "none".
- Sweep found no other render type or turn mismatches (cross, crops, stems, torches, hopper, nothing sets match).
- Sugar cane and dead shrub icons and tints already matched; no change.

Shared-file edits: `src/scene.js` (import, `brightness` flag args, `entityBrightness` method), `src/lighting.js` (`packed` flag), `src/streaming-light.js` (proxy passes the entity flags only).

## Evidence

Executed (real 1.7.10 classes through `tools/probes/DisplayLightProbe.java`, recording GL11 stub; `public/research/display-light-reference.json`, 318 records):
- sweep: every block id 1..255 x meta 0..15: render type, renderItemIn3d, quad counts, first glColor at brightness 0.37, rotate-90 flag.
- entity: getBrightness and getBrightnessForRender on EntityMinecartEmpty over a chunk-backed World with real lightBrightnessTable (overworld and nether, skylightSubtracted 0/4/11), slabs, stairs, dark slab, lit furnace, opaque, unloaded, burning (fire 40).
- frame and item: EntityItemFrame positions/boxes for dirs 0..3, EntityItem boxes at y 65.0..65.99 against a cell-identifying light function.
- itemIcon: icon name and getColorFromItemStack for ids 338, 31, 83, 6, 18, 2, 106, 111.

Bytecode-read: RenderManager substituting 15728880 for a burning entity, chest tile entity renderer path for carts.

## Verification

- `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node tools/verify-display-light.mjs` (regenerates the reference).
- `node --test src/display-light-b56.test.js`: 14 pass.
- `grep -lE "lighting\.js|streaming-light|scene\.js|cart-display-shape|minecart-renderer|drop-renderer|hanging-renderer|display-light" src/*.test.js | xargs node --test`: 854 tests, 854 pass, 0 fail (106 files).
- `npm run build`: ok. Full `npm test` not run (track rule).

## Follow-ups

- Held-item lighting not compared with the port.
- `LightVolume.level()` (player brightness and others) still has the slab rule and emission.
- Painting per-cell light not rechecked.
- Burning full-light applies to carts only, not other entities.
- GL lighting not pixel-measured; the sweep uses brightness 0.37 and metas 0..15 only.
- `StreamingLight.packed` has always ignored the mesher's `emissive` flag (liquids read emission through it); left unchanged because the worker and page meshers must agree.
