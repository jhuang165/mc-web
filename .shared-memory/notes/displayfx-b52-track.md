# displayfx b52 track

Branch `batch52-displayfx` from 8cd3f1725.

## Summary
- Display tint, executed (tag `b52dx`): `tools/probes/DisplayFxProbe.java` calls the real `Block.getRenderColor` (aji.i(int)) for every registered id 1..255 x meta 0..15 with the shipped colormaps fed to ColorizerGrass/Foliage (`tools/verify-displayfx.mjs` -> `public/research/displayfx-reference.json`). Only 8 ids are not white: grass block 2 (7cbd6b, but renderBlockAsItem forces white: ajn.c, bytecode-read), leaves 18 (meta & 3: basic 48b518, pine 619961, birch 80a755, basic), leaves2 161 (basic), tall grass 31 (white at meta 0, else grass(0.5, 1.0)), stems 104/105 (meta*32, 255-meta*8, meta*4), vine 106 and lily pad 111 (tinted, but render types 20/23 draw nothing on a display).
- `displayTint` now covers leaves (18, 161), the tuft/fern (31) and stems from those values (`STEM_TINT`).
- Bug found in the b51 tuft tint: `textures.texture` is the ITEM atlas, which already bakes the item colour into the grass, tall grass, fern, reed, vine, lily and leaf tiles (and uses D() = 5bab46 for oak foliage, not i(meta) = 48b518). b51's material tint multiplied a tile already tinted (double tint), and a reed or grass block on a cart showed the baked green/overlay where the native draw is grey/white. Blocks 2, 18, 31, 83, 161 (`displayTerrain`) are now drawn from the grey `terrain` atlas with the native colour as the material colour (grass block: grey top, side without overlay, white = native; sugar cane: grey, white).
- Boat splash executed: the BoatProbe world with Boat.rand = Random(7) and boats at 0.26249999999999996 (no splash), its next double (17 particles), 0.4, 0.35, a diagonal, a negative-x yawed boat, 0.2 (none) and a boat in the air. The port copy's `splash()`, fed the executed start-of-tick state, reproduces every tick's particle count, positions and velocity (1e-6) and the random stream across ticks. The splash needs only the speed (no water test): confirmed by the dry-air case (25 particles at 0.4).
- Flat display shapes (types 1, 6, 19, 2) NOT executed: renderBlockAsItem (blm.a) calls LWJGL GL11 directly and draws through the static Tessellator (bmh.a, GLAllocation buffers) and registered IIcons; only a 3.3.1 LWJGL jar is on the machine (the game wants 2.9), so it cannot run headless without stubbing GL and the icons. `displayQuads` stays bytecode-read.

## Evidence
- Executed: getRenderColor sweep and boat splash records (`public/research/displayfx-reference.json`). Bytecode-read: blm.a(aji, int, float) (grass forced white, meta 3 for ajn.z/cd/al, i(meta) tint), the atlas baking (read in `block-textures.js`, not rendered in a browser).

## Verification
- `node --test src/displayfx-b52.test.js src/dragonfx-b51.test.js src/cart-render2-b50.test.js src/knot-splash-b50.test.js src/biome-colors.test.js src/boats.test.js` -> 126 pass, 0 fail. `node tools/verify-displayfx.mjs` regenerates the reference. No browser smoke.

## Follow-ups (proposed gap lines)
- Flat display shape geometry still bytecode-read (needs a GL/Tessellator/IIcon stub harness around blm.a).
- The item atlas bakes D() for oak foliage (5bab46) while ItemLeaves/Block.getRenderColor answer i(meta) (48b518): check whether held/dropped/GUI leaves should use i(meta) (executed in the reference: leaves i = 48b518 / 619961 / 80a755).
- Cart display tint not seen in a browser (terrain atlas swap unverified on screen).

## Lead correction (32af910af)
The grass block is not all white: `blm.a` offsets 237-364 set glColor to `i(meta)` before `renderFaceYPos` and back to white after it, so the top face is tinted 7cbd6b and the other faces are white. `displayTopTint` draws that; the "forced white" readings above apply to the first colour only.
