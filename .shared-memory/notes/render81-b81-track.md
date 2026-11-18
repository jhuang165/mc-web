# Batch 81 render81: end portal per-pass writes, eye back-off and column index; wither pitch; wither skull Rotation

## Summary
- `src/end-portal-renderer.js`:
  - **Per-pass writes.** The fragment shader now writes each of the 16 passes to the 8-bit colour buffer before the next pass adds to it. Each write clamps to [0, 1], multiplies by 255 and rounds. Pass 0 replaces the colour and passes 1-15 add to it. The old shader summed all 16 and clamped once. `framebufferStep` and `endPortalPixel` do the same replay in JS.
  - **Generated shader.** `endPortalFragmentShader()` writes the 16 layers out as literal constants: depth, scale, cos/sin and colour. That removes the four 16-element uniform arrays, which needed up to 64 fragment uniform vectors before packing, against WebGL1's guaranteed minimum of 16.
  - **Shader safety.** There is no `for` loop, no `precision highp` (three.js supplies the precision, and mediump-only GPUs reject highp) and no texture read behind a ternary. `END_PORTAL_VERTEX_SHADER` is exported unchanged.
  - **Eye point.** `endPortalEye(camera, look)` gives the camera's world position plus forward * near, as before. In first person, while awake, it also backs off 0.1 along the player's pitch/yaw view axis. `main.js` passes `{ pitch, yaw }` when `thirdPersonView === 0 && !bedSleep.sleeping`, and null otherwise.
  - **Scan.** `EndPortalIndex` and `portalCellsOfChunk` replace the 20 x 12 scan that ran every 10 frames. Each meshed column (`VoxelScene.chunks`, a new THREE.Group on every install) is searched once with `Uint8Array.indexOf(END_PORTAL)`. A column is searched again only when its group changes (a remesh). Brightness is still polled per cell every frame. Columns that leave the window drop their cells. Every portal tile in the resident window is now drawn, and the vertex shader's 64-block cull is the range test, as in native.
- `src/main.js`, 1 line: the `endPortalRenderer.update` call passes the first-person look.
- `src/wither-boss-mobs.js`:
  - `WitherSkulls.build` reads `record.rotation` the way Entity.readFromNBT does. The previous yaw/pitch are the stored floats. The current ones are setRotation's `% 360`.
  - `WitherSkulls.serialize` adds `rotation: [yaw, pitch]`. That covers the browser save, away-entity records and the summon append reload.
- `src/java-projectiles.js`:
  - Import reads the NBT `Rotation` of a `WitherSkull`.
  - Export writes `Rotation` from `rotation`. It overrides the exporter's record yaw/pitch, which skull records never had, so every exported skull had been written as [0, 0].
- `src/glsl-mini.js` (new, test-only helper, not imported by the app): a typed GLSL ES 1.00 subset interpreter.
  - The tokenizer rejects `#`, loops, `if`, `precision`, ES 3.00 words, `texture()`, `discard`, integer and bit operators, and compound assignment.
  - The parser rejects arrays and indexing.
  - The checker has no implicit int-to-float conversion and checks vector sizes. It runs `main()` with JS sampler functions.
- `src/render81-b81.test.js` (new): 11 tests.
- **Wither pitch: no code change.** The batch 80 gap was stale. EntityWither never writes rotationPitch; EntityLookHelper does. The port runs the look helper (`ai.js`), the launch already copied the pitch and ModelWither's centre head uses `headPitch`. Now pinned by a test.
- **TileEntitySkull `Rot`: no change.** It was already read, saved, exported and drawn (`skull.js`, `region-import.js`, `region-export.js`, `skull-renderer.js` `skullPose(meta, t.rot)`). The batch 80 "saved skulls start at rotation 0" item was about wither skull projectiles, which this track fixes.
- Docs (dated 2026-11-18): `eye-of-ender.md` and `wither-boss.md` get batch 81 lines. `parity.md` rows for batches 5 and 6 are extended.

## Evidence
- **Bytecode-read** (`javap -c -p` on the 1.7.10 client jar):
  - **First-person camera:** EntityRenderer.orientCamera `blt.h(F)`: the first-person, awake branch does glTranslatef(0, 0, -0.1) after the roll and before glRotatef(pitch, 1, 0, 0) and glRotatef(yaw + 180, 0, 1, 0).
  - **Projection:** setupCameraTransform `blt.a(F, I)` uses a gluPerspective near plane of 0.05. ActiveRenderInfo unprojects the viewport centre at winZ 0.
  - **Render distance:** TileEntity.getMaxRenderDistanceSquared is 4096 (`aor.n`), not overridden by `apo`.
  - **Wither rotation:** EntityWither `xc` writes only `y` (rotationYaw), never `z` (rotationPitch).
  - **Skull launch:** `xc.a(int, double, double, double, boolean)` builds `zp(world, shooter, dx, dy, dz)`, which takes the shooter's rotation through setLocationAndAngles.
  - **Entity NBT:** Entity.readFromNBT `sa.f(dh)` sets prevRotationYaw/Pitch to the stored `Rotation` floats, then setRotation `sa.b(FF)` stores them `% 360`. writeToNBT writes `Rotation` [yaw, pitch].
