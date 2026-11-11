# Fire, lava and water view effects (batch 21, firefx)

Labels: **bytecode-read** (javap of the 1.7.10 client jar), **probed** (run in headless Chrome, muted, port 5188), **assumed**. Constants are in `fire-fx-reference.json`; code is `src/fire-fx.js` (numbers) and `src/screen-overlays.js` (drawing).

## Sounds
| Event | Native call | Name / volume / pitch | Status |
|---|---|---|---|
| Burning or lava damage tick | `Entity.onEntityUpdate` hurt, status 2 | the entity's hurt sound; there is no looping burn sound | bytecode-read; player and mobs already wired |
| Lava ambience | `BlockLiquid.randomDisplayTick` | `liquid.lava`, `liquid.lavapop` | bytecode-read; probed playing at lava cells |
| Fire ambience | `BlockFire.randomDisplayTick` 1/24 | `fire.fire`, volume 1 + r, pitch r * 0.7 + 0.3 | bytecode-read; probed |
| Ignite | flint and steel, fire charge, creeper | `fire.ignite` 1.0, r * 0.4 + 0.8, at the cell (creeper: the creeper) | bytecode-read; already wired, fire charge now tested |
| Entity wet and burning | `Entity.moveEntity` tail | `random.fizz` 0.7, 1.6 + (r - r) * 0.4 at the entity | bytecode-read; player hook now positioned (probed: rain, volume 0.7 at the player) |
| Punching fire (aux 1004) | `RenderGlobal.playAuxSFX` | `random.fizz` 0.5, 2.6 + (r - r) * 0.8 at the cell centre | bytecode-read; already wired |
| Lava meets water | `BlockLiquid.func_149799_m` | `random.fizz` 0.5, 2.6 + (r - r) * 0.8 at the cell centre; the 8 `largesmoke` are dropped by the integrated server's empty `WorldManager.spawnParticle`, so none are drawn | bytecode-read; probed |
| Item or orb in lava | `EntityItem` / `EntityXPOrb.onUpdate` | `random.fizz` 0.4, 2.0 + r * 0.4 | bytecode-read; items never drained before, now probed playing |

