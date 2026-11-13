# Batch 58 rendering: hopper block item sprite in slots, held-item light cell

## Summary
- `src/block-textures.js` (`iconRaw`): the hopper block item (port 133) and Items.hopper (1133) return the item sprite `items/hopper.png` instead of a cube. 133 is what middle-click on a placed hopper gives; it was the only hopper path still drawn as a cube (inventory, hotbar, creative and container slots).
- `src/flat-block-items.js`: `isHopperItem`; `flatBlockItem(133)` now returns the hopper (133 was rejected by the "100..255 are tools" range), so held, dropped, item-frame and third-person hands of item 133 also use the sprite. 1133 already did.
- `src/held-light.js` (new) and `src/main.js`: the first-person item brightness cell is `floor(position.x), floor(position.y + eye - sneak drop at partial 1), floor(position.z)` (current tick), not the interpolated and bobbing camera.
- `src/rendering-b58.test.js` (new, 5 tests).

## Evidence
- Bytecode-read: `ItemRenderer.a(float)` (bly) loads `mc.thePlayer` (bao.h) and calls `World.c(IIII)` (getLightBrightnessForSkyBlocks) with `qh.c(blg.s)`, `qh.c(blg.t)`, `qh.c(blg.u)` and 0: floor of the player's posX/posY/posZ fields, no partial tick. `BlockHopper` (aln) has no `getItem` override, so `Block.getItem` is `Item.getItemFromBlock` = item 154 (class abh), whose icon name is "hopper".
- Executed (existing b57 reference): block 154 render type 38, `renderItemIn3d` false, `getItemIconName` "hopper".
- Recalled: client player `posY` is the eye (minY + yOffset - ySize), so the sneak drop applies; the port's `motion.drop(1)` is that tick value.
- Port pixels: headless Chrome (muted, port 5596, killed) rendered the atlas icon of 133 and the item textures of 1133 and 133: all the hopper sprite. Not a full in-world screenshot of the hotbar, held and dropped hopper.
- Native pixel capture: not feasible. No LWJGL natives or GL display in `tools/research`, and a headless LWJGL 2 client needs an X/GL context that this Mac does not provide; not attempted beyond looking.

## Verification
- `node --test src/rendering-b58.test.js`: 5 pass.
- Related tests (display-pixel-b57 and every test importing block-textures, first-person, flat-block-items, item-boxes): 290 pass, 0 fail.
- Full npm test not run (batch rule).

## Follow-ups
- A real in-world screenshot of hotbar, held and dropped hopper was not taken (only the icon and texture resolvers).
- Held light cell uses the tick sneak drop; vehicles and sleeping use the same position (hand hidden when sleeping).