- **Executed (port + native fixtures):**
  - **Native fixtures:** the native WitherSkull fixtures in `projectile-nbt-reference.json` (unchanged `zp` probe, yaw 37.5 / pitch -12.25) are imported, then loaded with `WitherSkulls.load`, and the loaded yaw/pitch match the probe's.
  - **Export round trip:** an export through `exportJavaSave`, then a region read and re-import, keeps [-71.5, 22.25].
  - **Wither pitch:** a wither against a no-AI cow on the wither-boss test world gets a nonzero rotationPitch from the look helper. Every launched skull starts at fround of the wither's yaw/pitch.
- **Executed (port, against the native math):**
  - **Fragment shader:** the generated GLSL runs through `glsl-mini.js` for 300 seeded eyes and points (a fixed LCG, no wall clock). Its 16 texture coordinates match `endPortalUv` (batch 80's executed `bmt` texgen) within 1e-6.
  - **Pixel match:** on unfogged full-light inputs the pixel exactly equals `endPortalPixel`'s per-pass replay. There a texel k/255 times a colour c/255 can never land on a rounding tie, because 2kc is even and 255 times an odd number is odd. Fogged and dimmed inputs agree within a carried step, and at most 5 of 300 differ. The single-clamp sum differs from the per-pass result in some samples.
  - **Eye point:** `endPortalEye` matches M^-1 (0, 0, -0.05), with M = T(0, 0, -0.1) Rx(pitch) Ry(yaw + 180) in native angles, within 1e-9 for 40 seeded cameras.
- **Port-read:**
  - `VoxelScene.installChunk` makes a new group on every page or worker mesh. Its keys are block coordinates.
  - region-export's projectile path passed `rotation: [e.yaw ?? 0, e.pitch ?? 0]`, but skull records have no yaw/pitch.
  - The port's camera Euler is (pitch + bob, yaw, roll - hurt, "YXZ"), with native yaw = 180 - port yaw and native pitch = -port pitch.

## Verification
- `node --test --test-timeout=600000 src/render81-b81.test.js`: 11 pass, 0 fail.
- Neighbours run together, 15 files: 179 pass, 0 fail.
  - render81-b81, renderfx80-b80, projectile-nbt, wither-boss, wither-targets
  - mpwither-b63, mpwither-b64, mob-griefing, mob-effects-b55, mob-victims-b51
  - fluids80-b80, mpclicks-b70, mpuse2-b65, skull, region-export
- entity-list, game-rules, mpsummon-b67 and summon-coverage: 134 pass, 0 fail.
- After the export change, a rerun of render81-b81, projectile-nbt, region-export, wither-boss and renderfx80-b80: 84 pass, 0 fail.
- `npm run build`: built (only the usual chunk-size warning).
- No full npm test, no browser check.
- No old test encoded the fixed gaps: renderfx80-b80 tests the layers, uv, scroll and quad, which are unchanged.
- Only a browser or a real GPU can confirm:
  - the generated shader compiling on WebGL1 and WebGL2 drivers, including mediump-only mobile GPUs
  - the portal's look with per-pass banding
  - the 0.1 eye shift's parallax on screen
  - frame cost with many meshed columns
  - the on-screen orientation of a loaded or imported wither skull

## Follow-ups
- **Bob and hurt.** The back-off uses the player's pitch/yaw axis, which is native. The port then applies the view bob and hurt roll as camera rotations about the eye, not as native's translate/rotate stack before the back-off, so the eye point is approximate while bobbing or hurt.
- **Draw range.** Portals are drawn from the meshed (resident) columns. Native draws every loaded tile entity within 64 blocks, so a render distance smaller than 64 blocks drops the far ones, as it does for every other block.
- **Multiplayer skulls.** Multiplayer skull copies' rotation belongs to mpcopies81 and is not touched here. `server-summon.js` skull records are not touched either.
- **Ghast and blaze fireballs.** Their records still carry no rotation. RenderFireball draws a billboard, so only the export's Rotation would differ.
- **Stale docs.** `.shared-memory/PROJECT.md` and `remaining-gaps.md` still list the portal window, eye, per-pass clamp, wither pitch and skull rotation as open. They are not edited, per the track rules; that is for the lead.
