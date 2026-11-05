# Colored and storage blocks (1.7.10)

Scope: stained glass (95), stained glass pane (160), carpet (171), hay bale (170), blocks of coal (173), lapis lazuli (22) and emerald (133), sponge (19) and the jack o'lantern (91). In this build they use internal block ids 140-148 and item ids 1140-1148 (1000 + block id, because plain ids above 100 belong to tools). Original ids are kept in the registry mapping, save export and import. This does not claim full parity.

## Evidence

`tools/probes/ColoredBlocksProbe.java` runs the unchanged 1.7.10 classes (JAR SHA1 e80d9b3b...bc6) over a minimal world double: block properties, per-metadata bounds and drops, harvest strengths, ItemBlock/ItemCloth placement for every face, yaw sweeps for the pumpkin and jack o'lantern, carpet support and neighbour change, CraftingManager recipes and grids, furnace fuel and BlockFire tables. `tools/verify-colored-blocks.mjs` writes `public/research/colored-blocks-reference.json` (1550 rows: 10 block, 70 meta, 100 harvest, 330 placed, 194 yaw, 24 support, 9 carpet neighbour, 360 onPlaced, 280 drops, 62 craft, 84 recipe, 16 fuel, 10 fire, 1 items). `src/colored-blocks.test.js` replays it. Class hashes are pinned in the reference.

## Behaviour

- Stained glass: hardness 0.3, drops nothing, translucent render pass, a face against the same block with the same metadata is not drawn (bytecode compares metadata, then identity); silk touch returns the coloured item.
- Pane: glass-pane connection shape, the colour tile for sides and the matching top tile.
- Carpet: 1/16 selection box, needs a non-air block below and drops itself otherwise, burns 60/20.
- Hay bale: axis from the clicked face, drops with metadata & 3, burns 60/20. Coal block burns 5/5 and fuels 16000 ticks.
- Sponge has no behaviour in 1.7.10. Jack o'lantern: light 15, facing from player yaw.
- Creative tabs list them in native order; crafting covers the stained glass, pane, carpet, hay, mineral block and jack o'lantern recipes.

## Remaining differences

- Pane connection keeps iron bars and glass panes in one group rather than the exact same-block rule.
- Carpet collision is not probed separately; player break speed and `useNeighborBrightness` are not probed.
- Block sounds and structure-framework opacity were not checked. In a live browser all nine blocks render in a Creative world, and carpet and hay burn next to netherrack fire.
- Item ids 1140-1148 are internal.
