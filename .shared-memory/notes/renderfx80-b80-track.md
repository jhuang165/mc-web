# Batch 80 renderfx80: end portal texgen, wither skull model and turn, stem planes, brewing bounds comment

## Summary
- `src/end-portal-renderer.js`: the 4-plane approximation is replaced by a port of TileEntityEndPortalRenderer (`bmt`). `END_PORTAL_LAYERS` holds the 16 passes: texture (pass 0 `end_sky`, then `end_portal`), depth `16 - i` (65 for pass 0), texture scale (0.125 / 0.5 / 0.0625), shade (0.1, then `1 / (17 - i)`), rotation `(i*i*4321 + i*9) * 2` degrees and colour bytes from Random(31100). Pass 0 also draws its three floats, then uses white. `endPortalUv` is the texgen and texture matrix in closed form: the eye ray meets a plane `depth` below the portal, which gives each layer its parallax. `endPortalScroll(ms)` is the clock term.
- The shader does all 16 layers in one opaque pass. Both textures are opaque, so pass 0 replaces and the rest add. Each layer takes the lightmap at the cell brightness and its own fog. The texture is sampled at (u, 1 - v), nearest filtering, repeat wrap.
- One merged geometry is rebuilt on scan. The vertex shader drops cells whose centre is 64 or more blocks from the camera entity.
- `main.js`, 2 lines: the constructor gets `scene` (lighting, brightness) and `update` gets `scene.camera` and `PHYSICS.eye`.
- `src/fireball-turn.js` (new): `fireballTurn` is EntityFireball.onUpdate's turn (`ze.h`) in float arithmetic. `interpolateRotation` and `lerpPitch` are RenderWitherSkull's interpolation.
- `src/wither-boss-mobs.js`: `launch` takes the shooter's rotationYaw / rotationPitch. `tickOne` sets prevYaw/prevPitch at the start and turns after the move.
- `src/projectile-renderer.js`: `skullGeometry` is ModelSkeletonHead(0, 35, 64, 64). It was skinBox offset (0, 0) on 64 x 32, which read the wrong texture region. `skullMatrix` is translate, scale(-1, -1, 1), Ry, Rx at 57.295776, then the mob frame. The material is DoubleSide (culling off).
- Rows without a rotation (multiplayer copies) turn in the renderer from their per-tick displacement.
- `src/stems-cake.js`: `stemQuads` (dead legacy code, imported by `scene.js` but unused) is now renderBlockStem's exact quad list in block-local coordinates: 4 small-stem quads, plus 2 big-stem quads when connected. It has no imports, as the file requires.
- `src/brewing.js`: the stale "approximated as the 14/16 cell" comment now states the bytecode order. No behaviour change: the selection rule was already exact since b71.
- Docs:
  - `eye-of-ender.md`, `wither-boss.md`, `stems-cake.md`, `brewing.md`: batch 80 lines.
  - `post-shaders.md`: stemBig is now executed.
  - `parity.md`: rows for batches 4, 5 and 6.

## Evidence
- Executed (unchanged 1.7.10 classes):
  - `tools/probes/RenderFx80Probe.java` runs against stub `org.lwjgl.opengl.GL11` / `org.lwjgl.Sys` in `tools/probes/renderfx80-stubs/`. The stubs keep float modelview/texture stacks and log texgen modes, planes with the modelview they were set under, binds, blends and display lists. The real Tessellator `bmh` fills its buffer.
  - `tools/verify-renderfx80.mjs` writes `public/research/renderfx80-reference.json`:
    - 128 stemBig and 32 stemSmall records
    - 5 portal camera fixtures, 16 draws each
    - 6 skull turn fixtures and the compiled skull display list (24 vertices)
  - `src/renderfx80-b80.test.js` replays the GL pipeline against `endPortalUv`: object planes, the eye plane through the inverse modelview, the texture matrix and the divide by q. The difference is within the float rounding of the logged matrices: about 5e-6 for cameras near the origin. Far from the origin the rounding is large, because the eye plane is set under a modelview translated to the camera's world coordinates. So native GL itself jitters there, and the port's closed form does not.
  - The test also covers binds, blend, quads, colour bytes, stem vertices and uvs exactly as floats, and the skull modelview and every vertex/uv.
- Bytecode-read (javap -c -p):
  - EntityFireball.onUpdate's rotation (`ze.h`: MathHelper.sqrt_double, atan2 * 180 / 3.1415927410125732, the ±360 wrap of the prev fields, 0.2f), and that it uses the motion after the move, before the acceleration.
  - bpd's `func_82400_a`.
  - BlockBrewingStand's addCollisionBoxes order.
  - EntityRenderer.orientCamera's first-person glTranslatef(0, 0, -0.1).
  - TileEntity.getMaxRenderDistanceSquared 4096 (`aor.n`, no override in TileEntityEndPortal `apo`).
- Port-read: the port's first-person camera sits at the eye with no 0.1 back-off (main.js), so the portal eye point is 0.1 block ahead of native. Multiplayer skull rows carry no rotation (client-dispense.js / server-dispense.js).

## Verification
- `node --test src/renderfx80-b80.test.js`: 9 pass.
- Neighbours, run together: 193 pass, 0 fail.
  - renderfx80-b80, stems-cake, brewing, hudfx-b71, render-types-2
  - wither-boss, wither-targets, mpwither-b63, mpwither-b64
  - ring-ticks, saved-order2-b53, projectile-nbt, mpsummon-b67, mpprojectiles2-b63, entity-portal
- `npm run build`: built (only the usual chunk-size warning).
- No full npm test and no browser check.
- Only a browser can confirm:
  - the shader compiling on real drivers
  - the portal's look: parallax, scroll, colour, lightmap tint, fog
  - the skull's on-screen orientation and texture
  - depth/sort interplay with water and other transparent passes

## Follow-ups
- The portal scan window is still 20 x 12 blocks around the player; native draws every loaded portal tile within 64 blocks.
- The first-person camera has no 0.1 back-off, so the texgen eye is 0.1 ahead of native.
- Per-pass 8-bit framebuffer clamping and quantisation is not reproduced: the port sums the layers, then clamps once.
- The port's wither has no rotationPitch, so skulls start at pitch 0.
- Saved and imported skulls start at rotation 0: the browser save does not store rotation, and native NBT `Rotation` is not read.
- Multiplayer skull copies turn client-side from displacement. Native gets the spawn rotation from the packet, then runs its own turn.
- `.shared-memory/PROJECT.md` line ~801 ("big-stem model ... approximated") and `remaining-gaps.md` are stale for the stems, portal and skull. I did not edit them; that is for the lead. `entity-parity-catalogue.md` is generated.