## Overlays (`ItemRenderer.renderOverlays`)
First person only (view 0, not sleeping), in the order fire, inside block, water. Fire Resistance does not change it: the fire is still drawn.
- Fire: `fire_layer_1` animated frame, two quads, colour alpha 0.9, offsets +-0.24 / -0.3, yaw +-10 degrees, at z -0.5. Drawn also in lava (the player burns there).
- Inside block: side 2 texture of the block at the eye, colour 0.1, quad +-1 at z -0.5. Probed: the in-wall overlay draws; the block pick prefers the last normal cube among eight corners.
- Water: `misc/underwater.png`, 4x4 repeat scrolling by -yaw / 64 and pitch / 64, colour (b, b, b, 0.5), b = player brightness.
- Client player posY is the eye and `getEyeHeight` is 0.12, so the inside-block and water tests sample 0.12 above the camera (the server's suffocation uses 1.62 from the feet).

## View
- Fov: x 60 / 70 while the view block is water (hand 70, world option). Fixed this batch.
- Fog: lava exp density 2.0 colour (0.6, 0.1, 0); water exp density 0.1 - 0.03 x Respiration, 0.05 with Water Breathing; water colour (0.02, 0.02, 0.2) + 0.2 x Respiration. Respiration and Water Breathing terms added this batch.

## Batch 27 re-read of the overlay math (bly, ItemRenderer)
Bytecode re-read of `bly.a(F,rf)` (inside block), `bly.c(F)` (water) and `bly.d(F)` (fire) against `fire-fx.js`: no differences found. Inside block: colour (0.1,0.1,0.1,0.5), blend not enabled (the alpha is ignored, `screen-overlays.js` draws it opaque), quad z -0.5, atlas tile of side 2. Water: colour (b,b,b,0.5) with b = `getBrightness`, blend 770/771 (separate alpha 1,0), scale 4, UV offset yaw/64 and pitch/64, z -0.5. Fire: alpha 0.9 (two quads), as `FIRE_OVERLAY`. Overlays draw between the hand and the anaglyph merge, so in anaglyph mode they render per eye. A browser pixel capture of underwater/pumpkin/fire was attempted (`artifacts/b27-atlas2/overlays.mjs`) but the scripted world did not put the camera inside water, so it is not evidence; the numbers above come from bytecode and the existing unit tests only.

## Batch 45 re-audit (firefx2)
All bytecode-read (javap of the 1.7.10 client jar); no probe class was added, and no pixel capture was taken.
- **Water overlay** `bly.c(F)`: re-read again, identical to `waterOverlayQuad` (colour (b,b,b,0.5) with b = `bjk.d(partial)`, blend 770/771/1/0, scale 4, `-yaw/64`, `pitch/64` from the player's own yaw/pitch fields, z -0.5). The port's `screen-overlays.js` negates v only to move native image-down v into three's flipped texture space. The brightness table is the dimension's own table (rewritten in place by `dimension-render.js`). Still not compared pixel-for-pixel with a native frame: the tint is a 0.5 alpha multiply of `underwater.png` by the light, with the world fog under it.
- **In-wall / fire overlays** `bly.b(F)`: same order (fire, inside block, water), alpha test off, the eight-corner block pick on `bjk.M/N` * 0.9 / 0.2, side 2 icon. Unchanged.
- **Punch-out fizz**: `World.extinguishFire` (`ahb.a(yz,IIII)Z`) offsets by the side, requires fire, plays aux 1004 and removes the block. The server's `ItemInWorldManager.onBlockClicked` (`mx.a(IIII)`) calls it with a null player in both modes, so the 1004 packet reaches the client. In Creative `PlayerControllerMP.clickBlockCreative` (`bje.a`) also extinguishes on the client world with the player, whose `RenderGlobal.playAuxSFXAtEntity` plays the sound without excluding the player: Creative hears two fizzes (separate pitch draws), Survival one. The port played one in both; Creative now plays two.
- **Flint and steel** `acw.a`: offset by side, `canPlayerEdit`, `Material.air` cell only gets `fire.ignite` 1.0 / `r * 0.4 + 0.8` at the cell centre and the fire block; the stack takes 1 damage whether or not the cell was air. Port matches. Creeper `xz.interact`: sound at the creeper position + 0.5 on each axis (the table above said "at the creeper"; it is the +0.5 centre, as the port already had).
- **Item / orb in lava** `xk.onUpdate` (gate: block cell changed or `ticksExisted % 25 == 0`) and `sq.onUpdate` (every tick): motionY 0.2, motionX/Z `(r - r) * 0.2`, `random.fizz` 0.4, `2.0 + r * 0.4` through `Entity.playSound` at the entity position. Port matched except the item's sound position, which used the box bottom instead of posY (0.125 higher); fixed. `Entity.setOnFireFromLava` has no sound; the lava hurt/ignite are separate and unchanged.
- **Third-person fire** `Render.renderEntityOnFire` (`bno.a(sa,DDDF)V`): re-read; `entityFireLayers` matches the scale (width * 1.4), layer count (`height / scale` countdown by 0.45), sprite alternation (`i % 2`), the u swap on `(i / 2) % 2 == 0`, half width * 0.9, depth + 0.03, z `-0.3 + (int) remaining * 0.02`, offset `posY - boundingBox.minY` (0 for mobs, 1.62 for players), and the `-playerViewY` rotation. Alpha test 0.1 matches the shader's discard. No difference found.

## Remaining gaps
- Water overlay tint is not pixel-compared with a native frame (no native renderer is available; the maths is bytecode-identical).
- The item/orb lava fizz and the flint-and-steel path are bytecode-read plus unit-tested, not driven by live input in a browser.
