# Paintings and item frames (1.7.10)

Classes (obfuscated names): `ss` EntityHanging, `tb` EntityPainting (entity id 9, item 321), `st` EntityItemFrame (entity id 18, item 389), `tc` EnumArt, `acz` ItemHangingEntity, `bon` RenderPainting, `bnx` RenderItemFrame.

Code: `src/hanging.js` (rules), `src/hanging-interaction.js` (aim, place, hit, use), `src/hanging-renderer.js` (meshes). Native evidence: `tools/probes/HangingProbe.java`, `tools/verify-hanging.mjs`, `public/research/hanging-reference.json` (274 records: arts 1, bounds 12, surface 4, select 196, select-none 1, frame 10, painting-hit 4, tick 5, place 30, nbt-read 11). `src/hanging.test.js` replays them.

## Rules implemented

- Placement: only on block sides (no top/bottom). Side to direction table `[-1,-1,2,0,1,3]`; direction 0 south (+z), 1 west (-x), 2 north (-z), 3 east (+x). The entity sits 0.5625 in front of the clicked wall block.
- Bounding box: the thickness axis is inverted natively (min > max). Replicated. `onValidSurface` collides only with blocks, never other hanging entities, so overlapping paintings/frames are allowed.
- Surface check every 100 ticks (`tickCounter1++ == 100`, so it fires on the 101st update); an invalid entity breaks and drops.
- Painting art: 26 EnumArt entries (not 25). Candidates are the entries that fit; one is picked with the entity's own `Random`. Replayed with seeds.
- Item frame: an empty frame accepts one item; right-click with an item inserts it, right-click on a filled frame rotates. Rotation is `% 4` (4 steps of 90 degrees). First hit on a filled frame drops the item and leaves the frame; the next hit breaks it. `itemDropChance` is 1.0.
- Breaking: hits, explosions (damage source is never a player), arrows (source is the shooter). Creative players cause no drops.
- Recipes: painting = 8 sticks + wool; frame = 8 sticks + leather. Verified by the native CraftingManager audit.
- Persistence: saved in the world record under `hanging`; old saves without it load as empty. Java export writes `Painting` and `ItemFrame` entities (Direction, Dir, TileX/Y/Z, Motive, Item, ItemRotation, ItemDropChance). Tested in `src/region-export.test.js`.

## Not in 1.7.10 (documented, not missing)

- Comparator reading of item-frame rotation does not exist in 1.7.10.
- Placing, rotating, filling and breaking have no native sounds in 1.7.10; none are played.

## Remaining differences

- Region import of Painting/ItemFrame entities is not implemented (counted as lost).
- Frames holding maps draw as ordinary frames (maps out of scope).
- Adventure-mode `canPlayerEdit` check is not applied.
- Frame bar and back-panel UVs use the full tile rather than the native sub-cropped regions.
- Rendering is built from bytecode facts. A localhost check showed a placed painting (Wasteland), a frame with an item and a rotation update; no pixel comparison against the original was made.
