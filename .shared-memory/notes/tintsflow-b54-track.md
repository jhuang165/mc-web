# tintsflow b54 track

Branch `batch54-tintsflow` from 20bbab13b.

## Summary
- Tall grass meta 0: no change needed. Executed (b53lc) the stack colour is white for damage 0, and `anz` (BlockTallGrass) registers its icons as deadbush / tallgrass / fern, so 31:0 is the dead shrub with the white `deadbush` icon. In the port `/give 31:0` resolves (`itemFromOriginal`) to the dead shrub item 83, whose tile is `deadbush`, which `GRASS_TILES` never tinted; only port id 39 (31:1) uses the baked `tallgrass` tile. The b53 follow-up line was wrong as stated. Pinned by `src/tint-items-b54.test.js`.
- Sugar cane: the item atlas (`block-textures.js`, `terrainMode` false) no longer bakes the reed block tile (`reeds`) in the grass colour (`GRASS_TILES` lost `'reeds'`). The reeds item (327) already draws its own untinted `items/reeds.png`; BlockReed has no `getRenderColor` tint (the b53lc sweep lists no tint for it), and a cart display of the reed block already uses the grey terrain atlas. World reeds keep their per-position biome colour in the mesher.
- Boat copy in flowing water: new executed record `tools/probes/BoatCopyProbe.java` (tag b54bc): the unchanged EntityBoat (xi) on a remote world stand-in (ahb.E true), S12 (`xi.i`) and position packets (`xi.a(DDDFFI)`, 3 increments) applied before given ticks, sound call logged by the world stand-in. `ObjectClient.stepVehicle` (waterMovement, splash, interpolation / coasting) matches it tick by tick with no code change, so batch 53's bytecode-read waterMovement is now executed-confirmed.

## Evidence
Executed: 8 copy records (flow-drift, flow-drift-s12, fall-into-flow, fall-into-still, teleport-in-flow, flow-gradient, fast-splash, dry-fall; 40/24/20 ticks each) in `public/research/boat-copy-reference.json`, `node tools/verify-boatcopy.mjs`. Four records show flow push, two show the entry sound plus 124 bubble/splash rows, two show EntityBoat's fast-speed splash (357 / 692 rows). Bytecode-read: the xi.h branch order (already in object-tracker.js comments). A copy does not fall (no gravity in the remote branch), so entering water needs an S12 with downward motion.

## Verification
`node --test src/boat-copy-b54.test.js src/tint-items-b54.test.js src/leaf-color-b53.test.js src/biome-colors.test.js src/atlas-texels.test.js src/displayfx-b52.test.js src/plants.test.js` -> 59 tests incl. 11 in the boat copy file, 0 fail (48 for the tint set run earlier). `npm run build` ok. Not browser-checked.

## Follow-ups
- A ridden boat copy (isBoatEmpty false, full client physics) still has no executed record; the port mirrors the live boat.
- Held, dropped and GUI looks of the sugar cane and dead shrub items are unchecked in a browser.
