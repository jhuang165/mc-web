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

## Remaining gaps
- Water overlay tint is subtle under the fog; its pixel match is not compared with a native frame.
- Punch-out fizz and flint and steel were checked by code and unit tests, not driven by live input.
- Orb-in-lava fizz drained by the existing hook; not probed live this batch.
- Third-person fire (`entity-fire-renderer.js`) was not changed or re-audited.
