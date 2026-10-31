# Entity shadows (1.7.10)

Code: `src/shadows.js` (`shadowQuads` and `ShadowRenderer`), wired up in `VoxelScene.setShadows` (`src/scene.js`) and `shadowCasters` in `src/main.js`. Tests: `src/shadows.test.js`.

This is a port of `Render.doRenderShadowAndFire`, `renderShadow` and `func_147907_a` (`bno`), read from the bytecode with javap. They are drawn as with Fancy graphics, which this build always uses. `doRenderShadowAndFire` skips shadows on Fast graphics.

## Evidence

`node tools/verify-shadows.mjs` compiles `tools/probes/ShadowProbe.java` against the unchanged classes of the original client JAR (SHA-1 `e80d9b3b…`). For the 1.7.10 counterpart of every block in this build, it records the material, `renderAsNormalBlock` (`func_149686_d`) and the default bounds in `shadow-reference.json`. The test checks `takesShadow` against that file.

Per-renderer sizes come from the constructors:

| Entity | shadowSize | shadowOpaque | Source |
| --- | --- | --- | --- |
| Pig, cow (and sheep) | 0.7 | 1 | `RenderManager` passes 0.7 to `RenderPig` / `RenderCow` |
| Zombie | 0.5 | 1 | `RenderZombie` → `RenderBiped(model, 0.5, 1)` |
| Dropped item | 0.15 | 0.75 | `RenderItem` constructor |
| XP orb | 0.15 | 0.75 | `RenderXPOrb` constructor |

## Rule

- **Opacity.** It is `(1 − d²/256) × shadowOpaque`, where d² is the squared distance from the viewer to the entity's tick position (`RenderManager.getDistanceToCamera`). The viewer position is the local player's `posY`, which is at eye height. Shadows end 16 blocks away.
- **Size.** It is `shadowSize`. For `EntityLiving` it is multiplied by `getRenderSizeModifier()` (1 for these mobs) and halved for children.
- **Coverage.** The centre is the interpolated position raised by `getShadowSize()` = height / 2. An item's `posY` already sits 0.125 above its box (`yOffset`), so its shadow centre is 0.25 above the box bottom. Every cell from ⌊centre − size⌋ to ⌊centre + size⌋ on x and z, and ⌊y − size⌋ to ⌊y⌋ vertically, is tried.
- **Which cells draw.** A cell draws when the block below it is not air and the cell's `getBlockLightValue` is above 3.
  - The block must also render as a normal block. Glass, water, torches, farmland, wheat, tall grass and chests do not. In this build every block that does is a full cube.
- **Quad.** It is the top of that block, raised 1/64.
  - Alpha: `(opacity − (centreY − cellY) / 2) × 0.5 × lightBrightnessTable[light]`. Quads below 0 are skipped and values are clamped to 1.
  - Texture: `misc/shadow.png`, clamped, spanning 2 × size around the entity: `u = (entityX − x)/2/size + 0.5`, and the same for v on z.
- **Drawing.** Alpha blending, no depth writes, fog as for entities. The shadow is drawn before translucent water, as entities render before pass 1.

## Differences

- Shadows are drawn for items, XP orbs, pigs, cows and zombies, using the positions this build gives them. Orbs and mobs are not interpolated between ticks; dropped items are.
- The local player has no shadow, as in first person, since this build has no third-person view.
- There is no Fast graphics option.
