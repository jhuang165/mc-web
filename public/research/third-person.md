# Third-person view and the player model (1.7.10)

Code: `src/player-renderer.js`, hooked into `src/main.js` (F5, camera, `playerBody.tick`, `playerRenderer.update`, `shadowCasters`) and `SHADOWS.player` in `src/shadows.js`. Tests: `src/player-renderer.test.js`.

The rules come from the bytecode of the original client JAR (javap), with 1.7.10 obfuscated names. This is not full parity; see Differences.

## Camera: `EntityRenderer.orientCamera` (`blt.h(F)V`)

- **F5** (`bao`): `if (++thirdPersonView > 2) thirdPersonView = 0`. 0 is first person, 1 is behind, 2 is in front. It does not repeat and is not saved. F5 does not take part in the F3 combos.
- **Distance.** `thirdPersonDistance` (`E`) and its temp copy (`F`) are both 4.0 outside the F1 debug camera.
- **Ray trace.** Eight rays start at the eye plus `((i&1)*2-1)*0.1` on x, bit 1 on y and bit 2 on z (`f4`, `f5`, `f6`). Each ends at `eye - offset + (f4 + f6, f5, f6)`. The x end term adds `f6` as well as `f4`; this is kept as written in the bytecode. The trace is `World.rayTraceBlocks` (`ahb.a(Vec3, Vec3)`, already ported in `projectiles.js`), so it hits anything but air and water, including tall grass. `d7 = min(d7, |hit - eye|)`.
- **View 1** puts the camera at `eye - look * d7` with the player's own orientation. **View 2** adds 180 degrees to the pitch, which puts the camera in front looking back, with the pitch negated and the yaw turned half a circle.
- The view uses the raw (not interpolated) yaw and pitch. Bobbing and the hurt roll still apply in every view.
- Mining, the block outline and entity picking start at the player's eye, not at the camera. The crosshair stays (`GuiIngame` only gates the pumpkin overlay on view 0). The first-person hand is drawn only in view 0 (`EntityRenderer.renderHand`).

## Body state: `EntityLivingBase.onUpdate`, `func_110146_f` (`sv.f(FF)`)

`PlayerBody` is stepped once per 20 Hz tick and feeds `mobPose` (`entities.js`), which does the partial-tick interpolation as for mobs.

- The head yaw is the view yaw, sampled per tick (old-AI branch of `onLivingUpdate`).
- The body target is the walking direction, `atan2(dz, dx) * 180/pi - 90`, once `dx² + dz² > 0.0025000002`; it is the head yaw while swinging.
- `renderYawOffset += wrap180(target - renderYawOffset) * 0.3`. The body then trails the head by at most 75 degrees; past 50 degrees it is dragged a further `0.2 * diff`.
- Limb swing: `limbSwingAmount += (min(speed * 4, 1) - amount) * 0.4`, `limbSwing += amount`.
- Java yaw is `180 - yaw` degrees and Java pitch is `-pitch` degrees in this game's three.js convention.

## Model: `RenderPlayer` (`bop`) and `ModelBiped` (`bhm`)

- **Transform.** `translate(feet) · rotateY(180 - bodyYaw) · scale(-1, -1, 1) · scale(0.9375) · translate(0, -1.5078125, 0)`. The model is +y down and mirrored in x; everything is drawn double-sided as entities are.
- **Boxes** (`ModelBiped(0, 0, 64, 32)` on `entity/steve.png`). Rotation points are in pixels:

| Part | UV | Box | Rotation point |
|---|---|---|---|
| head | 0,0 | -4,-8,-4, 8x8x8 | 0,0,0 |
| hat | 32,0 | same, +0.5 | 0,0,0 |
| body | 16,16 | -4,0,-2, 8x12x4 | 0,0,0 |
| right arm | 40,16 | -3,-2,-2, 4x12x4 | -5,2,0 |
| left arm (mirror) | 40,16 | -1,-2,-2, 4x12x4 | 5,2,0 |
| right leg | 0,16 | -2,0,-2, 4x12x4 | -1.9,12,0 |
| left leg (mirror) | 0,16 | -2,0,-2, 4x12x4 | 1.9,12,0 |

