# Live doors, iron bars and glass panes (Minecraft Java 1.7.10)

Internal blocks 97 (wooden door), 98 (iron door), 99 (iron bars) and 100 (glass pane) map to original blocks 64, 71, 101 and 102 with the original metadata domain unchanged, so villages and strongholds that place raw metadata stay valid. `src/doors-panes.js` holds the rules; the registry, world bounds, scene, placement, break, mining, explosion, lighting, pathfinding and population modules call into it.

Items: `ItemDoor` items 324 and 330 are internal items 470 and 471 (stack 1). Tools own internal item ids 100-127, so the glass pane item is 1100 (original item 102); iron bars keep item 99.

## Native evidence

`tools/verify-doors-panes.mjs` runs the pinned 1.7.10 JAR through `tools/probes/DoorPaneProbe.java` and writes `public/research/doors-panes-reference.json` (1222 records): block facts (hardness, resistance, material, light opacity, sound, drops by metadata, tool speeds and harvest, Silk Touch), 171 pane connection rows, 64 door metadata states with bounds, selection, collision boxes and 24 ray traces per half, 16 lone-half states, 128 right-click results, 32 redstone open/close results, 75 yaw, 196 hinge, 6 side, 30 support, 56 occupancy and 4 height placements, 264 breaks (survival and creative, both halves), 108 neighbour updates (support, lone half, power) and 64 pane shapes plus 32 pane neighbours and render-side tables. `src/doors-panes.test.js` replays them against the port, skipping rows whose original block has no exact port block.

## What is live

- Doors: placement on a top face with the yaw facing and `func_150924_a` hinge choice, both halves, right-click opening (wooden only; the aux 1003 sound plays open or close at random), one drop from the lower half, Creative upper-half break, removal when support or the other half goes, open doors passable for mob path finding.
- Panes and bars: connection to opaque cubes, glass and other panes (not fences, slabs or stairs), arm collision boxes, single selection box, flat inventory sprites, Silk Touch for bars and panes, bars needing a pickaxe, glass panes dropping nothing.
- Recipes: wooden door, iron door, 16 glass panes, 16 iron bars; Creative tabs match the native tab indexes.

## Limits

- Batch 69 (docs sweep): redstone is live (`redstone.js`, `redstone-runtime.js`, see `redstone-live.md`); the placement hook handles doors (`placement.reason === "door"`). Iron doors still never open by hand, as natively.
- The sound pitch of 1.5 for iron blocks is not reproduced; stained glass and panes were not in the port at the time (Batch 69 docs sweep: `STAINED_GLASS` and `STAINED_GLASS_PANE` are imported in `world.js` now, see `colored-blocks.md`); no hopper support surface.
- Pane render geometry approximates `renderBlockPane` (UV and strip details); held and dropped panes are flat sprites.
- No native GL capture comparison.
