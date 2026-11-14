# Wood slabs, fence gates, trapdoors and cobblestone walls (1.7.10)

Native evidence: `public/research/shaped-blocks-reference.json` (4316 rows), produced by `tools/verify-shaped-blocks.mjs` over `tools/probes/ShapedBlocksProbe.java` against the unchanged 1.7.10 client (sha1 `e80d9b3b...`). The probe runs `BlockWoodSlab` (aoo, original 125/126), `BlockFenceGate` (ala, 107), `BlockTrapDoor` (aoe, 96), `BlockWall` (aoi, 139) and `BlockFence` (akz) over a map-backed `World` double, with `ItemSlab`/`ItemBlock`/`ItemMultiTexture` run through `onItemUse`. `src/shaped-blocks.test.js` replays it. This is not full parity.

## Ids

Internal ids 165-169, items 1000 + id (the double slab has no item). Original ids are in `block-registry.js`.

| Internal | Original | Block | Item |
|---|---|---|---|
| 165 | 126 | wood slab (meta & 7 = wood type, bit 8 = top half) | 1165, damage = type |
| 166 | 125 | double wood slab, drops two 1165 | none |
| 167 | 107 | fence gate (bits 0-1 facing, bit 4 open) | 1167 |
| 168 | 96 | trapdoor (bits 0-1 support side, 4 open, 8 top half) | 1168 |
| 169 | 139 | cobblestone wall (0 normal, 1 mossy) | 1169, damage = meta |

Internal 140-164 are `reserved` placeholders in `BLOCKS` (world.js) so ids stay contiguous with 165; `block-registry.js` and the tests that iterate `BLOCKS` skip them and their items are hidden.

## Behaviour (all ported from the original classes)

- Slabs: half chosen by the clicked face and hit y (`side === 0 || (side !== 1 && hy > 0.5)`); `ItemSlab` merges into a double slab on the open face or in the adjacent cell for the same type only (837 `slabUse` rows). Hardness 2, wood, axe, resistance 3, 3 planks of one type make 6 slabs (recipes 200-205).
- Fence gate: facing `floor(yaw*4/360+0.5)&3`; closed collision 1.5 high, open none; use turns it away from the player and toggles bit 4; redstone via the live engine (`installShapedBlocks`, behaviour for original 107); needs a solid-material block below; connects to fences and walls. Recipe 153.
- Trapdoor: side faces only (2-5), meta from the side and hit y; support must be a normal cube, glowstone, slab or stair or it drops itself (live engine behaviour for original 96); toggles by hand and by power; recipe 155 (6 planks make 2). Hardness 3.
- Wall: connects to walls, gates and opaque normal-rendering blocks except gourds (`wallSolid` in world.js, the fence rule minus the fence); post/arm bounds from the 4-bit mask, collision 1.5 high; recipes 150 (cobblestone) and 151 (mossy, damage 1). Hardness 2, rock, pickaxe, resistance 6. Torches stand on walls (`torches.js`).
- Daylight sensor (recipe 109) now has its recipe: 3 glass, 3 quartz, 3 wood slabs.

## Deviations and gaps

- The render models are this build's own boxes (vanilla-like): gate posts/rails/bar with leaves swung toward the facing when open; wall post plus 0.8125 arms (or the thin straight run). Not checked against the native renderer.
- The probe's recorded wall selection `y1 = 1.5` is shared-bounds state from the collision call; the client calls `setBlockBoundsBasedOnState` first, so selection is 1 high here.
- Batch 69 (docs sweep): Silk Touch exists (`src/enchantment-effects.js`, see [snow](snow.md)); whether the double wood slab honours it was not checked, so the line is left open: silk touch for the double wood slab.
- Placement support/solidity for the gate uses a hand-written non-solid list (air, liquids, snow layer, plants, fire, torch, ladder, vine, rails, wire) checked against the 23 `gateSupport` rows only through the registry.
- Item and block sounds come from the registry mapping through `block-sounds.js` (dig.wood / dig.stone); the door sound reuses `doorSound` (aux 1003).
- Shadow/lighting rows for 165-169 are not in `shadow-reference.json`; `lighting.js` and `shadows.js` carry the native opacity (slabs 255, gate/trapdoor/wall 0).
