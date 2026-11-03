# Live anvil block (Minecraft Java 1.7.10)

Internal block 85 is the append-only live mapping for original block/item 145. `src/anvil-block.js`, the block registry, world selection/collision bounds, block and held-item renderers, projectiles, placement, mining, falling simulation, Creative lists, and population recipes now use this mapping. The parent-owned action/UI code connects right-click repair and falling entity damage callbacks.

## Native evidence

`tools/verify-anvil-blocks.mjs` executes the pinned 1.7.10 JAR (`e80d9b3bf5085002218d4be59e668bac718abbc6`) and writes `public/research/anvil-blocks-reference.json`. It records the unchanged original `BlockAnvil` registry object: id 145, render type 35, non-normal and non-opaque flags, hardness 5, tick rate 2, all 16 `damageDropped` values, four orientation bounds, and six sides that always render. The same probe invokes original `BlockAnvil.onStartFalling` and `EntityFallingBlock.fall(float)` over 720 cases (six metadata values × six distances × twenty Java random seeds), checking carried metadata, the native damage-entity flag, degradation, and break-on-impact behavior.

The 720-case fixture has an empty target entity list. It does not claim a native entity damage dispatch replay. `EntityFallingBlock.fall(float)` bytecode gives the target damage as `min(floor(i * 2), 40)` where `i = ceil(FallDistance - 1)`; `src/anvil-block.js:anvilImpact` implements that amount and the native float threshold, and the fixture replay exercises its degradation/break result through this production helper. Parent integration passes the resulting AABB and damage to player/mob damage handlers.

The four moving anvil cuboids are transcribed from the unchanged `RenderBlocks` type-35 method's four `BlockAnvil` bounds calls, including the returned-height accumulator: base y 0–0.25, collar 0.25–0.3125, stem 0.3125–0.625, and top 0.625–1. Facing 1/3 swaps x and z. This is bytecode-derived shape evidence; the probe does not run Minecraft's GL tessellator, so rendered pixel/UV parity is not claimed. Textures are the original `anvil_base` and `anvil_top_damaged_0..2` atlas assets.

Item placement preserves the carried damage stage and uses the original yaw-to-facing formula. Focused placement tests cover the four quarter-turns and explicit falling scheduling after successful placement. Projectiles ray-test against the native orientation-specific selection bounds. Mining uses pickaxe speed and the native hardness. Breaking drops one anvil with damage `metadata >> 2`. Creative lists show Anvil, Slightly Damaged Anvil, and Very Damaged Anvil. The shaped recipe is `BBB /  I  / III` (three iron blocks and four iron ingots, 31 ingots total) and is among the mapped native recipe audit results.

## Falling and saves

Anvils share the existing falling entity manager with sand/gravel, but use the native anvil model while airborne. Landing calls the parent hooks for anvil damage and `random.anvil_land`; the sounds use the three original 1.7.10 assets `random.anvil_use`, `random.anvil_break`, and `random.anvil_land`, with source hashes recorded in `public/audio/1.7.10/manifest.json`. `FallDistance` is serialized and restored so a reloaded midair anvil keeps its accumulated impact distance. Native `Entity.rand` state is not serialized by the original entity NBT; the browser similarly creates a fresh entity random on restore, so impact degradation continuity across a save/reload is not claimed.

## Focused checks

- `node tools/verify-anvil-blocks.mjs`: 720 native fall cases plus native block properties.
- `node --test src/anvil-blocks.test.js src/falling.test.js src/block-placement-simulation.test.js src/block-registry.test.js src/shadows.test.js src/block-textures.test.js src/projectiles.test.js src/media.test.js src/recipe-catalogue.test.js src/population-content.test.js src/creative.test.js`: focused block, placement, falling, mapping, rendering assets, projectile ray, media, recipe, population and Creative checks.

Remaining limits: there is no native GL-render capture comparison; native target-list damage dispatch is inspected from bytecode, with live callbacks covered on the browser side; anvil entity random state is regenerated after reload. Full Minecraft parity is not claimed.