- **Quads** (`ModelBox` `bis`, `TexturedQuad` `bhv`): the corner table, the UV rectangles, the `(u2,v1) (u1,v1) (u1,v2) (u2,v2)` vertex mapping, the mirror's x swap with a face flip, and the normal `(p1-p2) x (p1-p0)`.
- **Pose** (`setRotationAngles`, `bhm.a`, with `MathHelper` table sin/cos):
  - head turns by the relative head yaw and the pitch, and the hat copies it;
  - arms swing `cos(ls * 0.6662 [+ pi]) * 2 * lsa * 0.5` and legs `cos(ls * 0.6662 [+ pi]) * 1.4 * lsa`;
  - a held item sets `rightArm.x = rightArm.x * 0.5 - 0.31415927` (`heldItemRight` is 1);
  - the swing (`onGround`) twists the body by `sin(sqrt(p) * pi * 2) * 0.2`, moves the arm pivots, raises the right arm by `sin((1 - (1 - p)^4) * pi) * 1.2 + sin(p * pi) * -(head.x - 0.7) * 0.75` and rolls it by `sin(p * pi) * -0.4`;
  - the idle sway is `cos(age * 0.09) * 0.05 + 0.05` on the arms' z and `sin(age * 0.067) * 0.05` on x.
- **Sneak** (body x 0.5, arms +0.4, legs at y 9 / z 4, head at y 1) is ported in `bipedPose` but not wired: this game has no sneak.
- **Light and hurt.** The same `entityMaterial` and lightmap as mobs, sampled at feet + 0.66 * 1.8 (`Entity.getBrightnessForRender`). While `hurtTicks > 0` the model, armor and held item get the `(brightness, 0, 0, 0.4)` red overlay.

## Armor: `RenderPlayer.shouldRenderPass` (`bop.a(blg, int, float)`)

- Four passes, helmet to boots, reading `armor[3 - pass]`. Pass 2 (leggings) uses the 0.5 model and `_layer_2`; the others use the 1.0 model and `_layer_1` (`RenderBiped.getArmorResource`, `bnw.a`). Textures are `models/armor/<material>_layer_N.png`.
- Visible parts: head and hat on pass 0, body on 1 and 2, arms on 1, legs on 2 and 3.
- Leather (`abd.a`) is tinted with `ItemArmor.getColor`, 0xA06540 for an undyed piece, and always draws the untinted `_overlay` on top. The glint (enchantments) is not ported.

## Held item: `RenderPlayer.renderSpecials` (`bop.a(blg, float)`)

The item hangs off the right arm after its rotation: `translate(-0.0625, 0.4375, 0.0625)`, then by class:

- **Block** (`f = 0.5`): `translate(0, 0.1875, -0.3125)`, `f *= 0.75`, `rotateX(20)`, `rotateY(45)`, `scale(-f, -f, f)`; the cube is drawn as in the first-person path.
- **Full 3D** (`isFull3D`: tools, hoes, swords, and here stick and bone; `f = 0.625`): `translate(0, 0.1875, 0)`, `scale(f, -f, f)`, `rotateX(-100)`, `rotateY(45)`.
- **Flat** (`f = 0.375`): `translate(0.25, 0.1875, -0.1875)`, `scale(f)`, `rotateZ(60)`, `rotateX(-90)`, `rotateZ(20)`.
- Sprites then take the `ItemRenderer.renderItem` 2D transform: `translate(0, -0.3, 0)`, `scale(1.5)`, `rotateY(50)`, `rotateZ(335)`, `translate(-0.9375, -0.0625, 0)`.

## Shadow

`RenderPlayer` passes shadowSize 0.5 (opaque 1). The player is added to `shadowCasters` only in views 1 and 2. `Render.renderShadow` centres the shadow on `posY + getShadowSize()` and `EntityPlayer` does not override `getShadowSize` (height / 2 = 0.9). The local player's `posY` is its eye (`yOffset` 1.62), so the centre is 2.52 above the feet. On flat ground there is then no solid cell below it, and the shadow shows only where a block sits near head height (a low ceiling). This is kept as the bytecode reads; it has not been compared with a running 1.7.10 client.

## Differences

- No sneak, riding, bow or block poses; no cape, ears, pumpkin helmet or enchantment glint; no dyed leather.
- The death roll is not drawn on the player model.
- Held items use a simplified item mesh, not `ItemRenderer` and `RenderBlocks.renderBlockAsItem`; torches and other sprite blocks draw as flat sprites.
- The view is not saved. There is no F1 debug camera.
- The camera trace uses the bobbed eye as its origin (1.7.10 applies the bob in view space after the trace).
